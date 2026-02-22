#!/bin/bash

# ICU Payment System - Deployment Script
# Run from project root: ./scripts/deploy.sh

set -e

echo "======================================"
echo "ICU Payment System - Deployment"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${YELLOW}➜ $1${NC}"; }

# Resolve project root (script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Docker Compose command (v2 plugin or v1 standalone)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    print_error "Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

if ! command -v docker &>/dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

print_success "Docker and Docker Compose are installed"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    print_info "Creating .env file..."
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "dev-jwt-secret-change-in-production")
    cat > .env << EOF
# Database
DB_PASSWORD=icu_secure_password_2024

# JWT Secret
JWT_SECRET=$JWT_SECRET

# URLs
FRONTEND_URL=http://localhost:3000
VITE_API_URL=

# Node Environment
NODE_ENV=production
EOF
    print_success ".env file created"
else
    print_info ".env file already exists"
fi

# Create directories
print_info "Creating directory structure..."
mkdir -p uploads/deposit-slips uploads/bank-statements uploads/statements uploads/clearances
mkdir -p logs
mkdir -p blockchain/crypto-config blockchain/channel-artifacts
print_success "Directory structure created"

# Verify database schema exists
if [ ! -f database/schema.sql ]; then
    print_error "database/schema.sql not found. Run from project root."
    exit 1
fi
print_success "Database schema ready"

# Build images
print_info "Building Docker images (this may take a few minutes)..."
$DOCKER_COMPOSE build
print_success "Docker images built"

# Start services
print_info "Starting services..."
$DOCKER_COMPOSE up -d
print_success "Services started"

# Wait for health
print_info "Waiting for services to be healthy..."
sleep 15

# Check running containers
print_info "Checking service status..."
CONTAINERS=("icu-postgres" "icu-redis" "icu-backend" "icu-python-service" "icu-frontend")
for name in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
        print_success "$name is running"
    else
        print_error "$name is not running"
    fi
done

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
print_success "Frontend:    http://localhost:3000"
print_success "Backend API: http://localhost:5000"
print_success "Python:      http://localhost:8000"
print_success "PostgreSQL:  localhost:5432"
print_success "Redis:       localhost:6379"
echo ""
print_info "Default admin login:"
echo "  Username: admin"
echo "  Password: admin123"
echo "  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!"
echo ""
print_info "View logs:    $DOCKER_COMPOSE logs -f"
print_info "Stop:         $DOCKER_COMPOSE down"
print_info "Restart:      $DOCKER_COMPOSE restart"
echo ""
print_success "System is ready!"
