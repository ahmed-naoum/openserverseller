#!/bin/bash
# ============================================
# SILACOD - Quick Deploy Script
# Run from project root: bash deploy.sh
# ============================================

set -e

echo "🚀 Deploying SILACOD..."

cd /var/www/openseller
git pull origin master

# Backend
echo ">>> Building backend..."
cd /var/www/openseller/backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss
npm run build
pm2 restart silacod-api

# Frontend
echo ">>> Building frontend..."
cd /var/www/openseller/frontend
npm install
npm run build

echo ""
echo "✅ Deployment complete!"
echo "   Run 'pm2 logs silacod-api' to check backend logs"

