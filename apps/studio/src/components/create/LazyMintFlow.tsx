'use client';

import { useCallback, useMemo, useState } from 'react';
import { parseEther, type Address, type Hex } from 'viem';
import { useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { ArtPreview } from '~/components/flows/ArtPreview';
import { FlowDetails, FlowField, FlowShell, ReviewRow } from '~/components/flows/FlowShell';
import { TxStateBanner } from '~/components/flows/TxStateBanner';
import { ValidationList } from '~/components/flows/ValidationList';
import { WalletGate, WrongChainNotice } from '~/components/flows/WalletGate';
import type { FlowMode, PreviewScenario, TxPhase } from '~/components/flows/types';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import {
  TokenSpec,
  encodeCreateLazyListing,
  isSupportedStudioChain,
  studioMarketplaceAddress,
} from '~/lib/adapters/marketplace';
import {
  encodePrepareLazyToken,
  encodeSetListingBaseURI,
  encodeSetMarketplaceApproval,
  ensureTrailingSlash,
} from '~/lib/adapters/such-collection';

const STEPS_721 = ['Approve', 'List', 'Artwork'];
const STEPS_1155 = ['Approve', 'Prepare', 'List'];

export type LazyMintFlowProps = {
  mode?: FlowMode;
  previewScenario?: PreviewScenario;
  collectionId: string;
  collectionName: string;
  collectionAddress: Address;
  chainId: number;
  tokenStandard?: 'erc721' | 'erc1155';
  marketplaceApproved?: boolean;
  previewImage?: string | null;
  previewAspectRatio?: string;
};

type Step = 1 | 2 | 3;

function phaseFromScenario(scenario?: PreviewScenario): TxPhase {
  switch (scenario) {
    case 'wallet_missing':
      return 'wallet_missing';
    case 'wrong_chain':
      return 'wrong_chain';
    case 'pending':
      return 'pending';
    case 'confirmed':
      return 'confirmed';
    case 'failed':
      return 'failed';
    case 'insufficient_funds':
      return 'insufficient_funds';
    case 'validation_error':
      return 'validating';
    case 'empty':
      return 'empty';
    default:
      return 'idle';
  }
}

function looksLikeUri(value: string) {
  return /^(ar|ipfs|https):\/\//i.test(value.trim());
}

export function LazyMintFlow({
  mode = 'live',
  previewScenario = 'default',
  collectionId,
  collectionName,
  collectionAddress,
  chainId: collectionChainId,
  tokenStandard = 'erc721',
  marketplaceApproved = false,
  previewImage,
  previewAspectRatio = '3 / 4',
}: LazyMintFlowProps) {
  const isPreview = mode === 'preview';
  const { isConnected, chainId } = useActiveWallet();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { isLoading: confirming, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const is1155 = tokenStandard === 'erc1155';
  const steps = is1155 ? STEPS_1155 : STEPS_721;
  const showEmptyArt = previewScenario === 'empty';

  const [step, setStep] = useState<Step>(marketplaceApproved || isPreview ? 2 : 1);
  const [approved, setApproved] = useState(marketplaceApproved);
  const [listingId, setListingId] = useState<number | null>(isPreview && !showEmptyArt ? 1042 : null);
  const [preparedTokenId, setPreparedTokenId] = useState<string>(isPreview ? '7' : '');
  const [priceEth, setPriceEth] = useState('0.05');
  const [totalAvailable, setTotalAvailable] = useState('10');
  const [listingBaseURI, setListingBaseURI] = useState(
    isPreview && !showEmptyArt ? 'ar://QmPreviewManifest' : '',
  );
  const [tokenURI1155, setTokenURI1155] = useState(isPreview ? 'ar://token-meta' : '');
  const [maxSupply, setMaxSupply] = useState('100');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(previewScenario === 'confirmed');

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (previewScenario === 'validation_error') {
      errs.push('Add a price greater than zero.');
      errs.push('Add a link to your artwork folder.');
      return errs;
    }
    if (step === 2 && !is1155) {
      if (!priceEth || Number(priceEth) <= 0) errs.push('Add a price greater than zero.');
      if (!totalAvailable || Number(totalAvailable) < 1) {
        errs.push('Say how many pieces are available (at least 1).');
      }
    }
    if (step === 2 && is1155) {
      if (!tokenURI1155.trim()) errs.push('Add a link to this edition’s artwork.');
      else if (!looksLikeUri(tokenURI1155)) errs.push('Use an ar://, ipfs://, or https:// link.');
      if (!maxSupply || Number(maxSupply) < 0) errs.push('Max supply must be 0 (open) or greater.');
    }
    if (step === 3 && !is1155) {
      if (!listingBaseURI.trim()) errs.push('Attach a link to your artwork folder.');
      else if (!looksLikeUri(listingBaseURI)) errs.push('Use an ar://, ipfs://, or https:// link.');
      if (listingId == null) errs.push('Create the listing before attaching artwork.');
    }
    if (step === 3 && is1155) {
      if (!priceEth || Number(priceEth) <= 0) errs.push('Add a price greater than zero.');
      if (!preparedTokenId) errs.push('Prepare the edition first.');
    }
    return errs;
  }, [
    step,
    is1155,
    priceEth,
    totalAvailable,
    listingBaseURI,
    listingId,
    tokenURI1155,
    maxSupply,
    preparedTokenId,
    previewScenario,
  ]);

  const livePhase: TxPhase = (() => {
    if (!isConnected) return 'wallet_missing';
    if (chainId !== collectionChainId) return 'wrong_chain';
    if (localError?.toLowerCase().includes('insufficient')) return 'insufficient_funds';
    if (localError || isError) return 'failed';
    if (done || isSuccess) return 'confirmed';
    if (busy || confirming) return txHash ? 'pending' : 'awaiting_signature';
    return 'idle';
  })();

  const phase = isPreview ? phaseFromScenario(previewScenario) : livePhase;
  const showWalletGate = phase === 'wallet_missing';
  const showWrongChain = phase === 'wrong_chain';

  const marketplace = useMemo(() => {
    try {
      return studioMarketplaceAddress(collectionChainId);
    } catch {
      return null;
    }
  }, [collectionChainId]);

  const runTx = useCallback(
    async (to: Address, data: Hex, onSuccess?: () => void) => {
      setBusy(true);
      setLocalError(null);
      try {
        await sendTransactionAsync({ to, data });
        onSuccess?.();
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Something went wrong with the transaction.');
      } finally {
        setBusy(false);
      }
    },
    [sendTransactionAsync],
  );

  const handleApprove = useCallback(async () => {
    if (!marketplace || !isSupportedStudioChain(collectionChainId)) return;
    if (isPreview) {
      setApproved(true);
      setStep(2);
      return;
    }
    await runTx(collectionAddress, encodeSetMarketplaceApproval(marketplace, true), () => {
      setApproved(true);
      setStep(2);
    });
  }, [marketplace, collectionChainId, isPreview, runTx, collectionAddress]);

  const handleCreateListing = useCallback(async () => {
    if (!marketplace) return;
    if (validationErrors.length) return;
    if (isPreview) {
      setListingId(1042);
      setStep(3);
      if (is1155) setDone(true);
      return;
    }
    const data = encodeCreateLazyListing({
      priceWei: parseEther(priceEth || '0'),
      totalAvailable: Number(totalAvailable) || 1,
      collection: collectionAddress,
      tokenSpec: is1155 ? TokenSpec.ERC1155 : TokenSpec.ERC721,
      tokenId: is1155 ? BigInt(preparedTokenId || '0') : 0n,
    });
    setBusy(true);
    setLocalError(null);
    try {
      await sendTransactionAsync({ to: marketplace, data });
      if (listingId == null) setListingId(0);
      setStep(3);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Couldn’t create the listing.');
    } finally {
      setBusy(false);
    }
  }, [
    marketplace,
    validationErrors,
    isPreview,
    is1155,
    priceEth,
    totalAvailable,
    collectionAddress,
    preparedTokenId,
    sendTransactionAsync,
    listingId,
  ]);

  const handlePrepare1155 = useCallback(async () => {
    if (validationErrors.length) return;
    if (isPreview) {
      setPreparedTokenId('7');
      setStep(3);
      return;
    }
    await runTx(
      collectionAddress,
      encodePrepareLazyToken(tokenURI1155, BigInt(maxSupply || '0')),
      () => {
        setPreparedTokenId('pending');
        setStep(3);
      },
    );
  }, [validationErrors, isPreview, runTx, collectionAddress, tokenURI1155, maxSupply]);

  const handleSetMetadata = useCallback(async () => {
    if (!marketplace || listingId == null || validationErrors.length) return;
    if (isPreview) {
      setDone(true);
      return;
    }
    await runTx(
      collectionAddress,
      encodeSetListingBaseURI(marketplace, listingId, ensureTrailingSlash(listingBaseURI.trim())),
      () => setDone(true),
    );
  }, [
    marketplace,
    listingId,
    validationErrors,
    isPreview,
    runTx,
    collectionAddress,
    listingBaseURI,
  ]);

  const aside = (
    <ArtPreview
      src={showEmptyArt ? null : previewImage}
      aspectRatio={previewAspectRatio}
      caption={showEmptyArt ? undefined : collectionName}
      subtitle={
        showEmptyArt
          ? undefined
          : listingId != null
            ? `Listing #${listingId}`
            : is1155
              ? 'Edition listing'
              : 'Ready to list'
      }
      emptyTitle="Artwork will show here"
      emptyHint="Once you attach your piece, it appears at its natural shape — never cropped."
    />
  );

  if (showWalletGate) {
    return (
      <FlowShell
        title="List a lazy mint"
        subtitle="Approve the auction house, create your listing, then attach your artwork — all in Studio."
        breadcrumb={{
          href: `/collections/${collectionId}`,
          label: collectionName,
          current: 'Lazy mint',
        }}
        steps={steps}
        currentStep={step}
      >
        <WalletGate description="Connect the wallet that owns this collection so you can approve and list." />
      </FlowShell>
    );
  }

  return (
    <FlowShell
      title="List a lazy mint"
      subtitle={
        is1155
          ? 'Approve the auction house once, prepare the edition, then create your listing here in Studio.'
          : 'Approve the auction house, create your listing, then attach your artwork. Collectors mint when they buy.'
      }
      breadcrumb={{
        href: `/collections/${collectionId}`,
        label: collectionName,
        current: 'Lazy mint',
      }}
      steps={steps}
      currentStep={step}
      aside={aside}
      footer={
        <>
          <button
            type="button"
            className={step === 1 ? 'invisible' : 'text-[15px] text-muted hover:text-foreground'}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          >
            ← Back
          </button>
          {step === 1 && (
            <button type="button" className="studio-btn" disabled={busy} onClick={() => void handleApprove()}>
              {approved ? 'Approved' : busy ? 'Confirm in wallet…' : 'Approve the auction house'}
            </button>
          )}
          {step === 2 && !is1155 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || validationErrors.length > 0}
              onClick={() => void handleCreateListing()}
            >
              {busy ? 'Creating listing…' : 'Create your listing'}
            </button>
          )}
          {step === 2 && is1155 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || validationErrors.length > 0}
              onClick={() => void handlePrepare1155()}
            >
              {busy ? 'Preparing…' : 'Prepare edition'}
            </button>
          )}
          {step === 3 && !is1155 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || done || validationErrors.length > 0}
              onClick={() => void handleSetMetadata()}
            >
              {done ? 'Artwork attached' : busy ? 'Attaching…' : 'Attach your artwork'}
            </button>
          )}
          {step === 3 && is1155 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || done || validationErrors.length > 0}
              onClick={() => void handleCreateListing()}
            >
              {done ? 'Listed' : busy ? 'Creating listing…' : 'Create your listing'}
            </button>
          )}
        </>
      }
    >
      {showWrongChain && (
        <WrongChainNotice
          currentChainId={chainId}
          expectedChainId={collectionChainId}
          onSwitch={() => void switchChainAsync?.({ chainId: collectionChainId })}
          className="mb-6"
        />
      )}

      <TxStateBanner
        phase={phase}
        message={
          phase === 'failed'
            ? localError || error?.message || 'The transaction didn’t go through.'
            : phase === 'pending'
              ? 'Waiting for confirmation. Keep this tab open.'
              : phase === 'confirmed' && done
                ? is1155
                  ? 'Your listing is live. Collectors mint when they buy.'
                  : 'Artwork is attached. Your listing is ready for collectors.'
                : undefined
        }
        className="mb-6"
      />

      <ValidationList errors={validationErrors} className="mb-6" />

      {step === 1 && (
        <div className="space-y-6">
          <p className="text-muted">
            One approval lets this collection sell through the auction house. You only do this once per collection.
          </p>
          <ReviewRow label="Auction house" value={marketplace ?? 'Unsupported chain'} />
          <ReviewRow label="Collection" value={collectionAddress} />
          <ReviewRow label="Status" value={approved ? 'Approved' : 'Not yet approved'} />
        </div>
      )}

      {step === 2 && !is1155 && (
        <div className="space-y-6">
          <FlowField label="Price (ETH)" hint="What collectors pay for each piece.">
            <input
              className="studio-input"
              value={priceEth}
              onChange={(e) => setPriceEth(e.target.value)}
              inputMode="decimal"
            />
          </FlowField>
          <FlowField
            label="How many available"
            hint="Collectors can buy more than one at a time; pieces are numbered in order."
          >
            <input
              className="studio-input"
              value={totalAvailable}
              onChange={(e) => setTotalAvailable(e.target.value)}
              inputMode="numeric"
            />
          </FlowField>
        </div>
      )}

      {step === 2 && is1155 && (
        <div className="space-y-6">
          <FlowField label="Artwork link" hint="Where this edition’s metadata lives (usually after you pin in Media).">
            <input
              className="studio-input font-mono text-sm"
              value={tokenURI1155}
              onChange={(e) => setTokenURI1155(e.target.value)}
              placeholder="ar://…"
            />
          </FlowField>
          <FlowField label="Max supply" hint="0 means open supply.">
            <input
              className="studio-input"
              value={maxSupply}
              onChange={(e) => setMaxSupply(e.target.value)}
              inputMode="numeric"
            />
          </FlowField>
        </div>
      )}

      {step === 3 && !is1155 && (
        <div className="space-y-6">
          <FlowField
            label="Listing ID"
            hint="Filled after you create the listing. Paste it if it doesn’t appear automatically."
          >
            <input
              className="studio-input"
              value={listingId ?? ''}
              onChange={(e) => setListingId(e.target.value ? Number(e.target.value) : null)}
              inputMode="numeric"
            />
          </FlowField>
          <FlowField
            label="Artwork folder link"
            hint="Point to the folder of metadata for this listing. Studio attaches it right after the listing is created."
          >
            <input
              className="studio-input font-mono text-sm"
              value={listingBaseURI}
              onChange={(e) => setListingBaseURI(e.target.value)}
              placeholder="ar://your-manifest"
            />
          </FlowField>
          <FlowDetails>
            <p>
              Studio finishes attaching your artwork right after the listing is created. Collectors browse and buy on such.market — listing and metadata stay here.
            </p>
          </FlowDetails>
        </div>
      )}

      {step === 3 && is1155 && (
        <div className="space-y-6">
          <ReviewRow label="Prepared edition" value={preparedTokenId || '—'} />
          <FlowField label="Price (ETH)">
            <input
              className="studio-input"
              value={priceEth}
              onChange={(e) => setPriceEth(e.target.value)}
              inputMode="decimal"
            />
          </FlowField>
          <FlowField label="How many available">
            <input
              className="studio-input"
              value={totalAvailable}
              onChange={(e) => setTotalAvailable(e.target.value)}
              inputMode="numeric"
            />
          </FlowField>
        </div>
      )}

      {isPreview && previewScenario === 'empty' && (
        <p className="mt-8 text-muted">No lazy listings yet for this collection.</p>
      )}
    </FlowShell>
  );
}
