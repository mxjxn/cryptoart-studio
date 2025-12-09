# Cryptoart Studio: Sustainability & Growth Strategy

## Overview

This document provides a comprehensive plan for analyzing your Vercel deployment data, understanding your service sustainability, and positioning for growth. Written for first-time analytics analysis.

---

## Part 1: Where to Find Your Data

### 1.1 Vercel Dashboard Analytics

**Location:** https://vercel.com/[your-team]/[project-name]/analytics

**How to Access:**
1. Log into vercel.com
2. Select your project (cryptoart-studio or mvp)
3. Click "Analytics" tab in the top navigation

**What You'll See:**
- **Visitors** - Unique users visiting your site
- **Page Views** - Total pages loaded
- **Top Pages** - Most visited routes
- **Top Referrers** - Where traffic comes from
- **Countries** - Geographic distribution
- **Browsers/Devices** - Technical breakdown

### 1.2 Vercel Usage Dashboard

**Location:** https://vercel.com/[your-team]/~/usage

**Critical Metrics to Track:**
| Metric | Free Tier Limit | Pro Tier Limit | What It Means |
|--------|-----------------|----------------|---------------|
| Bandwidth | 100 GB/month | 1 TB/month | Data transferred to users |
| Serverless Function Invocations | 100K/month | 1M/month | API calls made |
| Serverless Function Duration | 100 GB-hours | 1000 GB-hours | Compute time used |
| Edge Function Invocations | 500K/month | 1M/month | Edge middleware calls |
| Image Optimizations | 1000/month | 5000/month | Images processed |
| Cron Job Invocations | - | Based on plan | Scheduled tasks |

### 1.3 Web Vitals (Performance)

**Location:** Analytics tab → "Web Vitals" section

**Key Metrics:**
- **LCP (Largest Contentful Paint)** - Loading performance (target: <2.5s)
- **FID (First Input Delay)** - Interactivity (target: <100ms)
- **CLS (Cumulative Layout Shift)** - Visual stability (target: <0.1)
- **TTFB (Time to First Byte)** - Server response time (target: <800ms)

### 1.4 Logs & Function Insights

**Location:** https://vercel.com/[your-team]/[project-name]/logs

**What to Monitor:**
- Function cold starts
- Error rates
- Slow API responses
- Failed cron jobs

---

## Part 2: Day 1 Data Collection Checklist

### Step-by-Step Instructions

**Step 1: Export/Screenshot Your Current Data**
```
From Vercel Dashboard, record:
□ Total Visitors (Day 1)
□ Total Page Views (Day 1)
□ Top 5 Pages by views
□ Top 3 Referrers
□ Geographic breakdown (top 3 countries)
□ Device split (mobile vs desktop %)
```

**Step 2: Record Usage Metrics**
```
From Usage Dashboard, record:
□ Bandwidth used (GB)
□ Serverless Invocations count
□ Function Duration (GB-hours)
□ Image Optimizations used
□ Any approaching limits (% of quota)
```

**Step 3: Web Vitals Baseline**
```
From Web Vitals, record:
□ LCP score and percentile
□ FID score and percentile
□ CLS score and percentile
□ TTFB average
```

**Step 4: Check Cron Job Health**
```
Your MVP has these cron jobs - verify they ran:
□ /api/revalidate-homepage (every 15 min)
□ /api/cron/notifications (every 1 min)
□ /api/cron/featured-refresh (hourly)
□ /api/cron/calculate-stats (daily)
□ /api/cron/cleanup-cache (daily)
```

---

## Part 3: Sustainability Analysis Framework

### 3.1 Cost Sustainability

**Calculate Your "Burn Rate":**
```
Daily Usage × 30 = Monthly Projection
Monthly Projection / Plan Limit = % Capacity Used

Example:
- Day 1 Bandwidth: 2 GB
- Monthly projection: 60 GB
- Free tier limit: 100 GB
- Capacity: 60% (sustainable)
```

**Warning Thresholds:**
| Capacity % | Status | Action |
|------------|--------|--------|
| 0-50% | 🟢 Healthy | Monitor weekly |
| 50-75% | 🟡 Moderate | Monitor daily, optimize |
| 75-90% | 🟠 Warning | Immediate optimization needed |
| 90%+ | 🔴 Critical | Upgrade plan or reduce usage |

### 3.2 Performance Sustainability

**Scaling Indicators:**
- Response times increasing with traffic = Need caching
- Error rate increasing = Need error handling/retry logic
- Cold start frequency high = Need function optimization

### 3.3 Infrastructure Sustainability

**Your Current Architecture Assessment:**

| Component | Status | Sustainability Risk |
|-----------|--------|-------------------|
| Vercel Analytics | ✅ Enabled (MVP) | Low - included in plan |
| PostgreSQL | ⚠️ Check provider | Medium - database costs scale |
| Upstash Redis | ⚠️ Check limits | Medium - request limits apply |
| Alchemy RPC | ⚠️ Check limits | High - blockchain calls are expensive |
| Neynar API | ⚠️ Check limits | Medium - Farcaster API limits |
| Image Optimization | ⚠️ 1000/month free | Medium - NFT platform = many images |

---

## Part 4: Growth Optimization Strategies

### 4.1 Immediate Optimizations (Week 1)

#### A. Enable Missing Analytics
Your Studio and Auctionhouse apps have analytics disabled. Enable them:

```typescript
// In apps/cryptoart-studio-app/src/lib/constants.ts
// Change:
export const ANALYTICS_ENABLED = false;
// To:
export const ANALYTICS_ENABLED = true;
```

#### B. Add Custom Event Tracking
Track business-critical events for growth insights:

```typescript
// Example: Track auction creation
import { track } from '@vercel/analytics';

// In your auction creation handler:
track('auction_created', {
  auctionType: 'english',
  startingPrice: price,
  duration: durationHours
});

// Track key user actions:
track('wallet_connected', { chain: 'base' });
track('bid_placed', { auctionId, amount });
track('nft_minted', { collectionId, tokenId });
```

#### C. Optimize Images
Your next.config.ts shows image optimization. Verify settings:

```typescript
// Recommended settings for NFT platform
images: {
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 86400, // 24 hours (increase from 60s)
  remotePatterns: [
    // Your NFT image sources
  ]
}
```

### 4.2 Medium-Term Optimizations (Month 1)

#### A. Implement Caching Strategy
```typescript
// API Route caching example
export const revalidate = 3600; // Cache for 1 hour

// Or dynamic caching
export async function GET(request: Request) {
  return new Response(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
```

#### B. Database Query Optimization
Monitor slow queries and add indexes:
```sql
-- Example indexes for common queries
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_end_time ON auctions(end_time);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);
```

#### C. Reduce Cron Frequency
Your current setup:
- Notifications: Every 1 minute (43,200/month) ⚠️ HIGH
- Revalidate: Every 15 minutes (2,880/month)

Consider:
- Notifications: Every 5 minutes (8,640/month) - 80% reduction
- Use webhooks instead of polling where possible

### 4.3 Long-Term Growth Architecture

#### A. Edge Caching Layer
```typescript
// middleware.ts - Cache static responses at edge
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  const response = NextResponse.next();

  // Cache public pages at edge
  if (request.nextUrl.pathname.startsWith('/auctions/')) {
    response.headers.set('CDN-Cache-Control', 'public, max-age=300');
  }

  return response;
}
```

#### B. Implement Request Batching
For blockchain calls (Alchemy) - batch RPC requests:
```typescript
// Instead of multiple calls
const balance1 = await getBalance(addr1);
const balance2 = await getBalance(addr2);

// Use multicall
const results = await multicall({
  contracts: [
    { address: addr1, abi, functionName: 'balanceOf' },
    { address: addr2, abi, functionName: 'balanceOf' }
  ]
});
```

---

## Part 5: Growth Metrics & KPIs

### 5.1 Define Your North Star Metrics

For Cryptoart Studio (NFT Marketplace), track:

| Metric | Description | Target (Month 1) |
|--------|-------------|------------------|
| DAU | Daily Active Users | Establish baseline |
| Auctions Created | New auctions/day | Track growth rate |
| GMV | Gross Merchandise Value | Track total sales |
| Conversion Rate | Visitors → Connected Wallet | >5% |
| Retention | Return visitors (7-day) | >20% |

### 5.2 Create a Tracking Spreadsheet

```
| Date | Visitors | Page Views | Bandwidth | Functions | Auctions | Bids | Errors |
|------|----------|------------|-----------|-----------|----------|------|--------|
| Day1 | [fill]   | [fill]     | [fill]    | [fill]    | [fill]   |[fill]| [fill] |
| Day2 | ...      | ...        | ...       | ...       | ...      | ...  | ...    |
```

### 5.3 Set Up Alerts

**In Vercel Dashboard:**
1. Go to Project Settings → Notifications
2. Set up alerts for:
   - Usage approaching 80% of limit
   - Function errors spike
   - Deployment failures

---

## Part 6: Action Plan Summary

### Week 1 Tasks
- [ ] Record all Day 1 baseline metrics from Part 2
- [ ] Enable analytics on Studio and Auctionhouse apps
- [ ] Set up tracking spreadsheet
- [ ] Review cron job execution logs

### Week 2-4 Tasks
- [ ] Add custom event tracking for key business actions
- [ ] Optimize image caching TTL
- [ ] Review and reduce cron frequency if needed
- [ ] Add database query indexes for slow queries

### Month 2+ Tasks
- [ ] Implement edge caching for public pages
- [ ] Set up error monitoring (Sentry integration)
- [ ] Create automated usage reports
- [ ] Plan tier upgrade thresholds

---

## Part 7: Cost Projection Model

### Simple Calculator

```
Current Daily Usage:
- Bandwidth: ___ GB × 30 = ___ GB/month
- Functions: ___ calls × 30 = ___ calls/month
- Duration: ___ GB-hr × 30 = ___ GB-hr/month

Growth Projection (assuming 20% monthly growth):
Month 1: baseline × 1.0
Month 2: baseline × 1.2
Month 3: baseline × 1.44
Month 6: baseline × 2.49

When to Upgrade:
- If Month N projection > 75% of free tier → Plan upgrade needed
```

### Vercel Pricing Reference (as of 2024)
| Plan | Price | Best For |
|------|-------|----------|
| Hobby | Free | Testing, personal projects |
| Pro | $20/user/month | Small teams, startups |
| Enterprise | Custom | High-traffic, compliance needs |

---

## Part 8: Tools & Resources

### Recommended Monitoring Stack (Future)
1. **Sentry** - Error tracking ($0 for 5K errors/month)
2. **Checkly** - Uptime monitoring (free tier available)
3. **Better Uptime** - Status page (free tier)
4. **Grafana Cloud** - Metrics visualization (free tier)

### Useful Links
- Vercel Usage Guide: https://vercel.com/docs/accounts/usage
- Vercel Analytics Docs: https://vercel.com/docs/analytics
- Web Vitals Guide: https://web.dev/vitals/
- Next.js Performance: https://nextjs.org/docs/app/building-your-application/optimizing

---

## Quick Reference Card

```
DAILY CHECK (2 min):
✓ Any errors in logs?
✓ Cron jobs running?
✓ Usage normal?

WEEKLY CHECK (15 min):
✓ Usage trends (up/down?)
✓ Web Vitals status
✓ Top pages/referrers
✓ Update tracking spreadsheet

MONTHLY CHECK (1 hr):
✓ Project vs limits
✓ Cost sustainability
✓ Performance trends
✓ Plan optimization opportunities
```

---

*Document created: December 2024*
*Last updated: [Update when you make changes]*
