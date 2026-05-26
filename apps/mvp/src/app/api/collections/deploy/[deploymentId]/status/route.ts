import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, collectionDeployments, collections, eq } from '@cryptoart/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> },
) {
  try {
    const { deploymentId } = await params;

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

    const response: Record<string, unknown> = {
      deploymentId: deployment.id,
      status: deployment.status,
      txHash: deployment.txHash,
      blockNumber: deployment.blockNumber,
      gasUsed: deployment.gasUsed,
      effectiveGasPrice: deployment.effectiveGasPrice,
      submittedAt: deployment.submittedAt,
      confirmedAt: deployment.confirmedAt,
      failedAt: deployment.failedAt,
      errorMessage: deployment.errorMessage,
    };

    if (deployment.status === 'confirmed' && deployment.collectionId) {
      const collectionRows = await db
        .select()
        .from(collections)
        .where(eq(collections.id, deployment.collectionId))
        .limit(1);

      if (collectionRows.length > 0) {
        response.collectionId = collectionRows[0]!.id;
        response.contractAddress = collectionRows[0]!.contractAddress;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/collections/deploy/[id]/status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get deployment status' },
      { status: 500 },
    );
  }
}
