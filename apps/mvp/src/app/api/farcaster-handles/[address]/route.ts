import { NextRequest, NextResponse } from "next/server";
import { lookupAllFarcasterHandlesByAddress } from "~/lib/artist-name-resolution";
import { isAddress } from "viem";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    console.log(`[GET /api/farcaster-handles/${address}] Request received`);
    
    if (!address) {
      console.log(`[GET /api/farcaster-handles/[address]] ERROR: No address provided`);
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!isAddress(address)) {
      console.log(`[GET /api/farcaster-handles/${address}] ERROR: Invalid address format`);
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Normalize address to lowercase
    const normalizedAddress = address.toLowerCase();

    // Fetch all Farcaster handles for this address
    const handles = await lookupAllFarcasterHandlesByAddress(normalizedAddress);

    console.log(`[GET /api/farcaster-handles/${address}] Found ${handles.length} handles`);

    return NextResponse.json({
      success: true,
      handles,
    });
  } catch (error) {
    console.error("Error fetching Farcaster handles:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch Farcaster handles",
        handles: [],
      },
      { status: 500 }
    );
  }
}








