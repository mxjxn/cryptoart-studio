# Environment Variables Management Guide

This guide explains how to securely manage environment variables for production deployment on Hostinger KVM2.

## Security Principles

1. **Never commit secrets to Git** - All sensitive data should be excluded via `.gitignore`
2. **Use Docker secrets** - Store passwords in Docker secret files
3. **Separate by environment** - Use different values for dev/staging/production
4. **Rotate regularly** - Change passwords and API keys periodically
5. **Limit access** - Only grant access to those who need it

## File Structure

```
/opt/cryptoart/
├── .env.production          # Non-sensitive env vars (gitignored)
├── secrets/                 # Sensitive secrets (gitignored)
│   ├── postgres_password.txt
│   └── redis_password.txt
└── docker-compose.prod.yml  # References secrets
```

## Setting Up Environment Variables

### Step 1: Create Secrets Directory

On your Hostinger server:

```bash
cd /opt/cryptoart
mkdir -p secrets
chmod 700 secrets
```

### Step 2: Create Secret Files

**PostgreSQL Password:**
```bash
echo "your-strong-postgres-password-here" > secrets/postgres_password.txt
chmod 600 secrets/postgres_password.txt
```

**Redis Password:**
```bash
echo "your-strong-redis-password-here" > secrets/redis_password.txt
chmod 600 secrets/redis_password.txt
```

**Important**: Use strong, randomly generated passwords:
```bash
# Generate strong password (32 characters)
openssl rand -base64 32
```

### Step 3: Create Environment File

Create `.env.production` on the server (NOT in git):

```bash
cd /opt/cryptoart
nano .env.production
```

Add all non-sensitive environment variables:

```bash
# ============================================
# Database Configuration
# ============================================
POSTGRES_USER=postgres
POSTGRES_DB=cryptoart

# ============================================
# Application Configuration
# ============================================
NEXT_PUBLIC_URL=https://cryptoart.social

# ============================================
# Neynar API (Farcaster Integration)
# ============================================
NEYNAR_API_KEY=your_neynar_api_key_here
NEYNAR_CLIENT_ID=your_neynar_client_id_here

# ============================================
# Blockchain Configuration
# ============================================
RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
CHAIN_ID=8453
ALCHEMY_API_KEY=your_alchemy_api_key_here

# ============================================
# Optional: Redis (if using Upstash instead of local)
# ============================================
# KV_REST_API_URL=https://your-upstash-url.upstash.io
# KV_REST_API_TOKEN=your-upstash-token

# ============================================
# Admin Configuration (REQUIRED)
# ============================================
ADMIN_WALLET_ADDRESS=0x0000000000000000000000000000000000000000
ADMIN_FARCASTER_USERNAME=
ADMIN_FID=0

# ============================================
# Optional: Feature Flags
# ============================================
CRYPTOART_HYPERSUB_CONTRACT=0x...
CRON_SECRET=your-random-secret-string-here
DEV_BYPASS_MEMBERSHIP=false

# ============================================
# Optional: Airdrop Wallet (if using)
# ============================================
AIRDROP_WALLET_PRIVATE_KEY=your-private-key-here

# ============================================
# Indexer Configuration (Optional)
# ============================================
START_BLOCK=
BATCH_SIZE=100
POLL_INTERVAL=12000
ERC721_IMPLEMENTATION_ADDRESSES=
ERC1155_IMPLEMENTATION_ADDRESSES=
ERC6551_IMPLEMENTATION_ADDRESSES=
```

Secure the file:
```bash
chmod 600 .env.production
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_URL` | Public URL of your application | `https://cryptoart.social` |
| `POSTGRES_USER` | PostgreSQL username | `postgres` |
| `POSTGRES_DB` | PostgreSQL database name | `cryptoart` |
| `RPC_URL` | Base network RPC endpoint | `https://base-mainnet.g.alchemy.com/v2/...` |
| `ADMIN_WALLET_ADDRESS` | Admin wallet address for platform moderation | `0x...` |
| `ADMIN_FARCASTER_USERNAME` | Admin Farcaster username | `username` |
| `ADMIN_FID` | Admin Farcaster FID | `4905` |

### Sensitive Variables (Stored in Secrets)

| Variable | Location | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | `secrets/postgres_password.txt` | PostgreSQL password |
| `REDIS_PASSWORD` | `secrets/redis_password.txt` | Redis password |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEYNAR_API_KEY` | Neynar API key for Farcaster | - |
| `NEYNAR_CLIENT_ID` | Neynar client ID | - |
| `ALCHEMY_API_KEY` | Alchemy API key for NFT data | - |
| `CRON_SECRET` | Secret for authenticating cron job requests | - |
| `ADMIN_SECRET` | Secret for admin operations (optional) | - |
| `CHAIN_ID` | Blockchain chain ID | `8453` (Base) |
| `START_BLOCK` | Indexer starting block | Auto-detect |
| `BATCH_SIZE` | Indexer batch size | `100` |
| `POLL_INTERVAL` | Indexer poll interval (ms) | `12000` |

## Loading Environment Variables

### Method 1: Using docker-compose (Recommended)

The `docker-compose.prod.yml` automatically loads:
- Environment variables from `.env.production` (via `env_file`)
- Secrets from `secrets/` directory (via Docker secrets)

### Method 2: Manual Export

```bash
cd /opt/cryptoart
export $(cat .env.production | xargs)
docker compose -f docker-compose.prod.yml up -d
```

## GitHub Actions Secrets

For CI/CD, add these secrets in GitHub:

1. Go to: Repository → Settings → Secrets and variables → Actions
2. Add the following secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `HOSTINGER_HOST` | Server IP or domain | `123.45.67.89` |
| `HOSTINGER_USER` | SSH username | `root` |
| `HOSTINGER_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `HOSTINGER_PORT` | SSH port | `22` |
| `DEPLOY_PATH` | Deployment path | `/opt/cryptoart` |
| `NEXT_PUBLIC_URL` | Production URL | `https://cryptoart.social` |

**Note**: The GitHub Actions workflow does NOT need access to your environment variables. It only needs SSH access to pull and restart containers.

## Rotating Secrets

### Rotate PostgreSQL Password

1. **Update password file:**
   ```bash
   echo "new-password" > secrets/postgres_password.txt
   ```

2. **Update PostgreSQL:**
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres \
     psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new-password';"
   ```

3. **Restart services:**
   ```bash
   docker compose -f docker-compose.prod.yml restart
   ```

### Rotate Redis Password

1. **Update password file:**
   ```bash
   echo "new-password" > secrets/redis_password.txt
   ```

2. **Update Redis config:**
   ```bash
   # Edit docker-compose.prod.yml to use new password
   # Or update Redis directly
   docker compose -f docker-compose.prod.yml exec redis \
     redis-cli CONFIG SET requirepass "new-password"
   ```

3. **Restart services:**
   ```bash
   docker compose -f docker-compose.prod.yml restart
   ```

### Rotate API Keys

1. **Update `.env.production`:**
   ```bash
   nano .env.production
   # Update the API key value
   ```

2. **Restart affected services:**
   ```bash
   docker compose -f docker-compose.prod.yml restart studio-app indexer
   ```

## Backup Strategy

### Backup Environment Files

```bash
# Create backup directory
mkdir -p ~/cryptoart-backups

# Backup environment files
tar -czf ~/cryptoart-backups/env-$(date +%Y%m%d).tar.gz \
  .env.production secrets/

# Encrypt backup (optional)
gpg --encrypt --recipient your-email@example.com \
  ~/cryptoart-backups/env-$(date +%Y%m%d).tar.gz
```

### Restore Environment Files

```bash
# Decrypt if encrypted
gpg --decrypt env-backup.tar.gz.gpg > env-backup.tar.gz

# Extract
tar -xzf env-backup.tar.gz -C /opt/cryptoart/

# Set permissions
chmod 700 /opt/cryptoart/secrets
chmod 600 /opt/cryptoart/secrets/*
chmod 600 /opt/cryptoart/.env.production
```

## Security Checklist

- [ ] `.env.production` is in `.gitignore`
- [ ] `secrets/` directory is in `.gitignore`
- [ ] Secret files have `600` permissions
- [ ] Secrets directory has `700` permissions
- [ ] Strong passwords (32+ characters, random)
- [ ] API keys are rotated regularly
- [ ] Backups are encrypted
- [ ] Only necessary users have access
- [ ] SSH keys are secure
- [ ] GitHub Actions secrets are configured

## Troubleshooting

### Environment Variables Not Loading

```bash
# Check if .env.production exists
ls -la .env.production

# Check file permissions
stat .env.production

# Verify docker-compose can read it
docker compose -f docker-compose.prod.yml config
```

### Secrets Not Working

```bash
# Check secrets directory exists
ls -la secrets/

# Check secret file permissions
stat secrets/postgres_password.txt

# Verify secrets are readable
cat secrets/postgres_password.txt
```

### Database Connection Issues

```bash
# Test connection manually
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d cryptoart -c "SELECT 1;"

# Check environment variable in container
docker compose -f docker-compose.prod.yml exec studio-app \
  env | grep POSTGRES
```

## Best Practices

1. **Use different passwords** for each environment (dev/staging/prod)
2. **Never share secrets** via email, Slack, or other insecure channels
3. **Use password managers** to store and generate strong passwords
4. **Audit access regularly** - review who has access to secrets
5. **Monitor for leaks** - use tools like GitGuardian or GitHub Secret Scanning
6. **Document changes** - keep a log of when secrets are rotated
7. **Test backups** - regularly verify backup restoration works

## Emergency Procedures

### If Secrets Are Compromised

1. **Immediately rotate all secrets:**
   ```bash
   # Generate new passwords
   openssl rand -base64 32 > secrets/postgres_password.txt
   openssl rand -base64 32 > secrets/redis_password.txt
   
   # Update services
   docker compose -f docker-compose.prod.yml restart
   ```

2. **Rotate API keys** in their respective dashboards:
   - Neynar API: https://neynar.com/dashboard
   - Alchemy API: https://dashboard.alchemy.com/

3. **Review access logs** for unauthorized access

4. **Notify team** if applicable

### If Server Is Compromised

1. **Isolate the server** (disable SSH, block IPs)
2. **Backup current state** (for forensics)
3. **Rotate all secrets** on a new server
4. **Restore from clean backup**
5. **Review security** and patch vulnerabilities

