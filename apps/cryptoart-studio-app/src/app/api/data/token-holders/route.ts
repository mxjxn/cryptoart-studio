import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { validateMembershipMiddleware } from '~/lib/auth';
import { getNeynarClient } from '~/lib/neynar';

// ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'uint8' }],
  },
] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fids = searchParams.get('fids');
    const tokenAddress = searchParams.get('tokenAddress');
    const minAmount = searchParams.get('minAmount');

    if (!fids) {
      return NextResponse.json(
        { error: 'FIDs parameter is required' },
        { status: 400 }
      );
    }

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'tokenAddress parameter is required' },
        { status: 400 }
      );
    }

    const fidNumbers = fids.split(',').map(fid => parseInt(fid.trim(), 10));
    if (fidNumbers.some(fid => isNaN(fid))) {
      return NextResponse.json(
        { error: 'Invalid FIDs parameter' },
        { status: 400 }
      );
    }

    // Validate CryptoArt membership for the first FID (assuming they're all from the same creator)
    const membershipValidation = await validateMembershipMiddleware(fidNumbers[0]);
    if (!membershipValidation.valid) {
      return NextResponse.json(
        { error: membershipValidation.error },
        { status: 403 }
      );
    }

    const client = getNeynarClient();
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Get user data for all FIDs
    const usersResponse = await client.fetchBulkUsers({ fids: fidNumbers });
    const users = usersResponse.users;

    // Get token decimals
    let tokenDecimals = 18; // Default to 18
    try {
      const decimals = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });
      tokenDecimals = Number(decimals);
    } catch (error) {
      console.warn('Could not fetch token decimals, using default 18:', error);
    }

    const minAmountBigInt = minAmount ? BigInt(Math.floor(parseFloat(minAmount) * Math.pow(10, tokenDecimals))) : BigInt(0);

    // Check balances for each user
    const holders = [];
    for (const user of users) {
      const walletAddress = user.verified_addresses?.primary?.eth_address;
      if (!walletAddress) {
        continue; // Skip users without verified addresses
      }

      try {
        const balance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`],
        });

        const balanceBigInt = BigInt(balance.toString());
        
        if (balanceBigInt >= minAmountBigInt) {
          holders.push({
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            walletAddress,
            balance: balance.toString(),
            balanceFormatted: formatUnits(balanceBigInt, tokenDecimals),
            pfpUrl: user.pfp_url,
          });
        }
      } catch (error) {
        console.error(`Error checking balance for ${walletAddress}:`, error);
        // Continue with other users
      }
    }

    return NextResponse.json({
      tokenAddress,
      minAmount: minAmount || '0',
      holders,
      totalHolders: holders.length,
      tokenDecimals,
    });
  } catch (error) {
    console.error('Failed to fetch token holders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token holders. Please try again.' },
      { status: 500 }
    );
  }
}
