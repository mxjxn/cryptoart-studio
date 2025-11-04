import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { validateAirdropParams, estimateAirdropGas } from '~/lib/airdrop';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, tokenAddress, recipients, amounts } = body;

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients array is required' },
        { status: 400 }
      );
    }

    if (!amounts || !Array.isArray(amounts) || amounts.length === 0) {
      return NextResponse.json(
        { error: 'Amounts array is required' },
        { status: 400 }
      );
    }

    const fidNumber = parseInt(fid, 10);
    if (isNaN(fidNumber)) {
      return NextResponse.json(
        { error: 'Invalid FID parameter' },
        { status: 400 }
      );
    }

    // Validate CryptoArt membership
    const membershipValidation = await validateMembershipMiddleware(fidNumber);
    if (!membershipValidation.valid) {
      return NextResponse.json(
        { error: membershipValidation.error },
        { status: 403 }
      );
    }

    // Validate airdrop parameters
    const validation = await validateAirdropParams({
      tokenAddress,
      recipients,
      amounts,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Invalid airdrop parameters',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // Estimate gas cost
    let gasEstimate: string;
    try {
      gasEstimate = await estimateAirdropGas({
        tokenAddress,
        recipients,
        amounts,
      });
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return NextResponse.json(
        { 
          error: 'Failed to estimate gas cost',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Calculate total amount
    const totalAmount = amounts.reduce((sum: string, amount: string) => {
      return (BigInt(sum) + BigInt(amount)).toString();
    }, '0');

    return NextResponse.json({
      validation: {
        valid: true,
        recipientCount: recipients.length,
        totalAmount,
      },
      gasEstimate,
      estimatedCost: {
        gasLimit: gasEstimate,
        // Note: Actual cost would depend on current gas price
        // This would need to be calculated with current gas price
      },
      summary: {
        tokenAddress,
        recipientCount: recipients.length,
        totalAmount,
        gasEstimate,
      },
    });
  } catch (error) {
    console.error('Failed to prepare airdrop:', error);
    return NextResponse.json(
      { error: 'Failed to prepare airdrop. Please try again.' },
      { status: 500 }
    );
  }
}
