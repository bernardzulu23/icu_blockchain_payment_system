#!/bin/bash
# setup-production.sh - Complete production setup script
# Usage: ./scripts/setup-production.sh <domain> <docker_hub_username>
# Example: ./scripts/setup-production.sh payment.icu.edu.zm myusername

set -e

DOMAIN="${1:-yourdomain.com}"
DOCKER_USERNAME="${2:-myusername}"

echo "=========================================="
echo "🚀 ICU Payment System - Production Setup"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Docker Hub User: $DOCKER_USERNAME"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v docker &> /dev/null || { echo -e "${RED}❌ Docker not installed${NC}"; exit 1; }
command -v git &> /dev/null || { echo -e "${RED}❌ Git not installed${NC}"; exit 1; }
command -v openssl &> /dev/null || { echo -e "${RED}❌ OpenSSL not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ All prerequisites found${NC}"
echo ""

# Step 1: Create production environment file
echo "📝 Step 1: Creating production environment file..."
if [ ! -f .env.prod ]; then
    cp .env.example .env.prod
    
    # Update domain in env file
    sed -i "s|yourdomain.com|$DOMAIN|g" .env.prod
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|g" .env.prod
    sed -i "s|VITE_API_URL=.*|VITE_API_URL=https://api.$DOMAIN|g" .env.prod
    
    echo -e "${YELLOW}⚠️  Edit .env.prod with your secrets:${NC}"
    echo "   - DB_PASSWORD (strong random password)"
    echo "   - JWT_SECRET (strong random secret)"
    echo "   - REDIS_PASSWORD (strong random password)"
    echo "   - DOCKER_NAMESPACE=$DOCKER_USERNAME"
    echo ""
    read -p "Press enter after updating .env.prod..."
else
    echo -e "${GREEN}✅ .env.prod already exists${NC}"
fi
echo ""

# Step 2: Create SSL certificates (self-signed development only)
echo "📜 Step 2: Setting up SSL certificates..."
if [ ! -d "certs" ]; then
    mkdir -p certs
    
    echo ""
    echo -e "${YELLOW}⚠️  Choose SSL setup:${NC}"
    echo "1) Self-signed (development/testing only)"
    echo "2) Let's Encrypt (production) - manual setup"
    read -p "Enter choice (1 or 2): " ssl_choice
    
    if [ "$ssl_choice" = "1" ]; then
        echo -e "${YELLOW}Generating self-signed certificate...${NC}"
        openssl req -x509 -newkey rsa:4096 \
            -keyout certs/privkey.pem \
            -out certs/cert.pem \
            -days 365 -nodes \
            -subj "/C=ZM/ST=Lusaka/L=Lusaka/O=ICU/CN=$DOMAIN"
        echo -e "${GREEN}✅ Self-signed certificate created${NC}"
    elif [ "$ssl_choice" = "2" ]; then
        echo -e "${YELLOW}For Let's Encrypt:${NC}"
        echo "1. Install certbot: sudo apt-get install certbot python3-certbot-nginx"
        echo "2. Generate certificate: sudo certbot certonly --standalone -d $DOMAIN -d api.$DOMAIN"
        echo "3. Copy certificates:"
        echo "   sudo cp /etc/letsencrypt/live/$DOMAIN/cert.pem certs/"
        echo "   sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem certs/"
        echo "4. Set permissions: sudo chown \$USER:GROUP certs/*.pem"
        echo ""
        read -p "Press enter after certificate setup..."
    fi
else
    echo -e "${GREEN}✅ certs/ directory already exists${NC}"
fi
echo ""

# Step 3: Update nginx configuration
echo "⚙️  Step 3: Updating nginx configuration..."
sed -i "s|yourdomain.com|$DOMAIN|g" frontend/nginx-prod.conf
echo -e "${GREEN}✅ nginx configuration updated${NC}"
echo ""

# Step 4: Create logs directory
echo "📁 Step 4: Creating logs directory..."
mkdir -p logs/nginx
echo -e "${GREEN}✅ Logs directory created${NC}"
echo ""

# Step 5: GitHub Actions secrets (optional)
echo ""
echo "🔐 Step 5: GitHub Actions Setup (Optional)"
echo -e "${YELLOW}To enable automated CI/CD, add these secrets to your GitHub repository:${NC}"
echo ""
echo "Repository → Settings → Secrets and variables → Actions"
echo ""
echo "Required secrets:"
echo "  • DOCKER_HUB_USERNAME = $DOCKER_USERNAME"
echo "  • DOCKER_HUB_TOKEN = (create at https://hub.docker.com/settings/security)"
echo "  • PRODUCTION_HOST = (your server IP or domain)"
echo "  • PRODUCTION_USER = (SSH username)"
echo "  • PRODUCTION_SSH_KEY = (SSH private key)"
echo "  • PRODUCTION_PORT = 22 (SSH port)"
echo "  • PRODUCTION_DOMAIN = $DOMAIN"
echo "  • PRODUCTION_APP_PATH = /opt/icu-blockchain-payment-system"
echo ""
read -p "Press enter to continue..."
echo ""

# Step 6: Final checklist
echo "=========================================="
echo "✅ Production Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Deployment Checklist:"
echo "  [ ] Edit .env.prod with production secrets"
echo "  [ ] Set up SSL certificates in ./certs/"
echo "  [ ] Update nginx config with correct domain"
echo "  [ ] Build Docker images or pull from registry"
echo "  [ ] Configure DNS records pointing to server"
echo "  [ ] Set up GitHub Actions secrets (optional)"
echo "  [ ] Configure firewall (allow 80, 443)"
echo "  [ ] Set up database backups"
echo "  [ ] Configure monitoring/alerting"
echo ""
echo "🚀 To start production deployment:"
echo ""
echo "  # Pull environment file
echo "  cp .env.prod .env"
echo ""
echo "  # Option A: Pull pre-built images"
echo "  docker compose -f docker-compose.prod.yml pull"
echo ""
echo "  # Option B: Build images locally"
echo "  docker compose build"
echo ""
echo "  # Start services"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "  # Verify deployment"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  curl https://$DOMAIN"
echo ""
echo "📊 Monitor services:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
