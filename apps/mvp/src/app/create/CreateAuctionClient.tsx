"use client";

import { useState, useEffect, useMemo } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useRouter } from "next/navigation";
import { type Address, parseEther, decodeEventLog } from "viem";
import { isValidAddressFormat, fetchContractInfoFromAlchemy, CONTRACT_INFO_ABI } from "~/lib/contract-info";
import { MediaDisplay } from "~/components/media";
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
import { ContractSelector } from "~/components/create-listing/ContractSelector";
import { TokenSelector } from "~/components/create-listing/TokenSelector";
import { ERC1155ConfigPage } from "~/components/create-listing/ERC1155ConfigPage";
import { ERC721ListingTypePage } from "~/components/create-listing/ERC721ListingTypePage";
import { ERC721AuctionConfigPage } from "~/components/create-listing/ERC721AuctionConfigPage";
import { ERC721FixedPriceConfigPage } from "~/components/create-listing/ERC721FixedPriceConfigPage";
import { ERC721OffersOnlyPage } from "~/components/create-listing/ERC721OffersOnlyPage";

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

  // Fetch NFTs owned from selected contract when contract address changes
  useEffect(() => {
    if (isValidContract && contractAddress && address) {
      async function fetchOwnedNFTs() {
        setOwnedNFTsLoading(true);
        setOwnedNFTs([]); // Clear previous NFTs
        setFormData(prev => ({ ...prev, tokenId: "" })); // Clear token ID when contract changes
        try {
          const response = await fetch(
            `/api/nfts/for-owner?owner=${address}&contractAddress=${contractAddress}`
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
  }, [contractAddress, address, isValidContract]);

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
    // Reset wizard state
    setWizardPage(1);
    setSelectedContract(null);
    setSelectedTokenType(null);
    setSelectedTokenId(null);
    setSelectedListingType(null);
    setWizardERC1155Balance(0);
  };

  // Wizard navigation handlers
  const handleContractSelect = (contractAddress: string, tokenType: "ERC721" | "ERC1155") => {
    setSelectedContract(contractAddress);
    setSelectedTokenType(tokenType);
    setFormData(prev => ({ ...prev, nftContract: contractAddress }));
    setWizardPage(2);
  };

  const handleManualContractInput = (contractAddress: string) => {
    // Need to detect token type - for now assume ERC721
    setSelectedContract(contractAddress);
    setSelectedTokenType("ERC721"); // Will be updated when contract is checked
    setFormData(prev => ({ ...prev, nftContract: contractAddress }));
    setWizardPage(2);
  };

  const handleTokenSelect = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    setFormData(prev => ({ ...prev, tokenId }));
    
    // Move to appropriate page based on token type
    if (selectedTokenType === "ERC1155") {
      setWizardPage(3);
      // Fetch balance for ERC1155
      // This will be handled by the existing balance check
    } else {
      setWizardPage(3); // ERC721 listing type selection
    }
  };

  const handleERC721ListingTypeSelect = (type: "AUCTION" | "FIXED_PRICE" | "OFFERS_ONLY") => {
    setSelectedListingType(type);
    setFormData(prev => ({ ...prev, listingType: type === "AUCTION" ? "INDIVIDUAL_AUCTION" : type === "FIXED_PRICE" ? "FIXED_PRICE" : "OFFERS_ONLY" }));
    setWizardPage(4);
  };

  const handleWizardBack = () => {
    if (wizardPage === 2) {
      setWizardPage(1);
      setSelectedTokenId(null);
    } else if (wizardPage === 3) {
      if (selectedTokenType === "ERC721") {
        setWizardPage(2);
      } else {
        setWizardPage(2);
      }
    } else if (wizardPage === 4) {
      if (selectedTokenType === "ERC721") {
        setWizardPage(3);
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
      
      // Convert datetime-local to Unix timestamp (seconds)
      const startTime = effectiveFormData.startTime 
        ? Math.floor(new Date(effectiveFormData.startTime).getTime() / 1000)
        : effectiveFormData.listingType === "OFFERS_ONLY" 
          ? now + 60 // OFFERS_ONLY requires startTime in future, default to 1 minute from now
          : 0; // 0 means start immediately on first bid/purchase
      
      // Handle endTime based on listing type
      // CRITICAL: When startTime is 0 (starts on first interaction), the contract adds
      // block.timestamp to endTime. If endTime is max uint48, this causes an overflow!
      // So we must use a duration (like 100 years) instead of max uint48 when startTime is 0.
      let endTime: number;
      const MAX_UINT48 = 281474976710655;
      const SAFE_DURATION_100_YEARS = 3153600000; // 100 years in seconds
      
      if (effectiveFormData.listingType === "FIXED_PRICE" && !effectiveFormData.endTime) {
        // For FIXED_PRICE with no end time specified:
        // If startTime is 0 (start on first purchase), endTime is treated as a DURATION
        // that gets added to block.timestamp on first purchase.
        // Using max uint48 would cause overflow, so use 100 years instead.
        // If startTime is set, endTime is an absolute timestamp, so max uint48 is fine.
        if (startTime === 0) {
          endTime = SAFE_DURATION_100_YEARS;
          console.log('[CreateListing] Using safe duration (100 years) for open-ended FIXED_PRICE with startTime=0');
        } else {
          // Absolute timestamp - max uint48 means "never expires"
          endTime = MAX_UINT48;
        }
      } else if (effectiveFormData.endTime) {
        endTime = Math.floor(new Date(effectiveFormData.endTime).getTime() / 1000);
      } else {
        // For other listing types without endTime, use a safe duration
        if (startTime === 0) {
          // IMPORTANT: If startTime is 0, endTime becomes a duration added to block.timestamp
          // Use 100 years as a safe "never expires" equivalent
          endTime = SAFE_DURATION_100_YEARS;
          console.log('[CreateListing] Using safe duration (100 years) for listing with startTime=0');
        } else {
          endTime = 0;
        }
      }
      
      // Safety check: Prevent the dangerous combination that causes contract overflow
      if (startTime === 0 && endTime === MAX_UINT48) {
        console.error('[CreateListing] CRITICAL: Preventing overflow - startTime=0 with endTime=max uint48');
        endTime = SAFE_DURATION_100_YEARS;
      }

      // Validate endTime based on listing type and startTime
      if (effectiveFormData.listingType === "FIXED_PRICE") {
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
      if (effectiveFormData.listingType === "OFFERS_ONLY" && startTime <= now) {
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
          <p className="text-xs text-[#888888] mt-2">
            Only Base is supported.
          </p>
        </div>

        {!isConnected && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-4 mb-6">
            <p className="text-[#cccccc]">Please connect your wallet to create an auction.</p>
          </div>
        )}

        {/* Hidden form for submission handling */}
        <form onSubmit={handleSubmit} className="hidden">
          <input type="submit" />
        </form>

        {/* Wizard Pages */}
        <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6">
          {wizardPage === 1 && (
            <ContractSelector
              selectedContract={selectedContract}
              onSelectContract={handleContractSelect}
              onManualInput={handleManualContractInput}
            />
          )}

          {wizardPage === 2 && selectedContract && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2"
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

          {wizardPage === 3 && selectedContract && selectedTokenId && selectedTokenType === "ERC1155" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              {/* Ownership Check */}
              {!ownershipStatus.isOwner && !ownershipStatus.loading && (
                <div className="mb-6 bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <p className="text-red-400 text-sm">✗ You do not own this token</p>
                </div>
              )}

              {ownershipStatus.isOwner && (
                <>
                  {/* Approval Status */}
                  {!approvalStatus.isApproved && !approvalStatus.loading && (
                    <div className="mb-6 bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                      <p className="text-amber-400 text-sm font-medium mb-2">⚠ Approval required</p>
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
                          className="w-full mt-3 px-6 py-3 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors"
                        >
                          Approve All Tokens
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
                    />
                  )}
                </>
              )}
            </>
          )}

          {wizardPage === 3 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              {/* Ownership Check */}
              {!ownershipStatus.isOwner && !ownershipStatus.loading && (
                <div className="mb-6 bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <p className="text-red-400 text-sm">✗ You do not own this token</p>
                </div>
              )}

              {ownershipStatus.isOwner && (
                <>
                  {/* Approval Status */}
                  {!approvalStatus.isApproved && !approvalStatus.loading && (
                    <div className="mb-6 bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                      <p className="text-amber-400 text-sm font-medium mb-2">⚠ Approval required</p>
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
                          className="w-full mt-3 px-6 py-3 bg-white text-black text-sm font-medium hover:bg-[#e0e0e0] transition-colors"
                        >
                          Approve Token #{selectedTokenId}
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

          {wizardPage === 4 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && selectedListingType === "AUCTION" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2"
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
              />
            </>
          )}

          {wizardPage === 4 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && selectedListingType === "FIXED_PRICE" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2"
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
              />
            </>
          )}

          {wizardPage === 4 && selectedContract && selectedTokenId && selectedTokenType === "ERC721" && selectedListingType === "OFFERS_ONLY" && (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleWizardBack}
                  className="text-[#cccccc] hover:text-white transition-colors inline-flex items-center gap-2"
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
            <div className="mt-6 flex gap-3">
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
          )}
        </div>
      </div>
    </div>
  );
}
