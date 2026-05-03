import { NextRequest, NextResponse } from "next/server";
import { getDatabase, listingPageStatus, eq } from "@cryptoart/db";
import { resolveListingFromSubgraph } from "~/lib/server/auction";

/** After this long in `building` with no subgraph listing, treat as missing (stale row or invalid ID). */
const BUILDING_NO_AUCTION_GRACE_MS = 3 * 60 * 1000;

/**
 * GET /api/listings/[listingId]/page-status
 * Check the status of a listing page (building/ready/not_found/error)
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
    let statusRecord;
    try {
      statusRecord = await db
        .select()
        .from(listingPageStatus)
        .where(eq(listingPageStatus.listingId, listingId))
        .limit(1);
    } catch (error: any) {
      // Table doesn't exist yet - return building status
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return NextResponse.json({
          status: 'building',
          listingId,
          sellerAddress: null,
        });
      }
      throw error;
    }

    if (statusRecord.length === 0) {
      // No status record exists - check if listing is available in subgraph.
      // If it is, mark as ready; otherwise return not_found.
      // Use subgraph-only resolution (no metadata/IPFS) so this route stays fast.
      try {
        const listing = await resolveListingFromSubgraph(listingId);
        if (listing) {
          // Listing exists in subgraph, create ready status
          try {
            await db.insert(listingPageStatus).values({
              listingId,
              status: 'ready',
              sellerAddress: listing.seller || '',
              readyAt: new Date(),
              lastCheckedAt: new Date(),
            });
          } catch (insertError: any) {
            // Table might not exist - just return ready status without saving
            if (insertError?.code === '42P01' || insertError?.message?.includes('does not exist')) {
              return NextResponse.json({
                status: 'ready',
                listingId,
                sellerAddress: listing.seller || '',
                readyAt: new Date().toISOString(),
              });
            }
            throw insertError;
          }
          
          return NextResponse.json({
            status: 'ready',
            listingId,
            sellerAddress: listing.seller || '',
            readyAt: new Date().toISOString(),
          });
        }
      } catch {
        // Listing lookup failed, fall through to not_found for missing record path
      }
      
      return NextResponse.json({
        status: 'not_found',
        listingId,
        sellerAddress: null,
      });
    }

    const record = statusRecord[0];
    
    // If status is building, check if it's ready now
    if (record.status === 'building') {
      try {
        // Subgraph-only: avoid getAuctionServer + HEAD opengraph (duplicated heavy work
        // that blocked listing pages). OG image generates on first real request/share.
        const listing = await resolveListingFromSubgraph(listingId);
        if (listing) {
          try {
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
          } catch (updateError: any) {
            if (updateError?.code === '42P01' || updateError?.message?.includes('does not exist')) {
              return NextResponse.json({
                status: 'ready',
                listingId,
                sellerAddress: record.sellerAddress,
                readyAt: new Date().toISOString(),
              });
            }
            throw updateError;
          }
        } else {
          // Subgraph has no listing — keep `building` only during initial indexing window
          const createdAtMs = record.createdAt
            ? new Date(record.createdAt).getTime()
            : 0;
          const ageMs = Date.now() - createdAtMs;

          if (ageMs >= BUILDING_NO_AUCTION_GRACE_MS) {
            try {
              await db
                .update(listingPageStatus)
                .set({
                  status: 'not_found',
                  lastCheckedAt: new Date(),
                })
                .where(eq(listingPageStatus.listingId, listingId));
            } catch (updateError: any) {
              if (
                updateError?.code === '42P01' ||
                updateError?.message?.includes('does not exist')
              ) {
                return NextResponse.json({
                  status: 'not_found',
                  listingId,
                  sellerAddress: record.sellerAddress,
                });
              }
              throw updateError;
            }

            return NextResponse.json({
              status: 'not_found',
              listingId,
              sellerAddress: record.sellerAddress,
              lastCheckedAt: new Date().toISOString(),
            });
          }

          try {
            await db
              .update(listingPageStatus)
              .set({
                lastCheckedAt: new Date(),
              })
              .where(eq(listingPageStatus.listingId, listingId));
          } catch (updateError: any) {
            if (
              updateError?.code === '42P01' ||
              updateError?.message?.includes('does not exist')
            ) {
              // ignore
            } else {
              throw updateError;
            }
          }
        }
      } catch (error) {
        // Listing still not available in subgraph
        try {
          await db
            .update(listingPageStatus)
            .set({
              lastCheckedAt: new Date(),
            })
            .where(eq(listingPageStatus.listingId, listingId));
        } catch (updateError: any) {
          // Table might not exist - ignore
          if (updateError?.code === '42P01' || updateError?.message?.includes('does not exist')) {
            // Just continue
          } else {
            throw updateError;
          }
        }
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
    let existing;
    try {
      existing = await db
        .select()
        .from(listingPageStatus)
        .where(eq(listingPageStatus.listingId, listingId))
        .limit(1);
    } catch (error: any) {
      // Table doesn't exist yet - return error
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Database table not initialized. Please run migrations.' },
          { status: 503 }
        );
      }
      throw error;
    }

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

