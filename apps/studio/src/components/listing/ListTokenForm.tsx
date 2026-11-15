'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ListingType,
  buildCreateListingArgs,
  describeTxFailure,
  listingSchedule,
  parseEthToWei,
  type ListingKind,
  type TokenStandard,
} from '@cryptoart/marketplace';
import { chainName } from '~/hooks/useCollections';
import { useCreateListing } from '~/hooks/useCreateListing';
import { txExplorerUrl } from '~/lib/txExplorer';
import type { MintListingHandoff } from '~/components/listing/handoff';

type Props = MintListingHandoff & {
  collectionId: string;
  collectionName: string;
  chainId: number;
  contractAddress: `0x${string}`;
  tokenStandard: TokenStandard;
  owner?: `0x${string}`;
};

const KINDS: { id: ListingKind; label: string }[] = [
  { id: 'auction', label: 'Auction' },
  { id: 'fixed', label: 'Fixed price' },
  { id: 'offers', label: 'Offers only' },
];

export function ListTokenForm({
  collectionId,
  collectionName,
  chainId,
  contractAddress,
  tokenStandard,
  owner,
  tokenId: initialTokenId,
  metadataUri,
  mintTxHash,
  quantity,
}: Props) {
  const [ready, setReady] = useState(false);
  const [tokenIdInput, setTokenIdInput] = useState(initialTokenId ?? '');
  const [kind, setKind] = useState<ListingKind>('auction');
  const [price, setPrice] = useState('');
  const [hours, setHours] = useState('');
  const [timing, setTiming] = useState<'' | 'first-sale' | 'scheduled'>('');
  const [startLocal, setStartLocal] = useState('');
  const [openEnded, setOpenEnded] = useState(false);
  const [increment, setIncrement] = useState('');
  const [extension, setExtension] = useState('');
  const [acceptOffers, setAcceptOffers] = useState(false);
  const [lotSize, setLotSize] = useState(quantity && /^\d+$/.test(quantity) ? quantity : '');
  const [perSale, setPerSale] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  const tokenId = /^\d+$/.test(tokenIdInput.trim()) ? BigInt(tokenIdInput.trim()) : null;
  const listing = useCreateListing({
    chainId,
    contractAddress,
    tokenId,
    standard: tokenStandard,
    owner,
  });

  const is1155 = tokenStandard === 'erc1155';
  const draft = ready ? buildDraft(Math.floor(Date.now() / 1000)) : null;
  const draftError = draft && !draft.ok ? draft.error : null;
  const canApprove = Boolean(listing.approval?.needed && listing.ownsToken && listing.chainReady);
  const canCreate = Boolean(
    draft?.ok &&
      listing.approval &&
      !listing.approval.needed &&
      listing.ownsToken &&
      listing.chainReady &&
      listing.phase !== 'wallet' &&
      listing.phase !== 'confirming',
  );

  async function onApprove() {
    setFormError(null);
    await listing.approve();
  }

  async function onCreate() {
    if (!owner || tokenId === null) return;
    const built = buildDraft(Math.floor(Date.now() / 1000));
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setFormError(null);
    await listing.createListing(built.args, {
      seller: owner,
      tokenId,
      listingType: built.args.listingDetails.type_,
    });
  }

  async function onSwitchChain() {
    setFormError(null);
    try {
      await listing.switchToCollectionChain();
    } catch (error) {
      setFormError(describeTxFailure(error instanceof Error ? error.message : 'Could not switch chain.').message);
    }
  }

  function buildDraft(now: number) {
    if (tokenId === null) return { ok: false as const, error: 'Enter the minted token id.' };
    const schedule = listingSchedule({
      kind,
      now,
      startsOnFirstSale: kind !== 'offers' && timing === 'first-sale',
      startTime: localInputToUnix(startLocal),
      durationSeconds: hoursToSeconds(hours),
      openEnded: kind === 'offers' && openEnded,
    });
    if (!schedule.ok) return schedule;
    const totals = quantities();
    if (!totals.ok) return totals;
    const wei = kind === 'offers' ? 0n : parseEthToWei(price);
    if (kind !== 'offers' && wei === null) return { ok: false as const, error: 'Enter a price in ETH. Type 0 if there is no reserve.' };
    const minIncrementBPS = kind === 'auction' ? parseWhole(increment) : 0;
    if (kind === 'auction' && minIncrementBPS === null) {
      return { ok: false as const, error: 'Enter a minimum bid increment in basis points. 500 is 5 percent. There is no platform default.' };
    }
    const extensionInterval = extension.trim() === '' ? 0 : parseWhole(extension);
    if (extensionInterval === null) return { ok: false as const, error: 'Extension has to be a whole number of seconds, or blank.' };
    if (kind === 'offers' && listing.lazyDeliveryLoading) {
      return { ok: false as const, error: 'Checking whether this collection can take offers.' };
    }
    if (kind === 'offers' && !listing.supportsLazyDelivery) {
      return {
        ok: false as const,
        error:
          'Offers-only listings require ILazyDelivery. This collection can be listed as an auction or a fixed price.',
      };
    }
    return buildCreateListingArgs({
      kind,
      tokenStandard,
      tokenAddress: contractAddress,
      tokenId,
      totalAvailable: totals.totalAvailable,
      totalPerSale: totals.totalPerSale,
      initialAmountWei: wei ?? 0n,
      now,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      minIncrementBPS: minIncrementBPS ?? 0,
      extensionInterval,
      acceptOffers: kind === 'auction' && acceptOffers,
      supportsLazyDelivery: listing.supportsLazyDelivery,
      metadataUri,
    });
  }

  function quantities(): { ok: true; totalAvailable: number; totalPerSale: number } | { ok: false; error: string } {
    if (!is1155) return { ok: true, totalAvailable: 1, totalPerSale: 1 };
    const available = parseWhole(lotSize);
    if (available === null || available < 1) return { ok: false, error: 'Enter how many tokens to list.' };
    if (listing.balance !== null && BigInt(available) > listing.balance) {
      return { ok: false, error: `You hold ${listing.balance.toString()} of this token.` };
    }
    if (kind === 'auction') return { ok: true, totalAvailable: available, totalPerSale: available };
    const each = kind === 'offers' ? 1 : parseWhole(perSale);
    if (each === null || each < 1) return { ok: false, error: 'Enter how many tokens a buyer receives per sale.' };
    return { ok: true, totalAvailable: available, totalPerSale: each };
  }

  const mintExplorer = mintTxHash ? txExplorerUrl(chainId, mintTxHash) : null;
  const statusHash = listing.txHash ? txExplorerUrl(chainId, listing.txHash) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-20 py-10">
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-muted">
          <Link href={`/collections/${collectionId}`} className="hover:text-foreground">
            {collectionName}
          </Link>
          <span>›</span>
          <span className="text-foreground">List</span>
        </nav>
        <h1 className="mt-4 text-3xl font-bold">List this token</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Approve the auction house, then create an auction, a fixed-price listing, or an offers-only listing.
          Studio confirms the result with a chain read. It does not wait for the indexer.
        </p>
      </div>

      <section className="grid gap-3 rounded-lg border border-border p-5 text-sm">
        <Row label="Collection" value={contractAddress} mono />
        <Row label="Chain" value={chainName(chainId)} />
        <Row label="Standard" value={is1155 ? 'ERC-1155' : 'ERC-721'} />
        <Row label="Metadata URI" value={metadataUri || 'Not passed. The token keeps the URI from its mint.'} />
        {mintTxHash && (
          <div className="flex justify-between gap-6 border-b border-border pb-3">
            <span className="text-muted">Mint transaction</span>
            {mintExplorer ? (
              <a className="max-w-[420px] truncate font-mono text-xs underline" href={mintExplorer} target="_blank" rel="noreferrer">
                {mintTxHash}
              </a>
            ) : (
              <span className="max-w-[420px] truncate font-mono text-xs">{mintTxHash}</span>
            )}
          </div>
        )}
      </section>

      <label className="block text-sm font-medium">
        Token id
        <input
          className="studio-input mt-2 font-mono"
          inputMode="numeric"
          value={tokenIdInput}
          onChange={(event) => setTokenIdInput(event.target.value)}
        />
      </label>

      {listing.marketplaceLoading && <p className="text-sm text-muted">Looking up the auction house…</p>}
      {listing.marketplaceError && <p className="text-sm text-error">{listing.marketplaceError}</p>}
      {listing.marketplace && (
        <p className="text-sm text-muted">
          Auction house <span className="font-mono text-xs text-foreground">{listing.marketplace}</span>
        </p>
      )}

      {!listing.chainReady && listing.marketplace && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm">Switch your wallet to {chainName(chainId)} before approving or listing.</p>
          <button type="button" className="studio-btn mt-4" onClick={() => void onSwitchChain()}>
            Switch chain
          </button>
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-medium">Listing type</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === kind ? 'studio-btn px-4 py-2 text-sm' : 'studio-btn-outline px-4 py-2 text-sm'}
              aria-pressed={item.id === kind}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === 'offers' && !listing.lazyDeliveryLoading && !listing.supportsLazyDelivery && (
        <p className="rounded-lg border border-border p-4 text-sm">
          This collection does not implement lazy delivery. The auction house only accepts offers-only listings for
          contracts that implement ILazyDelivery, and the studio factories do not add that. Auction and fixed price
          work for a token that is already minted.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {kind !== 'offers' && (
          <label className="block text-sm font-medium">
            Price in ETH
            <input className="studio-input mt-2" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Type 0 for no reserve" />
          </label>
        )}
        {kind === 'offers' && (
          <label className="block text-sm font-medium">
            Starts
            <input className="studio-input mt-2" type="datetime-local" value={startLocal} onChange={(event) => setStartLocal(event.target.value)} />
          </label>
        )}
        {(kind !== 'offers' || !openEnded) && (
          <label className="block text-sm font-medium">
            Duration in hours
            <input className="studio-input mt-2" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} />
          </label>
        )}
      </div>

      {kind !== 'offers' && (
        <label className="block text-sm font-medium">
          When it starts
          <select className="studio-input mt-2" value={timing} onChange={(event) => setTiming(event.target.value as '' | 'first-sale' | 'scheduled')}>
            <option value="">Choose</option>
            <option value="first-sale">On the first bid or purchase</option>
            <option value="scheduled">At a scheduled time</option>
          </select>
        </label>
      )}
      {kind !== 'offers' && timing === 'scheduled' && (
        <label className="block text-sm font-medium">
          Start
          <input className="studio-input mt-2" type="datetime-local" value={startLocal} onChange={(event) => setStartLocal(event.target.value)} />
        </label>
      )}
      {kind === 'offers' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={openEnded} onChange={(event) => setOpenEnded(event.target.checked)} />
          No end date
        </label>
      )}
      {kind === 'auction' && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">
            Minimum bid increase (basis points)
            <input className="studio-input mt-2" inputMode="numeric" value={increment} onChange={(event) => setIncrement(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Anti-snipe extension (seconds)
            <input className="studio-input mt-2" inputMode="numeric" value={extension} onChange={(event) => setExtension(event.target.value)} placeholder="Blank means none" />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={acceptOffers} onChange={(event) => setAcceptOffers(event.target.checked)} />
            Also accept offers before the first bid
          </label>
        </div>
      )}

      {is1155 && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">
            {kind === 'auction' ? 'Lot size' : 'Tokens to list'}
            <input className="studio-input mt-2" inputMode="numeric" value={lotSize} onChange={(event) => setLotSize(event.target.value)} />
          </label>
          {kind === 'fixed' && (
            <label className="block text-sm font-medium">
              Tokens per purchase
              <input className="studio-input mt-2" inputMode="numeric" value={perSale} onChange={(event) => setPerSale(event.target.value)} />
            </label>
          )}
          {listing.balance !== null && <p className="text-sm text-muted md:col-span-2">Wallet balance: {listing.balance.toString()}</p>}
        </div>
      )}

      <p className="text-sm text-muted">
        Studio collections do not call setMarketplaceApproval, and the factory does not pre-approve the auction house.
        ERC-721 asks you to approve this token. ERC-1155 asks you to approve the auction house as an operator.
      </p>
      <p className="text-sm text-muted">
        The auction house sets its fee inside createListing. Studio shows that fee after getListing confirms. It does not guess one before you sign.
      </p>

      {listing.ownershipLoading && <p className="text-sm text-muted">Checking ownership on {chainName(chainId)}…</p>}
      {listing.ownershipError && <p className="text-sm text-error">{listing.ownershipError}</p>}
      {listing.approvalLoading && <p className="text-sm text-muted">Checking approval…</p>}
      {draftError && listing.ownsToken && <p className="text-sm text-muted">{draftError}</p>}
      {formError && <p className="text-sm text-error">{formError}</p>}

      <div role="status" className="rounded-lg border border-border p-4 text-sm">
        <p>{listing.statusMessage ?? 'No transaction yet.'}</p>
        {listing.txHash && (
          statusHash ? (
            <a className="mt-2 block break-all font-mono text-xs underline" href={statusHash} target="_blank" rel="noreferrer">
              {listing.txHash}
            </a>
          ) : (
            <p className="mt-2 break-all font-mono text-xs">{listing.txHash}</p>
          )
        )}
      </div>

      {listing.confirmed && (
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="font-medium">Listing {listing.confirmed.listingId} confirmed</p>
          <p className="mt-2 text-muted">
            Auction house fee from the listing: {listing.confirmed.marketplaceBps} bps (
            {(listing.confirmed.marketplaceBps / 100).toFixed(2)}%).
          </p>
          <p className="mt-2 text-muted">Type code {kind === 'auction' ? ListingType.INDIVIDUAL_AUCTION : kind === 'fixed' ? ListingType.FIXED_PRICE : ListingType.OFFERS_ONLY}.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="studio-btn-outline disabled:opacity-40" disabled={!canApprove || listing.phase === 'wallet' || listing.phase === 'confirming'} onClick={() => void onApprove()}>
          {listing.approval && !listing.approval.needed ? 'Approval in place' : listing.approval?.method === 'setApprovalForAll' ? 'Approve operator' : 'Approve this token'}
        </button>
        <button type="button" className="studio-btn disabled:opacity-40" disabled={!canCreate} onClick={() => void onCreate()}>
          {listing.phase === 'wallet' || listing.phase === 'confirming' ? 'Waiting…' : 'Create listing'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-6 border-b border-border pb-3">
      <span className="text-muted">{label}</span>
      <span className={mono ? 'max-w-[520px] truncate font-mono text-xs' : 'text-right'}>{value}</span>
    </div>
  );
}

function localInputToUnix(value: string) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function hoursToSeconds(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours <= 0) return null;
  return hours * 3600;
}

function parseWhole(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value);
}
