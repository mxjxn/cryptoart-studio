"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useRouter } from "next/navigation";
import { type Address, parseEther } from "viem";
import { isValidAddressFormat, fetchContractInfoFromAlchemy, CONTRACT_INFO_ABI } from "~/lib/contract-info";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, CHAIN_ID } from "~/lib/contracts/marketplace";
import { TransactionStatus } from "~/components/TransactionStatus";
import { useMiniApp } from "@neynar/react";
import { sdk } from "@farcaster/miniapp-sdk";

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
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { isSDKLoaded } = useMiniApp();
  const [formData, setFormData] = useState({
    nftContract: "",
    tokenId: "",
    reservePrice: "",
    startTime: "",
    endTime: getDefaultEndTime(),
    minIncrementBPS: "500",
  });
  const [contractPreview, setContractPreview] = useState<ContractPreview>({
    name: null,
    owner: null,
    loading: false,
    error: null,
  });
  const [alchemyName, setAlchemyName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { writeContract, data: hash, isPending, error, reset: resetListing } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Read contract name and owner onchain
  const isValidContract = isValidAddressFormat(formData.nftContract);
  const contractAddress = isValidContract ? (formData.nftContract as Address) : undefined;
  const hasValidTokenId = formData.tokenId !== "" && !isNaN(Number(formData.tokenId));

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
  const handleApprove = () => {
    if (!contractAddress || !address || !hasValidTokenId) return;

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

  // Reset form to create another auction
  const handleReset = () => {
    setFormData({
      nftContract: "",
      tokenId: "",
      reservePrice: "",
      startTime: "",
      endTime: getDefaultEndTime(),
      minIncrementBPS: "500",
    });
    setContractPreview({
      name: null,
      owner: null,
      loading: false,
      error: null,
    });
    setAlchemyName(null);
    setIsSubmitting(false);
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
      // Convert datetime-local to Unix timestamp (seconds)
      const startTime = formData.startTime 
        ? Math.floor(new Date(formData.startTime).getTime() / 1000)
        : 0; // 0 means start immediately on first bid
      
      const endTime = formData.endTime 
        ? Math.floor(new Date(formData.endTime).getTime() / 1000)
        : 0;

      if (!endTime || endTime <= Math.floor(Date.now() / 1000)) {
        alert("End time must be in the future");
        setIsSubmitting(false);
        return;
      }

      // Convert reserve price from ETH to wei
      const reservePriceWei = parseEther(formData.reservePrice);

      // Prepare listing details
      // ListingType.INDIVIDUAL_AUCTION = 1
      // TokenLib.Spec.ERC721 = 1
      const listingDetails = {
        initialAmount: reservePriceWei,
        type_: 1, // INDIVIDUAL_AUCTION
        totalAvailable: 1,
        totalPerSale: 1,
        extensionInterval: 0,
        minIncrementBPS: parseInt(formData.minIncrementBPS),
        erc20: "0x0000000000000000000000000000000000000000" as Address,
        identityVerifier: "0x0000000000000000000000000000000000000000" as Address,
        startTime: startTime,
        endTime: endTime,
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
          false, // acceptOffers
          "0x", // data (empty bytes)
        ],
      });
    } catch (err) {
      console.error("Error creating auction:", err);
      alert("Failed to create auction. Please try again.");
      setIsSubmitting(false);
    }
  };

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
            router.push('/');
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
      router.push('/');
    };

    sdk.on('backNavigationTriggered', handleBackNavigation);

    return () => {
      sdk.off('backNavigationTriggered', handleBackNavigation);
      // Clear the back handler
      sdk.back.onback = null;
    };
  }, [isSDKLoaded, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Create Auction</h1>

        {!isConnected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">Please connect your wallet to create an auction.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NFT Contract Address
            </label>
            <input
              type="text"
              value={formData.nftContract}
              onChange={(e) => setFormData({ ...formData, nftContract: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 bg-white ${
                formData.nftContract && !isValidAddressFormat(formData.nftContract)
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
              placeholder="0x..."
              required
            />
            {formData.nftContract && !isValidAddressFormat(formData.nftContract) && (
              <p className="mt-1 text-sm text-red-600">
                Please enter a valid Ethereum address (42 characters, starting with 0x)
              </p>
            )}
          </div>

          {/* Contract Preview Pane */}
          {isValidContract && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-blue-900">Contract Preview</h3>
                {/* Token Type Badge */}
                {tokenType === 'loading' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-600">
                    <span className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></span>
                    Detecting...
                  </span>
                ) : tokenType === 'ERC721' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                    ERC-721
                  </span>
                ) : tokenType === 'ERC1155' ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                    ERC-1155
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                    Unknown Type
                  </span>
                )}
              </div>
              {contractPreview.loading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-blue-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-blue-200 rounded animate-pulse w-3/4"></div>
                </div>
              ) : contractPreview.error ? (
                <p className="text-sm text-red-600">{contractPreview.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-blue-900">Name:</span>{' '}
                    <span className="text-blue-700">
                      {contractPreview.name || 'Not available'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900">Owner:</span>{' '}
                    <span className="text-blue-700 font-mono text-xs">
                      {contractPreview.owner || 'Not available'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token ID
            </label>
            <input
              type="text"
              value={formData.tokenId}
              onChange={(e) => setFormData({ ...formData, tokenId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 bg-white"
              placeholder="1"
              required
            />
          </div>

          {/* Ownership Status */}
          {isValidContract && hasValidTokenId && (
            <div className={`rounded-lg p-4 ${
              ownershipStatus.loading 
                ? 'bg-gray-50 border border-gray-200' 
                : ownershipStatus.isOwner 
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
            }`}>
              {ownershipStatus.loading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600 text-sm">Checking ownership...</span>
                </div>
              ) : ownershipStatus.error ? (
                <p className="text-red-800 text-sm">{ownershipStatus.error}</p>
              ) : ownershipStatus.isOwner ? (
                <div className="space-y-1">
                  <p className="text-green-800 text-sm font-medium">✓ You own this token</p>
                  <p className="text-green-700 text-xs">Token Type: {tokenType}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-red-800 text-sm font-medium">✗ You do not own this token</p>
                  {ownershipStatus.owner && tokenType === 'ERC721' && (
                    <p className="text-red-700 text-xs font-mono">
                      Owned by: {ownershipStatus.owner}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Approval Status */}
          {canProceed && (
            <div className={`rounded-lg p-4 ${
              approvalStatus.loading 
                ? 'bg-gray-50 border border-gray-200' 
                : approvalStatus.isApproved 
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
            }`}>
              {approvalStatus.loading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600 text-sm">Checking marketplace approval...</span>
                </div>
              ) : approvalStatus.isApproved ? (
                <div className="space-y-1">
                  <p className="text-green-800 text-sm font-medium">✓ Marketplace approved to transfer this token</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-amber-800 text-sm font-medium">⚠ Approval required</p>
                    <p className="text-amber-700 text-xs">
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
                      className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reserve Price (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.reservePrice}
                  onChange={(e) => setFormData({ ...formData, reservePrice: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 bg-white disabled:bg-gray-100"
                  placeholder="0.1"
                  required
                  disabled={!canProceed}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time (optional, leave empty to start on first bid)
                </label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 bg-white disabled:bg-gray-100"
                  disabled={!canProceed}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 bg-white disabled:bg-gray-100"
                  required
                  disabled={!canProceed}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Increment (basis points, e.g., 500 = 5%)
                </label>
                <input
                  type="number"
                  value={formData.minIncrementBPS}
                  onChange={(e) => setFormData({ ...formData, minIncrementBPS: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 bg-white disabled:bg-gray-100"
                  placeholder="500"
                  required
                  disabled={!canProceed}
                />
              </div>
            </div>
          </div>

          {/* Transaction Status */}
          <TransactionStatus
            hash={hash}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={error}
            successMessage="Auction created successfully!"
          />

          {/* Action Buttons */}
          {isSuccess ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
              >
                View Auctions
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Create Another
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!isConnected || !canProceed || !approvalStatus.isApproved || isPending || isConfirming || isSubmitting}
              className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isPending
                ? "Waiting for signature..."
                : isConfirming
                  ? "Confirming transaction..."
                  : !approvalStatus.isApproved
                    ? "Approve marketplace first"
                    : "Create Auction"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

