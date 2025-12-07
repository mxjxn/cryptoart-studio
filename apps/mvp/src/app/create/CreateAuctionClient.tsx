"use client";

import { useState, useEffect, useMemo } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useRouter } from "next/navigation";
import { type Address, parseEther, decodeEventLog } from "viem";
import { isValidAddressFormat, fetchContractInfoFromAlchemy, CONTRACT_INFO_ABI } from "~/lib/contract-info";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, CHAIN_ID } from "~/lib/contracts/marketplace";
import { useERC20Token, isETH } from "~/hooks/useERC20Token";
import { zeroAddress } from "viem";
import { TransactionStatus } from "~/components/TransactionStatus";
import { ProfileDropdown } from "~/components/ProfileDropdown";
import { useNetworkGuard } from "~/hooks/useNetworkGuard";
import { useEffectiveAddress } from "~/hooks/useEffectiveAddress";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { TransitionLink } from "~/components/TransitionLink";
import { Logo } from "~/components/Logo";
import { transitionNavigate } from "~/lib/view-transitions";
import { base } from "wagmi/chains";

// ERC165 interface IDs
const ERC721_INTERFACE_ID = "0x80ac58cd";
const ERC1155_INTERFACE_ID = "0xd9b67a26";

// ABI for ownership and approval checks
const NFT_ABI = [
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // ERC721 approval check
  {
    type: 'function',
    name: 'getApproved',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // ERC721/ERC1155 approval for all check
  {
    type: 'function',
    name: 'isApprovedForAll',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // ERC721 approve (for single token)
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ERC721/ERC1155 setApprovalForAll
  {
    type: 'function',
    name: 'setApprovalForAll',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

interface ContractPreview {
  name: string | null;
  owner: string | null;
  loading: boolean;
  error: string | null;
}

// Helper to get default end time (1 week from now) in datetime-local format
function getDefaultEndTime(): string {
  const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // Format: YYYY-MM-DDTHH:mm
  return oneWeekFromNow.toISOString().slice(0, 16);
}

export default function CreateAuctionClient() {
  // Use effective address: in miniapp uses Farcaster primary wallet, on web uses wagmi connector
  const { address, isConnected, isMiniApp: isMiniAppContext } = useEffectiveAddress();
  const router = useRouter();
  const { isSDKLoaded } = useMiniApp();
  // Use the effective address context detection instead of separate hook
  const isMiniApp = isMiniAppContext;
  const { isWrongNetwork, switchToBase, isSwitching } = useNetworkGuard();
  const chainId = useChainId();
  const [formData, setFormData] = useState({
    listingType: "INDIVIDUAL_AUCTION" as "INDIVIDUAL_AUCTION" | "FIXED_PRICE" | "OFFERS_ONLY",
    nftContract: "",
    tokenId: "",
    reservePrice: "",
    fixedPrice: "",
    startTime: "",
    endTime: getDefaultEndTime(),
    minIncrementBPS: "500",
    totalAvailable: "1",
    totalPerSale: "1",
    paymentType: "ETH" as "ETH" | "ERC20",
    erc20Address: "",
  });
  const [contractPreview, setContractPreview] = useState<ContractPreview>({
    name: null,
    owner: null,
    loading: false,
    error: null,
  });
  const [alchemyName, setAlchemyName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<number | null>(null);

  const { writeContract, data: hash, isPending, error, reset: resetListing } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Read contract name and owner onchain
  const isValidContract = isValidAddressFormat(formData.nftContract);
  const contractAddress = isValidContract ? (formData.nftContract as Address) : undefined;
  const hasValidTokenId = formData.tokenId !== "" && !isNaN(Number(formData.tokenId));

  // ERC20 token validation
  const erc20Token = useERC20Token(formData.paymentType === "ERC20" ? formData.erc20Address : undefined);
  const isValidERC20 = formData.paymentType === "ETH" || (formData.paymentType === "ERC20" && erc20Token.isValid);
  const priceSymbol = formData.paymentType === "ETH" ? "ETH" : (erc20Token.symbol || "TOKEN");

  // Check if contract supports ERC721
  const { data: isERC721, isLoading: loadingERC721 } = useReadContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'supportsInterface',
    args: [ERC721_INTERFACE_ID as `0x${string}`],
    query: {
      enabled: !!contractAddress,
      retry: 1,
    },
  });

  // Check if contract supports ERC1155
  const { data: isERC1155, isLoading: loadingERC1155 } = useReadContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'supportsInterface',
    args: [ERC1155_INTERFACE_ID as `0x${string}`],
    query: {
      enabled: !!contractAddress,
      retry: 1,
    },
  });

  // ERC721 ownerOf check
  const { data: erc721Owner, isLoading: loadingERC721Owner, error: erc721OwnerError } = useReadContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'ownerOf',
    args: hasValidTokenId ? [BigInt(formData.tokenId)] : undefined,
    query: {
      enabled: !!contractAddress && hasValidTokenId && isERC721 === true,
      retry: 1,
    },
  });

  // ERC1155 balanceOf check
  const { data: erc1155Balance, isLoading: loadingERC1155Balance, error: erc1155BalanceError } = useReadContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'balanceOf',
    args: hasValidTokenId && address ? [address, BigInt(formData.tokenId)] : undefined,
    query: {
      enabled: !!contractAddress && hasValidTokenId && !!address && isERC1155 === true,
      retry: 1,
    },
  });

  // ERC721 getApproved check (checks if marketplace is approved for this specific token)
  const { data: erc721Approved, isLoading: loadingERC721Approved, refetch: refetchERC721Approved } = useReadContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'getApproved',
    args: hasValidTokenId ? [BigInt(formData.tokenId)] : undefined,
    query: {
      enabled: !!contractAddress && hasValidTokenId && isERC721 === true,
      retry: 1,
    },
  });

  // isApprovedForAll check (works for both ERC721 and ERC1155)
  const { data: isApprovedForAll, isLoading: loadingApprovedForAll, refetch: refetchApprovedForAll } = useReadContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'isApprovedForAll',
    args: address ? [address, MARKETPLACE_ADDRESS] : undefined,
    query: {
      enabled: !!contractAddress && !!address && (isERC721 === true || isERC1155 === true),
      retry: 1,
    },
  });

  // Approval transaction
  const { 
    writeContract: writeApproval, 
    data: approvalHash, 
    isPending: isApprovalPending, 
    error: approvalError,
    reset: resetApproval,
  } = useWriteContract();
  
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Refetch approval status after successful approval
  useEffect(() => {
    if (isApprovalSuccess) {
      // Add a small delay to ensure blockchain state has propagated
      const timer = setTimeout(() => {
        refetchERC721Approved();
        refetchApprovedForAll();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isApprovalSuccess, refetchERC721Approved, refetchApprovedForAll]);

  // Reset transaction states when contract or token changes
  useEffect(() => {
    resetApproval();
    resetListing();
  }, [formData.nftContract, formData.tokenId, resetApproval, resetListing]);

  // Automatically switch to Base network when on wrong network (web only)
  useEffect(() => {
    if (isWrongNetwork && !isSwitching && isConnected) {
      // Only auto-switch on web, not in miniapp
      if (!isMiniApp) {
        console.log('[CreateAuction] Auto-switching to Base network');
        switchToBase();
      }
    }
  }, [isWrongNetwork, isSwitching, isConnected, isMiniApp, switchToBase]);

  // Handle getChainId errors from approval transactions
  useEffect(() => {
    if (approvalError) {
      const errorMessage = approvalError.message || String(approvalError);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error('[CreateAuction] Chain ID error in approval, attempting to switch to Base:', approvalError);
        if (!isMiniApp) {
          try {
            switchToBase();
          } catch (switchErr) {
            console.error('[CreateAuction] Error switching chain:', switchErr);
          }
        }
      }
    }
  }, [approvalError, isMiniApp, switchToBase]);

  // Handle getChainId errors from listing transactions
  useEffect(() => {
    if (error) {
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error('[CreateAuction] Chain ID error in listing, attempting to switch to Base:', error);
        if (!isMiniApp) {
          try {
            switchToBase();
          } catch (switchErr) {
            console.error('[CreateAuction] Error switching chain:', switchErr);
          }
        }
      }
    }
  }, [error, isMiniApp, switchToBase]);

  // Determine token type and ownership
  const tokenType = useMemo(() => {
    if (loadingERC721 || loadingERC1155) return 'loading';
    if (isERC721) return 'ERC721';
    if (isERC1155) return 'ERC1155';
    return 'unknown';
  }, [isERC721, isERC1155, loadingERC721, loadingERC1155]);

  const ownershipStatus = useMemo(() => {
    if (!isValidContract || !hasValidTokenId) {
      return { loading: false, isOwner: false, owner: null, error: null };
    }

    if (tokenType === 'loading' || loadingERC721Owner || loadingERC1155Balance) {
      return { loading: true, isOwner: false, owner: null, error: null };
    }

    if (tokenType === 'ERC721') {
      if (erc721OwnerError) {
        return { loading: false, isOwner: false, owner: null, error: 'Token does not exist or error fetching owner' };
      }
      const owner = erc721Owner as Address | undefined;
      const isOwner = owner?.toLowerCase() === address?.toLowerCase();
      return { loading: false, isOwner, owner: owner || null, error: null };
    }

    if (tokenType === 'ERC1155') {
      if (erc1155BalanceError) {
        return { loading: false, isOwner: false, owner: null, error: 'Error checking balance' };
      }
      const balance = erc1155Balance as bigint | undefined;
      const isOwner = balance !== undefined && balance > 0n;
      return { loading: false, isOwner, owner: isOwner ? address : null, error: null };
    }

    return { loading: false, isOwner: false, owner: null, error: 'Unknown token type' };
  }, [
    isValidContract, hasValidTokenId, tokenType, address,
    loadingERC721Owner, loadingERC1155Balance,
    erc721Owner, erc721OwnerError, erc1155Balance, erc1155BalanceError
  ]);

  // Show the rest of the form only if user owns the token
  const canProceed = ownershipStatus.isOwner && !ownershipStatus.loading;

  // Determine approval status
  const approvalStatus = useMemo(() => {
    if (!canProceed) {
      return { loading: false, isApproved: false, needsApproval: false };
    }

    // Optimistic update: if approval just succeeded, show as approved immediately
    if (isApprovalSuccess) {
      return { loading: false, isApproved: true, needsApproval: false };
    }

    if (loadingERC721Approved || loadingApprovedForAll) {
      return { loading: true, isApproved: false, needsApproval: false };
    }

    // Check if approved for all (works for both ERC721 and ERC1155)
    if (isApprovedForAll === true) {
      return { loading: false, isApproved: true, needsApproval: false };
    }

    // For ERC721, also check single token approval
    if (tokenType === 'ERC721') {
      const approvedAddress = erc721Approved as Address | undefined;
      if (approvedAddress?.toLowerCase() === MARKETPLACE_ADDRESS.toLowerCase()) {
        return { loading: false, isApproved: true, needsApproval: false };
      }
    }

    return { loading: false, isApproved: false, needsApproval: true };
  }, [canProceed, loadingERC721Approved, loadingApprovedForAll, isApprovedForAll, tokenType, erc721Approved, isApprovalSuccess]);

  // Handle approval
  const handleApprove = async () => {
    if (!contractAddress || !address || !hasValidTokenId) return;

    // Check if we're on the correct chain (web only - miniapp handles this automatically)
    if (!isMiniApp && chainId !== base.id) {
      console.log('[CreateAuction] Wrong network detected, switching to Base');
      try {
        switchToBase();
        // Wait a bit for the switch to initiate
        await new Promise(resolve => setTimeout(resolve, 500));
        // Don't proceed if still on wrong chain - let the auto-switch effect handle it
        if (chainId !== base.id) {
          return;
        }
      } catch (err) {
        console.error('[CreateAuction] Error switching chain:', err);
        alert('Please switch to Base network to continue');
        return;
      }
    }

    try {
      if (tokenType === 'ERC721') {
        // For ERC721: Use single-token approval (safer, no high-risk warning)
        writeApproval({
          address: contractAddress,
          abi: NFT_ABI,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, BigInt(formData.tokenId)],
          chainId: CHAIN_ID,
          account: address,
        });
      } else {
        // For ERC1155: Must use setApprovalForAll (no single-token approval in standard)
        writeApproval({
          address: contractAddress,
          abi: NFT_ABI,
          functionName: 'setApprovalForAll',
          args: [MARKETPLACE_ADDRESS, true],
          chainId: CHAIN_ID,
          account: address,
        });
      }
    } catch (err: any) {
      // Handle getChainId errors gracefully
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error('[CreateAuction] Chain ID error detected, attempting to switch to Base:', err);
        if (!isMiniApp) {
          try {
            switchToBase();
            alert('Please switch to Base network and try again');
          } catch (switchErr) {
            console.error('[CreateAuction] Error switching chain:', switchErr);
            alert('Please switch to Base network manually and try again');
          }
        } else {
          alert('Network error. Please ensure you are on Base network.');
        }
      } else {
        // Re-throw other errors
        throw err;
      }
    }
  };

  const { data: contractName, isLoading: loadingName, error: nameError } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_INFO_ABI,
    functionName: 'name',
    query: {
      enabled: !!contractAddress,
      retry: 1,
    },
  });

  const { data: contractOwner, isLoading: loadingOwner, error: ownerError } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_INFO_ABI,
    functionName: 'owner',
    query: {
      enabled: !!contractAddress,
      retry: 1,
    },
  });

  // Fetch contract info from Alchemy when address changes
  useEffect(() => {
    if (!isValidContract) {
      console.log('[CreateAuction] Invalid contract address, clearing preview');
      setContractPreview({
        name: null,
        owner: null,
        loading: false,
        error: null,
      });
      setAlchemyName(null);
      return;
    }

    let cancelled = false;

    const fetchContractInfo = async () => {
      console.log(`[CreateAuction] Fetching Alchemy info for: ${formData.nftContract}`);
      setContractPreview((prev) => ({ ...prev, loading: true, error: null }));

      // Try Alchemy first
      const alchemyInfo = await fetchContractInfoFromAlchemy(formData.nftContract);
      
      if (cancelled) {
        console.log('[CreateAuction] Alchemy fetch cancelled');
        return;
      }

      if (alchemyInfo?.name) {
        console.log(`[CreateAuction] Alchemy returned name: ${alchemyInfo.name}`);
        setAlchemyName(alchemyInfo.name);
        setContractPreview((prev) => ({
          name: alchemyInfo.name, // Use Alchemy name (preferred)
          owner: prev.owner, // Keep existing owner or will be filled by onchain
          loading: loadingName || loadingOwner,
          error: null,
        }));
      } else {
        console.log('[CreateAuction] Alchemy did not return name');
        setAlchemyName(null);
        // Alchemy didn't return info, will rely on onchain
        setContractPreview((prev) => ({
          name: prev.name, // Keep existing name if any (from previous onchain call)
          owner: prev.owner, // Keep existing owner if any
          loading: loadingName || loadingOwner,
          error: null,
        }));
      }
    };

    fetchContractInfo();

    return () => {
      cancelled = true;
    };
  }, [formData.nftContract, isValidContract]);

  // Update preview when onchain data is available
  useEffect(() => {
    if (!isValidContract) return;

    console.log('[CreateAuction] Onchain data update:', {
      contractName: typeof contractName === 'string' ? contractName : contractName,
      contractOwner: contractOwner ? String(contractOwner) : null,
      loadingName,
      loadingOwner,
      nameError: nameError?.message,
      ownerError: ownerError?.message,
      alchemyName,
    });

    setContractPreview((prev) => {
      // Prefer Alchemy name if available, otherwise use onchain name
      // Only update name if:
      // 1. We have a new onchain name AND no Alchemy name, OR
      // 2. We're clearing the name (contractName is explicitly null/undefined and we had a name before)
      let newName = prev.name;
      
      if (alchemyName) {
        // Alchemy name takes priority
        newName = alchemyName;
        console.log(`[CreateAuction] Using Alchemy name: ${newName}`);
      } else if (typeof contractName === 'string') {
        // Use onchain name if no Alchemy name
        newName = contractName;
        console.log(`[CreateAuction] Using onchain name: ${newName}`);
      } else if (contractName === null && !loadingName) {
        // Onchain explicitly returned null (not just loading), clear name if no Alchemy name
        if (!alchemyName) {
          newName = null;
          console.log('[CreateAuction] Onchain name is null, clearing name');
        }
      }

      // Always update owner from onchain (Alchemy doesn't provide it)
      const newOwner = contractOwner ? String(contractOwner) : prev.owner;
      if (contractOwner && String(contractOwner) !== prev.owner) {
        console.log(`[CreateAuction] Updating owner: ${prev.owner} -> ${newOwner}`);
      }

      return {
        name: newName,
        owner: newOwner,
        loading: loadingName || loadingOwner,
        error: nameError || ownerError ? (nameError?.message || ownerError?.message || 'Error fetching contract data') : null,
      };
    });
  }, [contractName, contractOwner, loadingName, loadingOwner, isValidContract, alchemyName, nameError, ownerError]);

  // Reset form to create another listing
  const handleReset = () => {
    setFormData({
      listingType: "INDIVIDUAL_AUCTION",
      nftContract: "",
      tokenId: "",
      reservePrice: "",
      fixedPrice: "",
      startTime: "",
      endTime: getDefaultEndTime(),
      minIncrementBPS: "500",
      totalAvailable: "1",
      totalPerSale: "1",
      paymentType: "ETH",
      erc20Address: "",
    });
    setContractPreview({
      name: null,
      owner: null,
      loading: false,
      error: null,
    });
    setAlchemyName(null);
    setIsSubmitting(false);
    setCreatedListingId(null);
    resetListing();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      alert("Please connect your wallet");
      return;
    }

    if (!isValidContract) {
      alert("Please enter a valid NFT contract address");
      return;
    }

    setIsSubmitting(true);

    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Convert datetime-local to Unix timestamp (seconds)
      const startTime = formData.startTime 
        ? Math.floor(new Date(formData.startTime).getTime() / 1000)
        : formData.listingType === "OFFERS_ONLY" 
          ? now + 60 // OFFERS_ONLY requires startTime in future, default to 1 minute from now
          : 0; // 0 means start immediately on first bid/purchase
      
      // Handle endTime based on listing type
      let endTime: number;
      if (formData.listingType === "FIXED_PRICE" && !formData.endTime) {
        // For FIXED_PRICE with no end time, set to max uint48 (never expires)
        endTime = 281474976710655; // type(uint48).max
      } else if (formData.endTime) {
        endTime = Math.floor(new Date(formData.endTime).getTime() / 1000);
      } else {
        endTime = 0;
      }

      // Validate endTime based on listing type and startTime
      if (formData.listingType === "FIXED_PRICE") {
        // FIXED_PRICE: endTime can be max uint48 (never expires) or a future timestamp
        if (endTime !== 281474976710655 && endTime <= now) {
          alert("End time must be in the future");
          setIsSubmitting(false);
          return;
        }
      } else {
        // For other listing types
        if (startTime === 0) {
          // If startTime is 0, endTime represents duration from first bid/purchase
          if (!endTime || endTime <= 0) {
            alert("Duration must be a positive value");
            setIsSubmitting(false);
            return;
          }
        } else {
          // If startTime is set, endTime must be an absolute timestamp in the future
          if (!endTime || endTime <= now) {
            alert("End time must be in the future");
            setIsSubmitting(false);
            return;
          }
          if (endTime <= startTime) {
            alert("End time must be after start time");
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Validate listing type specific requirements
      if (formData.listingType === "OFFERS_ONLY" && startTime <= now) {
        alert("Start time must be in the future for offers-only listings");
        setIsSubmitting(false);
        return;
      }

      // Determine listing type enum value
      // 1 = INDIVIDUAL_AUCTION, 2 = FIXED_PRICE, 4 = OFFERS_ONLY
      let listingType: number;
      let initialAmount: bigint;
      let totalAvailable: number;
      let totalPerSale: number;
      let extensionInterval: number;
      let minIncrementBPS: number;

      if (formData.listingType === "INDIVIDUAL_AUCTION") {
        listingType = 1;
        initialAmount = parseEther(formData.reservePrice);
        totalAvailable = 1;
        totalPerSale = 1;
        extensionInterval = 0;
        minIncrementBPS = parseInt(formData.minIncrementBPS);
      } else if (formData.listingType === "FIXED_PRICE") {
        listingType = 2;
        initialAmount = parseEther(formData.fixedPrice);
        totalAvailable = parseInt(formData.totalAvailable);
        totalPerSale = parseInt(formData.totalPerSale);
        extensionInterval = 0; // Must be 0 for FIXED_PRICE
        minIncrementBPS = 0; // Must be 0 for FIXED_PRICE
        
        if (totalAvailable < 1 || totalPerSale < 1) {
          alert("Total available and total per sale must be at least 1");
          setIsSubmitting(false);
          return;
        }
        if (totalPerSale > totalAvailable) {
          alert("Total per sale cannot exceed total available");
          setIsSubmitting(false);
          return;
        }
        // For ERC721, totalAvailable and totalPerSale must be 1
        if (tokenType === 'ERC721' && (totalAvailable !== 1 || totalPerSale !== 1)) {
          alert("ERC721 tokens can only be sold one at a time");
          setIsSubmitting(false);
          return;
        }
      } else { // OFFERS_ONLY
        listingType = 4;
        initialAmount = BigInt(0); // Must be 0 for OFFERS_ONLY
        totalAvailable = 1;
        totalPerSale = 1;
        extensionInterval = 0; // Must be 0 for OFFERS_ONLY
        minIncrementBPS = 0; // Must be 0 for OFFERS_ONLY
      }

      // Determine ERC20 address (zero address for ETH)
      const erc20Address = formData.paymentType === "ERC20" && formData.erc20Address
        ? formData.erc20Address as Address
        : zeroAddress;

      // Prepare listing details
      const listingDetails = {
        initialAmount,
        type_: listingType,
        totalAvailable,
        totalPerSale,
        extensionInterval,
        minIncrementBPS,
        erc20: erc20Address,
        identityVerifier: "0x0000000000000000000000000000000000000000" as Address,
        startTime,
        endTime,
      };

      const tokenDetails = {
        id: BigInt(formData.tokenId),
        address_: formData.nftContract as Address,
        spec: tokenType === 'ERC1155' ? 2 : 1, // 1 = ERC721, 2 = ERC1155
        lazy: false,
      };

      const deliveryFees = {
        deliverBPS: 0,
        deliverFixed: BigInt(0),
      };

      const listingReceivers: Array<{ receiver: Address; receiverBPS: number }> = [];

      // Check if we're on the correct chain (web only - miniapp handles this automatically)
      if (!isMiniApp && chainId !== base.id) {
        console.log('[CreateAuction] Wrong network detected, switching to Base');
        try {
          switchToBase();
          // Wait a bit for the switch to initiate
          await new Promise(resolve => setTimeout(resolve, 500));
          // Don't proceed if still on wrong chain - let the auto-switch effect handle it
          if (chainId !== base.id) {
            setIsSubmitting(false);
            alert('Please switch to Base network to continue');
            return;
          }
        } catch (err) {
          console.error('[CreateAuction] Error switching chain:', err);
          setIsSubmitting(false);
          alert('Please switch to Base network to continue');
          return;
        }
      }

      try {
        writeContract({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "createListing",
          chainId: CHAIN_ID,
          account: address,
          args: [
            listingDetails,
            tokenDetails,
            deliveryFees,
            listingReceivers,
            false, // enableReferrer
            false, // acceptOffers (not using offers on auctions)
            "0x", // data (empty bytes)
          ],
        });
      } catch (txErr: any) {
        // Handle getChainId errors gracefully
        const errorMessage = txErr?.message || String(txErr);
        if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
          console.error('[CreateAuction] Chain ID error detected, attempting to switch to Base:', txErr);
          if (!isMiniApp) {
            try {
              switchToBase();
              alert('Please switch to Base network and try again');
            } catch (switchErr) {
              console.error('[CreateAuction] Error switching chain:', switchErr);
              alert('Please switch to Base network manually and try again');
            }
          } else {
            alert('Network error. Please ensure you are on Base network.');
          }
          setIsSubmitting(false);
          return;
        }
        // Re-throw other errors to be caught by outer catch
        throw txErr;
      }
    } catch (err) {
      console.error("Error creating listing:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Don't show generic error if it's a chain-related error we already handled
      if (!errorMessage.includes('getChainId') && !errorMessage.includes('connector')) {
        alert("Failed to create listing. Please try again.");
      }
      setIsSubmitting(false);
    }
  };

  // Extract listing ID from transaction receipt and create notification
  useEffect(() => {
    if (receipt && isSuccess && address) {
      try {
        // Find the CreateListing event in the logs
        const createListingEvent = receipt.logs.find((log) => {
          try {
            const decoded = decodeEventLog({
              abi: MARKETPLACE_ABI,
              data: log.data,
              topics: log.topics,
            });
            return decoded.eventName === 'CreateListing';
          } catch {
            return false;
          }
        });

        if (createListingEvent) {
          const decoded = decodeEventLog({
            abi: MARKETPLACE_ABI,
            data: createListingEvent.data,
            topics: createListingEvent.topics,
          });
          if (decoded.eventName === 'CreateListing') {
            const listingId = Number(decoded.args.listingId);
            setCreatedListingId(listingId);
            
            // Invalidate cache so homepage shows new listing immediately
            // Also revalidate the listing page so it's immediately available
            fetch('/api/auctions/invalidate-cache', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ listingId: String(listingId) }),
            }).catch(err => 
              console.error('Error invalidating cache:', err)
            );
            
            // Automatically navigate to the listing page
            // The page will show a loading state while waiting for subgraph to index
            setTimeout(() => {
              transitionNavigate(router, `/listing/${listingId}`);
            }, 500); // Small delay to ensure state is updated
            
            // Create real-time notification
            const listingType = formData.listingType === 'INDIVIDUAL_AUCTION' ? 'auction' 
              : formData.listingType === 'FIXED_PRICE' ? 'fixed price listing'
              : 'offers-only listing';
            
            const artworkName = contractPreview.name || `Token #${formData.tokenId}` || 'your artwork';
            
            // Create real-time notification immediately
            fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userAddress: address,
                type: 'LISTING_CREATED',
                title: 'Listing Created',
                message: `You created a ${listingType} ${artworkName}`,
                listingId: String(listingId),
                metadata: {
                  listingType: formData.listingType,
                  artworkName,
                  tokenAddress: formData.nftContract,
                  tokenId: formData.tokenId,
                },
              }),
            }).catch(err => {
              console.error('Error creating listing notification:', err);
              // Don't block UI - notification will be created by cron job
            });
          }
        }
      } catch (err) {
        console.error('Error extracting listing ID from receipt:', err);
      }
    }
  }, [receipt, isSuccess, address, formData.listingType, formData.tokenId, formData.nftContract, contractPreview.name, router]);

  // Reset submitting state when transaction completes
  useEffect(() => {
    if (isSuccess || error) {
      setIsSubmitting(false);
    }
  }, [isSuccess, error]);

  // Set up back navigation for Farcaster mini-app
  useEffect(() => {
    if (!isSDKLoaded) return;

    const setupBackNavigation = async () => {
      try {
        // Check if back navigation is supported
        const capabilities = await sdk.getCapabilities();
        if (capabilities.includes('back')) {
          // Enable web navigation integration (automatically handles browser history)
          await sdk.back.enableWebNavigation();
          
          // Also set up a custom handler for back navigation
          sdk.back.onback = () => {
            // Navigate back to home page
            transitionNavigate(router, '/');
          };

          // Show the back button
          await sdk.back.show();
        }
      } catch (error) {
        console.error('Failed to set up back navigation:', error);
      }
    };

    setupBackNavigation();

    // Listen for back navigation events
    const handleBackNavigation = () => {
      transitionNavigate(router, '/');
    };

    sdk.on('backNavigationTriggered', handleBackNavigation);

    return () => {
      sdk.off('backNavigationTriggered', handleBackNavigation);
      // Clear the back handler
      sdk.back.onback = null;
    };
  }, [isSDKLoaded, router]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - only show when not in miniapp */}
      {!isMiniApp && (
        <header className="flex justify-between items-center px-4 py-4 border-b border-[#333333]">
          <Logo />
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>
      )}

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <TransitionLink
            href="/"
            className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2 mb-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </TransitionLink>
          <h1 className="text-3xl font-light mb-2">Create Listing</h1>
          <p className="text-sm text-[#cccccc]">
            List your NFT for sale. Choose between auction, fixed price, or offers-only.
          </p>
        </div>

        {!isConnected && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-4 mb-6">
            <p className="text-[#cccccc]">Please connect your wallet to create an auction.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-6">
          {/* Listing Type Selector */}
          <div>
            <label className="block text-sm font-medium text-[#cccccc] mb-3">
              Listing Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, listingType: "INDIVIDUAL_AUCTION" })}
                className={`px-4 py-2 text-sm rounded border transition-colors ${
                  formData.listingType === "INDIVIDUAL_AUCTION"
                    ? "bg-white text-black border-white"
                    : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
                }`}
              >
                Auction
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, listingType: "FIXED_PRICE" })}
                className={`px-4 py-2 text-sm rounded border transition-colors ${
                  formData.listingType === "FIXED_PRICE"
                    ? "bg-white text-black border-white"
                    : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
                }`}
              >
                Fixed Price
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, listingType: "OFFERS_ONLY" })}
                className={`px-4 py-2 text-sm rounded border transition-colors ${
                  formData.listingType === "OFFERS_ONLY"
                    ? "bg-white text-black border-white"
                    : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
                }`}
              >
                Offers Only
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#cccccc] mb-2">
              NFT Contract Address
            </label>
            <input
              type="text"
              value={formData.nftContract}
              onChange={(e) => setFormData({ ...formData, nftContract: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black ${
                formData.nftContract && !isValidAddressFormat(formData.nftContract)
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#333333]'
              }`}
              placeholder="0x..."
              required
            />
            {formData.nftContract && !isValidAddressFormat(formData.nftContract) && (
              <p className="mt-1 text-sm text-red-400">
                Please enter a valid Ethereum address (42 characters, starting with 0x)
              </p>
            )}
          </div>

          {/* Contract Preview Pane */}
          {isValidContract && (
            <div className="bg-black border border-[#333333] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Contract Preview</h3>
                {/* Token Type Badge */}
                {tokenType === 'loading' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#0a0a0a] text-[#999999] border border-[#333333]">
                    <span className="h-3 w-3 border-2 border-[#666666] border-t-transparent rounded-full animate-spin mr-1"></span>
                    Detecting...
                  </span>
                ) : tokenType === 'ERC721' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-900/30 text-purple-300 border border-purple-700/50">
                    ERC-721
                  </span>
                ) : tokenType === 'ERC1155' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-900/30 text-orange-300 border border-orange-700/50">
                    ERC-1155
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-900/30 text-red-300 border border-red-700/50">
                    Unknown Type
                  </span>
                )}
              </div>
              {contractPreview.loading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-[#0a0a0a] rounded animate-pulse"></div>
                  <div className="h-4 bg-[#0a0a0a] rounded animate-pulse w-3/4"></div>
                </div>
              ) : contractPreview.error ? (
                <p className="text-sm text-red-400">{contractPreview.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-[#999999]">Name:</span>{' '}
                    <span className="text-white">
                      {contractPreview.name || 'Not available'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-[#999999]">Owner:</span>{' '}
                    <span className="text-white font-mono text-xs">
                      {contractPreview.owner || 'Not available'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#cccccc] mb-2">
              Token ID
            </label>
            <input
              type="text"
              value={formData.tokenId}
              onChange={(e) => setFormData({ ...formData, tokenId: e.target.value })}
              className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black"
              placeholder="1"
              required
            />
          </div>

          {/* Ownership Status */}
          {isValidContract && hasValidTokenId && (
            <div className={`rounded-lg p-4 border ${
              ownershipStatus.loading 
                ? 'bg-[#0a0a0a] border-[#333333]' 
                : ownershipStatus.isOwner 
                  ? 'bg-green-900/20 border-green-700/50'
                  : 'bg-red-900/20 border-red-700/50'
            }`}>
              {ownershipStatus.loading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 border-2 border-[#666666] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[#cccccc] text-sm">Checking ownership...</span>
                </div>
              ) : ownershipStatus.error ? (
                <p className="text-red-400 text-sm">{ownershipStatus.error}</p>
              ) : ownershipStatus.isOwner ? (
                <div className="space-y-1">
                  <p className="text-green-400 text-sm font-medium">
                    {tokenType === 'ERC1155' && erc1155Balance !== undefined
                      ? `✓ You own ${erc1155Balance.toString()} of this token`
                      : '✓ You own this token'}
                  </p>
                  <p className="text-green-300 text-xs">Token Type: {tokenType}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-red-400 text-sm font-medium">✗ You do not own this token</p>
                  {ownershipStatus.owner && tokenType === 'ERC721' && (
                    <p className="text-red-300 text-xs font-mono">
                      Owned by: {ownershipStatus.owner}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Approval Status */}
          {canProceed && (
            <div className={`rounded-lg p-4 border ${
              approvalStatus.loading 
                ? 'bg-[#0a0a0a] border-[#333333]' 
                : approvalStatus.isApproved 
                  ? 'bg-green-900/20 border-green-700/50'
                  : 'bg-amber-900/20 border-amber-700/50'
            }`}>
              {approvalStatus.loading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 border-2 border-[#666666] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[#cccccc] text-sm">Checking marketplace approval...</span>
                </div>
              ) : approvalStatus.isApproved ? (
                <div className="space-y-1">
                  <p className="text-green-400 text-sm font-medium">✓ Marketplace approved to transfer this token</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-amber-400 text-sm font-medium">⚠ Approval required</p>
                    <p className="text-amber-300 text-xs">
                      {tokenType === 'ERC721' 
                        ? `Approve the marketplace to transfer token #${formData.tokenId} when the auction ends.`
                        : 'The marketplace needs permission to transfer your tokens. This approves all tokens in this collection.'}
                    </p>
                  </div>
                  
                  {/* Approval Transaction Status */}
                  <TransactionStatus
                    hash={approvalHash}
                    isPending={isApprovalPending}
                    isConfirming={isApprovalConfirming}
                    isSuccess={isApprovalSuccess}
                    error={approvalError}
                    successMessage="Approval granted!"
                    onDismiss={resetApproval}
                  />

                  {!isApprovalPending && !isApprovalConfirming && !isApprovalSuccess && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                    >
                      {tokenType === 'ERC721' 
                        ? `Approve Token #${formData.tokenId}`
                        : 'Approve All Tokens'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rest of form - only show if user owns the token */}
          <div className={!canProceed ? 'opacity-50 pointer-events-none' : ''}>
            <div className="space-y-6">
              {/* Payment Currency Selection */}
              <div>
                <label className="block text-sm font-medium text-[#cccccc] mb-3">
                  Payment Currency
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentType: "ETH", erc20Address: "" })}
                    className={`px-4 py-2 text-sm rounded border transition-colors ${
                      formData.paymentType === "ETH"
                        ? "bg-white text-black border-white"
                        : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
                    }`}
                    disabled={!canProceed}
                  >
                    ETH
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentType: "ERC20" })}
                    className={`px-4 py-2 text-sm rounded border transition-colors ${
                      formData.paymentType === "ERC20"
                        ? "bg-white text-black border-white"
                        : "bg-transparent border-[#333333] text-white hover:border-[#666666]"
                    }`}
                    disabled={!canProceed}
                  >
                    ERC20 Token
                  </button>
                </div>

                {/* ERC20 Token Address Input */}
                {formData.paymentType === "ERC20" && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.erc20Address}
                      onChange={(e) => setFormData({ ...formData, erc20Address: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black ${
                        formData.erc20Address && erc20Token.error
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : formData.erc20Address && erc20Token.isValid
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                          : 'border-[#333333]'
                      }`}
                      placeholder="0x... (ERC20 Token Address)"
                      disabled={!canProceed}
                    />
                    
                    {/* ERC20 Token Preview */}
                    {formData.erc20Address && (
                      <div className={`rounded-lg p-3 border ${
                        erc20Token.isLoading 
                          ? 'bg-[#0a0a0a] border-[#333333]' 
                          : erc20Token.isValid 
                            ? 'bg-green-900/20 border-green-700/50'
                            : 'bg-red-900/20 border-red-700/50'
                      }`}>
                        {erc20Token.isLoading ? (
                          <div className="flex items-center space-x-2">
                            <div className="h-4 w-4 border-2 border-[#666666] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[#cccccc] text-sm">Validating token...</span>
                          </div>
                        ) : erc20Token.isValid ? (
                          <div className="space-y-1">
                            <p className="text-green-400 text-sm font-medium">
                              ✓ {erc20Token.name} ({erc20Token.symbol})
                            </p>
                            <p className="text-green-300 text-xs">
                              Decimals: {erc20Token.decimals}
                            </p>
                          </div>
                        ) : erc20Token.error ? (
                          <p className="text-red-400 text-sm">{erc20Token.error}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Price fields - conditional based on listing type */}
              {formData.listingType === "INDIVIDUAL_AUCTION" && (
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-2">
                    Reserve Price ({priceSymbol})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.reservePrice}
                    onChange={(e) => setFormData({ ...formData, reservePrice: e.target.value })}
                    className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black disabled:bg-[#0a0a0a] disabled:opacity-50"
                    placeholder="0.1"
                    required
                    disabled={!canProceed}
                  />
                </div>
              )}

              {formData.listingType === "FIXED_PRICE" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#cccccc] mb-2">
                      Price Per Copy ({priceSymbol})
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.fixedPrice}
                      onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
                      className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black disabled:bg-[#0a0a0a] disabled:opacity-50"
                      placeholder="0.1"
                      required
                      disabled={!canProceed}
                    />
                    {tokenType === 'ERC1155' && formData.totalAvailable && formData.totalPerSale && formData.fixedPrice && (
                      <p className="mt-1 text-xs text-[#999999]">
                        Each purchase of {formData.totalPerSale} copy{parseInt(formData.totalPerSale) !== 1 ? 'ies' : ''} will cost {parseFloat(formData.fixedPrice || '0') * parseInt(formData.totalPerSale || '1')} {priceSymbol}
                      </p>
                    )}
                  </div>
                  
                  {tokenType === 'ERC1155' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[#cccccc] mb-2">
                          Total Available
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.totalAvailable}
                          onChange={(e) => setFormData({ ...formData, totalAvailable: e.target.value })}
                          className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black disabled:bg-[#0a0a0a] disabled:opacity-50"
                          placeholder="100"
                          required
                          disabled={!canProceed}
                        />
                        <p className="mt-1 text-xs text-[#999999]">
                          Total number of tokens to list for sale
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[#cccccc] mb-2">
                          Per Purchase
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.totalPerSale}
                          onChange={(e) => setFormData({ ...formData, totalPerSale: e.target.value })}
                          className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black disabled:bg-[#0a0a0a] disabled:opacity-50"
                          placeholder="1"
                          required
                          disabled={!canProceed}
                        />
                        <p className="mt-1 text-xs text-[#999999]">
                          Number of copies included in each purchase (e.g., if set to 10, buying "1" purchase gives you 10 copies)
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Start Time - conditional label based on listing type */}
              <div>
                <label className="block text-sm font-medium text-[#cccccc] mb-2">
                  {formData.listingType === "OFFERS_ONLY" 
                    ? "Start Time (required)"
                    : formData.listingType === "INDIVIDUAL_AUCTION"
                    ? "Start Time (optional, leave empty to start on first bid)"
                    : "Start Time (optional, leave empty to start on first purchase)"}
                </label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black disabled:bg-[#0a0a0a] disabled:opacity-50"
                  required={formData.listingType === "OFFERS_ONLY"}
                  disabled={!canProceed}
                />
              </div>

              {/* End Time */}
              <div>
                <label className="block text-sm font-medium text-[#cccccc] mb-2">
                  {formData.listingType === "FIXED_PRICE"
                    ? "End Time (optional)"
                    : formData.startTime === ""
                    ? "Duration (from first bid/purchase)"
                    : "End Time"}
                </label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black disabled:bg-[#0a0a0a] disabled:opacity-50"
                  required={formData.listingType !== "FIXED_PRICE"}
                  disabled={!canProceed}
                />
                {formData.listingType === "FIXED_PRICE" && (
                  <p className="mt-1 text-xs text-[#999999]">
                    Leave empty to create a listing that never expires
                  </p>
                )}
                {formData.listingType !== "FIXED_PRICE" && formData.startTime === "" && (
                  <p className="mt-1 text-xs text-[#999999]">
                    When start time is empty, this represents the duration from the first bid/purchase, not an absolute timestamp
                  </p>
                )}
              </div>

              {/* Min Increment - only for auctions */}
              {formData.listingType === "INDIVIDUAL_AUCTION" && (
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-2">
                    Min Increment (basis points, e.g., 500 = 5%)
                  </label>
                  <input
                    type="number"
                    value={formData.minIncrementBPS}
                    onChange={(e) => setFormData({ ...formData, minIncrementBPS: e.target.value })}
                    className="w-full px-4 py-2 border border-[#333333] rounded-lg focus:ring-2 focus:ring-white focus:border-white text-white bg-black disabled:bg-[#0a0a0a] disabled:opacity-50"
                    placeholder="500"
                    required
                    disabled={!canProceed}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Transaction Status */}
          <TransactionStatus
            hash={hash}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={error}
            successMessage="Listing created successfully!"
          />

          {/* Action Buttons */}
          {isSuccess ? (
            <div className="flex gap-3">
              {createdListingId !== null ? (
                <button
                  type="button"
                  onClick={() => transitionNavigate(router, `/listing/${createdListingId}`)}
                  className="flex-1 px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                >
                  View Listing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => transitionNavigate(router, "/")}
                  className="flex-1 px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] transition-colors"
                >
                  View Listings
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-[#0a0a0a] border border-[#333333] text-white text-sm font-medium tracking-[0.5px] hover:bg-[#1a1a1a] transition-colors"
              >
                Create Another
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!isConnected || !canProceed || !approvalStatus.isApproved || !isValidERC20 || isPending || isConfirming || isSubmitting}
              className="w-full px-6 py-3 bg-white text-black text-sm font-medium tracking-[0.5px] hover:bg-[#e0e0e0] disabled:bg-[#333333] disabled:text-[#666666] disabled:cursor-not-allowed transition-colors"
            >
              {isPending
                ? "Waiting for signature..."
                : isConfirming
                  ? "Confirming transaction..."
                    : !approvalStatus.isApproved
                    ? "Approve marketplace first"
                    : !isValidERC20
                    ? "Select valid payment token"
                    : formData.listingType === "INDIVIDUAL_AUCTION"
                    ? "Create Auction"
                    : formData.listingType === "FIXED_PRICE"
                    ? "Create Listing"
                    : "Create Offers Listing"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

