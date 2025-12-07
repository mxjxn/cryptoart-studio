import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiting (use Redis in production for distributed systems)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Blocked IPs (add attacker IPs here)
const BLOCKED_IPS = new Set<string>([
  // Add IPs to block here, e.g.:
  // '1.2.3.4',
  // '5.6.7.8',
]);

// Whitelisted IPs (localhost, development)
const WHITELISTED_IPS = new Set<string>([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  'localhost',
  'unknown', // Local dev fallback
]);

// Rate limit configuration
const RATE_LIMITS = {
  api: {
    requests: 100, // requests per window (allow reasonable page loads)
    window: 60 * 1000, // 1 minute in milliseconds
  },
  general: {
    requests: 200, // requests per window
    window: 60 * 1000, // 1 minute in milliseconds
  },
};

function getClientIP(request: NextRequest): string {
  // Vercel-specific IP detection
  const vercelIP = request.headers.get('x-vercel-forwarded-for');
  if (vercelIP) return vercelIP.split(',')[0].trim();
  
  // Check various headers for real IP (in case of proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (cfConnectingIP) return cfConnectingIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;
  
  // Fallback - should rarely happen on Vercel
  return 'unknown';
}

function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number; resetTime: number } {
  const isAPI = path.startsWith('/api/');
  const limit = isAPI ? RATE_LIMITS.api : RATE_LIMITS.general;
  const key = `${ip}:${isAPI ? 'api' : 'general'}`;
  
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    // New window
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + limit.window,
    });
    return {
      allowed: true,
      remaining: limit.requests - 1,
      resetTime: now + limit.window,
    };
  }
  
  if (record.count >= limit.requests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }
  
  // Increment count
  record.count++;
  rateLimitMap.set(key, record);
  
  return {
    allowed: true,
    remaining: limit.requests - record.count,
    resetTime: record.resetTime,
  };
}

// Cleanup old entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function middleware(request: NextRequest) {
  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;
  
  // Block known bad IPs
  if (BLOCKED_IPS.has(ip)) {
    console.warn(`[DDoS Protection] Blocked IP: ${ip} accessing ${path}`);
    return new NextResponse('Access Denied', { status: 403 });
  }
  
  // Skip rate limiting for whitelisted IPs (localhost/development)
  if (WHITELISTED_IPS.has(ip)) {
    return NextResponse.next();
  }
  
  // Skip rate limiting for static assets and Next.js internals
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/static/') ||
    path.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }
  
  // Check rate limit
  const rateLimit = checkRateLimit(ip, path);
  
  if (!rateLimit.allowed) {
    // Log only periodically to avoid log spam
    if (Math.random() < 0.1) {
      console.warn(`[DDoS Protection] Rate limit exceeded for IP: ${ip} on ${path}`);
    }
    
    // Return 429 Too Many Requests
    const response = new NextResponse('Too Many Requests', { status: 429 });
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS.api.requests));
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)));
    response.headers.set('Retry-After', String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)));
    
    return response;
  }
  
  // Add rate limit headers
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS.api.requests));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)));
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

