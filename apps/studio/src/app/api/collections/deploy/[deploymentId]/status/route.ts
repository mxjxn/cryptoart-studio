import { NextRequest, NextResponse } from 'next/server';
import { isHash } from 'viem';
import { confirmDeploymentFromChain } from '~/lib/confirmDeployment';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> },
) {
  try {
    const { deploymentId } = await params;
    const txHashParam = req.nextUrl.searchParams.get('txHash');
    const txHash = txHashParam && isHash(txHashParam) ? txHashParam : null;

    const confirmed = await confirmDeploymentFromChain({
      deploymentId,
      txHash,
    });

    return NextResponse.json({
      deploymentId,
      status: confirmed.status,
      txHash: confirmed.txHash,
      blockNumber: confirmed.blockNumber,
      collectionId: confirmed.collectionId,
      contractAddress: confirmed.contractAddress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get deployment status';
    if (message === 'Deployment not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('[GET /api/collections/deploy/[id]/status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get deployment status' },
      { status: 500 },
    );
  }
}
