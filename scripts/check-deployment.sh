#!/bin/bash
# Quick deployment status check

echo "========================================="
echo "Deployment Status Check"
echo "========================================="
echo ""

cd /opt/cryptoart

echo "1. Docker Compose Services:"
docker compose -f docker-compose.prod.yml ps
echo ""

echo "2. All Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "3. Studio App Health:"
curl -s http://localhost:3000/api/health || echo "Service not responding"
echo ""

echo "4. Recent Logs (studio-app):"
docker compose -f docker-compose.prod.yml logs --tail=20 studio-app 2>/dev/null || echo "No logs"
echo ""

echo "========================================="
echo "If services aren't running, try:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo "========================================="

