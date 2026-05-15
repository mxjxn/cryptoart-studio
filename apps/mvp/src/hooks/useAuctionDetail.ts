"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuction, AUCTION_FETCH_TIMEOUT } from "~/hooks/useAuction";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useUsername } from "~/hooks/useUsername";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { useIsAdmin } from "~/hooks/useIsAdmin";
import { useOffers } from "~/hooks/useOffers";
import { useNetworkGuard } from "~/hooks/useNetworkGuard";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { type Address, isAddress } from "viem";
import { useLoadingOverlay } from "~/contexts/LoadingOverlayContext";
import {
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  CHAIN_ID,
  PURCHASE_ABI_NO_REFERRER,
  PURCHASE_ABI_WITH_REFERRER,
  ETHEREUM_MAINNET_MARKETPLACE_ADDRESS,
} from "~/lib/contracts/marketplace";
import { BASE_CHAIN_ID, ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { useERC20Token, useERC20Balance, isETH, type ERC20TokenData, type ERC20BalanceData } from "~/hooks/useERC20Token";
import { generateListingShareText } from "~/lib/share-text";
import { getAuctionTimeStatus, getFixedPriceTimeStatus, isNeverExpiring } from "~/lib/time-utils";
import { useHasNFTAccess } from "~/hooks/useHasNFTAccess";
import { STP_V2_CONTRACT_ADDRESS } from "~/lib/constants";
import {
  DEFAULT_LISTING_THEME,
  composeLinearGradientCss,
  composeListingThemeCursorCss,
  listingThemeTypographyClasses,
  type ListingThemeData,
} from "~/lib/listing-theme";
import { pickDisplayTitle } from "~/lib/metadata-display";
import { getChainNetworkInfo } from "~/lib/chain-display";
import type { EnrichedAuctionData } from "~/lib/types";

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export type AuctionDetailPageState =
  | "ambiguous"
  | "loading"
  | "building"
  | "timeout"
  | "fetchTimeout"
  | "notFound"
  | "indexedButMissing"
  | "ready";

export interface UseAuctionDetailReturn {
  pageState: AuctionDetailPageState;
  auction: EnrichedAuctionData | null;
  mergedAmbiguousChains: number[] | null;
  listingBgGradient: string;
  listingPageTheme: ListingThemeData;
  listingTypo: ReturnType<typeof listingThemeTypographyClasses>;
  listingShellStyle: CSSProperties;
  listingPageCursorCss: string | null | undefined;
  address: string | undefined;
  isConnected: boolean;
  isMiniApp: boolean;
  isMiniAppInstalled: boolean;
  isSDKLoaded: boolean;
  isMember: boolean;
  isAdmin: boolean;
  canEditListingTheme: boolean;
  verifiedWalletAddresses: string[];
  isListingSeller: boolean;
  listingId: string;
  listingApiChainId: number | undefined;
  marketplaceReadAddress: string;
  marketplaceReadChainId: number;
  title: string;
  currentPrice: string;
  listingHeroImageUrl: string | undefined;
  listingFullscreenImageUrl: string | undefined;
  listingHeroImageFallbackSrcs: string[];
  listingImageOverlayFallbackSrcs: string[];
  listingChainInfo: { displayName: string; chainId: number };
  resolvedListingChainId: number;
  chainScopeMismatch: boolean;
  shareText: string;
  displayCreatorName: string | null | undefined;
  displayCreatorAddress: string | null;
  creatorUsername: string | null;
  sellerUsername: string | null;
  bidderUsername: string | null;
  creatorName: string | null | undefined;
  creatorAddress: string | null | undefined;
  sellerName: string | null | undefined;
  bidderName: string | null | undefined;
  contractName: string | null | undefined;
  now: number;
  startTime: number;
  endTime: number;
  actualEndTime: number;
  effectiveEndTime: number | null;
  hasBid: boolean;
  hasStarted: boolean;
  auctionHasStarted: boolean;
  isEnded: boolean;
  isActive: boolean;
  effectiveEnded: boolean;
  isCancelled: boolean;
  showControls: boolean;
  isOwnAuction: boolean;
  isWinner: boolean;
  canCancel: boolean;
  canFinalize: boolean;
  canUpdate: boolean;
  canUpdateAtRisk: boolean;
  canFix180DayIssue: boolean;
  isAtRiskListing: boolean;
  has180DayIssue: boolean;
  isCancelling: boolean;
  isConfirmingCancel: boolean;
  isCancelLoading: boolean;
  isFinalizing: boolean;
  isConfirmingFinalize: boolean;
  isFinalizeLoading: boolean;
  isModifying: boolean;
  isConfirmingModify: boolean;
  isModifyLoading: boolean;
  isPurchasing: boolean;
  isConfirmingPurchase: boolean;
  isBidding: boolean;
  isConfirmingBid: boolean;
  isOffering: boolean;
  isConfirmingOffer: boolean;
  isAccepting: boolean;
  isConfirmingAccept: boolean;
  isApproving: boolean;
  isConfirmingApprove: boolean;
  bidAmount: string;
  setBidAmount: (v: string) => void;
  offerAmount: string;
  setOfferAmount: (v: string) => void;
  purchaseQuantity: number;
  setPurchaseQuantity: (v: number) => void;
  isImageOverlayOpen: boolean;
  setIsImageOverlayOpen: (v: boolean) => void;
  showUpdateForm: boolean;
  setShowUpdateForm: (v: boolean) => void;
  showChainSwitchPrompt: boolean;
  setShowChainSwitchPrompt: (v: boolean) => void;
  isPaymentETH: boolean;
  paymentSymbol: string;
  paymentDecimals: number;
  erc20Token: ERC20TokenData;
  userBalance: ERC20BalanceData;
  offers: any[];
  activeOffers: any[];
  offersLoading: boolean;
  refetchOffers: () => void;
  handleBid: () => Promise<void>;
  handlePurchase: () => Promise<void>;
  handleMakeOffer: () => Promise<void>;
  handleAcceptOffer: (offererAddress: string, offerAmount: string) => Promise<void>;
  handleCancel: () => Promise<void>;
  handleFinalize: () => Promise<void>;
  handleFix180DayDuration: (durationSeconds: number) => Promise<void>;
  handleUpdateListing: (startTime: number | null, endTime: number | null) => Promise<void>;
  handleSwapBuyToken: () => Promise<void>;
  formatPrice: (amount: string) => string;
  calculateMinBid: bigint;
  refetchAuction: (forceRefresh?: boolean) => void;
  actions: any;
  modifyError: any;
  isExplicitEthereumListing: boolean;
  pendingPurchaseAfterApproval: boolean;
  bidCount: number;
  nowTimestamp: number;
  listingData: any;
  erc20Allowance: any;
  refetchAllowance: () => any;
  cancelError: any;
  finalizeError: any;
  purchaseError: any;
  offerError: any;
  acceptError: any;
  bidError: any;
  approveError: any;
  cancelHash: `0x${string}` | undefined;
  finalizeHash: `0x${string}` | undefined;
  modifyHash: `0x${string}` | undefined;
  purchaseHash: `0x${string}` | undefined;
  offerHash: `0x${string}` | undefined;
  acceptHash: `0x${string}` | undefined;
  bidHash: `0x${string}` | undefined;
  approveHash: `0x${string}` | undefined;
  isCancelConfirmed: boolean;
  isFinalizeConfirmed: boolean;
  isModifyConfirmed: boolean;
  isPurchaseConfirmed: boolean;
  isOfferConfirmed: boolean;
  isAcceptConfirmed: boolean;
  isBidConfirmed: boolean;
  isApproveConfirmed: boolean;
  loading: boolean;
  auctionFetchError: Error | null;
  setBuildingTimedOut: (v: boolean) => void;
  setPageStatus: (v: "building" | "ready" | "not_found" | "error" | "ambiguous" | null) => void;
  switchToRequiredChain: () => void;
  referrer: Address | null;
}

export function useAuctionDetail({
  listingId,
  listingApiChainId,
}: {
  listingId: string;
  listingApiChainId?: number;
}): UseAuctionDetailReturn {
  const isExplicitEthereumListing = listingApiChainId === ETHEREUM_MAINNET_CHAIN_ID;
  const marketplaceReadAddress = isExplicitEthereumListing
    ? ETHEREUM_MAINNET_MARKETPLACE_ADDRESS
    : MARKETPLACE_ADDRESS;
  const marketplaceReadChainId = isExplicitEthereumListing ? mainnet.id : CHAIN_ID;
  const { address, isConnected } = useEffectiveAddress();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSDKLoaded, actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const chainId = useChainId();
  const { switchToRequiredChain } = useNetworkGuard({
    requiredChainId: marketplaceReadChainId,
  });
  const { hideOverlay } = useLoadingOverlay();
  const { isPro } = useMembershipStatus();
  const { isAdmin } = useIsAdmin();
  const isMember = isPro;
  const canEditListingTheme = isMember || isAdmin;
  const { verifiedWalletAddresses } = useHasNFTAccess(STP_V2_CONTRACT_ADDRESS);

  const [listingPageTheme, setListingPageTheme] =
    useState<ListingThemeData>(DEFAULT_LISTING_THEME);

  const isMiniAppInstalled = context?.client?.added ?? false;

  const {
    auction,
    loading,
    error: auctionFetchError,
    ambiguousChains,
    refetch: refetchAuction,
    updateAuction,
  } = useAuction(listingId, { chainId: listingApiChainId });

  const listingImageOverlayFallbackSrcs = useMemo(() => {
    if (!auction) return [];
    const fullscreen =
      auction.detailThumbnailUrl ?? auction.image ?? auction.thumbnailUrl;
    return [auction.thumbnailUrl, auction.detailThumbnailUrl].filter(
      (u): u is string =>
        typeof u === "string" &&
        u.length > 0 &&
        !!fullscreen &&
        u !== fullscreen
    );
  }, [
    auction?.listingId,
    auction?.thumbnailUrl,
    auction?.detailThumbnailUrl,
    auction?.image,
  ]);

  const listingHeroImageFallbackSrcs = useMemo(() => {
    // `auction` here is EnrichedAuctionData which covers all listing types
    // (INDIVIDUAL_AUCTION, FIXED_PRICE, DYNAMIC_PRICE, OFFERS_ONLY).
    // The null check is only a loading guard — not a listing-type filter.
    if (!auction) return [];
    const hero =
      auction.detailThumbnailUrl ?? auction.thumbnailUrl ?? auction.image;
    // Build ordered fallback candidates after the primary hero URL
    const candidates = [auction.thumbnailUrl, auction.image];
    const seen = new Set<string>(hero ? [hero] : []);
    const result: string[] = [];
    for (const u of candidates) {
      if (typeof u === "string" && u.length > 0 && !seen.has(u)) {
        seen.add(u);
        result.push(u);
      }
    }
    return result;
  }, [
    auction?.detailThumbnailUrl,
    auction?.thumbnailUrl,
    auction?.image,
  ]);

  useEffect(() => {
    if (!auction?.listingId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/listing-theme?listingId=${encodeURIComponent(String(auction.listingId))}`,
          { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { theme?: ListingThemeData };
        if (cancelled || !data?.theme) return;
        setListingPageTheme(data.theme);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auction?.listingId]);

  const [pageStatus, setPageStatus] = useState<
    "building" | "ready" | "not_found" | "error" | "ambiguous" | null
  >(null);
  const [pageStatusAmbiguousChains, setPageStatusAmbiguousChains] = useState<
    number[] | null
  >(null);
  const pageStatusCheckInFlight = useRef(false);
  const [buildingTimedOut, setBuildingTimedOut] = useState(false);
  const BUILDING_TIMEOUT_MS = 12000;
  const bustStaleReadyAuctionRef = useRef(false);
  const incompleteEnrichmentRefetchDone = useRef(false);

  useEffect(() => {
    bustStaleReadyAuctionRef.current = false;
    incompleteEnrichmentRefetchDone.current = false;
  }, [listingId]);

  useEffect(() => {
    setPageStatusAmbiguousChains(null);
  }, [listingId, listingApiChainId]);

  useEffect(() => {
    if (!listingId) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const checkPageStatus = async () => {
      if (pageStatusCheckInFlight.current) return;
      pageStatusCheckInFlight.current = true;

      try {
        const ps =
          listingApiChainId != null
            ? `?chainId=${encodeURIComponent(String(listingApiChainId))}`
            : "";
        const response = await fetch(`/api/listings/${listingId}/page-status${ps}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          console.warn('Page status check failed:', response.status, response.statusText);
          if (isMounted) {
            if (pageStatus === null) {
              setPageStatus('building');
            }
          }
          return;
        }
        const data = await response.json();

        if (isMounted) {
          if (data.status === "ambiguous") {
            const raw = Array.isArray(data.chains)
              ? data.chains
                  .map((x: unknown) =>
                    typeof x === "number" ? x : parseInt(String(x), 10)
                  )
                  .filter((n: number) => Number.isFinite(n))
              : [];
            setPageStatusAmbiguousChains(
              raw.length >= 2
                ? raw
                : [ETHEREUM_MAINNET_CHAIN_ID, BASE_CHAIN_ID]
            );
            setPageStatus("ambiguous");
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            return;
          }

          setPageStatusAmbiguousChains(null);
          setPageStatus(data.status);

          if (data.status === 'ready') {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }

            refetchAuction();

            if (data.readyAt) {
              const readyAt = new Date(data.readyAt);
              const now = new Date();
              const timeSinceReady = now.getTime() - readyAt.getTime();

              if (timeSinceReady < 5000 && timeSinceReady >= 0) {
                const sellerAddr = data.sellerAddress || auction?.seller;
                if (sellerAddr && address && sellerAddr.toLowerCase() === address.toLowerCase()) {
                  fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userAddress: address,
                      type: 'LISTING_CREATED',
                      title: 'Listing Page Ready',
                      message: `Your listing page is now ready to view!`,
                      listingId: listingId,
                      metadata: {
                        pageReady: true,
                      },
                    }),
                  }).catch(err => {
                    console.error('Error creating page ready notification:', err);
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking page status:', error);
        if (isMounted) {
          if (pageStatus === null) {
            setPageStatus('building');
          }
        }
      } finally {
        if (isMounted) {
          pageStatusCheckInFlight.current = false;
        }
      }
    };

    checkPageStatus();

    if (
      pageStatus !== "not_found" &&
      pageStatus !== "ambiguous" &&
      (pageStatus === "building" || (!auction && !loading))
    ) {
      pollInterval = setInterval(checkPageStatus, 3000);
    }

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [listingId, listingApiChainId, pageStatus, auction, loading, address]);

  useEffect(() => {
    if (pageStatus === "ambiguous") return;
    if (pageStatus !== "ready" && pageStatus !== "error") return;
    if (loading || auction || auctionFetchError) return;
    if (bustStaleReadyAuctionRef.current) return;
    bustStaleReadyAuctionRef.current = true;
    void refetchAuction(true);
  }, [pageStatus, auction, loading, auctionFetchError, refetchAuction]);

  useEffect(() => {
    if (!auction || auction.status !== "ACTIVE") return;
    const anim =
      auction.metadata?.animation_url ||
      (auction.metadata as { animationUrl?: string } | undefined)?.animationUrl;
    const hasDisplayMedia = !!(
      auction.detailThumbnailUrl ||
      auction.thumbnailUrl ||
      auction.image ||
      anim
    );
    const hasTitle = !!(
      (typeof auction.title === "string" && auction.title.trim()) ||
      pickDisplayTitle(auction.metadata)
    );
    if (hasDisplayMedia && hasTitle) return;
    if (incompleteEnrichmentRefetchDone.current) return;
    incompleteEnrichmentRefetchDone.current = true;
    void refetchAuction(true);
  }, [auction, refetchAuction]);

  useEffect(() => {
    if ((pageStatus === 'building' || pageStatus === null) && !auction) {
      setBuildingTimedOut(false);
      const timeout = setTimeout(() => {
        setBuildingTimedOut(true);
      }, BUILDING_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }
    setBuildingTimedOut(false);
  }, [pageStatus, auction, listingId]);

  useEffect(() => {
    if (!loading && auction) {
      const timer = setTimeout(() => {
        hideOverlay();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, auction, hideOverlay]);

  const { offers, activeOffers, isLoading: offersLoading, refetch: refetchOffers } = useOffers(
    listingId,
    { chainId: listingApiChainId }
  );
  const [bidAmount, setBidAmount] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [pendingPurchaseAfterApproval, setPendingPurchaseAfterApproval] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showChainSwitchPrompt, setShowChainSwitchPrompt] = useState(false);

  const lastProcessedBidHash = useRef<string | null>(null);

  const { writeContract: cancelListing, data: cancelHash, isPending: isCancelling, error: cancelError } = useWriteContract();
  const { isLoading: isConfirmingCancel, isSuccess: isCancelConfirmed } = useWaitForTransactionReceipt({
    hash: cancelHash,
    chainId: marketplaceReadChainId,
  });

  const { writeContract: finalizeAuction, data: finalizeHash, isPending: isFinalizing, error: finalizeError } = useWriteContract();
  const { isLoading: isConfirmingFinalize, isSuccess: isFinalizeConfirmed } = useWaitForTransactionReceipt({
    hash: finalizeHash,
    chainId: marketplaceReadChainId,
  });

  const { writeContract: modifyListing, data: modifyHash, isPending: isModifying, error: modifyError } = useWriteContract();
  const { isLoading: isConfirmingModify, isSuccess: isModifyConfirmed } = useWaitForTransactionReceipt({
    hash: modifyHash,
    chainId: marketplaceReadChainId,
  });

  const { writeContract: purchaseListing, data: purchaseHash, isPending: isPurchasing, error: purchaseError } = useWriteContract();
  const { isLoading: isConfirmingPurchase, isSuccess: isPurchaseConfirmed } = useWaitForTransactionReceipt({
    hash: purchaseHash,
    chainId: marketplaceReadChainId,
  });

  const { writeContract: makeOffer, data: offerHash, isPending: isOffering, error: offerError } = useWriteContract();
  const { isLoading: isConfirmingOffer, isSuccess: isOfferConfirmed } = useWaitForTransactionReceipt({
    hash: offerHash,
    chainId: marketplaceReadChainId,
  });

  const { writeContract: acceptOffer, data: acceptHash, isPending: isAccepting, error: acceptError } = useWriteContract();
  const { isLoading: isConfirmingAccept, isSuccess: isAcceptConfirmed } = useWaitForTransactionReceipt({
    hash: acceptHash,
    chainId: marketplaceReadChainId,
  });

  const { writeContract: placeBid, data: bidHash, isPending: isBidding, error: bidError } = useWriteContract();
  const { isLoading: isConfirmingBid, isSuccess: isBidConfirmed } = useWaitForTransactionReceipt({
    hash: bidHash,
    chainId: marketplaceReadChainId,
  });

  const { writeContract: approveERC20, data: approveHash, isPending: isApproving, error: approveError } = useWriteContract();
  const { isLoading: isConfirmingApprove, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: marketplaceReadChainId,
  });

  const {
    artistName: creatorName,
    isLoading: creatorNameLoading,
    creatorAddress,
  } = useArtistName(
    null,
    auction?.tokenAddress || undefined,
    auction?.tokenId ? BigInt(auction.tokenId) : undefined,
    typeof auction?.chainId === "number" ? auction.chainId : undefined
  );

  const { artistName: sellerName, isLoading: sellerNameLoading } =
    useArtistName(
      auction?.seller || null,
      undefined,
      undefined
    );

  const { artistName: bidderName, isLoading: bidderNameLoading } =
    useArtistName(
      auction?.highestBid?.bidder || null,
      undefined,
      undefined
    );

  const { contractName, isLoading: contractNameLoading } = useContractName(
    auction?.tokenAddress as Address | undefined,
    typeof auction?.chainId === "number" ? auction.chainId : undefined
  );

  const isPaymentETH = isETH(auction?.erc20);
  const erc20Token = useERC20Token(!isPaymentETH ? auction?.erc20 : undefined, {
    chainId: marketplaceReadChainId,
  });
  const userBalance = useERC20Balance(auction?.erc20, address, {
    chainId: marketplaceReadChainId,
  });

  const { data: erc20Allowance, refetch: refetchAllowance } = useReadContract({
    address: !isPaymentETH && auction?.erc20 ? (auction.erc20 as Address) : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && !isPaymentETH && auction?.erc20
        ? [address, marketplaceReadAddress]
        : undefined,
    chainId: marketplaceReadChainId,
    query: {
      enabled: !isPaymentETH && !!auction?.erc20 && !!address,
    },
  });

  const paymentSymbol = isPaymentETH ? "ETH" : (erc20Token.symbol || "$TOKEN");
  const paymentDecimals = isPaymentETH ? 18 : (erc20Token.decimals || 18);

  const { data: listingData } = useReadContract({
    address: marketplaceReadAddress,
    abi: MARKETPLACE_ABI,
    chainId: marketplaceReadChainId,
    functionName: "getListing",
    args: [Number(listingId)],
    query: {
      enabled: !!listingId,
    },
  });

  const referrerBPS = listingData ? (listingData as any).referrerBPS : undefined;

  const referrer = useMemo(() => {
    const referralAddressParam = searchParams.get('referralAddress') || searchParams.get('ref');
    if (!referralAddressParam) {
      return null;
    }
    if (!isAddress(referralAddressParam)) {
      console.warn('Invalid referrer address in URL:', referralAddressParam);
      return null;
    }
    if (referrerBPS && referrerBPS > 0) {
      return referralAddressParam.toLowerCase() as Address;
    }
    return null;
  }, [searchParams, referrerBPS]);

  const getCAIP19TokenId = (tokenAddress: string | undefined): string | undefined => {
    if (!tokenAddress || isETH(tokenAddress)) return undefined;
    return `eip155:${listingApiChainId ?? CHAIN_ID}/erc20:${tokenAddress}`;
  };

  const getSwapPrefillAmount = () => {
    if (!auction) return undefined;
    if (auction.listingType !== "FIXED_PRICE") return undefined;
    try {
      const price = auction.currentPrice || auction.initialAmount || "0";
      return (BigInt(price) * BigInt(purchaseQuantity)).toString();
    } catch {
      return undefined;
    }
  };

  const handleSwapBuyToken = async () => {
    if (!isMiniApp || !isSDKLoaded || !auction?.erc20 || isPaymentETH) return;
    try {
      const buyToken = getCAIP19TokenId(auction.erc20);
      if (!buyToken) return;
      const sellAmount = getSwapPrefillAmount();
      await sdk.actions.swapToken({
        buyToken,
        sellAmount,
      });
    } catch (error) {
      console.error("Error opening swap:", error);
    }
  };

  const formatPrice = (amount: string): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** paymentDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    const wholePartFormatted = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (fractionalPart === BigInt(0)) {
      return wholePartFormatted;
    }
    let fractionalStr = fractionalPart.toString().padStart(paymentDecimals, "0");
    fractionalStr = fractionalStr.replace(/0+$/, "");
    if (fractionalStr.length > 6) {
      fractionalStr = fractionalStr.slice(0, 6);
    }
    return `${wholePartFormatted}.${fractionalStr}`;
  };

  const calculateMinBid = useMemo(() => {
    if (!auction) return BigInt(0);
    if (!auction.highestBid) {
      return BigInt(auction.initialAmount);
    } else {
      const currentPrice = BigInt(auction.highestBid.amount);
      const minIncrementBPS = 500;
      return currentPrice + (currentPrice * BigInt(minIncrementBPS)) / BigInt(10000);
    }
  }, [auction]);

  useEffect(() => {
    if (auction && calculateMinBid > BigInt(0) && !bidAmount) {
      const value = calculateMinBid;
      const divisor = BigInt(10 ** paymentDecimals);
      const wholePart = value / divisor;
      const fractionalPart = value % divisor;

      let minBidFormatted: string;
      if (fractionalPart === BigInt(0)) {
        minBidFormatted = wholePart.toString();
      } else {
        let fractionalStr = fractionalPart.toString().padStart(paymentDecimals, "0");
        fractionalStr = fractionalStr.replace(/0+$/, "");
        if (fractionalStr.length > 6) {
          fractionalStr = fractionalStr.slice(0, 6);
        }
        minBidFormatted = `${wholePart}.${fractionalStr}`;
      }
      setBidAmount(minBidFormatted);
    }
  }, [auction, calculateMinBid, bidAmount, paymentDecimals]);

  const handleBid = async () => {
    if (!isConnected || !bidAmount || !auction || !address) {
      return;
    }

    try {
      const bidAmountBigInt = (() => {
        const parts = bidAmount.split('.');
        const wholePart = BigInt(parts[0] || '0');
        const fractionalPart = parts[1] ? BigInt(parts[1].padEnd(paymentDecimals, '0').slice(0, paymentDecimals)) : BigInt(0);
        return wholePart * BigInt(10 ** paymentDecimals) + fractionalPart;
      })();

      const minBid = calculateMinBid;

      if (bidAmountBigInt < minBid) {
        alert(`Bid must be at least ${formatPrice(minBid.toString())} ${paymentSymbol}`);
        return;
      }

      if (!isPaymentETH && auction.erc20) {
        const tokenAddress = auction.erc20 as Address;
        const currentAllowance = erc20Allowance as bigint | undefined;

        if (!currentAllowance || currentAllowance < bidAmountBigInt) {
          await approveERC20({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            chainId: marketplaceReadChainId,
            args: [marketplaceReadAddress, bidAmountBigInt],
          });
          return;
        }
      }

      if (referrer) {
        await placeBid({
          address: marketplaceReadAddress,
          abi: MARKETPLACE_ABI,
          functionName: 'bid',
          chainId: marketplaceReadChainId,
          args: [referrer, Number(listingId), false] as const,
          value: isPaymentETH ? bidAmountBigInt : BigInt(0),
        });
      } else {
        await placeBid({
          address: marketplaceReadAddress,
          abi: MARKETPLACE_ABI,
          functionName: 'bid',
          chainId: marketplaceReadChainId,
          args: [Number(listingId), false] as const,
          value: isPaymentETH ? bidAmountBigInt : BigInt(0),
        });
      }
    } catch (err) {
      console.error("Error placing bid:", err);
      alert("Failed to place bid. Please try again.");
    }
  };

  const handlePurchase = async () => {
    if (!isConnected || !auction || !address) {
      return;
    }

    try {
      const price = auction.currentPrice || auction.initialAmount;
      const totalPrice = BigInt(price) * BigInt(purchaseQuantity);

      if (!isPaymentETH && auction.erc20) {
        const tokenAddress = auction.erc20 as Address;
        const currentAllowance = erc20Allowance as bigint | undefined;

        if (!currentAllowance || currentAllowance < totalPrice) {
          setPendingPurchaseAfterApproval(true);
          await approveERC20({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            chainId: marketplaceReadChainId,
            args: [marketplaceReadAddress, totalPrice],
          });
          return;
        }
      }

      const purchaseValue = isPaymentETH ? totalPrice : BigInt(0);

      console.log('[Purchase] Executing purchase:', {
        listingId: Number(listingId),
        purchaseQuantity,
        purchaseValue: purchaseValue.toString(),
        totalPrice: totalPrice.toString(),
        isPaymentETH,
        auctionData: {
          listingType: auction.listingType,
          tokenSpec: auction.tokenSpec,
          totalAvailable: auction.totalAvailable,
          totalSold: auction.totalSold,
          totalPerSale: auction.totalPerSale,
        },
      });

      if (referrer) {
        await purchaseListing({
          address: marketplaceReadAddress,
          abi: PURCHASE_ABI_WITH_REFERRER,
          functionName: 'purchase',
          chainId: marketplaceReadChainId,
          args: [referrer, Number(listingId), purchaseQuantity],
          value: purchaseValue,
        });
      } else {
        await purchaseListing({
          address: marketplaceReadAddress,
          abi: PURCHASE_ABI_NO_REFERRER,
          functionName: 'purchase',
          chainId: marketplaceReadChainId,
          args: [Number(listingId), purchaseQuantity],
          value: purchaseValue,
        });
      }
    } catch (err) {
      console.error("Error purchasing:", err);
    }
  };

  useEffect(() => {
    if (isApproveConfirmed && pendingPurchaseAfterApproval && !isPaymentETH && auction && address) {
      let timer: NodeJS.Timeout | null = null;

      refetchAllowance().then(() => {
        timer = setTimeout(() => {
          try {
            const price = auction.currentPrice || auction.initialAmount;
            const totalPrice = BigInt(price) * BigInt(purchaseQuantity);

            console.log('[Purchase] Executing post-approval purchase:', {
              listingId: Number(listingId),
              purchaseQuantity,
              totalPrice: totalPrice.toString(),
            });

            if (referrer) {
              purchaseListing({
                address: marketplaceReadAddress,
                abi: PURCHASE_ABI_WITH_REFERRER,
                functionName: 'purchase',
                chainId: marketplaceReadChainId,
                args: [referrer, Number(listingId), purchaseQuantity],
                value: BigInt(0),
              });
            } else {
              purchaseListing({
                address: marketplaceReadAddress,
                abi: PURCHASE_ABI_NO_REFERRER,
                functionName: 'purchase',
                chainId: marketplaceReadChainId,
                args: [Number(listingId), purchaseQuantity],
                value: BigInt(0),
              });
            }

            setPendingPurchaseAfterApproval(false);
          } catch (err) {
            console.error("Error purchasing after approval:", err);
            setPendingPurchaseAfterApproval(false);
          }
        }, 1000);
      });

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [
    isApproveConfirmed,
    pendingPurchaseAfterApproval,
    isPaymentETH,
    auction,
    address,
    purchaseQuantity,
    listingId,
    refetchAllowance,
    purchaseListing,
    referrer,
    marketplaceReadChainId,
    marketplaceReadAddress,
  ]);

  const handleMakeOffer = async () => {
    if (!isConnected || !offerAmount || !auction || !address) {
      return;
    }

    try {
      const offerAmountBigInt = BigInt(Math.floor(parseFloat(offerAmount) * 10 ** paymentDecimals));

      if (!isPaymentETH && auction.erc20) {
        const tokenAddress = auction.erc20 as Address;
        const currentAllowance = erc20Allowance as bigint | undefined;

        if (!currentAllowance || currentAllowance < offerAmountBigInt) {
          await approveERC20({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            chainId: marketplaceReadChainId,
            args: [marketplaceReadAddress, offerAmountBigInt],
          });
          return;
        }
      }

      await makeOffer({
        address: marketplaceReadAddress,
        abi: MARKETPLACE_ABI,
        functionName: 'offer',
        chainId: marketplaceReadChainId,
        args: [Number(listingId), false],
        value: isPaymentETH ? offerAmountBigInt : BigInt(0),
      });
    } catch (err) {
      console.error("Error making offer:", err);
    }
  };

  const handleAcceptOffer = async (offererAddress: string, offerAmount: string) => {
    if (!isConnected || !auction) {
      return;
    }

    try {
      const offerAmountBigInt = BigInt(offerAmount);

      await acceptOffer({
        address: marketplaceReadAddress,
        abi: MARKETPLACE_ABI,
        functionName: 'accept',
        chainId: marketplaceReadChainId,
        args: [
          Number(listingId),
          [offererAddress as Address],
          [offerAmountBigInt],
          offerAmountBigInt,
        ],
      });
    } catch (err) {
      console.error("Error accepting offer:", err);
    }
  };

  const handleCancel = async () => {
    if (!isConnected || !auction) {
      return;
    }

    if (!chainId) {
      console.error("Chain ID not available");
      setShowChainSwitchPrompt(true);
      return;
    }

    try {
      await cancelListing({
        address: marketplaceReadAddress,
        abi: MARKETPLACE_ABI,
        functionName: 'cancel',
        chainId: marketplaceReadChainId,
        args: [Number(listingId), 0],
      });
    } catch (err: any) {
      console.error("Error cancelling listing:", err);
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error('[AuctionDetail] Chain ID error in cancel, showing switch prompt:', err);
        setShowChainSwitchPrompt(true);
        if (!isMiniApp) {
          try {
            switchToRequiredChain();
          } catch (switchErr) {
            console.error('[AuctionDetail] Error switching chain:', switchErr);
          }
        }
      }
    }
  };

  const handleFinalize = async () => {
    if (!isConnected || !auction) {
      return;
    }

    try {
      await finalizeAuction({
        address: marketplaceReadAddress,
        abi: MARKETPLACE_ABI,
        functionName: 'finalize',
        chainId: marketplaceReadChainId,
        args: [Number(listingId)],
      });
    } catch (err: any) {
      console.error("Error finalizing auction:", err);
    }
  };

  const handleFix180DayDuration = async (durationSeconds: number) => {
    if (!isConnected || !auction) {
      return;
    }

    try {
      const initialAmount = BigInt(auction.initialAmount || "0");
      const startTime48 = 0;
      const endTime48 = durationSeconds;

      await modifyListing({
        address: marketplaceReadAddress,
        abi: MARKETPLACE_ABI,
        functionName: 'modifyListing',
        chainId: marketplaceReadChainId,
        args: [
          Number(listingId),
          initialAmount,
          startTime48,
          endTime48,
        ],
      });
    } catch (error: any) {
      console.error('[Fix180DayDuration] Error updating listing:', error);
      alert(`Failed to fix duration: ${error.message || 'Unknown error'}`);
    }
  };

  const handleUpdateListing = async (startTime: number | null, endTime: number | null) => {
    if (!isConnected || !auction) {
      return;
    }

    try {
      const initialAmount = BigInt(auction.initialAmount || "0");
      const startTime48 = startTime || 0;
      let endTime48 = endTime || 0;

      const now = Math.floor(Date.now() / 1000);
      const SAFE_DURATION_6_MONTHS = 15552000;

      if (startTime48 === 0 && endTime48 > 0) {
        if (endTime48 > 946684800 && endTime48 > now && endTime48 < now + SAFE_DURATION_6_MONTHS) {
          endTime48 = Math.max(0, endTime48 - now);

          if (endTime48 > SAFE_DURATION_6_MONTHS) {
            console.warn(`[UpdateListing] Duration calculated (${endTime48}s) exceeds safe limit. Capping to ${SAFE_DURATION_6_MONTHS}s (6 months)`);
            endTime48 = SAFE_DURATION_6_MONTHS;
          }

          console.log(`[UpdateListing] startTime=0: Converting absolute timestamp to duration ${endTime48}s (${Math.floor(endTime48 / 86400)} days)`);
        }
      }

      await modifyListing({
        address: marketplaceReadAddress,
        abi: MARKETPLACE_ABI,
        functionName: 'modifyListing',
        chainId: marketplaceReadChainId,
        args: [
          Number(listingId),
          initialAmount,
          startTime48,
          endTime48,
        ],
      });
    } catch (err) {
      console.error("Error updating listing:", err);
      alert("Failed to update listing. Please try again.");
    }
  };

  useEffect(() => {
    const errors = [cancelError, finalizeError, modifyError, purchaseError, offerError, acceptError, bidError, approveError];
    for (const error of errors) {
      if (error) {
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
          console.error('[AuctionDetail] Chain ID error detected, showing switch prompt:', error);
          setShowChainSwitchPrompt(true);
          if (!isMiniApp) {
            try {
              switchToRequiredChain();
            } catch (switchErr) {
              console.error('[AuctionDetail] Error switching chain:', switchErr);
            }
          }
          break;
        }
      }
    }
  }, [
    cancelError,
    finalizeError,
    modifyError,
    purchaseError,
    offerError,
    acceptError,
    bidError,
    approveError,
    isMiniApp,
    switchToRequiredChain,
  ]);

  useEffect(() => {
    if (isCancelConfirmed) {
      const invalidateCache = async () => {
        try {
          await fetch('/api/auctions/invalidate-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId }),
          });
        } catch (error) {
          console.error('Failed to invalidate cache:', error);
        }
      };

      let timer1: NodeJS.Timeout | null = null;
      let timer2: NodeJS.Timeout | null = null;

      invalidateCache().then(() => {
        refetchAuction();
        timer1 = setTimeout(() => {
          router.refresh();
          timer2 = setTimeout(() => {
            router.push("/");
          }, 100);
        }, 200);
      });

      return () => {
        if (timer1) clearTimeout(timer1);
        if (timer2) clearTimeout(timer2);
      };
    }
  }, [isCancelConfirmed, router, listingId, refetchAuction]);

  const hasHandledFinalizeRef = useRef(false);

  useEffect(() => {
    if (isFinalizeConfirmed && auction && !hasHandledFinalizeRef.current) {
      hasHandledFinalizeRef.current = true;

      updateAuction((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'FINALIZED' as const,
        };
      });

      const invalidateCache = async () => {
        try {
          await fetch('/api/auctions/invalidate-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId }),
          });
        } catch (error) {
          console.error('Failed to invalidate cache:', error);
        }
      };

      const pollForFinalizedStatus = async (maxRetries = 10, delayMs = 2000) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            await refetchAuction(true);
          } catch (error) {
            console.error(`[Finalize] Polling attempt ${attempt + 1} failed:`, error);
          }
        }
      };

      invalidateCache().then(() => {
        pollForFinalizedStatus().catch(err => {
          console.error('[Finalize] Polling failed:', err);
        });
      });

      const isOwnAuctionLocal = isConnected && address && auction.seller &&
        address.toLowerCase() === auction.seller.toLowerCase();
      const isWinnerLocal = isConnected && address && auction.highestBid?.bidder &&
        address.toLowerCase() === auction.highestBid.bidder.toLowerCase();

      if (isWinnerLocal && !isOwnAuctionLocal) {
        const redirectTimer = setTimeout(() => {
          router.refresh();
          setTimeout(() => {
            router.push("/");
          }, 100);
        }, 3000);

        return () => {
          clearTimeout(redirectTimer);
        };
      }
    }

    if (!isFinalizeConfirmed) {
      hasHandledFinalizeRef.current = false;
    }
  }, [isFinalizeConfirmed, listingId, refetchAuction, updateAuction, router, isConnected, address]);

  const hasHandledModifyRef = useRef(false);

  useEffect(() => {
    if (isModifyConfirmed && !hasHandledModifyRef.current) {
      hasHandledModifyRef.current = true;
      refetchAuction();
      router.refresh();
      setShowUpdateForm(false);
    }

    if (!isModifyConfirmed) {
      hasHandledModifyRef.current = false;
    }
  }, [isModifyConfirmed, router, refetchAuction]);

  useEffect(() => {
    if (isBidConfirmed && bidHash && bidHash === lastProcessedBidHash.current) {
      return;
    }

    if (isBidConfirmed && address && auction && bidAmount && bidHash) {
      lastProcessedBidHash.current = bidHash;
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      const bidAmountFormatted = bidAmount || '0';
      const previousBidder = auction.highestBid?.bidder;

      const parts = bidAmount.split('.');
      const wholePart = BigInt(parts[0] || '0');
      const fractionalPart = parts[1]
        ? BigInt(parts[1].padEnd(paymentDecimals, '0').slice(0, paymentDecimals))
        : BigInt(0);
      const bidAmountBigInt = wholePart * (BigInt(10) ** BigInt(paymentDecimals)) + fractionalPart;
      const currentTimestamp = Math.floor(Date.now() / 1000).toString();

      const isAlreadyReflected = auction.highestBid?.bidder?.toLowerCase() === address.toLowerCase() &&
        auction.highestBid?.amount === bidAmountBigInt.toString();

      if (!isAlreadyReflected) {
        updateAuction((prev: any) => {
          if (!prev) return prev;

          const newBid = {
            id: `temp-${Date.now()}`,
            bidder: address.toLowerCase(),
            amount: bidAmountBigInt.toString(),
            timestamp: currentTimestamp,
          };

          const updatedBids = prev.bids ? [...prev.bids, newBid] : [newBid];
          updatedBids.sort((a: any, b: any) => {
            const amountA = BigInt(a.amount);
            const amountB = BigInt(b.amount);
            return amountA > amountB ? -1 : amountA < amountB ? 1 : 0;
          });

          return {
            ...prev,
            bidCount: updatedBids.length,
            highestBid: {
              amount: bidAmountBigInt.toString(),
              bidder: address.toLowerCase(),
              timestamp: currentTimestamp,
            },
            bids: updatedBids,
          };
        });
      }

      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          type: 'BID_PLACED',
          title: 'Bid Placed',
          message: `You've placed a bid on ${artworkName}`,
          listingId: listingId,
          metadata: {
            amount: bidAmount,
            artworkName,
          },
        }),
      }).catch(err => console.error('Error creating bidder notification:', err));

      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: auction.seller,
          type: 'NEW_BID',
          title: 'New Bid',
          message: `New bid on ${artworkName} from ${address.slice(0, 6)}...${address.slice(-4)} for ${bidAmountFormatted} ${paymentSymbol}`,
          listingId: listingId,
          metadata: {
            bidder: address,
            amount: bidAmount,
            artworkName,
          },
        }),
      }).catch(err => console.error('Error creating seller notification:', err));

      if (previousBidder && previousBidder.toLowerCase() !== address.toLowerCase()) {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: previousBidder,
            type: 'OUTBID',
            title: 'You\'ve Been Outbid',
            message: `You've been outbid on ${artworkName}`,
            listingId: listingId,
            metadata: {
              newBidAmount: bidAmount,
              artworkName,
            },
          }),
        }).catch(err => console.error('Error creating outbid notification:', err));
      }

      const timer = setTimeout(() => {
        refetchAuction();
      }, 2000);

      setBidAmount('');

      return () => clearTimeout(timer);
    }
  }, [isBidConfirmed, address, auction, listingId, bidAmount, bidHash, router, paymentSymbol, updateAuction, refetchAuction, paymentDecimals]);

  useEffect(() => {
    if (isOfferConfirmed && address && auction) {
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      const offerAmountFormatted = offerAmount || '0';

      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: auction.seller,
          type: 'NEW_OFFER',
          title: 'New Offer',
          message: `New offer on ${artworkName} for ${offerAmountFormatted} ${paymentSymbol} from ${address.slice(0, 6)}...${address.slice(-4)}`,
          listingId: listingId,
          metadata: {
            offerer: address,
            amount: offerAmount,
            artworkName,
          },
        }),
      }).catch(err => console.error('Error creating offer notification:', err));

      refetchOffers();
      router.refresh();
    }
  }, [isOfferConfirmed, refetchOffers, router, address, auction, listingId, offerAmount, paymentSymbol]);

  useEffect(() => {
    if (isAcceptConfirmed && address && auction && offers) {
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';

      const acceptedOffer = offers.find((o: any) => o.offerer && o.offerer.toLowerCase() !== address.toLowerCase());
      if (acceptedOffer) {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: acceptedOffer.offerer,
            type: 'OFFER_ACCEPTED',
            title: 'Offer Accepted',
            message: `Your offer on ${artworkName} was accepted`,
            listingId: listingId,
            metadata: {
              artworkName,
              amount: acceptedOffer.amount,
            },
          }),
        }).catch(err => console.error('Error creating offer accepted notification:', err));

        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: address,
            type: 'BUY_NOW_SALE',
            title: 'Sale Completed',
            message: `New sale on ${artworkName} to ${acceptedOffer.offerer.slice(0, 6)}...${acceptedOffer.offerer.slice(-4)}`,
            listingId: listingId,
            metadata: {
              buyer: acceptedOffer.offerer,
              artworkName,
              amount: acceptedOffer.amount,
            },
          }),
        }).catch(err => console.error('Error creating seller notification:', err));
      }

      refetchOffers();
      router.refresh();
    }
  }, [isAcceptConfirmed, refetchOffers, router, address, auction, listingId, offers]);

  useEffect(() => {
    if (isPurchaseConfirmed && address && auction) {
      updateAuction((prev: any) => {
        if (!prev) return prev;

        const currentTotalSold = parseInt(prev.totalSold || "0");
        const newTotalSold = currentTotalSold + purchaseQuantity;
        const totalAvailable = parseInt(prev.totalAvailable || "0");
        const remaining = totalAvailable - newTotalSold;

        return {
          ...prev,
          totalSold: newTotalSold.toString(),
          status: remaining <= 0 ? "FINALIZED" : prev.status,
        };
      });

      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      const isERC1155 = auction.tokenSpec === 'ERC1155' || String(auction.tokenSpec) === '2';
      const notificationType = isERC1155 ? 'ERC1155_PURCHASE' : 'ERC721_PURCHASE';

      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          type: notificationType,
          title: 'Purchase Completed',
          message: isERC1155
            ? `You bought ${purchaseQuantity} ${artworkName}`
            : `You purchased ${artworkName}`,
          listingId: listingId,
          metadata: {
            artworkName,
            quantity: purchaseQuantity,
            price: auction.currentPrice || auction.initialAmount,
          },
        }),
      }).catch(err => console.error('Error creating buyer notification:', err));

      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: auction.seller,
          type: 'BUY_NOW_SALE',
          title: 'Sale Completed',
          message: `New sale on ${artworkName} to ${address.slice(0, 6)}...${address.slice(-4)}`,
          listingId: listingId,
          metadata: {
            buyer: address,
            artworkName,
            quantity: purchaseQuantity,
            price: auction.currentPrice || auction.initialAmount,
          },
        }),
      }).catch(err => console.error('Error creating seller notification:', err));

      const currentTimestamp = Math.floor(Date.now() / 1000).toString();
      const buyerData = {
        address: address.toLowerCase(),
        totalCount: purchaseQuantity,
        firstPurchase: currentTimestamp,
        lastPurchase: currentTimestamp,
        username: null,
        displayName: null,
        pfpUrl: null,
        fid: null,
      };

      const handler = (window as any)[`buyerAdded_${listingId}`];
      if (handler) {
        handler(buyerData);
      }

      router.refresh();
      const timer = setTimeout(() => {
        router.push("/");
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isPurchaseConfirmed, router, address, auction, listingId, purchaseQuantity, updateAuction]);

  useEffect(() => {
    if (!isSDKLoaded) return;

    const setupBackNavigation = async () => {
      try {
        const capabilities = await sdk.getCapabilities();
        if (Array.isArray(capabilities) && capabilities.includes("back")) {
          await sdk.back.enableWebNavigation();

          sdk.back.onback = () => {
            router.push("/");
          };

          await sdk.back.show();
        }
      } catch (error) {
        console.error("Failed to set up back navigation:", error);
      }
    };

    setupBackNavigation();

    const handleBackNavigation = () => {
      router.push("/");
    };

    sdk.on("backNavigationTriggered", handleBackNavigation);

    return () => {
      sdk.off("backNavigationTriggered", handleBackNavigation);
      sdk.back.onback = null;
    };
  }, [isSDKLoaded, router]);

  const displayCreatorAddress = creatorAddress || auction?.seller || null;

  const { username: creatorUsername } = useUsername(displayCreatorAddress);
  const { username: sellerUsername } = useUsername(auction?.seller || null);
  const { username: bidderUsername } = useUsername(auction?.highestBid?.bidder || null);

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isCancelled = auction?.status === "CANCELLED";
  const displayCreatorName = auction?.artist || creatorName;

  const shareText = useMemo(() => {
    if (!auction || isCancelled) return "";
    return generateListingShareText(
      auction,
      contractName || undefined,
      displayCreatorName || undefined,
      displayCreatorAddress || undefined,
      creatorUsername || undefined,
      paymentSymbol,
      paymentDecimals
    );
  }, [auction, contractName, displayCreatorName, displayCreatorAddress, creatorUsername, paymentSymbol, paymentDecimals, isCancelled]);

  const endTime = auction?.endTime ? parseInt(auction.endTime) : 0;
  const startTime = auction?.startTime ? parseInt(auction.startTime) : 0;
  const bidCount = auction?.bidCount || 0;
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const oneYearInSeconds = 365 * 24 * 60 * 60;
  const SAFE_DURATION_6_MONTHS = 15552000;
  const hasStarted = auction?.listingType === "INDIVIDUAL_AUCTION"
    ? bidCount > 0 || !!auction?.highestBid
    : parseInt(auction?.totalSold || "0") > 0;
  const isAtRiskListing = auction?.listingType === "INDIVIDUAL_AUCTION" &&
    startTime === 0 &&
    endTime > 0 &&
    endTime > nowTimestamp + oneYearInSeconds &&
    !hasStarted;
  const isOwnAuctionForRisk = !!(isConnected && address && auction?.seller &&
    address.toLowerCase() === auction.seller.toLowerCase());
  const canUpdateAtRisk = !!(isOwnAuctionForRisk && isAtRiskListing && auction?.status !== "CANCELLED");

  const has180DayIssue = auction?.listingType === "INDIVIDUAL_AUCTION" &&
    startTime === 0 &&
    endTime === SAFE_DURATION_6_MONTHS &&
    !hasStarted;
  const isOwnAuction = !!(isConnected && address && auction?.seller &&
    address.toLowerCase() === auction.seller.toLowerCase());
  const canFix180DayIssue = !!(isOwnAuction && has180DayIssue && auction?.status !== "CANCELLED");

  const isListingSeller = useMemo(() => {
    if (!auction?.seller) return false;
    const s = auction.seller.toLowerCase();
    return verifiedWalletAddresses.some((a) => a === s);
  }, [auction?.seller, verifiedWalletAddresses]);

  const listingTypo = useMemo(
    () => listingThemeTypographyClasses(listingPageTheme),
    [listingPageTheme]
  );

  const listingPageCursorCss = useMemo(
    () => composeListingThemeCursorCss(listingPageTheme),
    [listingPageTheme]
  );

  const listingBgGradient = useMemo(
    () => composeLinearGradientCss(listingPageTheme),
    [listingPageTheme]
  );

  const listingShellStyle = useMemo((): CSSProperties => {
    return {
      background: listingBgGradient,
      ...(listingPageCursorCss ? { cursor: listingPageCursorCss } : {}),
    };
  }, [listingBgGradient, listingPageCursorCss]);

  useEffect(() => {
    if (canUpdateAtRisk) {
      setShowUpdateForm(true);
    }
  }, [canUpdateAtRisk]);

  const isBuilding =
    !buildingTimedOut &&
    !auction &&
    (pageStatus === 'building' || pageStatus === null);

  const mergedAmbiguousChains = useMemo(() => {
    if (listingApiChainId != null) return null;
    if (ambiguousChains?.length) return ambiguousChains;
    if (pageStatus === "ambiguous" && pageStatusAmbiguousChains?.length) {
      return pageStatusAmbiguousChains;
    }
    return null;
  }, [
    listingApiChainId,
    ambiguousChains,
    pageStatus,
    pageStatusAmbiguousChains,
  ]);

  let pageState: AuctionDetailPageState;

  if (
    mergedAmbiguousChains &&
    (!loading || pageStatus === "ambiguous")
  ) {
    pageState = "ambiguous";
  } else if (loading || isBuilding) {
    pageState = "loading";
  } else if (!loading && !auction && auctionFetchError?.message === AUCTION_FETCH_TIMEOUT) {
    pageState = "fetchTimeout";
  } else if (!loading && !auction && buildingTimedOut) {
    pageState = "timeout";
  } else if (!auction && !loading && pageStatus === 'not_found') {
    pageState = "notFound";
  } else if (!auction && !loading && (pageStatus === 'ready' || pageStatus === 'error')) {
    pageState = "indexedButMissing";
  } else if (!auction) {
    pageState = "notFound";
  } else {
    pageState = "ready";
  }

  const currentPrice = auction?.highestBid?.amount || auction?.initialAmount || "0";
  const title =
    (typeof auction?.title === "string" && auction.title.trim()) ||
    pickDisplayTitle(auction?.metadata) ||
    `Auction #${listingId}`;
  const resolvedListingChainId =
    typeof auction?.chainId === "number" && Number.isFinite(auction?.chainId)
      ? auction.chainId
      : listingApiChainId ?? CHAIN_ID;
  const listingChainInfo = getChainNetworkInfo(resolvedListingChainId);
  const chainScopeMismatch =
    listingApiChainId != null &&
    typeof auction?.chainId === "number" &&
    Number.isFinite(auction.chainId) &&
    auction.chainId !== listingApiChainId;
  const listingHeroImageUrl =
    auction?.detailThumbnailUrl ?? auction?.thumbnailUrl ?? auction?.image;
  const listingFullscreenImageUrl =
    auction?.detailThumbnailUrl ?? auction?.image ?? auction?.thumbnailUrl;
  const hasBid = bidCount > 0 || !!auction?.highestBid;

  const auctionHasStarted = startTime === 0
    ? hasBid
    : now >= startTime;

  let actualEndTime: number;
  if (startTime === 0 && auctionHasStarted) {
    const ONE_YEAR_IN_SECONDS = 31536000;
    const YEAR_2000_TIMESTAMP = 946684800;

    if (endTime > YEAR_2000_TIMESTAMP) {
      actualEndTime = endTime;
    } else {
      const auctionStartTimestamp = auction?.highestBid?.timestamp
        ? parseInt(auction.highestBid.timestamp)
        : now;
      actualEndTime = auctionStartTimestamp + endTime;
    }
  } else if (startTime === 0 && !auctionHasStarted) {
    actualEndTime = 0;
  } else {
    actualEndTime = endTime;
  }

  const isEnded = auctionHasStarted && actualEndTime > 0 && actualEndTime <= now && auction?.status === "ACTIVE" && !isCancelled;
  const isActive = auctionHasStarted && (actualEndTime === 0 || actualEndTime > now) && auction?.status === "ACTIVE";

  let effectiveEndTime: number | null;
  if (startTime === 0 && auctionHasStarted && actualEndTime > 0) {
    effectiveEndTime = actualEndTime;
  } else if (startTime === 0 && !auctionHasStarted) {
    effectiveEndTime = null;
  } else {
    const contractEndTime = listingData?.details?.endTime
      ? Number(listingData.details.endTime)
      : null;
    const subgraphEndTime = endTime;
    effectiveEndTime = contractEndTime || subgraphEndTime;
  }
  const effectiveEnded = effectiveEndTime && effectiveEndTime > 0 && auctionHasStarted
    ? effectiveEndTime <= nowTimestamp
    : isEnded;

  const showControls = !!((isActive || !auctionHasStarted) && !effectiveEnded && auction?.status === "ACTIVE" && !isCancelled && !has180DayIssue);

  const isWinner = !!(isConnected && address && auction?.highestBid?.bidder &&
    address.toLowerCase() === auction.highestBid.bidder.toLowerCase());

  const canCancel =
    !!(isOwnAuction && !hasBid && !isCancelled && auction?.status === "ACTIVE");
  const isCancelLoading = isCancelling || isConfirmingCancel;

  const canFinalize = !!(isConnected && effectiveEnded && !isCancelled && auction?.status !== "FINALIZED" && (
    auction?.listingType === "INDIVIDUAL_AUCTION"
      ? (isOwnAuction || isWinner)
      : isOwnAuction
  ));
  const isFinalizeLoading = isFinalizing || isConfirmingFinalize;

  const canUpdate = !!(isOwnAuction && !hasStarted && isActive && !isCancelled);
  const isModifyLoading = isModifying || isConfirmingModify;

  return {
    pageState,
    auction,
    mergedAmbiguousChains,
    listingBgGradient,
    listingPageTheme,
    listingTypo,
    listingShellStyle,
    listingPageCursorCss,
    address,
    isConnected,
    isMiniApp,
    isMiniAppInstalled,
    isSDKLoaded,
    isMember,
    isAdmin,
    canEditListingTheme,
    verifiedWalletAddresses,
    isListingSeller,
    listingId,
    listingApiChainId,
    marketplaceReadAddress,
    marketplaceReadChainId,
    title,
    currentPrice,
    listingHeroImageUrl,
    listingFullscreenImageUrl,
    listingHeroImageFallbackSrcs,
    listingImageOverlayFallbackSrcs,
    listingChainInfo,
    resolvedListingChainId,
    chainScopeMismatch,
    shareText,
    displayCreatorName,
    displayCreatorAddress,
    creatorUsername,
    sellerUsername,
    bidderUsername,
    creatorName,
    creatorAddress,
    sellerName,
    bidderName,
    contractName,
    now,
    startTime,
    endTime,
    actualEndTime,
    effectiveEndTime,
    hasBid,
    hasStarted,
    auctionHasStarted,
    isEnded,
    isActive,
    effectiveEnded,
    isCancelled,
    showControls,
    isOwnAuction,
    isWinner,
    canCancel,
    canFinalize,
    canUpdate,
    canUpdateAtRisk,
    canFix180DayIssue,
    isAtRiskListing,
    has180DayIssue,
    isCancelling,
    isConfirmingCancel,
    isCancelLoading,
    isFinalizing,
    isConfirmingFinalize,
    isFinalizeLoading,
    isModifying,
    isConfirmingModify,
    isModifyLoading,
    isPurchasing,
    isConfirmingPurchase,
    isBidding,
    isConfirmingBid,
    isOffering,
    isConfirmingOffer,
    isAccepting,
    isConfirmingAccept,
    isApproving,
    isConfirmingApprove,
    bidAmount,
    setBidAmount,
    offerAmount,
    setOfferAmount,
    purchaseQuantity,
    setPurchaseQuantity,
    isImageOverlayOpen,
    setIsImageOverlayOpen,
    showUpdateForm,
    setShowUpdateForm,
    showChainSwitchPrompt,
    setShowChainSwitchPrompt,
    isPaymentETH,
    paymentSymbol,
    paymentDecimals,
    erc20Token,
    userBalance,
    offers,
    activeOffers,
    offersLoading,
    refetchOffers,
    handleBid,
    handlePurchase,
    handleMakeOffer,
    handleAcceptOffer,
    handleCancel,
    handleFinalize,
    handleFix180DayDuration,
    handleUpdateListing,
    handleSwapBuyToken,
    formatPrice,
    calculateMinBid,
    refetchAuction,
    actions,
    modifyError,
    isExplicitEthereumListing,
    pendingPurchaseAfterApproval,
    bidCount,
    nowTimestamp,
    listingData,
    erc20Allowance,
    refetchAllowance,
    cancelError,
    finalizeError,
    purchaseError,
    offerError,
    acceptError,
    bidError,
    approveError,
    cancelHash,
    finalizeHash,
    modifyHash,
    purchaseHash,
    offerHash,
    acceptHash,
    bidHash,
    approveHash,
    isCancelConfirmed,
    isFinalizeConfirmed,
    isModifyConfirmed,
    isPurchaseConfirmed,
    isOfferConfirmed,
    isAcceptConfirmed,
    isBidConfirmed,
    isApproveConfirmed,
    loading,
    auctionFetchError,
    setBuildingTimedOut,
    setPageStatus,
    switchToRequiredChain,
    referrer,
  };
}
