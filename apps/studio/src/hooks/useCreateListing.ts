'use client';

import { useCallback, useMemo, useState } from 'react';
import { useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi';
import { base, baseSepolia, mainnet } from 'wagmi/chains';
import {
  ERC165_ABI,
  LAZY_DELIVERY_INTERFACE_ID,
  MARKETPLACE_ABI,
  NFT_APPROVAL_ABI,
  TOKEN_BALANCE_ABI,
  approvalCheck,
  describeTxFailure,
  listingConfirmedOnChain,
  listingIdFromCreateLogs,
  type CreateListingCall,
  type TokenStandard,
} from '@cryptoart/marketplace';
import { useQuery } from '@tanstack/react-query';

type ConfiguredChainId = typeof base.id | typeof baseSepolia.id | typeof mainnet.id;

function configuredChain(chainId: number): ConfiguredChainId | null {
  if (chainId === base.id || chainId === baseSepolia.id || chainId === mainnet.id) return chainId;
  return null;
}

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'shortMessage' in error && typeof error.shortMessage === 'string') {
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : 'The transaction failed.';
}

export type ListingTxPhase = 'idle' | 'wallet' | 'confirming' | 'confirmed' | 'rejected' | 'failed';

export type ConfirmedListing = {
  listingId: string;
  hash: `0x${string}`;
  marketplaceBps: number;
};

export function useCreateListing(input: {
  chainId: number;
  contractAddress: `0x${string}` | null;
  tokenId: bigint | null;
  standard: TokenStandard;
  owner?: `0x${string}`;
}) {
  const walletChainId = useChainId();
  const chain = configuredChain(input.chainId);
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: chain ?? undefined });
  const marketplaceQuery = useQuery({
    queryKey: ['marketplace-address', input.chainId],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace?chainId=${input.chainId}`);
      const body = (await res.json()) as { address?: string; error?: string };
      if (!res.ok || !body.address) throw new Error(body.error || 'Marketplace address is not configured');
      return body.address as `0x${string}`;
    },
    enabled: chain !== null,
  });
  const marketplace = marketplaceQuery.data;

  const approvedForAll = useReadContract({
    address: input.contractAddress ?? undefined,
    abi: NFT_APPROVAL_ABI,
    functionName: 'isApprovedForAll',
    args: input.owner && marketplace ? [input.owner, marketplace] : undefined,
    chainId: chain ?? undefined,
    query: { enabled: Boolean(chain && input.owner && marketplace && input.contractAddress) },
  });
  const tokenOperator = useReadContract({
    address: input.contractAddress ?? undefined,
    abi: NFT_APPROVAL_ABI,
    functionName: 'getApproved',
    args: input.tokenId !== null ? [input.tokenId] : undefined,
    chainId: chain ?? undefined,
    query: { enabled: Boolean(chain) && input.standard === 'erc721' && input.tokenId !== null && Boolean(input.contractAddress) },
  });
  const ownerOf = useReadContract({
    address: input.contractAddress ?? undefined,
    abi: TOKEN_BALANCE_ABI,
    functionName: 'ownerOf',
    args: input.tokenId !== null ? [input.tokenId] : undefined,
    chainId: chain ?? undefined,
    query: { enabled: Boolean(chain) && input.standard === 'erc721' && input.tokenId !== null && Boolean(input.contractAddress) },
  });
  const balanceOf = useReadContract({
    address: input.contractAddress ?? undefined,
    abi: TOKEN_BALANCE_ABI,
    functionName: 'balanceOf',
    args: input.owner && input.tokenId !== null ? [input.owner, input.tokenId] : undefined,
    chainId: chain ?? undefined,
    query: {
      enabled: Boolean(chain) && input.standard === 'erc1155' && Boolean(input.owner) && input.tokenId !== null && Boolean(input.contractAddress),
    },
  });
  const lazyDelivery = useReadContract({
    address: input.contractAddress ?? undefined,
    abi: ERC165_ABI,
    functionName: 'supportsInterface',
    args: [LAZY_DELIVERY_INTERFACE_ID],
    chainId: chain ?? undefined,
    query: { enabled: Boolean(input.contractAddress && chain) },
  });

  const approveWrite = useWriteContract();
  const createWrite = useWriteContract();
  const [phase, setPhase] = useState<ListingTxPhase>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedListing | null>(null);
  const [approvalSettledFor, setApprovalSettledFor] = useState<string | null>(null);
  const approvalKey = `${input.tokenId?.toString() ?? ''}:${marketplace ?? ''}`;
  const approvalSettled = approvalSettledFor === approvalKey;

  const approval = useMemo(() => {
    if (!marketplace || approvedForAll.isLoading || (input.standard === 'erc721' && tokenOperator.isLoading)) {
      return null;
    }
    if (approvalSettled) return { needed: false as const, via: 'approve' as const };
    return approvalCheck({
      standard: input.standard,
      marketplace,
      approvedForAll: approvedForAll.data === true,
      tokenOperator: typeof tokenOperator.data === 'string' ? tokenOperator.data : null,
    });
  }, [
    approvalSettled,
    approvedForAll.data,
    approvedForAll.isLoading,
    input.standard,
    marketplace,
    tokenOperator.data,
    tokenOperator.isLoading,
  ]);

  const balance = typeof balanceOf.data === 'bigint' ? balanceOf.data : null;
  const ownsToken =
    input.standard === 'erc721'
      ? Boolean(input.owner && typeof ownerOf.data === 'string' && ownerOf.data.toLowerCase() === input.owner.toLowerCase())
      : Boolean(balance !== null && balance > 0n);
  const ownershipLoading = input.standard === 'erc721' ? ownerOf.isLoading : balanceOf.isLoading;
  const ownershipError =
    input.tokenId === null
      ? 'Enter the minted token id.'
      : input.standard === 'erc721' && ownerOf.isError
        ? 'This token id was not found on the collection contract.'
        : input.standard === 'erc1155' && balanceOf.isError
          ? 'Could not read the ERC-1155 balance for this wallet.'
          : !ownershipLoading && input.owner && !ownsToken
            ? 'This wallet does not hold that token.'
            : null;

  const ensureChain = useCallback(async () => {
    if (!chain) throw new Error('This collection is on a chain Studio cannot submit from.');
    if (walletChainId !== chain) await switchChainAsync({ chainId: chain });
  }, [chain, switchChainAsync, walletChainId]);

  const approve = useCallback(async () => {
    if (!marketplace || !input.contractAddress || !approval?.needed || input.tokenId === null) return;
    setConfirmed(null);
    setPhase('wallet');
    setStatusMessage('Confirm the approval in your wallet.');
    setTxHash(null);
    try {
      await ensureChain();
      const hash = await approveWrite.writeContractAsync({
        address: input.contractAddress,
        abi: NFT_APPROVAL_ABI,
        functionName: approval.method,
        args:
          approval.method === 'approve'
            ? [marketplace, input.tokenId]
            : [marketplace, true],
        chainId: chain ?? undefined,
      });
      setTxHash(hash);
      setPhase('confirming');
      setStatusMessage('Approval submitted. Waiting for the chain.');
      if (!publicClient) throw new Error('No RPC client for this chain.');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Approval transaction reverted.');
      setApprovalSettledFor(approvalKey);
      await Promise.all([approvedForAll.refetch(), tokenOperator.refetch()]);
      setPhase('idle');
      setStatusMessage('Approval confirmed.');
    } catch (error) {
      const described = describeTxFailure(errorText(error));
      setPhase(described.phase);
      setStatusMessage(described.message);
    }
  }, [
    approval,
    approveWrite,
    approvedForAll,
    chain,
    ensureChain,
    input.contractAddress,
    approvalKey,
    input.tokenId,
    marketplace,
    publicClient,
    tokenOperator,
  ]);

  const createListing = useCallback(
    async (args: CreateListingCall, expected: { seller: `0x${string}`; tokenId: bigint; listingType: number }) => {
      if (!marketplace) return;
      setPhase('wallet');
      setStatusMessage('Confirm the listing in your wallet.');
      setTxHash(null);
      setConfirmed(null);
      try {
        await ensureChain();
        const hash = await createWrite.writeContractAsync({
          address: marketplace,
          abi: MARKETPLACE_ABI,
          functionName: 'createListing',
          args: [
            args.listingDetails,
            args.tokenDetails,
            args.deliveryFees,
            args.listingReceivers,
            args.enableReferrer,
            args.acceptOffers,
            args.data,
          ],
          chainId: chain ?? undefined,
        });
        setTxHash(hash);
        setPhase('confirming');
        setStatusMessage('Listing submitted. Waiting for the chain, then reading the listing back.');
        if (!publicClient) throw new Error('No RPC client for this chain.');
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error('Listing transaction reverted.');
        const listingId = listingIdFromCreateLogs(receipt.logs);
        if (!listingId) throw new Error('The transaction confirmed, but it did not include a CreateListing event.');
        const onchain = await publicClient.readContract({
          address: marketplace,
          abi: MARKETPLACE_ABI,
          functionName: 'getListing',
          args: [Number(listingId)],
        });
        const check = listingConfirmedOnChain(
          {
            seller: onchain.seller,
            tokenAddress: onchain.token.address_,
            tokenId: onchain.token.id,
            listingType: Number(onchain.details.type_),
            finalized: onchain.finalized,
          },
          {
            seller: expected.seller,
            tokenAddress: args.tokenDetails.address_,
            tokenId: expected.tokenId,
            listingType: expected.listingType,
          },
        );
        if (!check.ok) throw new Error(check.message);
        setConfirmed({ listingId, hash, marketplaceBps: Number(onchain.marketplaceBPS) });
        setPhase('confirmed');
        setStatusMessage(`Listing ${listingId} is on the auction house. Confirmed by reading getListing.`);
      } catch (error) {
        const described = describeTxFailure(errorText(error));
        setPhase(described.phase);
        setStatusMessage(described.message);
      }
    },
    [chain, createWrite, ensureChain, marketplace, publicClient],
  );

  return {
    marketplace: marketplace ?? null,
    marketplaceError: marketplaceQuery.error instanceof Error ? marketplaceQuery.error.message : null,
    marketplaceLoading: marketplaceQuery.isLoading,
    walletChainId,
    chainReady: chain !== null && walletChainId === chain,
    approval,
    approvalLoading: approvedForAll.isLoading || (input.standard === 'erc721' && tokenOperator.isLoading),
    ownsToken,
    ownershipLoading,
    ownershipError,
    balance,
    supportsLazyDelivery: lazyDelivery.data === true,
    lazyDeliveryLoading: lazyDelivery.isLoading,
    phase,
    statusMessage,
    txHash,
    confirmed,
    switchToCollectionChain: ensureChain,
    approve,
    createListing,
  };
}
