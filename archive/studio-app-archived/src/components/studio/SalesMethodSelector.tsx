'use client'

import React from 'react'

export type SalesMethod = 'pool' | 'auction' | 'gallery'

interface SalesMethodSelectorProps {
  value: SalesMethod | null
  onChange: (value: SalesMethod) => void
  className?: string
}

export function SalesMethodSelector({ value, onChange, className = '' }: SalesMethodSelectorProps) {
  const options: { value: SalesMethod; label: string; description: string }[] = [
    {
      value: 'pool',
      label: 'NFT Trade Pool',
      description: 'Enable royalties, pool fees, and allow reselling at current price',
    },
    {
      value: 'auction',
      label: 'Auction',
      description: 'Traditional auction with reserve price',
    },
    {
      value: 'gallery',
      label: 'Gallery Listing',
      description: 'Fixed price listing, no reserve',
    },
  ]

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium mb-2">Sales Method</label>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
              value === option.value
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="salesMethod"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-gray-500 mt-1">{option.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
