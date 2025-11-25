# Shared Database Configuration

This package provides shared database connection utilities for Postgres and Redis across all projects in the monorepo.

## Features

- **Shared Postgres Connection**: Singleton pattern with connection pooling
- **Redis Support**: Supports both Upstash Redis (REST API) and standard Redis (ioredis)
- **Key Prefixing**: Automatic key prefixing for Redis to avoid conflicts between projects
- **Connection Management**: Proper connection cleanup utilities

## Environment Variables

### Postgres
- `POSTGRES_URL` (required): PostgreSQL connection string
  - Example: `postgres://user:password@host:port/database`

### Redis (choose one)

**Option 1: Upstash Redis**
- `KV_REST_API_URL` (required): Upstash Redis REST API URL
- `KV_REST_API_TOKEN` (required): Upstash Redis REST API token

**Option 2: Standard Redis**
- `REDIS_URL` (required): Redis connection string
  - Example: `redis://localhost:6379` or `redis://:password@host:port`

## Usage

### Postgres

```typescript
import { getSharedDatabase } from '@cryptoart/shared-db-config';
import { someTable } from '@cryptoart/db';

const db = getSharedDatabase();
const results = await db.select().from(someTable);
```

### Redis

```typescript
import { getSharedRedis, getPrefixedKey } from '@cryptoart/shared-db-config';

const redis = getSharedRedis();
const project = 'cryptoart-studio';
const key = getPrefixedKey(project, 'user:123');

// Upstash Redis
if (redis instanceof Redis) {
  await redis.set(key, 'value');
  const value = await redis.get(key);
}

// Standard Redis (ioredis)
if (redis instanceof RedisClient) {
  await redis.set(key, 'value');
  const value = await redis.get(key);
}
```

## Projects Using This Package

- `apps/cryptoart-studio-app`
- `apps/such-gallery`
- `apps/auctionhouse`
- `lssvm2` (if applicable)

All projects share the same Postgres database and Redis instance, using schema-based separation and key prefixing to avoid conflicts.

