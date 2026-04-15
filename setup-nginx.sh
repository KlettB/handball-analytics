#!/bin/bash
set -e

echo "==> Installing nginx..."
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Writing nginx config..."
cat > /etc/nginx/sites-available/handball-statistics << 'NGINXCONF'
server {
    listen 80;
    server_name handball-statistics.de www.handball-statistics.de;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINXCONF

echo "==> Enabling site..."
ln -sf /etc/nginx/sites-available/handball-statistics /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing nginx config..."
nginx -t

echo "==> Starting nginx..."
systemctl restart nginx
systemctl enable nginx

echo "==> Setting up HTTPS..."
certbot --nginx -d handball-statistics.de -d www.handball-statistics.de --non-interactive --agree-tos -m admin@handball-statistics.de --redirect

echo ""
echo "==> Done! App is now available at https://handball-statistics.de"
