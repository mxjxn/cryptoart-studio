import { NextResponse } from 'next/server';
import { createClient, Errors } from '@farcaster/quick-auth';

const client = createClient();

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get domain from environment or request
    // QuickAuth expects the domain to match the 'aud' claim in the token
    // The token's aud claim contains just the hostname (e.g., "example.com" or "localhost")
    // We need to use the Host header to get the actual domain the client is accessing
    // (which may be ngrok or a tunnel, not localhost)
    let domain: string;
    
    // Priority: Host header > NEXT_PUBLIC_URL > request URL
    // This ensures we use the actual domain the client is accessing (e.g., ngrok)
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (hostHeader) {
      // Remove port if present (e.g., "localhost:3002" -> "localhost")
      domain = hostHeader.split(':')[0];
    } else if (process.env.NEXT_PUBLIC_URL) {
      // Extract hostname from NEXT_PUBLIC_URL
      domain = new URL(process.env.NEXT_PUBLIC_URL).hostname;
    } else {
      // Fallback to request URL hostname
      const url = new URL(request.url);
      domain = url.hostname;
    }

    // Debug: decode token to see what aud claim it has
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf-8')
        );
        console.log('Token aud claim:', payload.aud);
        console.log('Token iss claim:', payload.iss);
      }
    } catch (e) {
      console.log('Could not decode token for debugging:', e);
    }

    // Debug: log the domain being used for verification
    console.log('Verifying token with domain:', domain);

    try {
      // Use the official QuickAuth library to verify the JWT
      const payload = await client.verifyJwt({
        token,
        domain,
      });

      return NextResponse.json({
        success: true,
        user: {
          fid: payload.sub,
        },
      });
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        console.info('Invalid token:', e.message);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      throw e;
    }
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}