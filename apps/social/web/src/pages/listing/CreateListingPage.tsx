import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { parseEther, zeroAddress } from 'viem';
import {
  ListingType,
  MARKETPLACE_ABI,
  NFT_APPROVAL_ABI,
  listingPath,
  marketplaceAddress,
  recoveryState,
} from '@cryptoart/marketplace';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';

export function CreateListingPage() {
  const [params] = useSearchParams();
  const { address, isConnected, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const chainId = (Number(params.get('chainId') || '1') === 8453 ? 8453 : 1) as 1 | 8453;
  const [contractAddress, setContractAddress] = useState(params.get('tokenAddress') ?? '');
  const [tokenId, setTokenId] = useState(params.get('tokenId') ?? '');
  const [price, setPrice] = useState('0.05');
  const [durationHours, setDurationHours] = useState('24');
  const [kind, setKind] = useState<'auction' | 'fixed'>('auction');
  const [standard, setStandard] = useState<'ERC721' | 'ERC1155'>('ERC721');
  const marketplace = marketplaceAddress(chainId) as `0x${string}`;
  const approved = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: NFT_APPROVAL_ABI,
    functionName: 'isApprovedForAll',
    args: address && contractAddress ? [address, marketplace] : undefined,
    chainId,
    query: { enabled: Boolean(address && contractAddress) },
  });
  const approve = useWriteContract();
  const create = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const createReceipt = useWaitForTransactionReceipt({ hash: create.data });
  const recovery = recoveryState({
    hash: create.data ?? approve.data,
    isPending: create.isPending || approve.isPending,
    isConfirming: createReceipt.isPending || approveReceipt.isPending,
    isSuccess: createReceipt.isSuccess,
    isError: create.isError || approve.isError,
    errorMessage: create.error?.message || approve.error?.message,
  });
  const startTime = useMemo(() => Math.floor(Date.now() / 1000), []);

  async function ensureChain() {
    if (chain?.id !== chainId) await switchChainAsync({ chainId });
  }

  async function onApprove() {
    await ensureChain();
    await approve.writeContractAsync({
      address: contractAddress as `0x${string}`,
      abi: NFT_APPROVAL_ABI,
      functionName: 'setApprovalForAll',
      args: [marketplace, true],
      chainId,
    });
  }

  async function onCreate() {
    await ensureChain();
    const hours = Number(durationHours) || 24;
    const listingType = kind === 'auction' ? ListingType.INDIVIDUAL_AUCTION : ListingType.FIXED_PRICE;
    await create.writeContractAsync({
      address: marketplace,
      abi: MARKETPLACE_ABI,
      functionName: 'createListing',
      chainId,
      args: [
        {
          initialAmount: parseEther(price || '0'),
          type_: listingType,
          totalAvailable: 1,
          totalPerSale: 1,
          extensionInterval: kind === 'auction' ? 900 : 0,
          minIncrementBPS: kind === 'auction' ? 500 : 0,
          erc20: zeroAddress,
          identityVerifier: zeroAddress,
          startTime,
          endTime: startTime + hours * 3600,
        },
        {
          id: BigInt(tokenId || '0'),
          address_: contractAddress as `0x${string}`,
          spec: standard === 'ERC1155' ? 2 : 1,
          lazy: false,
        },
        { deliverBPS: 0, deliverFixed: 0n },
        [],
        false,
        false,
        '0x',
      ],
    });
  }

  return <main className="cryptoart-shell min-h-screen bg-black text-white">
    <CryptoartHeader active="market" />
    <section className="mx-auto max-w-xl px-4 py-12 sm:px-8">
      <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em] text-neutral-400">Quick listing · {chainId === 1 ? 'Ethereum' : 'Base'}</p>
      <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em]">Create listing</h1>
      <p className="mt-4 text-sm leading-6 text-neutral-300">Approve the marketplace, then create an auction or fixed-price listing. Advanced options stay in Studio.</p>
      {!isConnected && <p className="mt-6 text-sm">Connect a wallet first.</p>}
      <div className="mt-8 space-y-3">
        <label className="block text-xs uppercase">Contract<input className="mt-1 w-full border border-white bg-black px-3 py-2 font-mono text-sm" value={contractAddress} onChange={(event) => setContractAddress(event.target.value)} /></label>
        <label className="block text-xs uppercase">Token ID<input className="mt-1 w-full border border-white bg-black px-3 py-2 font-mono text-sm" value={tokenId} onChange={(event) => setTokenId(event.target.value)} /></label>
        <label className="block text-xs uppercase">Price in ETH<input className="mt-1 w-full border border-white bg-black px-3 py-2 text-sm" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        <label className="block text-xs uppercase">Duration (hours)<input className="mt-1 w-full border border-white bg-black px-3 py-2 text-sm" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} /></label>
        <div className="flex gap-2">
          <button type="button" className={`flex-1 border px-3 py-2 ${kind === 'auction' ? 'bg-white text-black' : ''}`} onClick={() => setKind('auction')}>Auction</button>
          <button type="button" className={`flex-1 border px-3 py-2 ${kind === 'fixed' ? 'bg-white text-black' : ''}`} onClick={() => setKind('fixed')}>Fixed price</button>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`flex-1 border px-3 py-2 ${standard === 'ERC721' ? 'bg-white text-black' : ''}`} onClick={() => setStandard('ERC721')}>ERC-721</button>
          <button type="button" className={`flex-1 border px-3 py-2 ${standard === 'ERC1155' ? 'bg-white text-black' : ''}`} onClick={() => setStandard('ERC1155')}>ERC-1155</button>
        </div>
        {recovery.phase !== 'idle' && <p role="status" className="border border-white p-3 text-sm">{recovery.message}</p>}
        <button type="button" className="w-full border border-white px-4 py-3" disabled={!isConnected || Boolean(approved.data) || approve.isPending} onClick={() => void onApprove()}>
          {approved.data ? 'Marketplace approved' : 'Approve marketplace'}
        </button>
        <button type="button" className="w-full bg-[#dcf54c] px-4 py-3 text-black" disabled={!isConnected || !approved.data || create.isPending} onClick={() => void onCreate()}>
          Create listing
        </button>
        {createReceipt.isSuccess && <p className="text-sm">Listing submitted. Open the transaction in your wallet explorer, then visit {listingPath(chainId, '…')} once the subgraph indexes it.</p>}
      </div>
    </section>
  </main>;
}
