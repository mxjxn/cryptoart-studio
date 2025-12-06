# Database Scripts

This folder contains scripts for managing database migrations and maintenance.

## Quick Start

**Run all migrations (recommended for new setups):**
```bash
pnpm db:migrate-all
```

**Run only the admin tables migration (if other tables already exist):**
```bash
pnpm db:migrate-admin
```

## Available Scripts

### Migration Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `migrate-all.ts` | `pnpm db:migrate-all` | Runs all migrations in order (0000 → 0004). Idempotent - skips existing. |
| `migrate-admin-tables.ts` | `pnpm db:migrate-admin` | Runs only the admin tables migration (0003). |
| `migrate-allowlist-signatures.ts` | `pnpm db:migrate-allowlist` | Runs only the allowlist signatures migration (0004). |
| `run-migration.ts` | `pnpm db:run-migration-0000` | Runs only the initial migration (0000). Legacy. |
| `create-image-cache.ts` | `pnpm db:create-image-cache` | Creates image_cache table directly (alternative to migration). |
| `create-follows-favorites.ts` | `pnpm db:create-follows-favorites` | Creates follows/favorites tables directly (alternative to migration). |

### Utility Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `check-migrations.ts` | `pnpm db:check` | Compares local migrations with database state. |
| `verify-tables.ts` | `pnpm db:verify` | Verifies all expected tables exist. |
| `mark-migration-applied.ts` | `pnpm db:mark-applied` | Marks migrations as applied in drizzle tracking table. |
| `inspect-migrations.ts` | - | Debug script to inspect migration state. |

## Migration Order

Migrations should be applied in this order:

1. **0000_broad_blur.sql** - Initial tables (user_cache, contract_cache, notifications, etc.)
2. **0001_add_image_cache.sql** - Image cache table
3. **0002_add_follows_favorites.sql** - Follows and favorites tables  
4. **0003_add_admin_tables.sql** - Admin system tables (featured, hidden users, analytics, etc.)
5. **0004_add_pending_allowlist_signatures.sql** - Pending allowlist signatures table

## Environment Variables

All scripts read from these environment variable sources (in order):
1. `{project_root}/.env.local`
2. `{project_root}/.env`
3. `packages/db/.env.local`
4. `packages/db/.env`

Required variable: `STORAGE_POSTGRES_URL` or `POSTGRES_URL`

## Drizzle Commands

These use drizzle-kit directly:

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate new migration from schema changes |
| `pnpm db:push` | Push schema directly (no migration file) |
| `pnpm db:studio` | Open Drizzle Studio UI |


