# Forecaster - STP v2 Subscriptions on Farcaster

A Farcaster mini-app for creating and managing subscription NFTs using STP v2 smart contracts.

## Features

### For Creators
- **Deploy Subscription Contracts** - Launch your subscription NFT collection in minutes
- **Multi-Tier Subscriptions** - Create different subscription levels with custom pricing
- **Reward System** - Share revenue with loyal subscribers through reward pools
- **Creator Dashboard** - Manage subscribers, tiers, and funds
- **Referral Program** - Set up referral codes to incentivize growth

### For Subscribers
- **Browse Creators** - Discover subscription offerings from your favorite creators
- **Subscribe with Rewards** - Earn reward shares from subscription payments
- **Manage Subscriptions** - View and renew your subscriptions
- **Claim Rewards** - Collect accumulated rewards from the reward pool

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Wallet with Base network access

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Add your contract addresses to .env
# NEXT_PUBLIC_STPV2_FACTORY_ADDRESS=0x...
# NEXT_PUBLIC_STPV2_IMPLEMENTATION_ADDRESS=0x...

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
forecaster/
├── src/
│   ├── app/
│   │   ├── creator/
│   │   │   ├── deploy/       # Creator deployment flow
│   │   │   └── dashboard/    # Creator dashboard
│   │   ├── subscribe/         # Customer subscription flow
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   └── ui/                # Reusable UI components
│   ├── lib/
│   │   ├── contracts/         # Contract ABIs
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   └── hooks/                 # Custom React hooks
├── public/
├── package.json
└── README.md
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Blockchain**: wagmi + viem
- **Farcaster**: @farcaster/miniapp-sdk
- **UI Components**: Radix UI
- **State Management**: TanStack Query

## Deployment

### Deploy to Vercel

```bash
pnpm build
vercel --prod
```

### Environment Variables

Make sure to set these in your deployment platform:

- `NEXT_PUBLIC_STPV2_FACTORY_ADDRESS` - STP v2 Factory contract address
- `NEXT_PUBLIC_STPV2_IMPLEMENTATION_ADDRESS` - STP v2 Implementation contract address
- `NEXT_PUBLIC_RPC_URL` - RPC endpoint for Base network

## STP v2 Integration

This app integrates with the STP v2 (Subscription Token Protocol v2) smart contracts. See the [STP v2 documentation](../../packages/stp-v2/DOCS.md) for:

- Contract architecture
- Deployment guides
- Integration patterns
- Event indexing

## Development

### Running Tests

```bash
pnpm test
```

### Linting

```bash
pnpm lint
```

### Building

```bash
pnpm build
```

## Features Roadmap

- [x] Creator deployment flow
- [ ] Customer subscription flow
- [ ] Creator dashboard with analytics
- [ ] Subscriber rewards dashboard
- [ ] Referral code management
- [ ] Multi-tier subscription management
- [ ] Subscription notifications via Farcaster
- [ ] Token-gating integration
- [ ] Subscription analytics

## Contributing

This is a prototype application. Contributions, issues, and feature requests are welcome!

## License

MIT

## Resources

- [STP v2 Smart Contracts](../../packages/stp-v2)
- [Farcaster Documentation](https://docs.farcaster.xyz/)
- [wagmi Documentation](https://wagmi.sh/)
- [Next.js Documentation](https://nextjs.org/docs)
