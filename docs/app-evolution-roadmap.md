# apps/mvp Incremental Evolution Roadmap

**Project:** CryptoArt MVP (`apps/mvp`)  
**Status:** Finalized implementation plan  
**Date:** 2026-05-14

---

## Summary

This roadmap keeps all near-term product and platform work in `apps/mvp` and delivers the Farcaster-lite direction in incremental milestones. We are **not** creating a separate app yet because splitting the codebase now would slow delivery, duplicate core logic, and increase integration risk before core feed + marketplace loops are proven.

PWA is intentionally **not first**. We will introduce PWA in the middle-late phase, after feed and marketplace behavior are defined, so install/offline semantics are built around stable user loops instead of shifting requirements.

---

## Guiding Decisions

1. Keep implementation in `apps/mvp` for now.
2. Prioritize core platform capabilities first:
   - minting,
   - collection management,
   - metadata/tag quality,
   - multi-chain consistency.
3. Expand minting and tag infrastructure next, including lazy mint groundwork.
4. Build feed architecture channel-first (Farcaster channels), not event-first timeline.
5. Add marketplace enrichment to casts.
6. Inject relevant on-chain events into channel feed using channel/artist context.
7. Add trust and safety controls before broad launch:
   - trust tiers,
   - spam suppression,
   - curator controls,
   - artist profile signals.
8. Add watching/favorites semantics and notification preferences before taste personalization.
9. Add taste vectors and authority-weighted ranking later, not early.
10. Execute all phases incrementally with measurable checkpoints.

---

## Milestone Plan

### Milestone 1 — Core Platform Foundation (Now)

**Goal:** Hardening base capabilities in `apps/mvp` before feed expansion.

- [ ] Stabilize minting flows and error recovery.
- [ ] Improve collection management UX + data consistency.
- [ ] Raise metadata and tag quality gates.
- [ ] Enforce multi-chain consistency rules for shared entities.

**Exit criteria:** Core mint/collection/metadata/multi-chain paths are stable enough to support broader feed and social features.

### Milestone 2 — Minting + Tag Infrastructure Expansion

**Goal:** Expand catalog quality and minting flexibility.

- [ ] Extend tag taxonomy and normalization pipeline.
- [ ] Add moderation hooks for low-quality or spammy tags.
- [ ] Implement lazy mint groundwork (data model + lifecycle hooks, no broad rollout yet).
- [ ] Validate minting + indexing behavior across supported chains.

**Exit criteria:** Minting/tag infrastructure can support richer feed relevance and future marketplace overlays.

### Milestone 3 — Channel-First Feed and Marketplace Context

**Goal:** Establish Farcaster-lite feed behavior with channel as the primary organizing unit.

- [ ] Build channel-first feed composition based on Farcaster channels.
- [ ] Ensure default feed order is channel-contextual (not generic event-first chronology).
- [ ] Enrich casts with marketplace context (listing/auction/sale metadata).
- [ ] Inject on-chain events into channel feed based on channel and artist context.

**Exit criteria:** Users can follow channel-native conversation while seeing marketplace-aware context and relevant chain activity.

### Milestone 4 — Trust, Curation, and Launch-Readiness Signals

**Goal:** Improve feed quality and safety before broad distribution.

- [ ] Introduce trust tiers for accounts and content sources.
- [ ] Add spam suppression and anti-abuse filters.
- [ ] Add curator controls for channel quality management.
- [ ] Surface artist profile signals that improve trust and discovery.

**Exit criteria:** Feed quality and moderation controls are strong enough for wider rollout.

### Milestone 5 — Engagement Loops + PWA Introduction (Middle-Late)

**Goal:** Add durable user loops and then package the experience for installability.

- [ ] Add watching/favorites semantics for artists, collections, and listings.
- [ ] Add notification preferences tied to watch/favorite behavior.
- [ ] Introduce PWA support (manifest, install UX, caching strategy aligned to proven loops).
- [ ] Validate online/offline/read/write behavior boundaries for marketplace-critical actions.

**Exit criteria:** Product loops are established and PWA layer supports them without rework-heavy assumptions.

### Milestone 6 — Personalization and Advanced Ranking (Later)

**Goal:** Layer in advanced relevance only after trust and engagement primitives are working.

- [ ] Add taste vectors from explicit and implicit user signals.
- [ ] Add authority-weighted ranking controls.
- [ ] Tune ranking to preserve channel intent while improving personalization.
- [ ] Define safeguards against ranking amplification abuse.

**Exit criteria:** Personalization improves relevance without undermining trust, curation, or channel context.

---

## Execution Notes

- This roadmap is designed for **incremental delivery**: each milestone should ship independently behind flags where needed.
- Avoid parallel architecture forks until `apps/mvp` loops are validated in production.
- Revisit the “separate app” decision only after milestones 3–5 prove stable product-market behavior.
