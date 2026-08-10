#!/bin/bash
# QUICK REFERENCE CARD - Copy/Paste Commands
# Complete production deployment in ~30 minutes

# ============================================================
# 1. PUSH IMAGES TO REGISTRY (5 minutes)
# ============================================================

# Log in to Docker Hub (one-time)
docker login
# Username: your_docker_hub_username
# Password: (paste Personal Access Token from hub.docker.com/settings/security)

# Push images
./scripts/push-to-registry.sh docker.io your_username v1.0.0

# Verify
docker images | grep icu-
# Output should show: icu-backend, icu-frontend, icu-python-service

# ============================================================
# 2. SETUP SSL & PRODUCTION ENVIRONMENT (10 minutes)
# ============================================================

# Run setup script (interactive)
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh payment.icu.edu.zm your_username

# When prompted, choose:
# - [1] Self-signed for testing
# - [2] Let's Encrypt for production

# Edit production environment
cat .env.prod
# Update: DB_PASSWORD, JWT_SECRET, REDIS_PASSWORD (use strong random values)

# ============================================================
# 3. CONFIGURE GITHUB ACTIONS (5 minutes)
# ============================================================

# Go to: https://github.com/your-repo/settings/secrets/actions
# Add two secrets:
#   DOCKER_HUB_USERNAME = your_username
#   DOCKER_HUB_TOKEN = (from hub.docker.com/settings/security)

# Verify by pushing code:
git add .
git commit -m "Production setup"
git push origin main
# Check: Your repo → Actions tab should show build in progress

# ============================================================
# 4. DEPLOY TO PRODUCTION SERVER (10 minutes)
# ============================================================

# On production server:

# 1. Clone project
cd /opt
sudo git clone https://github.com/your-org/icu-blockchain-payment-system.git
cd icu-blockchain-payment-system

# 2. Copy production environment
cp .env.prod.example .env.prod
# Edit .env.prod with real secrets

# 3. Start services
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 4. Verify
docker compose -f docker-compose.prod.yml ps
# All services should show: healthy or Up

# 5. Test HTTPS
curl https://payment.icu.edu.zm
# Should return HTML (not certificate error)

# ============================================================
# 5. ENABLE AUTOMATIC DEPLOYMENTS (Optional - 5 minutes)
# ============================================================

# On production server, generate SSH key:
ssh-keygen -t rsa -b 4096 -f ~/.ssh/icu-deploy -N ""

# Copy public key to authorized_keys:
ssh-copy-id -i ~/.ssh/icu-deploy.pub your_user@payment.icu.edu.zm

# On local machine, add GitHub secrets:
# Go to: https://github.com/your-repo/settings/secrets/actions
# Add:
#   PRODUCTION_HOST = production.icu.edu.zm
#   PRODUCTION_USER = your_ssh_user
#   PRODUCTION_SSH_KEY = (contents of ~/.ssh/icu-deploy)
#   PRODUCTION_DOMAIN = payment.icu.edu.zm
#   PRODUCTION_APP_PATH = /opt/icu-blockchain-payment-system

# Now deployments are automatic:
git tag v1.0.1
git push origin v1.0.1
# GitHub Actions will automatically deploy!

# ============================================================
# MONITORING & MAINTENANCE
# ============================================================

# View logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f python-service

# Check service health
docker compose -f docker-compose.prod.yml ps

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend

# Full restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Database backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres icu_payments > backup-$(date +%Y%m%d).sql

# Database restore
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres icu_payments < backup-20240807.sql

# View resource usage
docker stats

# ============================================================
# TROUBLESHOOTING
# ============================================================

# Images not found
docker login  # Ensure logged in
docker push your_username/icu-backend:v1.0.0

# SSL certificate errors
openssl x509 -in certs/cert.pem -text -noout
docker compose -f docker-compose.prod.yml logs frontend

# Services not starting
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml ps

# Stuck container
docker compose -f docker-compose.prod.yml kill backend
docker compose -f docker-compose.prod.yml up -d backend

# Disk space
docker system df
docker system prune  # WARNING: removes unused images

# ============================================================
# INFORMATION SOURCES
# ============================================================

# Start with these files (in order):
# 1. 00-START-HERE.md               <- High-level overview
# 2. QUICKSTART_PRODUCTION.md       <- 5-step quick guide
# 3. PRODUCTION_SUMMARY.md          <- Detailed checklist
# 4. REGISTRY_SSL_CICD.md           <- Complete reference
# 5. DOCKER_BEST_PRACTICES.md       <- Image optimization

# Full documentation:
cat 00-START-HERE.md
cat QUICKSTART_PRODUCTION.md
cat PRODUCTION_SUMMARY.md
cat REGISTRY_SSL_CICD.md
cat DOCKER_BEST_PRACTICES.md
