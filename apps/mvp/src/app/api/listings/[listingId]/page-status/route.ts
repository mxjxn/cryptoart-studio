import { NextRequest, NextResponse } from "next/server";
import { getDatabase, listingPageStatus, eq } from "@cryptoart/db";
import { getAuctionServer } from "~/lib/server/auction";

/**
 * GET /api/listings/[listingId]/page-status
 * Check the status of a listing page (building/ready/error)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Check if status exists in database
    const statusRecord = await db
      .select()
      .from(listingPageStatus)
      .where(eq(listingPageStatus.listingId, listingId))
      .limit(1);

    if (statusRecord.length === 0) {
      // No status record exists - check if listing is available in subgraph
      // If it is, mark as ready; otherwise return building
      try {
        const auction = await getAuctionServer(listingId);
        if (auction) {
          // Listing exists in subgraph, create ready status
          await db.insert(listingPageStatus).values({
            listingId,
            status: 'ready',
            sellerAddress: auction.seller || '',
            readyAt: new Date(),
            lastCheckedAt: new Date(),
          });
          
          return NextResponse.json({
            status: 'ready',
            listingId,
            sellerAddress: auction.seller || '',
            readyAt: new Date().toISOString(),
          });
        }
      } catch {
        // Listing not available yet
      }
      
      return NextResponse.json({
        status: 'building',
        listingId,
        sellerAddress: null,
      });
    }

    const record = statusRecord[0];
    
    // If status is building, check if it's ready now
    if (record.status === 'building') {
      try {
        const auction = await getAuctionServer(listingId);
        if (auction) {
          // Try to fetch the opengraph image to ensure it's generated
          // This is a lightweight check - we just verify the endpoint exists
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                         process.env.APP_URL || 
                         req.headers.get('origin') || 
                         'http://localhost:3000';
          const ogImageUrl = `${baseUrl}/listing/${listingId}/opengraph-image`;
          
          try {
            const ogResponse = await fetch(ogImageUrl, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(5000), // 5 second timeout
            });
            
            if (ogResponse.ok) {
              // Page is ready!
              await db
                .update(listingPageStatus)
                .set({
                  status: 'ready',
                  readyAt: new Date(),
                  lastCheckedAt: new Date(),
                })
                .where(eq(listingPageStatus.listingId, listingId));
              
              const updatedRecord = await db
                .select()
                .from(listingPageStatus)
                .where(eq(listingPageStatus.listingId, listingId))
                .limit(1);
              
              return NextResponse.json({
                status: 'ready',
                listingId,
                sellerAddress: updatedRecord[0]?.sellerAddress || record.sellerAddress,
                readyAt: new Date().toISOString(),
              });
            }
          } catch {
            // OG image not ready yet, continue with building status
          }
          
          // Update last checked time
          await db
            .update(listingPageStatus)
            .set({
              lastCheckedAt: new Date(),
            })
            .where(eq(listingPageStatus.listingId, listingId));
        }
      } catch (error) {
        // Listing still not available in subgraph
        await db
          .update(listingPageStatus)
          .set({
            lastCheckedAt: new Date(),
          })
          .where(eq(listingPageStatus.listingId, listingId));
      }
    }

    return NextResponse.json({
      status: record.status,
      listingId,
      sellerAddress: record.sellerAddress,
      readyAt: record.readyAt?.toISOString(),
      errorMessage: record.errorMessage,
      lastCheckedAt: record.lastCheckedAt?.toISOString(),
    });
  } catch (error) {
    console.error('[API /listings/[listingId]/page-status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check page status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/listings/[listingId]/page-status
 * Create or update the status of a listing page
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;
    const body = await req.json();
    const { status, sellerAddress, errorMessage } = body;
    
    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    if (!status || !['building', 'ready', 'error'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be building, ready, or error' },
        { status: 400 }
      );
    }

    if (!sellerAddress) {
      return NextResponse.json(
        { error: 'Seller address is required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Check if record exists
    const existing = await db
      .select()
      .from(listingPageStatus)
      .where(eq(listingPageStatus.listingId, listingId))
      .limit(1);

    const updateData: any = {
      status,
      sellerAddress,
      lastCheckedAt: new Date(),
    };

    if (status === 'ready') {
      updateData.readyAt = new Date();
    }

    if (status === 'error' && errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(listingPageStatus)
        .set(updateData)
        .where(eq(listingPageStatus.listingId, listingId));
    } else {
      // Create new record
      await db.insert(listingPageStatus).values({
        listingId,
        ...updateData,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      listingId,
      status,
    });
  } catch (error) {
    console.error('[API /listings/[listingId]/page-status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update page status' },
      { status: 500 }
    );
  }
}

