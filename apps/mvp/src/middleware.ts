import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Handle /dev/ prefix - bypass maintenance mode and rewrite to actual route
  if (pathname.startsWith('/dev/')) {
    const actualPath = pathname.replace(/^\/dev/, '') || '/';
    const url = request.nextUrl.clone();
    url.pathname = actualPath;
    return NextResponse.rewrite(url);
  }
  
  // Check if maintenance mode is enabled via environment variable
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
  
  // If maintenance mode is off, allow all requests through
  if (!maintenanceMode) {
    return NextResponse.next();
  }
  
  // Maintenance mode is ON - redirect all traffic to maintenance page
  // Allow the maintenance page itself and static assets to load
  // Don't redirect if already on maintenance page or if it's a static asset
  if (pathname === '/maintenance' || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/api') ||
      pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|otf|css|js)$/)) {
    return NextResponse.next();
  }
  
  // Redirect all other requests to maintenance page
  return NextResponse.redirect(new URL('/maintenance', request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
