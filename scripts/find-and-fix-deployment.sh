#!/bin/bash
# Script to find Hostinger deployment and fix missing configuration

echo "========================================="
echo "Finding Hostinger Deployment Location"
echo "========================================="
echo ""

# Common Hostinger deployment locations
LOCATIONS=(
    "/opt/cryptoart"
    "/home/*/cryptoart*"
    "/var/www/*"
    "/root/*"
    "/opt/*/cryptoart*"
    "$(pwd)"
)

echo "Searching for docker-compose.prod.yml..."
FOUND=""

for location in "${LOCATIONS[@]}"; do
    if [ -f "$location/docker-compose.prod.yml" ]; then
        FOUND="$location"
        echo "✅ Found at: $location"
        break
    fi
done

# If not found in common locations, search more broadly
if [ -z "$FOUND" ]; then
    echo "Not found in common locations. Searching system..."
    FOUND=$(find / -name "docker-compose.prod.yml" -type f 2>/dev/null | head -1 | xargs dirname)
    if [ -n "$FOUND" ]; then
        echo "✅ Found at: $FOUND"
    else
        echo "❌ Could not find docker-compose.prod.yml"
        echo "Please check Hostinger dashboard for deployment path"
        exit 1
    fi
fi

cd "$FOUND"
echo ""
echo "Working directory: $(pwd)"
echo ""

echo "========================================="
echo "Checking Current Status"
echo "========================================="
echo ""

# Check running services
echo "1. Current Services:"
docker compose -f docker-compose.prod.yml ps 2>/dev/null || docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""

# Check for required files
echo "2. Checking Required Files:"
echo -n "   docker-compose.prod.yml: "
[ -f docker-compose.prod.yml ] && echo "✅" || echo "❌ MISSING"
echo -n "   .env.production: "
[ -f .env.production ] && echo "✅" || echo "❌ MISSING"
echo -n "   secrets/postgres_password.txt: "
[ -f secrets/postgres_password.txt ] && echo "✅" || echo "❌ MISSING"
echo -n "   secrets/redis_password.txt: "
[ -f secrets/redis_password.txt ] && echo "✅" || echo "❌ MISSING"
echo ""

# Check stopped containers
echo "3. Stopped/Failed Containers:"
docker ps -a --filter "status=exited" --format "{{.Names}} ({{.Status}})" | grep -E "studio-app|indexer" || echo "   None found"
echo ""

echo "========================================="
echo "Fixing Missing Configuration"
echo "========================================="
echo ""

# Create secrets if missing
if [ ! -f secrets/postgres_password.txt ] || [ ! -f secrets/redis_password.txt ]; then
    echo "Creating secrets directory..."
    mkdir -p secrets
    chmod 700 secrets
    
    if [ ! -f secrets/postgres_password.txt ]; then
        echo "Generating postgres password..."
        openssl rand -base64 32 > secrets/postgres_password.txt
        chmod 600 secrets/postgres_password.txt
        echo "✅ Created secrets/postgres_password.txt"
    fi
    
    if [ ! -f secrets/redis_password.txt ]; then
        echo "Generating redis password..."
        openssl rand -base64 32 > secrets/redis_password.txt
        chmod 600 secrets/redis_password.txt
        echo "✅ Created secrets/redis_password.txt"
    fi
else
    echo "✅ Secrets files already exist"
fi
echo ""

# Create .env.production if missing
if [ ! -f .env.production ]; then
    echo "Creating .env.production template..."
    cat > .env.production << 'ENVEOF'
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_DB=cryptoart

# Application URL (UPDATE THIS WITH YOUR DOMAIN)
NEXT_PUBLIC_URL=https://cryptoart.social

# Neynar API (Farcaster) - ADD YOUR KEYS HERE
NEYNAR_API_KEY=
NEYNAR_CLIENT_ID=

# Blockchain RPC - ADD YOUR KEY HERE  
RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
CHAIN_ID=8453
ALCHEMY_API_KEY=

# Indexer Configuration
START_BLOCK=
BATCH_SIZE=100
POLL_INTERVAL=12000
ERC721_IMPLEMENTATION_ADDRESSES=
ERC1155_IMPLEMENTATION_ADDRESSES=
ERC6551_IMPLEMENTATION_ADDRESSES=
ENVEOF
    chmod 600 .env.production
    echo "✅ Created .env.production (NEEDS TO BE EDITED WITH YOUR API KEYS)"
else
    echo "✅ .env.production already exists"
fi
echo ""

echo "========================================="
echo "Next Steps"
echo "========================================="
echo ""
echo "1. Edit .env.production with your API keys:"
echo "   nano .env.production"
echo ""
echo "2. After adding your API keys, start the services:"
echo "   docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "3. Check status:"
echo "   docker compose -f docker-compose.prod.yml ps"
echo ""
echo "4. View logs:"
echo "   docker compose -f docker-compose.prod.yml logs -f studio-app"
echo ""

