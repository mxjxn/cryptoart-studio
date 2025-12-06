import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, pendingAllowlistSignatures, eq, and, gt, isNull } from '@cryptoart/db';
import { isAddress } from 'viem';

/**
 * POST /api/allowlist/signatures
 * Store a new pending signature for the allowlist flow
 * 
 * Body: {
 *   fid: number,
 *   associatedAddress: string,
 *   membershipHolder: string,
 *   signature: string,
 *   nonce: string (bigint as string)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fid, associatedAddress, membershipHolder, signature, nonce } = body;

    // Validate required fields
    if (!fid || typeof fid !== 'number') {
      return NextResponse.json(
        { error: 'fid is required and must be a number' },
        { status: 400 }
      );
    }

    if (!associatedAddress || !isAddress(associatedAddress)) {
      return NextResponse.json(
        { error: 'associatedAddress is required and must be a valid address' },
        { status: 400 }
      );
    }

    if (!membershipHolder || !isAddress(membershipHolder)) {
      return NextResponse.json(
        { error: 'membershipHolder is required and must be a valid address' },
        { status: 400 }
      );
    }

    if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
      return NextResponse.json(
        { error: 'signature is required and must be a valid hex string' },
        { status: 400 }
      );
    }

    if (nonce === undefined || nonce === null) {
      return NextResponse.json(
        { error: 'nonce is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    // Normalize addresses
    const normalizedAssociated = associatedAddress.toLowerCase();
    const normalizedMembership = membershipHolder.toLowerCase();
    const nonceBigInt = BigInt(nonce);

    // Check if signature already exists for this tuple
    const existing = await db
      .select()
      .from(pendingAllowlistSignatures)
      .where(
        and(
          eq(pendingAllowlistSignatures.associatedAddress, normalizedAssociated),
          eq(pendingAllowlistSignatures.membershipHolder, normalizedMembership),
          eq(pendingAllowlistSignatures.nonce, nonceBigInt),
          isNull(pendingAllowlistSignatures.submittedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing signature
      await db
        .update(pendingAllowlistSignatures)
        .set({
          signature,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        })
        .where(eq(pendingAllowlistSignatures.id, existing[0].id));

      return NextResponse.json({
        success: true,
        id: existing[0].id,
        message: 'Signature updated',
      });
    }

    // Insert new signature
    const [inserted] = await db
      .insert(pendingAllowlistSignatures)
      .values({
        fid,
        associatedAddress: normalizedAssociated,
        membershipHolder: normalizedMembership,
        signature,
        nonce: nonceBigInt,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    return NextResponse.json({
      success: true,
      id: inserted.id,
      message: 'Signature stored',
    });
  } catch (error) {
    console.error('[POST /api/allowlist/signatures] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/allowlist/signatures
 * Fetch pending signatures for a membership holder or by FID
 * 
 * Query params:
 *   - membershipHolder: string (fetch by membership holder address)
 *   - fid: number (fetch by Farcaster ID)
 *   - associatedAddress: string (filter by specific associated address)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const membershipHolder = searchParams.get('membershipHolder');
    const fid = searchParams.get('fid');
    const associatedAddress = searchParams.get('associatedAddress');

    if (!membershipHolder && !fid) {
      return NextResponse.json(
        { error: 'Either membershipHolder or fid is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const now = new Date();
    let query = db
      .select()
      .from(pendingAllowlistSignatures)
      .where(
        and(
          gt(pendingAllowlistSignatures.expiresAt, now),
          isNull(pendingAllowlistSignatures.submittedAt)
        )
      );

    // Build dynamic conditions
    const conditions = [
      gt(pendingAllowlistSignatures.expiresAt, now),
      isNull(pendingAllowlistSignatures.submittedAt),
    ];

    if (membershipHolder && isAddress(membershipHolder)) {
      conditions.push(
        eq(pendingAllowlistSignatures.membershipHolder, membershipHolder.toLowerCase())
      );
    }

    if (fid) {
      const fidNum = parseInt(fid, 10);
      if (!isNaN(fidNum)) {
        conditions.push(eq(pendingAllowlistSignatures.fid, fidNum));
      }
    }

    if (associatedAddress && isAddress(associatedAddress)) {
      conditions.push(
        eq(pendingAllowlistSignatures.associatedAddress, associatedAddress.toLowerCase())
      );
    }

    const signatures = await db
      .select()
      .from(pendingAllowlistSignatures)
      .where(and(...conditions));

    // Convert bigint to string for JSON serialization
    const serialized = signatures.map((sig) => ({
      ...sig,
      nonce: sig.nonce.toString(),
    }));

    return NextResponse.json({
      success: true,
      signatures: serialized,
    });
  } catch (error) {
    console.error('[GET /api/allowlist/signatures] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/allowlist/signatures
 * Delete a pending signature (after submission or to cancel)
 * 
 * Body: {
 *   id: string (signature ID)
 * }
 * 
 * OR mark as submitted:
 * Body: {
 *   id: string,
 *   transactionHash: string
 * }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, transactionHash } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    if (transactionHash) {
      // Mark as submitted rather than deleting
      await db
        .update(pendingAllowlistSignatures)
        .set({
          submittedAt: new Date(),
          transactionHash,
        })
        .where(eq(pendingAllowlistSignatures.id, id));

      return NextResponse.json({
        success: true,
        message: 'Signature marked as submitted',
      });
    }

    // Delete the signature
    await db
      .delete(pendingAllowlistSignatures)
      .where(eq(pendingAllowlistSignatures.id, id));

    return NextResponse.json({
      success: true,
      message: 'Signature deleted',
    });
  } catch (error) {
    console.error('[DELETE /api/allowlist/signatures] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

