'use client'

import React, { useState } from 'react'
import { Address, isAddress, parseEther } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from '@/lib/contracts/marketplace'
import { Button } from '@/components/ui/Button'

interface CreateAuctionFormProps {
  chainId: number
  nftContract: Address
  tokenId: string
  tokenSpec: 'ERC721' | 'ERC1155'
  onSuccess?: (listingId: string) => void
  onError?: (error: Error) => void
}

export function CreateAuctionForm({
  chainId,
  nftContract,
  tokenId,
  tokenSpec,
  onSuccess,
  onError,
}: CreateAuctionFormProps) {
  const { address: userAddress, isConnected } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [reservePrice, setReservePrice] = useState('0.1')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [minIncrementBPS, setMinIncrementBPS] = useState('500') // 5%

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !userAddress) {
      onError?.(new Error('Please connect your wallet'))
      return
    }

    try {
      // TODO: Implement auction creation using MARKETPLACE_ABI
      // This is a placeholder - actual implementation depends on the auctionhouse contract interface
      console.log('Creating auction:', {
        nftContract,
        tokenId,
        reservePrice,
        startTime,
        endTime,
      })

      // Placeholder - replace with actual contract call
      onError?.(new Error('Auction creation not yet implemented'))
    } catch (error) {
      onError?.(error as Error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Reserve Price (ETH)</label>
        <input
          type="text"
          value={reservePrice}
          onChange={(e) => setReservePrice(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="0.1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Start Time</label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">End Time</label>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Min Increment (basis points, e.g., 500 = 5%)</label>
        <input
          type="text"
          value={minIncrementBPS}
          onChange={(e) => setMinIncrementBPS(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="500"
        />
      </div>

      <Button
        type="submit"
        isLoading={isPending || isConfirming}
        disabled={!isConnected || isPending || isConfirming}
      >
        {isPending || isConfirming ? 'Creating Auction...' : 'Create Auction'}
      </Button>
    </form>
  )
}

