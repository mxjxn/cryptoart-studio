import { NextRequest, NextResponse } from 'next/server';
import { validateMembershipMiddleware } from '~/lib/auth';
import { getDatabase, airdropLists, eq, desc } from '@cryptoart/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { error: 'FID parameter is required' },
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

    const db = getDatabase();

    // Get all lists for the creator
    const lists = await db
      .select()
      .from(airdropLists)
      .where(eq(airdropLists.creatorFid, fidNumber))
      .orderBy(desc(airdropLists.createdAt));

    return NextResponse.json({
      lists,
      totalLists: lists.length,
    });
  } catch (error) {
    console.error('Failed to fetch airdrop lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch airdrop lists. Please try again.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, name, description } = body;

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'List name is required' },
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

    const db = getDatabase();

    // Create new airdrop list
    const [newList] = await db
      .insert(airdropLists)
      .values({
        creatorFid: fidNumber,
        name,
        description: description || null,
      })
      .returning();

    return NextResponse.json({
      list: newList,
      message: 'Airdrop list created successfully',
    });
  } catch (error) {
    console.error('Failed to create airdrop list:', error);
    return NextResponse.json(
      { error: 'Failed to create airdrop list. Please try again.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, listId, name, description } = body;

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    if (!listId) {
      return NextResponse.json(
        { error: 'List ID is required' },
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

    const db = getDatabase();

    // Update the list
    const [updatedList] = await db
      .update(airdropLists)
      .set({
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        updatedAt: new Date(),
      })
      .where(eq(airdropLists.id, listId))
      .returning();

    if (!updatedList) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      list: updatedList,
      message: 'Airdrop list updated successfully',
    });
  } catch (error) {
    console.error('Failed to update airdrop list:', error);
    return NextResponse.json(
      { error: 'Failed to update airdrop list. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const listId = searchParams.get('listId');

    if (!fid) {
      return NextResponse.json(
        { error: 'FID parameter is required' },
        { status: 400 }
      );
    }

    if (!listId) {
      return NextResponse.json(
        { error: 'List ID parameter is required' },
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

    const db = getDatabase();

    // Delete the list (this will cascade to recipients due to foreign key)
    const deletedList = await db
      .delete(airdropLists)
      .where(eq(airdropLists.id, parseInt(listId, 10)))
      .returning();

    if (deletedList.length === 0) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Airdrop list deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete airdrop list:', error);
    return NextResponse.json(
      { error: 'Failed to delete airdrop list. Please try again.' },
      { status: 500 }
    );
  }
}
