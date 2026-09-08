# Farcaster web source provenance

Imported from `/Users/maxjackson/workspace/farcaster-client`, commit `b6922e2` (Farcaster client snapshot).

`web/` is the actual `apps/farcaster-web` source. `packages/` holds its web dependencies; Expo and the mobile application are excluded. Upstream license is preserved in `LICENSE`.

This nested pnpm workspace isolates upstream React 19 / Wagmi 3 / Tailwind 4 from the auctionhouse workspace overrides. Turbo discovers the `social` wrapper. Source packages are consumed directly by Vite.

The full upstream web surface is retained for incremental adaptation; it is not yet a production Cryptoart client. Imported authentication and secondary routes retain upstream backend assumptions.
