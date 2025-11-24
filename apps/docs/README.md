# CryptoArt Studio Documentation Site

A comprehensive documentation site for CryptoArt Studio tools and smart contracts, built with Next.js and styled with a terminal aesthetic.

## Features

- **Terminal Aesthetic**: Monospace fonts, no rounded corners, border-based design
- **Dynamic Color Scheme**: Hue slider to customize the color palette
- **Light/Dark Theme**: Toggle between light and dark modes
- **Markdown Rendering**: Full markdown support for documentation pages
- **Responsive Design**: Mobile-friendly navigation and layout

## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

The site will be available at `http://localhost:3002`

### Build

```bash
pnpm build
```

This generates a static export in the `out/` directory.

## Structure

- `app/` - Next.js app router pages
  - `app/page.tsx` - Root page with monorepo overview
  - `app/auctionhouse/` - Auctionhouse contracts documentation
- `components/` - Reusable React components
- `contexts/` - React contexts (ColorScheme)
- `lib/` - Utility functions (markdown loading, color scheme)
- `app/globals.css` - Global styles with terminal aesthetic
- `tailwind.config.ts` - Tailwind CSS configuration

## Documentation Pages

### Root
- `/` - Home page with overview of all tools

### Auctionhouse Contracts
- `/auctionhouse` - Auctionhouse home page
- `/auctionhouse/getting-started` - Getting started guide (from README.md)
- `/auctionhouse/capabilities` - Comprehensive capabilities documentation (from CAPABILITIES.md)
- `/auctionhouse/integration` - Integration guide (from INTEGRATION_GUIDE.md)
- `/auctionhouse/deployment` - Deployment guide (from DEPLOYMENT.md)
- `/auctionhouse/examples` - Example contracts and use cases (from src/examples/)

## Markdown Files

The auctionhouse documentation reads markdown files from `../../packages/auctionhouse-contracts/`:

- `README.md` - Getting started page
- `CAPABILITIES.md` - Capabilities page
- `INTEGRATION_GUIDE.md` - Integration page
- `DEPLOYMENT.md` - Deployment page
- `src/examples/README.md` - Examples page
- `src/examples/ART_EXAMPLES.md` - Art examples

## Color Scheme

The site uses a dynamic color scheme system that:
- Generates colors based on a base hue (0-360°)
- Supports light and dark themes
- Persists user preferences in localStorage
- Updates CSS variables dynamically

## Deployment

The site is automatically deployed to GitHub Pages at `https://mxjxn.github.io/cryptoart-studio/` when changes are pushed to the main branch.

## Attribution

- Original auctionhouse contracts by [Manifold Gallery](https://gallery.manifold.xyz)
- Documentation site styled after [LSSVM docs](https://github.com/mxjxn/such-lssvm)
- Built for the [Cryptoart](https://warpcast.com/~/channel/cryptoart) channel on Farcaster
