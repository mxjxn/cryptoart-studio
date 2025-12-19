"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuction } from "~/hooks/useAuction";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useUsername } from "~/hooks/useUsername";
import { ShareButton } from "~/components/ShareButton";
import { LinkShareButton } from "~/components/LinkShareButton";
import { CopyButton } from "~/components/CopyButton";
import { AddToGalleryButton } from "~/components/AddToGalleryButton";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ImageOverlay } from "~/components/ImageOverlay";
import { ChainSwitchPrompt } from "~/components/ChainSwitchPrompt";
import { MediaDisplay } from "~/components/media";
import { getMediaType, getMediaTypeFromFormat } from "~/lib/media-utils";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useOffers } from "~/hooks/useOffers";
import { useNetworkGuard } from "~/hooks/useNetworkGuard";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { type Address, isAddress } from "viem";
import { useLoadingOverlay } from "~/contexts/LoadingOverlayContext";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, CHAIN_ID, PURCHASE_ABI_NO_REFERRER, PURCHASE_ABI_WITH_REFERRER } from "~/lib/contracts/marketplace";
import { useERC20Token, useERC20Balance, isETH } from "~/hooks/useERC20Token";
import { generateListingShareText } from "~/lib/share-text";
import { getAuctionTimeStatus, getFixedPriceTimeStatus, isNeverExpiring } from "~/lib/time-utils";
import { UpdateListingForm } from "~/components/UpdateListingForm";
import { Fix180DayDurationForm } from "~/components/Fix180DayDurationForm";
import { TokenImage } from "~/components/TokenImage";
import { AdminContextMenu } from "~/components/AdminContextMenu";
import { MetadataViewer } from "~/components/MetadataViewer";
import { ContractDetails } from "~/components/ContractDetails";
import { BuyersList } from "~/components/BuyersList";

// ERC20 ABI for approval functions
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

interface AuctionDetailClientProps {
  listingId: string;
}

export default function AuctionDetailClient({
  listingId,
}: AuctionDetailClientProps) {
  // Use effective address: in miniapp uses Farcaster primary wallet, on web uses wagmi connector
  const { address, isConnected } = useEffectiveAddress();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSDKLoaded, actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const chainId = useChainId();
  const { switchToBase } = useNetworkGuard();
  const { hideOverlay } = useLoadingOverlay();
  
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;
  const { auction, loading, refetch: refetchAuction, updateAuction } = useAuction(listingId);
  
  // Track page building status
  const [pageStatus, setPageStatus] = useState<'building' | 'ready' | 'error' | null>(null);
  const [isCheckingPageStatus, setIsCheckingPageStatus] = useState(false);

  // Poll for page status when listing is not found or page is building
  useEffect(() => {
    if (!listingId) return;
    
    let pollInterval: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const checkPageStatus = async () => {
      if (isCheckingPageStatus) return;
      setIsCheckingPageStatus(true);
      
      try {
        const response = await fetch(`/api/listings/${listingId}/page-status`, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        if (!response.ok) {
          // Don't throw error - just log it and continue
          console.warn('Page status check failed:', response.status, response.statusText);
          if (isMounted) {
            // If we don't have a status yet, assume building
            if (pageStatus === null) {
              setPageStatus('building');
            }
          }
          return;
        }
        const data = await response.json();
        
        if (isMounted) {
          setPageStatus(data.status);
          
          // If page is ready, stop polling
          if (data.status === 'ready') {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            
            // Refetch auction data now that page is ready
            refetchAuction();
            
            // Send notification that page is ready (only if we're the seller and page just became ready)
            // Check if readyAt was just set (within last 5 seconds) to avoid duplicate notifications
            if (data.readyAt) {
              const readyAt = new Date(data.readyAt);
              const now = new Date();
              const timeSinceReady = now.getTime() - readyAt.getTime();
              
              // Only send notification if page became ready in the last 5 seconds
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
        // Don't let page status errors cause redirects - just log and continue
        console.error('Error checking page status:', error);
        if (isMounted) {
          // If we don't have a status yet, assume building
          if (pageStatus === null) {
            setPageStatus('building');
          }
        }
      } finally {
        if (isMounted) {
          setIsCheckingPageStatus(false);
        }
      }
    };
    
    // Initial check
    checkPageStatus();
    
    // Poll every 3 seconds if status is building or if auction is not found
    if (pageStatus === 'building' || (!auction && !loading)) {
      pollInterval = setInterval(checkPageStatus, 3000);
    }
    
    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [listingId, pageStatus, auction, loading, isCheckingPageStatus, address]);

  // Clear overlay when data is ready
  useEffect(() => {
    if (!loading && auction && pageStatus === 'ready') {
      // Wait for view transition to complete before hiding overlay
      // View transitions typically take 300-500ms, so we wait a bit longer to ensure smooth transition
      const timer = setTimeout(() => {
        hideOverlay();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, auction, pageStatus, hideOverlay]);
  const { offers, activeOffers, isLoading: offersLoading, refetch: refetchOffers } = useOffers(listingId);
  const [bidAmount, setBidAmount] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [pendingPurchaseAfterApproval, setPendingPurchaseAfterApproval] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showChainSwitchPrompt, setShowChainSwitchPrompt] = useState(false);
  
  // Track last processed bid hash to prevent duplicate processing
  const lastProcessedBidHash = useRef<string | null>(null);
  
  // Cancel listing transaction
  const { writeContract: cancelListing, data: cancelHash, isPending: isCancelling, error: cancelError } = useWriteContract();
  const { isLoading: isConfirmingCancel, isSuccess: isCancelConfirmed } = useWaitForTransactionReceipt({
    hash: cancelHash,
  });
  
  // Finalize auction transaction
  const { writeContract: finalizeAuction, data: finalizeHash, isPending: isFinalizing, error: finalizeError } = useWriteContract();
  const { isLoading: isConfirmingFinalize, isSuccess: isFinalizeConfirmed } = useWaitForTransactionReceipt({
    hash: finalizeHash,
  });

  // Modify listing transaction
  const { writeContract: modifyListing, data: modifyHash, isPending: isModifying, error: modifyError } = useWriteContract();
  const { isLoading: isConfirmingModify, isSuccess: isModifyConfirmed } = useWaitForTransactionReceipt({
    hash: modifyHash,
  });

  // Purchase transaction (for FIXED_PRICE)
  const { writeContract: purchaseListing, data: purchaseHash, isPending: isPurchasing, error: purchaseError } = useWriteContract();
  const { isLoading: isConfirmingPurchase, isSuccess: isPurchaseConfirmed } = useWaitForTransactionReceipt({
    hash: purchaseHash,
  });

  // Offer transaction (for OFFERS_ONLY)
  const { writeContract: makeOffer, data: offerHash, isPending: isOffering, error: offerError } = useWriteContract();
  const { isLoading: isConfirmingOffer, isSuccess: isOfferConfirmed } = useWaitForTransactionReceipt({
    hash: offerHash,
  });

  // Accept offer transaction (for sellers)
  const { writeContract: acceptOffer, data: acceptHash, isPending: isAccepting, error: acceptError } = useWriteContract();
  const { isLoading: isConfirmingAccept, isSuccess: isAcceptConfirmed } = useWaitForTransactionReceipt({
    hash: acceptHash,
  });

  // Bid transaction (for INDIVIDUAL_AUCTION)
  const { writeContract: placeBid, data: bidHash, isPending: isBidding, error: bidError } = useWriteContract();
  const { isLoading: isConfirmingBid, isSuccess: isBidConfirmed } = useWaitForTransactionReceipt({
    hash: bidHash,
  });

  // ERC20 approval transaction
  const { writeContract: approveERC20, data: approveHash, isPending: isApproving, error: approveError } = useWriteContract();
  const { isLoading: isConfirmingApprove, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Resolve creator name from contract address (NFT creator, not auction seller)
  // Pass null for address so it only looks up contract creator, not seller
  const {
    artistName: creatorName,
    isLoading: creatorNameLoading,
    creatorAddress,
  } = useArtistName(
    null, // Don't pass seller address - we want the contract creator, not seller
    auction?.tokenAddress || undefined,
    auction?.tokenId ? BigInt(auction.tokenId) : undefined
  );

  // Resolve seller name separately (for display in auction details)
  const { artistName: sellerName, isLoading: sellerNameLoading } =
    useArtistName(
      auction?.seller || null,
      undefined, // No contract address for seller lookup
      undefined
    );

  // Resolve bidder name if there's a highest bid
  const { artistName: bidderName, isLoading: bidderNameLoading } =
    useArtistName(
      auction?.highestBid?.bidder || null,
      undefined, // No contract address for bidder lookup
      undefined
    );

  // Fetch contract name
  const { contractName, isLoading: contractNameLoading } = useContractName(
    auction?.tokenAddress as Address | undefined
  );

  // Fetch ERC20 token info and user balance (only if not ETH and not own auction)
  const isPaymentETH = isETH(auction?.erc20);
  const erc20Token = useERC20Token(!isPaymentETH ? auction?.erc20 : undefined);
  const userBalance = useERC20Balance(auction?.erc20, address);
  
  // Check ERC20 allowance (only for ERC20 payments)
  const { data: erc20Allowance, refetch: refetchAllowance } = useReadContract({
    address: !isPaymentETH && auction?.erc20 ? (auction.erc20 as Address) : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && !isPaymentETH && auction?.erc20 ? [address, MARKETPLACE_ADDRESS] : undefined,
    query: {
      enabled: !isPaymentETH && !!auction?.erc20 && !!address,
    },
  });
  
  // Determine token symbol and decimals for display
  const paymentSymbol = isPaymentETH ? "ETH" : (erc20Token.symbol || "$TOKEN");
  const paymentDecimals = isPaymentETH ? 18 : (erc20Token.decimals || 18);

  // Get referrerBPS from contract to check if listing supports referrers
  const { data: listingData } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getListing",
    args: [Number(listingId)],
    query: {
      enabled: !!listingId,
    },
  });
  
  // Extract referrerBPS from listing data
  const referrerBPS = listingData ? (listingData as any).referrerBPS : undefined;

  // Extract and validate referrer from URL
  // Support both 'referralAddress' (new) and 'ref' (legacy) for backwards compatibility
  const referrer = useMemo(() => {
    const referralAddressParam = searchParams.get('referralAddress') || searchParams.get('ref');
    if (!referralAddressParam) {
      return null;
    }
    
    // Validate that it's a valid Ethereum address
    if (!isAddress(referralAddressParam)) {
      console.warn('Invalid referrer address in URL:', referralAddressParam);
      return null;
    }
    
    // Only use referrer if listing supports referrers (referrerBPS > 0)
    if (referrerBPS && referrerBPS > 0) {
      return referralAddressParam.toLowerCase() as Address;
    }
    
    return null;
  }, [searchParams, referrerBPS]);

  // Helper function to convert token address to CAIP-19 format
  const getCAIP19TokenId = (tokenAddress: string | undefined): string | undefined => {
    if (!tokenAddress || isETH(tokenAddress)) return undefined;
    return `eip155:${CHAIN_ID}/erc20:${tokenAddress}`;
  };

  // Prefill amount for swap (only for fixed-price listings)
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

  // Swap button handler for miniapp context
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
  
  // Format price for display with commas
  const formatPrice = (amount: string): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** paymentDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
    // Format whole part with commas
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

  // Calculate minimum bid amount
  const calculateMinBid = useMemo(() => {
    if (!auction) return BigInt(0);
    
    if (!auction.highestBid) {
      // No existing bid - minimum is the initial amount
      return BigInt(auction.initialAmount);
    } else {
      // There's an existing bid - need to add increment
      const currentPrice = BigInt(auction.highestBid.amount);
      const minIncrementBPS = 500; // Default 5% increment
      return currentPrice + (currentPrice * BigInt(minIncrementBPS)) / BigInt(10000);
    }
  }, [auction]);

  // Pre-fill bid amount with minimum bid when auction data is available
  useEffect(() => {
    if (auction && calculateMinBid > BigInt(0) && !bidAmount) {
      // Format the minimum bid inline to avoid dependency issues
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
      // Parse bid amount using the correct decimals for the payment token
      // Use a more precise parsing method to avoid floating point issues
      const bidAmountBigInt = (() => {
        const parts = bidAmount.split('.');
        const wholePart = BigInt(parts[0] || '0');
        const fractionalPart = parts[1] ? BigInt(parts[1].padEnd(paymentDecimals, '0').slice(0, paymentDecimals)) : BigInt(0);
        return wholePart * BigInt(10 ** paymentDecimals) + fractionalPart;
      })();
      
      // Use the calculated minimum bid
      const minBid = calculateMinBid;
      
      // Allow bids that are exactly equal to or greater than the minimum
      if (bidAmountBigInt < minBid) {
        alert(`Bid must be at least ${formatPrice(minBid.toString())} ${paymentSymbol}`);
        return;
      }
      
      // For ERC20 payments, check and handle approval
      if (!isPaymentETH && auction.erc20) {
        const tokenAddress = auction.erc20 as Address;
        const currentAllowance = erc20Allowance as bigint | undefined;
        
        // Check if approval is needed
        if (!currentAllowance || currentAllowance < bidAmountBigInt) {
          // Approve the marketplace to spend the tokens
          await approveERC20({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            chainId: CHAIN_ID,
            args: [MARKETPLACE_ADDRESS, bidAmountBigInt],
          });
          // Wait for approval to be confirmed before proceeding
          return;
        }
      }
      
      // Use increase=false to bid the exact amount sent
      // Pass referrer if available and listing supports referrers
      if (referrer) {
        await placeBid({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'bid',
          chainId: CHAIN_ID,
          args: [referrer, Number(listingId), false] as const,
          value: isPaymentETH ? bidAmountBigInt : BigInt(0),
        });
      } else {
        await placeBid({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'bid',
          chainId: CHAIN_ID,
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
      
      // For ERC20 payments, check and handle approval
      if (!isPaymentETH && auction.erc20) {
        const tokenAddress = auction.erc20 as Address;
        const currentAllowance = erc20Allowance as bigint | undefined;
        
        // Check if approval is needed
        if (!currentAllowance || currentAllowance < totalPrice) {
          // Set flag to auto-purchase after approval
          setPendingPurchaseAfterApproval(true);
          // Approve the marketplace to spend the tokens
          await approveERC20({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            chainId: CHAIN_ID,
            args: [MARKETPLACE_ADDRESS, totalPrice],
          });
          // Wait for approval to be confirmed before proceeding
          return;
        }
      }

      const purchaseValue = isPaymentETH ? totalPrice : BigInt(0);

      // Log purchase attempt for debugging
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

      // Purchase with correct value (0 for ERC20, totalPrice for ETH)
      // Use referrer if available and listing supports referrers
      if (referrer) {
        await purchaseListing({
          address: MARKETPLACE_ADDRESS,
          abi: PURCHASE_ABI_WITH_REFERRER,
          functionName: 'purchase',
          chainId: CHAIN_ID,
          args: [referrer, Number(listingId), purchaseQuantity],
          value: purchaseValue,
        });
      } else {
        await purchaseListing({
          address: MARKETPLACE_ADDRESS,
          abi: PURCHASE_ABI_NO_REFERRER,
          functionName: 'purchase',
          chainId: CHAIN_ID,
          args: [Number(listingId), purchaseQuantity],
          value: purchaseValue,
        });
      }
    } catch (err) {
      console.error("Error purchasing:", err);
    }
  };

  // After approval is confirmed, refetch allowance and proceed with pending purchase if needed
  useEffect(() => {
    if (isApproveConfirmed && pendingPurchaseAfterApproval && !isPaymentETH && auction && address) {
      let timer: NodeJS.Timeout | null = null;
      
      // Refetch allowance to ensure it's updated
      refetchAllowance().then(() => {
        // Small delay to ensure allowance is updated
        timer = setTimeout(() => {
          try {
            const price = auction.currentPrice || auction.initialAmount;
            const totalPrice = BigInt(price) * BigInt(purchaseQuantity);
            
            console.log('[Purchase] Executing post-approval purchase:', {
              listingId: Number(listingId),
              purchaseQuantity,
              totalPrice: totalPrice.toString(),
            });
            
            // Use referrer if available and listing supports referrers
            if (referrer) {
              purchaseListing({
                address: MARKETPLACE_ADDRESS,
                abi: PURCHASE_ABI_WITH_REFERRER,
                functionName: 'purchase',
                args: [referrer, Number(listingId), purchaseQuantity],
                value: BigInt(0),
              });
            } else {
              purchaseListing({
                address: MARKETPLACE_ADDRESS,
                abi: PURCHASE_ABI_NO_REFERRER,
                functionName: 'purchase',
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
  }, [isApproveConfirmed, pendingPurchaseAfterApproval, isPaymentETH, auction, address, purchaseQuantity, listingId, refetchAllowance, purchaseListing, referrer]);

  const handleMakeOffer = async () => {
    if (!isConnected || !offerAmount || !auction || !address) {
      return;
    }

    try {
      // Parse offer amount using the correct decimals for the payment token
      const offerAmountBigInt = BigInt(Math.floor(parseFloat(offerAmount) * 10 ** paymentDecimals));
      
      // For ERC20 payments, check and handle approval
      if (!isPaymentETH && auction.erc20) {
        const tokenAddress = auction.erc20 as Address;
        const currentAllowance = erc20Allowance as bigint | undefined;
        
        // Check if approval is needed
        if (!currentAllowance || currentAllowance < offerAmountBigInt) {
          // Approve the marketplace to spend the tokens
          await approveERC20({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            chainId: CHAIN_ID,
            args: [MARKETPLACE_ADDRESS, offerAmountBigInt],
          });
          // Wait for approval to be confirmed before proceeding
          return;
        }
      }

      // Make offer with correct value (0 for ERC20, offerAmountBigInt for ETH)
      await makeOffer({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'offer',
        chainId: CHAIN_ID,
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
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'accept',
        chainId: CHAIN_ID,
        args: [
          Number(listingId),
          [offererAddress as Address],
          [offerAmountBigInt],
          offerAmountBigInt, // maxAmount
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
    
    // Ensure chainId is available before making the call
    if (!chainId) {
      console.error("Chain ID not available");
      setShowChainSwitchPrompt(true);
      return;
    }
    
    try {
      await cancelListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'cancel',
        chainId: CHAIN_ID, // Explicitly pass chainId to avoid getChainId errors
        args: [Number(listingId), 0], // holdbackBPS = 0 as per requirements
      });
    } catch (err: any) {
      console.error("Error cancelling listing:", err);
      const errorMessage = err?.message || String(err);
      // Handle getChainId errors
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error('[AuctionDetail] Chain ID error in cancel, showing switch prompt:', err);
        setShowChainSwitchPrompt(true);
        if (!isMiniApp) {
          try {
            switchToBase();
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
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'finalize',
        chainId: CHAIN_ID,
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
      // Use current initialAmount (don't change it)
      const initialAmount = BigInt(auction.initialAmount || "0");
      
      // For startTime=0 auctions, endTime must be a duration in seconds
      const startTime48 = 0; // Keep startTime as 0 (start on first bid)
      const endTime48 = durationSeconds; // Duration in seconds

      await modifyListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'modifyListing',
        chainId: CHAIN_ID,
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
      // Use current initialAmount (don't change it)
      const initialAmount = BigInt(auction.initialAmount || "0");
      
      // Convert to number for timestamps (null becomes 0)
      // uint48 can be represented as a number (safe up to 2^53-1, but uint48 max is 2^48-1)
      const startTime48 = startTime || 0;
      let endTime48 = endTime || 0;
      
      // CRITICAL FIX: When startTime=0, endTime must be a DURATION, not an absolute timestamp!
      // If endTime is provided as an absolute timestamp when startTime=0, convert it to duration
      const now = Math.floor(Date.now() / 1000);
      const SAFE_DURATION_6_MONTHS = 15552000; // 6 months in seconds (180 days)
      
      if (startTime48 === 0 && endTime48 > 0) {
        // Check if endTime looks like an absolute timestamp (> year 2000)
        // If it's > now but < now + 6 months, it's likely an absolute timestamp
        if (endTime48 > 946684800 && endTime48 > now && endTime48 < now + SAFE_DURATION_6_MONTHS) {
          // This is an absolute timestamp, convert to duration
          endTime48 = Math.max(0, endTime48 - now);
          
          // Safety check: cap at 6 months
          if (endTime48 > SAFE_DURATION_6_MONTHS) {
            console.warn(`[UpdateListing] Duration calculated (${endTime48}s) exceeds safe limit. Capping to ${SAFE_DURATION_6_MONTHS}s (6 months)`);
            endTime48 = SAFE_DURATION_6_MONTHS;
          }
          
          console.log(`[UpdateListing] startTime=0: Converting absolute timestamp to duration ${endTime48}s (${Math.floor(endTime48 / 86400)} days)`);
        }
      }

      await modifyListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'modifyListing',
        chainId: CHAIN_ID,
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

  // Handle getChainId errors from all transactions
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
              switchToBase();
            } catch (switchErr) {
              console.error('[AuctionDetail] Error switching chain:', switchErr);
            }
          }
          break;
        }
      }
    }
  }, [cancelError, finalizeError, modifyError, purchaseError, offerError, acceptError, bidError, approveError, isMiniApp, switchToBase]);

  // Redirect after successful cancellation
  useEffect(() => {
    if (isCancelConfirmed) {
      // Invalidate cache to ensure cancelled listings are removed from feeds
      const invalidateCache = async () => {
        try {
          await fetch('/api/auctions/invalidate-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId }),
          });
        } catch (error) {
          console.error('Failed to invalidate cache:', error);
          // Continue even if cache invalidation fails
        }
      };
      
      let timer1: NodeJS.Timeout | null = null;
      let timer2: NodeJS.Timeout | null = null;
      
      invalidateCache().then(() => {
        // Refetch auction data to get updated status before navigating
        refetchAuction();
        // Small delay to let refetch complete, then navigate
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

  // Track if we've already handled the finalization confirmation to prevent infinite loops
  const hasHandledFinalizeRef = useRef(false);
  
  // Handle successful finalization - optimistically update status and poll for subgraph update
  useEffect(() => {
    if (isFinalizeConfirmed && auction && !hasHandledFinalizeRef.current) {
      // Mark as handled immediately to prevent re-running
      hasHandledFinalizeRef.current = true;
      
      // Optimistically update the auction status to FINALIZED immediately
      // This ensures the UI updates right away even before subgraph indexes
      updateAuction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'FINALIZED' as const,
        };
      });

      // Invalidate cache to ensure sold-out listings are removed from feeds
      const invalidateCache = async () => {
        try {
          await fetch('/api/auctions/invalidate-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId }),
          });
        } catch (error) {
          console.error('Failed to invalidate cache:', error);
          // Continue even if cache invalidation fails
        }
      };
      
      // Poll for subgraph update with retries (subgraph indexing can take a few seconds)
      // Stop polling once we confirm the status is FINALIZED from subgraph
      const pollForFinalizedStatus = async (maxRetries = 10, delayMs = 2000) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            await refetchAuction(true);
            // refetchAuction updates the auction state, which will cause a re-render
            // The button will hide automatically when auction.status === 'FINALIZED'
            // We don't need to check the return value - just poll until max retries
          } catch (error) {
            console.error(`[Finalize] Polling attempt ${attempt + 1} failed:`, error);
          }
        }
      };
      
      invalidateCache().then(() => {
        // Start polling for subgraph update in background
        pollForFinalizedStatus().catch(err => {
          console.error('[Finalize] Polling failed:', err);
        });
      });
      
      // Determine if user is buyer (winner) vs seller
      const isOwnAuction = isConnected && address && auction.seller &&
        address.toLowerCase() === auction.seller.toLowerCase();
      const isWinner = isConnected && address && auction.highestBid?.bidder &&
        address.toLowerCase() === auction.highestBid.bidder.toLowerCase();
      
      // Only redirect buyer (winner) - seller should stay on page to see finalized state
      // Don't redirect immediately - give user time to see the finalized state
      if (isWinner && !isOwnAuction) {
        const redirectTimer = setTimeout(() => {
          router.refresh();
          setTimeout(() => {
            router.push("/");
          }, 100);
        }, 3000); // 3 second delay so user can see the finalized state
        
        return () => {
          clearTimeout(redirectTimer);
        };
      }
    }
    
    // Reset the ref when isFinalizeConfirmed becomes false (new transaction started)
    if (!isFinalizeConfirmed) {
      hasHandledFinalizeRef.current = false;
    }
  }, [isFinalizeConfirmed, listingId, refetchAuction, updateAuction, router, isConnected, address]);

  // Track if we've already handled the modification confirmation to prevent infinite loops
  const hasHandledModifyRef = useRef(false);
  
  // Refresh after successful modification and close form
  // Refetch auction data after successful modification
  useEffect(() => {
    if (isModifyConfirmed && !hasHandledModifyRef.current) {
      // Mark as handled immediately to prevent re-running
      hasHandledModifyRef.current = true;
      
      // Refetch to get updated listing data (especially endTime for 180-day fix)
      refetchAuction();
      router.refresh();
      setShowUpdateForm(false);
    }
    
    // Reset the ref when isModifyConfirmed becomes false (new transaction started)
    if (!isModifyConfirmed) {
      hasHandledModifyRef.current = false;
    }
  }, [isModifyConfirmed, router, refetchAuction]);

  // Create notifications after successful bid and update UI immediately
  useEffect(() => {
    // Prevent duplicate processing of the same bid
    if (isBidConfirmed && bidHash && bidHash === lastProcessedBidHash.current) {
      return;
    }
    
    if (isBidConfirmed && address && auction && bidAmount && bidHash) {
      // Mark this bid hash as processed
      lastProcessedBidHash.current = bidHash;
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      // Format bid amount using the correct token decimals and symbol
      const bidAmountFormatted = bidAmount || '0';
      const previousBidder = auction.highestBid?.bidder;
      
      // Get the bid amount in BigInt format for optimistic update
      const parts = bidAmount.split('.');
      const wholePart = BigInt(parts[0] || '0');
      const fractionalPart = parts[1]
        ? BigInt(parts[1].padEnd(paymentDecimals, '0').slice(0, paymentDecimals))
        : BigInt(0);
      const bidAmountBigInt = wholePart * (BigInt(10) ** BigInt(paymentDecimals)) + fractionalPart;
      const currentTimestamp = Math.floor(Date.now() / 1000).toString();
      
      // Check if this bid is already reflected in the auction data (to prevent duplicate updates)
      const isAlreadyReflected = auction.highestBid?.bidder?.toLowerCase() === address.toLowerCase() &&
        auction.highestBid?.amount === bidAmountBigInt.toString();
      
      // Optimistically update the auction state immediately (only if not already reflected)
      if (!isAlreadyReflected) {
        updateAuction((prev) => {
          if (!prev) return prev;
          
          // Create new bid entry
          const newBid = {
            id: `temp-${Date.now()}`,
            bidder: address.toLowerCase(),
            amount: bidAmountBigInt.toString(),
            timestamp: currentTimestamp,
          };
          
          // Update bids array - add new bid and sort by amount descending
          const updatedBids = prev.bids ? [...prev.bids, newBid] : [newBid];
          updatedBids.sort((a, b) => {
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
      
      // Notify bidder
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
      
      // Notify seller
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
      
      // Notify previous bidder if they were outbid
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
      
      // Refetch auction data from subgraph to get the latest state
      // Use a small delay to allow subgraph to index the new bid
      const timer = setTimeout(() => {
        refetchAuction();
      }, 2000);
      
      // Clear bid input - it will be repopulated with next minimum bid after refetch
      setBidAmount('');
      
      return () => clearTimeout(timer);
    }
  }, [isBidConfirmed, address, auction, listingId, bidAmount, bidHash, router, paymentSymbol, updateAuction, refetchAuction, paymentDecimals]);

  // Refetch offers after successful offer or accept and create notifications
  useEffect(() => {
    if (isOfferConfirmed && address && auction) {
      // Create notification for seller about new offer
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      
      // Format offer amount using the correct token decimals and symbol
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
      // Create notifications for accepted offer
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      
      // Find the accepted offer to get offerer address
      const acceptedOffer = offers.find((o: any) => o.offerer && o.offerer.toLowerCase() !== address.toLowerCase());
      if (acceptedOffer) {
        // Notify offerer
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
        
        // Notify seller
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

  // Redirect after successful purchase and create notifications
  useEffect(() => {
    if (isPurchaseConfirmed && address && auction) {
      // Optimistically update the auction state immediately for instant UI feedback
      updateAuction((prev) => {
        if (!prev) return prev;
        
        const currentTotalSold = parseInt(prev.totalSold || "0");
        const newTotalSold = currentTotalSold + purchaseQuantity;
        const totalAvailable = parseInt(prev.totalAvailable || "0");
        const remaining = totalAvailable - newTotalSold;
        
        // Update totalSold and status if sold out
        return {
          ...prev,
          totalSold: newTotalSold.toString(),
          // Mark as finalized if fully sold
          status: remaining <= 0 ? "FINALIZED" : prev.status,
        };
      });
      
      // Create real-time notifications for buyer and seller
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      const isERC1155 = auction.tokenSpec === 'ERC1155' || String(auction.tokenSpec) === '2';
      const notificationType = isERC1155 ? 'ERC1155_PURCHASE' : 'ERC721_PURCHASE';
      
      // Notify buyer
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
      
      // Notify seller
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
      
      // Optimistically add buyer to buyers list
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
      
      // Trigger optimistic update in BuyersList component
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

  // Set up back navigation for Farcaster mini-app
  useEffect(() => {
    if (!isSDKLoaded) return;

    const setupBackNavigation = async () => {
      try {
        // Check if back navigation is supported
        const capabilities = await sdk.getCapabilities();
        if (capabilities.includes("back")) {
          // Enable web navigation integration (automatically handles browser history)
          await sdk.back.enableWebNavigation();

          // Also set up a custom handler for back navigation
          sdk.back.onback = () => {
            // Navigate back to home page
            router.push("/");
          };

          // Show the back button
          await sdk.back.show();
        }
      } catch (error) {
        console.error("Failed to set up back navigation:", error);
      }
    };

    setupBackNavigation();

    // Listen for back navigation events
    const handleBackNavigation = () => {
      router.push("/");
    };

    sdk.on("backNavigationTriggered", handleBackNavigation);

    return () => {
      sdk.off("backNavigationTriggered", handleBackNavigation);
      // Clear the back handler
      sdk.back.onback = null;
    };
  }, [isSDKLoaded, router]);

  // Calculate derived values for username lookups (before conditional returns)
  // Use creator address if found, otherwise fall back to seller (shouldn't happen if contract exists)
  const displayCreatorAddress = creatorAddress || auction?.seller || null;
  
  // Get usernames for linking to profiles (must be called before conditional returns)
  const { username: creatorUsername } = useUsername(displayCreatorAddress);
  const { username: sellerUsername } = useUsername(auction?.seller || null);
  const { username: bidderUsername } = useUsername(auction?.highestBid?.bidder || null);

  // State for current time (must be called before conditional returns)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  
  // Update countdown every minute (must be called before conditional returns)
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  // Calculate derived values for share text (must be called before conditional returns)
  const isCancelled = auction?.status === "CANCELLED";
  const displayCreatorName = auction?.artist || creatorName;

  // Generate share text (must be called before conditional returns)
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

  // Calculate at-risk listing status (must be called before conditional returns)
  // This is needed for the useEffect hook below
  const endTime = auction?.endTime ? parseInt(auction.endTime) : 0;
  const startTime = auction?.startTime ? parseInt(auction.startTime) : 0;
  const bidCount = auction?.bidCount || 0;
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const oneYearInSeconds = 365 * 24 * 60 * 60;
  const SAFE_DURATION_6_MONTHS = 15552000; // 180 days in seconds
  const hasStarted = auction?.listingType === "INDIVIDUAL_AUCTION" 
    ? bidCount > 0 || !!auction?.highestBid
    : parseInt(auction?.totalSold || "0") > 0;
  const isAtRiskListing = auction?.listingType === "INDIVIDUAL_AUCTION" &&
    startTime === 0 &&
    endTime > 0 &&
    endTime > nowTimestamp + oneYearInSeconds &&
    !hasStarted;
  const isOwnAuctionForRisk = isConnected && address && auction?.seller && 
    address.toLowerCase() === auction.seller.toLowerCase();
  const canUpdateAtRisk = isOwnAuctionForRisk && isAtRiskListing && auction?.status !== "CANCELLED";
  
  // Detect 180-day duration issue: startTime=0 and endTime=180 days (15552000 seconds)
  // This happens when auctions were created with the bug before the fix
  const has180DayIssue = auction?.listingType === "INDIVIDUAL_AUCTION" &&
    startTime === 0 &&
    endTime === SAFE_DURATION_6_MONTHS &&
    !hasStarted; // Only show fix if auction hasn't started yet
  const isOwnAuction = isConnected && address && auction?.seller && 
    address.toLowerCase() === auction.seller.toLowerCase();
  const canFix180DayIssue = isOwnAuction && has180DayIssue && auction?.status !== "CANCELLED";

  // Auto-show update form for at-risk listings (seller needs to fix it)
  // MUST be called before any conditional returns to avoid hook order violations
  useEffect(() => {
    if (canUpdateAtRisk) {
      setShowUpdateForm(true);
    }
  }, [canUpdateAtRisk]);

  // Show building state if page is building or listing not found yet
  const isBuilding = pageStatus === 'building' || (!auction && !loading && pageStatus !== 'ready');
  
  if (loading || isBuilding) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center animate-in fade-in duration-100 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#cccccc] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#cccccc]">
            {isBuilding ? 'Building listing page...' : 'Loading auction...'}
          </p>
        </div>
        {isBuilding && (
          <p className="text-sm text-[#888888] max-w-md text-center px-4">
            Your listing is being processed. This usually takes a few seconds. We'll notify you when it's ready!
          </p>
        )}
      </div>
    );
  }

  if (!auction && !loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <p className="text-[#cccccc]">Auction not found</p>
        <TransitionLink
          href="/"
          className="text-sm text-[#999999] hover:text-white transition-colors underline"
        >
          Return to homepage
        </TransitionLink>
      </div>
    );
  }

  // At this point, auction must exist (we've checked above and returned early if not)
  if (!auction) {
    return null; // TypeScript guard
  }

  const currentPrice = auction.highestBid?.amount || auction.initialAmount || "0";
  // endTime, startTime already calculated above for at-risk detection
  // Use `now` state variable for isActive/isEnded to ensure countdown updates properly
  const title = auction.title || `Auction #${listingId}`;
  // bidCount already calculated above
  const hasBid = bidCount > 0 || !!auction.highestBid;
  
  // Determine if auction has started (recalculate with current `now` state for accuracy)
  // For auctions with startTime = 0, they start on first bid
  // For auctions with startTime > 0, they start when startTime is reached
  const auctionHasStarted = startTime === 0 
    ? hasBid // startTime=0 auctions start on first bid
    : now >= startTime; // startTime>0 auctions start when time is reached
  
  // Calculate actual end timestamp
  // When startTime = 0, endTime is a DURATION (in seconds), not a timestamp
  // When the auction starts (first bid), the contract converts it: endTime += block.timestamp
  // So we need to detect if endTime is already converted (timestamp) or still a duration
  let actualEndTime: number;
  if (startTime === 0 && auctionHasStarted) {
    // For start-on-first-bid auctions that have started:
    // The contract converts endTime to timestamp: endTime = duration + block.timestamp
    // We need to distinguish between:
    // 1. A timestamp (large number, typically > year 2000 = 946684800)
    // 2. A duration (small number, typically < 1 year = 31536000)
    const ONE_YEAR_IN_SECONDS = 31536000;
    const YEAR_2000_TIMESTAMP = 946684800;
    
    // If endTime looks like a timestamp (large number > year 2000), use it directly
    // This works even if the auction has ended (endTime <= now)
    if (endTime > YEAR_2000_TIMESTAMP) {
      // Already converted to timestamp by contract (could be past or future)
      actualEndTime = endTime;
    } else {
      // Still a duration - contract hasn't converted it yet (subgraph not updated)
      // Calculate end time from when auction started
      const auctionStartTimestamp = auction.highestBid?.timestamp 
        ? parseInt(auction.highestBid.timestamp) 
        : now;
      actualEndTime = auctionStartTimestamp + endTime;
    }
  } else if (startTime === 0 && !auctionHasStarted) {
    // Auction hasn't started yet, endTime is still a duration
    // We can't calculate actual end time until auction starts
    actualEndTime = 0;
  } else {
    // For auctions with startTime > 0, endTime is already a timestamp
    actualEndTime = endTime;
  }
  
  // Only consider ended if auction has started AND endTime has passed
  const isEnded = auctionHasStarted && actualEndTime > 0 && actualEndTime <= now && auction.status === "ACTIVE" && !isCancelled;
  const isActive = auctionHasStarted && (actualEndTime === 0 || actualEndTime > now) && auction.status === "ACTIVE";
  
  // For finalization, trust contract state as source of truth
  // But for start-on-first-bid auctions, use our calculated actualEndTime
  let effectiveEndTime: number | null;
  if (startTime === 0 && auctionHasStarted && actualEndTime > 0) {
    // For start-on-first-bid auctions that have started, use calculated end time
    effectiveEndTime = actualEndTime;
  } else if (startTime === 0 && !auctionHasStarted) {
    // For start-on-first-bid auctions that haven't started yet, endTime is a duration, not a timestamp
    // We can't determine if it's ended until the auction starts (first bid)
    effectiveEndTime = null;
  } else {
    // Otherwise use contract or subgraph end time
    const contractEndTime = listingData?.details?.endTime 
      ? Number(listingData.details.endTime) 
      : null;
    const subgraphEndTime = endTime; // From subgraph (original endTime, not updated by contract changes)
    effectiveEndTime = contractEndTime || subgraphEndTime;
  }
  // Only consider ended if we have an effective end time AND auction has started
  const effectiveEnded = effectiveEndTime && effectiveEndTime > 0 && auctionHasStarted 
    ? effectiveEndTime <= nowTimestamp 
    : isEnded;
  
  // Show controls if auction is active OR if it hasn't started yet (so users can see what they'll be able to do)
  // BUT disable if there's a 180-day issue (bidding should be disabled until fixed)
  // Use effectiveEnded to ensure we hide controls when auction has effectively ended
  const showControls = (isActive || !auctionHasStarted) && !effectiveEnded && auction.status === "ACTIVE" && !isCancelled && !has180DayIssue;
  
  // Check if current user is the winner (highest bidder)
  const isWinner = isConnected && address && auction.highestBid?.bidder &&
    address.toLowerCase() === auction.highestBid.bidder.toLowerCase();
  
  // Check if cancellation is allowed (seller can only cancel if no bids and active)
  const canCancel = isOwnAuction && bidCount === 0 && isActive && !isCancelled;
  const isCancelLoading = isCancelling || isConfirmingCancel;
  
  // Check contract state for potential issues
  const contractStartTime = listingData?.details?.startTime 
    ? Number(listingData.details.startTime) 
    : null;
  // nowTimestamp already calculated above
  // contractEndTime already used in effectiveEndTime calculation above
  
  // hasStarted already calculated above for at-risk detection
  // isAtRiskListing already calculated above
  // effectiveEndTime and effectiveEnded already calculated above (moved up for use in showControls)
  
  // Check if finalization is allowed (auction has ended and not finalized or cancelled)
  // For INDIVIDUAL_AUCTION: Both seller and winner can finalize when auction has ended
  // For FIXED_PRICE: Seller can finalize when listing has ended to reclaim unsold items
  const canFinalize = isConnected && effectiveEnded && !isCancelled && auction.status !== "FINALIZED" && (
    auction.listingType === "INDIVIDUAL_AUCTION" 
      ? (isOwnAuction || isWinner)  // Auctions: seller or winner
      : isOwnAuction  // Fixed price: only seller
  );
  const isFinalizeLoading = isFinalizing || isConfirmingFinalize;

  // Check if update is allowed (seller can update if listing hasn't started - no bids for auctions, no sales for fixed price)
  // OR if listing is at-risk (special case to fix the bug)
  const canUpdate = isOwnAuction && !hasStarted && isActive && !isCancelled;
  // canUpdateAtRisk already calculated above (before conditional returns)
  const isModifyLoading = isModifying || isConfirmingModify;

  return (
    <div className="min-h-screen bg-black text-white animate-in fade-in duration-100">
      {/* Header - Only show when not in miniapp */}
      {!isMiniApp && (
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>
      )}
      {/* Back Button - Narrow section above artwork */}
      <div className="border-b border-[#333333]">
        <div className="container mx-auto px-5 py-2 max-w-4xl">
          <TransitionLink
            href="/"
            className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </TransitionLink>
        </div>
      </div>
      <div className="container mx-auto px-5 py-4 max-w-4xl">
        {/* Add Mini App Banner - Only show in miniapp context if not already added */}
        {isMiniApp && !isMiniAppInstalled && actions && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={actions.addMiniApp}
              className="text-xs text-[#999999] hover:text-[#cccccc] transition-colors underline"
            >
              Add to Farcaster
            </button>
          </div>
        )}
        {/* Full width artwork - supports images, audio, video, 3D models, and HTML */}
        <div className="mb-4">
          <MediaDisplay
            imageUrl={auction.image}
            animationUrl={auction.metadata?.animation_url}
            animationFormat={auction.metadata?.animation_details?.format}
            alt={title}
            onImageClick={
              // Only enable fullscreen overlay for images (not audio/video/3D/HTML - they have their own controls)
              (() => {
                const animUrl = auction.metadata?.animation_url;
                const animFormat = auction.metadata?.animation_details?.format;
                if (!animUrl) return auction.image ? () => setIsImageOverlayOpen(true) : undefined;
                // Check both URL extension and format hint to determine if it's non-image media
                let mediaType = getMediaType(animUrl);
                if (mediaType === 'image' && animFormat) {
                  mediaType = getMediaTypeFromFormat(animFormat);
                }
                return mediaType === 'image' ? () => setIsImageOverlayOpen(true) : undefined;
              })()
            }
            viewTransitionName={`artwork-${listingId}`}
          />
        </div>

        {/* Fullscreen image overlay - only for images */}
        {(() => {
          const animUrl = auction.metadata?.animation_url;
          const animFormat = auction.metadata?.animation_details?.format;
          let mediaType = animUrl ? getMediaType(animUrl) : 'image';
          if (mediaType === 'image' && animFormat) {
            mediaType = getMediaTypeFromFormat(animFormat);
          }
          return auction.image && (!animUrl || mediaType === 'image');
        })() && (
          <ImageOverlay
            src={auction.image!}
            alt={title}
            isOpen={isImageOverlayOpen}
            onClose={() => setIsImageOverlayOpen(false)}
          />
        )}

        {/* Title, Collection, Creator - each on own row */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h1 className="text-2xl font-light mb-1">{title}</h1>
              {auction.tokenSpec === "ERC1155" && auction.erc1155TotalSupply && (
                <p className="text-sm text-[#999999] mb-1">edition of {auction.erc1155TotalSupply}</p>
              )}
            </div>
            <AdminContextMenu 
              listingId={listingId} 
              sellerAddress={auction.seller}
            />
          </div>
          {/* Collection name with metadata viewer */}
          {auction.tokenAddress && auction.tokenId && (
            <div className="mb-1">
              <MetadataViewer
                contractAddress={auction.tokenAddress as Address}
                tokenId={auction.tokenId}
                tokenSpec={auction.tokenSpec || "ERC721"}
                collectionName={contractName || undefined}
                totalSupply={auction.erc721TotalSupply}
              />
            </div>
          )}
          {displayCreatorName ? (
            <div className="text-xs text-[#cccccc] mb-1">
              <div className="mb-2">
                <span>
                  by{" "}
                  {creatorUsername ? (
                    <TransitionLink
                      href={`/user/${creatorUsername}`}
                      className="hover:underline"
                    >
                      {displayCreatorName}
                    </TransitionLink>
                  ) : displayCreatorAddress ? (
                    <TransitionLink
                      href={`/user/${displayCreatorAddress}`}
                      className="hover:underline"
                    >
                      {displayCreatorName}
                    </TransitionLink>
                  ) : (
                    displayCreatorName
                  )}
                </span>
              </div>
              {/* Only show share buttons if auction is not cancelled */}
              {!isCancelled && (
                <div className="flex gap-2 items-center">
                  <AddToGalleryButton listingId={listingId} />
                  <LinkShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                  />
                  <ShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                    artworkUrl={auction.image || auction.metadata?.image || null}
                    text={shareText}
                  />
                </div>
              )}
            </div>
          ) : displayCreatorAddress && !creatorNameLoading ? (
            <div className="text-xs text-[#cccccc] mb-1">
              <div className="mb-2 flex items-center gap-2">
                <TransitionLink
                  href={creatorUsername ? `/user/${creatorUsername}` : `/user/${displayCreatorAddress}`}
                  className="font-mono hover:underline"
                >
                  {displayCreatorAddress}
                </TransitionLink>
                <CopyButton text={displayCreatorAddress} />
              </div>
              {/* Only show share buttons if auction is not cancelled */}
              {!isCancelled && (
                <div className="flex gap-2 items-center">
                  <AddToGalleryButton listingId={listingId} />
                  <LinkShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                  />
                  <ShareButton
                    url={typeof window !== "undefined" ? window.location.href : ""}
                    artworkUrl={auction.image || auction.metadata?.image || null}
                    text={shareText}
                  />
                </div>
              )}
            </div>
          ) : !isCancelled ? (
            <div className="text-xs mb-1">
              <div className="flex gap-2 items-center">
                <AddToGalleryButton listingId={listingId} />
                <LinkShareButton
                  url={typeof window !== "undefined" ? window.location.href : ""}
                />
                <ShareButton
                  url={typeof window !== "undefined" ? window.location.href : ""}
                  artworkUrl={auction.image || auction.metadata?.image || null}
                  text={`Check out ${title}!`}
                />
              </div>
            </div>
          ) : null}
          {/* Description */}
          {auction.description && (
            <div className="mb-4">
              <p className="text-xs text-[#cccccc] leading-relaxed">
                {auction.description}
              </p>
            </div>
          )}
          {/* Contract Details */}
          {auction.tokenAddress && (
            <ContractDetails
              contractAddress={auction.tokenAddress as Address}
              imageUrl={auction.image || auction.metadata?.image || null}
            />
          )}
          
          {/* External Links & Token Info */}
          {(auction.tokenAddress || auction.tokenId) && (
            <div className="mb-4 flex gap-3 text-xs items-center">
              {/* Token Spec Badge */}
              {auction.tokenSpec && (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#1a1a1a] border border-[#333333] text-[#cccccc]">
                  {auction.tokenSpec === "ERC1155" || String(auction.tokenSpec) === "2" ? "ERC-1155" : "ERC-721"}
                </span>
              )}
              {auction.tokenAddress && auction.tokenId && (
                <a
                  href={`https://opensea.io/item/base/${auction.tokenAddress}/${auction.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#999999] hover:text-[#cccccc] hover:underline"
                  aria-label={`View NFT on OpenSea: ${contractName || 'Collection'} #${auction.tokenId}`}
                >
                  OpenSea
                </a>
              )}
            </div>
          )}
        </div>

        {/* Cancelled Auction Message */}
        {isCancelled && (
          <div className="mb-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <p className="text-sm text-white font-medium">Auction has been cancelled</p>
          </div>
        )}

        {/* Warning for at-risk listings */}
        {isAtRiskListing && !isCancelled && (
          <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
            <p className="text-yellow-400 font-medium mb-2">⚠️ Auction Configuration Issue</p>
            <p className="text-yellow-300 text-sm mb-3">
              This auction has a configuration issue that would prevent proper finalization. 
              Bidding has been disabled until the auction is updated. Please use the form below to set 
              a valid auction duration (limited to 6 months maximum).
            </p>
          </div>
        )}

        {/* Update Listing Form - Show when update button is clicked OR for at-risk listings */}
        {showUpdateForm && (canUpdate || canUpdateAtRisk) && !isCancelled && (
          <div className="mb-4">
            {isAtRiskListing && (
              <p className="text-sm text-[#cccccc] mb-3">
                Update your auction configuration. Set a start time and end time, or use duration mode.
                Maximum duration is 6 months.
              </p>
            )}
            <UpdateListingForm
              currentStartTime={startTime || null}
              currentEndTime={endTime || null}
              onSubmit={handleUpdateListing}
              onCancel={() => setShowUpdateForm(false)}
              isLoading={isModifyLoading}
              listingType={auction.listingType}
              hideCancel={isAtRiskListing} // Don't allow cancel for at-risk listings (must fix)
            />
            {modifyError && (
              <p className="text-xs text-red-400 mt-2">
                {modifyError.message || "Failed to update listing"}
              </p>
            )}
          </div>
        )}

        {/* Update Listing Button (for seller before auction has started) - Hidden if cancelled or update form is shown */}
        {canUpdate && !isCancelled && !showUpdateForm && (
          <div className="mb-4">
            <button
              onClick={() => setShowUpdateForm(true)}
              disabled={isModifyLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Update listing details"
            >
              Update Listing
            </button>
          </div>
        )}

        {/* Cancel Listing Button (for seller with no bids) - Hidden if cancelled */}
        {canCancel && !isCancelled && (
          <div className="mb-4">
            <button
              onClick={handleCancel}
              disabled={isCancelLoading}
              className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isCancelLoading ? "Cancelling listing" : "Cancel this listing"}
              aria-busy={isCancelLoading}
            >
              {isCancelLoading
                ? isConfirmingCancel
                  ? "Confirming..."
                  : "Cancelling..."
                : "Cancel Listing"}
            </button>
            {cancelError && (
              <p className="text-xs text-red-400 mt-2">
                {cancelError.message || "Failed to cancel auction"}
              </p>
            )}
          </div>
        )}

        {/* Auction Ended Message - Only for INDIVIDUAL_AUCTION */}
        {isEnded && !isCancelled && auction.listingType === "INDIVIDUAL_AUCTION" && (
          <div className="mb-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <p className="text-sm text-white font-medium mb-2">Auction Ended</p>
            {auction.highestBid && hasBid ? (
              <div className="space-y-2">
                <p className="text-xs text-[#cccccc]">
                  Winner: {bidderName ? (
                    bidderUsername ? (
                      <TransitionLink href={`/user/${bidderUsername}`} className="text-white hover:underline">
                        {bidderName}
                      </TransitionLink>
                    ) : (
                      <TransitionLink href={`/user/${auction.highestBid.bidder}`} className="text-white hover:underline">
                        {bidderName}
                      </TransitionLink>
                    )
                  ) : (
                    <TransitionLink href={bidderUsername ? `/user/${bidderUsername}` : `/user/${auction.highestBid.bidder}`} className="font-mono text-white hover:underline">
                      {auction.highestBid.bidder.slice(0, 6)}...{auction.highestBid.bidder.slice(-4)}
                    </TransitionLink>
                  )}
                </p>
                <p className="text-xs text-[#cccccc]">
                  Winning Bid: <span className="text-white font-medium">
                    <span className="flex items-center gap-1.5">
                      {formatPrice(auction.highestBid.amount)} 
                      <TokenImage tokenAddress={auction.erc20} size={14} />
                      <span>{paymentSymbol}</span>
                    </span>
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#cccccc]">No bids were placed on this auction.</p>
            )}
          </div>
        )}

        {/* Finalize Button (for ended listings) - For INDIVIDUAL_AUCTION (seller or winner) and FIXED_PRICE (seller only), Hidden if cancelled */}
        {effectiveEnded && !isCancelled && auction.status !== "FINALIZED" && (
          (auction.listingType === "INDIVIDUAL_AUCTION" && (isOwnAuction || isWinner)) ||
          (auction.listingType === "FIXED_PRICE" && isOwnAuction)
        ) && (
          <div className="mb-4">
            <button
              onClick={handleFinalize}
              disabled={isFinalizeLoading || !canFinalize}
              className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isFinalizeLoading ? "Finalizing auction" : "Finalize this auction"}
              aria-busy={isFinalizeLoading}
            >
              {isFinalizeLoading
                ? isConfirmingFinalize
                  ? "Confirming..."
                  : "Finalizing..."
                : auction.listingType === "INDIVIDUAL_AUCTION" && isWinner
                ? "Finalize & Claim NFT"
                : auction.listingType === "FIXED_PRICE"
                ? "Finalize Listing"
                : "Finalize Auction"}
            </button>
            {finalizeError && (() => {
              const errorMessage = finalizeError.message || String(finalizeError);
              
              let displayMessage = errorMessage;
              
              // Provide specific error messages for known issues
              if (errorMessage.includes('already finalized') || errorMessage.includes('finalized')) {
                displayMessage = "This auction has already been finalized.";
              }
              
              return (
                <p className="text-xs text-red-400 mt-2">
                  {displayMessage}
                </p>
              );
            })()}
          </div>
        )}

        {/* 180-Day Duration Fix Form (for sellers) */}
        {!isCancelled && canFix180DayIssue && (
          <div className="mb-4">
            <Fix180DayDurationForm
              listingId={listingId}
              onSubmit={handleFix180DayDuration}
              isLoading={isModifyLoading}
            />
            {modifyError && (
              <p className="text-xs text-red-400 mt-2">
                {modifyError.message || "Failed to fix duration"}
              </p>
            )}
          </div>
        )}

        {/* Warning message for non-sellers when 180-day issue exists */}
        {!isCancelled && has180DayIssue && !isOwnAuction && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
            <p className="text-sm text-red-400 font-medium mb-1">
              Bidding Temporarily Disabled
            </p>
            <p className="text-xs text-red-300">
              This auction has a configuration issue that needs to be fixed by the seller before bidding can begin.
            </p>
          </div>
        )}

        {/* Action Buttons - Conditional based on listing type */}
        {!isCancelled && (
          <>
            {/* INDIVIDUAL_AUCTION - Place Bid (show if active or not started yet, and not at-risk, and not 180-day issue) */}
            {auction.listingType === "INDIVIDUAL_AUCTION" && showControls && !isAtRiskListing && !has180DayIssue && (
              <div className="mb-4">
                {!isConnected ? (
                  <p className="text-xs text-[#cccccc]">
                    Please connect your wallet to place a bid.
                  </p>
                ) : isOwnAuction ? (
                  <div className="space-y-3">
                    <input
                      type="number"
                      step="0.001"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      disabled
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg opacity-50 cursor-not-allowed placeholder:text-[#666666]"
                      placeholder={
                        auction.highestBid
                          ? `Min: ${formatPrice(currentPrice)} ${paymentSymbol}`
                          : `Min: ${formatPrice(auction.initialAmount)} ${paymentSymbol}`
                      }
                    />
                    <button
                      onClick={handleBid}
                      disabled
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                    >
                      Place Bid
                    </button>
                    <p className="text-xs text-[#cccccc]">
                      You cannot bid on your own auction.
                    </p>
                  </div>
                ) : (() => {
                  // Check if auction has a future startTime (not start-on-first-bid)
                  // For start-on-first-bid (startTime = 0), allow bidding immediately
                  const hasFutureStartTime = startTime > 0 && now < startTime;
                  
                  if (hasFutureStartTime) {
                    return (
                      <div className="space-y-3">
                        <input
                          type="number"
                          step="0.001"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          disabled
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg opacity-50 cursor-not-allowed placeholder:text-[#666666]"
                          placeholder={
                            auction.highestBid
                              ? `Min: ${formatPrice(currentPrice)} ${paymentSymbol}`
                              : `Min: ${formatPrice(auction.initialAmount)} ${paymentSymbol}`
                          }
                        />
                        <button
                          onClick={handleBid}
                          disabled
                          className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                        >
                          Place Bid
                        </button>
                        <p className="text-xs text-[#cccccc]">
                          Auction starts {new Date(startTime * 1000).toLocaleString()}.
                        </p>
                      </div>
                    );
                  }
                  
                  // Auction has started or is start-on-first-bid - show active bid button
                  return (
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="bid-amount-input" className="sr-only">
                          Bid amount in {paymentSymbol}
                        </label>
                        <input
                          id="bid-amount-input"
                          type="number"
                          step="0.001"
                          min={formatPrice(calculateMinBid.toString())}
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white placeholder:text-[#666666]"
                          placeholder={`Min: ${formatPrice(calculateMinBid.toString())} ${paymentSymbol}`}
                          aria-label={`Bid amount in ${paymentSymbol}. Minimum: ${formatPrice(calculateMinBid.toString())} ${paymentSymbol}`}
                          aria-describedby="bid-balance-info"
                        />
                        {/* Show user balance */}
                        {!userBalance.isLoading && (
                          <p id="bid-balance-info" className="text-xs text-[#666666] mt-1" aria-live="polite">
                            Your balance: {userBalance.formatted} {paymentSymbol}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleBid}
                        disabled={isBidding || isConfirmingBid}
                        className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Place bid of ${bidAmount || formatPrice(calculateMinBid.toString())} ${paymentSymbol}`}
                      >
                        {isBidding || isConfirmingBid ? "Processing..." : "Place Bid"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* FIXED_PRICE - Purchase */}
            {auction.listingType === "FIXED_PRICE" && showControls && (() => {
              // Check if ERC721 is sold out
              const isERC721SoldOut = auction.tokenSpec === "ERC721" && 
                parseInt(auction.totalSold || "0") >= parseInt(auction.totalAvailable || "1");
              
              if (isERC721SoldOut) {
                return (
                  <div className="mb-4">
                    <p className="text-center text-lg font-medium text-[#999999] py-4">
                      Sold Out
                    </p>
                  </div>
                );
              }
              
              return (
                <div className="mb-4 space-y-3">
                  {auction.tokenSpec === "ERC1155" && (
                  <div>
                    <label className="block text-sm font-medium text-[#cccccc] mb-2">
                      Number of Purchases
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1"))}
                      value={purchaseQuantity}
                      onChange={(e) => setPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white"
                      aria-label="Number of purchases"
                      aria-describedby="purchase-quantity-info"
                    />
                    <div id="purchase-quantity-info" className="sr-only">
                      You will receive {purchaseQuantity * parseInt(auction.totalPerSale || "1")} copies
                    </div>
                    <p className="text-xs text-[#999999] mt-1">
                      You will receive {purchaseQuantity * parseInt(auction.totalPerSale || "1")} copies ({purchaseQuantity} purchase{purchaseQuantity !== 1 ? 's' : ''} × {auction.totalPerSale} copies per purchase)
                    </p>
                    <p className="text-xs text-[#666666] mt-0.5">
                      {parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")} copies remaining ({Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1"))} purchase{Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1")) !== 1 ? 's' : ''} available)
                      {auction.erc1155TotalSupply && (
                        <span className="ml-1 text-[#999999]">
                          (of {auction.erc1155TotalSupply} total)
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {!isConnected ? (
                  <p className="text-xs text-[#cccccc]">
                    Please connect your wallet to purchase.
                  </p>
                ) : isOwnAuction ? (
                  <p className="text-xs text-[#cccccc]">
                    You cannot purchase your own listing.
                  </p>
                ) : (() => {
                  // For FIXED_PRICE listings, check if listing hasn't started yet
                  // Fixed price listings with startTime > 0 need to wait until startTime
                  // Fixed price listings with startTime = 0 are immediately purchasable
                  const hasNotStartedForFixedPrice = startTime > 0 && now < startTime;
                  
                  if (hasNotStartedForFixedPrice) {
                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg opacity-50">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-[#cccccc]">Price Per Copy</span>
                            <span className="text-lg font-medium text-white flex items-center gap-1.5">
                              {formatPrice(auction.initialAmount)} 
                              <TokenImage tokenAddress={auction.erc20} size={20} className="ml-0.5" />
                              <span>{paymentSymbol}</span>
                            </span>
                          </div>
                        </div>
                        <button
                          disabled
                          className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                        >
                          Buy Now
                        </button>
                        <p className="text-xs text-[#cccccc]">
                          {startTime === 0 
                            ? "Listing will start when the first purchase is made."
                            : `Listing starts ${new Date(startTime * 1000).toLocaleString()}.`}
                        </p>
                      </div>
                    );
                  }
                  
                  // Listing has started or has no startTime - show active buy button
                  return (
                  <>
                    <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-[#cccccc]">Price Per Copy</span>
                        <span className="text-lg font-medium text-white flex items-center gap-1.5">
                          {formatPrice(auction.initialAmount)} 
                          <TokenImage tokenAddress={auction.erc20} size={20} className="ml-0.5" />
                          <span>{paymentSymbol}</span>
                        </span>
                      </div>
                      {auction.tokenSpec === "ERC1155" && (
                        <>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-[#cccccc]">Copies Purchased</span>
                            <span className="text-sm font-medium text-white">
                              {purchaseQuantity * parseInt(auction.totalPerSale || "1")} ({purchaseQuantity} × {auction.totalPerSale})
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-[#cccccc]">Total Price</span>
                            <span className="text-sm font-medium text-white flex items-center gap-1.5">
                              {auction.initialAmount ? formatPrice((BigInt(auction.initialAmount) * BigInt(purchaseQuantity)).toString()) : '—'} 
                              {auction.initialAmount && (
                                <>
                                  <TokenImage tokenAddress={auction.erc20} size={16} />
                                  <span>{paymentSymbol}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </>
                      )}
                      {/* Show user balance */}
                      {!userBalance.isLoading && (
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#333333]">
                          <span className="text-xs text-[#666666]">Your balance</span>
                          <span className="text-xs text-[#666666]">
                            {userBalance.formatted} {paymentSymbol}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Check if ERC20 approval is needed */}
                    {!isPaymentETH && auction.erc20 && address && (() => {
                      const price = auction.currentPrice || auction.initialAmount;
                      // Price is per copy, multiplied by purchase quantity (not by copies)
                      // The contract sells purchaseQuantity * totalPerSale copies for price * purchaseQuantity
                      const totalPrice = BigInt(price) * BigInt(purchaseQuantity);
                      const currentAllowance = erc20Allowance as bigint | undefined;
                      const needsApproval = !currentAllowance || currentAllowance < totalPrice;
                      
                      if (needsApproval && !isApproving && !isConfirmingApprove) {
                        return (
                          <p className="text-xs text-yellow-400 mb-2">
                            You need to approve {paymentSymbol} spending first. Click "Buy Now" to approve.
                          </p>
                        );
                      }
                      return null;
                    })()}
                    <button
                      onClick={handlePurchase}
                      disabled={isPurchasing || isConfirmingPurchase || isApproving || isConfirmingApprove || pendingPurchaseAfterApproval}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={
                        isApproving || isConfirmingApprove
                          ? "Approving token spending"
                          : pendingPurchaseAfterApproval
                          ? "Completing purchase"
                          : isPurchasing || isConfirmingPurchase
                          ? "Processing purchase"
                          : `Buy now for ${formatPrice(auction.initialAmount)} ${paymentSymbol}${auction.tokenSpec === "ERC1155" ? ` (${purchaseQuantity} purchase${purchaseQuantity !== 1 ? 's' : ''})` : ''}`
                      }
                      aria-busy={isPurchasing || isConfirmingPurchase || isApproving || isConfirmingApprove || pendingPurchaseAfterApproval}
                    >
                      {isApproving || isConfirmingApprove
                        ? "Approving..."
                        : pendingPurchaseAfterApproval
                        ? "Completing purchase..."
                        : isPurchasing || isConfirmingPurchase
                        ? "Processing..."
                        : "Buy Now"}
                    </button>
                    {approveError && (
                      <p className="text-xs text-red-400">
                        {approveError.message || "Failed to approve token"}
                      </p>
                    )}
                    {purchaseError && (
                      <p className="text-xs text-red-400">
                        {purchaseError.message || "Failed to purchase"}
                      </p>
                    )}
                  </>
                  );
                })()}
                </div>
              );
            })()}

            {/* OFFERS_ONLY - Make Offer */}
            {auction.listingType === "OFFERS_ONLY" && showControls && (
              <div className="mb-4 space-y-4">
                {!isConnected ? (
                  <p className="text-xs text-[#cccccc]">
                    Please connect your wallet to make an offer.
                  </p>
                ) : !auctionHasStarted ? (
                  <div className="space-y-3">
                    <input
                      type="number"
                      step="0.001"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      disabled
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg opacity-50 cursor-not-allowed placeholder:text-[#666666]"
                      placeholder={`Min: ${formatPrice(auction.initialAmount)} ${paymentSymbol}`}
                    />
                    <button
                      onClick={handleMakeOffer}
                      disabled
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] opacity-50 cursor-not-allowed"
                    >
                      Make Offer
                    </button>
                    <p className="text-xs text-[#cccccc]">
                      {startTime === 0 
                        ? "Listing will start when the first offer is made."
                        : `Listing starts ${new Date(startTime * 1000).toLocaleString()}.`}
                    </p>
                  </div>
                ) : isOwnAuction ? (
                  <p className="text-xs text-[#cccccc]">
                    You cannot make an offer on your own listing.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="offer-amount-input" className="sr-only">
                        Offer amount in {paymentSymbol}
                      </label>
                      <input
                        id="offer-amount-input"
                        type="number"
                        step="0.001"
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white placeholder:text-[#666666]"
                        placeholder={`Enter offer in ${paymentSymbol}`}
                        aria-label={`Offer amount in ${paymentSymbol}`}
                        aria-describedby="offer-balance-info"
                      />
                      {/* Show user balance */}
                      {!userBalance.isLoading && (
                        <p id="offer-balance-info" className="text-xs text-[#666666] mt-1" aria-live="polite">
                          Your balance: {userBalance.formatted} {paymentSymbol}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleMakeOffer}
                      disabled={isOffering || isConfirmingOffer || !offerAmount}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={offerAmount ? `Make offer of ${offerAmount} ${paymentSymbol}` : "Enter offer amount to make an offer"}
                      aria-busy={isOffering || isConfirmingOffer}
                    >
                      {isOffering || isConfirmingOffer
                        ? "Processing..."
                        : "Make Offer"}
                    </button>
                    {offerError && (
                      <p className="text-xs text-red-400">
                        {offerError.message || "Failed to make offer"}
                      </p>
                    )}
                  </div>
                )}

                {/* Offers List - Show for seller and buyers */}
                {activeOffers.length > 0 && (
                  <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg" role="region" aria-label="Active offers">
                    <h3 className="text-sm font-medium text-white mb-3">Active Offers</h3>
                    <ul className="space-y-2" role="list" aria-label={`${activeOffers.length} active offer${activeOffers.length !== 1 ? 's' : ''}`}>
                      {activeOffers.map((offer, index) => (
                        <li
                          key={index}
                          className="flex justify-between items-center p-2 bg-black rounded border border-[#333333]"
                          role="listitem"
                        >
                          <div>
                            <p className="text-sm text-white font-medium">
                              <span className="flex items-center gap-1.5">
                                {formatPrice(offer.amount)} 
                                <TokenImage tokenAddress={auction.erc20} size={14} />
                                <span>{paymentSymbol}</span>
                              </span>
                            </p>
                            <p className="text-xs text-[#999999] font-mono">
                              {offer.offerer.slice(0, 6)}...{offer.offerer.slice(-4)}
                            </p>
                          </div>
                          {isOwnAuction && (
                            <button
                              onClick={() => handleAcceptOffer(offer.offerer, offer.amount)}
                              disabled={isAccepting || isConfirmingAccept}
                              className="px-3 py-1 bg-white text-black text-xs font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label={`Accept offer of ${formatPrice(offer.amount)} ${paymentSymbol} from ${offer.offerer.slice(0, 6)}...${offer.offerer.slice(-4)}`}
                              aria-busy={isAccepting || isConfirmingAccept}
                            >
                              {isAccepting || isConfirmingAccept
                                ? "Processing..."
                                : "Accept"}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {acceptError && (
                      <p className="text-xs text-red-400 mt-2">
                        {acceptError.message || "Failed to accept offer"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Listing details - Different display based on listing type - Hidden if cancelled */}
        {!isCancelled && (
          <div className="mb-4 space-y-4">
            {auction.listingType === "INDIVIDUAL_AUCTION" && (() => {
              // Use actualEndTime for time status calculation
              // When startTime=0 and auction has started, actualEndTime is the calculated end timestamp
              // Otherwise, use endTime (which is already a timestamp for startTime>0, or duration for startTime=0 not started)
              const timeStatusEndTime = (startTime === 0 && auctionHasStarted && actualEndTime > 0) 
                ? actualEndTime 
                : endTime;
              const timeStatus = getAuctionTimeStatus(startTime, timeStatusEndTime, hasBid, now);
              return (
                <>
                  {/* Compact auction info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span className="flex items-center gap-1.5">
                      {formatPrice(auction.initialAmount)} 
                      <TokenImage tokenAddress={auction.erc20} size={14} />
                      <span>{paymentSymbol} reserve</span>
                    </span>
                    <span className="text-[#444]">•</span>
                    <span className="flex items-center gap-1.5">
                      {auction.highestBid ? (
                        <>
                          {formatPrice(currentPrice)} 
                          <TokenImage tokenAddress={auction.erc20} size={14} />
                          <span>{paymentSymbol} high</span>
                        </>
                      ) : (
                        "No bids"
                      )}
                    </span>
                    <span className="text-[#444]">•</span>
                    <span>{bidCount} bid{bidCount !== 1 ? "s" : ""}</span>
                    <span className="text-[#444]">•</span>
                    <span>{timeStatus.status === "Not started" ? "Not started" : isEnded ? "Ended" : isActive ? "Active" : "Ended"}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isEnded && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Seller row */}
                  <div className="text-xs text-[#999999]">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-white">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-white hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>

                  {/* Bid History */}
                  {auction.bids && auction.bids.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-medium text-[#999999] mb-2 uppercase tracking-wider">Bid History</h3>
                      <div className="space-y-1">
                        {auction.bids.map((bid, index) => (
                          <BidHistoryRow
                            key={bid.id}
                            bid={bid}
                            isHighest={index === 0}
                            paymentSymbol={paymentSymbol}
                            formatPrice={formatPrice}
                            tokenAddress={auction.erc20}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {auction.listingType === "FIXED_PRICE" && (() => {
              // Calculate actual end time for FIXED_PRICE (same logic as auctions)
              // For startTime=0, endTime is a duration; for startTime>0, endTime is a timestamp
              let actualEndTimeForFixed: number;
              const YEAR_2000_TIMESTAMP = 946684800;
              
              if (startTime === 0) {
                // For startTime=0, endTime is a duration
                // Use heuristic: if endTime > YEAR_2000_TIMESTAMP, it's likely a timestamp (contract converted it)
                // Otherwise, it's a duration and we can't determine if ended without creation timestamp
                if (endTime > YEAR_2000_TIMESTAMP) {
                  // Looks like a timestamp, use it directly
                  actualEndTimeForFixed = endTime;
                } else {
                  // It's a duration, can't determine if ended without creation timestamp
                  // Treat as active if status is ACTIVE
                  actualEndTimeForFixed = 0;
                }
              } else {
                // For startTime > 0, endTime is already a timestamp
                actualEndTimeForFixed = endTime;
              }
              
              const timeStatus = getFixedPriceTimeStatus(actualEndTimeForFixed, now);
              const totalAvailable = parseInt(auction.totalAvailable || "0");
              const totalSold = parseInt(auction.totalSold || "0");
              const remaining = Math.max(0, totalAvailable - totalSold);
              const isSoldOut = remaining === 0 && totalAvailable > 0;
              const isEnded = actualEndTimeForFixed > 0 && actualEndTimeForFixed <= now && !isNeverExpiring(actualEndTimeForFixed);
              const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
              
              // Determine status: Sold Out takes precedence over Sale Ended
              let statusText = "Active";
              if (isSoldOut) {
                statusText = "Sold Out";
              } else if (isEnded) {
                statusText = "Sale Ended";
              }
              
              return (
                <>
                  {/* Compact fixed price info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span className="flex items-center gap-1.5">
                      {formatPrice(auction.initialAmount)} 
                      <TokenImage tokenAddress={auction.erc20} size={16} />
                      <span>{paymentSymbol}</span>
                    </span>
                    {auction.tokenSpec === "ERC1155" && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>
                          {remaining} left out of {totalAvailable}
                          {totalSupply !== null && totalSupply !== totalAvailable && (
                            <span className="text-[#999999]"> ({totalSupply} in total)</span>
                          )}
                        </span>
                      </>
                    )}
                    <span className="text-[#444]">•</span>
                    <span>{statusText}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isSoldOut && !isEnded && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Seller row */}
                  <div className="text-xs text-[#999999]">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-white">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-white hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>

                  {/* Buyers List */}
                  <BuyersList listingId={listingId} />
                </>
              );
            })()}

            {auction.listingType === "OFFERS_ONLY" && (() => {
              // Calculate actual end time for OFFERS_ONLY (same logic as auctions)
              // For startTime=0, endTime is a duration; for startTime>0, endTime is a timestamp
              let actualEndTimeForOffers: number;
              const YEAR_2000_TIMESTAMP = 946684800;
              
              if (startTime === 0) {
                // For startTime=0, endTime is a duration
                // Use heuristic: if endTime > YEAR_2000_TIMESTAMP, it's likely a timestamp
                // Otherwise, it's a duration and we can't determine if ended without creation timestamp
                if (endTime > YEAR_2000_TIMESTAMP) {
                  // Looks like a timestamp, use it directly
                  actualEndTimeForOffers = endTime;
                } else {
                  // It's a duration, can't determine if ended without creation timestamp
                  actualEndTimeForOffers = 0;
                }
              } else {
                // For startTime > 0, endTime is already a timestamp
                actualEndTimeForOffers = endTime;
              }
              
              const timeStatus = getFixedPriceTimeStatus(actualEndTimeForOffers, now);
              const isEndedForOffers = actualEndTimeForOffers > 0 && actualEndTimeForOffers <= now && !isNeverExpiring(actualEndTimeForOffers);
              const isActiveForOffers = !isEndedForOffers && auction.status === "ACTIVE";
              
              // ERC1155 supply display
              const totalAvailable = parseInt(auction.totalAvailable || "0");
              const totalSold = parseInt(auction.totalSold || "0");
              const remaining = Math.max(0, totalAvailable - totalSold);
              const isSoldOut = remaining === 0 && totalAvailable > 0;
              const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
              
              let statusText = "Active";
              if (isSoldOut) {
                statusText = "Sold Out";
              } else if (isEndedForOffers) {
                statusText = "Sale Ended";
              }
              
              return (
                <>
                  {/* Compact offers info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span>Offers Only</span>
                    {auction.tokenSpec === "ERC1155" && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>
                          {remaining} left out of {totalAvailable}
                          {totalSupply !== null && totalSupply !== totalAvailable && (
                            <span className="text-[#999999]"> ({totalSupply} in total)</span>
                          )}
                        </span>
                      </>
                    )}
                    <span className="text-[#444]">•</span>
                    <span>{statusText}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isSoldOut && !isEndedForOffers && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Seller row */}
                  <div className="text-xs text-[#999999]">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-white">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-white hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>
                </>
              );
            })()}

            {auction.listingType === "DYNAMIC_PRICE" && (() => {
              // Calculate actual end time for DYNAMIC_PRICE (same logic as auctions)
              // For startTime=0, endTime is a duration; for startTime>0, endTime is a timestamp
              let actualEndTimeForDynamic: number;
              const YEAR_2000_TIMESTAMP = 946684800;
              
              if (startTime === 0) {
                // For startTime=0, endTime is a duration
                // Use heuristic: if endTime > YEAR_2000_TIMESTAMP, it's likely a timestamp
                // Otherwise, it's a duration and we can't determine if ended without creation timestamp
                if (endTime > YEAR_2000_TIMESTAMP) {
                  // Looks like a timestamp, use it directly
                  actualEndTimeForDynamic = endTime;
                } else {
                  // It's a duration, can't determine if ended without creation timestamp
                  actualEndTimeForDynamic = 0;
                }
              } else {
                // For startTime > 0, endTime is already a timestamp
                actualEndTimeForDynamic = endTime;
              }
              
              const timeStatus = getFixedPriceTimeStatus(actualEndTimeForDynamic, now);
              const isEndedForDynamic = actualEndTimeForDynamic > 0 && actualEndTimeForDynamic <= now && !isNeverExpiring(actualEndTimeForDynamic);
              const isActiveForDynamic = !isEndedForDynamic && auction.status === "ACTIVE";
              
              // ERC1155 supply display
              const totalAvailable = parseInt(auction.totalAvailable || "0");
              const totalSold = parseInt(auction.totalSold || "0");
              const remaining = Math.max(0, totalAvailable - totalSold);
              const isSoldOut = remaining === 0 && totalAvailable > 0;
              const totalSupply = auction.erc1155TotalSupply ? parseInt(auction.erc1155TotalSupply) : null;
              
              let statusText = "Active";
              if (isSoldOut) {
                statusText = "Sold Out";
              } else if (isEndedForDynamic) {
                statusText = "Sale Ended";
              }
              
              return (
                <>
                  {/* Compact dynamic price info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span>Dynamic Price</span>
                    {auction.tokenSpec === "ERC1155" && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>
                          {remaining} left out of {totalAvailable}
                          {totalSupply !== null && totalSupply !== totalAvailable && (
                            <span className="text-[#999999]"> ({totalSupply} in total)</span>
                          )}
                        </span>
                      </>
                    )}
                    <span className="text-[#444]">•</span>
                    <span>{statusText}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && !isSoldOut && !isEndedForDynamic && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>{timeStatus.timeRemaining}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Seller row */}
                  <div className="text-xs text-[#999999]">
                    Listed by{" "}
                    {sellerName ? (
                      sellerUsername ? (
                        <TransitionLink href={`/user/${sellerUsername}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : auction.seller ? (
                        <TransitionLink href={`/user/${auction.seller}`} className="text-white hover:underline">
                          {sellerName}
                        </TransitionLink>
                      ) : (
                        <span className="text-white">{sellerName}</span>
                      )
                    ) : auction.seller ? (
                      <TransitionLink href={sellerUsername ? `/user/${sellerUsername}` : `/user/${auction.seller}`} className="font-mono text-white hover:underline">
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </TransitionLink>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Buy Token Button - Always show for ERC-20 paired listings when not own auction */}
        {!isCancelled && !isPaymentETH && !isOwnAuction && isConnected && (
          <div className="mb-4">
            {isMiniApp ? (
              <button
                type="button"
                onClick={handleSwapBuyToken}
                disabled={!isSDKLoaded}
                className="block w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:bg-[#252525] transition-colors text-center disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label={`Swap for ${paymentSymbol}`}
              >
                Swap for {paymentSymbol}
              </button>
            ) : (
              <a
                href={`https://app.uniswap.org/swap?outputCurrency=${auction.erc20}&chain=base`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:bg-[#252525] transition-colors text-center"
                aria-label={`Buy ${paymentSymbol} on Uniswap`}
              >
                Buy {paymentSymbol}
              </a>
            )}
          </div>
        )}
      </div>
      
      {/* Chain Switch Prompt */}
      <ChainSwitchPrompt 
        show={showChainSwitchPrompt} 
        onDismiss={() => setShowChainSwitchPrompt(false)} 
      />
    </div>
  );
}

/**
 * Bid History Row Component
 */
function BidHistoryRow({
  bid,
  isHighest,
  paymentSymbol,
  formatPrice,
  tokenAddress,
}: {
  bid: { id: string; bidder: string; amount: string; timestamp: string };
  isHighest: boolean;
  paymentSymbol: string;
  formatPrice: (amount: string) => string;
  tokenAddress: string | undefined;
}) {
  const { artistName } = useArtistName(bid.bidder, undefined, undefined);
  const { username } = useUsername(bid.bidder);
  const bidDate = new Date(parseInt(bid.timestamp) * 1000);
  const timeAgo = getTimeAgo(bidDate);

  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-[#222]">
      <div className="flex items-center gap-2">
        {isHighest && (
          <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white rounded">HIGH</span>
        )}
        <span className="text-white font-medium">
          <span className="flex items-center gap-1.5">
            {formatPrice(bid.amount)} 
            <TokenImage tokenAddress={tokenAddress} size={14} />
            <span>{paymentSymbol}</span>
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[#999999]">
        {username ? (
          <TransitionLink href={`/user/${username}`} className="hover:text-white hover:underline">
            {artistName || username}
          </TransitionLink>
        ) : (
          <TransitionLink href={`/user/${bid.bidder}`} className="font-mono hover:text-white hover:underline">
            {bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)}
          </TransitionLink>
        )}
        <span className="text-[#666]">•</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}

/**
 * Helper to format time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}
