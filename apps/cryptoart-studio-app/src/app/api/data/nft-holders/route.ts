import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { getNeynarClient } from '~/lib/neynar';
import { checkMultipleContractOwnership, getContractMetadata } from '~/lib/alchemy';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fids = searchParams.get('fids');
    const contractAddress = searchParams.get('contractAddress');
    const tokenId = searchParams.get('tokenId');
    const minBalance = parseInt(searchParams.get('minBalance') || '1');

    if (!fids) {
      return NextResponse.json(
        { error: 'FIDs parameter is required' },
        { status: 400 }
      );
    }

    if (!contractAddress) {
      return NextResponse.json(
        { error: 'contractAddress parameter is required' },
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

    // Validate CryptoArt membership for the first FID
    const membershipValidation = await validateMembershipMiddleware(fidNumbers[0]);
    if (!membershipValidation.valid) {
      return NextResponse.json(
        { error: membershipValidation.error },
        { status: 403 }
      );
    }

    const client = getNeynarClient();

    // Get user data for all FIDs
    const usersResponse = await client.fetchBulkUsers({ fids: fidNumbers });
    const users = usersResponse.users;

    // Get contract metadata
    const contractMetadata = await getContractMetadata(contractAddress);

    // Check NFT ownership for each user
    const holders = [];
    for (const user of users) {
      const walletAddress = user.verified_addresses?.primary?.eth_address;
      if (!walletAddress) {
        continue; // Skip users without verified addresses
      }

      try {
        const ownershipResults = await checkMultipleContractOwnership(
          walletAddress,
          [contractAddress],
          minBalance
        );

        if (ownershipResults.length > 0) {
          const result = ownershipResults[0];
          holders.push({
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            walletAddress,
            balance: result.balance,
            nfts: result.nfts.map(nft => ({
              tokenId: nft.tokenId,
              tokenType: nft.tokenType,
              metadata: nft.metadata,
            })),
            pfpUrl: user.pfp_url,
          });
        }
      } catch (error) {
        console.error(`Error checking NFT ownership for ${walletAddress}:`, error);
        // Continue with other users
      }
    }

    return NextResponse.json({
      contractAddress,
      contractMetadata,
      minBalance,
      holders,
      totalHolders: holders.length,
      tokenId: tokenId || null,
    });
  } catch (error) {
    console.error('Failed to fetch NFT holders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch NFT holders. Please try again.' },
      { status: 500 }
    );
  }
}
