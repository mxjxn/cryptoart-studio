#!/bin/bash

# Deployment Status Checker
# Run this on your server to diagnose deployment issues

echo "========================================="
echo "CryptoArt Deployment Status Check"
echo "========================================="
echo ""

# Check current directory
echo "1. Current Directory:"
pwd
echo ""

# Check if we're in the deployment directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "⚠️  WARNING: docker-compose.prod.yml not found!"
    echo "   Looking for it in common locations..."
    if [ -f "/opt/cryptoart/docker-compose.prod.yml" ]; then
        echo "   Found at: /opt/cryptoart/docker-compose.prod.yml"
        cd /opt/cryptoart
    else
        echo "   Please navigate to your deployment directory first"
        exit 1
    fi
fi

echo "2. Docker Compose Services Status:"
docker compose -f docker-compose.prod.yml ps
echo ""

echo "3. All Docker Containers:"
docker ps -a
echo ""

echo "4. Checking for Required Files:"
echo "   - docker-compose.prod.yml: $([ -f docker-compose.prod.yml ] && echo '✅ Found' || echo '❌ Missing')"
echo "   - .env.production: $([ -f .env.production ] && echo '✅ Found' || echo '❌ Missing')"
echo "   - secrets/postgres_password.txt: $([ -f secrets/postgres_password.txt ] && echo '✅ Found' || echo '❌ Missing')"
echo "   - secrets/redis_password.txt: $([ -f secrets/redis_password.txt ] && echo '✅ Found' || echo '❌ Missing')"
echo ""

if [ -f "secrets/postgres_password.txt" ]; then
    echo "   Postgres password file size: $(stat -c%s secrets/postgres_password.txt 2>/dev/null || stat -f%z secrets/postgres_password.txt 2>/dev/null) bytes"
fi
if [ -f "secrets/redis_password.txt" ]; then
    echo "   Redis password file size: $(stat -c%s secrets/redis_password.txt 2>/dev/null || stat -f%z secrets/redis_password.txt 2>/dev/null) bytes"
fi
echo ""

echo "5. Recent Docker Logs (studio-app):"
docker compose -f docker-compose.prod.yml logs --tail=50 studio-app 2>/dev/null || echo "   No logs found (service may not exist or have failed)"
echo ""

echo "6. Recent Docker Logs (indexer):"
docker compose -f docker-compose.prod.yml logs --tail=50 indexer 2>/dev/null || echo "   No logs found (service may not exist or have failed)"
echo ""

echo "7. Checking Failed Containers:"
FAILED=$(docker ps -a --filter "status=exited" --format "{{.Names}}")
if [ -z "$FAILED" ]; then
    echo "   ✅ No failed containers"
else
    echo "   ⚠️  Failed containers found:"
    echo "$FAILED" | while read container; do
        echo "   - $container:"
        docker logs --tail=20 "$container" 2>&1 | sed 's/^/      /'
        echo ""
    done
fi
echo ""

echo "8. Docker Images:"
docker images | grep -E "cryptoart|studio-app|indexer|REPOSITORY" || echo "   No cryptoart images found"
echo ""

echo "9. Network Check:"
docker network ls | grep cryptoart || echo "   cryptoart-network not found"
echo ""

echo "10. Port Check (3000 should be listening if app is running):"
netstat -tuln | grep :3000 || ss -tuln | grep :3000 || echo "   Port 3000 not listening"
echo ""

echo "========================================="
echo "Diagnosis Complete"
echo "========================================="

