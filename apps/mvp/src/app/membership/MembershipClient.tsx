"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useConnect, useBalance, usePublicClient } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";
import { type Address, parseEther, formatEther, decodeErrorResult, encodeFunctionData } from "viem";
import { base } from "viem/chains";
import Link from "next/link";
import { MembershipAllowlistManager } from "~/components/MembershipAllowlistManager";

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
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tierId', type: 'uint16' },
          { name: 'recipient', type: 'address' },
          { name: 'referrer', type: 'address' },
          { name: 'referralCode', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
        ],
      },
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
  const [showMintForm, setShowMintForm] = useState(false);
  const [showAllowlist, setShowAllowlist] = useState(false);
  const [showOtherWallets, setShowOtherWallets] = useState(false);
  
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
    paused?: boolean;
    startTimestamp?: bigint;
    endTimestamp?: bigint;
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
  
  // Check if tier is paused (this could cause the transaction to revert)
  const isTierPaused = tierParams?.paused === true;
  
  // Check time-based restrictions
  const now = Math.floor(Date.now() / 1000);
  const startTimestamp = tierParams?.startTimestamp ? Number(tierParams.startTimestamp) : undefined;
  const endTimestamp = tierParams?.endTimestamp ? Number(tierParams.endTimestamp) : undefined;
  const isBeforeStart = startTimestamp && now < startTimestamp;
  const isAfterEnd = endTimestamp && endTimestamp > 0 && now > endTimestamp;

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
  // Use usePublicClient with explicit chainId to ensure we use the configured RPC URL
  // from WagmiProvider (NEXT_PUBLIC_RPC_URL) instead of defaulting to the public base RPC.
  // This is critical for reliability.
  const publicClient = usePublicClient({ chainId: base.id });
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
    
    // Also check direct properties and nested RPC error structures
    if (!errorData) {
      const propsToCheck = ['data', 'errorData', 'revertData', 'returnData', 'response', 'body'];
      for (const prop of propsToCheck) {
        const value = err[prop];
        if (value && typeof value === 'string' && value.startsWith('0x')) {
          errorData = value;
          break;
        }
        // Check nested structures
        if (value && typeof value === 'object') {
          if (value.data && typeof value.data === 'string' && value.data.startsWith('0x')) {
            errorData = value.data;
            break;
          }
          if (value.error && value.error.data && typeof value.error.data === 'string' && value.error.data.startsWith('0x')) {
            errorData = value.error.data;
            break;
          }
        }
      }
    }
    
    // Try to extract from RPC response if it's a structured error
    if (!errorData && (err as any).response) {
      const response = (err as any).response;
      if (response.data?.error?.data) {
        errorData = response.data.error.data;
      } else if (response.error?.data) {
        errorData = response.error.data;
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
        setShowMintForm(false);
      }, 3000);
    }
  }, [isSuccess, reset]);

  // Auto-show mint form if no membership
  useEffect(() => {
    if (!statusLoading && !hasMembershipInConnectedWallet && isConnected) {
      setShowMintForm(true);
    }
  }, [statusLoading, hasMembershipInConnectedWallet, isConnected]);

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

    if (!pricePerPeriodWei || pricePerPeriodWei === BigInt(0)) {
      console.error('[MembershipClient] No price available or price is zero:', {
        pricePerPeriodWei: pricePerPeriodWei?.toString(),
        loadingPrice,
        priceError: priceError?.message,
      });
      alert("Unable to fetch price or price is not set. Please refresh the page and try again.");
      return;
    }

    if (!publicClient) {
      console.error('[MembershipClient] No public client available');
      alert("Unable to connect to blockchain. Please try again.");
      return;
    }

    // Validate total price before attempting transaction
    if (totalPriceWei === BigInt(0)) {
      console.error('[MembershipClient] Total price is zero:', {
        totalPriceWei: totalPriceWei.toString(),
        initialMintPriceWei: initialMintPriceWei.toString(),
        pricePerPeriodWei: pricePerPeriodWei.toString(),
        periods,
        hasMembershipInConnectedWallet,
      });
      alert("Calculated price is zero. This shouldn't happen. Please refresh the page and try again.");
      return;
    }

    // Check if tier is paused
    if (isTierPaused) {
      console.error('[MembershipClient] Tier is paused');
      alert("This membership tier is currently paused and not accepting new subscriptions. Please try again later.");
      return;
    }

    // Check time-based restrictions
    if (isBeforeStart) {
      const startDate = new Date(startTimestamp! * 1000);
      console.error('[MembershipClient] Tier not yet started:', startDate);
      alert(`This membership tier hasn't started yet. It will be available starting ${startDate.toLocaleString()}.`);
      return;
    }

    if (isAfterEnd) {
      const endDate = new Date(endTimestamp! * 1000);
      console.error('[MembershipClient] Tier has ended:', endDate);
      alert(`This membership tier has ended. It was available until ${endDate.toLocaleString()}.`);
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

    // Validate that we have a reasonable price before attempting transaction
    if (totalPriceWei === BigInt(0) || !pricePerPeriodWei || pricePerPeriodWei === BigInt(0)) {
      console.error('[MembershipClient] Invalid price data:', {
        totalPriceWei: totalPriceWei.toString(),
        pricePerPeriodWei: pricePerPeriodWei?.toString(),
        initialMintPriceWei: initialMintPriceWei.toString(),
        periods,
        hasMembershipInConnectedWallet,
      });
      alert("Unable to determine membership price. Please refresh the page and try again.");
      return;
    }

    console.log('[MembershipClient] Preparing transaction:', {
      contractAddress: STP_V2_CONTRACT_ADDRESS,
      functionName: 'mintAdvanced',
      tierId: 1,
      recipient: address,
      referrer: '0x0000000000000000000000000000000000000000',
      referralCode: 0,
      amount: totalPriceWei.toString(), // ETH amount
      totalPriceEth,
      value: totalPriceWei.toString(),
      isRenewal: hasMembershipInConnectedWallet,
      pricePerPeriodWei: pricePerPeriodWei.toString(),
      initialMintPriceWei: initialMintPriceWei.toString(),
      periods,
    });

    try {
      // First, estimate gas to see if that gives us any clues
      let estimatedGas: bigint | undefined;
      try {
        estimatedGas = await publicClient.estimateGas({
          account: address,
          to: STP_V2_CONTRACT_ADDRESS as Address,
          value: totalPriceWei,
          data: encodeFunctionData({
            abi: STP_V2_ABI,
            functionName: 'mintAdvanced',
            args: [{
              tierId: 1,
              recipient: address,
              referrer: '0x0000000000000000000000000000000000000000' as Address,
              referralCode: BigInt(0),
              amount: totalPriceWei,
            }],
          }),
        });
        console.log('[MembershipClient] Gas estimated:', estimatedGas.toString());
      } catch (gasErr: any) {
        console.warn('[MembershipClient] Gas estimation failed:', gasErr);
        // Try to get error data from the gas estimation error
        console.error('[MembershipClient] Gas estimation error details:', {
          message: gasErr?.message,
          shortMessage: gasErr?.shortMessage,
          cause: gasErr?.cause,
          data: gasErr?.data,
          // Check nested error objects
          details: (gasErr as any)?.details,
          error: (gasErr as any)?.error,
        });
        
        // If gas estimation fails, try a direct call to get error data
        try {
          const callResult = await publicClient.call({
            to: STP_V2_CONTRACT_ADDRESS as Address,
            data: encodeFunctionData({
              abi: STP_V2_ABI,
              functionName: 'mintAdvanced',
              args: [{
                tierId: 1,
                recipient: address,
                referrer: '0x0000000000000000000000000000000000000000' as Address,
                referralCode: BigInt(0),
                amount: totalPriceWei,
              }],
            }),
            value: totalPriceWei,
            account: address,
          });
          console.log('[MembershipClient] Direct call succeeded:', callResult);
        } catch (callErr: any) {
          console.error('[MembershipClient] Direct call failed:', callErr);
          // Extract error data from call error
          let errorData = callErr?.data || (callErr as any)?.error?.data;
          if (errorData && typeof errorData === 'string' && errorData.startsWith('0x')) {
            console.log('[MembershipClient] Found error data from call:', errorData);
            try {
              const decoded = decodeErrorResult({
                abi: STP_V2_ABI,
                data: errorData as `0x${string}`,
              });
              console.log('[MembershipClient] Decoded error from call:', decoded);
            } catch (decodeErr) {
              console.warn('[MembershipClient] Could not decode error from call:', decodeErr);
            }
          }
        }
        // Continue with simulation even if gas estimation fails
      }

      // First, simulate the transaction to catch errors early and get better error messages
      console.log('[MembershipClient] Simulating transaction with:', {
        account: address,
        payableAmount: totalPriceWei.toString(),
        value: totalPriceWei.toString(),
        totalPriceEth,
        estimatedGas: estimatedGas?.toString(),
      });
      try {
        const simulationResult = await publicClient.simulateContract({
          account: address,
          address: STP_V2_CONTRACT_ADDRESS as Address,
          abi: STP_V2_ABI,
          functionName: 'mintAdvanced',
          args: [{
            tierId: 1,
            recipient: address,
            referrer: '0x0000000000000000000000000000000000000000' as Address,
            referralCode: BigInt(0),
            amount: totalPriceWei,
          }],
          value: totalPriceWei,
          // Add explicit gas limit if we got an estimate
          ...(estimatedGas && { gas: estimatedGas * BigInt(2) }), // 2x buffer for safety
        });
        console.log('[MembershipClient] Simulation successful:', simulationResult);
      } catch (simErr: any) {
        console.error('[MembershipClient] Simulation failed:', simErr);
        console.error('[MembershipClient] Simulation error details:', {
          message: simErr?.message,
          shortMessage: simErr?.shortMessage,
          cause: simErr?.cause,
          data: simErr?.data,
        });
        
        // Use the helper function to extract and decode error
        const errorDetails = extractErrorDetails(simErr);
        
        // Build a user-friendly error message
        let errorMessage = `Transaction would fail: ${errorDetails.errorMessage}`;
        
        // Log the full error chain for debugging
        console.error('[MembershipClient] Full error chain:', {
          simErr,
          errorDetails,
          nestedErrors: (() => {
            const errors: any[] = [];
            let current: any = simErr;
            let depth = 0;
            while (current && depth < 15) {
              errors.push({
                depth,
                message: current.message,
                name: current.name,
                data: current.data,
                cause: current.cause?.message,
                details: current.details,
              });
              current = current.cause || current.error;
              depth++;
            }
            return errors;
          })(),
        });
        
        alert(errorMessage);
        return;
      }

      // Use mintAdvanced function with struct parameter matching successful transaction format
      console.log('[MembershipClient] Calling writeContract...');
      writeContract({
        address: STP_V2_CONTRACT_ADDRESS as Address,
        abi: STP_V2_ABI,
        functionName: 'mintAdvanced',
        args: [{
          tierId: 1,
          recipient: address,
          referrer: '0x0000000000000000000000000000000000000000' as Address,
          referralCode: BigInt(0),
          amount: totalPriceWei,
        }],
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
        <div className="mb-6">
          <Link
            href="/"
            className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2 mb-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-3xl font-light mb-4">Membership</h1>
        </div>

        {/* Status Card - Always visible, prominent */}
        {statusLoading ? (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 mb-4">
            <p className="text-[#cccccc] text-center">Loading membership status...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary Status Card */}
            {hasMembershipInConnectedWallet && primaryMembership ? (
              <div className="bg-[#0a0a0a] border-2 border-white rounded-lg p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                        Active
                      </span>
                      {hasOtherMemberships && (
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
                          +{otherWalletMemberships.length} other{otherWalletMemberships.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-medium mb-1">Membership Active</h2>
                    <p className="text-sm text-[#cccccc]">
                      {formatTimeRemaining(primaryMembership.expirationDate)} remaining
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#999999] mb-1">Expires</p>
                    <p className="text-sm text-white">{formatDate(primaryMembership.expirationDate)}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowMintForm(!showMintForm)}
                    className="flex-1 px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                  >
                    {showMintForm ? 'Hide' : 'Renew'} Membership
                  </button>
                  {hasMembershipInConnectedWallet && membershipAddress && (
                    <button
                      onClick={() => setShowAllowlist(!showAllowlist)}
                      className="px-4 py-2 bg-transparent border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:border-[#666666] transition-colors"
                    >
                      Manage Allowlist
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 mb-4">
                <div className="text-center py-4">
                  <p className="text-lg text-[#cccccc] mb-2">No Active Membership</p>
                  <p className="text-sm text-[#999999] mb-4">
                    Get access to create auctions and premium features
                  </p>
                  <button
                    onClick={() => setShowMintForm(!showMintForm)}
                    className="px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                  >
                    {showMintForm ? 'Hide' : 'Get'} Membership
                  </button>
                </div>
              </div>
            )}

            {/* Other Wallets - Collapsible */}
            {otherWalletMemberships.length > 0 && (
              <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-4 mb-4">
                <button
                  onClick={() => setShowOtherWallets(!showOtherWallets)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-sm text-[#cccccc]">
                    {otherWalletMemberships.length} membership{otherWalletMemberships.length !== 1 ? 's' : ''} in other wallet{otherWalletMemberships.length !== 1 ? 's' : ''}
                  </span>
                  <svg
                    className={`w-4 h-4 text-[#999999] transition-transform ${showOtherWallets ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showOtherWallets && (
                  <div className="mt-4 space-y-2 pt-4 border-t border-[#333333]">
                    {otherWalletMemberships.map((membership, idx) => {
                      const timeRemaining = calculateTimeRemainingFromSeconds(membership.timeRemainingSeconds);
                      return (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-[#999999] font-mono">{formatAddress(membership.address)}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-white">
                              {timeRemaining ? (
                                <>
                                  {timeRemaining.months > 0 && `${timeRemaining.months}m `}
                                  {timeRemaining.days > 0 && `${timeRemaining.days}d`}
                                </>
                              ) : '—'}
                            </span>
                            <a
                              href="https://hypersub.xyz/s/cryptoart"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              Manage →
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Allowlist Management - Collapsible */}
            {hasMembershipInConnectedWallet && membershipAddress && showAllowlist && (
              <div className="mb-4">
                <MembershipAllowlistManager membershipAddress={membershipAddress} />
              </div>
            )}

            {/* Mint/Renew Form - Collapsible */}
            {showMintForm && (
              <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">
                    {hasMembershipInConnectedWallet ? 'Add Time to Membership' : 'Mint Membership'}
                  </h2>
                  <button
                    onClick={() => setShowMintForm(false)}
                    className="text-[#999999] hover:text-white transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Consolidated warnings - only show if relevant */}
                {hasOtherMemberships && !hasMembershipInConnectedWallet && (
                  <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                    <p className="text-yellow-400 text-xs">
                      ⚠️ You have {otherWalletMemberships.length} membership{otherWalletMemberships.length !== 1 ? 's' : ''} in other wallet{otherWalletMemberships.length !== 1 ? 's' : ''}. You can still mint here if you want multiple memberships.
                    </p>
                  </div>
                )}

                {/* Period selector */}
                <div className="mb-4">
                  <label className="block text-sm text-[#cccccc] mb-2">
                    Duration (periods)
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

                {/* Simplified pricing */}
                <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#999999]">Total</span>
                    <span className="text-xl font-medium text-white">
                      {loadingPrice ? "..." : priceError ? "Error" : totalPriceWei ? `${parseFloat(totalPriceEth).toFixed(4)} ETH` : "0.0000 ETH"}
                    </span>
                  </div>
                  {periodDurationLabel && (
                    <p className="text-xs text-[#999999] mt-1 text-right">
                      {periods} {periodDurationLabel} period{periods !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Consolidated error/success messages */}
                {(error || isSuccess || hasInsufficientBalance) && (
                  <div className="mb-4">
                    {error && (
                      <div className="p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
                        <p className="text-xs">
                          {(() => {
                            const errorDetails = extractErrorDetails(error);
                            return errorDetails.errorMessage;
                          })()}
                        </p>
                      </div>
                    )}
                    {isSuccess && (
                      <div className="p-3 bg-green-900/20 border border-green-500 rounded text-green-400 text-sm">
                        Transaction successful! Your membership has been {hasMembershipInConnectedWallet ? "renewed" : "activated"}.
                      </div>
                    )}
                    {hasInsufficientBalance && address && isConnected && (
                      <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-sm">
                        <p className="text-xs">
                          Insufficient balance. Need {parseFloat(formatEther(totalRequired)).toFixed(4)} ETH, have {balanceData?.formatted || "0.0000"} ETH.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action button */}
                {needsWalletForTransaction ? (
                  <div className="space-y-2">
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

