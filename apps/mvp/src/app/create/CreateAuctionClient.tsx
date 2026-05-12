"use client";

import { useState, useEffect, useMemo } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useRouter } from "next/navigation";
import { type Address, parseEther, decodeEventLog } from "viem";
import { isValidAddressFormat, fetchContractInfoFromAlchemy, CONTRACT_INFO_ABI } from "~/lib/contract-info";
import { MediaDisplay } from "~/components/media";
import {
  MARKETPLACE_ADDRESS,
  ETHEREUM_MAINNET_MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  CHAIN_ID,
} from "~/lib/contracts/marketplace";
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
import { ContractSelector } from "~/components/create-listing/ContractSelector";
import { ListingTargetChainStep } from "~/components/create-listing/ListingTargetChainStep";
import { ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { canonicalListingDetailPath } from "~/lib/listing-chain-paths";
import { getChainNetworkInfo } from "~/lib/chain-display";
import { TokenSelector } from "~/components/create-listing/TokenSelector";
import { ERC1155ConfigPage } from "~/components/create-listing/ERC1155ConfigPage";
import { ERC721ListingTypePage } from "~/components/create-listing/ERC721ListingTypePage";
import { ERC721AuctionConfigPage } from "~/components/create-listing/ERC721AuctionConfigPage";
import { ERC721FixedPriceConfigPage } from "~/components/create-listing/ERC721FixedPriceConfigPage";
import { ERC721OffersOnlyPage } from "~/components/create-listing/ERC721OffersOnlyPage";
import { ShareableMomentButton } from "~/components/ShareableMomentButton";
import { useMembershipStatus } from "~/hooks/useMembershipStatus";
import { viewerMatchesKismetCasaScheduleShortcut } from "~/lib/kismet-casa-schedule";
import { isPlainDurationSecondsString } from "~/lib/create-listing-endtime";

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

/**
 * CreateAuctionClient - Allows anyone (free or member) to create auctions
 * No subscription or membership required - only wallet connection is needed
 */
export default function CreateAuctionClient() {
  // Use effective address: in miniapp uses Farcaster primary wallet, on web uses wagmi connector
  const { address, isConnected, isMiniApp: isMiniAppContext } = useEffectiveAddress();
  const { context } = useMiniApp();
  
  // Get all verified addresses when in mini-app
  const allVerifiedAddresses = useMemo(() => {
    const addresses: string[] = [];
    
    if (isMiniAppContext && context?.user) {
      const user = context.user as any;
      const verifiedAddrs = user.verified_addresses;
      
      // Get all verified eth addresses
      if (verifiedAddrs?.eth_addresses) {
        addresses.push(...verifiedAddrs.eth_addresses.map((addr: string) => addr.toLowerCase()));
      }
      
      // Add primary address if not already included
      if (verifiedAddrs?.primary?.eth_address) {
        const primaryAddr = verifiedAddrs.primary.eth_address.toLowerCase();
        if (!addresses.includes(primaryAddr)) {
          addresses.push(primaryAddr);
        }
      }
      
      // Add legacy verifications array
      if (user.verifications) {
        user.verifications.forEach((addr: string) => {
          const lowerAddr = addr.toLowerCase();
          if (!addresses.includes(lowerAddr)) {
            addresses.push(lowerAddr);
          }
        });
      }
      
      // Add custody address if not already included
      if (user.custody_address) {
        const custodyAddr = user.custody_address.toLowerCase();
        if (!addresses.includes(custodyAddr)) {
          addresses.push(custodyAddr);
        }
      }
    } else if (address) {
      // On web, just use the connected address
      addresses.push(address.toLowerCase());
    }
    
    return addresses;
  }, [isMiniAppContext, context?.user, address]);

  const showKismetCasaScheduleShortcut = useMemo(
    () => viewerMatchesKismetCasaScheduleShortcut(allVerifiedAddresses),
    [allVerifiedAddresses],
  );

  const router = useRouter();
  const { isSDKLoaded } = useMiniApp();
  // Use the effective address context detection instead of separate hook
  const isMiniApp = isMiniAppContext;
  const { isPro, loading: membershipLoading } = useMembershipStatus();
  const isMember = isPro;
  /** Set on step 1; all NFT reads and marketplace txs use this chain explicitly. */
  const [listingTargetChainId, setListingTargetChainId] = useState<number | null>(null);

  const createListingNftChainId = listingTargetChainId ?? CHAIN_ID;
  const marketplaceAddressForListing = useMemo((): Address => {
    return createListingNftChainId === ETHEREUM_MAINNET_CHAIN_ID
      ? ETHEREUM_MAINNET_MARKETPLACE_ADDRESS
      : MARKETPLACE_ADDRESS;
  }, [createListingNftChainId]);

  const { isWrongNetwork, switchToRequiredChain, isSwitching } = useNetworkGuard({
    requiredChainId: listingTargetChainId ?? undefined,
  });
  const connectedChainId = useChainId();
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
  
  // Wizard state
  const [wizardPage, setWizardPage] = useState<number>(1);
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [selectedTokenType, setSelectedTokenType] = useState<"ERC721" | "ERC1155" | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedListingType, setSelectedListingType] = useState<"AUCTION" | "FIXED_PRICE" | "OFFERS_ONLY" | null>(null);
  const [wizardERC1155Balance, setWizardERC1155Balance] = useState<number>(0);
  
  // Deployed contracts state
  const [deployedContracts, setDeployedContracts] = useState<Array<{ address: string; name: string | null; tokenType: string }>>([]);
  const [deployedContractsLoading, setDeployedContractsLoading] = useState(false);
  const [deployedContractsFetched, setDeployedContractsFetched] = useState(false);
  
  // NFTs owned from selected contract state
  const [ownedNFTs, setOwnedNFTs] = useState<Array<{ 
    tokenId: string; 
    name: string | null; 
    image: string | null;
    animationUrl?: string | null;
    animationFormat?: string | null;
  }>>([]);
  const [ownedNFTsLoading, setOwnedNFTsLoading] = useState(false);
  
  // Selected NFT metadata for media display
  const selectedNFT = useMemo(() => {
    if (!formData.tokenId) return null;
    // First try to find in ownedNFTs (from dropdown selection)
    const ownedNFT = ownedNFTs.find(nft => nft.tokenId === formData.tokenId);
    if (ownedNFT) return ownedNFT;
    // If not found in ownedNFTs but we have a valid contract and token ID,
    // we could fetch metadata here, but for now we'll only show preview for selected NFTs
    return null;
  }, [formData.tokenId, ownedNFTs]);

  const { writeContract, data: hash, isPending, error, reset: resetListing } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Read contract name and owner onchain
  const isValidContract = isValidAddressFormat(formData.nftContract);
  const contractAddress = isValidContract ? (formData.nftContract as Address) : undefined;
  const hasValidTokenId = formData.tokenId !== "" && !isNaN(Number(formData.tokenId));

  // ERC20 token validation
  const erc20Token = useERC20Token(formData.paymentType === "ERC20" ? formData.erc20Address : undefined, {
    chainId: createListingNftChainId,
  });
  const isValidERC20 = formData.paymentType === "ETH" || (formData.paymentType === "ERC20" && erc20Token.isValid);
  const priceSymbol = formData.paymentType === "ETH" ? "ETH" : (erc20Token.symbol || "TOKEN");

  // Check if contract supports ERC721
  const { data: isERC721, isLoading: loadingERC721 } = useReadContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'supportsInterface',
    args: [ERC721_INTERFACE_ID as `0x${string}`],
    chainId: createListingNftChainId,
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
    chainId: createListingNftChainId,
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
    chainId: createListingNftChainId,
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
    chainId: createListingNftChainId,
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
    chainId: createListingNftChainId,
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
    args: address ? [address, marketplaceAddressForListing] : undefined,
    chainId: createListingNftChainId,
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

  // Fetch deployed contracts when addresses are available
  useEffect(() => {
    if (allVerifiedAddresses.length > 0 && !deployedContractsLoading && !deployedContractsFetched) {
      async function fetchDeployedContracts() {
        setDeployedContractsLoading(true);
        try {
          // Fetch contracts from all verified addresses (Base only)
          const contractPromises = allVerifiedAddresses.map((addr) =>
            fetch(`/api/contracts/deployed/${addr}`).then((res) => {
              if (res.ok) {
                return res.json().then((data) => data.contracts || []);
              }
              return [];
            })
          );
          
          const allContractsArrays = await Promise.all(contractPromises);
          const allContracts = allContractsArrays.flat();
          
          // Remove duplicates by address (case-insensitive)
          const uniqueContracts = Array.from(
            new Map(allContracts.map((contract) => [contract.address.toLowerCase(), contract])).values()
          );
          
          // Sort by name
          uniqueContracts.sort((a, b) => {
            if (!a.name && !b.name) return 0;
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
          });
          
          setDeployedContracts(uniqueContracts);
          setDeployedContractsFetched(true);
        } catch (error) {
          console.error('Error fetching deployed contracts:', error);
        } finally {
          setDeployedContractsLoading(false);
        }
      }
      fetchDeployedContracts();
    }
  }, [allVerifiedAddresses, deployedContractsLoading, deployedContractsFetched]);

  // Fetch NFTs owned from selected contract when contract address changes (explicit listing chain)
  useEffect(() => {
    if (listingTargetChainId == null) return;
    if (isValidContract && contractAddress && address) {
      async function fetchOwnedNFTs() {
        setOwnedNFTsLoading(true);
        setOwnedNFTs([]); // Clear previous NFTs
        setFormData(prev => ({ ...prev, tokenId: "" })); // Clear token ID when contract changes
        try {
          const response = await fetch(
            `/api/nfts/for-owner?owner=${address}&contractAddress=${contractAddress}&chainId=${listingTargetChainId}`
          );
          if (response.ok) {
            const data = await response.json();
            setOwnedNFTs(data.nfts || []);
          } else {
            console.error('Failed to fetch owned NFTs:', response.statusText);
          }
        } catch (error) {
          console.error('Error fetching owned NFTs:', error);
        } finally {
          setOwnedNFTsLoading(false);
        }
      }
      fetchOwnedNFTs();
    } else {
      // Clear NFTs if contract is invalid or address is not available
      setOwnedNFTs([]);
      setFormData(prev => ({ ...prev, tokenId: "" })); // Clear token ID
    }
  }, [contractAddress, address, isValidContract, listingTargetChainId]);

  // Automatically switch wallet to the selected listing chain (web only)
  useEffect(() => {
    if (isWrongNetwork && !isSwitching && isConnected) {
      if (!isMiniApp) {
        console.log("[CreateAuction] Auto-switching to listing target chain");
        switchToRequiredChain();
      }
    }
  }, [isWrongNetwork, isSwitching, isConnected, isMiniApp, switchToRequiredChain]);

  // Handle getChainId errors from approval transactions
  useEffect(() => {
    if (approvalError) {
      const errorMessage = approvalError.message || String(approvalError);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error("[CreateAuction] Chain ID error in approval, attempting chain switch:", approvalError);
        if (!isMiniApp) {
          try {
            switchToRequiredChain();
          } catch (switchErr) {
            console.error('[CreateAuction] Error switching chain:', switchErr);
          }
        }
      }
    }
  }, [approvalError, isMiniApp, switchToRequiredChain]);

  // Handle getChainId errors from listing transactions
  useEffect(() => {
    if (error) {
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error("[CreateAuction] Chain ID error in listing, attempting chain switch:", error);
        if (!isMiniApp) {
          try {
            switchToRequiredChain();
          } catch (switchErr) {
            console.error('[CreateAuction] Error switching chain:', switchErr);
          }
        }
      }
    }
  }, [error, isMiniApp, switchToRequiredChain]);

  // Determine token type and ownership
  const tokenType = useMemo(() => {
    if (loadingERC721 || loadingERC1155) return 'loading';
    if (isERC721) return 'ERC721';
    if (isERC1155) return 'ERC1155';
    return 'unknown';
  }, [isERC721, isERC1155, loadingERC721, loadingERC1155]);

  // Sync detected token type with wizard state
  useEffect(() => {
    if (tokenType === 'ERC721' || tokenType === 'ERC1155') {
      if (!selectedTokenType || selectedTokenType !== tokenType) {
        setSelectedTokenType(tokenType as "ERC721" | "ERC1155");
      }
    }
  }, [tokenType, selectedTokenType]);

  // Update ERC1155 balance in wizard state
  useEffect(() => {
    if (tokenType === 'ERC1155' && erc1155Balance !== undefined) {
      setWizardERC1155Balance(Number(erc1155Balance));
    }
  }, [tokenType, erc1155Balance]);

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
      if (approvedAddress?.toLowerCase() === marketplaceAddressForListing.toLowerCase()) {
        return { loading: false, isApproved: true, needsApproval: false };
      }
    }

    return { loading: false, isApproved: false, needsApproval: true };
  }, [
    canProceed,
    loadingERC721Approved,
    loadingApprovedForAll,
    isApprovedForAll,
    tokenType,
    erc721Approved,
    isApprovalSuccess,
    marketplaceAddressForListing,
  ]);

  // Handle approval
  const handleApprove = async () => {
    if (!contractAddress || !address || !hasValidTokenId) return;

    // Double-check ownership before approving
    if (!ownershipStatus.isOwner) {
      alert('You do not own this token. Please refresh and try again.');
      return;
    }

    // Check if token is already listed/sold
    try {
      const checkResponse = await fetch(
        `/api/listings/check-token?tokenAddress=${encodeURIComponent(contractAddress)}&tokenId=${encodeURIComponent(formData.tokenId)}&chainId=${createListingNftChainId}`
      );
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.isSold) {
          alert('This token has already been sold and cannot be listed again.');
          return;
        }
        if (checkData.isListed && checkData.activeListings?.length > 0) {
          const listingIds = checkData.activeListings.map((l: any) => l.listingId).join(', ');
          alert(`This token is already listed (Listing IDs: ${listingIds}). Please cancel the existing listing first.`);
          return;
        }
      }
    } catch (checkError) {
      console.error('[CreateAuction] Error checking token listing status:', checkError);
      // Continue with approval even if check fails (fail open)
    }

    // Check if we're on the correct chain (web only - miniapp handles this automatically)
    if (!isMiniApp && connectedChainId !== createListingNftChainId) {
      console.log("[CreateAuction] Wrong network for listing target chain");
      try {
        switchToRequiredChain();
        await new Promise(resolve => setTimeout(resolve, 500));
        if (connectedChainId !== createListingNftChainId) {
          return;
        }
      } catch (err) {
        console.error('[CreateAuction] Error switching chain:', err);
        alert(`Please switch to ${getChainNetworkInfo(createListingNftChainId).displayName} to continue`);
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
          args: [marketplaceAddressForListing, BigInt(formData.tokenId)],
          chainId: createListingNftChainId,
          account: address,
        });
      } else {
        // For ERC1155: Must use setApprovalForAll (no single-token approval in standard)
        writeApproval({
          address: contractAddress,
          abi: NFT_ABI,
          functionName: 'setApprovalForAll',
          args: [marketplaceAddressForListing, true],
          chainId: createListingNftChainId,
          account: address,
        });
      }
    } catch (err: any) {
      // Handle getChainId errors gracefully
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
        console.error("[CreateAuction] Chain ID error during approval:", err);
        if (!isMiniApp) {
          try {
            switchToRequiredChain();
            alert(`Please switch to ${getChainNetworkInfo(createListingNftChainId).displayName} and try again`);
          } catch (switchErr) {
            console.error('[CreateAuction] Error switching chain:', switchErr);
            alert(`Please switch to ${getChainNetworkInfo(createListingNftChainId).displayName} manually and try again`);
          }
        } else {
          alert(
            `Network error. Please ensure you are on ${getChainNetworkInfo(createListingNftChainId).displayName}.`
          );
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
    chainId: createListingNftChainId,
    query: {
      enabled: !!contractAddress,
      retry: 1,
    },
  });

  const { data: contractOwner, isLoading: loadingOwner, error: ownerError } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_INFO_ABI,
    functionName: 'owner',
    chainId: createListingNftChainId,
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
      const alchemyInfo = await fetchContractInfoFromAlchemy(
        formData.nftContract,
        createListingNftChainId
      );
      
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
    // Reset wizard state
    setListingTargetChainId(null);
    setWizardPage(1);
    setSelectedContract(null);
    setSelectedTokenType(null);
    setSelectedTokenId(null);
    setSelectedListingType(null);
    setWizardERC1155Balance(0);
  };

  const handleListingChainContinue = (chainId: number) => {
    setListingTargetChainId(chainId);
    setWizardPage(2);
  };

  const handleBackFromContractStep = () => {
    setWizardPage(1);
    setListingTargetChainId(null);
    setSelectedContract(null);
    setSelectedTokenType(null);
    setSelectedTokenId(null);
    setSelectedListingType(null);
    setFormData((prev) => ({ ...prev, nftContract: "", tokenId: "" }));
    setWizardERC1155Balance(0);
  };

  // Wizard navigation handlers
  const handleContractSelect = (contractAddress: string, tokenType: "ERC721" | "ERC1155") => {
    setSelectedContract(contractAddress);
    setSelectedTokenType(tokenType);
    setFormData(prev => ({ ...prev, nftContract: contractAddress }));
    setWizardPage(3);
  };

  const handleManualContractInput = (contractAddress: string) => {
    // Need to detect token type - for now assume ERC721
    setSelectedContract(contractAddress);
    setSelectedTokenType("ERC721"); // Will be updated when contract is checked
    setFormData(prev => ({ ...prev, nftContract: contractAddress }));
    setWizardPage(3);
  };

  const handleTokenSelect = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    setFormData(prev => ({ ...prev, tokenId }));
    
    // Move to appropriate page based on token type
    if (selectedTokenType === "ERC1155") {
      setWizardPage(4);
      // Fetch balance for ERC1155
      // This will be handled by the existing balance check
    } else {
      setWizardPage(4); // ERC721 listing type selection
    }
  };

  const handleERC721ListingTypeSelect = (type: "AUCTION" | "FIXED_PRICE" | "OFFERS_ONLY") => {
    setSelectedListingType(type);
    setFormData(prev => ({ ...prev, listingType: type === "AUCTION" ? "INDIVIDUAL_AUCTION" : type === "FIXED_PRICE" ? "FIXED_PRICE" : "OFFERS_ONLY" }));
    setWizardPage(5);
  };

  const handleWizardBack = () => {
    if (wizardPage === 3) {
      setWizardPage(2);
      setSelectedTokenId(null);
      setFormData((prev) => ({ ...prev, tokenId: "" }));
    } else if (wizardPage === 4) {
      setWizardPage(3);
      if (selectedTokenType === "ERC721") {
        setSelectedListingType(null);
      }
    } else if (wizardPage === 5) {
      if (selectedTokenType === "ERC721") {
        setWizardPage(4);
        setSelectedListingType(null);
      }
    }
  };

  // Wizard submission handlers - update formData and call submission
  // NOTE: We pass overrides directly to handleSubmit to avoid React state race conditions
  const handleERC1155Submit = async (data: {
    price: string;
    quantity: number;
    paymentType: "ETH" | "ERC20";
    erc20Address: string;
    startTime: string | null;
    endTime: string | null;
    noTimeframe: boolean;
  }) => {
    // Build the override data to pass directly to handleSubmit
    // This avoids the race condition where setFormData hasn't applied yet
    const overrides = {
      listingType: "FIXED_PRICE" as const,
      fixedPrice: data.price,
      totalAvailable: String(data.quantity),
      totalPerSale: "1", // People can only purchase one at a time
      paymentType: data.paymentType,
      erc20Address: data.erc20Address,
      startTime: data.startTime || "",
      endTime: data.noTimeframe ? "" : (data.endTime || ""),
    };
    
    // Also update formData for UI consistency
    setFormData(prev => ({ ...prev, ...overrides }));
    
    // Pass overrides directly to handleSubmit
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, overrides);
  };

  const handleERC721AuctionSubmit = async (data: {
    reservePrice: string;
    paymentType: "ETH" | "ERC20";
    erc20Address: string;
    startTime: string | null;
    endTime: string | null;
    useDuration: boolean;
    durationSeconds: number;
  }) => {
    // Build overrides to pass directly to handleSubmit (avoids race condition)
    const overrides = {
      listingType: "INDIVIDUAL_AUCTION" as const,
      reservePrice: data.reservePrice,
      paymentType: data.paymentType,
      erc20Address: data.erc20Address,
      startTime: data.startTime || "",
      endTime: data.useDuration ? String(data.durationSeconds) : (data.endTime || ""),
    };
    setFormData(prev => ({ ...prev, ...overrides }));
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, overrides);
  };

  const handleERC721FixedPriceSubmit = async (data: {
    price: string;
    paymentType: "ETH" | "ERC20";
    erc20Address: string;
    startTime: string | null;
    endTime: string | null;
    noTimeframe: boolean;
  }) => {
    // Build overrides to pass directly to handleSubmit (avoids race condition)
    const overrides = {
      listingType: "FIXED_PRICE" as const,
      fixedPrice: data.price,
      totalAvailable: "1", // ERC721 is always 1
      totalPerSale: "1", // ERC721 is always 1
      paymentType: data.paymentType,
      erc20Address: data.erc20Address,
      startTime: data.startTime || "",
      endTime: data.noTimeframe ? "" : (data.endTime || ""),
    };
    setFormData(prev => ({ ...prev, ...overrides }));
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, overrides);
  };

  const handleERC721OffersOnlySubmit = async () => {
    // Build overrides to pass directly to handleSubmit (avoids race condition)
    const now = Math.floor(Date.now() / 1000);
    const futureTime = new Date((now + 60) * 1000);
    const year = futureTime.getFullYear();
    const month = String(futureTime.getMonth() + 1).padStart(2, "0");
    const day = String(futureTime.getDate()).padStart(2, "0");
    const hours = String(futureTime.getHours()).padStart(2, "0");
    const minutes = String(futureTime.getMinutes()).padStart(2, "0");
    const startTimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    const overrides = {
      listingType: "OFFERS_ONLY" as const,
      startTime: startTimeStr,
      endTime: "",
    };
    setFormData(prev => ({ ...prev, ...overrides }));
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, overrides);
  };

  const handleSubmit = async (
    e: React.FormEvent,
    overrides?: Partial<typeof formData>
  ) => {
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

    // Merge overrides with formData to handle race conditions from wizard submissions
    const effectiveFormData = overrides ? { ...formData, ...overrides } : formData;

    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Helper function to convert datetime-local string to UTC timestamp
      // datetime-local format is "YYYY-MM-DDTHH:mm" (no timezone info)
      // We need to parse it as local time and convert to UTC timestamp
      const parseDateTimeLocal = (dateTimeLocal: string): number => {
        // datetime-local format: "YYYY-MM-DDTHH:mm"
        // JavaScript's Date constructor interprets this as local time
        // getTime() converts to UTC milliseconds, which is what we want
        const date = new Date(dateTimeLocal);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${dateTimeLocal}`);
        }
        return Math.floor(date.getTime() / 1000);
      };
      
      // Convert datetime-local to Unix timestamp (seconds)
      const startTime = effectiveFormData.startTime 
        ? parseDateTimeLocal(effectiveFormData.startTime)
        : effectiveFormData.listingType === "OFFERS_ONLY" 
          ? now + 60 // OFFERS_ONLY requires startTime in future, default to 1 minute from now
          : 0; // 0 means start immediately on first bid/purchase
      
      // Handle endTime based on listing type
      // CRITICAL: When startTime is 0 (starts on first interaction), the contract adds
      // block.timestamp to endTime. If endTime is max uint48, this causes an overflow!
      // So we must use a duration (6 months) instead of max uint48 when startTime is 0.
      let endTime: number;
      const MAX_UINT48 = 281474976710655;
      const SAFE_DURATION_6_MONTHS = 15552000; // 6 months in seconds (180 days)
      const DEFAULT_AUCTION_DURATION = 604800; // 7 days in seconds (reasonable default for auctions)
      
      // OFFERS_ONLY listings are always open-ended (no expiration)
      // Sellers can accept or cancel offers at any time
      if (effectiveFormData.listingType === "OFFERS_ONLY") {
        // Always use MAX_UINT48 for OFFERS_ONLY (never expires)
        // Ignore any endTime provided - sellers control when to accept/cancel
        endTime = MAX_UINT48;
        console.log('[CreateListing] OFFERS_ONLY listing - using MAX_UINT48 (open-ended, no expiration)');
      } else if (effectiveFormData.listingType === "FIXED_PRICE" && 
        (!effectiveFormData.endTime || effectiveFormData.endTime === "") &&
        (!effectiveFormData.startTime || effectiveFormData.startTime === "")) {
        // Check if "no timeframe" option was selected (for FIXED_PRICE listings)
        // This is indicated by empty endTime AND empty startTime (or explicit noTimeframe flag)
        const isNoTimeframe = true;
        // For FIXED_PRICE with "no timeframe" option:
        // If startTime is 0 (start on first purchase), endTime is treated as a DURATION
        // that gets added to block.timestamp on first purchase.
        // Using max uint48 would cause overflow, so use 6 months instead.
        // If startTime is set, endTime is an absolute timestamp, so max uint48 is fine.
        if (startTime === 0) {
          endTime = SAFE_DURATION_6_MONTHS;
          console.log('[CreateListing] Using safe duration (6 months) for open-ended FIXED_PRICE with startTime=0');
        } else {
          // Absolute timestamp - max uint48 means "never expires"
          endTime = MAX_UINT48;
          console.log('[CreateListing] Using MAX_UINT48 for open-ended FIXED_PRICE with startTime set');
        }
      } else if (effectiveFormData.endTime) {
        // OFFERS_ONLY listings are already handled above - this branch is for other types
        // Check if endTime is already a duration (number string) or a date string
        // When useDuration=true, endTime is set to String(durationSeconds), which is a number
        const isDurationString = isPlainDurationSecondsString(effectiveFormData.endTime);
        const endTimeAsNumber = isDurationString
          ? parseInt(effectiveFormData.endTime.trim(), 10)
          : NaN;

        if (startTime === 0) {
          // startTime=0 means auction starts on first bid
          if (isDurationString) {
            // endTime is already a duration (from DurationSelector when useDuration=true)
            endTime = endTimeAsNumber;
            console.log(`[CreateListing] startTime=0 with duration provided: Using duration ${endTime}s (${Math.floor(endTime / 86400)} days)`);
          } else {
            // endTime is a date string - convert it to a duration from now
            const absoluteEndTime = parseDateTimeLocal(effectiveFormData.endTime);
            endTime = Math.max(0, absoluteEndTime - now);
            
            // Safety check: if duration is unreasonably large (> 6 months), cap it
            if (endTime > SAFE_DURATION_6_MONTHS) {
              console.warn(`[CreateListing] Duration calculated from endTime (${endTime}s) exceeds safe limit. Capping to ${SAFE_DURATION_6_MONTHS}s (6 months)`);
              endTime = SAFE_DURATION_6_MONTHS;
            }
            
            console.log(`[CreateListing] startTime=0 with endTime date provided: Converting absolute timestamp ${absoluteEndTime} to duration ${endTime}s (${Math.floor(endTime / 86400)} days)`);
          }
        } else {
          // startTime is set, so endTime should be an absolute timestamp
          if (isDurationString) {
            // This shouldn't happen when startTime is set, but handle it gracefully
            // Convert duration to absolute timestamp by adding to startTime
            endTime = startTime + endTimeAsNumber;
            console.warn(`[CreateListing] startTime set but endTime is duration string - converting to timestamp: ${endTime}`);
          } else {
            // endTime is a date string - use it as absolute timestamp
            endTime = parseDateTimeLocal(effectiveFormData.endTime);
            
            // Log the conversion for debugging
            const duration = endTime - startTime;
            const durationDays = duration / 86400;
            console.log(`[CreateListing] Parsed dates - startTime: ${startTime} (${new Date(startTime * 1000).toISOString()}), endTime: ${endTime} (${new Date(endTime * 1000).toISOString()}), duration: ${duration} seconds (${durationDays.toFixed(2)} days)`);
            
            // Warn if duration seems suspiciously short (less than 1 hour) when user likely intended longer
            if (duration > 0 && duration < 3600) {
              console.warn(`[CreateListing] WARNING: End time is only ${Math.floor(duration / 60)} minutes after start time. This might be a date entry error.`);
            }
          }
        }
      } else {
        // For other listing types without endTime (OFFERS_ONLY already handled above)
        if (startTime === 0) {
          // IMPORTANT: If startTime is 0, endTime becomes a duration added to block.timestamp
          // For auctions, use a reasonable default (7 days) instead of 6 months
          if (effectiveFormData.listingType === "INDIVIDUAL_AUCTION") {
            endTime = DEFAULT_AUCTION_DURATION;
            console.log('[CreateListing] Using default auction duration (7 days) for start-on-first-bid auction');
          } else {
            // For FIXED_PRICE, use 6 months as safe duration (already handled above, but keeping for safety)
            endTime = SAFE_DURATION_6_MONTHS;
            console.log('[CreateListing] Using safe duration (6 months) for listing with startTime=0');
          }
        } else {
          endTime = 0;
        }
      }
      
      // Safety check: Prevent the dangerous combination that causes contract overflow
      if (startTime === 0 && endTime === MAX_UINT48) {
        console.error('[CreateListing] CRITICAL: Preventing overflow - startTime=0 with endTime=max uint48');
        endTime = SAFE_DURATION_6_MONTHS;
      }

      // Validate endTime based on listing type and startTime
      const MAX_REASONABLE_MONTHS = 6;
      const MAX_REASONABLE_SECONDS = MAX_REASONABLE_MONTHS * 30 * 24 * 60 * 60; // 6 months in seconds (180 days)
      
      if (effectiveFormData.listingType === "FIXED_PRICE") {
        // FIXED_PRICE: endTime can be max uint48 (never expires) or a future timestamp
        if (endTime === MAX_UINT48) {
          // Never-expiring is allowed for FIXED_PRICE
        } else if (startTime === 0 && endTime === SAFE_DURATION_6_MONTHS) {
          // When startTime is 0 and no timeframe is selected, endTime is a duration, not a timestamp
          // This is valid - skip timestamp validation
        } else if (endTime <= now) {
          // Validation handled by DateSelector constraints
          console.error("End time validation failed: must be in the future");
          setIsSubmitting(false);
          return;
        } else if (endTime > now + MAX_REASONABLE_SECONDS) {
          // Validation handled by DateSelector constraints
          console.error(`End time validation failed: cannot be more than ${MAX_REASONABLE_MONTHS} months in the future`);
          setIsSubmitting(false);
          return;
        }
      } else {
        // For INDIVIDUAL_AUCTION, never-expiring is not allowed
        // OFFERS_ONLY can be open-ended (MAX_UINT48)
        if (effectiveFormData.listingType === "INDIVIDUAL_AUCTION" && (endTime === MAX_UINT48 || endTime >= MAX_UINT48)) {
          // Validation handled by DateSelector constraints
          console.error("End time validation failed: auctions must have an expiration date");
          setIsSubmitting(false);
          return;
        }
        
        // Skip endTime validation for OFFERS_ONLY when it's MAX_UINT48 (open-ended)
        if (effectiveFormData.listingType === "OFFERS_ONLY" && endTime === MAX_UINT48) {
          // Open-ended OFFERS_ONLY listing - no endTime validation needed
          console.log('[CreateListing] Open-ended OFFERS_ONLY listing - skipping endTime validation');
        } else if (startTime === 0) {
          // If startTime is 0, endTime represents duration from first bid/purchase
          if (!endTime || endTime <= 0) {
            // Validation handled by DurationSelector constraints
            console.error("Duration validation failed: must be a positive value");
            setIsSubmitting(false);
            return;
          }
          // Validate duration is reasonable (max 6 months)
          if (endTime > MAX_REASONABLE_SECONDS) {
            // Validation handled by DurationSelector constraints
            console.error(`Duration validation failed: cannot be more than ${MAX_REASONABLE_MONTHS} months`);
            setIsSubmitting(false);
            return;
          }
        } else {
          // If startTime is set, endTime must be an absolute timestamp in the future
          if (!endTime || endTime <= now) {
            // Validation handled by DateSelector constraints
            console.error("End time validation failed: must be in the future");
            setIsSubmitting(false);
            return;
          }
          if (endTime <= startTime) {
            // Validation handled by DateSelector constraints
            console.error("End time validation failed: must be after start time");
            setIsSubmitting(false);
            return;
          }
          // Validate endTime is reasonable (max 6 months from now)
          // Skip for OFFERS_ONLY with MAX_UINT48 (open-ended)
          if (effectiveFormData.listingType !== "OFFERS_ONLY" && endTime > now + MAX_REASONABLE_SECONDS) {
            // Validation handled by DateSelector constraints
            console.error(`End time validation failed: cannot be more than ${MAX_REASONABLE_MONTHS} months in the future`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Validate listing type specific requirements
      if (effectiveFormData.listingType === "OFFERS_ONLY" && startTime <= now) {
        // Validation handled by DateSelector constraints
        console.error("Start time validation failed: must be in the future for offers-only listings");
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

      // Debug: Log the listing type being used
      console.log('[CreateListing] Creating listing with type:', effectiveFormData.listingType, '→', 
        effectiveFormData.listingType === "INDIVIDUAL_AUCTION" ? 1 : 
        effectiveFormData.listingType === "FIXED_PRICE" ? 2 : 4);

      if (effectiveFormData.listingType === "INDIVIDUAL_AUCTION") {
        listingType = 1;
        initialAmount = parseEther(effectiveFormData.reservePrice);
        totalAvailable = 1;
        totalPerSale = 1;
        extensionInterval = 0;
        minIncrementBPS = parseInt(effectiveFormData.minIncrementBPS);
      } else if (effectiveFormData.listingType === "FIXED_PRICE") {
        listingType = 2;
        initialAmount = parseEther(effectiveFormData.fixedPrice);
        totalAvailable = parseInt(effectiveFormData.totalAvailable);
        totalPerSale = parseInt(effectiveFormData.totalPerSale);
        extensionInterval = 0; // Must be 0 for FIXED_PRICE
        minIncrementBPS = 0; // Must be 0 for FIXED_PRICE
        
        if (totalAvailable < 1 || totalPerSale < 1) {
          // Validation handled by NumberSelector constraints
          console.error("Quantity validation failed: total available and total per sale must be at least 1");
          setIsSubmitting(false);
          return;
        }
        if (totalPerSale > totalAvailable) {
          // Validation handled by NumberSelector constraints
          console.error("Quantity validation failed: total per sale cannot exceed total available");
          setIsSubmitting(false);
          return;
        }
        // For ERC721, totalAvailable and totalPerSale must be 1
        if (tokenType === 'ERC721' && (totalAvailable !== 1 || totalPerSale !== 1)) {
          // Validation handled by NumberSelector constraints
          console.error("Quantity validation failed: ERC721 tokens can only be sold one at a time");
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
      const erc20Address = effectiveFormData.paymentType === "ERC20" && effectiveFormData.erc20Address
        ? effectiveFormData.erc20Address as Address
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

      // For OFFERS_ONLY listings, we must set lazy: true because the contract requires
      // that non-lazy listings can only be INDIVIDUAL_AUCTION or FIXED_PRICE types
      // Note: This requires the token contract to implement ILazyDelivery interface
      const isOffersOnly = effectiveFormData.listingType === "OFFERS_ONLY";
      
      const tokenDetails = {
        id: BigInt(formData.tokenId),
        address_: formData.nftContract as Address,
        spec: tokenType === 'ERC1155' ? 2 : 1, // 1 = ERC721, 2 = ERC1155
        lazy: isOffersOnly, // Must be true for OFFERS_ONLY listings
      };

      const deliveryFees = {
        deliverBPS: 0,
        deliverFixed: BigInt(0),
      };

      const listingReceivers: Array<{ receiver: Address; receiverBPS: number }> = [];

      // Double-check ownership before submitting
      if (!ownershipStatus.isOwner) {
        setIsSubmitting(false);
        alert('You do not own this token. Please refresh and try again.');
        return;
      }

      // Check if token is already listed/sold before submitting
      try {
        const checkResponse = await fetch(
          `/api/listings/check-token?tokenAddress=${encodeURIComponent(formData.nftContract)}&tokenId=${encodeURIComponent(formData.tokenId)}&chainId=${createListingNftChainId}`
        );
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.isSold) {
            setIsSubmitting(false);
            alert('This token has already been sold and cannot be listed again.');
            return;
          }
          if (checkData.isListed && checkData.activeListings?.length > 0) {
            const listingIds = checkData.activeListings.map((l: any) => l.listingId).join(', ');
            setIsSubmitting(false);
            alert(`This token is already listed (Listing IDs: ${listingIds}). Please cancel the existing listing first.`);
            return;
          }
        }
      } catch (checkError) {
        console.error('[CreateAuction] Error checking token listing status:', checkError);
        // Continue with submission even if check fails (fail open)
      }

      // Check if we're on the correct chain (web only - miniapp handles this automatically)
      if (!isMiniApp && connectedChainId !== createListingNftChainId) {
        console.log("[CreateAuction] Wrong network for listing target chain (submit)");
        try {
          switchToRequiredChain();
          await new Promise(resolve => setTimeout(resolve, 500));
          if (connectedChainId !== createListingNftChainId) {
            setIsSubmitting(false);
            alert(`Please switch to ${getChainNetworkInfo(createListingNftChainId).displayName} to continue`);
            return;
          }
        } catch (err) {
          console.error('[CreateAuction] Error switching chain:', err);
          setIsSubmitting(false);
          alert(`Please switch to ${getChainNetworkInfo(createListingNftChainId).displayName} to continue`);
          return;
        }
      }

      // For OFFERS_ONLY listings, acceptOffers must be true (though the flag is also set by the listing type)
      // For other listings, acceptOffers should be false unless explicitly enabled
      const acceptOffers = isOffersOnly ? true : false;

      try {
        writeContract({
          address: marketplaceAddressForListing,
          abi: MARKETPLACE_ABI,
          functionName: "createListing",
          chainId: createListingNftChainId,
          account: address,
          args: [
            listingDetails,
            tokenDetails,
            deliveryFees,
            listingReceivers,
            false, // enableReferrer
            acceptOffers, // Must be true for OFFERS_ONLY listings
            "0x", // data (empty bytes)
          ],
        });
      } catch (txErr: any) {
        // Handle getChainId errors gracefully
        const errorMessage = txErr?.message || String(txErr);
        if (errorMessage.includes('getChainId') || errorMessage.includes('connector')) {
          console.error("[CreateAuction] Chain ID error during createListing:", txErr);
          if (!isMiniApp) {
            try {
              switchToRequiredChain();
              alert(`Please switch to ${getChainNetworkInfo(createListingNftChainId).displayName} and try again`);
            } catch (switchErr) {
              console.error('[CreateAuction] Error switching chain:', switchErr);
              alert(`Please switch to ${getChainNetworkInfo(createListingNftChainId).displayName} manually and try again`);
            }
          } else {
            alert(
              `Network error. Please ensure you are on ${getChainNetworkInfo(createListingNftChainId).displayName}.`
            );
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
            
            // Mark listing as building
            fetch(`/api/listings/${listingId}/page-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'building',
                sellerAddress: address,
              }),
            }).catch(err => 
              console.error('Error marking listing as building:', err)
            );
            
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
            // The page will show a building state while waiting for subgraph to index
            setTimeout(() => {
              transitionNavigate(
                router,
                canonicalListingDetailPath(createListingNftChainId, String(listingId))
              );
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
  }, [
    receipt,
    isSuccess,
    address,
    formData.listingType,
    formData.tokenId,
    formData.nftContract,
    contractPreview.name,
    router,
    createListingNftChainId,
  ]);

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
        if (Array.isArray(capabilities) && capabilities.includes('back')) {
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

  const stepBackClass =
    "text-neutral-700 hover:text-neutral-950 transition-colors inline-flex items-center gap-2 font-space-grotesk text-sm font-medium";

  return (
    <div className="create-listing-page min-h-screen bg-neutral-50 text-neutral-900 animate-in fade-in duration-100">
      {!membershipLoading && (
        <button
          type="button"
          onClick={() => {
            if (isMember) return;
            router.push("/membership?from=create");
          }}
          className="flex w-full flex-col items-center justify-center gap-1 bg-[#f5b0d3] px-3 py-2.5 text-center font-space-grotesk text-sm font-medium leading-snug text-[#333333] sm:flex-row sm:flex-wrap sm:gap-x-2 sm:text-base"
        >
          {isMember ? (
            <span>Member — thanks for supporting infrastructure & open-source</span>
          ) : (
            <>
              <span className="max-w-[min(100%,42rem)]">
                Support infrastructure & open-source behind cryptoart.social
              </span>
              <span className="tabular-nums">0.0001 ETH / month</span>
            </>
          )}
        </button>
      )}

      {!isMiniApp && (
        <section className="border-b border-neutral-200 bg-white">
          <div className="container mx-auto flex max-w-4xl justify-center px-5 py-3">
            <TransitionLink
              href="/market"
              prefetch={false}
              className="font-mek-mono text-sm tracking-[0.5px] text-neutral-600 transition-colors hover:text-neutral-950"
            >
              View market
            </TransitionLink>
          </div>
        </section>
      )}

      <div
        className="listing-light-surface listing-page-chrome border-b border-neutral-200 bg-white text-neutral-900"
        style={{ backgroundColor: "#ffffff" }}
      >
        {!isMiniApp && (
          <div className="container mx-auto flex max-w-4xl items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-5">
            <Logo compact />
            <ProfileDropdown topBarVariant="light" />
          </div>
        )}
        <div className="container mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3 font-space-grotesk text-sm font-medium">
          <TransitionLink
            href="/"
            className="inline-flex shrink-0 items-center gap-2 text-neutral-900 underline-offset-2 hover:underline"
          >
            <span aria-hidden>←</span> back
          </TransitionLink>
          {isMiniApp ? (
            <div className="flex min-w-0 shrink-0 items-center justify-end">
              <ProfileDropdown />
            </div>
          ) : null}
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-5 py-6 sm:py-8">
        <div className="mb-8 font-space-grotesk">
          <h1 className="text-2xl font-medium tracking-tight text-neutral-900 sm:text-3xl">Create listing</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
            First choose whether your NFT and listing live on Base or Ethereum mainnet, then pick your contract and
            listing type. You will approve the marketplace on that same network before submitting.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Ethereum listings require your wallet on mainnet and a configured mainnet subgraph in production.
          </p>
        </div>

        {!isConnected && (
          <div className="mb-6 border border-neutral-200 bg-white px-4 py-4 font-space-grotesk text-sm text-neutral-700">
            Connect your wallet to continue.
          </div>
        )}

        {/* Hidden form for submission handling */}
        <form onSubmit={handleSubmit} className="hidden">
          <input type="submit" />
        </form>

        {/* Wizard — light surface aligned with listing detail blocks */}
        <div className="border border-neutral-200 bg-white px-5 py-6 sm:px-6 sm:py-8">
          {wizardPage === 1 && (
            <ListingTargetChainStep onContinue={handleListingChainContinue} />
          )}

          {wizardPage === 2 && listingTargetChainId != null && (
            <>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleBackFromContractStep}
                  className={stepBackClass}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>
              <ContractSelector
                listingChainId={listingTargetChainId}
                selectedContract={selectedContract}
                onSelectContract={handleContractSelect}
                onManualInput={handleManualContractInput}
              />
            </>
          )}

          {wizardPage === 3 && selectedContract && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className={stepBackClass}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>
              
              <TokenSelector
                contractAddress={selectedContract}
                tokenType={selectedTokenType || "ERC721"}
                selectedTokenId={selectedTokenId}
                onSelectToken={handleTokenSelect}
              />
            </>
          )}

          {wizardPage === 4 && selectedContract && selectedTokenId && selectedTokenType === "ERC1155" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className={stepBackClass}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              {/* Ownership Check */}
              {!ownershipStatus.isOwner && !ownershipStatus.loading && (
                <div className="mb-6 border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-800">You do not own this token.</p>
                </div>
              )}

              {ownershipStatus.isOwner && (
                <>
                  {/* Approval Status */}
                  {!approvalStatus.isApproved && !approvalStatus.loading && (
                    <div className="mb-6 border border-amber-200 bg-amber-50 p-4">
                      <p className="mb-2 text-sm font-medium text-amber-900">Approval required</p>
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
                          className="mt-3 w-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                        >
                          Approve all tokens
                        </button>
                      )}
                    </div>
                  )}

                  {approvalStatus.isApproved && (
                    <ERC1155ConfigPage
                      contractAddress={selectedContract}
                      tokenId={selectedTokenId}
                      balance={wizardERC1155Balance || 0}
                      onBack={handleWizardBack}
                      onSubmit={handleERC1155Submit}
                      isSubmitting={isSubmitting}
                      showKismetCasaScheduleShortcut={showKismetCasaScheduleShortcut}
                    />
                  )}
                </>
              )}
            </>
          )}

          {wizardPage === 4 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className={stepBackClass}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              {/* Ownership Check */}
              {!ownershipStatus.isOwner && !ownershipStatus.loading && (
                <div className="mb-6 border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-800">You do not own this token.</p>
                </div>
              )}

              {ownershipStatus.isOwner && (
                <>
                  {/* Approval Status */}
                  {!approvalStatus.isApproved && !approvalStatus.loading && (
                    <div className="mb-6 border border-amber-200 bg-amber-50 p-4">
                      <p className="mb-2 text-sm font-medium text-amber-900">Approval required</p>
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
                          className="mt-3 w-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                        >
                          Approve token #{selectedTokenId}
                        </button>
                      )}
                    </div>
                  )}

                  {approvalStatus.isApproved && (
                    <ERC721ListingTypePage
                      onSelectType={handleERC721ListingTypeSelect}
                      onBack={handleWizardBack}
                    />
                  )}
                </>
              )}
            </>
          )}

          {wizardPage === 5 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && selectedListingType === "AUCTION" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className={stepBackClass}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              <ERC721AuctionConfigPage
                contractAddress={selectedContract}
                tokenId={selectedTokenId}
                onBack={handleWizardBack}
                onSubmit={handleERC721AuctionSubmit}
                isSubmitting={isSubmitting}
                showKismetCasaScheduleShortcut={showKismetCasaScheduleShortcut}
              />
            </>
          )}

          {wizardPage === 5 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && selectedListingType === "FIXED_PRICE" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className={stepBackClass}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              <ERC721FixedPriceConfigPage
                contractAddress={selectedContract}
                tokenId={selectedTokenId}
                onBack={handleWizardBack}
                onSubmit={handleERC721FixedPriceSubmit}
                isSubmitting={isSubmitting}
                showKismetCasaScheduleShortcut={showKismetCasaScheduleShortcut}
              />
            </>
          )}

          {wizardPage === 5 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && selectedListingType === "OFFERS_ONLY" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className={stepBackClass}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              <ERC721OffersOnlyPage
                contractAddress={selectedContract}
                tokenId={selectedTokenId}
                onBack={handleWizardBack}
                onSubmit={handleERC721OffersOnlySubmit}
                isSubmitting={isSubmitting}
              />
            </>
          )}

          {/* Transaction Status - show on all pages */}
          {(isPending || isConfirming || isSuccess || error) && (
            <div className="mt-6">
              <TransactionStatus
                hash={hash}
                isPending={isPending}
                isConfirming={isConfirming}
                isSuccess={isSuccess}
                error={error}
                successMessage="Listing created successfully!"
              />
            </div>
          )}

          {/* Success Actions */}
          {isSuccess && (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex gap-3">
                {createdListingId !== null ? (
                  <button
                    type="button"
                    onClick={() =>
                      transitionNavigate(
                        router,
                        canonicalListingDetailPath(createListingNftChainId, String(createdListingId))
                      )
                    }
                    className="flex-1 bg-neutral-900 px-6 py-3 font-space-grotesk text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                  >
                    View listing
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => transitionNavigate(router, "/")}
                    className="flex-1 bg-neutral-900 px-6 py-3 font-space-grotesk text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                  >
                    View listings
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 border border-neutral-300 bg-white px-6 py-3 font-space-grotesk text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
                >
                  Create another
                </button>
              </div>
              {createdListingId !== null && (
                <div className="flex justify-center">
                  <ShareableMomentButton
                    momentType="auction-created"
                    listingId={String(createdListingId)}
                    artworkName={contractPreview.name || `Token #${formData.tokenId}`}
                    className="w-auto"
                    buttonText="Share Your Auction"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
