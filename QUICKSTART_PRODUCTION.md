# Quick Start: Registry, SSL, and CI/CD Setup

## 🚀 TL;DR - Fast Track

```bash
# 1. Push images to Docker Hub
./scripts/push-to-registry.sh docker.io username v1.0.0

# 2. Set up production environment
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh payment.icu.edu.zm username

# 3. Commit and tag (triggers CI/CD)
git add .
git commit -m "Deploy v1.0.0"
git tag v1.0.0
git push origin main --tags

# 4. Deploy to production
docker compose -f docker-compose.prod.yml up -d
```

---

## 📦 1. PUSH IMAGES TO REGISTRY

### Docker Hub (Fastest)

**Setup (one-time):**
```bash
# 1. Create free Docker Hub account at hub.docker.com
# 2. Create Personal Access Token (Settings → Security)
# 3. Log in locally
docker login
# Enter username and paste token when prompted
```

**Push images:**
```bash
# Option A: Use the push script
chmod +x scripts/push-to-registry.sh
./scripts/push-to-registry.sh docker.io username v1.0.0

# Option B: Manual push
docker tag icu-backend:latest username/icu-backend:v1.0.0
docker tag icu-frontend:latest username/icu-frontend:v1.0.0
docker tag icu-python-service:latest username/icu-python-service:v1.0.0

docker push username/icu-backend:v1.0.0
docker push username/icu-frontend:v1.0.0
docker push username/icu-python-service:v1.0.0
```

**Verify:**
```bash
# Images now available at:
# https://hub.docker.com/r/username/icu-backend
# https://hub.docker.com/r/username/icu-frontend
# https://hub.docker.com/r/username/icu-python-service
```

---

## 🔒 2. SSL/TLS FOR PRODUCTION

### Quick SSL Setup

**Option A: Self-Signed (Testing)**
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/privkey.pem -out certs/cert.pem -days 365 -nodes \
  -subj "/C=ZM/ST=Lusaka/L=Lusaka/O=ICU/CN=payment.icu.edu.zm"
```

**Option B: Let's Encrypt (Production)**
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate (auto-renewal enabled)
sudo certbot certonly --nginx -d payment.icu.edu.zm -d api.payment.icu.edu.zm

# Copy to project
mkdir -p certs
sudo cp /etc/letsencrypt/live/payment.icu.edu.zm/cert.pem certs/
sudo cp /etc/letsencrypt/live/payment.icu.edu.zm/privkey.pem certs/
sudo chown $USER:$USER certs/*.pem
```

### Deploy with SSL

```bash
# 1. Create production .env
cp .env.example .env.prod
# Edit .env.prod - add real secrets and domain

# 2. Update nginx config
sed -i 's|yourdomain.com|payment.icu.edu.zm|g' frontend/nginx-prod.conf

# 3. Start with SSL
docker compose -f docker-compose.prod.yml up -d

# 4. Verify SSL
curl -I https://payment.icu.edu.zm
```

---

## 🔄 3. CI/CD PIPELINE SETUP

### GitHub Actions (Automated Builds)

**Prerequisites:**
- GitHub repository with this code
- Docker Hub account (from step 1)

**Setup (one-time):**

1. **Generate Docker Hub token:**
   - Go to https://hub.docker.com/settings/security
   - Click "New Access Token"
   - Name it "GitHub Actions"
   - Copy the token

2. **Add GitHub Secrets:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Create new secrets:
     ```
     DOCKER_HUB_USERNAME = your_username
     DOCKER_HUB_TOKEN = (paste token from step 1)
     ```

3. **Workflows are auto-enabled:**
   - `.github/workflows/build-and-push.yml` - Builds on every PR and push to main
   - `.github/workflows/build-multiplatform.yml` - Builds for ARM64+AMD64 on main/tags
   - `.github/workflows/deploy.yml` - Deploys when you create a git tag

**Trigger builds:**
```bash
# PR/branch builds (no push to registry)
git push origin feature-branch

# Main branch builds (pushes latest)
git push origin main

# Production release (triggers deployment)
git tag v1.0.0
git push origin v1.0.0
```

**Monitor builds:**
- Go to your repo → Actions tab
- Watch real-time build progress
- View logs if build fails

---

## 🚀 COMPLETE PRODUCTION DEPLOYMENT

### Step 1: Register Domain & Configure DNS
```bash
# Point these DNS records to your server IP:
# A  payment.icu.edu.zm  → 1.2.3.4
# A  api.payment.icu.edu.zm  → 1.2.3.4
```

### Step 2: Server Prerequisites
```bash
# On your VPS/server, install:
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Step 3: Clone and Setup
```bash
cd /opt
sudo git clone https://github.com/yourname/icu-blockchain-payment-system.git
cd icu-blockchain-payment-system

# Run setup script
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh payment.icu.edu.zm yourname
```

### Step 4: Deploy
```bash
# Load production environment
export $(cat .env.prod | xargs)

# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Start services
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose -f docker-compose.prod.yml ps
curl https://payment.icu.edu.zm
```

### Step 5: Set Up SSH Key for Automatic Deployments (Optional)
```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -f ~/.ssh/icu-deploy -N ""

# Copy public key to server
ssh-copy-id -i ~/.ssh/icu-deploy.pub user@payment.icu.edu.zm

# Add GitHub secret
# Settings → Secrets → Actions → New secret
# Name: PRODUCTION_SSH_KEY
# Value: (paste contents of ~/.ssh/icu-deploy)
```

---

## 📊 MONITORING & MAINTENANCE

### View Logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f python-service
```

### Database Backups
```bash
# Manual backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres icu_payments > backup.sql

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres icu_payments < backup.sql
```

### Scaling
```bash
# Update docker-compose.prod.yml resource limits:
# services:
#   backend:
#     deploy:
#       resources:
#         limits:
#           cpus: '2.0'        # Increase from 1.5
#           memory: 1G         # Increase from 768M

docker compose -f docker-compose.prod.yml up -d
```

### SSL Certificate Renewal (Let's Encrypt)
```bash
# Automatic renewal (cron job)
sudo certbot renew --quiet
# Runs twice daily automatically

# Manual renewal if needed
sudo certbot renew
```

---

## 🆘 TROUBLESHOOTING

### Images not found in registry
```bash
# Verify images exist
docker images | grep icu-

# Make sure you logged in
docker login

# Try pushing manually
docker push username/icu-backend:latest
```

### SSL certificate errors
```bash
# Check certificate validity
openssl x509 -in certs/cert.pem -text -noout

# Check nginx logs
docker compose -f docker-compose.prod.yml logs frontend
```

### Deploy fails
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend

# Full restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### GitHub Actions not triggering
```bash
# Verify workflow files exist
ls -la .github/workflows/

# Check secrets are set
# Settings → Secrets → verify DOCKER_HUB_USERNAME and DOCKER_HUB_TOKEN

# Force rebuild by creating new tag
git tag v1.0.1
git push origin v1.0.1
```

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Docker images built locally
- [ ] Docker Hub account created
- [ ] Images pushed to Docker Hub
- [ ] GitHub Actions secrets configured
- [ ] Domain registered and DNS configured
- [ ] Server VPS provisioned
- [ ] Docker & Docker Compose installed on server
- [ ] SSL certificates obtained
- [ ] Production .env file created with secrets
- [ ] nginx config updated with domain
- [ ] First deployment successful
- [ ] SSL certificate verified (https://yourdomain.com)
- [ ] Database backups configured
- [ ] Monitoring/alerting set up
- [ ] Team documented on deployment process

---

## 📖 FULL GUIDES

For detailed information, see:
- `REGISTRY_SSL_CICD.md` - Complete reference guide
- `DOCKER_BEST_PRACTICES.md` - Image optimization details
- `.github/workflows/` - CI/CD pipeline definitions
