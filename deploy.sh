#!/bin/bash
# ============================================
# OpenSeller.ma - Quick Deploy Script
# Run from project root: bash deploy.sh
# ============================================

set -e

echo "🚀 Deploying OpenSeller.ma..."

cd /var/www/openseller
git pull origin main

# Backend
echo ">>> Building backend..."
cd /var/www/openseller/backend
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart openseller-api

# Frontend
echo ">>> Building frontend..."
cd /var/www/openseller/frontend
npm install
npm run build

echo ""
echo "✅ Deployment complete!"
echo "   Run 'pm2 logs openseller-api' to check backend logs"
