# DDoS Protection Guide for Vercel Deployment

## Current Protection Measures

### 1. Next.js Middleware Rate Limiting
- **Location**: `src/middleware.ts`
- **API Routes**: 20 requests per minute
- **General Routes**: 60 requests per minute
- **Blocked IPs**: Configured in middleware (add IPs to `BLOCKED_IPS` Set)

### 2. Immediate Actions During Attack

#### Block an Attacking IP
1. Identify the IP from Vercel logs or analytics
2. Add IP to `BLOCKED_IPS` in `src/middleware.ts`:
   ```typescript
   const BLOCKED_IPS = new Set<string>([
     '1.2.3.4',  // Add attacker IP here
   ]);
   ```
3. Deploy immediately:
   ```bash
   git add src/middleware.ts
   git commit -m "Block attacking IP"
   git push
   ```

#### Check Vercel Analytics for Attackers
1. Go to Vercel Dashboard → Your Project → Analytics
2. Look for unusual traffic patterns
3. Check "Top IPs" to identify attackers
4. Block high-volume IPs immediately

### 3. Vercel Built-in Protections

#### Enable Vercel Firewall (Recommended)
1. Go to Vercel Dashboard → Settings → Security
2. Enable **Vercel Firewall** (available on Pro/Enterprise plans)
3. Configure rules:
   - Block known bad IPs
   - Rate limit by country/region if needed
   - Enable bot protection

#### Upgrade Plan for Better Protection
- **Hobby**: Basic DDoS protection
- **Pro**: Enhanced protection + Firewall
- **Enterprise**: Advanced DDoS mitigation + WAF

### 4. Temporary Emergency Measures

#### Lower Rate Limits (Emergency Only)
Edit `src/middleware.ts` and temporarily lower limits:
```typescript
const RATE_LIMITS = {
  api: {
    requests: 10,  // Lower from 20
    window: 60 * 1000,
  },
  general: {
    requests: 30,  // Lower from 60
    window: 60 * 1000,
  },
};
```

#### Enable Maintenance Mode
Create a maintenance page and redirect all traffic:
1. Create `src/app/maintenance/page.tsx`
2. Update middleware to redirect all requests:
```typescript
export function middleware(request: NextRequest) {
  // Emergency maintenance mode
  if (process.env.MAINTENANCE_MODE === 'true') {
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }
  // ... rest of middleware
}
```

### 5. Monitoring & Detection

#### Check Vercel Logs
```bash
# View real-time logs
vercel logs --follow

# Or check in Vercel Dashboard → Deployments → View Function Logs
```

#### Monitor Key Metrics
- **Function Invocations**: Should spike during attack
- **Bandwidth**: Unusual spikes indicate attack
- **Error Rate**: High 429 errors = rate limiting working
- **Response Time**: Slow responses = server overload

### 6. Long-term Solutions

#### Use Redis for Distributed Rate Limiting
Current middleware uses in-memory storage (per edge function instance).
For better protection across all Vercel regions:
1. Set up Upstash Redis (Vercel integration)
2. Update middleware to use Redis for rate limiting
3. This provides global rate limiting across all edge functions

#### Add Cloudflare (Advanced)
1. Point domain to Cloudflare
2. Enable Cloudflare DDoS protection
3. Configure rate limiting rules
4. Use Cloudflare as proxy before Vercel

#### API Route Protection
Add additional protection to high-traffic API routes:
```typescript
// Example: src/app/api/example/route.ts
export async function GET(request: NextRequest) {
  // Additional rate limiting per route
  const ip = request.headers.get('x-forwarded-for');
  // Check custom rate limit
  // Return 429 if exceeded
}
```

### 7. Emergency Contacts

- **Vercel Support**: support@vercel.com (Enterprise) or Dashboard
- **Check Status**: https://vercel-status.com
- **Documentation**: https://vercel.com/docs/security

## Quick Reference

### Current Rate Limits
- API: **20 req/min**
- General: **60 req/min**

### To Block an IP
1. Edit `src/middleware.ts`
2. Add IP to `BLOCKED_IPS` Set
3. Deploy immediately

### To Check Attack Status
1. Vercel Dashboard → Analytics
2. Look for traffic spikes
3. Check function logs for 429 errors

### Emergency Response
1. Lower rate limits in middleware
2. Block attacking IPs
3. Enable maintenance mode if needed
4. Contact Vercel support if severe









