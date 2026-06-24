import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collectionDeployments, eq } from '@cryptoart/db';
import { isAddress } from 'viem';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> },
) {
  try {
    const { deploymentId } = await params;
    const body = await req.json();
    const { txHash, ownerAddress } = body;

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
    }
    if (!ownerAddress || !isAddress(ownerAddress)) {
      return NextResponse.json({ error: 'Valid ownerAddress is required' }, { status: 400 });
    }

    const db = getDatabase();
    const deployments = await db
      .select()
      .from(collectionDeployments)
      .where(eq(collectionDeployments.id, deploymentId))
      .limit(1);

    if (deployments.length === 0) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const deployment = deployments[0]!;
    if (deployment.fromAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (deployment.status === 'confirmed') {
      return NextResponse.json({ error: 'Deployment already confirmed' }, { status: 400 });
    }

    if (deployment.txHash.startsWith('pending-')) {
      await db
        .update(collectionDeployments)
        .set({ status: 'submitted' })
        .where(eq(collectionDeployments.id, deploymentId));
    } else {
      await db
        .update(collectionDeployments)
        .set({ txHash, status: 'submitted' })
        .where(eq(collectionDeployments.id, deploymentId));
    }

    return NextResponse.json({
      deploymentId,
      status: 'submitted',
    });
  } catch (error) {
    console.error('[POST /api/collections/deploy/[id]/submit] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit deployment' },
      { status: 500 },
    );
  }
}
