# Local Services Setup (PostgreSQL & Redis)

This guide explains how to set up local PostgreSQL and Redis instances for testing instead of using remote databases.

## Quick Reference

**Start all services:**
```bash
npm run services:start
```

**Stop services (keeps data):**
```bash
npm run services:stop
```

**Stop and remove containers (keeps data):**
```bash
npm run services:down
```

**Complete cleanup (removes all data):**
```bash
npm run services:clean
```

**Check status:**
```bash
npm run services:status
```

**View logs:**
```bash
npm run services:logs
```

See below for detailed instructions and best practices.

## Why Use Local Services?

When developing locally, using local PostgreSQL and Redis instances provides:
- Faster iteration without network latency
- No costs for development/testing
- Full control over data persistence
- Ability to easily reset/clear data during testing
- Work offline without internet connection

## Quick Start (Docker Compose - Recommended)

The easiest way to run all local services is using Docker Compose with npm scripts:

### Starting Services

**Start all services (PostgreSQL + Redis):**
```bash
npm run services:start
```

Or start individually:
```bash
# Start only PostgreSQL
docker-compose up -d postgres

# Start only Redis
docker-compose up -d redis
```

### Managing Services

**Check status:**
```bash
npm run services:status
```

**View logs:**
```bash
npm run services:logs
```

**Stop services (keeps data):**
```bash
npm run services:stop
```

**Stop and remove containers (keeps volumes/data):**
```bash
npm run services:down
```

**Stop and remove everything including data:**
```bash
npm run services:clean
```

**Restart services:**
```bash
npm run services:restart
```

### Best Practices

✅ **Use npm scripts** - They're explicit and clear about what they do  
✅ **Use `services:stop`** - When you're done for the day, keeps data intact  
✅ **Use `services:down`** - When you want to stop but keep volumes  
✅ **Use `services:clean`** - When you want a completely fresh start  

❌ **Avoid Ctrl+C** - For docker-compose, use npm scripts instead for clean teardown

Services will be available at:
- PostgreSQL: `postgresql://postgres:postgres@localhost:5432/cryptoart`
- Redis: `redis://localhost:6379`

## Environment Configuration

### Docker Compose Variables (Optional)

You can customize the PostgreSQL credentials by creating a `.env` file in the project root:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=cryptoart
```

Default values (if not specified):
- User: `postgres`
- Password: `postgres`
- Database: `cryptoart`

### Application Environment Variables

To use local services for testing, update your `.env.local` file:

**PostgreSQL Configuration:**
```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cryptoart
```

**Redis Configuration:**

Option A: Use Local Redis Only (comment out or remove Upstash vars):
```env
# Comment out or remove Upstash variables
# KV_REST_API_URL=https://your-upstash-url.upstash.io
# KV_REST_API_TOKEN=your-upstash-token

# Add local Redis URL
REDIS_URL=redis://localhost:6379
```

Option B: Keep Upstash for Production

The code prioritizes Upstash Redis if both are configured. To use local Redis for testing:
1. Remove `KV_REST_API_URL` and `KV_REST_API_TOKEN` from `.env.local`
2. Add `REDIS_URL=redis://localhost:6379`

### Alternative: Install Services Locally (Not Recommended)

#### PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb cryptoart
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install postgresql-16
sudo systemctl start postgresql
sudo -u postgres createdb cryptoart
```

**Windows:**
Download and install from: https://www.postgresql.org/download/windows/

#### Redis

**macOS (using Homebrew):**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Windows:**
Download and install from: https://github.com/microsoftarchive/redis/releases
Or use WSL and follow the Linux instructions.

## How It Works

The KV implementation follows this priority order:

1. **Upstash Redis** - If `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
2. **Local Redis** - If `REDIS_URL` is set (uses ioredis)
3. **In-memory fallback** - If neither is configured (data lost on restart)

## Testing

After starting services and configuring your environment:

1. **Test PostgreSQL connection**:
   ```bash
   # Using psql (if installed)
   psql postgresql://postgres:postgres@localhost:5432/cryptoart -c "SELECT version();"
   
   # Or using Docker
   docker exec -it cryptoart-postgres psql -U postgres -d cryptoart -c "SELECT version();"
   ```

2. **Test Redis connection**:
   ```bash
   redis-cli ping
   # Should return: PONG
   
   # Or using Docker
   docker exec -it cryptoart-redis redis-cli ping
   ```

3. **Run database migrations**:
   ```bash
   npm run db:push
   ```

4. **Start your app**:
   ```bash
   cd apps/cryptoart-studio-app
   npm run dev
   ```

5. **Check logs** - Your app should connect to both PostgreSQL and Redis without errors

## Useful Redis Commands for Testing

```bash
# Connect to Redis CLI
redis-cli

# View all keys
KEYS *

# Get a specific key
GET <key>

# Delete a key
DEL <key>

# Clear all keys (be careful!)
FLUSHALL

# View info about Redis
INFO

# Exit Redis CLI
exit
```

## Data Persistence

When using Docker Compose, both PostgreSQL and Redis data are persisted in Docker volumes:
- **PostgreSQL**: `postgres-data` volume stores all database files
- **Redis**: `redis-data` volume stores Redis AOF files

Data persists between container restarts but is deleted when you run `npm run services:clean` (which runs `docker-compose down -v`).

### Data Management Commands

**Reset all data (fresh start):**
```bash
npm run services:clean
npm run services:start
npm run db:push  # Re-run migrations
```

**Backup PostgreSQL data:**
```bash
docker exec cryptoart-postgres pg_dump -U postgres cryptoart > backup.sql
```

**Restore PostgreSQL data:**
```bash
docker exec -i cryptoart-postgres psql -U postgres cryptoart < backup.sql
```

**Clear Redis data (keep PostgreSQL):**
```bash
docker exec cryptoart-redis redis-cli FLUSHALL
```

## Useful Commands for Testing

### PostgreSQL Commands

```bash
# Connect to PostgreSQL CLI
docker exec -it cryptoart-postgres psql -U postgres -d cryptoart

# Or if psql is installed locally
psql postgresql://postgres:postgres@localhost:5432/cryptoart

# Inside psql:
# \dt          - List all tables
# \d table_name - Describe a table
# SELECT * FROM table_name; - Query data
# \q           - Exit psql
```

### Redis Commands

```bash
# Connect to Redis CLI
redis-cli
# Or using Docker
docker exec -it cryptoart-redis redis-cli

# Inside redis-cli:
# KEYS *       - View all keys
# GET <key>    - Get a specific key
# DEL <key>    - Delete a key
# FLUSHALL     - Clear all keys (be careful!)
# INFO         - View info about Redis
# exit         - Exit redis-cli
```

## Troubleshooting

### PostgreSQL connection refused
- Make sure PostgreSQL is running: `npm run services:status`
- Check the port is correct (default: 5432)
- Verify `POSTGRES_URL` in your `.env.local` file
- Ensure the database exists (should be created automatically by docker-compose)

### Redis connection refused
- Make sure Redis is running: `npm run services:status` or `redis-cli ping`
- Check the port is correct (default: 6379)
- Verify `REDIS_URL` in your `.env.local` file

### Module not found: ioredis
- Install dependencies: `pnpm install` or `npm install`
- Make sure you're in the correct app directory

### Still using Upstash
- Remove `KV_REST_API_URL` and `KV_REST_API_TOKEN` from `.env.local`
- Restart your development server

### Port already in use
- Check what's using the port: `lsof -i :5432` (PostgreSQL) or `lsof -i :6379` (Redis)
- Stop conflicting services or change ports in `docker-compose.yml`

### Database migration errors
- Ensure PostgreSQL is running: `npm run services:status`
- Check connection string in `.env.local`
- Try resetting: `npm run services:clean && npm run services:start && npm run db:push`

## Notes

- Local services are perfect for development but should not be used in production
- The shared database config package (`@repo/shared-db-config`) supports both local and remote PostgreSQL/Redis
- Individual app KV files (`apps/*/src/lib/kv.ts`) now support both Upstash and local Redis
- Data persists in Docker volumes between container restarts
- Use `npm run services:clean` when you need a completely fresh database
