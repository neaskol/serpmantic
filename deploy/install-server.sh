#!/bin/bash
# Server Setup Script for Hostinger VPS KVM2
# Run this ONCE on a fresh Ubuntu/Debian server

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

log "Starting SERPmantics VPS Setup..."

# 1. Update system
log "Updating system packages..."
apt-get update
apt-get upgrade -y

# 2. Install essential tools
log "Installing essential tools..."
apt-get install -y \
    curl \
    wget \
    git \
    htop \
    ufw \
    fail2ban \
    unzip \
    vim \
    build-essential \
    software-properties-common

# 3. Install Docker
log "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    log "Docker installed successfully"
else
    info "Docker already installed"
fi

# 4. Install Docker Compose
log "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    log "Docker Compose installed successfully"
else
    info "Docker Compose already installed"
fi

# 5. Install Nginx
log "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
    log "Nginx installed successfully"
else
    info "Nginx already installed"
fi

# 6. Install Certbot for SSL
log "Installing Certbot for SSL certificates..."
apt-get install -y certbot python3-certbot-nginx

# 7. Setup UFW Firewall
log "Configuring firewall..."
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw status

# 8. Setup Fail2Ban
log "Configuring Fail2Ban..."
systemctl enable fail2ban
systemctl start fail2ban

# 9. Create application directory
log "Creating application directories..."
APP_DIR="/var/www/serpmantic"
BACKUP_DIR="/var/backups/serpmantic"
LOG_DIR="/var/log/serpmantic"

mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# 10. Setup Git (you'll need to clone your repo manually)
info "Application directory created at: $APP_DIR"
warning "Next steps:"
echo "  1. cd $APP_DIR"
echo "  2. Clone your repository: git clone <your-repo-url> ."
echo "  3. Copy your .env.local file to apps/web/"
echo "  4. Run the deployment script: sudo bash deploy/deploy.sh"

# 11. System optimizations
log "Applying system optimizations..."

# Increase file limits
cat >> /etc/security/limits.conf << EOF
* soft nofile 65536
* hard nofile 65536
EOF

# Optimize network settings
cat >> /etc/sysctl.conf << EOF
# Network optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
EOF

sysctl -p

# 12. Setup automatic security updates
log "Enabling automatic security updates..."
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 13. Display system info
log "Setup completed! System information:"
echo ""
info "Docker version: $(docker --version)"
info "Docker Compose version: $(docker-compose --version)"
info "Nginx version: $(nginx -v 2>&1)"
info "Certbot version: $(certbot --version 2>&1 | head -n1)"
echo ""
info "Firewall status:"
ufw status
echo ""
info "Application directory: $APP_DIR"
info "Backup directory: $BACKUP_DIR"
info "Log directory: $LOG_DIR"
echo ""

log "Server setup completed successfully! 🎉"
echo ""
warning "IMPORTANT: Remember to:"
echo "  1. Change SSH port (edit /etc/ssh/sshd_config)"
echo "  2. Disable root login (edit /etc/ssh/sshd_config)"
echo "  3. Setup SSH keys instead of passwords"
echo "  4. Clone your repository to $APP_DIR"
echo "  5. Configure your domain DNS to point to this server"
echo "  6. Run Certbot to get SSL: sudo certbot --nginx -d your-domain.com"
