# Auctionhouse Contracts Documentation Site

A comprehensive documentation site for the Auctionhouse Contracts, built with Next.js and styled to match the terminal aesthetic of the LSSVM documentation site.

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
- `components/` - Reusable React components
- `contexts/` - React contexts (ColorScheme)
- `lib/` - Utility functions (markdown loading, color scheme)
- `app/globals.css` - Global styles with terminal aesthetic
- `tailwind.config.ts` - Tailwind CSS configuration

## Documentation Pages

- `/` - Home page with overview and quick links
- `/getting-started` - Getting started guide (from README.md)
- `/capabilities` - Comprehensive capabilities documentation (from CAPABILITIES.md)
- `/integration` - Integration guide (from INTEGRATION_GUIDE.md)
- `/deployment` - Deployment guide (from DEPLOYMENT.md)
- `/examples` - Example contracts and use cases (from src/examples/)

## Markdown Files

The documentation site reads markdown files from `../../packages/auctionhouse-contracts/`:

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

## Attribution

- Original auctionhouse contracts by [Manifold Gallery](https://gallery.manifold.xyz)
- Documentation site styled after [LSSVM docs](https://github.com/mxjxn/such-lssvm)
- Enhanced for the [Cryptoart](https://warpcast.com/~/channel/cryptoart) channel on Farcaster

