# Nginx Reverse Proxy Setup Guide for Hostinger

This guide explains how to set up nginx as a reverse proxy on your Hostinger KVM2 server to route multiple domains and handle both public and internal service communication.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Basic Configuration](#basic-configuration)
5. [Multiple Domain Routing](#multiple-domain-routing)
6. [Internal Service Routing](#internal-service-routing)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Advanced Configuration](#advanced-configuration)
9. [Troubleshooting](#troubleshooting)

## Overview

### Why Use Host-Level Nginx?

While Docker Compose includes an nginx container, using **host-level nginx** provides:

- **Single entry point** for all domains
- **Better SSL management** with Let's Encrypt
- **Easier multi-domain routing** without Docker network complexity
- **Service isolation** - internal services stay private
- **Centralized logging** and monitoring

### Architecture

```
Internet
    ↓
Host Nginx (Port 80/443)
    ├─→ cryptoart.social → Docker: studio-app:3000
    ├─→ api.cryptoart.social → Docker: studio-app:3000/api
    ├─→ admin.cryptoart.social → Internal service (not public)
    └─→ Internal services communicate via Docker network
```

## Installation

### Step 1: Install Nginx on Hostinger

```bash
# Update package list
apt update

# Install nginx
apt install nginx -y

# Install certbot for SSL
apt install certbot python3-certbot-nginx -y

# Start and enable nginx
systemctl start nginx
systemctl enable nginx

# Check status
systemctl status nginx
```

### Step 2: Configure Firewall

```bash
# Allow HTTP and HTTPS
ufw allow 'Nginx Full'
# Or if using iptables:
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

## Basic Configuration

### Directory Structure

```
/etc/nginx/
├── nginx.conf              # Main config
├── sites-available/         # Available site configs
│   ├── cryptoart.social
│   ├── api.cryptoart.social
│   └── admin.cryptoart.social
└── sites-enabled/          # Active site configs (symlinks)
    └── cryptoart.social -> ../sites-available/cryptoart.social
```

### Main Configuration

Edit `/etc/nginx/nginx.conf`:

```nginx
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;

    # Rate Limiting Zones
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=50r/s;
    limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=5r/s;

    # Include site configurations
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

## Multiple Domain Routing

### Example: cryptoart.social (Main App)

Create `/etc/nginx/sites-available/cryptoart.social`:

```nginx
# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name cryptoart.social www.cryptoart.social;

    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cryptoart.social www.cryptoart.social;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/cryptoart.social/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cryptoart.social/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Client body size limit
    client_max_body_size 10M;

    # Proxy to Docker container
    location / {
        limit_req zone=general_limit burst=100 nodelay;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Buffering
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # API routes with stricter rate limiting
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/cryptoart.social /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl reload nginx
```

### Example: api.cryptoart.social (API Subdomain)

Create `/etc/nginx/sites-available/api.cryptoart.social`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.cryptoart.social;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.cryptoart.social;

    ssl_certificate /etc/letsencrypt/live/api.cryptoart.social/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cryptoart.social/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Stricter rate limiting for API
    location / {
        limit_req zone=api_limit burst=10 nodelay;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

### Example: Multiple Apps on Different Domains

If you have multiple apps (e.g., `such-gallery`, `auctionhouse`):

```nginx
# such-gallery.example.com
server {
    listen 443 ssl http2;
    server_name such-gallery.example.com;

    ssl_certificate /etc/letsencrypt/live/such-gallery.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/such-gallery.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;  # Different port for different app
        # ... same proxy headers as above
    }
}

# auctionhouse.example.com
server {
    listen 443 ssl http2;
    server_name auctionhouse.example.com;

    ssl_certificate /etc/letsencrypt/live/auctionhouse.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auctionhouse.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;  # Another port
        # ... same proxy headers as above
    }
}
```

## Internal Service Routing

### Services That Should NOT Be Public

Some services should only be accessible internally (between your services):

1. **PostgreSQL** (port 5432) - Database
2. **Redis** (port 6379) - Cache
3. **Indexer** - Background service
4. **Admin panels** - Internal tools
5. **Monitoring** - Prometheus, Grafana, etc.

### Option 1: Internal-Only Server Block

Create `/etc/nginx/sites-available/admin.internal` (not enabled publicly):

```nginx
# Internal admin panel - only accessible from localhost or VPN
server {
    listen 127.0.0.1:8080;  # Only bind to localhost
    server_name admin.internal;

    # Basic auth (optional but recommended)
    auth_basic "Admin Area";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:3003;  # Internal admin service
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Access**: Only via SSH tunnel or VPN:
```bash
# SSH tunnel to access from your local machine
ssh -L 8080:localhost:8080 user@your-server-ip
# Then access http://localhost:8080
```

### Option 2: IP Whitelist

Restrict access to specific IPs:

```nginx
server {
    listen 443 ssl http2;
    server_name admin.cryptoart.social;

    # Allow only specific IPs
    allow 1.2.3.4;  # Your office IP
    allow 5.6.7.8;  # Your home IP
    deny all;

    ssl_certificate /etc/letsencrypt/live/admin.cryptoart.social/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.cryptoart.social/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3003;
        # ... proxy headers
    }
}
```

### Option 3: VPN-Only Access

Use nginx with VPN authentication or restrict to VPN network:

```nginx
# Only allow access from VPN subnet
server {
    listen 443 ssl http2;
    server_name admin.cryptoart.social;

    allow 10.8.0.0/24;  # VPN subnet (example)
    deny all;

    # ... rest of config
}
```

### Service-to-Service Communication

Services communicate via **Docker network** (not through nginx):

```yaml
# In docker-compose.prod.yml
services:
  studio-app:
    networks:
      - cryptoart-network
    # Can access postgres via: postgres:5432 (not exposed to host)
  
  indexer:
    networks:
      - cryptoart-network
    # Can access postgres via: postgres:5432
```

**Key Point**: Services use Docker service names (e.g., `postgres:5432`) for internal communication, not `localhost` or public IPs.

## SSL/TLS Setup

### Single Domain

```bash
# Stop nginx temporarily
systemctl stop nginx

# Get certificate
certbot certonly --standalone -d cryptoart.social -d www.cryptoart.social

# Start nginx
systemctl start nginx
```

### Multiple Domains

```bash
# Get certificates for all domains
certbot certonly --standalone \
  -d cryptoart.social \
  -d www.cryptoart.social \
  -d api.cryptoart.social \
  -d admin.cryptoart.social

# Or get separate certificates
certbot certonly --standalone -d cryptoart.social
certbot certonly --standalone -d api.cryptoart.social
certbot certonly --standalone -d admin.cryptoart.social
```

### Auto-Renewal

```bash
# Test renewal
certbot renew --dry-run

# Set up automatic renewal (usually already configured)
systemctl status certbot.timer

# Or add to crontab
0 0 * * * certbot renew --quiet && systemctl reload nginx
```

## Advanced Configuration

### Load Balancing Multiple Instances

If you run multiple instances of the same service:

```nginx
upstream studio_app {
    least_conn;  # Load balancing method
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    location / {
        proxy_pass http://studio_app;
        # ... headers
    }
}
```

### Caching Static Assets

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=static_cache:10m max_size=1g inactive=60m;

server {
    location /_next/static/ {
        proxy_cache static_cache;
        proxy_cache_valid 200 60m;
        proxy_pass http://127.0.0.1:3000;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

### Custom Error Pages

```nginx
server {
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;

    location = /404.html {
        root /var/www/html;
        internal;
    }
}
```

### Logging Per Domain

```nginx
server {
    server_name cryptoart.social;
    access_log /var/log/nginx/cryptoart.social.access.log;
    error_log /var/log/nginx/cryptoart.social.error.log;
    # ... rest of config
}
```

## Complete Multi-Domain Example

Here's a complete example with multiple domains and internal services:

```nginx
# /etc/nginx/sites-available/cryptoart.social
server {
    listen 80;
    server_name cryptoart.social www.cryptoart.social;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cryptoart.social www.cryptoart.social;

    ssl_certificate /etc/letsencrypt/live/cryptoart.social/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cryptoart.social/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        # ... proxy headers
    }
}

# /etc/nginx/sites-available/api.cryptoart.social
server {
    listen 443 ssl http2;
    server_name api.cryptoart.social;

    ssl_certificate /etc/letsencrypt/live/api.cryptoart.social/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cryptoart.social/privkey.pem;

    location / {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:3000;
        # ... proxy headers
    }
}

# /etc/nginx/sites-available/admin.internal (NOT enabled publicly)
server {
    listen 127.0.0.1:8080;
    server_name admin.internal;

    auth_basic "Admin Area";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:3003;
        # ... proxy headers
    }
}
```

## Updating Docker Compose

Since we're using host-level nginx, **remove or disable** the nginx container in docker-compose:

```yaml
# docker-compose.prod.yml
services:
  # ... other services ...
  
  # Comment out or remove nginx service
  # nginx:
  #   image: nginx:alpine
  #   ...
  
  studio-app:
    ports:
      - "127.0.0.1:3000:3000"  # Only expose on localhost
    # ... rest of config
```

**Important**: Services should bind to `127.0.0.1` (localhost only), not `0.0.0.0`, so they're only accessible via nginx.

## Troubleshooting

### Test Configuration

```bash
# Test nginx configuration
nginx -t

# Test with verbose output
nginx -T

# Reload after changes
systemctl reload nginx
```

### Check Logs

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log

# Domain-specific logs
tail -f /var/log/nginx/cryptoart.social.error.log
```

### Common Issues

**502 Bad Gateway**
- Check if Docker service is running: `docker ps`
- Check if service is listening: `netstat -tulpn | grep 3000`
- Check service logs: `docker logs cryptoart-studio-app-prod`

**SSL Certificate Errors**
- Verify certificate exists: `ls -la /etc/letsencrypt/live/`
- Check certificate expiry: `certbot certificates`
- Renew if needed: `certbot renew`

**Domain Not Resolving**
- Check DNS: `dig cryptoart.social`
- Verify server_name matches: `nginx -T | grep server_name`
- Check firewall: `ufw status`

**Rate Limiting Too Strict**
- Adjust limits in nginx.conf
- Check logs for rate limit errors
- Temporarily disable: `limit_req zone=api_limit;` → `# limit_req zone=api_limit;`

## Security Best Practices

1. **Keep nginx updated**: `apt update && apt upgrade nginx`
2. **Use strong SSL**: TLS 1.2+ only, strong ciphers
3. **Rate limiting**: Prevent abuse
4. **Hide nginx version**: `server_tokens off;` (already in config)
5. **Restrict admin access**: Use IP whitelist or VPN
6. **Regular backups**: Backup nginx configs
7. **Monitor logs**: Set up log rotation and monitoring

## Quick Reference

```bash
# Enable site
ln -s /etc/nginx/sites-available/domain.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Disable site
rm /etc/nginx/sites-enabled/domain.com
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot certonly --standalone -d domain.com

# Renew certificates
certbot renew

# Check nginx status
systemctl status nginx

# View active sites
ls -la /etc/nginx/sites-enabled/
```

---

**Next Steps**: 
- Set up your first domain following the examples above
- Configure SSL certificates
- Test internal vs external routing
- Set up monitoring and logging

