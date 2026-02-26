#!/bin/bash
# ============================================
# OpenSeller.ma - Ubuntu VPS Setup Script
# Run as root: bash setup.sh
# ============================================

set -e

echo "=========================================="
echo "  OpenSeller.ma - VPS Setup"
echo "=========================================="

# ---- 1. System Update ----
echo ""
echo ">>> [1/8] Updating system..."
apt update && apt upgrade -y

# ---- 2. Install Node.js 22 ----
echo ""
echo ">>> [2/8] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
echo "Node: $(node -v) | npm: $(npm -v)"

# ---- 3. Install PostgreSQL ----
echo ""
echo ">>> [3/8] Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Create DB user & database
read -sp "Enter a password for the 'openseller' database user: " DB_PASS
echo ""
sudo -u postgres psql -c "CREATE USER openseller WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "CREATE DATABASE openseller_db OWNER openseller;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE openseller_db TO openseller;"
echo "✅ PostgreSQL ready! DATABASE_URL: postgresql://openseller:${DB_PASS}@localhost:5432/openseller_db"

# ---- 4. Install Redis ----
echo ""
echo ">>> [4/8] Installing Redis..."
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server
echo "Redis: $(redis-cli ping)"

# ---- 5. Install PM2 ----
echo ""
echo ">>> [5/8] Installing PM2..."
npm install -g pm2

# ---- 6. Install Nginx ----
echo ""
echo ">>> [6/8] Installing Nginx..."
apt install -y nginx
systemctl enable nginx

# ---- 7. Clone & Setup Project ----
echo ""
echo ">>> [7/8] Cloning project..."
mkdir -p /var/www
cd /var/www

if [ -d "openseller" ]; then
  echo "Directory /var/www/openseller already exists. Pulling latest..."
  cd openseller
  git pull origin main
else
  git clone https://github.com/ahmed-naoum/openserverseller.git openseller
  cd openseller
fi

# Backend setup
echo ""
echo "Setting up backend..."
cd /var/www/openseller/backend
npm install

# Create .env from template
cp .env.example .env
# Replace DATABASE_URL with the actual password
sed -i "s|YOUR_PASSWORD|${DB_PASS}|g" .env

# Generate a random JWT secret
JWT_SECRET=$(openssl rand -hex 32)
sed -i "s|CHANGE_ME_generate_a_64_char_random_string|${JWT_SECRET}|g" .env

echo ""
read -p "Enter your domain name (or VPS IP, e.g. yourdomain.com): " DOMAIN
sed -i "s|https://yourdomain.com|https://${DOMAIN}|g" .env

echo ""
echo "Your .env file:"
cat .env
echo ""
read -p "Edit .env now? (y/n): " EDIT_ENV
if [ "$EDIT_ENV" = "y" ]; then
  nano .env
fi

# Prisma setup
npx prisma generate
npx prisma db push

# Seed the database
echo ""
read -p "Seed the database with initial data? (y/n): " SEED_DB
if [ "$SEED_DB" = "y" ]; then
  npm run db:seed
fi

# Build
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save

# Frontend setup
echo ""
echo "Setting up frontend..."
cd /var/www/openseller/frontend
npm install
npm run build

# ---- 8. Configure Nginx ----
echo ""
echo ">>> [8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/openseller << NGINX_CONF
server {
    listen 80;
    server_name ${DOMAIN};

    # Frontend (static files)
    location / {
        root /var/www/openseller/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Socket.io WebSocket support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Uploaded files
    location /uploads/ {
        alias /var/www/openseller/backend/uploads/;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/openseller /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# ---- Firewall ----
echo ""
echo "Setting up firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ---- PM2 startup ----
pm2 startup systemd -u root --hp /root
pm2 save

# ---- SSL (optional) ----
echo ""
read -p "Install SSL certificate with Let's Encrypt? (y/n): " INSTALL_SSL
if [ "$INSTALL_SSL" = "y" ]; then
  apt install -y certbot python3-certbot-nginx
  certbot --nginx -d ${DOMAIN}
fi

echo ""
echo "=========================================="
echo "  ✅ OpenSeller.ma Setup Complete!"
echo "=========================================="
echo ""
echo "  🌐 Frontend: http://${DOMAIN}"
echo "  🔌 API:      http://${DOMAIN}/api/v1"
echo "  📊 PM2:      pm2 status"
echo "  📋 Logs:     pm2 logs openseller-api"
echo ""
echo "  Useful commands:"
echo "    pm2 restart openseller-api"
echo "    pm2 logs openseller-api"
echo "    sudo -u postgres psql openseller_db"
echo "    cd /var/www/openseller && bash deploy.sh"
echo ""
