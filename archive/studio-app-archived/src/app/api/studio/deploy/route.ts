import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * API route to get contract bytecode and ABI for deployment
 * This allows the client to deploy contracts using wagmi's deployContract
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractType = searchParams.get('type'); // ERC721 or ERC1155
    const isUpgradeable = searchParams.get('upgradeable') === 'true';

    if (!contractType || (contractType !== 'ERC721' && contractType !== 'ERC1155')) {
      return NextResponse.json(
        { error: 'Invalid contract type. Must be ERC721 or ERC1155' },
        { status: 400 }
      );
    }

    // Path to compiled contracts
    // Note: In production, you might want to bundle these or serve from a CDN
    // process.cwd() is apps/cryptoart-studio-app, so go up TWO levels to monorepo root
    const cwd = process.cwd();
    const contractsPath = join(
      cwd,
      '..',
      '..',
      'packages',
      'creator-core-contracts',
      'out'
    );

    let artifactPath: string;
    if (isUpgradeable) {
      artifactPath = join(
        contractsPath,
        `${contractType}CreatorImplementation.sol/${contractType}CreatorImplementation.json`
      );
    } else {
      artifactPath = join(
        contractsPath,
        `${contractType}Creator.sol/${contractType}Creator.json`
      );
    }

    try {
      const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
      
      return NextResponse.json({
        success: true,
        bytecode: artifact.bytecode.object,
        abi: artifact.abi,
        contractName: artifact.contractName,
      });
    } catch (fileError) {
      console.error('Error reading contract artifact:', fileError);
      return NextResponse.json(
        { 
          error: 'Contract artifact not found. Please ensure contracts are compiled.',
          details: (fileError as Error).message 
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error in deploy route:', error);
    return NextResponse.json(
      { error: 'Failed to get contract bytecode', details: (error as Error).message },
      { status: 500 }
    );
  }
}

