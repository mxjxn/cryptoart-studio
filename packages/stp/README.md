# @cryptoart/stp - STP v2 Subscription NFT Integration

**⚠️ PARKED FEATURE: Not for day-one relaunch**

This package provides integration with Fabric's [STP v2 (Subscription Token Protocol)](https://github.com/mxjxn/stp-v2) for the cryptoart ecosystem. It will enable artists to offer subscription-based supporter memberships and provides app-level perks for cryptoart.social.

## Status

- ✅ **Complete**: ABIs, viem helpers, DB schema, event handlers, queries, tests, documentation
- 🚫 **Not wired into apps**: No imports from apps/social or apps/studio
- 📦 **Parked**: Max will launch STP after there are users

## Overview

STP v2 is Fabric's subscription NFT protocol that allows creators to offer time-based memberships. This package provides:

1. **ABIs and typed viem helpers** - Read subscription status, expiry, tiers; build mint/renew transactions
2. **Database schema** - Track subscription state across Base and Ethereum
3. **Event handlers** - Process on-chain events to maintain indexed state
4. **Entitlement system** - Check perks like custom gallery URIs and profile customization
5. **Airdrop queries** - Get recipient lists for multi-recipient airdrops on SuchCollection

## Product Intent

### 1. Artist Subscriptions
Artists can enable subscribing supporters by deploying an STP contract (via factory or direct deploy). One STP contract per artist, with multiple tiers for different membership levels.

### 2. App-Level Membership
An app-level STP contract for cryptoart.social membership that unlocks advanced features:
- **Custom gallery URIs**: Personalized gallery URLs
- **Profile customization**: Advanced profile settings

Check entitlements with `hasPerk(fid or address, perk)`.

### 3. Airdrop Integration
Functions for getting recipient lists that feed into SuchCollection's multi-recipient airdrop feature (being added by another agent):
- `getActiveSubscribers()` - Currently active subscribers
- `getAllStpHolders()` - All NFT holders including lapsed

## Installation

This package is a workspace package and doesn't need separate installation:

```typescript
import { hasPerk, AppPerk, getActiveSubscribers } from '@cryptoart/stp';
```

## Usage

### Reading Subscription State

```typescript
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { readSubscription, isSubscriptionActive } from '@cryptoart/stp';

const client = createPublicClient({
  chain: base,
  transport: http(),
});

// Read subscription for an address
const subscription = await readSubscription(
  client,
  '0x...', // STP contract address
  '0x...'  // User address
);

console.log('Active:', isSubscriptionActive(subscription));
console.log('Expires:', new Date(subscription.expiresAt * 1000));
console.log('Tier:', subscription.tierId);
```

### Checking Perks

```typescript
import { hasPerk, AppPerk } from '@cryptoart/stp';

// Check by address
const hasCustomGallery = await hasPerk(
  '0x1234...',
  AppPerk.CUSTOM_GALLERY_URI
);

// Check by FID
const hasProfileCustomization = await hasPerk(
  12345,
  AppPerk.PROFILE_CUSTOMIZATION
);

if (hasCustomGallery) {
  // Show custom gallery URI settings
}
```

### Airdrop Recipients

```typescript
import { getActiveSubscribers, getAllStpHolders } from '@cryptoart/stp';

// Get active subscribers for artist's STP
const activeSupporter = await getActiveSubscribers(
  '0x...', // Artist's STP contract
  8453      // Base
);

// Get all holders (including lapsed)
const allHolders = await getAllStpHolders(
  '0x...', // Artist's STP contract
  8453      // Base
);

// Use with SuchCollection multi-recipient airdrop
// (See apps/studio airdrop flow when that agent's PR merges)
```

### Building Transactions

```typescript
import { buildMint, buildMintAdvanced } from '@cryptoart/stp';
import { parseEther } from 'viem';

// Simple mint (default tier)
const mintTx = buildMint(parseEther('0.01'));

// Advanced mint with tier and referral
const advancedMintTx = buildMintAdvanced({
  recipient: '0x...',
  tierId: 1,
  purchaseValue: parseEther('0.01'),
  referralCode: 123n,
  referrer: '0x...',
});

// Use with wagmi or viem
await writeContract({
  address: stpContractAddress,
  ...mintTx,
  value: parseEther('0.01'),
});
```

## Configuration

Contract addresses are configured via environment variables (since contracts aren't deployed yet):

```bash
# .env
STP_V2_FACTORY_BASE=0x... # Base factory
STP_V2_FACTORY_ETH=0x...  # Ethereum factory
APP_MEMBERSHIP_STP_ADDRESS=0x... # App-level membership contract
```

Placeholder addresses (`0x0000...`) are used until real deployments exist.

## Database Schema

Migration `0026_add_stp_tables.sql` creates:

- **`stp_contracts`** - Deployed STP contracts
- **`stp_subscriptions`** - Individual subscription state (owner, expiry, tier)
- **`stp_tiers`** - Tier configurations
- **`stp_events`** - Raw event log storage (idempotent)
- **`app_perks`** - App-level perk definitions

All tables include chain_id for multi-chain support (Base + Ethereum).

## Event Handling

The event handler module (`src/handlers/event-handlers.ts`) follows the chain-indexer pattern from [PR #199](https://github.com/mxjxn/cryptoart-studio/pull/199).

### Integration Steps (After PR #199 Merges)

1. **Import handlers** in chain-indexer:
   ```typescript
   import { processStpEvent } from '@cryptoart/stp';
   ```

2. **Add STP contracts** to chain-indexer config:
   ```typescript
   import { STP_V2_CONTRACTS } from '@cryptoart/stp/config/contracts';
   ```

3. **Process events** in the indexing loop:
   ```typescript
   if (isStpContract(event.address)) {
     await processStpEvent(event);
   }
   ```

4. **Add ABIs** to chain-indexer's ABI map:
   ```typescript
   import { STPV2ABI } from '@cryptoart/stp';
   ```

The design keeps STP indexing modular without requiring changes to chain-indexer's core logic.

### Tracked Events

- **Transfer** - Ownership changes
- **Purchase** - Mints and renewals
- **Refund** - Subscription cancellations
- **Grant/GrantRevoke** - Creator-granted time
- **SwitchTier** - Tier migrations
- **TierCreated/TierUpdated** - Tier management
- **Deployment** (Factory) - New STP contract registrations

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

Current test coverage:
- ✅ `isSubscriptionActive()` - Active/expired logic
- ✅ `getRemainingTime()` - Time calculations

## Architecture Decisions

### 1. Modular Event Handling
STP event processing is completely separate from chain-indexer core. This allows:
- Adding/removing STP without touching chain-indexer
- Independent testing and deployment
- Different indexing cadence if needed (STP could poll more frequently)

### 2. Placeholder Addresses
Since contracts aren't deployed, all addresses come from env vars with `0x0000...` fallbacks. This:
- Prevents accidental production use before deployment
- Makes it clear which values need configuration
- Allows local testing with Max's local deployments

### 3. Multi-Chain Support
All DB tables include `chain_id` for Base + Ethereum support. The contracts.ts config makes it easy to add chains.

### 4. Entitlement-First Design
The `hasPerk()` API works with both FID and address, making it easy to gate features at API/UI boundaries without manual lookups.

### 5. No App Imports
This package has zero imports from apps/social or apps/studio, keeping it truly parked. Apps import from this package when ready, never vice versa.

## Open Questions

### 1. Factory Deployment
**Question**: Is Fabric's official STPv2 factory already deployed on Base and Ethereum? Could we use that instead of deploying Max's fork?

**Context**: Max's repo (mxjxn/stp-v2) appears to be a fork of Fabric's protocol. If Fabric has official factories on mainnet, we could point to those addresses and avoid deploying our own infrastructure.

**Impact**: Would simplify deployment and leverage Fabric's existing infrastructure.

---

### 2. App Membership Pricing
**Question**: What should the pricing structure be for the app-level cryptoart.social membership?

**Options**:
- Monthly ($5-10/month in ETH or USDC?)
- Annual (discounted yearly rate?)
- Free trial period?
- Different tiers (basic/pro)?

**Context**: This determines the tier configuration when deploying the app membership STP.

---

### 3. Perk Expansion
**Question**: What other perks should we add beyond custom gallery URIs and profile customization?

**Ideas**:
- Early access to new features
- Featured artist placement
- Analytics dashboard
- API access
- Custom themes/branding
- Priority support

**Context**: Easy to add more `AppPerk` enum values and enable them via the database.

---

### 4. Airdrop Integration Timing
**Question**: When will the multi-recipient airdrop feature be ready in SuchCollection?

**Context**: The airdrop query functions (`getActiveSubscribers`, `getAllStpHolders`) are built to feed that feature. Need to coordinate integration once both PRs merge.

---

### 5. Cross-Contract Perks
**Question**: Should holding *any* STP from *any* artist grant basic perks?

**Context**: Currently, only the app-level STP grants perks. We could also check for subscriptions to any tracked STP contract to reward supporters of any artist on the platform.

**Example**: If you subscribe to any 3 artists, you get profile customization unlocked.

---

### 6. Backfilling Existing Subscriptions
**Question**: If Fabric already has STP contracts on mainnet, do we need to backfill their event history?

**Context**: Our event handlers start from the configured `startBlock`. If there are existing STP contracts with history, we'd need to index from their deploy block to current.

---

## Files

```
packages/stp/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md (this file)
└── src/
    ├── index.ts                          # Main exports
    ├── abis/
    │   ├── STPV2.ts                     # STP contract ABI
    │   └── STPV2Factory.ts              # Factory ABI
    ├── types/
    │   └── index.ts                      # TypeScript types
    ├── config/
    │   └── contracts.ts                  # Contract addresses (placeholders)
    ├── utils/
    │   ├── viem-helpers.ts              # Read/write helpers
    │   └── viem-helpers.test.ts         # Tests
    ├── queries/
    │   ├── entitlements.ts              # hasPerk() and friends
    │   └── airdrop-recipients.ts        # Airdrop queries
    └── handlers/
        └── event-handlers.ts             # Event processing

packages/db/
└── migrations/
    └── 0026_add_stp_tables.sql          # DB schema
```

## Contract Source

ABIs and events are extracted from Max's STP v2 contracts:
- https://github.com/mxjxn/stp-v2
- Main contract: `src/STPV2.sol`
- Factory: `src/STPV2Factory.sol`

## Future Work (When Unparking)

1. **Deploy Contracts**: Factory + app membership STP on Base and Ethereum
2. **Set Real Addresses**: Update env vars with deployed addresses
3. **Wire Entitlements**: Import `hasPerk()` in apps/social permission checks
4. **Wire Airdrop UI**: Import airdrop queries in apps/studio
5. **Enable Indexing**: Add to chain-indexer config per integration instructions
6. **Run Migration**: Apply `0026_add_stp_tables.sql` to production DB
7. **Artist Onboarding**: UI flow for artists to deploy their own STP contracts
8. **Membership Paywall**: Gate app perks behind `hasPerk()` checks

## Related PRs

- [#199 - Chain Indexer](https://github.com/mxjxn/cryptoart-studio/pull/199) - Event indexing pattern that STP follows
- (TBD) - Multi-recipient airdrop in SuchCollection
- (TBD) - Social features (custom galleries, profiles)

## Deployment Workflow

Since Max deploys contracts locally:

1. Max deploys STP factory and app membership contract
2. Max provides addresses and deploy blocks
3. Update `src/config/contracts.ts` with real values
4. Set env vars in Vercel/production
5. Run DB migration
6. Enable event handler in chain-indexer
7. Backfill historical events if needed
8. Feature is live

**Note**: This package handles **only** the integration layer. It never deploys contracts or handles private keys.

---

Built for the cryptoart.social relaunch. Parked until post-launch.
