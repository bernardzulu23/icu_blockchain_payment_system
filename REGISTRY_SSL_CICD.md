# Docker Registry & Deployment Guide

## 1️⃣ PUSHING IMAGES TO A REGISTRY

### Option A: Docker Hub (Easiest)

**Prerequisites:**
- Docker Hub account (free at hub.docker.com)
- Docker installed locally

**Steps:**

1. **Log in to Docker Hub**
   ```bash
   docker login
   # Enter username and password when prompted
   ```

2. **Tag your images**
   ```bash
   docker tag icu-backend:latest username/icu-backend:v1.0.0
   docker tag icu-frontend:latest username/icu-frontend:v1.0.0
   docker tag icu-python-service:latest username/icu-python-service:v1.0.0
   ```

3. **Push to Docker Hub**
   ```bash
   docker push username/icu-backend:v1.0.0
   docker push username/icu-frontend:v1.0.0
   docker push username/icu-python-service:v1.0.0
   ```

4. **Also tag as 'latest'**
   ```bash
   docker tag icu-backend:latest username/icu-backend:latest
   docker push username/icu-backend:latest
   # ... repeat for other images
   ```

**Or use the automated script:**
```bash
chmod +x scripts/push-to-registry.sh
./scripts/push-to-registry.sh docker.io username v1.0.0
```

---

### Option B: GitHub Container Registry (GHCR)

**Prerequisites:**
- GitHub repository
- GitHub Personal Access Token with `write:packages` scope

**Steps:**

```bash
# Log in with GitHub token
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag images
docker tag icu-backend:latest ghcr.io/username/icu-blockchain/icu-backend:v1.0.0

# Push
docker push ghcr.io/username/icu-blockchain/icu-backend:v1.0.0
```

---

### Option C: Private Registry (AWS ECR, Azure ACR, etc.)

**AWS ECR Example:**
```bash
# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag icu-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/icu-backend:v1.0.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/icu-backend:v1.0.0
```

---

## 2️⃣ SSL/TLS FOR PRODUCTION

### A. Generate SSL Certificates

**Option 1: Using Let's Encrypt (Free)**

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx  # Ubuntu/Debian
# or
brew install certbot  # macOS

# Generate certificate (automatic renewal configured)
sudo certbot certonly --nginx -d yourdomain.com -d api.yourdomain.com

# Certificates saved to:
# /etc/letsencrypt/live/yourdomain.com/cert.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

**Option 2: Self-Signed (Development)**

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes \
  -subj "/C=ZM/ST=Lusaka/L=Lusaka/O=ICU/CN=api.yourdomain.com"
```

---

### B. Update Nginx Configuration

Create `frontend/nginx-prod.conf`:

```nginx
# Main server block - redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    
    # Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS frontend
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL certificates
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Serve React app
    root /usr/share/nginx/html;
    index index.html index.htm;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTPS API backend
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    # SSL certificates
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    
    # SSL configuration (same as above)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}
```

---

### C. Update Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  # ... (keep postgres, redis, backend, python-service from original)
  
  # Updated frontend with SSL
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: https://api.yourdomain.com
    image: icu-frontend:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      # Mount SSL certificates
      - ./certs:/etc/nginx/certs:ro
      - ./frontend/nginx-prod.conf:/etc/nginx/conf.d/default.conf:ro
      # For Let's Encrypt validation
      - ./certbot-data:/var/www/certbot:ro
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - icu-payment-network
    healthcheck:
      test: ["CMD", "curl", "-f", "https://localhost/"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  postgres-data:
  redis-data:

networks:
  icu-payment-network:
    driver: bridge
```

---

### D. Deploy with SSL

```bash
# 1. Copy certificates into project
mkdir -p certs
sudo cp /etc/letsencrypt/live/yourdomain.com/cert.pem certs/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/
sudo chown $USER:$USER certs/*.pem

# 2. Update environment variables
cp .env.example .env
# Edit .env:
# FRONTEND_URL=https://yourdomain.com
# VITE_API_URL=https://api.yourdomain.com

# 3. Start production stack
docker compose -f docker-compose.prod.yml up -d

# 4. Verify SSL
curl -I https://yourdomain.com
curl -I https://api.yourdomain.com
```

---

## 3️⃣ CI/CD PIPELINE FOR AUTOMATED BUILDS

### Option A: GitHub Actions (Recommended)

Create `.github/workflows/build-and-push.yml`:

```yaml
name: Build and Push Docker Images

on:
  push:
    branches:
      - main
      - develop
    tags:
      - 'v*'
  pull_request:
    branches:
      - main

env:
  REGISTRY: docker.io
  # Change to your Docker Hub username
  IMAGE_NAMESPACE: myusername

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.DOCKER_HUB_USERNAME }}
          password: ${{ secrets.DOCKER_HUB_TOKEN }}

      - name: Extract metadata
        id: meta
        run: |
          if [[ "${{ github.ref }}" == refs/tags/* ]]; then
            VERSION=${GITHUB_REF#refs/tags/}
          elif [[ "${{ github.ref }}" == refs/heads/main ]]; then
            VERSION=latest
          else
            VERSION=develop
          fi
          echo "VERSION=$VERSION" >> $GITHUB_OUTPUT
          echo "BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> $GITHUB_OUTPUT
          echo "VCS_REF=${GITHUB_SHA::8}" >> $GITHUB_OUTPUT

      # Build and push backend
      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-backend:${{ steps.meta.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-backend:latest
          labels: |
            org.opencontainers.image.created=${{ steps.meta.outputs.BUILD_DATE }}
            org.opencontainers.image.revision=${{ steps.meta.outputs.VCS_REF }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Build and push frontend
      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/Dockerfile.prod
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-frontend:${{ steps.meta.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-frontend:latest
          build-args: |
            VITE_API_URL=https://api.yourdomain.com
          labels: |
            org.opencontainers.image.created=${{ steps.meta.outputs.BUILD_DATE }}
            org.opencontainers.image.revision=${{ steps.meta.outputs.VCS_REF }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Build and push Python service
      - name: Build and push Python service
        uses: docker/build-push-action@v5
        with:
          context: ./backend/python-services
          file: ./backend/python-services/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-python-service:${{ steps.meta.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-python-service:latest
          labels: |
            org.opencontainers.image.created=${{ steps.meta.outputs.BUILD_DATE }}
            org.opencontainers.image.revision=${{ steps.meta.outputs.VCS_REF }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Create deployment summary
        if: github.event_name != 'pull_request'
        run: |
          echo "### ✅ Docker Build Successful" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Version:** ${{ steps.meta.outputs.VERSION }}" >> $GITHUB_STEP_SUMMARY
          echo "**Commit:** ${{ steps.meta.outputs.VCS_REF }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Images pushed:**" >> $GITHUB_STEP_SUMMARY
          echo "- \`${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-backend:${{ steps.meta.outputs.VERSION }}\`" >> $GITHUB_STEP_SUMMARY
          echo "- \`${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-frontend:${{ steps.meta.outputs.VERSION }}\`" >> $GITHUB_STEP_SUMMARY
          echo "- \`${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-python-service:${{ steps.meta.outputs.VERSION }}\`" >> $GITHUB_STEP_SUMMARY
```

**Setup GitHub Secrets:**
1. Go to repository → Settings → Secrets and variables → Actions
2. Add:
   - `DOCKER_HUB_USERNAME` = your Docker Hub username
   - `DOCKER_HUB_TOKEN` = Docker Hub Personal Access Token (generated at hub.docker.com/settings/security)

---

### Option B: Multi-Platform Builds with Docker Build Cloud

Create `.github/workflows/build-multiplatform.yml`:

```yaml
name: Multi-Platform Build (Docker Build Cloud)

on:
  push:
    branches:
      - main
    tags:
      - 'v*'

env:
  REGISTRY: docker.io
  IMAGE_NAMESPACE: myusername

jobs:
  build-multiplatform:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        with:
          driver-options: |
            image=moby/buildkit:master
            network=host

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.DOCKER_HUB_USERNAME }}
          password: ${{ secrets.DOCKER_HUB_TOKEN }}

      - name: Extract version
        id: version
        run: |
          if [[ "${{ github.ref }}" == refs/tags/* ]]; then
            echo "VERSION=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
          else
            echo "VERSION=latest" >> $GITHUB_OUTPUT
          fi

      - name: Build and push (multi-platform)
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-backend:${{ steps.version.outputs.VERSION }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAMESPACE }}/icu-backend:latest
```

---

### Option C: GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - push

variables:
  REGISTRY: docker.io
  NAMESPACE: myusername

build_backend:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  script:
    - echo "$DOCKER_HUB_TOKEN" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin
    - docker build -t $REGISTRY/$NAMESPACE/icu-backend:${CI_COMMIT_SHORT_SHA} ./backend
    - docker tag $REGISTRY/$NAMESPACE/icu-backend:${CI_COMMIT_SHORT_SHA} $REGISTRY/$NAMESPACE/icu-backend:latest
    - docker push $REGISTRY/$NAMESPACE/icu-backend:${CI_COMMIT_SHORT_SHA}
    - docker push $REGISTRY/$NAMESPACE/icu-backend:latest
  only:
    - main
```

---

## 🚀 DEPLOYMENT WORKFLOW

### Manual Deployment to Production

```bash
# 1. Push images to registry
./scripts/push-to-registry.sh docker.io username v1.0.0

# 2. On production server, pull and run
ssh user@production-server

# Update compose file
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose ps
```

### Automated Deployment with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /opt/icu-blockchain-payment-system
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml down
            docker compose -f docker-compose.prod.yml up -d
            docker compose logs -f --tail=20
```

**Add GitHub Secrets:**
- `PRODUCTION_HOST` = your server IP/domain
- `PRODUCTION_USER` = SSH username
- `PRODUCTION_SSH_KEY` = Private SSH key (generated with `ssh-keygen`)

---

## 📋 CHECKLIST

- [ ] Create Docker Hub account
- [ ] Generate Docker Hub Personal Access Token
- [ ] Push images to registry (manually or via script)
- [ ] Set up SSL certificates (Let's Encrypt or self-signed)
- [ ] Update nginx configuration with SSL
- [ ] Create docker-compose.prod.yml
- [ ] Set up GitHub Actions workflow
- [ ] Add Docker Hub credentials to GitHub Secrets
- [ ] Test PR builds (no push)
- [ ] Test main branch builds (with push)
- [ ] Tag first release (v1.0.0) to trigger workflow
- [ ] Set up production deployment (manual or automated)
- [ ] Test full deployment pipeline

---

## 🔗 RESOURCES

- Docker Hub: https://hub.docker.com
- Let's Encrypt: https://letsencrypt.org
- GitHub Actions: https://docs.github.com/en/actions
- Docker Build Cloud: https://docs.docker.com/build-cloud/
