"use client";

import { useState, useEffect, useMemo } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { useAuction } from "~/hooks/useAuction";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useArtistName } from "~/hooks/useArtistName";
import { useContractName } from "~/hooks/useContractName";
import { useUsername } from "~/hooks/useUsername";
import { ShareButton } from "~/components/ShareButton";
import { LinkShareButton } from "~/components/LinkShareButton";
import { CopyButton } from "~/components/CopyButton";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { ImageOverlay } from "~/components/ImageOverlay";
import { MediaDisplay } from "~/components/media";
import { getMediaType, getMediaTypeFromFormat } from "~/lib/media-utils";
import { useAuthMode } from "~/hooks/useAuthMode";
import { useOffers } from "~/hooks/useOffers";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { type Address } from "viem";
import { useLoadingOverlay } from "~/contexts/LoadingOverlayContext";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "~/lib/contracts/marketplace";
import { useERC20Token, useERC20Balance, isETH } from "~/hooks/useERC20Token";
import { generateListingShareText } from "~/lib/share-text";
import { getAuctionTimeStatus, getFixedPriceTimeStatus } from "~/lib/time-utils";
import { UpdateListingForm } from "~/components/UpdateListingForm";

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
  const { isSDKLoaded, actions, context } = useMiniApp();
  const { isMiniApp } = useAuthMode();
  const { hideOverlay } = useLoadingOverlay();
  
  // Check if mini-app is installed using context.client.added from Farcaster SDK
  const isMiniAppInstalled = context?.client?.added ?? false;
  const { auction, loading } = useAuction(listingId);

  // Clear overlay when data is ready
  useEffect(() => {
    if (!loading && auction) {
      // Wait for view transition to complete before hiding overlay
      // View transitions typically take 300-500ms, so we wait a bit longer to ensure smooth transition
      const timer = setTimeout(() => {
        hideOverlay();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, auction, hideOverlay]);
  const { offers, activeOffers, isLoading: offersLoading, refetch: refetchOffers } = useOffers(listingId);
  const [bidAmount, setBidAmount] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [pendingPurchaseAfterApproval, setPendingPurchaseAfterApproval] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  
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
      await placeBid({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'bid',
        args: [Number(listingId), false],
        value: isPaymentETH ? bidAmountBigInt : BigInt(0),
      });
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
            args: [MARKETPLACE_ADDRESS, totalPrice],
          });
          // Wait for approval to be confirmed before proceeding
          return;
        }
      }

      // Purchase with correct value (0 for ERC20, totalPrice for ETH)
      await purchaseListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'purchase',
        args: [Number(listingId), purchaseQuantity],
        value: isPaymentETH ? totalPrice : BigInt(0),
      });
    } catch (err) {
      console.error("Error purchasing:", err);
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
            
            purchaseListing({
              address: MARKETPLACE_ADDRESS,
              abi: MARKETPLACE_ABI,
              functionName: 'purchase',
              args: [Number(listingId), purchaseQuantity],
              value: BigInt(0),
            });
            
            setPendingPurchaseAfterApproval(false);
          } catch (err) {
            console.error("Error purchasing after approval:", err);
            setPendingPurchaseAfterApproval(false);
          }
        }, 1000);
      });
    }
  }, [isApproveConfirmed, pendingPurchaseAfterApproval, isPaymentETH, auction, address, purchaseQuantity, listingId, refetchAllowance, purchaseListing]);

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
      const endTime48 = endTime || 0;

      await modifyListing({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: 'modifyListing',
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

  // Redirect after successful cancellation
  useEffect(() => {
    if (isCancelConfirmed) {
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
      // Refresh router to get fresh data, then navigate to home
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  }, [isFinalizeConfirmed, router]);

  // Refresh after successful modification and close form
  useEffect(() => {
    if (isModifyConfirmed) {
      router.refresh();
      setShowUpdateForm(false);
    }
  }, [isModifyConfirmed, router]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center animate-in fade-in duration-100">
        <p className="text-[#cccccc]">Loading auction...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-[#cccccc]">Auction not found</p>
      </div>
    );
  }

  const currentPrice = auction.highestBid?.amount || auction.initialAmount || "0";
  const endTime = auction.endTime ? parseInt(auction.endTime) : 0;
  const startTime = auction.startTime ? parseInt(auction.startTime) : 0;
  const isActive = endTime > now && auction.status === "ACTIVE";
  const title = auction.title || `Auction #${listingId}`;
  const bidCount = auction.bidCount || 0;
  const hasBid = bidCount > 0 || !!auction.highestBid;
  
  // Check if the current user is the auction seller
  const isOwnAuction = isConnected && address && auction.seller && 
    address.toLowerCase() === auction.seller.toLowerCase();
  
  // Check if cancellation is allowed (seller can only cancel if no bids and active)
  const canCancel = isOwnAuction && bidCount === 0 && isActive && !isCancelled;
  const isCancelLoading = isCancelling || isConfirmingCancel;
  
  // Check if finalization is allowed (auction has ended and not finalized or cancelled)
  const canFinalize = isConnected && !isActive && !isCancelled && auction.status !== "FINALIZED";
  const isFinalizeLoading = isFinalizing || isConfirmingFinalize;

  // Check if update is allowed (seller can update if listing hasn't started - no bids for auctions, no sales for fixed price)
  const hasStarted = auction.listingType === "INDIVIDUAL_AUCTION" 
    ? bidCount > 0 || !!auction.highestBid
    : parseInt(auction.totalSold || "0") > 0;
  const canUpdate = isOwnAuction && !hasStarted && isActive && !isCancelled;
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
          <h1 className="text-2xl font-light mb-1">{title}</h1>
          {contractName && (
            <div className="text-xs text-[#999999] mb-1">{contractName}</div>
          )}
          {displayCreatorName ? (
            <div className="text-xs text-[#cccccc] mb-1 flex items-center justify-between">
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
            <div className="text-xs mb-1 flex items-center justify-end gap-3">
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
          {/* External Links */}
          {(auction.tokenAddress || auction.tokenId) && (
            <div className="mb-4 flex gap-3 text-xs">
              {auction.tokenAddress && (
                <a
                  href={`https://basescan.org/address/${auction.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#999999] hover:text-[#cccccc] hover:underline"
                >
                  Basescan
                </a>
              )}
              {auction.tokenAddress && auction.tokenId && (
                <a
                  href={`https://opensea.io/item/base/${auction.tokenAddress}/${auction.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#999999] hover:text-[#cccccc] hover:underline"
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

        {/* Update Listing Form - Show when update button is clicked */}
        {showUpdateForm && canUpdate && !isCancelled && (
          <div className="mb-4">
            <UpdateListingForm
              currentStartTime={startTime || null}
              currentEndTime={endTime || null}
              onSubmit={handleUpdateListing}
              onCancel={() => setShowUpdateForm(false)}
              isLoading={isModifyLoading}
              listingType={auction.listingType}
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
                    />
                    <p className="text-xs text-[#999999] mt-1">
                      You will receive {purchaseQuantity * parseInt(auction.totalPerSale || "1")} copies ({purchaseQuantity} purchase{purchaseQuantity !== 1 ? 's' : ''} × {auction.totalPerSale} copies per purchase)
                    </p>
                    <p className="text-xs text-[#666666] mt-0.5">
                      {parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")} copies remaining ({Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1"))} purchase{Math.floor((parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0")) / parseInt(auction.totalPerSale || "1")) !== 1 ? 's' : ''} available)
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
                              {auction.initialAmount ? formatPrice((BigInt(auction.initialAmount) * BigInt(purchaseQuantity)).toString()) : '—'} {auction.initialAmount ? paymentSymbol : ''}
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
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {auction.listingType === "FIXED_PRICE" && (() => {
              const timeStatus = getFixedPriceTimeStatus(endTime, now);
              const remaining = Math.max(0, parseInt(auction.totalAvailable) - parseInt(auction.totalSold || "0"));
              const isSoldOut = remaining === 0;
              return (
                <>
                  {/* Compact fixed price info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
                    <span>{formatPrice(auction.initialAmount)} {paymentSymbol}</span>
                    {auction.tokenSpec === "ERC1155" && (
                      <>
                        <span className="text-[#444]">•</span>
                        <span>{remaining}/{parseInt(auction.totalAvailable)} available</span>
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

/**
 * Bid History Row Component
 */
function BidHistoryRow({
  bid,
  isHighest,
  paymentSymbol,
  formatPrice,
}: {
  bid: { id: string; bidder: string; amount: string; timestamp: string };
  isHighest: boolean;
  paymentSymbol: string;
  formatPrice: (amount: string) => string;
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
          {formatPrice(bid.amount)} {paymentSymbol}
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
