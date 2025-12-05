"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useConnect, usePublicClient, useBalance } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";
import { type Address, parseEther, formatEther, decodeErrorResult } from "viem";
import Link from "next/link";

// STP v2 ABI for subscription functions
// NOTE: Error definitions are critical for proper error decoding. Without them, 
// contract reverts will show as "<unknown>" in wallets like Farcaster.
// These are common errors that subscription contracts typically use.
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
  // NOTE: Error definitions would go here if we had the actual contract ABI.
  // Custom errors ARE part of the contract interface - when a contract reverts with
  // `error MyError(uint256)`, that error is encoded on-chain. To decode it, we need
  // the error definition in the ABI. However, we don't know what errors the STP_V2
  // contract actually defines, so we rely on simulation to catch errors before sending.
  // 
  // If you have access to the actual contract source or full ABI, add the real error
  // definitions here to enable proper error decoding.
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
  const { memberships, primaryMembership, isPro, expirationDate, membershipAddress, timeRemainingSeconds, isFarcasterWallet, loading: statusLoading } = useMembershipStatus();
  const [periods, setPeriods] = useState(12); // Changed from "months" to "periods"
  const [showAddTime, setShowAddTime] = useState(false);
  
  // User is authenticated if they have a wallet connected OR are signed in via Farcaster web auth
  const isAuthenticated = isConnected || isFarcasterAuth;
  
  // Separate memberships by wallet type
  const connectedWalletMemberships = memberships.filter(m => 
    address && m.address.toLowerCase() === address.toLowerCase()
  );
  const otherWalletMemberships = memberships.filter(m => 
    !address || m.address.toLowerCase() !== address.toLowerCase()
  );
  
  // Check if user already has membership in connected wallet
  const hasMembershipInConnectedWallet = connectedWalletMemberships.length > 0;
  
  // Check if user has any other memberships (for duplicate warning)
  const hasOtherMemberships = otherWalletMemberships.length > 0;

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
      totalMemberships: memberships.length,
      connectedWalletMemberships: connectedWalletMemberships.length,
      otherWalletMemberships: otherWalletMemberships.length,
      isPro,
      membershipAddress,
      isFarcasterWallet,
      expirationDate: expirationDate?.toISOString(),
      timeRemainingSeconds,
      statusLoading,
    });
  }, [address, isConnected, isFarcasterAuth, isAuthenticated, farcasterProfile, memberships, connectedWalletMemberships, otherWalletMemberships, isPro, membershipAddress, isFarcasterWallet, expirationDate, timeRemainingSeconds, statusLoading]);

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
  const publicClient = usePublicClient();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Get user's ETH balance to check for sufficient funds
  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    address: address,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Helper function to extract and decode error data
  const extractErrorDetails = (err: any): { decodedError: any | null; errorMessage: string } => {
    let errorData: string | undefined;
    let errorReason: string | undefined;
    let shortMessage: string | undefined;
    
    // Check the cause chain
    let current: any = err;
    let depth = 0;
    while (current && depth < 10) {
      // Check for data property
      if (current.data && typeof current.data === 'string' && current.data.startsWith('0x') && current.data.length > 10) {
        errorData = current.data;
        break;
      }
      
      // Check for reason or shortMessage
      if (current.reason && typeof current.reason === 'string') {
        errorReason = current.reason;
      }
      if (current.shortMessage && typeof current.shortMessage === 'string') {
        shortMessage = current.shortMessage;
      }
      
      // Check for error property
      if (current.error?.data && typeof current.error.data === 'string' && current.error.data.startsWith('0x')) {
        errorData = current.error.data;
        break;
      }
      
      // Move to next level
      current = current.cause || current.error;
      depth++;
    }
    
    // Also check direct properties
    if (!errorData) {
      const propsToCheck = ['data', 'errorData', 'revertData', 'returnData'];
      for (const prop of propsToCheck) {
        if (err[prop] && typeof err[prop] === 'string' && err[prop].startsWith('0x')) {
          errorData = err[prop];
          break;
        }
      }
    }
    
    // Try to decode the error if we have error data
    let decodedError: { errorName: string; args?: any } | null = null;
    if (errorData && typeof errorData === 'string' && errorData.startsWith('0x') && errorData.length > 10) {
      try {
        decodedError = decodeErrorResult({
          abi: STP_V2_ABI,
          data: errorData as `0x${string}`,
        });
        console.log('[MembershipClient] Decoded error:', decodedError);
      } catch (decodeErr) {
        console.warn('[MembershipClient] Could not decode error:', decodeErr);
      }
    }
    
    // Build error message
    // If we successfully decoded an error, use its name (we don't have a mapping since
    // we don't know the actual contract errors - those would need to be added if we
    // get the real contract ABI)
    let errorMessage = '';
    if (decodedError) {
      // Use the decoded error name - if we had the real ABI with error definitions,
      // we could map these to user-friendly messages
      errorMessage = `Contract error: ${decodedError.errorName}`;
    } else if (errorReason) {
      errorMessage = errorReason;
    } else if (shortMessage) {
      errorMessage = shortMessage;
    } else if (err?.message) {
      const msg = err.message;
      if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
        errorMessage = 'Insufficient ETH balance. Please ensure you have enough ETH to cover the membership cost plus gas fees.';
      } else if (msg.includes('user rejected') || msg.includes('rejected')) {
        errorMessage = 'Transaction was rejected.';
      } else if (msg.includes('execution reverted') || msg.includes('<unknown>')) {
        errorMessage = 'The contract rejected the transaction. This could be due to insufficient funds, invalid parameters, or contract-specific restrictions.';
      } else {
        errorMessage = msg;
      }
    } else {
      errorMessage = 'Transaction failed. Please check your balance and try again.';
    }
    
    return { decodedError, errorMessage };
  };

  // Log transaction state changes and handle errors
  useEffect(() => {
    console.log('[MembershipClient] Transaction state:', {
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error: error?.message,
    });
    
    // Log detailed error information if available
    if (error) {
      console.error('[MembershipClient] Transaction error details:', {
        message: error.message,
        name: error.name,
        cause: error.cause,
        stack: error.stack,
        // Check for additional error properties
        ...(error as any).data && { data: (error as any).data },
        ...(error as any).shortMessage && { shortMessage: (error as any).shortMessage },
      });
      
      // Try to extract and decode the error
      const errorDetails = extractErrorDetails(error);
      console.log('[MembershipClient] Extracted error details:', errorDetails);
    }
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
  // Check if connected wallet has membership for renewal logic
  const totalPriceWei = hasMembershipInConnectedWallet
    ? pricePerPeriodWei * BigInt(periods) // Renewal: no initial mint price
    : initialMintPriceWei + (pricePerPeriodWei * BigInt(periods)); // New: initial + periods

  const totalPriceEth = formatEther(totalPriceWei);
  const pricePerPeriodEth = pricePerPeriodWei ? formatEther(pricePerPeriodWei) : "0";

  // Check if user has sufficient balance (total price + estimated gas fees)
  // Estimate gas: ~0.001 ETH should be more than enough for a simple mint transaction
  const estimatedGasFee = parseEther("0.0001");
  const totalRequired = totalPriceWei + estimatedGasFee;
  const userBalance = balanceData?.value ?? BigInt(0);
  const hasInsufficientBalance = address && isConnected && userBalance < totalRequired;
  const insufficientAmount = hasInsufficientBalance ? totalRequired - userBalance : BigInt(0);

  // Helper to format months remaining from seconds
  const formatMonthsRemaining = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    if (months > 0) {
      return `${months} month${months !== 1 ? 's' : ''}${remainingDays > 0 ? ` and ${remainingDays} day${remainingDays !== 1 ? 's' : ''}` : ''}`;
    } else if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return hours > 0 ? `${hours} hour${hours !== 1 ? 's' : ''}` : 'Less than 1 hour';
    }
  };

  const handleSubscribe = async () => {
    console.log('[MembershipClient] handleSubscribe called', {
      address,
      isConnected,
      hasMembershipInConnectedWallet,
      hasOtherMemberships,
      totalMemberships: memberships.length,
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

    if (!publicClient) {
      console.error('[MembershipClient] No public client available');
      alert("Unable to connect to blockchain. Please try again.");
      return;
    }

    // Check balance before attempting transaction
    if (hasInsufficientBalance) {
      const neededEth = formatEther(insufficientAmount);
      alert(`Insufficient ETH balance. You need at least ${parseFloat(totalPriceEth).toFixed(4)} ETH for the membership plus approximately 0.001 ETH for gas fees. You currently have ${balanceData?.formatted || "0"} ETH. Please add at least ${parseFloat(neededEth).toFixed(4)} more ETH.`);
      return;
    }

    // If user already has membership in connected wallet, proceed with renewal
    // If user has membership in another wallet, still allow minting (they can have multiple)
    // But show a warning if they're trying to mint a duplicate
    if (hasOtherMemberships && !hasMembershipInConnectedWallet) {
      // User has membership elsewhere but not in connected wallet
      // This is allowed - they can have multiple memberships
      // The UI will show a warning
    }

    console.log('[MembershipClient] Preparing transaction:', {
      contractAddress: STP_V2_CONTRACT_ADDRESS,
      functionName: 'mint',
      payableAmount: totalPriceWei.toString(),
      numTokens: '0',
      value: totalPriceWei.toString(),
      isRenewal: hasMembershipInConnectedWallet,
    });

    try {
      // First, simulate the transaction to catch errors early and get better error messages
      console.log('[MembershipClient] Simulating transaction...');
      try {
        await publicClient.simulateContract({
          account: address,
          address: STP_V2_CONTRACT_ADDRESS as Address,
          abi: STP_V2_ABI,
          functionName: 'mint',
          args: [totalPriceWei, BigInt(0)], // payableAmount in wei, numTokens = 0 for ETH
          value: totalPriceWei,
        });
        console.log('[MembershipClient] Simulation successful');
      } catch (simErr: any) {
        console.error('[MembershipClient] Simulation failed:', simErr);
        
        // Use the helper function to extract and decode error
        const errorDetails = extractErrorDetails(simErr);
        
        // Build a user-friendly error message
        const errorMessage = `Transaction would fail: ${errorDetails.errorMessage}`;
        
        alert(errorMessage);
        return;
      }

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
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide a more helpful error message
      if (errorMsg.includes('user rejected') || errorMsg.includes('rejected')) {
        alert('Transaction was rejected. Please try again.');
      } else {
        alert(`Transaction error: ${errorMsg}`);
      }
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

  // Helper to calculate time remaining from seconds (for individual memberships)
  const calculateTimeRemainingFromSeconds = (seconds: number): { months: number; days: number; hours: number } | null => {
    if (!seconds || seconds <= 0) {
      return null;
    }
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
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
          ) : memberships.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-[#cccccc]">
                You have {memberships.length} active membership{memberships.length !== 1 ? 's' : ''}
              </p>
              {primaryMembership && (
                <p className="text-sm text-white font-medium">
                  Primary: {formatTimeRemaining(primaryMembership.expirationDate)} remaining
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#cccccc]">
              Get access to create auctions and premium features
            </p>
          )}
        </div>

        {/* Display all memberships */}
        {statusLoading ? (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
            <p className="text-[#cccccc] text-center">Loading memberships...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Memberships in connected wallet */}
            {connectedWalletMemberships.length > 0 && (
              <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4">Your Active Membership{connectedWalletMemberships.length !== 1 ? 's' : ''}</h2>
                <div className="space-y-3 mb-4">
                  {connectedWalletMemberships.map((membership, idx) => {
                    const timeRemaining = calculateTimeRemainingFromSeconds(membership.timeRemainingSeconds);
                    return (
                      <div key={idx} className="p-3 bg-black rounded border border-[#333333]">
                        <div className="flex justify-between items-start mb-2">
                          <div>
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
                        </div>
                        <div className="space-y-1 mt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-[#999999]">Expires</span>
                            <span className="text-white">{formatDate(membership.expirationDate)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#999999]">Wallet</span>
                            <span className="text-white font-mono">{formatAddress(membership.address)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Memberships in other wallets */}
            {otherWalletMemberships.length > 0 && (
              <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
                <h2 className="text-lg font-medium mb-2">Membership{otherWalletMemberships.length !== 1 ? 's' : ''} in Other Wallet{otherWalletMemberships.length !== 1 ? 's' : ''}</h2>
                <p className="text-sm text-[#cccccc] mb-4">
                  You have active membership{otherWalletMemberships.length !== 1 ? 's' : ''} in other verified wallet{otherWalletMemberships.length !== 1 ? 's' : ''}. 
                  To manage {otherWalletMemberships.length === 1 ? 'it' : 'them'}, please visit Hypersub.
                </p>
                <div className="space-y-3 mb-4">
                  {otherWalletMemberships.map((membership, idx) => {
                    const timeRemaining = calculateTimeRemainingFromSeconds(membership.timeRemainingSeconds);
                    return (
                      <div key={idx} className="p-3 bg-black rounded border border-[#333333]">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-xs text-[#999999] mb-1">Time Remaining</p>
                            {timeRemaining ? (
                              <p className="text-sm text-white font-medium">
                                {timeRemaining.months > 0 && `${timeRemaining.months} month${timeRemaining.months !== 1 ? 's' : ''}`}
                                {timeRemaining.months > 0 && timeRemaining.days > 0 && ' and '}
                                {timeRemaining.days > 0 && `${timeRemaining.days} day${timeRemaining.days !== 1 ? 's' : ''}`}
                                {timeRemaining.months === 0 && timeRemaining.days === 0 && timeRemaining.hours > 0 && `${timeRemaining.hours} hour${timeRemaining.hours !== 1 ? 's' : ''}`}
                                {timeRemaining.months === 0 && timeRemaining.days === 0 && timeRemaining.hours === 0 && 'Less than 1 hour'}
                              </p>
                            ) : (
                              <p className="text-sm text-white font-medium">Calculating...</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 mt-2 mb-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-[#999999]">Wallet Address</span>
                            <span className="text-white font-mono break-all text-right ml-2">{formatAddress(membership.address)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-[#999999]">Expires</span>
                            <span className="text-white">{formatDate(membership.expirationDate)}</span>
                          </div>
                        </div>
                        <a
                          href="https://hypersub.xyz/s/cryptoart"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-2 bg-white text-black text-xs font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors text-center"
                        >
                          Manage on Hypersub →
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mint/Renew Membership Section - Always visible */}
            <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">
                {hasMembershipInConnectedWallet ? 'Add Time to Membership' : 'Mint Membership'}
              </h2>
              
              {/* Duplicate warning */}
              {hasOtherMemberships && !hasMembershipInConnectedWallet && (
                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ You already have {otherWalletMemberships.length} membership{otherWalletMemberships.length !== 1 ? 's' : ''} in other wallet{otherWalletMemberships.length !== 1 ? 's' : ''}:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {otherWalletMemberships.map((m, idx) => (
                      <li key={idx} className="text-yellow-300 text-xs">
                        • {formatAddress(m.address)} with {formatMonthsRemaining(m.timeRemainingSeconds)} remaining
                      </li>
                    ))}
                  </ul>
                  <p className="text-yellow-400 text-xs mt-2">
                    You can still mint a new membership in this wallet if you want multiple memberships.
                  </p>
                </div>
              )}
              
              {hasMembershipInConnectedWallet && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                  <p className="text-blue-400 text-sm">
                    You already have a membership in this wallet. Adding time will extend your existing membership.
                  </p>
                </div>
              )}
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

              {hasInsufficientBalance && address && isConnected && (
                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-sm">
                  <p className="font-medium mb-1">Insufficient ETH Balance</p>
                  <p className="text-xs mb-2">
                    You need at least {parseFloat(totalPriceEth).toFixed(4)} ETH for the membership plus approximately 0.001 ETH for gas fees.
                  </p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-yellow-300">Your balance:</span>
                      <span className="text-white">{balanceData?.formatted || "0.0000"} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-300">Required:</span>
                      <span className="text-white">{parseFloat(formatEther(totalRequired)).toFixed(4)} ETH</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-yellow-300">Short by:</span>
                      <span className="text-white">{parseFloat(formatEther(insufficientAmount)).toFixed(4)} ETH</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
                  <p className="font-medium mb-1">Transaction Error:</p>
                  <p className="text-xs">
                    {(() => {
                      // Try to extract and decode the error for better messages
                      const errorDetails = extractErrorDetails(error);
                      return errorDetails.errorMessage;
                    })()}
                  </p>
                </div>
              )}

              {isSuccess && (
                <div className="mb-4 p-3 bg-green-900/20 border border-green-500 rounded text-green-400 text-sm">
                  Transaction successful! Your membership has been {hasMembershipInConnectedWallet ? "renewed" : "activated"}.
                </div>
              )}

              {needsWalletForTransaction ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#cccccc] text-center mb-3">
                    Connect a wallet to {hasMembershipInConnectedWallet ? "add time to your membership" : "mint your membership"}
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
                  disabled={isPending || isConfirming || statusLoading || hasInsufficientBalance || balanceLoading}
                  className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending || isConfirming
                    ? "Processing..."
                    : isSuccess
                    ? "Success!"
                    : hasMembershipInConnectedWallet
                    ? "Add Time"
                    : "Mint Membership"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

