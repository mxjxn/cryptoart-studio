import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
  ListingType,
  MARKETPLACE_ABI,
  canBid,
  canBuy,
  canCancel,
  canFinalize,
  cancelWarning,
  isNativeToken,
  listingPhase,
  marketplaceAddress,
  minBid,
  recoveryState,
} from '@cryptoart/marketplace';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';
import { fetchListingDetail } from '~/cryptoart/listingClient';
import { useSiweSession } from '~/cryptoart/useSiweSession';

const ZERO = '0x0000000000000000000000000000000000000000';

export function ListingPage({ chainHint }: { chainHint?: 'eth' | 'base' }) {
  const params = useParams();
  const listingId = params.listingId ?? '';
  const chainId = (chainHint === 'eth' ? 1 : 8453) as 1 | 8453;
  const { address, isConnected, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const session = useSiweSession();
  const listing = useQuery({
    queryKey: ['cryptoart-listing', chainId, listingId],
    queryFn: ({ signal }) => fetchListingDetail(chainId, listingId, signal),
    enabled: Boolean(listingId),
    retry: false,
  });
  const marketplace = marketplaceAddress(chainId) as `0x${string}`;
  const onchain = useReadContract({
    address: marketplace,
    abi: MARKETPLACE_ABI,
    functionName: 'getListing',
    args: [Number(listingId)],
    chainId,
    query: { enabled: Boolean(listingId) },
  });
  const price = useReadContract({
    address: marketplace,
    abi: MARKETPLACE_ABI,
    functionName: 'getListingCurrentPrice',
    args: [Number(listingId)],
    chainId,
    query: { enabled: Boolean(listingId) },
  });
  const isAdmin = useReadContract({
    address: marketplace,
    abi: MARKETPLACE_ABI,
    functionName: 'isAdmin',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(address) },
  });
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const [bidInput, setBidInput] = useState('');
  const [holdback, setHoldback] = useState('0');
  const snapshot = useMemo(() => {
    const contract = onchain.data;
    if (contract) {
      return {
        listingType: Number(contract.details.type_) as ListingType,
        seller: contract.seller,
        finalized: Boolean(contract.finalized),
        startTime: Number(contract.details.startTime),
        endTime: Number(contract.details.endTime),
        totalAvailable: Number(contract.details.totalAvailable),
        totalSold: Number(contract.totalSold),
        bidAmount: contract.bid.amount,
        bidder: contract.bid.bidder,
        initialAmount: contract.details.initialAmount,
        minIncrementBPS: Number(contract.details.minIncrementBPS),
        erc20: contract.details.erc20,
      };
    }
    const row = listing.data;
    if (!row) return null;
    const type = row.listingType === 'FIXED_PRICE' ? ListingType.FIXED_PRICE
      : row.listingType === 'DYNAMIC_PRICE' ? ListingType.DYNAMIC_PRICE
      : row.listingType === 'OFFERS_ONLY' ? ListingType.OFFERS_ONLY
      : ListingType.INDIVIDUAL_AUCTION;
    return {
      listingType: type,
      seller: row.seller,
      finalized: Boolean(row.finalized),
      startTime: Number(row.startTime ?? 0),
      endTime: Number(row.endTime ?? 0),
      totalAvailable: Number(row.totalAvailable ?? 1),
      totalSold: Number(row.totalSold ?? 0),
      bidAmount: BigInt(row.highestBid?.amount ?? '0'),
      bidder: row.highestBid?.bidder ?? ZERO,
      initialAmount: BigInt(row.initialAmount),
      minIncrementBPS: row.minIncrementBPS ?? 500,
      erc20: row.erc20 ?? ZERO,
    };
  }, [listing.data, onchain.data]);

  const native = snapshot ? isNativeToken(snapshot.erc20) : true;
  const currentPrice = price.data ?? snapshot?.bidAmount ?? snapshot?.initialAmount ?? 0n;
  const phase = snapshot ? listingPhase(snapshot) : 'scheduled';
  const recovery = recoveryState({
    hash: write.data,
    isPending: write.isPending,
    isConfirming: receipt.isPending || receipt.isFetching,
    isSuccess: receipt.isSuccess,
    isError: write.isError || receipt.isError,
    errorMessage: write.error?.message || receipt.error?.message,
  });

  async function ensureChain() {
    if (chain?.id !== chainId) await switchChainAsync({ chainId });
  }

  async function submit(kind: 'bid' | 'buy' | 'cancel' | 'finalize') {
    if (!snapshot) return;
    await ensureChain();
    const id = Number(listingId);
    if (kind === 'bid') {
      const amount = bidInput ? parseEther(bidInput) : minBid(snapshot);
      await write.writeContractAsync({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'bid',
        args: [id, false],
        chainId,
        value: native ? amount : 0n,
      });
      return;
    }
    if (kind === 'buy') {
      await write.writeContractAsync({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'purchase',
        args: [id, 1],
        chainId,
        value: native ? currentPrice : 0n,
      });
      return;
    }
    if (kind === 'cancel') {
      await write.writeContractAsync({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'cancel',
        args: [id, Number(holdback) || 0],
        chainId,
      });
      return;
    }
    await write.writeContractAsync({
      address: marketplace,
      abi: MARKETPLACE_ABI,
      functionName: 'finalize',
      args: [id],
      chainId,
    });
  }

  const data = listing.data;
  const caller = address ?? '';
  const admin = Boolean(isAdmin.data);

  return <main className="cryptoart-shell min-h-screen bg-black text-white">
    <CryptoartHeader active="market" />
    <section className="px-4 py-10 sm:px-8 lg:px-12">
      {listing.isPending && <p role="status" className="cryptoart-mono text-xs uppercase">Loading listing…</p>}
      {listing.error && <p role="alert" className="border border-white p-4">{listing.error.message}</p>}
      {data && snapshot && <>
        <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em] text-neutral-400">{chainId === 1 ? 'Ethereum' : 'Base'} · Listing {listingId} · {phase}</p>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div className="flex aspect-square items-center bg-[#111] p-4">
            {data.thumbnailUrl || data.image
              ? <img src={data.thumbnailUrl || data.image} alt={data.title || `Listing ${listingId}`} className="max-h-full w-full object-contain" />
              : <span className="cryptoart-mono m-auto text-[10px] uppercase text-neutral-500">Preview resolving</span>}
          </div>
          <div>
            <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-medium leading-[0.85] tracking-[-0.05em]">{data.title || `Listing #${listingId}`}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-300">{data.description}</p>
            <p className="cryptoart-mono mt-6 text-sm">{native ? formatEther(currentPrice) : currentPrice.toString()} {native ? 'ETH' : data.erc20TokenInfo?.symbol}</p>
            <p className="cryptoart-mono mt-2 text-[10px] uppercase text-neutral-500">{data.bidCount ?? 0} bids · seller {snapshot.seller.slice(0, 6)}…{snapshot.seller.slice(-4)}</p>
            {!isConnected && <p className="mt-6 text-sm">Connect a wallet to bid, buy, cancel, or settle.</p>}
            {isConnected && chain?.id !== chainId && <p className="mt-6 text-sm">This listing is on {chainId === 1 ? 'Ethereum' : 'Base'}. Switch networks before sending a transaction.</p>}
            {recovery.phase !== 'idle' && <p role="status" className="mt-6 border border-white p-4 text-sm">{recovery.message}{recovery.hash ? ` ${recovery.hash.slice(0, 10)}…` : ''}</p>}
            {recovery.phase === 'failed' && <p className="mt-3 text-sm">Retry the same action to replace a stuck request. Confirm or reject any pending wallet prompt first.</p>}
            <div className="mt-8 space-y-3">
              {canBid(snapshot) && <div className="flex gap-2">
                <input aria-label="Bid amount in ETH" value={bidInput} onChange={(event) => setBidInput(event.target.value)} placeholder={formatEther(minBid(snapshot))} className="flex-1 border border-white bg-black px-3 py-3 text-sm" />
                <button type="button" className="border border-white px-4 py-3 text-sm hover:bg-white hover:text-black" disabled={!isConnected || write.isPending} onClick={() => void submit('bid')}>Bid</button>
              </div>}
              {canBuy(snapshot) && <button type="button" className="w-full border border-white px-4 py-3 text-sm hover:bg-white hover:text-black" disabled={!isConnected || write.isPending} onClick={() => void submit('buy')}>Buy now</button>}
              {canCancel(snapshot, caller, admin) && <>
                <p className="text-xs text-neutral-400">{cancelWarning(snapshot)}</p>
                {admin && <input aria-label="Cancel holdback in basis points" value={holdback} onChange={(event) => setHoldback(event.target.value)} className="w-full border border-white bg-black px-3 py-2 text-sm" />}
                <button type="button" className="w-full border border-[#f5b0d3] px-4 py-3 text-sm text-[#f5b0d3]" disabled={!isConnected || write.isPending} onClick={() => void submit('cancel')}>Cancel listing</button>
              </>}
              {canFinalize(snapshot, caller) && <button type="button" className="w-full bg-[#dcf54c] px-4 py-3 text-sm text-black" disabled={!isConnected || write.isPending} onClick={() => void submit('finalize')}>Settle / finalize</button>}
            </div>
            {session.session.data?.capabilities.publish && <p className="cryptoart-mono mt-6 text-[10px] uppercase text-neutral-500">Signed in as editor/owner for exhibition publishing.</p>}
          </div>
        </div>
      </>}
    </section>
  </main>;
}
