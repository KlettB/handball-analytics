#!/bin/bash
# Run once on a fresh Ubuntu 22.04 server as root
# Usage: bash setup-server.sh
set -e

echo "==> Updating system..."
apt-get update && apt-get upgrade -y

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

echo "==> Installing PM2..."
npm install -g pm2

echo "==> Cloning repository..."
# Replace with your actual GitHub repo URL
git clone https://github.com/KlettB/handball-analytics.git /opt/handball-statistics
cd /opt/handball-statistics

echo "==> Installing dependencies..."
npm install --omit=dev
cd client && npm install && npx vite build && cd ..

echo "==> Creating .env file..."
cat > .env << 'EOF'
NODE_ENV=production
PORT=3001
TEAM_ID=handball4all.baden-wuerttemberg.1331086
TEAM_NAME=HTV Meißenheim
SEASON_START=2025-07-01
SEASON_END=2026-06-30
EOF

echo "==> Starting app with PM2..."
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "==> Setup complete!"
echo "    App running on port 3001"
echo "    Access via: http://$(curl -s ifconfig.me):3001"
echo ""
echo "==> Trigger first data fetch:"
echo "    curl -X POST http://localhost:3001/api/fetch-data"
