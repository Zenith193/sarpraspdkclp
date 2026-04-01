#!/bin/bash
# ============================================================
# STEP 1: Jalankan di SERVER LAMA (ssh root@202.155.18.22)
# ============================================================
# Script ini akan:
# 1. Dump database PostgreSQL
# 2. Compress folder uploads
# 3. Backup .env
# 4. Transfer semua ke server baru via scp
# ============================================================

echo "=========================================="
echo "  MIGRASI SPIDOL - STEP 1: EXPORT DATA"
echo "=========================================="

NEW_SERVER="202.155.14.140"
APP_DIR="/var/www/sarpraspdkclp"
BACKUP_DIR="/tmp/spidol_migration"

# Buat folder backup
mkdir -p $BACKUP_DIR

# 1. Dump database PostgreSQL
echo ""
echo "📦 [1/4] Dumping database spidol..."
pg_dump -U postgres -d spidol -F c -f $BACKUP_DIR/spidol.dump
echo "✅ Database dump selesai: $(ls -lh $BACKUP_DIR/spidol.dump | awk '{print $5}')"

# 2. Backup .env
echo ""
echo "📋 [2/4] Backup .env..."
cp $APP_DIR/server/.env $BACKUP_DIR/server.env
echo "✅ .env backed up"

# 3. Compress uploads folder
echo ""
echo "📁 [3/4] Compressing uploads folder..."
if [ -d "$APP_DIR/uploads" ]; then
    cd $APP_DIR
    tar -czf $BACKUP_DIR/uploads.tar.gz uploads/
    echo "✅ Uploads compressed: $(ls -lh $BACKUP_DIR/uploads.tar.gz | awk '{print $5}')"
else
    echo "⚠️ Folder uploads tidak ditemukan, skip..."
fi

# Tampilkan ringkasan
echo ""
echo "=========================================="
echo "  RINGKASAN BACKUP"
echo "=========================================="
ls -lh $BACKUP_DIR/
echo ""
echo "Total size:"
du -sh $BACKUP_DIR/

# 4. Transfer ke server baru
echo ""
echo "🚀 [4/4] Transfer ke server baru ($NEW_SERVER)..."
echo "Masukkan password root server baru saat diminta."
echo ""

# Pastikan server baru bisa diakses
scp -r $BACKUP_DIR root@$NEW_SERVER:/tmp/spidol_migration

echo ""
echo "=========================================="
echo "  ✅ STEP 1 SELESAI!"
echo "=========================================="
echo "Data sudah ditransfer ke $NEW_SERVER:/tmp/spidol_migration"
echo ""
echo "Selanjutnya: Login ke server baru dan jalankan STEP 2"
echo "  ssh root@$NEW_SERVER"
echo "  bash /tmp/spidol_migration/setup_new_server.sh"
