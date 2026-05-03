"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
  usePublicClient,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";
import { type Address, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { TransitionLink } from "~/components/TransitionLink";

// STP v2 ABI for subscription functions
const STP_V2_ABI = [
  {
    type: "function",
    name: "mintAdvanced",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tierId", type: "uint16" },
          { name: "recipient", type: "address" },
          { name: "referrer", type: "address" },
          { name: "referralCode", type: "uint256" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "tierDetail",
    inputs: [{ name: "tierId", type: "uint16" }],
    outputs: [
      {
        name: "tier",
        type: "tuple",
        components: [
          { name: "subCount", type: "uint32" },
          { name: "id", type: "uint16" },
          {
            name: "params",
            type: "tuple",
            components: [
              { name: "periodDurationSeconds", type: "uint32" },
              { name: "maxSupply", type: "uint32" },
              { name: "maxCommitmentSeconds", type: "uint48" },
              { name: "startTimestamp", type: "uint48" },
              { name: "endTimestamp", type: "uint48" },
              { name: "rewardCurveId", type: "uint8" },
              { name: "rewardBasisPoints", type: "uint16" },
              { name: "paused", type: "bool" },
              { name: "transferrable", type: "bool" },
              { name: "initialMintPrice", type: "uint256" },
              { name: "pricePerPeriod", type: "uint256" },
              {
                name: "gate",
                type: "tuple",
                components: [
                  { name: "gateType", type: "uint8" },
                  { name: "contractAddress", type: "address" },
                  { name: "componentId", type: "uint256" },
                  { name: "balanceMin", type: "uint256" },
                ],
              },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

const HYPERSUB_URL = "https://hypersub.xyz/s/cryptoart";

const PERIOD_OPTIONS = [1, 3, 12] as const;

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
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;

  if (months > 0) {
    return `${months}mo${remainingDays > 0 ? ` ${remainingDays}d` : ""}`;
  }
  if (days > 0) {
    return `${days}d${hours > 0 ? ` ${hours}h` : ""}`;
  }
  return `${hours}h`;
}

export default function MembershipClient() {
  const homeHref = "/";

  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useEffectiveAddress();
  const { memberships, loading: statusLoading } = useMembershipStatus();
  const [periods, setPeriods] = useState<number>(1);

  const currentWalletMembership = memberships.find(
    (m) => address && m.address.toLowerCase() === address.toLowerCase(),
  );
  const otherWalletMemberships = memberships.filter(
    (m) => !address || m.address.toLowerCase() !== address.toLowerCase(),
  );

  const hasMembershipInCurrentWallet = !!currentWalletMembership;
  const hasMembershipElsewhere = otherWalletMemberships.length > 0;

  const { data: tierDetailResult, isLoading: loadingPrice } = useReadContract({
    address: STP_V2_CONTRACT_ADDRESS as Address,
    abi: STP_V2_ABI,
    functionName: "tierDetail",
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
    : initialMintPriceWei + pricePerPeriodWei * BigInt(periods);
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
  const hasInsufficientBalance = !!(address && isConnected && userBalance < totalRequired);

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        reset();
      }, 3000);
    }
  }, [isSuccess, reset]);

  const handleSubscribe = useCallback(async () => {
    if (!address || !isConnected || !publicClient || !pricePerPeriodWei) return;

    try {
      await publicClient.simulateContract({
        account: address,
        address: STP_V2_CONTRACT_ADDRESS as Address,
        abi: STP_V2_ABI,
        functionName: "mintAdvanced",
        args: [
          {
            tierId: 1,
            recipient: address,
            referrer: "0x0000000000000000000000000000000000000000" as Address,
            referralCode: BigInt(0),
            amount: totalPriceWei,
          },
        ],
        value: totalPriceWei,
      });

      writeContract({
        address: STP_V2_CONTRACT_ADDRESS as Address,
        abi: STP_V2_ABI,
        functionName: "mintAdvanced",
        args: [
          {
            tierId: 1,
            recipient: address,
            referrer: "0x0000000000000000000000000000000000000000" as Address,
            referralCode: BigInt(0),
            amount: totalPriceWei,
          },
        ],
        value: totalPriceWei,
      });
    } catch (err) {
      console.error("Transaction error:", err);
    }
  }, [address, isConnected, publicClient, pricePerPeriodWei, totalPriceWei, writeContract]);

  const handleSubscribeClick = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    void handleSubscribe();
  };

  const periodPhrase = periods === 1 ? "1 month" : `${periods} months`;
  const ctaPrimary = hasMembershipInCurrentWallet
    ? `Add ${periodPhrase}`
    : `Subscribe for ${periodPhrase}`;

  const gutter = "px-2.5 sm:px-3 md:px-8 lg:px-12";

  const statusHeadline = (() => {
    if (statusLoading) return "…";
    if (hasMembershipInCurrentWallet) return "Active";
    return "None";
  })();

  const statusSubline = (() => {
    if (statusLoading) return "Checking membership…";
    if (!isConnected) return "Connect a wallet to verify your membership.";
    if (hasMembershipInCurrentWallet && currentWalletMembership) {
      return `${formatTimeRemaining(currentWalletMembership.timeRemainingSeconds)} remaining`;
    }
    if (hasMembershipElsewhere) {
      return "Membership is linked to another wallet. Manage it on Hypersub or connect that wallet.";
    }
    if (address) return `No hypersub found on ${formatAddress(address)}`;
    return "";
  })();

  const tierPaused = tierParams?.paused === true;
  const subscribeDisabled =
    tierPaused ||
    isPending ||
    isConfirming ||
    (isConnected && hasInsufficientBalance) ||
    (isConnected && (loadingPrice || !pricePerPeriodWei));

  return (
    <div className="min-h-screen bg-[rgb(255,4,2)] text-white flex justify-center">
      <div className="flex w-full max-w-[402px] sm:max-w-[min(100%,720px)] md:max-w-[min(100%,900px)] flex-col min-h-screen border-x border-black/20 shadow-2xl">
        {/* Match homepage membership strip — backs infra & OSS */}
        <div className="flex w-full flex-col items-center justify-center gap-1 bg-[rgb(245,176,211)] px-3 py-2.5 text-center font-space-grotesk text-[11px] font-medium leading-snug text-black sm:flex-row sm:flex-wrap sm:gap-x-2 sm:px-4 sm:py-2 sm:text-xs">
          <span className="max-w-[42rem] text-black">
            Support infrastructure & open-source behind cryptoart.social
          </span>
          <span className="text-black tabular-nums">0.0001 ETH / month</span>
        </div>

        <div className={`flex items-center justify-between py-5 font-mek-mono text-sm ${gutter}`}>
          <TransitionLink href={homeHref} prefetch={false} className="text-white hover:underline">
            ← back
          </TransitionLink>
          <TransitionLink href="/settings" prefetch={false} className="text-white hover:underline">
            Settings
          </TransitionLink>
        </div>

        {/* Hero title — Figma #e3cd02; one h1 + line break (globals force gray on raw span) */}
        <div className={`pb-6 pt-2 ${gutter}`}>
          <h1 className="font-space-grotesk font-medium leading-[0.85] text-[clamp(3rem,18vw,5.85rem)] !text-[rgb(227,205,2)]">
            Member
            <br />
            ship
          </h1>
        </div>

        {/* Body copy — serif on red */}
        <div className={`px-2.5 pb-8 sm:px-3 md:px-8 lg:px-12`}>
          <p className="font-serif text-[clamp(1.05rem,4.2vw,1.5rem)] leading-snug text-white">
            As a member, you can create and curate galleries to showcase your collection. You can also cast in the{" "}
            <a
              href="https://warpcast.com/~/channel/cryptoart"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/80 underline-offset-2"
            >
              /cryptoart
            </a>{" "}
            channel.
          </p>
        </div>

        {hasMembershipElsewhere && !hasMembershipInCurrentWallet && (
          <div
            className={`mx-2.5 mb-4 border border-yellow-400/60 bg-black/20 p-3 font-mek-mono text-xs text-white sm:mx-3 md:mx-8 lg:mx-12`}
          >
            <p className="mb-2 font-medium">Membership on another wallet</p>
            <div className="space-y-1 text-white/90">
              {otherWalletMemberships.map((m, idx) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span className="font-mono">{formatAddress(m.address)}</span>
                  <span>{formatTimeRemaining(m.timeRemainingSeconds)}</span>
                </div>
              ))}
            </div>
            <a
              href={HYPERSUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-white underline underline-offset-2"
            >
              Manage on Hypersub ↗
            </a>
          </div>
        )}

        {/* Tier + subscribe — Figma gold / white bar */}
        <section className="mt-auto w-full bg-[rgb(236,193,0)] text-[rgb(255,4,2)]">
          <div className={`flex flex-col gap-1 px-2.5 pb-6 pt-5 sm:px-3 md:px-8 lg:px-12`}>
            <p className="font-space-grotesk font-medium leading-none text-[clamp(3rem,16vw,5.5rem)] !text-[rgb(255,4,2)]">
              {statusHeadline}
            </p>
            <p className="font-mek-mono text-sm leading-normal !text-[rgb(255,4,2)]">{statusSubline}</p>
          </div>

          <div className="grid grid-cols-3 border-y border-[rgb(255,4,2)]/25">
            {PERIOD_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriods(value)}
                className={`px-2 py-4 text-center font-space-grotesk text-lg font-medium !text-[rgb(255,4,2)] transition-opacity md:text-xl ${
                  periods === value ? "opacity-100" : "opacity-30 hover:opacity-60"
                }`}
              >
                {value === 1 ? "1 month" : `${value} months`}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 bg-white px-2.5 py-8 sm:px-3 md:px-8 lg:px-12">
            <button
              type="button"
              onClick={handleSubscribeClick}
              disabled={subscribeDisabled}
              className="text-left font-space-grotesk text-lg font-medium !text-[rgb(255,4,2)] disabled:opacity-40 md:text-xl"
            >
              {tierPaused ? "Tier paused" : ctaPrimary}
            </button>
            <span className="shrink-0 font-space-grotesk text-lg font-medium !text-black md:text-xl">
              {loadingPrice ? "…" : `${parseFloat(totalPriceEth).toFixed(4)} ETH`}
            </span>
          </div>

          {error && (
            <div className="border-t border-[rgb(255,4,2)]/20 bg-white px-2.5 py-3 font-mek-mono text-sm text-red-700 sm:px-3 md:px-8 lg:px-12">
              Transaction failed. Please try again.
            </div>
          )}
          {isSuccess && (
            <div className="border-t border-[rgb(255,4,2)]/20 bg-white px-2.5 py-3 font-mek-mono text-sm text-green-800 sm:px-3 md:px-8 lg:px-12">
              Success! Membership {hasMembershipInCurrentWallet ? "extended" : "activated"}.
            </div>
          )}
          {isConnected && hasInsufficientBalance && (
            <div className="border-t border-[rgb(255,4,2)]/20 bg-white px-2.5 py-3 font-mek-mono text-sm text-amber-900 sm:px-3 md:px-8 lg:px-12">
              Insufficient balance. Need {parseFloat(formatEther(totalRequired)).toFixed(4)} ETH (incl. gas estimate).
            </div>
          )}
          {(isPending || isConfirming) && (
            <div className="border-t border-[rgb(255,4,2)]/20 bg-white px-2.5 py-3 font-mek-mono text-sm text-neutral-700 sm:px-3 md:px-8 lg:px-12">
              Confirm in your wallet…
            </div>
          )}
        </section>

        <div className={`flex items-center justify-between py-6 ${gutter}`}>
          <a
            href={HYPERSUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-space-grotesk text-sm text-white underline-offset-2 hover:underline"
          >
            Hypersub ↗
          </a>
        </div>
      </div>
    </div>
  );
}
