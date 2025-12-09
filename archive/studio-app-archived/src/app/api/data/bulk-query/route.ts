import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { getNeynarClient } from '~/lib/neynar';
import { checkMultipleContractOwnership } from '~/lib/alchemy';
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

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

export interface BulkQueryFilters {
  channel?: {
    channelId: string;
    startDate?: string;
    endDate?: string;
  };
  token?: {
    tokenAddress: string;
    minAmount?: string;
  };
  nft?: {
    contractAddress: string;
    minBalance?: number;
  };
  hypersub?: {
    contractAddress: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fids, filters }: { fids: number[]; filters: BulkQueryFilters } = body;

    if (!fids || fids.length === 0) {
      return NextResponse.json(
        { error: 'FIDs array is required' },
        { status: 400 }
      );
    }

    if (!filters || Object.keys(filters).length === 0) {
      return NextResponse.json(
        { error: 'At least one filter is required' },
        { status: 400 }
      );
    }

    // Validate CryptoArt membership for the first FID
    const membershipValidation = await validateMembershipMiddleware(fids[0]);
    if (!membershipValidation.valid) {
      return NextResponse.json(
        { error: membershipValidation.error },
        { status: 403 }
      );
    }

    const client = getNeynarClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Neynar client not configured' },
        { status: 503 }
      );
    }
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Get user data for all FIDs
    const usersResponse = await client.fetchBulkUsers({ fids });
    const users = usersResponse.users;

    const results = [];
    const filterResults = {
      channel: [] as any[],
      token: [] as any[],
      nft: [] as any[],
      hypersub: [] as any[],
    };

    // Process each user through all applicable filters
    for (const user of users) {
      const walletAddress = user.verified_addresses?.primary?.eth_address;
      if (!walletAddress) {
        continue; // Skip users without verified addresses
      }

      const userResult = {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        walletAddress,
        pfpUrl: user.pfp_url,
        matches: [] as string[],
      };

      // Channel activity filter
      if (filters.channel) {
        try {
          const queryParams: any = {
            fid: user.fid,
            limit: 1000,
          };

          if (filters.channel.channelId) {
            queryParams.channel_id = filters.channel.channelId;
          }

          if (filters.channel.startDate) {
            queryParams.start_time = new Date(filters.channel.startDate).toISOString();
          }

          if (filters.channel.endDate) {
            queryParams.end_time = new Date(filters.channel.endDate).toISOString();
          }

          const castsResponse = await client.fetchCastsForUser(queryParams);
          const casts = castsResponse.casts || [];

          if (casts.length > 0) {
            userResult.matches.push('channel');
            filterResults.channel.push({
              ...userResult,
              channelActivity: {
                totalCasts: casts.length,
                originalCasts: casts.filter(cast => !cast.parent_hash).length,
                replies: casts.filter(cast => cast.parent_hash).length,
              },
            });
          }
        } catch (error) {
          console.error(`Error checking channel activity for FID ${user.fid}:`, error);
        }
      }

      // Token holdings filter
      if (filters.token) {
        try {
          const tokenDecimals = await publicClient.readContract({
            address: filters.token.tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'decimals',
          });

          const minAmountBigInt = filters.token.minAmount 
            ? BigInt(Math.floor(parseFloat(filters.token.minAmount) * Math.pow(10, Number(tokenDecimals))))
            : BigInt(0);

          const balance = await publicClient.readContract({
            address: filters.token.tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          });

          const balanceBigInt = BigInt(balance.toString());
          
          if (balanceBigInt >= minAmountBigInt) {
            userResult.matches.push('token');
            filterResults.token.push({
              ...userResult,
              tokenBalance: {
                balance: balance.toString(),
                balanceFormatted: formatUnits(balanceBigInt, Number(tokenDecimals)),
                tokenAddress: filters.token.tokenAddress,
                minAmount: filters.token.minAmount || '0',
              },
            });
          }
        } catch (error) {
          console.error(`Error checking token balance for FID ${user.fid}:`, error);
        }
      }

      // NFT holdings filter
      if (filters.nft) {
        try {
          const ownershipResults = await checkMultipleContractOwnership(
            walletAddress,
            [filters.nft.contractAddress],
            filters.nft.minBalance || 1
          );

          if (ownershipResults.length > 0) {
            userResult.matches.push('nft');
            filterResults.nft.push({
              ...userResult,
              nftHoldings: ownershipResults[0],
            });
          }
        } catch (error) {
          console.error(`Error checking NFT holdings for FID ${user.fid}:`, error);
        }
      }

      // Hypersub membership filter
      if (filters.hypersub) {
        try {
          const url = `https://api.neynar.com/v2/farcaster/user/subscribers?fid=${user.fid}&subscription_provider=fabric_stp`;
          const response = await fetch(url, {
            headers: {
              'x-api-key': process.env.NEYNAR_API_KEY!,
            },
          });

          if (response.ok) {
            const data = await response.json();
            const subscriptions = data.subscribers || [];

            const activeSubscription = subscriptions.find((sub: any) => {
              const subscription = sub.subscribed_to?.[0];
              if (!subscription) return false;
              
              const isTargetContract = subscription.contract_address === filters.hypersub!.contractAddress;
              const isActive = new Date(subscription.expires_at) > new Date();
              
              return isTargetContract && isActive;
            });

            if (activeSubscription) {
              userResult.matches.push('hypersub');
              filterResults.hypersub.push({
                ...userResult,
                hypersubMembership: activeSubscription.subscribed_to[0],
              });
            }
          }
        } catch (error) {
          console.error(`Error checking Hypersub membership for FID ${user.fid}:`, error);
        }
      }

      // Only include users who match at least one filter
      if (userResult.matches.length > 0) {
        results.push(userResult);
      }
    }

    return NextResponse.json({
      totalFids: fids.length,
      matchingUsers: results.length,
      results,
      filterResults,
      appliedFilters: Object.keys(filters),
    });
  } catch (error) {
    console.error('Failed to execute bulk query:', error);
    return NextResponse.json(
      { error: 'Failed to execute bulk query. Please try again.' },
      { status: 500 }
    );
  }
}
