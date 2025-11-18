'use client'

import React, { useState } from 'react'
import { Address, isAddress, parseEther } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from '@/lib/contracts/marketplace'
import { Button } from '@/components/ui/Button'

interface CreateGalleryListingFormProps {
  chainId: number
  nftContract: Address
  tokenId: string
  tokenSpec: 'ERC721' | 'ERC1155'
  onSuccess?: (listingId: string) => void
  onError?: (error: Error) => void
}

export function CreateGalleryListingForm({
  chainId,
  nftContract,
  tokenId,
  tokenSpec,
  onSuccess,
  onError,
}: CreateGalleryListingFormProps) {
  const { address: userAddress, isConnected } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [price, setPrice] = useState('0.1')
  const [quantity, setQuantity] = useState('1')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !userAddress) {
      onError?.(new Error('Please connect your wallet'))
      return
    }

    try {
      // TODO: Implement gallery listing creation using MARKETPLACE_ABI
      // This is a placeholder - actual implementation depends on the auctionhouse contract interface
      // Gallery listings are fixed-price (FIXED_PRICE listing type) without reserve
      console.log('Creating gallery listing:', {
        nftContract,
        tokenId,
        price,
        quantity,
      })

      // Placeholder - replace with actual contract call
      onError?.(new Error('Gallery listing creation not yet implemented'))
    } catch (error) {
      onError?.(error as Error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Price (ETH)</label>
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="0.1"
        />
      </div>

      {tokenSpec === 'ERC1155' && (
        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="1"
          />
        </div>
      )}

      <Button
        type="submit"
        isLoading={isPending || isConfirming}
        disabled={!isConnected || isPending || isConfirming}
      >
        {isPending || isConfirming ? 'Creating Listing...' : 'Create Gallery Listing'}
      </Button>
    </form>
  )
}

