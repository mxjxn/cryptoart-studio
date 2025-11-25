#!/bin/bash
# Run these commands on your server one by one

echo "=== 1. Check current directory and files ==="
pwd
ls -la docker-compose.prod.yml 2>/dev/null || echo "docker-compose.prod.yml not found in current directory"
echo ""

echo "=== 2. Check all running containers ==="
docker compose -f docker-compose.prod.yml ps 2>/dev/null || docker ps
echo ""

echo "=== 3. Check for required files ==="
echo "Checking for .env.production..."
ls -la .env.production 2>/dev/null || echo "❌ .env.production missing"
echo ""
echo "Checking for secrets..."
ls -la secrets/ 2>/dev/null || echo "❌ secrets/ directory missing"
echo ""

echo "=== 4. Check logs for studio-app ==="
docker compose -f docker-compose.prod.yml logs --tail=100 studio-app 2>/dev/null || echo "studio-app container not found or failed"
echo ""

echo "=== 5. Check logs for indexer ==="
docker compose -f docker-compose.prod.yml logs --tail=100 indexer 2>/dev/null || echo "indexer container not found or failed"
echo ""

echo "=== 6. Check all stopped/exited containers ==="
docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
echo ""

echo "=== 7. Try to see why services aren't running ==="
docker compose -f docker-compose.prod.yml config 2>&1 | head -20
echo ""

