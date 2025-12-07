"use client";

import { useState, useEffect, useMemo } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuction } from "~/hooks/useAuction";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { ShareButton } from "~/components/ShareButton";
import { LinkShareButton } from "~/components/LinkShareButton";
import { CopyButton } from "~/components/CopyButton";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ImageOverlay } from "~/components/ImageOverlay";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useOffers } from "~/hooks/useOffers";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { type Address, isAddress } from "viem";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, CHAIN_ID } from "~/lib/contracts/marketplace";
import { useERC20Token, useERC20Balance, isETH } from "~/hooks/useERC20Token";
import { generateListingShareText } from "~/lib/share-text";
import { getAuctionTimeStatus, getFixedPriceTimeStatus } from "~/lib/time-utils";

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
  
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;
  const { auction, loading } = useAuction(listingId);
  const { offers, activeOffers, isLoading: offersLoading, refetch: refetchOffers } = useOffers(listingId);
  const publicClient = usePublicClient();
  const [bidAmount, setBidAmount] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [pendingPurchaseAfterApproval, setPendingPurchaseAfterApproval] = useState(false);
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);
  const [purchaseSimulationError, setPurchaseSimulationError] = useState<string | null>(null);

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
  const referrer = useMemo(() => {
    const refParam = searchParams.get('ref');
    if (!refParam) {
      return null;
    }
    
    // Validate that it's a valid Ethereum address
    if (!isAddress(refParam)) {
      console.warn('Invalid referrer address in URL:', refParam);
      return null;
    }
    
    // Only use referrer if listing supports referrers (referrerBPS > 0)
    if (referrerBPS && referrerBPS > 0) {
      return refParam.toLowerCase() as Address;
    }
    
    return null;
  }, [searchParams, referrerBPS]);
  
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
  // Check if payment is ETH - only true if auction is loaded and erc20 is zero/undefined
  const isPaymentETH = auction ? isETH(auction.erc20) : false;
  const erc20Token = useERC20Token(!isPaymentETH && auction?.erc20 ? auction.erc20 : undefined);
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
  // Only show ETH if we're certain it's ETH (auction loaded and erc20 is zero/undefined)
  // Otherwise, show the ERC20 token symbol, or fallback to $TOKEN if still loading
  const paymentSymbol = useMemo(() => {
    if (!auction) return "$TOKEN"; // Auction not loaded yet
    if (isPaymentETH) return "ETH";
    if (erc20Token.isLoading) return "$TOKEN"; // Token info still loading
    return erc20Token.symbol || "$TOKEN";
  }, [auction, isPaymentETH, erc20Token.isLoading, erc20Token.symbol]);
  
  const paymentDecimals = isPaymentETH ? 18 : (erc20Token.decimals || 18);
  
  // Helper function to convert token address to CAIP-19 format
  const getCAIP19TokenId = (tokenAddress: string | undefined): string | undefined => {
    if (!tokenAddress || isETH(tokenAddress)) return undefined;
    return `eip155:${CHAIN_ID}/erc20:${tokenAddress}`;
  };

  // Calculate required amount based on listing type and user input
  const getRequiredAmount = useMemo(() => {
    if (!auction || isPaymentETH) return BigInt(0);
    
    if (auction.listingType === "FIXED_PRICE") {
      const price = auction.currentPrice || auction.initialAmount;
      return BigInt(price) * BigInt(purchaseQuantity);
    } else if (auction.listingType === "INDIVIDUAL_AUCTION") {
      if (!bidAmount) return BigInt(0);
      try {
        return BigInt(Math.floor(parseFloat(bidAmount) * 10 ** paymentDecimals));
      } catch {
        return BigInt(0);
      }
    } else if (auction.listingType === "OFFERS_ONLY") {
      if (!offerAmount) return BigInt(0);
      try {
        return BigInt(Math.floor(parseFloat(offerAmount) * 10 ** paymentDecimals));
      } catch {
        return BigInt(0);
      }
    }
    return BigInt(0);
  }, [auction, bidAmount, offerAmount, purchaseQuantity, paymentDecimals, isPaymentETH]);

  // Check if user has insufficient balance
  const hasInsufficientBalance = useMemo(() => {
    if (isPaymentETH || !auction || !isConnected || !address) return false;
    
    // For FIXED_PRICE, always check against the purchase price
    if (auction.listingType === "FIXED_PRICE") {
      const price = auction.currentPrice || auction.initialAmount;
      const totalPrice = BigInt(price) * BigInt(purchaseQuantity);
      return userBalance.balance < totalPrice;
    }
    
    // For INDIVIDUAL_AUCTION and OFFERS_ONLY, only check if user has entered an amount
    if (auction.listingType === "INDIVIDUAL_AUCTION" || auction.listingType === "OFFERS_ONLY") {
      if (getRequiredAmount === BigInt(0)) return false;
      return userBalance.balance < getRequiredAmount;
    }
    
    return false;
  }, [isPaymentETH, auction, isConnected, address, getRequiredAmount, userBalance.balance, purchaseQuantity]);

  // Handle top-up action
  const handleTopUp = async () => {
    if (!isSDKLoaded || !auction?.erc20 || isPaymentETH) return;
    
    try {
      const buyToken = getCAIP19TokenId(auction.erc20);
      if (!buyToken) return;

      // Open swap interface with the buy token pre-filled
      // User can choose what to sell and how much
      const result = await sdk.actions.swapToken({
        buyToken,
      });

      if (result.success) {
        // Refresh balance after successful swap
        setTimeout(() => {
          router.refresh();
        }, 2000);
      }
    } catch (error) {
      console.error("Error opening swap:", error);
    }
  };
  
  // Format price for display
  const formatPrice = (amount: string): string => {
    const value = BigInt(amount || "0");
    const divisor = BigInt(10 ** paymentDecimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    let fractionalStr = fractionalPart.toString().padStart(paymentDecimals, "0");
    fractionalStr = fractionalStr.replace(/0+$/, "");
    if (fractionalStr.length > 6) {
      fractionalStr = fractionalStr.slice(0, 6);
    }
    
    return `${wholePart}.${fractionalStr}`;
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
          args: [referrer, Number(listingId), false] as const,
          value: isPaymentETH ? bidAmountBigInt : BigInt(0),
        });
      } else {
        await placeBid({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'bid',
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
    if (!isConnected || !auction || !address || !publicClient) {
      return;
    }

    try {
      setPurchaseSimulationError(null);
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
            args: [MARKETPLACE_ADDRESS, totalPrice],
          });
          // Wait for approval to be confirmed before proceeding
          return;
        }
      }

      const purchaseValue = isPaymentETH ? totalPrice : BigInt(0);

      // Simulate transaction first to catch errors
      try {
        console.log('[Purchase] Simulating transaction for listing', listingId, {
          purchaseQuantity,
          totalPrice: totalPrice.toString(),
          isPaymentETH,
          referrer: referrer || null,
          auctionData: {
            totalAvailable: auction.totalAvailable,
            totalSold: auction.totalSold,
            totalPerSale: auction.totalPerSale,
            tokenSpec: auction.tokenSpec,
            listingType: auction.listingType,
            status: auction.status,
          },
        });

        // Simulate with correct args based on whether referrer exists
        if (referrer) {
          await publicClient.simulateContract({
            account: address,
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            functionName: 'purchase',
            args: [referrer, Number(listingId), purchaseQuantity] as const,
            value: purchaseValue,
          });
        } else {
          await publicClient.simulateContract({
            account: address,
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            functionName: 'purchase',
            args: [Number(listingId), purchaseQuantity] as const,
            value: purchaseValue,
          });
        }

        console.log('[Purchase] Simulation successful, proceeding with transaction');
      } catch (simErr: any) {
        console.error('[Purchase] Transaction simulation failed:', simErr);
        
        // Try to extract the actual revert reason from the error
        let errorMessage = simErr?.message || simErr?.shortMessage || simErr?.cause?.message || String(simErr);
        let revertReason = null;
        
        // Check for revert reason in various error formats
        if (simErr?.cause?.data?.message) {
          revertReason = simErr.cause.data.message;
        } else if (simErr?.data?.message) {
          revertReason = simErr.data.message;
        } else if (simErr?.cause?.data?.errorName) {
          revertReason = simErr.cause.data.errorName;
        } else if (simErr?.cause?.reason) {
          revertReason = simErr.cause.reason;
        } else if (typeof simErr === 'string' && simErr.includes('revert')) {
          revertReason = simErr;
        }
        
        // Try to extract from error details
        if (simErr?.details) {
          console.log('[Purchase] Error details object:', simErr.details);
          if (simErr.details.reason) revertReason = simErr.details.reason;
          if (simErr.details.data?.message) revertReason = simErr.details.data.message;
        }
        
        // Use revert reason if found, otherwise use the general error message
        const displayError = revertReason || errorMessage;
        setPurchaseSimulationError(displayError);
        
        // Get contract state for comparison
        const contractTotalAvailable = listingData?.details?.totalAvailable?.toString() || 'unknown';
        const contractTotalSold = listingData?.totalSold?.toString() || 'unknown';
        const contractTotalPerSale = listingData?.details?.totalPerSale?.toString() || 'unknown';
        const contractFinalized = listingData?.finalized || false;
        const contractStartTime = listingData?.details?.startTime?.toString() || 'unknown';
        const contractEndTime = listingData?.details?.endTime?.toString() || 'unknown';
        const now = Math.floor(Date.now() / 1000);
        const isWithinTimeWindow = contractStartTime !== 'unknown' && contractEndTime !== 'unknown' 
          ? parseInt(contractStartTime) <= now && parseInt(contractEndTime) > now 
          : 'unknown';
        
        // Log detailed error info for debugging
        console.error('[Purchase] Simulation error details:', {
          error: simErr,
          errorMessage,
          revertReason,
          listingId,
          purchaseQuantity,
          totalPrice: totalPrice.toString(),
          // Subgraph data
          subgraph: {
            totalAvailable: auction.totalAvailable,
            totalSold: auction.totalSold,
            totalPerSale: auction.totalPerSale,
            status: auction.status,
            calculatedRemaining: parseInt(auction.totalAvailable || "0") - parseInt(auction.totalSold || "0"),
            calculatedMaxPurchases: Math.floor((parseInt(auction.totalAvailable || "0") - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1")),
          },
          // Contract data
          contract: {
            totalAvailable: contractTotalAvailable,
            totalSold: contractTotalSold,
            totalPerSale: contractTotalPerSale,
            finalized: contractFinalized,
            startTime: contractStartTime,
            endTime: contractEndTime,
            isWithinTimeWindow,
            calculatedRemaining: contractTotalAvailable !== 'unknown' && contractTotalSold !== 'unknown'
              ? parseInt(contractTotalAvailable) - parseInt(contractTotalSold)
              : 'unknown',
            calculatedMaxPurchases: contractTotalAvailable !== 'unknown' && contractTotalSold !== 'unknown' && contractTotalPerSale !== 'unknown'
              ? Math.floor((parseInt(contractTotalAvailable) - parseInt(contractTotalSold)) / parseInt(contractTotalPerSale))
              : 'unknown',
          },
        });
        
        alert(`Transaction would fail: ${displayError}\n\nCheck console for detailed comparison between contract and subgraph data. You can also visit /api/debug/listing/${listingId} to see the full comparison.`);
        return;
      }

      // Purchase with correct value (0 for ERC20, totalPrice for ETH)
      // Pass referrer if available and listing supports referrers
      if (referrer) {
        await purchaseListing({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'purchase',
          args: [referrer, Number(listingId), purchaseQuantity] as const,
          value: purchaseValue,
        });
      } else {
        await purchaseListing({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'purchase',
          args: [Number(listingId), purchaseQuantity] as const,
          value: purchaseValue,
        });
      }
    } catch (err) {
      console.error("Error purchasing:", err);
      setPurchaseSimulationError(err instanceof Error ? err.message : String(err));
    }
  };

  // After approval is confirmed, refetch allowance and proceed with pending purchase if needed
  useEffect(() => {
    if (isApproveConfirmed && pendingPurchaseAfterApproval && !isPaymentETH && auction && address) {
      // Refetch allowance to ensure it's updated
      refetchAllowance().then(() => {
        // Small delay to ensure allowance is updated
        setTimeout(() => {
          try {
            const price = auction.currentPrice || auction.initialAmount;
            const totalPrice = BigInt(price) * BigInt(purchaseQuantity);
            
            // Pass referrer if available and listing supports referrers
            if (referrer) {
              purchaseListing({
                address: MARKETPLACE_ADDRESS,
                abi: MARKETPLACE_ABI,
                functionName: 'purchase',
                args: [referrer, Number(listingId), purchaseQuantity] as const,
                value: BigInt(0),
              });
            } else {
              purchaseListing({
                address: MARKETPLACE_ADDRESS,
                abi: MARKETPLACE_ABI,
                functionName: 'purchase',
                args: [Number(listingId), purchaseQuantity] as const,
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
    
    try {
      await cancelListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'cancel',
        args: [Number(listingId), 0], // holdbackBPS = 0 as per requirements
      });
    } catch (err) {
      console.error("Error cancelling listing:", err);
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
        args: [Number(listingId)],
      });
    } catch (err) {
      console.error("Error finalizing auction:", err);
    }
  };

  // Redirect after successful cancellation
  useEffect(() => {
    if (isCancelConfirmed) {
      // Invalidate cache so homepage shows updated listings
      fetch('/api/auctions/invalidate-cache', { method: 'POST' }).catch(err => 
        console.error('Error invalidating cache:', err)
      );
      // Refresh router to get fresh data, then navigate to home
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isCancelConfirmed, router]);

  // Redirect after successful finalization
  useEffect(() => {
    if (isFinalizeConfirmed) {
      // Invalidate cache so homepage shows updated listings
      fetch('/api/auctions/invalidate-cache', { method: 'POST' }).catch(err => 
        console.error('Error invalidating cache:', err)
      );
      // Refresh router to get fresh data, then navigate to home
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isFinalizeConfirmed, router]);

  // Create notifications after successful bid
  useEffect(() => {
    if (isBidConfirmed && address && auction) {
      const artworkName = auction.title || auction.metadata?.title || `Token #${auction.tokenId}` || 'artwork';
      // Format bid amount using the correct token decimals and symbol
      const bidAmountFormatted = bidAmount || '0';
      const previousBidder = auction.highestBid?.bidder;
      
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
      
      // Refresh auction data
      router.refresh();
      setBidAmount(''); // Clear bid input
    }
  }, [isBidConfirmed, address, auction, listingId, bidAmount, router, paymentSymbol]);

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
      // Invalidate cache so homepage shows updated listings (purchase may have sold out listing)
      fetch('/api/auctions/invalidate-cache', { method: 'POST' }).catch(err => 
        console.error('Error invalidating cache:', err)
      );
      
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
      
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isPurchaseConfirmed, router, address, auction, listingId, purchaseQuantity]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading auction...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Auction not found</p>
      </div>
    );
  }

  const currentPrice = auction.highestBid?.amount || auction.initialAmount;
  const endTime = parseInt(auction.endTime);
  const startTime = auction.startTime ? parseInt(auction.startTime) : 0;
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const isActive = endTime > now && auction.status === "ACTIVE";
  const isCancelled = auction.status === "CANCELLED";
  const title = auction.title || `Auction #${listingId}`;
  // Use metadata artist, then resolved creator name from contract
  const displayCreatorName = auction.artist || creatorName;
  // Use creator address if found, otherwise fall back to seller (shouldn't happen if contract exists)
  const displayCreatorAddress = creatorAddress || auction.seller;
  const bidCount = auction.bidCount || 0;
  const hasBid = bidCount > 0 || !!auction.highestBid;
  
  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Check if the current user is the auction seller
  const isOwnAuction = isConnected && address && auction.seller && 
    address.toLowerCase() === auction.seller.toLowerCase();
  
  // Check if cancellation is allowed (seller can only cancel if no bids and active)
  const canCancel = isOwnAuction && bidCount === 0 && isActive && !isCancelled;
  const isCancelLoading = isCancelling || isConfirmingCancel;
  
  // Check if finalization is allowed (auction has ended and not finalized or cancelled)
  const canFinalize = isConnected && !isActive && !isCancelled && auction.status !== "FINALIZED";
  const isFinalizeLoading = isFinalizing || isConfirmingFinalize;

  // Generate share text
  const shareText = useMemo(() => {
    if (!auction || isCancelled) return "";
    return generateListingShareText(
      auction,
      contractName || undefined,
      displayCreatorName || undefined,
      displayCreatorAddress || undefined,
      undefined, // creatorUsername not available in this file
      paymentSymbol,
      paymentDecimals
    );
  }, [auction, contractName, displayCreatorName, displayCreatorAddress, paymentSymbol, paymentDecimals, isCancelled]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - Only show when not in miniapp */}
      {!isMiniApp && (
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>
      )}
      <div className="container mx-auto px-5 py-4 max-w-4xl">
        {/* Add Mini App Banner - Only show in miniapp context if not already added */}
        {isMiniApp && !isMiniAppInstalled && actions && (
          <div className="mb-4 p-4 bg-[#0a0a0a] border border-[#333333] rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex flex-col gap-1">
                <div className="text-[10px] uppercase tracking-[1.5px] text-[#666666]">
                  Stay Connected
                </div>
                <div className="text-sm font-normal text-[#cccccc]">
                  Add the auctionhouse miniapp to receive notifications about bids, offers, and sales
                </div>
              </div>
              <button
                onClick={actions.addMiniApp}
                className="px-6 py-2.5 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors whitespace-nowrap"
              >
                Add Mini App
              </button>
            </div>
          </div>
        )}
        {/* Full width artwork */}
        <div className="mb-4">
          {auction.image ? (
            <button
              type="button"
              onClick={() => setIsImageOverlayOpen(true)}
              className="w-full cursor-zoom-in"
              aria-label="View artwork fullscreen"
            >
              <img
                src={auction.image}
                alt={title}
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
            </button>
          ) : (
            <div className="w-full aspect-square bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-lg" />
          )}
        </div>

        {/* Fullscreen image overlay */}
        {auction.image && (
          <ImageOverlay
            src={auction.image}
            alt={title}
            isOpen={isImageOverlayOpen}
            onClose={() => setIsImageOverlayOpen(false)}
          />
        )}

        {/* Title, Collection, Creator - each on own row */}
        <div className="mb-4">
          <h1 className="text-2xl font-light mb-1">{title}</h1>
          {contractName && (
            <div className="text-xs text-[#999999] mb-1">{contractName}</div>
          )}
          {displayCreatorName ? (
            <div className="text-xs text-[#cccccc] mb-1 flex items-center justify-between">
              <span>by {displayCreatorName}</span>
              {/* Only show share buttons if auction is not cancelled */}
              {!isCancelled && (
                <div className="flex gap-2 items-center">
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
            <div className="text-xs text-[#cccccc] mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono">{displayCreatorAddress}</span>
                <CopyButton text={displayCreatorAddress} />
              </div>
              {/* Only show share buttons if auction is not cancelled */}
              {!isCancelled && (
                <div className="flex gap-2 items-center">
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
            <div className="text-xs mb-1 flex items-center justify-end gap-2">
              <LinkShareButton
                url={typeof window !== "undefined" ? window.location.href : ""}
              />
              <ShareButton
                url={typeof window !== "undefined" ? window.location.href : ""}
                artworkUrl={auction.image || auction.metadata?.image || null}
                text={`Check out ${title}!`}
              />
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
        </div>

        {/* Cancelled Auction Message */}
        {isCancelled && (
          <div className="mb-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <p className="text-sm text-white font-medium">Auction has been cancelled</p>
          </div>
        )}

        {/* Cancel Listing Button (for seller with no bids) - Hidden if cancelled */}
        {canCancel && !isCancelled && (
          <div className="mb-4">
            <button
              onClick={handleCancel}
              disabled={isCancelLoading}
              className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Finalize Auction Button (for ended auctions) - Hidden if cancelled */}
        {canFinalize && !isCancelled && (
          <div className="mb-4">
            <button
              onClick={handleFinalize}
              disabled={isFinalizeLoading}
              className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFinalizeLoading
                ? isConfirmingFinalize
                  ? "Confirming..."
                  : "Finalizing..."
                : "Finalize Auction"}
            </button>
            {finalizeError && (
              <p className="text-xs text-red-400 mt-2">
                {finalizeError.message || "Failed to finalize auction"}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons - Conditional based on listing type */}
        {!isCancelled && (
          <>
            {/* INDIVIDUAL_AUCTION - Place Bid */}
            {auction.listingType === "INDIVIDUAL_AUCTION" && isActive && (
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
                ) : (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="number"
                        step="0.001"
                        min={formatPrice(calculateMinBid.toString())}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white placeholder:text-[#666666]"
                        placeholder={`Min: ${formatPrice(calculateMinBid.toString())} ${paymentSymbol}`}
                      />
                      {/* Show user balance */}
                      {!userBalance.isLoading && (
                        <p className="text-xs text-[#666666] mt-1">
                          Your balance: {userBalance.formatted} {paymentSymbol}
                        </p>
                      )}
                      {/* Top-up button for insufficient balance */}
                      {isMiniApp && isSDKLoaded && hasInsufficientBalance && !isPaymentETH && (
                        <button
                          onClick={handleTopUp}
                          className="w-full mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-blue-700 transition-colors"
                        >
                          Top-up {paymentSymbol}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleBid}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                    >
                      Place Bid
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FIXED_PRICE - Purchase */}
            {auction.listingType === "FIXED_PRICE" && isActive && (
              <div className="mb-4 space-y-3">
                {auction.tokenSpec === "ERC1155" && (() => {
                  const totalAvailable = parseInt(auction.totalAvailable || "0");
                  const totalSold = parseInt(auction.totalSold || "0");
                  const totalPerSale = parseInt(auction.totalPerSale || "1");
                  const remaining = Math.max(0, totalAvailable - totalSold);
                  const maxPurchases = Math.floor(remaining / totalPerSale);
                  
                  // Show debug info for listing 11 or if data seems missing
                  const showDebug = listingId === "11" || totalAvailable === 0 || isNaN(totalAvailable);
                  
                  return (
                    <div>
                      <label className="block text-sm font-medium text-[#cccccc] mb-2">
                        Number of Purchases
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={maxPurchases > 0 ? maxPurchases : 1}
                        value={purchaseQuantity}
                        onChange={(e) => setPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white"
                      />
                      {showDebug && (
                        <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs">
                          <p className="text-yellow-400 font-medium mb-1">Debug Info (Listing {listingId}):</p>
                          <p className="text-yellow-300">totalAvailable: {auction.totalAvailable || "MISSING"} ({typeof auction.totalAvailable})</p>
                          <p className="text-yellow-300">totalSold: {auction.totalSold || "MISSING"} ({typeof auction.totalSold})</p>
                          <p className="text-yellow-300">totalPerSale: {auction.totalPerSale || "MISSING"} ({typeof auction.totalPerSale})</p>
                          <p className="text-yellow-300">Calculated remaining: {remaining}</p>
                          <p className="text-yellow-300">Max purchases: {maxPurchases}</p>
                          <a
                            href={`/api/debug/listing/${listingId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline mt-1 block"
                          >
                            View contract vs subgraph comparison →
                          </a>
                        </div>
                      )}
                      {totalAvailable > 0 ? (
                        <>
                          <p className="text-xs text-[#999999] mt-1">
                            You will receive {purchaseQuantity * totalPerSale} copies ({purchaseQuantity} purchase{purchaseQuantity !== 1 ? 's' : ''} × {totalPerSale} copies per purchase)
                          </p>
                          <p className="text-xs text-[#666666] mt-0.5">
                            {remaining} copies remaining ({maxPurchases} purchase{maxPurchases !== 1 ? 's' : ''} available)
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-yellow-400 mt-1">
                          ⚠️ Copy count data missing. Check debug info above or visit /api/debug/listing/{listingId}
                        </p>
                      )}
                    </div>
                  );
                })()}
                {!isConnected ? (
                  <p className="text-xs text-[#cccccc]">
                    Please connect your wallet to purchase.
                  </p>
                ) : isOwnAuction ? (
                  <p className="text-xs text-[#cccccc]">
                    You cannot purchase your own listing.
                  </p>
                ) : (
                  <>
                    <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-[#cccccc]">Price Per Copy</span>
                        <span className="text-lg font-medium text-white">
                          {formatPrice(auction.initialAmount)} {paymentSymbol}
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
                            <span className="text-sm font-medium text-white">
                              {formatPrice((BigInt(auction.initialAmount) * BigInt(purchaseQuantity)).toString())} {paymentSymbol}
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
                    {/* Top-up button for insufficient balance */}
                    {isMiniApp && isSDKLoaded && hasInsufficientBalance && !isPaymentETH && (
                      <button
                        onClick={handleTopUp}
                        className="w-full mb-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-blue-700 transition-colors"
                      >
                        Top-up {paymentSymbol}
                      </button>
                    )}
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
                    {purchaseSimulationError && (
                      <div className="mt-2 p-3 bg-red-900/20 border border-red-700/50 rounded text-xs">
                        <p className="text-red-400 font-medium mb-1">⚠️ Transaction Simulation Failed:</p>
                        <p className="text-red-300 mb-2">{purchaseSimulationError}</p>
                        {listingData && (
                          <div className="mt-2 pt-2 border-t border-red-700/30">
                            <p className="text-red-300 font-medium mb-1">Contract State:</p>
                            <div className="text-red-200 space-y-0.5 font-mono text-[10px]">
                              <p>totalAvailable: {listingData.details?.totalAvailable?.toString() || 'N/A'}</p>
                              <p>totalSold: {listingData.totalSold?.toString() || 'N/A'}</p>
                              <p>totalPerSale: {listingData.details?.totalPerSale?.toString() || 'N/A'}</p>
                              <p>finalized: {listingData.finalized ? 'true' : 'false'}</p>
                              <p>Remaining: {listingData.details?.totalAvailable && listingData.totalSold 
                                ? (parseInt(listingData.details.totalAvailable.toString()) - parseInt(listingData.totalSold.toString()))
                                : 'N/A'}</p>
                            </div>
                          </div>
                        )}
                        {auction && (
                          <div className="mt-2 pt-2 border-t border-red-700/30">
                            <p className="text-red-300 font-medium mb-1">Subgraph State:</p>
                            <div className="text-red-200 space-y-0.5 font-mono text-[10px]">
                              <p>totalAvailable: {auction.totalAvailable || 'N/A'}</p>
                              <p>totalSold: {auction.totalSold || 'N/A'}</p>
                              <p>totalPerSale: {auction.totalPerSale || 'N/A'}</p>
                              <p>status: {auction.status || 'N/A'}</p>
                              <p>Remaining: {parseInt(auction.totalAvailable || "0") - parseInt(auction.totalSold || "0")}</p>
                            </div>
                          </div>
                        )}
                        <a
                          href={`/api/debug/listing/${listingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline mt-2 block"
                        >
                          View full diagnostic comparison →
                        </a>
                      </div>
                    )}
                    {purchaseError && (
                      <p className="text-xs text-red-400">
                        {purchaseError.message || "Failed to purchase"}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* OFFERS_ONLY - Make Offer */}
            {auction.listingType === "OFFERS_ONLY" && isActive && (
              <div className="mb-4 space-y-4">
                {!isConnected ? (
                  <p className="text-xs text-[#cccccc]">
                    Please connect your wallet to make an offer.
                  </p>
                ) : isOwnAuction ? (
                  <p className="text-xs text-[#cccccc]">
                    You cannot make an offer on your own listing.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="number"
                        step="0.001"
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm rounded-lg focus:ring-2 focus:ring-white focus:border-white placeholder:text-[#666666]"
                        placeholder={`Enter offer in ${paymentSymbol}`}
                      />
                      {/* Show user balance */}
                      {!userBalance.isLoading && (
                        <p className="text-xs text-[#666666] mt-1">
                          Your balance: {userBalance.formatted} {paymentSymbol}
                        </p>
                      )}
                      {/* Top-up button for insufficient balance */}
                      {isMiniApp && isSDKLoaded && hasInsufficientBalance && !isPaymentETH && (
                        <button
                          onClick={handleTopUp}
                          className="w-full mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium tracking-[0.5px] hover:bg-blue-700 transition-colors"
                        >
                          Top-up {paymentSymbol}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleMakeOffer}
                      disabled={isOffering || isConfirmingOffer || !offerAmount}
                      className="w-full px-4 py-2 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="mt-4 p-4 bg-[#1a1a1a] border border-[#333333] rounded-lg">
                    <h3 className="text-sm font-medium text-white mb-3">Active Offers</h3>
                    <div className="space-y-2">
                      {activeOffers.map((offer, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-2 bg-black rounded border border-[#333333]"
                        >
                          <div>
                            <p className="text-sm text-white font-medium">
                              {formatPrice(offer.amount)} {paymentSymbol}
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
                            >
                              {isAccepting || isConfirmingAccept
                                ? "Processing..."
                                : "Accept"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
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
              const timeStatus = getAuctionTimeStatus(startTime, endTime, hasBid, now);
              return (
                <>
                  {/* Compact auction info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span>{formatPrice(auction.initialAmount)} {paymentSymbol} reserve</span>
                    <span className="text-[#444]">•</span>
                    <span>{auction.highestBid ? `${formatPrice(currentPrice)} ${paymentSymbol} high` : "No bids"}</span>
                    <span className="text-[#444]">•</span>
                    <span>{bidCount} bid{bidCount !== 1 ? "s" : ""}</span>
                    <span className="text-[#444]">•</span>
                    <span>{timeStatus.status === "Not started" ? "Not started" : isActive ? "Active" : "Ended"}</span>
                    {timeStatus.timeRemaining && (
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
                      <span className="text-white">{sellerName}</span>
                    ) : auction.seller ? (
                      <span className="font-mono text-white">{auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}</span>
                    ) : null}
                  </div>

                  {/* Bid History */}
                  {auction.bids && auction.bids.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-medium text-[#999999] mb-2 uppercase tracking-wider">Bid History</h3>
                      <div className="space-y-1">
                        {auction.bids.map((bid: any, index: number) => (
                          <div key={bid.id} className="flex items-center justify-between py-1.5 text-xs border-b border-[#222]">
                            <div className="flex items-center gap-2">
                              {index === 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white rounded">HIGH</span>
                              )}
                              <span className="text-white font-medium">
                                {formatPrice(bid.amount)} {paymentSymbol}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[#999999]">
                              <span className="font-mono">{bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {auction.listingType === "FIXED_PRICE" && (() => {
              const timeStatus = getFixedPriceTimeStatus(endTime, now);
              const totalAvailable = parseInt(auction.totalAvailable || "0");
              const totalSold = parseInt(auction.totalSold || "0");
              const remaining = Math.max(0, totalAvailable - totalSold);
              const isSoldOut = remaining === 0;
              return (
                <>
                  {/* Compact fixed price info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span>{formatPrice(auction.initialAmount)} {paymentSymbol}</span>
                    {auction.tokenSpec === "ERC1155" && totalAvailable > 0 && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>{remaining}/{totalAvailable} available</span>
                      </>
                    )}
                    {auction.tokenSpec === "ERC1155" && totalAvailable === 0 && listingId === "11" && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span className="text-yellow-400">⚠️ Copy count missing</span>
                      </>
                    )}
                    <span className="text-[#444]">•</span>
                    <span>{isSoldOut ? "Sold Out" : "Active"}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && (
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
                      <span className="text-white">{sellerName}</span>
                    ) : auction.seller ? (
                      <span className="font-mono text-white">{auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}</span>
                    ) : null}
                  </div>
                </>
              );
            })()}

            {auction.listingType === "OFFERS_ONLY" && (() => {
              const timeStatus = getFixedPriceTimeStatus(endTime, now);
              return (
                <>
                  {/* Compact offers info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span>Offers Only</span>
                    <span className="text-[#444]">•</span>
                    <span>{isActive ? "Active" : "Ended"}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && (
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
                      <span className="text-white">{sellerName}</span>
                    ) : auction.seller ? (
                      <span className="font-mono text-white">{auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}</span>
                    ) : null}
                  </div>
                </>
              );
            })()}

            {auction.listingType === "DYNAMIC_PRICE" && (() => {
              const timeStatus = getFixedPriceTimeStatus(endTime, now);
              return (
                <>
                  {/* Compact dynamic price info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span>Dynamic Price</span>
                    <span className="text-[#444]">•</span>
                    <span>{isActive ? "Active" : "Ended"}</span>
                    {!timeStatus.neverExpires && timeStatus.timeRemaining && (
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
                      <span className="text-white">{sellerName}</span>
                    ) : auction.seller ? (
                      <span className="font-mono text-white">{auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}</span>
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
            <a
              href={`https://app.uniswap.org/swap?outputCurrency=${auction.erc20}&chain=base`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:bg-[#252525] transition-colors text-center"
            >
              Buy {paymentSymbol}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
