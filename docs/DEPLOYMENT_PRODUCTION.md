# Production Deployment Guide - Hostinger KVM2

This guide walks you through deploying cryptoart.social (cryptoart-studio-app) and all related backends to your Hostinger KVM2 server using Docker Compose with GitHub Actions CI/CD.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Environment Variables Management](#environment-variables-management)
4. [Initial Deployment](#initial-deployment)
5. [GitHub Actions Setup](#github-actions-setup)
6. [SSL/HTTPS Setup](#sslhttps-setup)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### On Your Local Machine
- Git installed
- SSH access to your Hostinger server
- GitHub account with repository access

### On Hostinger Server
- Docker and Docker Compose installed
- Git installed
- Domain name pointing to your server IP
- Ports 80, 443, and optionally 22 open

## Server Setup

### 1. Connect to Your Hostinger Server

```bash
ssh root@your-server-ip
# or
ssh your-username@your-server-ip
```

### 2. Install Docker and Docker Compose

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 3. Create Deployment Directory

```bash
# Create directory for deployment
mkdir -p /opt/cryptoart
cd /opt/cryptoart

# Clone your repository
git clone https://github.com/your-username/cryptoart-monorepo.git .
# Or if you prefer SSH:
# git clone git@github.com:your-username/cryptoart-monorepo.git .
```

### 4. Create Secrets Directory

```bash
# Create secrets directory (will be excluded from git)
mkdir -p /opt/cryptoart/secrets
chmod 700 /opt/cryptoart/secrets
```

## Environment Variables Management

### Security Best Practices

**CRITICAL**: Never commit sensitive environment variables to Git. We use Docker secrets for sensitive data.

### Step 1: Create Secret Files on Server

On your Hostinger server, create the secret files:

```bash
cd /opt/cryptoart/secrets

# Create PostgreSQL password file
echo "your-strong-postgres-password-here" > postgres_password.txt
chmod 600 postgres_password.txt

# Create Redis password file
echo "your-strong-redis-password-here" > redis_password.txt
chmod 600 redis_password.txt
```

### Step 2: Create Environment File

Create a `.env.production` file on the server (this will NOT be committed to git):

```bash
cd /opt/cryptoart
nano .env.production
```

Add the following variables (replace with your actual values):

```bash
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_DB=cryptoart

# Application URL
NEXT_PUBLIC_URL=https://cryptoart.social

# Neynar API (Farcaster)
NEYNAR_API_KEY=your_neynar_api_key_here
NEYNAR_CLIENT_ID=your_neynar_client_id_here

# Blockchain RPC
RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
CHAIN_ID=8453

# Optional: Alchemy for NFT metadata
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Optional: Redis (if using Upstash instead of local Redis)
# KV_REST_API_URL=https://your-upstash-url.upstash.io
# KV_REST_API_TOKEN=your-upstash-token

# Optional: Other features
CRYPTOART_HYPERSUB_CONTRACT=0x...
CRON_SECRET=your-random-secret-string-here
AIRDROP_WALLET_PRIVATE_KEY=your-private-key-here

# Indexer Configuration (Optional)
START_BLOCK=
BATCH_SIZE=100
POLL_INTERVAL=12000
ERC721_IMPLEMENTATION_ADDRESSES=
ERC1155_IMPLEMENTATION_ADDRESSES=
ERC6551_IMPLEMENTATION_ADDRESSES=
```

**Important**: 
- The `.env.production` file should be in `.gitignore` (already configured)
- Never share or commit this file
- Use strong, unique passwords for postgres and redis

### Step 3: Secure the Environment File

```bash
chmod 600 .env.production
```

## Initial Deployment

### 1. Update docker-compose.prod.yml for Image Registry

Edit `docker-compose.prod.yml` to use your GitHub Container Registry images, or build locally:

**Option A: Use GitHub Container Registry (Recommended for CI/CD)**

Update the `studio-app` and `indexer` services in `docker-compose.prod.yml`:

```yaml
studio-app:
  image: ghcr.io/your-username/cryptoart-monorepo-studio-app:latest
  # ... rest of config

indexer:
  image: ghcr.io/your-username/cryptoart-monorepo-indexer:latest
  # ... rest of config
```

**Option B: Build Locally (For initial setup)**

Keep the `build:` sections in docker-compose.prod.yml for local builds.

### 2. Load Environment Variables

```bash
cd /opt/cryptoart
export $(cat .env.production | xargs)
```

### 3. Run Database Migrations

```bash
# Start only postgres first
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for postgres to be ready
sleep 10

# Run migrations (you may need to install pnpm first or run in a container)
# Option 1: If you have Node.js/pnpm installed on server
cd /opt/cryptoart
pnpm install
pnpm --filter cryptoart-studio-app db:push

# Option 2: Run migrations in a temporary container
docker run --rm \
  --network cryptoart-monorepo_cryptoart-network \
  -v $(pwd):/app \
  -w /app \
  node:20-alpine sh -c "npm install -g pnpm@9.1.4 && pnpm install && pnpm --filter cryptoart-studio-app db:push"
```

### 4. Start All Services

```bash
cd /opt/cryptoart
docker compose -f docker-compose.prod.yml up -d
```

### 5. Check Service Status

```bash
# Check all services
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Check specific service
docker compose -f docker-compose.prod.yml logs -f studio-app
docker compose -f docker-compose.prod.yml logs -f indexer
```

### 6. Verify Deployment

```bash
# Check if services are responding
curl http://localhost:3000/api/health

# Check from outside (if firewall allows)
curl http://your-server-ip:3000/api/health
```

## GitHub Actions Setup

### 1. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

1. **HOSTINGER_HOST**: Your server IP or domain
2. **HOSTINGER_USER**: SSH username (usually `root` or your username)
3. **HOSTINGER_SSH_KEY**: Your private SSH key (the entire key, including `-----BEGIN` and `-----END` lines)
4. **HOSTINGER_PORT**: SSH port (usually `22`)
5. **DEPLOY_PATH**: Path on server where code is deployed (e.g., `/opt/cryptoart`)
6. **NEXT_PUBLIC_URL**: Your production URL (e.g., `https://cryptoart.social`)

### 2. Generate SSH Key (if needed)

If you don't have an SSH key set up:

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Copy public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub your-username@your-server-ip

# Copy private key content to GitHub secret HOSTINGER_SSH_KEY
cat ~/.ssh/id_ed25519
```

### 3. Enable GitHub Actions

The workflow file is already created at `.github/workflows/deploy.yml`. It will:
- Build Docker images on push to `main`
- Push images to GitHub Container Registry
- SSH into your server and pull/restart services
- Run health checks

### 4. Test the Workflow

```bash
# Make a small change and push to main
git add .
git commit -m "Test deployment"
git push origin main
```

Check the Actions tab in GitHub to see the deployment progress.

## Nginx Reverse Proxy Setup

For production, we recommend using **host-level nginx** (not the Docker nginx container) for better multi-domain routing and SSL management.

**See [NGINX_REVERSE_PROXY_GUIDE.md](./NGINX_REVERSE_PROXY_GUIDE.md) for complete setup instructions.**

This guide covers:
- Installing nginx on Hostinger
- Routing multiple domains
- Internal service communication
- SSL/TLS setup for multiple domains
- Security best practices

### Quick Setup

```bash
# Install nginx
apt install nginx certbot python3-certbot-nginx -y

# Create site configuration
nano /etc/nginx/sites-available/cryptoart.social
# (See NGINX_REVERSE_PROXY_GUIDE.md for config)

# Enable site
ln -s /etc/nginx/sites-available/cryptoart.social /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

**Important**: After setting up host-level nginx, you can remove or disable the nginx service in `docker-compose.prod.yml` and expose services only on localhost.

## SSL/HTTPS Setup

### Option 1: Using Let's Encrypt with Certbot (Recommended)

```bash
# Install certbot
apt install certbot -y

# Stop nginx temporarily
docker compose -f docker-compose.prod.yml stop nginx

# Get certificate
certbot certonly --standalone -d cryptoart.social -d www.cryptoart.social

# Copy certificates to nginx directory
mkdir -p /opt/cryptoart/nginx/ssl
cp /etc/letsencrypt/live/cryptoart.social/fullchain.pem /opt/cryptoart/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/cryptoart.social/privkey.pem /opt/cryptoart/nginx/ssl/key.pem
chmod 600 /opt/cryptoart/nginx/ssl/*.pem

# Restart nginx
docker compose -f docker-compose.prod.yml up -d nginx

# Set up auto-renewal
echo "0 0 * * * certbot renew --quiet && docker compose -f /opt/cryptoart/docker-compose.prod.yml restart nginx" | crontab -
```

### Option 2: Using Your Own SSL Certificates

Place your certificates in `/opt/cryptoart/nginx/ssl/`:
- `cert.pem` - Your SSL certificate
- `key.pem` - Your private key

### Option 3: Disable Nginx (Use App Directly)

If you're using a load balancer or don't need nginx:

```bash
# Comment out nginx service in docker-compose.prod.yml
# Or remove it entirely
```

Update your firewall to expose port 3000 directly.

## Monitoring & Maintenance

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f studio-app
docker compose -f docker-compose.prod.yml logs -f indexer
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart studio-app
```

### Update Services

When you push to `main`, GitHub Actions will automatically:
1. Build new images
2. Deploy to server
3. Restart services

To manually update:

```bash
cd /opt/cryptoart
git pull origin main
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Database Backups

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres cryptoart > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres cryptoart < backup_file.sql
```

### Health Checks

Create a health check endpoint in your Next.js app:

```typescript
// apps/cryptoart-studio-app/src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check if ports are in use
netstat -tulpn | grep -E '3000|5432|6379'

# Check Docker resources
docker system df
docker system prune -a  # Clean up (be careful!)
```

### Database Connection Issues

```bash
# Test postgres connection
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d cryptoart -c "SELECT 1;"

# Check postgres logs
docker compose -f docker-compose.prod.yml logs postgres
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes

# Clean old images
docker image prune -a
```

### GitHub Actions Fails

1. Check SSH key permissions in GitHub secrets
2. Verify server is accessible
3. Check deployment path is correct
4. Review GitHub Actions logs for specific errors

### Environment Variables Not Working

```bash
# Verify secrets files exist
ls -la /opt/cryptoart/secrets/

# Check environment variables are loaded
docker compose -f docker-compose.prod.yml config
```

## Security Checklist

- [ ] Strong passwords for postgres and redis
- [ ] `.env.production` file has 600 permissions
- [ ] Secrets directory has 700 permissions
- [ ] SSH keys are secure and not committed
- [ ] Firewall configured (only necessary ports open)
- [ ] SSL certificates installed and auto-renewing
- [ ] Regular backups scheduled
- [ ] GitHub Actions secrets configured
- [ ] Docker images are from trusted sources
- [ ] Services run as non-root users (configured in Dockerfiles)

## Next Steps

1. Set up monitoring (e.g., UptimeRobot, Pingdom)
2. Configure log aggregation (e.g., Logtail, Datadog)
3. Set up automated database backups
4. Configure rate limiting and DDoS protection
5. Set up staging environment for testing

## Support

For issues or questions:
1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Review GitHub Actions logs
3. Check service health endpoints
4. Review this documentation

