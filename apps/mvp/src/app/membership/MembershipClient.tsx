"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useConnect } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
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
      { name: 'payableAmount', type: 'uint256' },
      { name: 'numTokens', type: 'uint256' },
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

// ERC721 ABI for token queries
const ERC721_ABI = [
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export default function MembershipClient() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { isAuthenticated: isFarcasterAuth, profile: farcasterProfile } = useProfile();
  const { isPro, expirationDate, membershipAddress, timeRemainingSeconds, isFarcasterWallet, loading: statusLoading } = useMembershipStatus();
  const [periods, setPeriods] = useState(12); // Changed from "months" to "periods"
  const [showAddTime, setShowAddTime] = useState(false);
  
  // User is authenticated if they have a wallet connected OR are signed in via Farcaster web auth
  const isAuthenticated = isConnected || isFarcasterAuth;

  // Log membership status and wallet info
  useEffect(() => {
    console.log('[MembershipClient] Component state:', {
      address,
      isConnected,
      isFarcasterAuth,
      isAuthenticated,
      farcasterProfile: farcasterProfile ? {
        username: farcasterProfile.username,
        fid: farcasterProfile.fid,
      } : null,
      isPro,
      membershipAddress,
      isFarcasterWallet,
      expirationDate: expirationDate?.toISOString(),
      timeRemainingSeconds,
      statusLoading,
    });
  }, [address, isConnected, isFarcasterAuth, isAuthenticated, farcasterProfile, isPro, membershipAddress, isFarcasterWallet, expirationDate, timeRemainingSeconds, statusLoading]);

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

  // Log transaction state changes
  useEffect(() => {
    console.log('[MembershipClient] Transaction state:', {
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error: error?.message,
    });
  }, [hash, isPending, isConfirming, isSuccess, error]);

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
    console.log('[MembershipClient] handleSubscribe called', {
      address,
      isConnected,
      isPro,
      membershipAddress,
      isFarcasterWallet,
      pricePerPeriodWei: pricePerPeriodWei?.toString(),
      totalPriceWei: totalPriceWei.toString(),
      totalPriceEth,
      periods,
    });

    if (!address || !isConnected) {
      console.error('[MembershipClient] No wallet connected');
      alert("Please connect your wallet");
      return;
    }

    if (!pricePerPeriodWei) {
      console.error('[MembershipClient] No price available');
      alert("Unable to fetch price. Please try again.");
      return;
    }

    // Check if user has membership on a different wallet
    if (isPro && membershipAddress && membershipAddress.toLowerCase() !== address.toLowerCase()) {
      console.error('[MembershipClient] Wallet mismatch:', {
        connectedWallet: address.toLowerCase(),
        membershipWallet: membershipAddress.toLowerCase(),
        isFarcasterWallet,
      });
      
      // If membership is on Farcaster wallet but user is connected with MetaMask, warn them
      if (isFarcasterWallet) {
        alert(`Your membership is on your Farcaster wallet (${formatAddress(membershipAddress)}). Please switch to that wallet to add time, or manage your subscription on Hypersub.`);
        return;
      } else {
        // Membership is on external wallet, should have shown "manage on hypersub" link
        alert(`Your membership is on a different wallet (${formatAddress(membershipAddress)}). Please manage your subscription on Hypersub.`);
        return;
      }
    }

    console.log('[MembershipClient] Preparing transaction:', {
      contractAddress: STP_V2_CONTRACT_ADDRESS,
      functionName: 'mint',
      payableAmount: totalPriceWei.toString(),
      numTokens: '0',
      value: totalPriceWei.toString(),
      isRenewal: isPro,
    });

    try {
      // Use mint function with payableAmount (in wei) and numTokens (0 for ETH payment)
      // The contract handles both new subscriptions and renewals based on whether the user already has a subscription
      console.log('[MembershipClient] Calling writeContract...');
      writeContract({
        address: STP_V2_CONTRACT_ADDRESS as Address,
        abi: STP_V2_ABI,
        functionName: 'mint',
        args: [totalPriceWei, BigInt(0)], // payableAmount in wei, numTokens = 0 for ETH
        value: totalPriceWei,
      });
      console.log('[MembershipClient] writeContract called successfully');
    } catch (err) {
      console.error('[MembershipClient] Error in handleSubscribe:', err);
      alert(`Transaction error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

  // Calculate time subscribed (months and days) from expiration date
  // We can estimate time subscribed if we know the period duration
  const calculateTimeSubscribed = (): { months: number; days: number } | null => {
    if (!expirationDate || !timeRemainingSeconds || !periodDurationSeconds) {
      return null;
    }
    
    // Calculate total subscription duration
    // If we know period duration, we can estimate total time
    // But we need to know how many periods were purchased
    // For now, calculate from a rough estimate based on typical subscription length
    // TODO: Query actual subscription start date from contract or token metadata
    
    // Estimate: if time remaining is large, assume it's a long subscription
    // We can't accurately calculate without start date, so we'll show time remaining instead
    return null;
  };

  // Calculate time remaining from seconds
  const calculateTimeRemaining = (): { months: number; days: number; hours: number } | null => {
    if (!timeRemainingSeconds || timeRemainingSeconds <= 0) {
      return null;
    }
    
    const totalSeconds = timeRemainingSeconds;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    return { months, days: remainingDays, hours };
  };

  const timeSubscribed = calculateTimeSubscribed();
  const timeRemaining = calculateTimeRemaining();

  // Show sign-in prompt only if not authenticated at all (no Farcaster auth and no wallet)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#cccccc] mb-4">Please sign in to view membership options.</p>
        </div>
      </div>
    );
  }
  
  // Check if user needs to connect a wallet to transact (authenticated via Farcaster but no wallet connected)
  const needsWalletForTransaction = isFarcasterAuth && !isConnected;

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
              <div className="mb-4 p-3 bg-black rounded border border-[#333333]">
                <p className="text-xs text-[#999999] mb-1">Membership Address:</p>
                <p className="text-sm text-white font-mono break-all">{membershipAddress}</p>
              </div>
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
        ) : isPro && isFarcasterWallet ? (
          <>
            {/* Your Subscription Panel */}
            <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 mb-4">
              <h2 className="text-lg font-medium mb-4">Your Subscription</h2>
              <div className="space-y-3">
                <div className="p-3 bg-black rounded border border-[#333333]">
                  <p className="text-xs text-[#999999] mb-1">Time Remaining</p>
                  {timeRemaining ? (
                    <p className="text-lg text-white font-medium">
                      {timeRemaining.months > 0 && `${timeRemaining.months} month${timeRemaining.months !== 1 ? 's' : ''}`}
                      {timeRemaining.months > 0 && timeRemaining.days > 0 && ' and '}
                      {timeRemaining.days > 0 && `${timeRemaining.days} day${timeRemaining.days !== 1 ? 's' : ''}`}
                      {timeRemaining.months === 0 && timeRemaining.days === 0 && timeRemaining.hours > 0 && `${timeRemaining.hours} hour${timeRemaining.hours !== 1 ? 's' : ''}`}
                      {timeRemaining.months === 0 && timeRemaining.days === 0 && timeRemaining.hours === 0 && 'Less than 1 hour'}
                    </p>
                  ) : (
                    <p className="text-lg text-white font-medium">Calculating...</p>
                  )}
                </div>
                {timeSubscribed && (
                  <div className="p-3 bg-black rounded border border-[#333333]">
                    <p className="text-xs text-[#999999] mb-1">Time Subscribed</p>
                    <p className="text-sm text-white">
                      {timeSubscribed.months > 0 && `${timeSubscribed.months} month${timeSubscribed.months !== 1 ? 's' : ''}`}
                      {timeSubscribed.months > 0 && timeSubscribed.days > 0 && ' and '}
                      {timeSubscribed.days > 0 && `${timeSubscribed.days} day${timeSubscribed.days !== 1 ? 's' : ''}`}
                      {timeSubscribed.months === 0 && timeSubscribed.days === 0 && 'Less than 1 day'}
                    </p>
                  </div>
                )}
                {expirationDate && (
                  <div className="p-3 bg-black rounded border border-[#333333]">
                    <p className="text-xs text-[#999999] mb-1">Expires</p>
                    <p className="text-sm text-white">{formatDate(expirationDate)}</p>
                    <p className="text-xs text-[#cccccc] mt-1">{formatTimeRemaining(expirationDate)} remaining</p>
                  </div>
                )}
                {membershipAddress && (
                  <div className="p-3 bg-black rounded border border-[#333333]">
                    <p className="text-xs text-[#999999] mb-1">Membership Wallet</p>
                    <p className="text-sm text-white font-mono">{formatAddress(membershipAddress)}</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowAddTime(!showAddTime)}
                className="w-full mt-4 px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
              >
                {showAddTime ? 'Hide Add Time' : 'Add Time'}
              </button>
            </div>

            {/* Add Time Panel (shown when showAddTime is true) */}
            {showAddTime && (
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
                    Transaction successful! Your membership has been renewed.
                  </div>
                )}

                {needsWalletForTransaction ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[#cccccc] text-center mb-3">
                      Connect a wallet to add time to your membership
                    </p>
                    {connectors.map((connector) => (
                      <button
                        key={connector.uid}
                        onClick={() => connect({ connector })}
                        disabled={isConnectPending}
                        className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnectPending ? "Connecting..." : `Connect ${connector.name}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={handleSubscribe}
                    disabled={isPending || isConfirming || statusLoading}
                    className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending || isConfirming
                      ? "Processing..."
                      : isSuccess
                      ? "Success!"
                      : "Add Time"}
                  </button>
                )}
              </div>
            )}
          </>
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

          {needsWalletForTransaction ? (
            <div className="space-y-3">
              <p className="text-sm text-[#cccccc] text-center mb-3">
                Connect a wallet to {isPro ? "renew your membership" : "mint your membership"}
              </p>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isConnectPending}
                  className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnectPending ? "Connecting..." : `Connect ${connector.name}`}
                </button>
              ))}
            </div>
          ) : (
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
          )}
          </div>
        )}
      </div>
    </div>
  );
}

