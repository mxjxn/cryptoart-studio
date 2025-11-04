# Additional Packages Documentation

This document describes packages that were added to the monorepo but whose exact relationship to the main project is still being determined.

> **Status**: These packages exist in the monorepo but their integration and usage patterns are being evaluated.

---

## Packages Overview

| Package | Location | Purpose | Status |
|---------|----------|---------|--------|
| `cache` | `packages/cache/` | Hypersub caching layer | Under evaluation |
| `db` | `packages/db/` | Database layer with Drizzle ORM | Under evaluation |
| `eslint-config` | `packages/eslint-config/` | Shared ESLint configuration | Under evaluation |
| `typescript-config` | `packages/typescript-config/` | Shared TypeScript configuration | Under evaluation |
| `ui` | `packages/ui/` | Shared UI component library | Under evaluation |

---

## Package Details

### `packages/cache/` - Hypersub Cache

**Package Name**: `@repo/cache`

**Purpose**: Provides caching functionality for Hypersub subscription data.

**Key Files**:
- `src/hypersub-cache.ts` - Main cache implementation
- `src/index.ts` - Package exports

**Dependencies**:
- `@repo/db` - Database package for cache storage

**Main Exports**:
```typescript
export { HypersubCache, hypersubCache } from './hypersub-cache';
```

**Functionality**:
- Caches Hypersub subscription data with TTL (1 hour default)
- Caches subscriber data with expiration timestamps
- Provides methods to get/set cached data
- Uses Drizzle ORM for database operations

**Usage Example**:
```typescript
import { HypersubCache } from '@repo/cache';

const cache = new HypersubCache();
const subscriptions = await cache.getSubscriptions(fid);
await cache.setSubscriptions(fid, subscriptionData);
```

**Database Tables Used**:
- `subscriptions_cache` - Stores cached subscription metadata
- `subscribers_cache` - Stores cached subscriber data

**Relationship to Other Packages**:
- Depends on `@repo/db` for database access
- Used by `apps/cryptoart-studio-app/` for caching Hypersub data

---

### `packages/db/` - Database Layer

**Package Name**: `@repo/db`

**Purpose**: Provides database access layer using Drizzle ORM with PostgreSQL.

**Key Files**:
- `src/client.ts` - Database client singleton
- `src/schema.ts` - Database schema definitions
- `src/index.ts` - Package exports
- `drizzle.config.ts` - Drizzle configuration

**Dependencies**:
- `drizzle-orm` - ORM library
- `postgres` - PostgreSQL client
- `@vercel/postgres` - Vercel Postgres adapter

**Scripts**:
- `db:generate` - Generate migrations
- `db:migrate` - Run migrations
- `db:push` - Push schema changes
- `db:studio` - Open Drizzle Studio

**Main Exports**:
```typescript
export { 
  getDatabase, 
  subscriptionsCache, 
  subscribersCache,
  airdropLists,
  listRecipients,
  airdropHistory,
  nftCollections,
  collectionMints,
  clankerTokens
} from './client';
export type { SubscriptionCacheData, SubscriberCacheData } from './schema';
```

**Database Tables**:
- `subscriptions_cache` - Cached subscription metadata
- `subscribers_cache` - Cached subscriber data
- `airdrop_lists` - Airdrop list management
- `list_recipients` - Recipients for airdrop lists
- `airdrop_history` - Airdrop execution history
- `nft_collections` - NFT collection data
- `collection_mints` - Collection mint records
- `clanker_tokens` - Clanker token data

**Configuration**:
Requires `POSTGRES_URL` environment variable.

**Usage Example**:
```typescript
import { getDatabase, subscriptionsCache } from '@repo/db';

const db = getDatabase();
const result = await db.select().from(subscriptionsCache);
```

**Relationship to Other Packages**:
- Used by `@repo/cache` for database operations
- Used by `apps/cryptoart-studio-app/` for data persistence

---

### `packages/eslint-config/` - ESLint Configuration

**Package Name**: `@repo/eslint-config`

**Purpose**: Shared ESLint configuration for the monorepo.

**Files**:
- `base.js` - Base ESLint configuration
- `next.js` - Next.js specific configuration
- `react-internal.js` - React internal configuration
- `README.md` - Configuration documentation

**Usage**:
Used by other packages and apps via:
```json
{
  "eslintConfig": {
    "extends": "@repo/eslint-config/next"
  }
}
```

**Relationship to Other Packages**:
- Used by `@repo/ui` package
- Used by Next.js apps in the monorepo

---

### `packages/typescript-config/` - TypeScript Configuration

**Package Name**: `@repo/typescript-config`

**Purpose**: Shared TypeScript configuration files for consistent type checking across the monorepo.

**Files**:
- `base.json` - Base TypeScript configuration
- `nextjs.json` - Next.js TypeScript configuration
- `react-library.json` - React library TypeScript configuration

**Usage**:
Used by other packages via:
```json
{
  "extends": "@repo/typescript-config/nextjs.json"
}
```

**Relationship to Other Packages**:
- Used by `@repo/ui` package
- Used by all TypeScript projects in the monorepo

---

### `packages/ui/` - UI Component Library

**Package Name**: `@repo/ui`

**Purpose**: Shared UI component library for React applications.

**Key Files**:
- `src/button.tsx` - Button component
- `src/card.tsx` - Card component
- `src/code.tsx` - Code component

**Dependencies**:
- `react` - React library
- `react-dom` - React DOM
- `@repo/eslint-config` - ESLint configuration
- `@repo/typescript-config` - TypeScript configuration

**Scripts**:
- `lint` - Lint the package
- `generate:component` - Generate new components
- `check-types` - Type check

**Exports**:
Uses wildcard exports:
```json
{
  "exports": {
    "./*": "./src/*.tsx"
  }
}
```

**Usage Example**:
```typescript
import { Button } from '@repo/ui/button';
import { Card } from '@repo/ui/card';
```

**Relationship to Other Packages**:
- Uses `@repo/eslint-config` and `@repo/typescript-config`
- Intended to be used by Next.js apps in the monorepo

---

## Package Relationships

```
apps/cryptoart-studio-app/
  ├── Uses: @repo/ui (for UI components)
  ├── Uses: @repo/cache (for caching)
  └── Uses: @repo/db (for database access)

packages/cache/
  └── Depends on: @repo/db

packages/ui/
  ├── Uses: @repo/eslint-config
  └── Uses: @repo/typescript-config

packages/eslint-config/
  └── Standalone configuration

packages/typescript-config/
  └── Standalone configuration
```

---

## Integration Status

### Current Usage

- **cryptoart-studio-app**: Uses `@repo/db` and `@repo/cache` for data management
- **ui package**: Shared components available but adoption pending
- **config packages**: Used internally but relationship to main project needs clarification

### Open Questions

1. **Cache Package**:
   - Should this be the primary caching solution for all apps?
   - Are there other caching needs beyond Hypersub?

2. **Database Package**:
   - Is this the primary database layer for all apps?
   - Should other apps use this directly or through the cache package?

3. **UI Package**:
   - Should auctionhouse frontend use `@repo/ui`?
   - Are there plans to expand the component library?

4. **Config Packages**:
   - Are these meant to be extended with project-specific rules?
   - Should they be published separately?

---

## Future Considerations

- Evaluate if these packages should be consolidated
- Determine if additional packages need to be created
- Document integration patterns once relationship to main project is clear
- Consider moving this documentation into `llms-full.md` once status is determined

---

## References

- Cache implementation: `packages/cache/src/hypersub-cache.ts`
- Database schema: `packages/db/src/schema.ts`
- Database client: `packages/db/src/client.ts`
- UI components: `packages/ui/src/`
- ESLint configs: `packages/eslint-config/`
- TypeScript configs: `packages/typescript-config/`

