# Quick Start Deployment Guide

This is a condensed version of the full deployment guide. For detailed instructions, see [DEPLOYMENT_PRODUCTION.md](./DEPLOYMENT_PRODUCTION.md).

## Prerequisites Checklist

- [ ] Hostinger KVM2 server with root/SSH access
- [ ] Domain name pointing to server IP
- [ ] GitHub repository with code
- [ ] API keys ready (Neynar, Alchemy, etc.)

## 5-Minute Setup

### 1. Server Setup (One-time)

```bash
# SSH into server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
apt install docker-compose-plugin -y

# Create deployment directory
mkdir -p /opt/cryptoart && cd /opt/cryptoart
git clone https://github.com/your-username/cryptoart-monorepo.git .
```

### 2. Configure Secrets (One-time)

```bash
# Create secrets directory
mkdir -p secrets && chmod 700 secrets

# Generate and save passwords
openssl rand -base64 32 > secrets/postgres_password.txt
openssl rand -base64 32 > secrets/redis_password.txt
chmod 600 secrets/*.txt
```

### 3. Create Environment File

```bash
# Copy template and edit
cp .env.example .env.production  # If you have a template
nano .env.production
```

**Minimum required variables:**
```bash
NEXT_PUBLIC_URL=https://cryptoart.social
POSTGRES_USER=postgres
POSTGRES_DB=cryptoart
RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
NEYNAR_API_KEY=your_key
```

### 4. Initial Deployment

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Setup GitHub Actions

1. Go to GitHub → Settings → Secrets → Actions
2. Add these secrets:
   - `HOSTINGER_HOST` - Your server IP
   - `HOSTINGER_USER` - SSH username (usually `root`)
   - `HOSTINGER_SSH_KEY` - Your private SSH key
   - `DEPLOY_PATH` - `/opt/cryptoart`

3. Push to main branch - deployment happens automatically!

## Common Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart service
docker compose -f docker-compose.prod.yml restart studio-app

# Update and redeploy
cd /opt/cryptoart
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Check health
curl http://localhost:3000/api/health
```

## Nginx & SSL Setup (After Initial Deployment)

For production, use **host-level nginx** for better multi-domain routing:

```bash
# Install nginx and certbot
apt install nginx certbot python3-certbot-nginx -y

# Get SSL certificate
certbot certonly --standalone -d cryptoart.social

# Create nginx site config
# See nginx/sites-available/cryptoart.social.example
# Or follow NGINX_REVERSE_PROXY_GUIDE.md

# Enable site
ln -s /etc/nginx/sites-available/cryptoart.social /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

**For multiple domains and internal routing, see [NGINX_REVERSE_PROXY_GUIDE.md](./NGINX_REVERSE_PROXY_GUIDE.md)**

## Troubleshooting

**Services won't start?**
```bash
docker compose -f docker-compose.prod.yml logs
```

**Database connection issues?**
```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d cryptoart
```

**Need to reset everything?**
```bash
docker compose -f docker-compose.prod.yml down -v
# Then start fresh
```

## Next Steps

1. ✅ Verify deployment: `curl https://cryptoart.social/api/health`
2. ✅ Set up monitoring (UptimeRobot, etc.)
3. ✅ Configure automated backups
4. ✅ Review [ENV_VARS_MANAGEMENT.md](./ENV_VARS_MANAGEMENT.md) for security

## Full Documentation

- **Complete Guide**: [DEPLOYMENT_PRODUCTION.md](./DEPLOYMENT_PRODUCTION.md)
- **Nginx Setup**: [NGINX_REVERSE_PROXY_GUIDE.md](./NGINX_REVERSE_PROXY_GUIDE.md) ⭐ **For multi-domain routing**
- **Environment Variables**: [ENV_VARS_MANAGEMENT.md](./ENV_VARS_MANAGEMENT.md)
- **App Config**: [apps/cryptoart-studio-app/ENV_VARS.md](./apps/cryptoart-studio-app/ENV_VARS.md)

