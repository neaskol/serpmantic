#!/bin/bash
# SERPmantics Deployment Script for Hostinger VPS KVM2
# Usage: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
APP_DIR="/var/www/serpmantic"
BACKUP_DIR="/var/backups/serpmantic"
LOG_FILE="/var/log/serpmantic-deploy.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    error "Please run with sudo"
fi

log "Starting deployment for environment: $ENVIRONMENT"

# 1. Create backup
log "Creating backup..."
mkdir -p "$BACKUP_DIR"
if [ -d "$APP_DIR" ]; then
    BACKUP_NAME="serpmantic-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C "$(dirname $APP_DIR)" "$(basename $APP_DIR)" || warning "Backup failed, continuing anyway..."
    log "Backup created: $BACKUP_NAME"
fi

# 2. Pull latest code
log "Pulling latest code from repository..."
cd "$APP_DIR" || error "App directory not found"
git fetch origin
git pull origin main || error "Git pull failed"

# 3. Build and restart containers
log "Building Docker containers..."
docker-compose down || true
docker-compose build --no-cache || error "Docker build failed"

log "Starting containers..."
docker-compose up -d || error "Failed to start containers"

# 4. Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 10

# Check web service
log "Checking web service..."
for i in {1..30}; do
    if curl -f http://localhost:3000/api/health &>/dev/null; then
        log "Web service is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Web service failed to start"
    fi
    sleep 2
done

# Check NLP service
log "Checking NLP service..."
for i in {1..30}; do
    if curl -f http://localhost:8001/health &>/dev/null; then
        log "NLP service is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        error "NLP service failed to start"
    fi
    sleep 2
done

# 5. Reload Nginx
log "Reloading Nginx..."
nginx -t || error "Nginx configuration test failed"
systemctl reload nginx || error "Failed to reload Nginx"

# 6. Clean up old images
log "Cleaning up old Docker images..."
docker image prune -f || true

# 7. Show status
log "Deployment completed successfully!"
echo ""
log "Service Status:"
docker-compose ps
echo ""
log "Recent logs:"
docker-compose logs --tail=20

# 8. Send notification (optional - uncomment if you have a notification webhook)
# curl -X POST https://your-webhook-url.com -d "Deployment completed on $ENVIRONMENT"

log "All done! 🚀"
