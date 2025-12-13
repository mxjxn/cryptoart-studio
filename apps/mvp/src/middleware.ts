import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Enable maintenance mode - redirect all traffic to maintenance page
  // Allow the maintenance page itself and static assets to load
  const pathname = request.nextUrl.pathname;
  
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
