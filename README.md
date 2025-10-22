# CryptoArt Studio 🎨

A comprehensive monorepo for building and managing crypto art projects with Farcaster integration, built with Next.js and TypeScript.

## 🚀 What's Inside

This Turborepo monorepo includes the following packages and applications:

### Applications

- **`cryptoart-studio-app`**: Main Next.js application with Farcaster Mini App integration
  - Built with Next.js 14, TypeScript, and Tailwind CSS
  - Farcaster authentication and wallet integration
  - Dashboard for managing crypto art projects
  - API routes for subscriptions, notifications, and user management
  - Support for both Ethereum and Solana wallets

### Packages

- **`@repo/cache`**: Hypersub caching utilities for efficient data management
- **`@repo/db`**: Database package with Drizzle ORM
  - Database schema and migrations
  - Client setup for database operations
- **`@repo/ui`**: Shared React component library
- **`@repo/eslint-config`**: ESLint configurations for the monorepo
- **`@repo/typescript-config`**: TypeScript configurations used throughout

### Data

- **`data/`**: Sample datasets including `muse-oct-21.csv` for testing and development

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Drizzle ORM
- **Authentication**: Farcaster integration
- **Wallets**: Ethereum & Solana support
- **Monorepo**: Turborepo
- **Package Manager**: pnpm

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- pnpm (recommended package manager)

### Installation

1. Clone the repository:
```bash
git clone git@github.com:mxjxn/cryptoart-studio.git
cd cryptoart-studio
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
# Copy environment template
cp apps/cryptoart-studio-app/.env.example apps/cryptoart-studio-app/.env.local
# Edit the .env.local file with your configuration
```

### Development

To start the development server for all applications:

```bash
# With global turbo installed (recommended)
turbo dev

# Without global turbo
pnpm exec turbo dev
```

To develop a specific application:

```bash
# Develop only the main app
turbo dev --filter=cryptoart-studio-app

# Develop only the docs
turbo dev --filter=docs
```

### Building

To build all applications and packages:

```bash
turbo build
```

To build a specific package:

```bash
turbo build --filter=cryptoart-studio-app
```

## 📱 Features

### Farcaster Integration
- Mini App support for Farcaster ecosystem
- Wallet authentication and signing
- User profile management
- Social features integration

### Multi-Chain Support
- Ethereum wallet integration
- Solana wallet support
- Cross-chain transaction capabilities

### Dashboard
- Project management interface
- Subscription tracking
- User analytics
- Notification system

### API Endpoints
- Authentication (`/api/auth/*`)
- User management (`/api/users`)
- Subscription handling (`/api/sync/*`)
- Webhook support (`/api/webhook`)

## 🏗️ Project Structure

```
cryptoart-studio/
├── apps/
│   ├── cryptoart-studio-app/    # Main Next.js application
│   ├── docs/                    # Documentation site
│   └── web/                     # Additional web app
├── packages/
│   ├── cache/                   # Caching utilities
│   ├── db/                      # Database package
│   ├── ui/                      # Shared UI components
│   ├── eslint-config/           # ESLint configurations
│   └── typescript-config/       # TypeScript configurations
├── data/                        # Sample datasets
└── README.md
```

## 🔧 Scripts

- `pnpm dev` - Start development servers
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm check-types` - Type check all packages

## 🚀 Deployment

The main application is configured for deployment on Vercel:

```bash
cd apps/cryptoart-studio-app
npm run deploy:vercel
```

## 📚 Documentation

- [Farcaster Mini Apps Guide](https://docs.neynar.com/docs/create-farcaster-miniapp-in-60s)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](apps/cryptoart-studio-app/LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/mxjxn/cryptoart-studio)
- [Neynar Documentation](https://docs.neynar.com/)
- [Farcaster Protocol](https://farcaster.xyz/)

---

Built with ❤️ using Next.js, TypeScript, and the Farcaster ecosystem.