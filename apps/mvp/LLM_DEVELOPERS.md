# LLM Developer Guide for Cryptoart.social MVP

This document provides comprehensive technical guidance for LLMs assisting with development tasks, debugging, and implementation in the cryptoart.social MVP application.

## Quick Reference

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS
- **Blockchain**: Wagmi v2, Viem v2
- **Farcaster**: @neynar/react, @farcaster/miniapp-sdk
- **Data Fetching**: @tanstack/react-query, graphql-request
- **Database**: PostgreSQL (optional, for caching)
- **Deployment**: Vercel

### Key File Locations
- **App Entry**: `src/app/page.tsx`
- **Layout**: `src/app/layout.tsx`
- **Constants**: `src/lib/constants.ts`
- **Types**: `src/lib/types.ts`
- **Contracts**: `src/lib/contracts/marketplace.ts`
- **Subgraph**: `src/lib/subgraph.ts`
- **API Routes**: `src/app/api/**/route.ts`
- **Components**: `src/components/`
- **Hooks**: `src/hooks/`
- **Server Utils**: `src/lib/server/`

### Common Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Environment Variables
```bash
NEXT_PUBLIC_URL                      # App URL (required)
NEXT_PUBLIC_MARKETPLACE_ADDRESS      # Marketplace contract address
NEXT_PUBLIC_CHAIN_ID                 # Chain ID (default: 8453)
NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL # Subgraph endpoint
NEYNAR_API_KEY                       # Neynar API key (optional)
STORAGE_POSTGRES_URL                 # PostgreSQL connection (optional)
POSTGRES_URL                          # Alternative PostgreSQL env var
```

---

## Detailed Sections

### Architecture Overview

#### Next.js App Router Structure

The application uses Next.js 15 with the App Router pattern:

```
src/app/
├── page.tsx                    # Homepage (server component)
├── layout.tsx                  # Root layout
├── providers.tsx               # React Query & other providers
├── api/                       # API routes (Next.js route handlers)
│   ├── auctions/              # Auction-related endpoints
│   ├── notifications/         # Notification endpoints
│   ├── user/                  # User profile endpoints
│   └── ...
├── create/                    # Create auction page
├── auction/[listingId]/       # Auction detail page
├── profile/                   # User profile page
└── ...
```

#### Data Flow

1. **Server Components** (page.tsx, layout.tsx)
   - Fetch initial data server-side
   - Pass to client components as props
   - Enable SEO and fast initial load

2. **Client Components** (*Client.tsx files)
   - Handle interactivity
   - Fetch additional data client-side
   - Manage UI state

3. **API Routes** (src/app/api/**/route.ts)
   - Server-side data fetching
   - Subgraph queries
   - Database operations
   - External API calls (Neynar, etc.)

4. **Hooks** (src/hooks/)
   - Reusable data fetching logic
   - Wallet integration
   - Contract interactions

#### Key Patterns

**Server-Side Data Fetching**:
```typescript
// In page.tsx (server component)
export default async function Home() {
  const initialAuctions = await getCachedActiveAuctions(16, 0, true);
  return <HomePageClient initialAuctions={initialAuctions} />;
}
```

**Client-Side Data Fetching**:
```typescript
// In Client component
const { data, isLoading } = useQuery({
  queryKey: ['auction', listingId],
  queryFn: () => getAuction(listingId),
});
```

**API Route Pattern**:
```typescript
// src/app/api/auctions/active/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // ... fetch data
  return NextResponse.json({ auctions });
}
```

### Key Components & Patterns

#### Component Structure

**Page Components**:
- Server components (`page.tsx`) for initial data fetching
- Client components (`*Client.tsx`) for interactivity
- Separation enables optimal performance

**Reusable Components** (`src/components/`):
- `AuctionCard.tsx` - Display auction preview
- `ProfileDropdown.tsx` - User menu
- `TransactionStatus.tsx` - Transaction feedback
- `FavoriteButton.tsx` - Favorite/unfavorite functionality
- `FollowButton.tsx` - Follow/unfollow users

**Provider Components**:
- `WagmiProvider.tsx` - Wallet connection
- `Providers.tsx` - React Query and other providers

#### Component Patterns

**Transition Links**:
```typescript
import { TransitionLink } from "~/components/TransitionLink";

<TransitionLink href="/auction/123">
  View Auction
</TransitionLink>
```

**Wallet Integration**:
```typescript
import { useAccount, useWriteContract } from "wagmi";
import { useMiniApp } from "@neynar/react";

const { address } = useAccount();
const { writeContract } = useWriteContract();
const { actions } = useMiniApp();
```

**Data Fetching with React Query**:
```typescript
import { useQuery } from "@tanstack/react-query";

const { data, isLoading, error } = useQuery({
  queryKey: ['auctions', 'active'],
  queryFn: () => getActiveAuctions({ first: 16 }),
});
```

### API Routes & Endpoints

#### Auction Endpoints

**GET /api/auctions/active**
- Fetch active auctions
- Query params: `first`, `skip`, `enrich`, `cache`
- Returns: `{ auctions: EnrichedAuctionData[], count: number }`

**GET /api/auctions/[listingId]**
- Fetch single auction by listing ID
- Returns: `{ auction: EnrichedAuctionData }`

**GET /api/auctions/by-seller/[address]**
- Fetch auctions created by seller
- Query params: `first`, `skip`
- Returns: `{ auctions: AuctionData[] }`

**GET /api/auctions/with-bids/[address]**
- Fetch auctions where user has bids
- Returns: `{ auctions: AuctionData[] }`

**GET /api/auctions/with-offers/[address]**
- Fetch auctions where user has offers
- Returns: `{ auctions: AuctionData[] }`

#### User Endpoints

**GET /api/user/[fname]**
- Fetch user profile data
- Resolves Farcaster username to address
- Returns: User data, listings, purchases, artworks

**GET /api/users/recent-artists**
- Fetch recently active artists
- Query params: `first`
- Returns: `{ artists: UserData[] }`

**GET /api/users/recent-bidders**
- Fetch recently active bidders
- Returns: `{ bidders: UserData[] }`

**GET /api/users/recent-collectors**
- Fetch recently active collectors
- Returns: `{ collectors: UserData[] }`

#### Notification Endpoints

**GET /api/notifications**
- Fetch user notifications
- Query params: `userAddress`, `limit`, `offset`, `unreadOnly`
- Returns: `{ notifications: Notification[], total: number }`

**POST /api/notifications/create**
- Create a notification
- Body: `{ userAddress, type, title, message, fid, listingId, metadata }`

**GET /api/notifications/unread-count**
- Get unread notification count
- Query params: `userAddress`

#### Other Endpoints

**GET /api/artist/[address]**
- Resolve artist name from address
- Returns: `{ name: string | null, source: string }`

**GET /api/contract-creator/[address]**
- Get contract creator address
- Returns: `{ creator: string | null }`

**POST /api/favorite**
- Add favorite listing
- Body: `{ userAddress, listingId }`

**DELETE /api/favorite**
- Remove favorite listing

**GET /api/favorites/listings**
- Get user's favorite listings
- Query params: `userAddress`

### Integration Points

#### Auctionhouse Contracts

**Contract Address**:
- Stored in: `src/lib/contracts/marketplace.ts`
- Environment variable: `NEXT_PUBLIC_MARKETPLACE_ADDRESS`
- Default: `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9` (Base Mainnet)

**Contract ABI**:
- Defined in: `src/lib/contracts/marketplace.ts`
- Key functions: `createListing`, `bid`, `purchase`, `offer`, `finalize`, `cancel`

**Usage Pattern**:
```typescript
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";
import { useWriteContract } from "wagmi";

const { writeContract } = useWriteContract();

writeContract({
  address: MARKETPLACE_ADDRESS,
  abi: MARKETPLACE_ABI,
  functionName: "bid",
  args: [listingId, true], // listingId, increase
  value: bidAmount,
});
```

#### Subgraph Integration

**Subgraph Endpoint**:
- Environment variable: `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL`
- Used for all auction data queries

**Query Functions** (`src/lib/subgraph.ts`):
- `getActiveAuctions()` - Client-side active auctions
- `getAuction(listingId)` - Single auction
- `getAuctionsBySeller(address)` - Seller's auctions
- `getAuctionsWithBids(address)` - User's bid auctions
- `getAuctionsWithOffers(address)` - User's offer auctions

**Server-Side Queries** (`src/lib/server/auction.ts`):
- `getCachedActiveAuctions()` - Cached active auctions
- `fetchActiveAuctionsUncached()` - Fresh data
- `getAuctionServer()` - Server-side single auction

**GraphQL Queries**:
- Defined in server files
- Use `graphql-request` library
- Headers for authentication if needed

#### Neynar Integration

**Purpose**: Farcaster user data and social features

**API Key**: `NEYNAR_API_KEY` (optional, improves performance)

**Usage**:
```typescript
import { lookupNeynarByAddress } from "~/lib/artist-name-resolution";

const userData = await lookupNeynarByAddress(address);
// Returns: { username, displayName, pfpUrl, ... }
```

**Endpoints Used**:
- User lookup by address
- FID resolution
- Profile data fetching

**Caching**: User data cached in PostgreSQL if available

#### Database Integration (Optional)

**Purpose**: Cache user data and improve performance

**Connection**: `STORAGE_POSTGRES_URL` or `POSTGRES_URL`

**Tables** (from `@cryptoart/db` package):
- `userCache` - Cached Farcaster user data
- `contractCache` - Cached contract information
- `notifications` - User notifications

**Usage**:
```typescript
import { getDatabase } from "~/lib/server/user-cache";

const db = getDatabase();
const users = await db.select().from(userCache).where(...);
```

**Note**: App works without database, but caching improves performance

### Development Workflow

#### Setting Up Development Environment

1. **Install Dependencies**:
```bash
npm install
```

2. **Environment Variables**:
Create `.env.local`:
```bash
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/...
NEYNAR_API_KEY=your_key_here  # Optional
STORAGE_POSTGRES_URL=postgresql://...  # Optional
```

3. **Start Development Server**:
```bash
npm run dev
```

#### Code Organization

**File Naming Conventions**:
- Pages: `page.tsx` (server), `*Client.tsx` (client)
- Components: `PascalCase.tsx`
- Hooks: `use*.ts`
- Utils: `kebab-case.ts`
- Types: `types.ts` or co-located with components

**Import Paths**:
- Use `~/` alias for `src/` directory
- Example: `import { APP_NAME } from "~/lib/constants"`

**Type Safety**:
- All components typed with TypeScript
- Types defined in `src/lib/types.ts`
- Contract types from ABI definitions

#### Testing & Debugging

**Console Logging**:
- Use descriptive prefixes: `[ComponentName]`, `[API Route]`
- Log important state changes
- Include relevant data in logs

**Error Handling**:
```typescript
try {
  const data = await fetchData();
} catch (error) {
  console.error('[ComponentName] Error:', error);
  // Handle error gracefully
}
```

**React Query DevTools**:
- Available in development
- Inspect query states
- Monitor cache behavior

**Browser DevTools**:
- Network tab for API calls
- React DevTools for component tree
- Wagmi DevTools for wallet state

### Common Implementation Examples

#### Creating an Auction

```typescript
import { useWriteContract } from "wagmi";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";
import { parseEther } from "viem";

const { writeContract } = useWriteContract();

const createListing = async () => {
  const listingDetails = {
    initialAmount: parseEther("0.1"), // Reserve price
    type_: 0, // INDIVIDUAL_AUCTION
    totalAvailable: 1,
    totalPerSale: 1,
    extensionInterval: 300, // 5 minutes
    minIncrementBPS: 500, // 5%
    erc20: "0x0000000000000000000000000000000000000000", // ETH
    identityVerifier: "0x0000000000000000000000000000000000000000",
    startTime: Math.floor(Date.now() / 1000),
    endTime: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };

  const tokenDetails = {
    id: tokenId,
    address_: tokenAddress,
    spec: 0, // ERC721
    lazy: false,
  };

  writeContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "createListing",
    args: [
      listingDetails,
      tokenDetails,
      { deliverBPS: 0, deliverFixed: 0 }, // Delivery fees
      [], // Receivers
      false, // Enable referrer
      false, // Accept offers
      "0x", // Data
    ],
  });
};
```

#### Placing a Bid

```typescript
import { useWriteContract } from "wagmi";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";
import { parseEther } from "viem";

const { writeContract } = useWriteContract();

const placeBid = async (listingId: string, bidAmount: string) => {
  writeContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "bid",
    args: [parseInt(listingId), true], // listingId, increase
    value: parseEther(bidAmount),
  });
};
```

#### Fetching Auction Data

```typescript
import { useQuery } from "@tanstack/react-query";
import { getAuction } from "~/lib/subgraph";

const { data: auction, isLoading } = useQuery({
  queryKey: ['auction', listingId],
  queryFn: () => getAuction(listingId),
  enabled: !!listingId,
});
```

#### Using Wallet Connection

```typescript
import { useAccount, useConnect } from "wagmi";
import { useMiniApp } from "@neynar/react";

const { address, isConnected } = useAccount();
const { connect } = useConnect();
const { actions } = useMiniApp();

// Connect wallet
if (!isConnected) {
  connect({ connector: actions.getEthereumProvider() });
}
```

### Deployment Process

#### Vercel Deployment

1. **Connect Repository** to Vercel
2. **Set Environment Variables** in Vercel dashboard
3. **Deploy**: Automatic on push to main branch

#### Environment Variables for Production

Required:
- `NEXT_PUBLIC_URL` - Production URL
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS` - Contract address
- `NEXT_PUBLIC_CHAIN_ID` - Chain ID (8453 for Base)
- `NEXT_PUBLIC_AUCTIONHOUSE_SUBGRAPH_URL` - Subgraph endpoint

Optional:
- `NEYNAR_API_KEY` - For better user data performance
- `STORAGE_POSTGRES_URL` - For caching

#### Build Process

```bash
npm run build
```

**Build Output**:
- `.next/` directory with optimized production build
- Static pages pre-rendered
- API routes compiled
- TypeScript type-checked

#### Post-Deployment

1. **Verify Contract Addresses** are correct
2. **Test Subgraph Queries** are working
3. **Check Environment Variables** are set
4. **Test Wallet Connection** in production
5. **Monitor Error Logs** in Vercel dashboard

### Key Libraries & Dependencies

#### Core Dependencies

- **next**: Framework
- **react**, **react-dom**: UI library
- **typescript**: Type safety
- **tailwindcss**: Styling
- **wagmi**, **viem**: Blockchain interactions
- **@tanstack/react-query**: Data fetching
- **@neynar/react**: Farcaster integration
- **@farcaster/miniapp-sdk**: Farcaster mini-app SDK
- **graphql-request**: GraphQL queries

#### Package Structure

- **@cryptoart/db**: Shared database package (monorepo)
- Local packages referenced via `file:` protocol

### Troubleshooting

#### Common Issues

**"basex is not a function" Error**:
- Fixed in `next.config.ts` with webpack alias
- Related to Farcaster SDK dependencies

**Subgraph Rate Limiting**:
- Use caching (`cache: true` in queries)
- Server-side caching via `getCachedActiveAuctions()`
- Cache duration: 15 minutes for homepage

**Wallet Connection Issues**:
- Ensure Farcaster mini-app context
- Check `useAuthMode()` hook for context detection
- Verify wallet provider is available

**Type Errors**:
- Run `npm run build` to check types
- Ensure all imports use correct paths
- Check `types.ts` for type definitions

**API Route Errors**:
- Check server logs in Vercel
- Verify environment variables
- Test endpoints directly with curl/Postman

### Best Practices

#### Code Quality

1. **Type Safety**: Always use TypeScript types
2. **Error Handling**: Wrap async operations in try/catch
3. **Loading States**: Show loading indicators
4. **Error States**: Display user-friendly error messages
5. **Optimistic Updates**: Update UI before confirmation

#### Performance

1. **Server Components**: Use for initial data fetching
2. **Caching**: Leverage React Query cache
3. **Image Optimization**: Use Next.js Image component
4. **Code Splitting**: Automatic with Next.js
5. **Subgraph Caching**: Use cached queries when possible

#### Security

1. **Environment Variables**: Never commit `.env.local`
2. **Input Validation**: Validate all user inputs
3. **Contract Calls**: Verify addresses and parameters
4. **API Routes**: Validate request data
5. **Wallet Security**: Let users manage their own keys

### Additional Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Wagmi Docs**: https://wagmi.sh
- **React Query Docs**: https://tanstack.com/query
- **Auctionhouse Contracts**: `../../packages/auctionhouse-contracts/CAPABILITIES.md`
- **Subgraph**: Check The Graph Studio for query examples

---

*This document should be updated as the codebase evolves. Last updated: [Current Date]*

