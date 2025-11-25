import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { executeAirdrop, validateAirdropParams } from '~/lib/airdrop';
import { getDatabase, airdropHistory, eq } from '@cryptoart/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, tokenAddress, recipients, amounts, listId } = body;

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

    const db = getDatabase();

    // Calculate total amount
    const totalAmount = amounts.reduce((sum: string, amount: string) => {
      return (BigInt(sum) + BigInt(amount)).toString();
    }, '0');

    // Create airdrop record in database
    const [airdropRecord] = await db
      .insert(airdropHistory)
      .values({
        creatorFid: fidNumber,
        tokenAddress,
        chain: 8453, // Base mainnet
        recipientCount: recipients.length,
        totalAmount,
        status: 'pending',
        metadata: {
          listId: listId || null,
          recipients: recipients.map((addr, index) => ({
            address: addr,
            amount: amounts[index],
          })),
        },
      })
      .returning();

    // Execute the airdrop
    const result = await executeAirdrop({
      tokenAddress,
      recipients,
      amounts,
    });

    // Update the airdrop record with transaction details
    await db
      .update(airdropHistory)
      .set({
        txHash: result.txHash || null,
        status: result.status,
        metadata: {
          ...(airdropRecord.metadata as Record<string, any>),
          gasUsed: result.gasUsed,
          error: result.error,
        },
      })
      .where(eq(airdropHistory.id, airdropRecord.id));

    if (result.status === 'success') {
      return NextResponse.json({
        success: true,
        airdropId: airdropRecord.id,
        txHash: result.txHash,
        status: result.status,
        gasUsed: result.gasUsed,
        summary: {
          tokenAddress,
          recipientCount: recipients.length,
          totalAmount,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          airdropId: airdropRecord.id,
          error: result.error,
          status: result.status,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Failed to execute airdrop:', error);
    return NextResponse.json(
      { error: 'Failed to execute airdrop. Please try again.' },
      { status: 500 }
    );
  }
}
