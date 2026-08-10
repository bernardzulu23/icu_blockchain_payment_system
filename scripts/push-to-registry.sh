#!/bin/bash
# push-to-registry.sh - Push Docker images to a registry (Docker Hub or custom)
# Usage: ./push-to-registry.sh [registry_url] [namespace] [version]
# Examples:
#   ./push-to-registry.sh docker.io myusername v1.0.0
#   ./push-to-registry.sh ghcr.io myorg v1.0.0
#   ./push-to-registry.sh registry.mycompany.com/icu v1.0.0

set -e

# Configuration
REGISTRY_URL="${1:-docker.io}"
NAMESPACE="${2:-myusername}"
VERSION="${3:-latest}"

# Image names (local)
BACKEND_IMAGE="icu-backend:latest"
FRONTEND_IMAGE="icu-frontend:latest"
PYTHON_IMAGE="icu-python-service:latest"

# Remote image names
BACKEND_REMOTE="${REGISTRY_URL}/${NAMESPACE}/icu-backend:${VERSION}"
FRONTEND_REMOTE="${REGISTRY_URL}/${NAMESPACE}/icu-frontend:${VERSION}"
PYTHON_REMOTE="${REGISTRY_URL}/${NAMESPACE}/icu-python-service:${VERSION}"

echo "=========================================="
echo "Docker Image Registry Push"
echo "=========================================="
echo "Registry: $REGISTRY_URL"
echo "Namespace: $NAMESPACE"
echo "Version: $VERSION"
echo ""

# Step 1: Login to registry
echo "📦 Step 1: Login to registry..."
docker login "$REGISTRY_URL"

# Step 2: Tag images
echo ""
echo "🏷️  Step 2: Tagging images..."
docker tag "$BACKEND_IMAGE" "$BACKEND_REMOTE"
docker tag "$FRONTEND_IMAGE" "$FRONTEND_REMOTE"
docker tag "$PYTHON_IMAGE" "$PYTHON_REMOTE"

# Also tag with 'latest' for convenience
docker tag "$BACKEND_IMAGE" "${REGISTRY_URL}/${NAMESPACE}/icu-backend:latest"
docker tag "$FRONTEND_IMAGE" "${REGISTRY_URL}/${NAMESPACE}/icu-frontend:latest"
docker tag "$PYTHON_IMAGE" "${REGISTRY_URL}/${NAMESPACE}/icu-python-service:latest"

# Step 3: Push images
echo ""
echo "⬆️  Step 3: Pushing images to registry..."
echo ""

echo "Pushing backend image..."
docker push "$BACKEND_REMOTE"
docker push "${REGISTRY_URL}/${NAMESPACE}/icu-backend:latest"

echo ""
echo "Pushing frontend image..."
docker push "$FRONTEND_REMOTE"
docker push "${REGISTRY_URL}/${NAMESPACE}/icu-frontend:latest"

echo ""
echo "Pushing Python service image..."
docker push "$PYTHON_REMOTE"
docker push "${REGISTRY_URL}/${NAMESPACE}/icu-python-service:latest"

# Step 4: Summary
echo ""
echo "=========================================="
echo "✅ Push Complete!"
echo "=========================================="
echo ""
echo "Images available at:"
echo "  • $BACKEND_REMOTE"
echo "  • ${REGISTRY_URL}/${NAMESPACE}/icu-backend:latest"
echo ""
echo "  • $FRONTEND_REMOTE"
echo "  • ${REGISTRY_URL}/${NAMESPACE}/icu-frontend:latest"
echo ""
echo "  • $PYTHON_REMOTE"
echo "  • ${REGISTRY_URL}/${NAMESPACE}/icu-python-service:latest"
echo ""
echo "To pull and run:"
echo "  docker pull ${REGISTRY_URL}/${NAMESPACE}/icu-backend:${VERSION}"
echo ""
