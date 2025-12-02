"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";
import { type Address, parseEther, formatEther } from "viem";
import Link from "next/link";

// STP v2 ABI for subscription functions
const STP_V2_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'mintAdvanced',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'tierId', type: 'uint16' },
      { name: 'referralCode', type: 'uint256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'tierDetail',
    inputs: [
      { name: 'tierId', type: 'uint16' },
    ],
    outputs: [
      {
        name: 'tier',
        type: 'tuple',
        components: [
          { name: 'subCount', type: 'uint32' },
          { name: 'id', type: 'uint16' },
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'periodDurationSeconds', type: 'uint32' },
              { name: 'maxSupply', type: 'uint32' },
              { name: 'maxCommitmentSeconds', type: 'uint48' },
              { name: 'startTimestamp', type: 'uint48' },
              { name: 'endTimestamp', type: 'uint48' },
              { name: 'rewardCurveId', type: 'uint8' },
              { name: 'rewardBasisPoints', type: 'uint16' },
              { name: 'paused', type: 'bool' },
              { name: 'transferrable', type: 'bool' },
              { name: 'initialMintPrice', type: 'uint256' },
              { name: 'pricePerPeriod', type: 'uint256' },
              {
                name: 'gate',
                type: 'tuple',
                components: [
                  { name: 'gateType', type: 'uint8' },
                  { name: 'contractAddress', type: 'address' },
                  { name: 'componentId', type: 'uint256' },
                  { name: 'balanceMin', type: 'uint256' },
                ],
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

function formatPeriodDuration(durationSeconds?: bigint) {
  if (durationSeconds === undefined || durationSeconds === null) {
    return null;
  }
  const seconds = Number(durationSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const days = seconds / 86400;
  if (Number.isInteger(days)) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const hours = seconds / 3600;
  if (Number.isInteger(hours)) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const minutes = seconds / 60;
  if (Number.isInteger(minutes)) {
    return `${minutes} min${minutes === 1 ? "" : "s"}`;
  }

  return `${seconds} sec${seconds === 1 ? "" : "s"}`;
}

export default function MembershipClient() {
  const { address, isConnected } = useAccount();
  const { isPro, expirationDate, membershipAddress, isFarcasterWallet, loading: statusLoading } = useMembershipStatus();
  const [periods, setPeriods] = useState(12); // Changed from "months" to "periods"

  // Read tier detail (tier 1) from contract to get price per period
  // Note: This doesn't require wallet connection, so we can always read it
  const { data: tierDetailResult, isLoading: loadingPrice, error: priceError } = useReadContract({
    address: STP_V2_CONTRACT_ADDRESS as Address,
    abi: STP_V2_ABI,
    functionName: 'tierDetail',
    args: [1 as const], // Tier ID 1 (uint16)
    query: {
      enabled: true, // Always enabled since we're just reading
      retry: 2,
    },
  });

  // Extract price per period from tier detail
  // tierDetail returns: { tier: { subCount, id, params: { ..., pricePerPeriod, ... } } }
  // The result is a tuple with one element named 'tier'
  type TierParams = {
    pricePerPeriod?: bigint;
    periodDurationSeconds?: bigint;
    initialMintPrice?: bigint;
  };

  type TierState = {
    subCount?: number;
    id?: number;
    params?: TierParams;
  };

  // viem decodes the single `tier` return value directly as the struct,
  // so tierDetailResult already matches TierState.
  const tierState = tierDetailResult as TierState | undefined;
  const tierParams = tierState?.params;

  const pricePerMonthWei = tierParams?.pricePerPeriod;
  const periodDurationSeconds = tierParams?.periodDurationSeconds;
  const periodDurationLabel = formatPeriodDuration(periodDurationSeconds);

  // Debug logging
  useEffect(() => {
    if (priceError) {
      console.error('Price read error:', priceError);
    }
    if (tierDetailResult) {
      console.log('Tier detail result:', tierDetailResult);
    }
    if (pricePerMonthWei !== undefined) {
      console.log('Price per period (wei):', pricePerMonthWei);
      console.log('Price per period (ETH):', pricePerMonthWei ? formatEther(pricePerMonthWei) : 'N/A');
    }
  }, [priceError, tierDetailResult, pricePerMonthWei]);

  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        reset();
      }, 3000);
    }
  }, [isSuccess, reset]);

  // Calculate total price based on price per period and number of periods
  // The amount should include initialMintPrice if this is a new subscription
  const initialMintPriceWei = tierParams?.initialMintPrice ?? BigInt(0);
  const pricePerPeriodWei = tierParams?.pricePerPeriod ?? BigInt(0);
  
  // For existing subscriptions (renewal), only charge pricePerPeriod * periods
  // For new subscriptions, charge initialMintPrice + (pricePerPeriod * periods)
  const totalPriceWei = isPro
    ? pricePerPeriodWei * BigInt(periods) // Renewal: no initial mint price
    : initialMintPriceWei + (pricePerPeriodWei * BigInt(periods)); // New: initial + periods

  const totalPriceEth = formatEther(totalPriceWei);
  const pricePerPeriodEth = pricePerPeriodWei ? formatEther(pricePerPeriodWei) : "0";

  const handleSubscribe = async () => {
    if (!address || !isConnected) {
      alert("Please connect your wallet");
      return;
    }

    if (!pricePerPeriodWei) {
      alert("Unable to fetch price. Please try again.");
      return;
    }

    try {
      // Use mint function with the total amount in wei
      // The contract handles both new subscriptions and renewals based on whether the user already has a subscription
      writeContract({
        address: STP_V2_CONTRACT_ADDRESS as Address,
        abi: STP_V2_ABI,
        functionName: 'mint',
        args: [totalPriceWei],
        value: totalPriceWei,
      });
    } catch (err) {
      console.error("Error subscribing:", err);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTimeRemaining = (expirationDate: Date) => {
    const now = new Date();
    const diff = expirationDate.getTime() - now.getTime();
    
    if (diff <= 0) {
      return "Expired";
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? `, ${hours} hour${hours !== 1 ? 's' : ''}` : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? `, ${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };

  const formatAddress = (addr: string | null) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#cccccc] mb-4">Please connect your wallet to view membership options.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2 mb-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-3xl font-light mb-2">Membership</h1>
          {statusLoading ? (
            <p className="text-sm text-[#cccccc]">Loading membership status...</p>
          ) : isPro ? (
            <div className="space-y-2">
              <p className="text-sm text-[#cccccc]">
                {expirationDate
                  ? `Your membership expires on ${formatDate(expirationDate)}`
                  : "You have an active membership"}
              </p>
              {expirationDate && (
                <p className="text-sm text-white font-medium">
                  Time remaining: {formatTimeRemaining(expirationDate)}
                </p>
              )}
              {membershipAddress && (
                <p className="text-sm text-[#cccccc]">
                  Membership wallet: <span className="text-white font-mono">{formatAddress(membershipAddress)}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#cccccc]">
              Get access to create auctions and premium features
            </p>
          )}
        </div>

        {/* Show different UI based on membership status and wallet */}
        {isPro && !isFarcasterWallet && membershipAddress ? (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium mb-2">Membership in Another Wallet</h2>
              <p className="text-sm text-[#cccccc] mb-4">
                Your membership is active in a different verified wallet. To manage your subscription, 
                please visit Hypersub directly.
              </p>
            </div>
            <a
              href="https://hypersub.xyz/s/cryptoart"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors inline-block text-center"
            >
              Manage on Hypersub →
            </a>
          </div>
        ) : (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
            <div className="mb-6">
            <label className="block text-sm text-[#cccccc] mb-3">
              Duration (number of periods)
            </label>
            <div className="flex gap-2">
              {[1, 3, 6, 12, 24].map((value) => (
                <button
                  key={value}
                  onClick={() => setPeriods(value)}
                  className={`px-4 py-2 text-sm rounded border transition-colors ${
                    periods === value
                      ? "bg-white text-black border-white"
                      : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
                  }`}
                >
                  {value}p
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 p-4 bg-black rounded border border-[#333333]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[#999999]">
                {periodDurationLabel ? `Price per period (${periodDurationLabel})` : "Price per period"}
              </span>
              <span className="text-white">
                {loadingPrice ? "Loading..." : priceError ? "Error loading price" : pricePerMonthWei ? `${parseFloat(pricePerPeriodEth).toFixed(4)} ETH` : "0.0000 ETH"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#999999]">Total ({periods} periods)</span>
              <span className="text-xl font-medium text-white">
                {loadingPrice ? "..." : priceError ? "Error" : totalPriceWei ? `${parseFloat(totalPriceEth).toFixed(4)} ETH` : "0.0000 ETH"}
              </span>
            </div>
            {periodDurationLabel && (
              <div className="flex justify-between items-center mt-2 text-sm text-[#cccccc]">
                <span>Period length</span>
                <span>{periodDurationLabel}</span>
              </div>
            )}
            {priceError && (
              <div className="mt-2 text-xs text-red-400">
                Failed to load price. Please check contract address and network.
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
              Error: {error.message}
            </div>
          )}

          {isSuccess && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500 rounded text-green-400 text-sm">
              Transaction successful! Your membership has been {isPro ? "renewed" : "activated"}.
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={isPending || isConfirming || statusLoading}
            className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending || isConfirming
              ? "Processing..."
              : isSuccess
              ? "Success!"
              : isPro
              ? "Renew Membership"
              : "Mint Membership"}
          </button>
          </div>
        )}
      </div>
    </div>
  );
}

