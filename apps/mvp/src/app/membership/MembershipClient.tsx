"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useConnect, useBalance, usePublicClient } from "wagmi";
import { useProfile } from "@farcaster/auth-kit";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";
import { type Address, parseEther, formatEther, encodeFunctionData } from "viem";
import { base } from "viem/chains";
import Link from "next/link";

// STP v2 ABI for subscription functions
const STP_V2_ABI = [
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
    inputs: [{ name: 'tierId', type: 'uint16' }],
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

const HYPERSUB_URL = "https://hypersub.xyz/s/cryptoart";

function formatPeriodDuration(durationSeconds?: bigint) {
  if (!durationSeconds) return null;
  const seconds = Number(durationSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const days = seconds / 86400;
  if (Number.isInteger(days)) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = seconds / 3600;
  if (Number.isInteger(hours)) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const minutes = seconds / 60;
  if (Number.isInteger(minutes)) return `${minutes} min${minutes === 1 ? "" : "s"}`;
  return `${seconds} sec${seconds === 1 ? "" : "s"}`;
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  
  if (months > 0) {
    return `${months}mo${remainingDays > 0 ? ` ${remainingDays}d` : ''}`;
  } else if (days > 0) {
    return `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
  } else {
    return `${hours}h`;
  }
}

export default function MembershipClient() {
  const { address, isConnected } = useEffectiveAddress();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { isAuthenticated: isFarcasterAuth } = useProfile();
  const { memberships, primaryMembership, loading: statusLoading } = useMembershipStatus();
  const [periods, setPeriods] = useState(12);
  const [showMintForm, setShowMintForm] = useState(false);
  
  const isAuthenticated = isConnected || isFarcasterAuth;
  
  // Split memberships: current wallet vs other wallets
  const currentWalletMembership = memberships.find(m => 
    address && m.address.toLowerCase() === address.toLowerCase()
  );
  const otherWalletMemberships = memberships.filter(m => 
    !address || m.address.toLowerCase() !== address.toLowerCase()
  );
  
  const hasMembershipInCurrentWallet = !!currentWalletMembership;
  const hasMembershipElsewhere = otherWalletMemberships.length > 0;

  // Read tier pricing
  const { data: tierDetailResult, isLoading: loadingPrice } = useReadContract({
    address: STP_V2_CONTRACT_ADDRESS as Address,
    abi: STP_V2_ABI,
    functionName: 'tierDetail',
    args: [1],
  });

  type TierParams = {
    pricePerPeriod?: bigint;
    periodDurationSeconds?: bigint;
    initialMintPrice?: bigint;
    paused?: boolean;
  };
  type TierState = { params?: TierParams };
  
  const tierParams = (tierDetailResult as TierState | undefined)?.params;
  const pricePerPeriodWei = tierParams?.pricePerPeriod ?? BigInt(0);
  const initialMintPriceWei = tierParams?.initialMintPrice ?? BigInt(0);
  const periodDurationLabel = formatPeriodDuration(tierParams?.periodDurationSeconds);
  
  const totalPriceWei = hasMembershipInCurrentWallet
    ? pricePerPeriodWei * BigInt(periods)
    : initialMintPriceWei + (pricePerPeriodWei * BigInt(periods));
  const totalPriceEth = formatEther(totalPriceWei);

  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const publicClient = usePublicClient({ chainId: base.id });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const { data: balanceData } = useBalance({
    address: address,
    query: { enabled: !!address && isConnected },
  });

  const estimatedGasFee = parseEther("0.0001");
  const totalRequired = totalPriceWei + estimatedGasFee;
  const userBalance = balanceData?.value ?? BigInt(0);
  const hasInsufficientBalance = address && isConnected && userBalance < totalRequired;

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        reset();
        setShowMintForm(false);
      }, 3000);
    }
  }, [isSuccess, reset]);

  // Auto-show mint form if no membership in current wallet
  useEffect(() => {
    if (!statusLoading && !hasMembershipInCurrentWallet && isConnected && !hasMembershipElsewhere) {
      setShowMintForm(true);
    }
  }, [statusLoading, hasMembershipInCurrentWallet, isConnected, hasMembershipElsewhere]);

  const handleSubscribe = async () => {
    if (!address || !isConnected || !publicClient || !pricePerPeriodWei) return;

    try {
      // Simulate first
      await publicClient.simulateContract({
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
      });

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
    } catch (err) {
      console.error('Transaction error:', err);
    }
  };

  // Not authenticated - show sign in prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#cccccc] mb-4">Please sign in to view membership options.</p>
        </div>
      </div>
    );
  }

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

        {statusLoading ? (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
            <p className="text-[#cccccc] text-center">Loading...</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Connected Wallet Info */}
            {address && (
              <div className="text-xs text-[#666] mb-2">
                Connected: <span className="font-mono text-[#999]">{formatAddress(address)}</span>
              </div>
            )}

            {/* CASE 1: Has membership in current wallet */}
            {hasMembershipInCurrentWallet && currentWalletMembership && (
              <div className="bg-[#0a0a0a] border-2 border-green-500/50 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                    Active
                  </span>
                </div>
                <h2 className="text-2xl font-medium mb-1">Membership Active</h2>
                <p className="text-[#cccccc] mb-4">
                  {formatTimeRemaining(currentWalletMembership.timeRemainingSeconds)} remaining
                </p>
                <button
                  onClick={() => setShowMintForm(!showMintForm)}
                  className="px-4 py-2 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors"
                >
                  {showMintForm ? 'Hide' : 'Add Time'}
                </button>
              </div>
            )}

            {/* CASE 2: Has membership in ANOTHER wallet */}
            {!hasMembershipInCurrentWallet && hasMembershipElsewhere && (
              <div className="bg-[#0a0a0a] border border-yellow-500/50 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full">
                    Different Wallet
                  </span>
                </div>
                <h2 className="text-xl font-medium mb-2">Membership Found</h2>
                <p className="text-[#cccccc] mb-4">
                  Your membership is in a different wallet. Connect that wallet or manage it on Hypersub.
                </p>
                
                <div className="bg-black/50 rounded p-4 mb-4 space-y-2">
                  {otherWalletMemberships.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-[#999]">{formatAddress(m.address)}</span>
                      <span className="text-white">{formatTimeRemaining(m.timeRemainingSeconds)}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={HYPERSUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors"
                >
                  Manage on Hypersub
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                </a>
              </div>
            )}

            {/* CASE 3: No membership anywhere */}
            {!hasMembershipInCurrentWallet && !hasMembershipElsewhere && (
              <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 text-center">
                <p className="text-lg text-[#cccccc] mb-2">No Membership</p>
                <p className="text-sm text-[#999999] mb-4">
                  Get access to create auctions and premium features
                </p>
                <button
                  onClick={() => setShowMintForm(!showMintForm)}
                  className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors"
                >
                  {showMintForm ? 'Hide' : 'Get Membership'}
                </button>
              </div>
            )}

            {/* Mint/Renew Form */}
            {showMintForm && (
              <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">
                    {hasMembershipInCurrentWallet ? 'Add Time' : 'Get Membership'}
                  </h2>
                  <button onClick={() => setShowMintForm(false)} className="text-[#999] hover:text-white">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Period selector */}
                <div className="mb-4">
                  <label className="block text-sm text-[#cccccc] mb-2">Duration</label>
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
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4 p-4 bg-black rounded border border-[#333333]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#999999]">Total</span>
                    <span className="text-xl font-medium text-white">
                      {loadingPrice ? "..." : `${parseFloat(totalPriceEth).toFixed(4)} ETH`}
                    </span>
                  </div>
                  {periodDurationLabel && (
                    <p className="text-xs text-[#666] mt-1 text-right">
                      {periods} × {periodDurationLabel}
                    </p>
                  )}
                </div>

                {/* Errors/Success */}
                {error && (
                  <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
                    Transaction failed. Please try again.
                  </div>
                )}
                {isSuccess && (
                  <div className="mb-4 p-3 bg-green-900/20 border border-green-500 rounded text-green-400 text-sm">
                    Success! Membership {hasMembershipInCurrentWallet ? "renewed" : "activated"}.
                  </div>
                )}
                {hasInsufficientBalance && (
                  <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-sm">
                    Insufficient balance. Need {parseFloat(formatEther(totalRequired)).toFixed(4)} ETH.
                  </div>
                )}

                {/* Action */}
                {needsWalletForTransaction ? (
                  <div className="space-y-2">
                    {connectors.map((connector) => (
                      <button
                        key={connector.uid}
                        onClick={() => connect({ connector })}
                        disabled={isConnectPending}
                        className="w-full px-6 py-3 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors disabled:opacity-50"
                      >
                        {isConnectPending ? "Connecting..." : `Connect ${connector.name}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={handleSubscribe}
                    disabled={isPending || isConfirming || hasInsufficientBalance}
                    className="w-full px-6 py-3 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors disabled:opacity-50"
                  >
                    {isPending || isConfirming ? "Processing..." : isSuccess ? "Success!" : hasMembershipInCurrentWallet ? "Add Time" : "Get Membership"}
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
