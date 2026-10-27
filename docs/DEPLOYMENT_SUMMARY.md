# Deployment Configuration Summary

This document summarizes deployment configuration files and their purposes.

> **Current cutover:** [VPS_CUTOVER.md](./VPS_CUTOVER.md) — `apps/mvp` + external Supabase + R2 + cron. Legacy `Dockerfile.studio-app` is obsolete for production.

## Files

### Docker Configuration

1. **`Dockerfile.mvp`** — Multi-stage build for `apps/mvp` (standalone Next.js)
2. **`Dockerfile.cron`** — Alpine crond that hits `/api/cron/*` with `CRON_SECRET`
3. **`Dockerfile.indexer`** — Creator-core indexer
4. **`Dockerfile.studio-app`** — Legacy; do not use for the VPS cutover
5. **`docker-compose.prod.yml`** — `mvp` + `cron` + `redis` + `indexer`; optional `postgres` via `--profile self-host-db` only
6. **`.dockerignore`** — Keeps Social/archive out of the mvp image context

### CI/CD

7. **`.github/workflows/deploy.yml`** — Build/push `mvp`, `cron`, `indexer` to GHCR; SSH deploy to Hostinger

### Nginx

8. **`nginx/nginx.conf`** + **`nginx/sites-available/cryptoart.social.example`**
9. **`nginx/sites-available/staging.cryptoart.social.example`** — Shadow host before DNS cutover

### Documentation

10. **`VPS_CUTOVER.md`** / **`PLATFORM_ROADMAP.md`** — Cutover + post-VPS product order
11. **`DEPLOYMENT_PRODUCTION.md`**, **`DEPLOYMENT_QUICKSTART.md`**, **`ENV_VARS_MANAGEMENT.md`**, **`NGINX_REVERSE_PROXY_GUIDE.md`**

### Application

12. **`apps/mvp/src/app/api/health/route.ts`** — Liveness for Docker/CI
13. **`apps/mvp/next.config.ts`** — `output: 'standalone'`
14. **`apps/mvp/src/lib/server/object-storage.ts`** — R2-first shared blob backend

## 🔐 Security Features

- **Docker Secrets**: Passwords stored in files, not environment variables
- **Non-root Users**: All services run as non-root
- **Network Isolation**: Services communicate via Docker network
- **Secret Files**: Excluded from Git via `.gitignore`
- **Environment Files**: Production env files excluded from Git

## 🚀 Deployment Flow

```
GitHub Push (main branch)
    ↓
GitHub Actions Triggered
    ↓
Build Docker Images
    ↓
Push to GitHub Container Registry
    ↓
SSH to Hostinger Server
    ↓
Pull Latest Code
    ↓
Pull Latest Images
    ↓
Restart Services
    ↓
Health Check
```

## 📋 Checklist for First Deployment

### On Your Local Machine

- [ ] Review all configuration files
- [ ] Update GitHub repository URL in workflow
- [ ] Prepare API keys and secrets
- [ ] Generate SSH key pair for server access

### On Hostinger Server

- [ ] Install Docker and Docker Compose
- [ ] Clone repository
- [ ] Create secrets directory and files
- [ ] Create `.env.production` file
- [ ] Set proper file permissions
- [ ] Run initial deployment

### In GitHub

- [ ] Add GitHub Secrets (HOSTINGER_HOST, HOSTINGER_USER, etc.)
- [ ] Verify workflow file is in `.github/workflows/`
- [ ] Test workflow with a test push

### Post-Deployment

- [ ] Verify services are running
- [ ] Test health endpoint
- [ ] Configure SSL certificates
- [ ] Set up monitoring
- [ ] Configure backups

## 🔧 Key Configuration Points

### Environment Variables

- **Non-sensitive**: Stored in `.env.production` (gitignored)
- **Sensitive**: Stored in `secrets/*.txt` files (gitignored)
- **Docker**: Loaded via `env_file` and Docker secrets

### Ports

- **3000**: mvp (localhost only; host nginx proxies here)
- **5432**: only with `--profile self-host-db` (cutover uses external Supabase)
- **6379**: Redis (localhost only)
- **80/443**: host nginx (public)

### Volumes

- **redis-data**: Persistent Redis data
- **postgres-data**: Only if self-hosting Postgres later

### Networks

- **cryptoart-network**: Isolated Docker network for all services

## Documentation Structure

```
VPS_CUTOVER.md / PLATFORM_ROADMAP.md
DEPLOYMENT_SUMMARY.md (this file)
    ├── DEPLOYMENT_PRODUCTION.md
    ├── DEPLOYMENT_QUICKSTART.md
    ├── ENV_VARS_MANAGEMENT.md
    └── NGINX_REVERSE_PROXY_GUIDE.md
```

## 🆘 Quick Troubleshooting

**Services won't start?**
→ Check logs: `docker compose -f docker-compose.prod.yml logs`

**Database connection failed?**
→ Verify secrets: `cat secrets/postgres_password.txt`
→ Check postgres: `docker compose -f docker-compose.prod.yml exec postgres psql -U postgres`

**GitHub Actions failing?**
→ Check SSH key format in GitHub secrets
→ Verify server accessibility
→ Review workflow logs in GitHub Actions tab

**SSL not working?**
→ Verify certificates exist: `ls -la nginx/ssl/`
→ Check nginx logs: `docker compose -f docker-compose.prod.yml logs nginx`

## 📞 Next Steps

1. **Read** `DEPLOYMENT_PRODUCTION.md` for complete setup
2. **Follow** `DEPLOYMENT_QUICKSTART.md` for rapid deployment
3. **Review** `ENV_VARS_MANAGEMENT.md` for security
4. **Test** deployment with a small change
5. **Monitor** services after deployment

## ✨ Features

- ✅ Automated CI/CD via GitHub Actions
- ✅ Secure secret management
- ✅ Health checks and monitoring
- ✅ SSL/TLS support
- ✅ Database persistence
- ✅ Redis caching
- ✅ Background indexer service
- ✅ Production-optimized builds
- ✅ Non-root security
- ✅ Comprehensive documentation

---

**Ready to deploy?** Start with [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md)!

