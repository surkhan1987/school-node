#!/bin/bash

# School Management Backend Deployment Script
# Usage: ./deploy.sh [SERVER_IP]
# 
# REPLACE YOUR_SERVER_IP with your actual VPS server IP address
# Example: ./deploy.sh 192.168.1.100
#          ./deploy.sh 45.123.45.67

set -e  # Exit on any error

# ===== CONFIGURATION =====
# Change "YOUR_SERVER_IP" below to your actual VPS server IP address
# Example: SERVER_IP=${1:-"192.168.1.100"}
#          SERVER_IP=${1:-"45.123.45.67"}
SERVER_IP=${1:-"YOUR_SERVER_IP"}  # <-- PUT YOUR VPS SERVER IP HERE
SERVER_USER="root"                # <-- Change if you use different username
APP_NAME="school-backend"
REPO_URL="https://github.com/surkhan1987/school-node.git"
BRANCH="botir"
DEPLOY_DIR="/var/www/school-backend"

if [ "$SERVER_IP" = "YOUR_SERVER_IP" ]; then
    echo "❌ Please provide server IP: ./deploy.sh YOUR_SERVER_IP"
    exit 1
fi

echo "🚀 Deploying Backend to: $SERVER_USER@$SERVER_IP"

# Test SSH connection
echo "🔍 Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes $SERVER_USER@$SERVER_IP exit 2>/dev/null; then
    echo "❌ Cannot connect to server. Check SSH setup."
    exit 1
fi

echo "📦 Installing prerequisites on server..."
SETUP_SCRIPT="
set -e
apt update
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install -g pm2
mkdir -p $DEPLOY_DIR
chown -R \$USER:\$USER /var/www/
"
ssh $SERVER_USER@$SERVER_IP "$SETUP_SCRIPT"

echo "🔄 Deploying backend application..."
DEPLOY_SCRIPT="
set -e
cd $DEPLOY_DIR

# Clone or update repository
if [ ! -d '.git' ]; then
    git clone $REPO_URL .
    git checkout $BRANCH
else
    git fetch origin
    git reset --hard origin/$BRANCH
fi

# Setup environment
if [ ! -f '.env' ]; then
    cp .env.example .env
    echo 'Edit .env file with production values'
fi

# Install and setup
npm ci --only=production
mkdir -p logs

# PM2 process management
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u \$USER --hp \$HOME

echo '✅ Backend deployed successfully!'
pm2 status
"
ssh $SERVER_USER@$SERVER_IP "$DEPLOY_SCRIPT"

echo ""
echo "✅ Backend deployment completed!"
echo "🌐 Backend API: http://$SERVER_IP:4050"
echo "📝 SSH to server: ssh $SERVER_USER@$SERVER_IP"
echo "📊 Check status: ssh $SERVER_USER@$SERVER_IP 'pm2 status'"