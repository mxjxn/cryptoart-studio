# CryptoArt Studio App - Developer Guide

## Overview

The CryptoArt Studio App is a Farcaster Mini App built with Next.js 15, TypeScript, and React 19. It serves as a creator studio toolbox for managing crypto art communities, subscriptions, and airdrops. The app integrates with Neynar for Farcaster functionality, Alchemy for blockchain data, and includes comprehensive wallet integration.

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **UI**: React 19 with Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **Blockchain**: Wagmi + Viem for Ethereum, Solana wallet adapter
- **Authentication**: Farcaster Auth + Neynar SDK
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Upstash Redis
- **Deployment**: Vercel

### Key Integrations
- **Neynar**: Farcaster API, user management, notifications
- **Alchemy**: NFT data, blockchain analytics
- **Farcaster**: Mini app framework, wallet integration
- **Base Network**: Primary blockchain for transactions

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── share/             # Share pages
│   ├── subscribers/       # Subscriber management
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # App providers
├── components/            # React components
│   ├── providers/         # Context providers
│   └── ui/               # UI components
├── hooks/                 # Custom React hooks
└── lib/                   # Utility libraries
```

## Core Components

### 1. App Structure (`src/components/App.tsx`)

The main App component orchestrates the entire mini app experience:

```typescript
// Key features:
- Tab-based navigation (Home, Actions, Context, Wallet)
- Farcaster mini app integration
- Wallet connection management
- Error handling and loading states
- Safe area insets for mobile
```

**Tabs Available:**
- **Home**: Main dashboard and overview
- **Actions**: Creator tools and actions
- **Context**: User context and data
- **Wallet**: Wallet management and transactions

### 2. UI Components (`src/components/ui/`)

Organized by functionality:

- **Core UI**: `Button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`
- **Layout**: `Header.tsx`, `Footer.tsx`, `MobileLayout.tsx`
- **Dashboard**: `DashboardLayout.tsx`, `SubscriberModal.tsx`
- **Tabs**: Individual tab components in `tabs/` directory
- **Wallet**: Wallet-specific components in `wallet/` directory

### 3. API Routes (`src/app/api/`)

RESTful API structure following Next.js conventions:

```
api/
├── auth/                  # Authentication endpoints
├── data/                  # Data querying endpoints
├── airdrop/              # Airdrop functionality
├── lists/                # List management
├── subscribers/          # Subscriber management
├── sync/                 # Data synchronization
└── webhook/              # Webhook handlers
```

**Key API Categories:**
- **Authentication**: Farcaster auth, session management
- **Data Queries**: Bulk data fetching, channel activity, NFT holders
- **Creator Tools**: Airdrop execution, list management
- **Subscriptions**: Hypersub integration, subscriber sync

## Library Utilities (`src/lib/`)

### Core Libraries

1. **`neynar.ts`**: Neynar API client and user management
2. **`auth.ts`**: CryptoArt membership validation
3. **`airdrop.ts`**: Batch airdrop execution on Base
4. **`alchemy.ts`**: NFT data and blockchain analytics
5. **`constants.ts`**: App configuration and constants

### Key Features

#### Authentication & Membership
```typescript
// Validate CryptoArt Hypersub membership
const isValid = await validateCryptoArtMembership(fid);

// Middleware for API protection
const { valid, error } = await validateMembershipMiddleware(fid);
```

#### Airdrop System
```typescript
// Execute batch airdrop
const result = await executeAirdrop({
  tokenAddress: '0x...',
  recipients: ['0x...', '0x...'],
  amounts: ['1000000', '2000000']
});

// Estimate gas costs
const gasEstimate = await estimateAirdropGas(params);
```

#### NFT Integration
```typescript
// Get NFTs by contract
const nfts = await getNFTsByContract(walletAddress, contractAddress);

// Check multiple contract ownership
const ownership = await checkMultipleContractOwnership(
  walletAddress, 
  contractAddresses
);
```

## Environment Configuration

**📚 See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for complete documentation.**

### Quick Reference

The app uses **two database systems**:

1. **PostgreSQL** (`@repo/db`) - Persistent data & caching
   - NFT collections, airdrops, auction listings
   - Hypersub subscription/subscriber caching
   - Requires: `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`

2. **Redis/KV** (`@upstash/redis`) - Session & notifications
   - Farcaster notification tokens
   - Optional: Falls back to in-memory if not configured
   - Requires: `KV_REST_API_URL`, `KV_REST_API_TOKEN`

### Minimum Required Variables

```bash
# Neynar (Required)
NEYNAR_API_KEY=your_neynar_api_key
NEYNAR_CLIENT_ID=your_neynar_client_id

# App (Required)
NEXT_PUBLIC_URL=http://localhost:3000

# PostgreSQL (Required for Studio features)
POSTGRES_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...

# Blockchain (Required for Studio)
ALCHEMY_API_KEY=your_alchemy_api_key
CRYPTOART_HYPERSUB_CONTRACT=0x...
```

See `ENVIRONMENT_SETUP.md` for complete list and setup instructions.

## Development Workflow

### Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Configure your environment variables
   ```

3. **Development Server**
   ```bash
   npm run dev          # Local development
   npm run dev:tunnel   # With tunneling for mobile testing
   npm run dev:local    # Force local mode
   ```

### Testing with Farcaster

1. **Desktop Testing**
   - Run `npm run dev`
   - Open [Warpcast Developer Tools](https://warpcast.com/~/developers)
   - Enter `http://localhost:3000`

2. **Mobile Testing**
   - Set `USE_TUNNEL=true` in `.env.local`
   - Run `npm run dev`
   - Follow localtunnel instructions
   - Use tunnel URL in Warpcast mobile app

### Building and Deployment

```bash
# Production build
npm run build

# Deploy to Vercel
npm run deploy:vercel

# Manual Vercel deployment
npm run deploy:raw
```

## API Development Patterns

### 1. Route Structure
Each API route follows Next.js App Router conventions:

```typescript
// app/api/example/route.ts
export async function GET(request: Request) {
  // Handle GET requests
}

export async function POST(request: Request) {
  // Handle POST requests
}
```

### 2. Authentication Middleware
Most protected routes use membership validation:

```typescript
import { validateMembershipMiddleware } from '~/lib/auth';

export async function GET(request: Request) {
  const fid = getFidFromRequest(request);
  const { valid, error } = await validateMembershipMiddleware(fid);
  
  if (!valid) {
    return Response.json({ error }, { status: 401 });
  }
  
  // Protected logic here
}
```

### 3. Error Handling
Consistent error handling pattern:

```typescript
try {
  // API logic
  return Response.json({ success: true, data });
} catch (error) {
  console.error('API Error:', error);
  return Response.json(
    { error: 'Internal server error' }, 
    { status: 500 }
  );
}
```

## Component Development Patterns

### 1. Tab Components
Each tab follows a consistent structure:

```typescript
export default function ExampleTab() {
  const { context } = useMiniApp();
  const { user } = useNeynarUser(context);
  
  return (
    <div className="space-y-4">
      {/* Tab content */}
    </div>
  );
}
```

### 2. UI Components
Components use Tailwind CSS with consistent patterns:

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children }: ButtonProps) {
  return (
    <button className={cn(
      'rounded-lg font-medium transition-colors',
      variants[variant],
      sizes[size]
    )}>
      {children}
    </button>
  );
}
```

## Database Schema

The app uses Drizzle ORM with PostgreSQL. Key tables include:

- **Users**: Farcaster user data
- **Subscriptions**: Hypersub membership data
- **Lists**: Creator lists and recipients
- **Airdrops**: Airdrop history and status
- **Cache**: Redis-backed caching layer

## Caching Strategy

- **Redis**: Upstash Redis for session data and API caching
- **Database**: PostgreSQL for persistent data
- **Client**: React Query for client-side caching

## Security Considerations

1. **Authentication**: Farcaster-based authentication with Neynar validation
2. **Membership**: CryptoArt Hypersub membership required for most features
3. **API Keys**: Environment-based configuration
4. **Rate Limiting**: Built into Neynar and Alchemy clients
5. **Input Validation**: Zod schemas for API validation

## Performance Optimization

1. **Code Splitting**: Next.js automatic code splitting
2. **Image Optimization**: Next.js Image component
3. **Caching**: Multi-layer caching strategy
4. **Bundle Size**: Tree shaking and dynamic imports
5. **Database**: Optimized queries with Drizzle ORM

## Common Development Tasks

### Adding a New API Route

1. Create route file: `src/app/api/new-feature/route.ts`
2. Implement HTTP methods (GET, POST, etc.)
3. Add authentication if needed
4. Add error handling
5. Test with API client

### Adding a New Tab

1. Create component: `src/components/ui/tabs/NewTab.tsx`
2. Add to tabs index: `src/components/ui/tabs/index.ts`
3. Update App.tsx to include new tab
4. Add navigation in Footer.tsx

### Adding New Library Utility

1. Create file: `src/lib/new-utility.ts`
2. Export functions with proper TypeScript types
3. Add error handling
4. Document with JSDoc comments
5. Add to constants if configuration needed

## Troubleshooting

### Common Issues

1. **SDK Loading**: Ensure Farcaster SDK is properly initialized
2. **Authentication**: Check Neynar API key configuration
3. **Database**: Verify PostgreSQL connection and schema
4. **Tunneling**: Ensure localtunnel setup for mobile testing
5. **Environment**: Check all required environment variables

### Debug Tools

- **Console Logs**: Comprehensive logging throughout the app
- **Network Tab**: Monitor API requests and responses
- **React DevTools**: Component state and props inspection
- **Database**: Direct database queries for debugging

## Contributing Guidelines

1. **Code Style**: Follow existing patterns and TypeScript best practices
2. **Testing**: Test on both desktop and mobile Farcaster clients
3. **Documentation**: Update this guide when adding new features
4. **Error Handling**: Always include proper error handling
5. **Performance**: Consider performance impact of new features

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Farcaster Mini Apps](https://docs.farcaster.xyz/mini-apps)
- [Neynar API Documentation](https://docs.neynar.com/)
- [Alchemy SDK](https://docs.alchemy.com/reference/alchemy-sdk-quickstart)
- [Wagmi Documentation](https://wagmi.sh/)

---

This guide should help developers understand the codebase structure and contribute effectively to the CryptoArt Studio App. For specific implementation details, refer to the individual component and library files.
