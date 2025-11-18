import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { getSalesForCollection } from '@cryptoart/unified-indexer'

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params
    const { searchParams } = new URL(request.url)
    const chainId = parseInt(searchParams.get('chainId') || '8453', 10) // Default to Base Mainnet
    const first = parseInt(searchParams.get('first') || '100', 10)
    const skip = parseInt(searchParams.get('skip') || '0', 10)

    if (!isAddress(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    const sales = await getSalesForCollection(address as `0x${string}`, chainId, {
      first,
      skip,
    })

    return NextResponse.json(sales)
  } catch (error) {
    console.error('Error fetching collection sales:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sales data' },
      { status: 500 }
    )
  }
}

