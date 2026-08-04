#!/bin/bash
# run_deploy.sh <deployment_id> <project_root>

DEPLOYMENT_ID=$1
PROJECT_ROOT=$2

cd "$PROJECT_ROOT" || exit 1
echo "🚀 Starting deployment $DEPLOYMENT_ID in $PROJECT_ROOT..." > backend/deployment.log

echo "📥 Git pull..." >> backend/deployment.log
git pull >> backend/deployment.log 2>&1
GIT_EXIT=$?
if [ $GIT_EXIT -ne 0 ]; then
  echo "❌ Git pull failed" >> backend/deployment.log
  echo "FAILED" > backend/deployment_status.txt
  exit 1
fi

echo "🔨 Building backend..." >> backend/deployment.log
cd backend || exit 1
npm run build >> deployment.log 2>&1
BACKEND_EXIT=$?
if [ $BACKEND_EXIT -ne 0 ]; then
  echo "❌ Backend build failed" >> deployment.log
  echo "FAILED" > deployment_status.txt
  exit 1
fi

echo "🔨 Building frontend..." >> deployment.log
cd ../frontend || exit 1
npm run build >> ../backend/deployment.log 2>&1
FRONTEND_EXIT=$?
if [ $FRONTEND_EXIT -ne 0 ]; then
  echo "❌ Frontend build failed" >> ../backend/deployment.log
  echo "FAILED" > ../backend/deployment_status.txt
  exit 1
fi

echo "✅ Deployment successful. Restarting PM2 process..." >> ../backend/deployment.log
echo "SUCCESS" > ../backend/deployment_status.txt

pm2 restart silacod-api >> ../backend/deployment.log 2>&1
