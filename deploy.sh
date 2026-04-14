#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing server dependencies..."
npm install --omit=dev

echo "==> Installing client dependencies & building..."
cd client && npm install && npx vite build && cd ..

echo "==> Restarting app..."
pm2 restart handball-statistics

echo "==> Done."
pm2 status handball-statistics
