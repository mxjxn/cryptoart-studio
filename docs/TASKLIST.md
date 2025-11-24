# Cryptoart Monorepo Tasklist

This document tracks tasks, in-progress work, and items needing testing across the cryptoart-monorepo.

## 🔴 High Priority - Testing Required

### Creator Core Indexer & Database Schema

- [x] **Database Migration - Creator Core Tables**
  - [x] Schema defined with Creator Core tables (contracts, tokens, transfers)
  - [x] Migration scripts available from project root (`pnpm db:push`)
  - [x] Drizzle config updated to use `.env.local` from project root
  - [x] Verified `creator_core_contracts` table exists
  - [x] Verified `creator_core_tokens` table exists
  - [x] Verified `creator_core_transfers` table exists
  - [ ] Test inserting sample contract data
  - [ ] Test querying indexed data

- [x] **Database Migration - SuchGallery Tables**
  - [x] Schema updated with gallery terminology (curated_galleries, curated_gallery_nfts)
  - [x] Schema uses `target_gallery_id` in quote_casts table
  - [x] Migration scripts available from project root (`pnpm db:push`)
  - [x] SuchGallery API routes updated to use Drizzle with new table names
  - [x] Verified `such_gallery_users` table exists
  - [x] Verified `curated_galleries` table exists
  - [x] Verified `curated_gallery_nfts` table exists
  - [x] Verified `quote_casts` table with `target_gallery_id` exists
  - [ ] Test SuchGallery app works with new tables
  - [ ] Verify no broken references in API routes

- [ ] **Creator Core Indexer Service**
  - [ ] Set up environment variables (POSTGRES_URL, RPC_URL)
  - [ ] Test indexer detects Creator Core contracts
  - [ ] Test Transfer event indexing
  - [ ] Test mint detection (from = zero address)
  - [ ] Test metadata fetching and caching
  - [ ] Test extension registration tracking
  - [ ] Verify indexer handles reorgs correctly
  - [ ] Test indexer restart/recovery from last block

- [ ] **Shared Database Configuration**
  - [ ] Test Postgres connection pooling
  - [ ] Test Redis connection (Upstash and standard)
  - [ ] Test key prefixing for Redis
  - [ ] Verify all apps can use shared connections
  - [ ] Test connection cleanup on shutdown

### API Route Updates

- [ ] **Studio API Routes - Creator Core Integration**
  - [ ] Test `/api/studio/contracts` returns indexed contracts
  - [ ] Test `/api/studio/collections/[address]` returns tokens from indexed data
  - [ ] Test `/api/studio/auctions` uses indexed contracts
  - [ ] Verify empty states work correctly
  - [ ] Test error handling for missing contracts

- [ ] **SuchGallery API Routes - Gallery Terminology**
  - [x] API routes updated to use Drizzle with gallery table names
  - [x] Collections API (`/api/collections`) uses `curatedGalleries` table
  - [x] Quote-cast schema uses `targetGalleryId` field
  - [ ] Test all collection endpoints work with new table names
  - [ ] Test quote-cast endpoints with `targetGalleryId`
  - [ ] Verify referral tracking still works
  - [ ] Test metadata refresh endpoints

### Studio App UI Updates

- [ ] **Studio Dashboard**
  - [ ] Test Current Auctions component displays correctly
  - [ ] Test Collections List component displays correctly
  - [ ] Test empty states show appropriate messages
  - [ ] Test view mode toggles (cards/table)
  - [ ] Test "New Collection" button flow

- [ ] **Collection Creation Flow**
  - [ ] Test CreateCollectionModal contract type selection
  - [ ] Test collection creation form
  - [ ] Test navigation to new collection detail page
  - [ ] Verify breadcrumbs display correctly

- [ ] **Collection Detail Page**
  - [ ] Test compact collection details display
  - [ ] Test NFT grid/list view
  - [ ] Test "Create New Item" button
  - [ ] Test "Create a Series" button
  - [ ] Test empty state with creation options

- [ ] **NFT Creation Flow**
  - [ ] Test NFT creation with pre-selected collection
  - [ ] Test NFT creation without collection (dropdown selection)
  - [ ] Test series creation flow
  - [ ] Verify breadcrumbs adapt correctly

### Subgraph Updates

- [ ] **Creator Core & Auctionhouse Subgraph**
  - [ ] Add `startBlock` configuration to all data sources
    - [ ] Set `ERC721_CREATOR_START_BLOCK` in main subgraph (currently using template variable)
    - [ ] Set `ERC1155_CREATOR_START_BLOCK` in main subgraph (currently using template variable)
    - [ ] Set `MARKETPLACE_START_BLOCK` in main subgraph (currently using template variable)
    - [ ] Verify auctionhouse subgraph has correct start blocks (MarketplaceCore: 30437036, SettlementLib: 30437036, CreatorCore: 0)
    - [ ] Document start block values in deployment docs
    - [ ] Note: Templates don't need startBlock, but instantiated contracts should use deployment block
  - [ ] Verify ERC1155CreatorTemplate works
  - [ ] Verify ERC6551CreatorTemplate works
  - [ ] Test dynamic contract tracking
  - [ ] Deploy updated subgraph to The Graph Studio
  - [ ] Test queries for new contract types

## 🟡 In Progress

### Database Schema Extensions
- ✅ Created Creator Core tables (contracts, tokens, transfers, extensions)
- ✅ Renamed SuchGallery tables (collections → galleries)
- ✅ Updated drizzle.config.ts to use `.env.local` from project root
- ✅ Added migration scripts to root package.json (`pnpm db:push`, `pnpm db:generate`, etc.)
- ✅ SuchGallery API routes updated to use Drizzle with new table names
- ⏳ **Needs**: Run migrations from project root and test

### Creator Core Indexer
- ✅ Created indexer service structure
- ✅ Implemented contract detection
- ✅ Implemented event processing
- ✅ Implemented metadata fetching
- ⏳ **Needs**: Deployment, configuration, and testing

### Shared Database Configuration
- ✅ Created shared-db-config package
- ✅ Implemented Postgres connection pooling
- ✅ Implemented Redis connection utilities
- ⏳ **Needs**: Integration testing across all apps

### API Integration
- ✅ Updated API routes to use indexed data
- ✅ Updated SuchGallery routes for gallery terminology
- ⏳ **Needs**: End-to-end testing with real data

### Documentation
- ✅ Created central DEPLOYMENT.md
- ✅ Updated README.md with deployment links
- ✅ Removed backend references
- ⏳ **Needs**: Review and verify all links work

## 🟢 Completed Recently

- ✅ Removed deprecated backend directories
- ✅ Created Creator Core indexer package
- ✅ Created shared database configuration package
- ✅ Extended database schema with Creator Core tables
- ✅ Renamed SuchGallery tables to use gallery terminology
- ✅ Updated all API routes to use indexed data
- ✅ Updated subgraph with ERC1155 and ERC6551 templates
- ✅ Created comprehensive deployment documentation
- ✅ Configured migrations to run from project root
- ✅ Updated drizzle.config.ts to read `.env.local` from project root
- ✅ SuchGallery API routes migrated to use Drizzle with shared database
- ✅ Verified all database tables exist (17/17 tables confirmed)
- ✅ Created database verification script (`pnpm db:verify`)

## 📝 Notes

### Database Migration Strategy

**Important**: The table renames require a migration strategy:

1. **For SuchGallery tables**: 
   - Option A: Create new tables, migrate data, drop old tables
   - Option B: Use ALTER TABLE RENAME (PostgreSQL supports this)
   - Recommended: Use ALTER TABLE for minimal downtime

2. **For Creator Core tables**:
   - These are new tables, so just run `pnpm db:push` from project root
   - No migration needed, just creation
   - Drizzle config now reads `.env.local` from project root

### Indexer Deployment

The Creator Core Indexer needs to be deployed as a background service:
- Railway, Render, or similar platform
- Or as a Vercel cron job (for periodic indexing)
- Or as a standalone service on a VPS

### Testing Checklist

Before considering complete:
- [ ] All database migrations run successfully
- [ ] Indexer indexes at least one contract successfully
- [ ] Studio app displays indexed collections
- [ ] SuchGallery app works with renamed tables
- [ ] All API routes return correct data
- [ ] No console errors in browser
- [ ] No TypeScript compilation errors

## 🔗 Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [README.md](./README.md) - Project overview
- [INDEXER_IMPLEMENTATION_SUMMARY.md](./INDEXER_IMPLEMENTATION_SUMMARY.md) - Indexer implementation details

---

**Last Updated**: 2025-01-XX
**Status**: Implementation complete, testing phase
