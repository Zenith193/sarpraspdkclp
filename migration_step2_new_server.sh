#!/bin/bash
# ============================================================
# STEP 2: Jalankan di SERVER BARU (ssh root@202.155.14.140)
# ============================================================
# Script ini akan:
# 1. Install semua dependencies (Node.js 20, PostgreSQL 16, Nginx, PM2)
# 2. Setup database PostgreSQL
# 3. Clone & deploy aplikasi
# 4. Restore database dump
# 5. Restore uploads
# 6. Configure Nginx + SSL
# 7. Start PM2
# ============================================================

set -e

echo "=========================================="
echo "  MIGRASI SPIDOL - STEP 2: SETUP SERVER"
echo "=========================================="

APP_DIR="/var/www/sarpraspdkclp"
BACKUP_DIR="/tmp/spidol_migration"
DOMAIN="sarpraspdkclp.id"
DB_NAME="spidol"
DB_USER="postgres"
DB_PASS="Goldroger9"

# ===== 1. INSTALL DEPENDENCIES =====
echo ""
echo "📦 [1/7] Installing dependencies..."

# Update system
apt update && apt upgrade -y

# Install essential tools
apt install -y curl git build-essential

# Install Node.js 20.x
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql
echo "PostgreSQL: $(psql --version)"

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt install -y nginx
fi
systemctl enable nginx
systemctl start nginx
echo "Nginx: $(nginx -v 2>&1)"

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi
echo "PM2: $(pm2 -v)"

# Install Certbot
apt install -y certbot python3-certbot-nginx

# Install LibreOffice (untuk generate DOCX→PDF)
if ! command -v libreoffice &> /dev/null; then
    echo "Installing LibreOffice..."
    apt install -y libreoffice-core libreoffice-writer
fi

echo "✅ Semua dependencies terinstall"

# ===== 2. SETUP POSTGRESQL =====
echo ""
echo "🗄️ [2/7] Setting up PostgreSQL..."

# Set password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$DB_PASS';" 2>/dev/null || true

# Create database if not exists
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database '$DB_NAME' sudah ada"

# Restore database dump
if [ -f "$BACKUP_DIR/spidol.dump" ]; then
    echo "Restoring database from dump..."
    sudo -u postgres pg_restore -d $DB_NAME -c --if-exists --no-owner --no-privileges $BACKUP_DIR/spidol.dump 2>/dev/null || true
    echo "✅ Database restored"
else
    echo "❌ File dump tidak ditemukan di $BACKUP_DIR/spidol.dump"
    echo "   Pastikan STEP 1 sudah dijalankan di server lama"
fi

# Tambahkan kolom baru tanggal_sp2d jika belum ada
sudo -u postgres psql -d $DB_NAME -c "ALTER TABLE pencairan ADD COLUMN IF NOT EXISTS tanggal_sp2d DATE;" 2>/dev/null || true

echo "✅ PostgreSQL setup selesai"

# ===== 3. CLONE REPOSITORY =====
echo ""
echo "📂 [3/7] Cloning repository..."

mkdir -p /var/www
if [ -d "$APP_DIR" ]; then
    echo "Directory exists, pulling latest..."
    cd $APP_DIR
    git pull origin main
else
    cd /var/www
    git clone https://github.com/Zenith193/sarpraspdkclp.git
fi

echo "✅ Repository ready"

# ===== 4. INSTALL NPM PACKAGES =====
echo ""
echo "📦 [4/7] Installing npm packages..."

# Frontend
cd $APP_DIR
npm install

# Backend
cd $APP_DIR/server
npm install

echo "✅ NPM packages installed"

# ===== 5. RESTORE UPLOADS & ENV =====
echo ""
echo "📁 [5/7] Restoring uploads & .env..."

# Restore uploads
if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
    cd $APP_DIR
    tar -xzf $BACKUP_DIR/uploads.tar.gz
    chmod -R 755 uploads/
    echo "✅ Uploads restored"
else
    mkdir -p $APP_DIR/uploads
    echo "⚠️ No uploads backup found, created empty directory"
fi

# Setup .env
if [ -f "$BACKUP_DIR/server.env" ]; then
    cp $BACKUP_DIR/server.env $APP_DIR/server/.env
    echo "✅ .env restored from backup"
else
    # Create new .env
    cat > $APP_DIR/server/.env << 'ENVEOF'
DATABASE_URL=postgresql://postgres:Goldroger9@127.0.0.1:5432/spidol
BETTER_AUTH_SECRET=spidol-super-secret-key-2026-cilacap
BETTER_AUTH_URL=https://sarpraspdkclp.id
PORT=3000
UPLOAD_DIR=/var/www/sarpraspdkclp/uploads
ENVEOF
    echo "✅ Created new .env"
fi

# Update .env untuk production
cd $APP_DIR/server
sed -i "s|BETTER_AUTH_URL=.*|BETTER_AUTH_URL=https://$DOMAIN|" .env
sed -i "s|UPLOAD_DIR=.*|UPLOAD_DIR=$APP_DIR/uploads|" .env
sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME|" .env

echo "📋 Current .env:"
cat .env
echo ""

# ===== 6. BUILD & START APPLICATION =====
echo ""
echo "🔨 [6/7] Building & starting application..."

# Build frontend
cd $APP_DIR
npm run build
echo "✅ Frontend built"

# Stop existing PM2 processes if any
pm2 delete all 2>/dev/null || true

# Start backend with tsx
cd $APP_DIR/server
pm2 start "npx tsx src/index.ts" --name spidol-api --cwd $APP_DIR/server
pm2 save

# Setup PM2 startup on boot
pm2 startup systemd -u root --hp /root 2>/dev/null || true
pm2 save

echo "✅ PM2 started"

# Wait for app to start
sleep 3
echo "Health check:"
curl -s http://localhost:3000/api/health || echo "⚠️ API belum ready, cek pm2 logs"

# ===== 7. CONFIGURE NGINX =====
echo ""
echo "🌐 [7/7] Configuring Nginx..."

# Create Nginx config
cat > /etc/nginx/sites-available/sarpraspdkclp << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_DIR/dist;
    index index.html;

    client_max_body_size 50M;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINXEOF

# Enable site
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/sarpraspdkclp /etc/nginx/sites-enabled/

# Test & reload Nginx
nginx -t && systemctl reload nginx
echo "✅ Nginx configured"

echo ""
echo "=========================================="
echo "  ✅ SETUP SERVER BARU SELESAI!"
echo "=========================================="
echo ""
echo "📌 LANGKAH SELANJUTNYA:"
echo ""
echo "1. Update DNS A record untuk $DOMAIN → 202.155.14.140"
echo "   (di panel DNS provider sarpraspdkclp.id)"
echo ""
echo "2. Setelah DNS propagasi, setup SSL:"
echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "3. Setelah SSL aktif, update .env:"
echo "   sed -i 's|BETTER_AUTH_URL=.*|BETTER_AUTH_URL=https://$DOMAIN|' $APP_DIR/server/.env"
echo "   pm2 restart all"
echo ""
echo "4. Test akses di browser: https://$DOMAIN"
echo ""
echo "📊 Status saat ini:"
pm2 list
echo ""
echo "📋 Cek logs: pm2 logs spidol-api"
