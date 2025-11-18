'use client'

import React, { useState, useEffect } from 'react'
import { Address } from 'viem'
import { getSalesForCollection, type CollectionSales } from '@cryptoart/unified-indexer'
import { CreatePoolForm } from './CreatePoolForm'
import { CreateListingForm } from './CreateListingForm'
import { PoolDetails } from './PoolDetails'
import { AuctionDetails } from './AuctionDetails'
import { Loader2 } from 'lucide-react'

interface CollectionSalesViewProps {
  collectionAddress: Address | string
  chainId?: number
}

export function CollectionSalesView({
  collectionAddress,
  chainId = 8453,
}: CollectionSalesViewProps) {
  const [salesData, setSalesData] = useState<CollectionSales | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreatePool, setShowCreatePool] = useState(false)
  const [showCreateListing, setShowCreateListing] = useState(false)
  const [activeTab, setActiveTab] = useState<'pools' | 'auctions'>('pools')

  useEffect(() => {
    async function fetchSalesData() {
      try {
        setLoading(true)
        setError(null)
        const data = await getSalesForCollection(collectionAddress, chainId)
        setSalesData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sales data')
      } finally {
        setLoading(false)
      }
    }

    if (collectionAddress) {
      fetchSalesData()
    }
  }, [collectionAddress, chainId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading sales data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">Error: {error}</p>
      </div>
    )
  }

  if (!salesData) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sales Options</h2>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowCreatePool(true)
              setShowCreateListing(false)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Create Pool
          </button>
          <button
            onClick={() => {
              setShowCreateListing(true)
              setShowCreatePool(false)
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Create Listing
          </button>
        </div>
      </div>

      {/* Create forms */}
      {showCreatePool && (
        <CreatePoolForm
          nftContract={collectionAddress as string}
          onSuccess={() => {
            setShowCreatePool(false)
            // Refresh sales data
            window.location.reload()
          }}
        />
      )}

      {showCreateListing && (
        <CreateListingForm
          nftContract={collectionAddress as string}
          onSuccess={() => {
            setShowCreateListing(false)
            // Refresh sales data
            window.location.reload()
          }}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pools')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pools'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pools ({salesData.pools.length})
          </button>
          <button
            onClick={() => setActiveTab('auctions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'auctions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Auctions ({salesData.auctions.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'pools' && (
        <div className="space-y-4">
          {salesData.pools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pools found for this collection.</p>
              <p className="text-sm mt-2">Create a pool to enable instant buy/sell.</p>
            </div>
          ) : (
            salesData.pools.map((pool) => (
              <PoolDetails key={pool.id} pool={pool} />
            ))
          )}
        </div>
      )}

      {activeTab === 'auctions' && (
        <div className="space-y-4">
          {salesData.auctions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No auctions found for this collection.</p>
              <p className="text-sm mt-2">Create a listing to enable auction sales.</p>
            </div>
          ) : (
            salesData.auctions.map((auction) => (
              <AuctionDetails key={auction.id} auction={auction} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
