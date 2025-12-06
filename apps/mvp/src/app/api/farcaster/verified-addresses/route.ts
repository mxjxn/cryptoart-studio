import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

/**
 * API route to fetch all verified addresses for a Farcaster user by FID
 * GET /api/farcaster/verified-addresses?fid=<fid>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');

    if (!fidParam) {
      return NextResponse.json(
        { error: 'FID parameter is required' },
        { status: 400 }
      );
    }

    const fid = parseInt(fidParam, 10);
    if (isNaN(fid) || fid <= 0) {
      return NextResponse.json(
        { error: 'Invalid FID parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'NEYNAR_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Initialize Neynar client
    const config = new Configuration({ apiKey });
    const client = new NeynarAPIClient(config);

    // Fetch user data by FID
    const { users } = await client.fetchBulkUsers({ fids: [fid] });

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];

    // Extract all verified addresses
    const verifiedAddresses: string[] = [];

    // Primary verified address
    if (user.verified_addresses?.primary?.eth_address) {
      const addr = user.verified_addresses.primary.eth_address.toLowerCase();
      if (!verifiedAddresses.includes(addr)) {
        verifiedAddresses.push(addr);
      }
    }

    // All verified ETH addresses
    if (user.verified_addresses?.eth_addresses) {
      user.verified_addresses.eth_addresses.forEach((addr: string) => {
        const lowerAddr = addr.toLowerCase();
        if (!verifiedAddresses.includes(lowerAddr)) {
          verifiedAddresses.push(lowerAddr);
        }
      });
    }

    // Legacy verifications array
    if (user.verifications && Array.isArray(user.verifications)) {
      user.verifications.forEach((addr: string) => {
        if (typeof addr === 'string' && addr.startsWith('0x')) {
          const lowerAddr = addr.toLowerCase();
          if (!verifiedAddresses.includes(lowerAddr)) {
            verifiedAddresses.push(lowerAddr);
          }
        }
      });
    }

    // Custody address (native Farcaster wallet)
    if (user.custody_address) {
      const addr = user.custody_address.toLowerCase();
      if (!verifiedAddresses.includes(addr)) {
        verifiedAddresses.push(addr);
      }
    }

    return NextResponse.json({
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      verifiedAddresses,
    });
  } catch (error) {
    console.error('[verified-addresses] Error fetching verified addresses:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch verified addresses',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


