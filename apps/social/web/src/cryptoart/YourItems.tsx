import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import type { OwnedAsset, OwnedAssetPage, SupportedChainId } from './domain';
import { WalletIdentityButton } from './WalletIdentityButton';

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
const assetKey = (item: OwnedAsset) =>
  `${item.id.chainId}:${item.id.contractAddress}:${item.id.tokenId}`;
const cacheKey = (address: string) =>
  `cryptoart:owned-assets:v1:${address.toLowerCase()}`;

function readCache(address: string): OwnedAsset[] {
  try {
    return JSON.parse(
      sessionStorage.getItem(cacheKey(address)) ?? '[]',
    ) as OwnedAsset[];
  } catch {
    return [];
  }
}
function writeCache(address: string, items: OwnedAsset[]) {
  try {
    sessionStorage.setItem(cacheKey(address), JSON.stringify(items));
  } catch {
    /* storage can be unavailable */
  }
}

async function getOwnedAssets(address: string): Promise<OwnedAsset[]> {
  const pages = await Promise.allSettled(
    ([1, 8453] as SupportedChainId[]).map(async (chainId) => {
      const response = await fetch(
        `/api/cryptoart/assets/owned?owner=${address}&chainId=${chainId}`,
      );
      const body = (await response.json()) as
        | OwnedAssetPage
        | { error: string };
      if (!response.ok || 'error' in body)
        throw new Error('error' in body ? body.error : 'NFT discovery failed.');
      return body.items;
    }),
  );
  const items = pages.flatMap((page) =>
    page.status === 'fulfilled' ? page.value : [],
  );
  if (!items.length && pages.every((page) => page.status === 'rejected'))
    throw (pages[0] as PromiseRejectedResult).reason;
  const unique = [
    ...new Map(items.map((item) => [assetKey(item), item])).values(),
  ];
  writeCache(address, unique);
  return unique;
}

function OwnedItemCard({ item }: { item: OwnedAsset }) {
  const artworkPath = `/artwork/${item.id.chainId}/${item.id.contractAddress}/${item.id.tokenId}`;
  const createUrl = `https://cryptoart.social/create?chainId=${item.id.chainId}&tokenAddress=${item.id.contractAddress}&tokenId=${item.id.tokenId}`;
  return (
    <article className="border border-black bg-[#f8f5eb]">
      <div className="aspect-square bg-black p-2">
        {item.media.previewUrl ? (
          <img
            src={item.media.previewUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs uppercase tracking-widest text-white">
            Metadata pending
            <br />
            Token #{item.id.tokenId}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-base font-medium">{item.title}</p>
        <p className="cryptoart-mono mt-1 text-[9px] uppercase text-neutral-500">
          {item.id.chainId === 1 ? 'Ethereum' : 'Base'} · {item.standard}
          {item.balance !== '1' ? ` · ${item.balance} owned` : ''}
        </p>
        <div className="cryptoart-mono mt-4 grid grid-cols-2 gap-px border border-black bg-black text-center text-[9px] uppercase">
          <a
            href={`/compose?text=${encodeURIComponent(
              `Looking at ${item.title}`,
            )}&embed=${encodeURIComponent(location.origin + artworkPath)}`}
            className="bg-white px-2 py-2 hover:bg-[#dcf54c]"
          >
            Cast
          </a>
          <a
            href={artworkPath}
            className="bg-white px-2 py-2 hover:bg-[#dcf54c]"
          >
            Discuss
          </a>
          <a href={createUrl} className="bg-white px-2 py-2 hover:bg-[#dcf54c]">
            List
          </a>
          <a
            href={`https://cryptoart.studio/?chainId=${item.id.chainId}&contract=${item.id.contractAddress}&tokenId=${item.id.tokenId}`}
            className="bg-white px-2 py-2 hover:bg-[#dcf54c]"
          >
            Studio
          </a>
        </div>
      </div>
    </article>
  );
}

export function YourItems() {
  const { address, chain, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [contract, setContract] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [importChain, setImportChain] = useState<SupportedChainId>(8453);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const cached = useMemo(() => (address ? readCache(address) : []), [address]);
  const owned = useQuery({
    queryKey: ['cryptoart-owned-assets', address],
    queryFn: () => getOwnedAssets(address!),
    enabled: Boolean(address),
    initialData: cached.length ? cached : undefined,
    staleTime: 60_000,
    retry: false,
  });

  async function importItem(event: FormEvent) {
    event.preventDefault();
    if (!address) return;
    setImporting(true);
    setImportError('');
    try {
      const params = new URLSearchParams({
        owner: address,
        chainId: String(importChain),
        contract,
        tokenId,
      });
      const response = await fetch(`/api/cryptoart/assets/import?${params}`);
      const body = (await response.json()) as OwnedAsset | { error: string };
      if (!response.ok || 'error' in body)
        throw new Error('error' in body ? body.error : 'Import failed.');
      const items = [
        ...new Map(
          [body, ...(owned.data ?? [])].map((item) => [assetKey(item), item]),
        ).values(),
      ];
      writeCache(address, items);
      queryClient.setQueryData(['cryptoart-owned-assets', address], items);
      setContract('');
      setTokenId('');
      setShowImport(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section
      aria-labelledby="your-items"
      className="border-b border-white bg-[#f5b0d3] text-black"
    >
      <div className="grid md:grid-cols-2">
        <div className="border-b border-black p-8 md:border-b-0 md:border-r lg:p-12">
          <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em]">
            Personal collection
          </p>
          <h2
            id="your-items"
            className="mt-2 text-[clamp(3rem,8vw,6rem)] font-medium leading-[0.82] tracking-[-0.05em]"
          >
            Your items
          </h2>
        </div>
        <div className="flex flex-col justify-between gap-8 p-8 lg:p-12">
          {isConnected && address ? (
            <>
              <div>
                <p className="cryptoart-mono text-[10px] uppercase tracking-[0.1em]">
                  Wallet connected · {chain?.name ?? 'network pending'}
                </p>
                <p className="mt-3 text-2xl font-medium">
                  {shortAddress(address)}
                </p>
                <p className="mt-4 max-w-xl text-sm leading-6">
                  Your cached works appear first. Cryptoart checks Ethereum and
                  Base in the background; missing work can be verified and
                  imported directly.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowImport((value) => !value)}
                  className="cryptoart-mono border border-black bg-black px-5 py-3 text-[10px] uppercase tracking-[0.1em] text-white"
                >
                  Import a work
                </button>
                <a
                  href="https://cryptoart.studio"
                  className="cryptoart-mono border border-black px-5 py-3 text-[10px] uppercase tracking-[0.1em]"
                >
                  Open Studio
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="max-w-xl text-lg leading-7">
                Connect your wallet to share work, start a conversation, create
                a listing, or place an item in one of your galleries.
              </p>
              <div className="cryptoart-mono w-fit border border-black bg-black px-6 py-3 text-xs uppercase tracking-[0.1em] text-white">
                <WalletIdentityButton />
              </div>
            </>
          )}
        </div>
      </div>
      {address && showImport && (
        <form
          onSubmit={importItem}
          className="grid gap-3 border-t border-black bg-[#dcf54c] p-5 sm:grid-cols-[140px_1fr_140px_auto] sm:p-8"
        >
          <select
            aria-label="Chain"
            value={importChain}
            onChange={(event) =>
              setImportChain(Number(event.target.value) as SupportedChainId)
            }
            className="border border-black bg-white px-3 py-3 text-sm"
          >
            <option value="8453">Base</option>
            <option value="1">Ethereum</option>
          </select>
          <input
            aria-label="Contract address"
            required
            value={contract}
            onChange={(event) => setContract(event.target.value)}
            placeholder="0x contract address"
            className="border border-black bg-white px-3 py-3 text-sm"
          />
          <input
            aria-label="Token ID"
            required
            inputMode="numeric"
            value={tokenId}
            onChange={(event) => setTokenId(event.target.value)}
            placeholder="Token ID"
            className="border border-black bg-white px-3 py-3 text-sm"
          />
          <button
            disabled={importing}
            className="border border-black bg-black px-5 py-3 text-xs uppercase text-white disabled:opacity-50"
          >
            {importing ? 'Checking…' : 'Verify + add'}
          </button>
          {importError && (
            <p role="alert" className="text-sm sm:col-span-4">
              {importError}
            </p>
          )}
        </form>
      )}
      {address && (
        <div className="border-t border-black bg-white p-4 sm:p-8">
          {owned.isPending && (
            <p
              role="status"
              className="cryptoart-mono py-10 text-center text-xs uppercase"
            >
              Finding work on Ethereum and Base…
            </p>
          )}
          {owned.error && (
            <p
              role="alert"
              className="border border-black bg-[#f5b0d3] p-4 text-sm"
            >
              {owned.error.message} You can still import a known work above.
            </p>
          )}
          {owned.data?.length === 0 && !owned.isFetching && (
            <p className="cryptoart-mono py-10 text-center text-xs uppercase">
              No works found yet · import one if a provider missed it
            </p>
          )}
          {owned.data && owned.data.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {owned.data.map((item) => (
                <OwnedItemCard key={assetKey(item)} item={item} />
              ))}
            </div>
          )}
          {owned.isFetching && owned.data?.length ? (
            <p className="cryptoart-mono mt-5 text-[9px] uppercase">
              Checking for newer wallet items…
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
