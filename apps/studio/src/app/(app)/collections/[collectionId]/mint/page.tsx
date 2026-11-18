'use client';

import { Suspense, use, useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSendTransaction, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { base, baseSepolia, mainnet } from 'wagmi/chains';
import { describeTxFailure, tokenIdFromMintLogs } from '@cryptoart/marketplace';
import { usePinnedMedia } from '~/app/media/usePinnedMedia';
import { listingHandoffPath } from '~/components/listing/handoff';
import { Stepper } from '~/components/ui/Stepper';
import { DropZone } from '~/components/ui/DropZone';
import { useCollection } from '~/hooks/useCollections';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { txExplorerUrl } from '~/lib/txExplorer';
import { cn } from '~/lib/utils';
import { guessAudioMimeType, isAudioMimeType } from '@cryptoart/media/client';
import { mintTokenUri } from './tokenUri';

const STEPS = ['Upload', 'Metadata', 'Pin', 'Mint'];

interface Attribute {
  trait_type: string;
  value: string;
}

interface TokenMetadata {
  name: string;
  description: string;
  animationUrl: string;
  attributes: Attribute[];
}

export default function MintWizardPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-20 py-16 text-muted">Loading mint…</p>}>
      <MintWizard params={params} />
    </Suspense>
  );
}

function MintWizard({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const search = useSearchParams();
  const { data: collection } = useCollection(collectionId);
  const { address, chainId, isConnected } = useActiveWallet();
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });
  const { switchChainAsync } = useSwitchChain();

  const opensOnPin = Boolean(search.get('jobId')?.trim()) || Boolean(mintTokenUri({
    jobId: null,
    pin: null,
    devMetadataUri: search.get('metadataUri'),
  }));
  const [currentStep, setCurrentStep] = useState(opensOnPin ? 3 : 1);
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata>({
    name: '',
    description: '',
    animationUrl: '',
    attributes: [],
  });
  const [amount, setAmount] = useState(1);
  const [maxSupply, setMaxSupply] = useState(0);
  const [supplyMode, setSupplyMode] = useState<'open' | 'limited'>('open');
  const initialJobId = search.get('jobId')?.trim() || null;
  const [jobDraft, setJobDraft] = useState(initialJobId ?? '');
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [refreshKey, setRefreshKey] = useState(0);
  const pinned = usePinnedMedia(jobId, refreshKey);
  const devMetadataUri = search.get('metadataUri');
  const tokenUri = mintTokenUri({
    jobId,
    pin: pinned.pin,
    devMetadataUri,
  });
  const usingDevFallback = !jobId && Boolean(tokenUri);
  const [mintBusy, setMintBusy] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const tokenStandard = (collection?.tokenStandard as string | undefined) ?? 'erc721';
  const is1155 = tokenStandard === 'erc1155';

  const handleFiles = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
  }, []);

  const isAudioFile = file
    ? isAudioMimeType(guessAudioMimeType(file.name, file.type || 'application/octet-stream'))
    : false;
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const addAttribute = useCallback(() => {
    setMetadata((m) => ({
      ...m,
      attributes: [...m.attributes, { trait_type: '', value: '' }],
    }));
  }, []);

  const removeAttribute = useCallback((index: number) => {
    setMetadata((m) => ({
      ...m,
      attributes: m.attributes.filter((_, i) => i !== index),
    }));
  }, []);

  const updateAttribute = useCallback(
    (index: number, field: 'trait_type' | 'value', val: string) => {
      setMetadata((m) => ({
        ...m,
        attributes: m.attributes.map((a, i) => (i === index ? { ...a, [field]: val } : a)),
      }));
    },
    [],
  );

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(STEPS.length, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const canContinue = (() => {
    if (currentStep === 1) return true;
    if (currentStep === 2) {
      if (is1155 && amount < 1) return false;
      if (is1155 && supplyMode === 'limited' && maxSupply < amount) return false;
      return true;
    }
    if (currentStep === 3) return Boolean(tokenUri);
    return true;
  })();

  const collectionName = collection?.name ?? 'Collection';

  function loadJob() {
    const next = jobDraft.trim();
    setJobId(next || null);
    setRefreshKey((current) => current + 1);
  }

  async function handleMint() {
    if (!address || !tokenUri) return;
    setMintBusy(true);
    setMintError(null);
    try {
      const collectionChainId = typeof collection?.chainId === 'number' ? collection.chainId : null;
      if (
        collectionChainId &&
        chainId !== collectionChainId &&
        (collectionChainId === base.id || collectionChainId === baseSepolia.id || collectionChainId === mainnet.id)
      ) {
        await switchChainAsync({ chainId: collectionChainId });
      }
      const res = await fetch(`/api/collections/${collectionId}/mint`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: address,
          metadataUri: tokenUri,
          uploadJobId: jobId,
          amount: is1155 ? amount : undefined,
          maxSupply: is1155 ? (supplyMode === 'open' ? 0 : maxSupply) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to prepare mint');
      await sendTransactionAsync({
        to: data.txRequest.to as `0x${string}`,
        data: data.txRequest.data as `0x${string}`,
      });
    } catch (error) {
      const described = describeTxFailure(error instanceof Error ? error.message : 'Mint failed');
      setMintError(described.message);
      setMintBusy(false);
    }
  }

  useEffect(() => {
    if (!receipt || receipt.status === 'success') return;
    setMintError('The mint transaction reverted.');
    setMintBusy(false);
  }, [receipt]);

  const mintedTokenId = receipt?.status === 'success' ? tokenIdFromMintLogs(receipt.logs) : null;
  const listHref = listingHandoffPath(collectionId, {
    tokenId: mintedTokenId,
    metadataUri: tokenUri,
    mintTxHash: txHash,
    quantity: is1155 ? String(amount) : null,
  });
  const shownPreview = previewUrl ?? (pinned.pin?.gatewayUrl?.startsWith('https://') ? pinned.pin.gatewayUrl : null);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-2xl font-bold">Connect your wallet</h2>
        <p className="mt-2 text-muted">You need a connected wallet to mint.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-122px)] flex-col">
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-20 py-4">
          <Stepper steps={STEPS} currentStep={currentStep} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1280px] px-20 pt-8">
        <nav className="flex items-center gap-1.5 text-sm text-muted">
          <Link href={`/collections/${collectionId}`} className="hover:text-foreground">
            {collectionName}
          </Link>
          <span>›</span>
          <span className="text-foreground">Mint</span>
        </nav>
      </div>

      <div className="mx-auto w-full max-w-[1280px] flex-1 px-20 py-10">
        {currentStep === 1 && <StepUpload file={file} isAudioFile={isAudioFile} preview={previewUrl} onFiles={handleFiles} />}
        {currentStep === 2 && (
          <StepMetadata
            metadata={metadata}
            setMetadata={setMetadata}
            preview={shownPreview}
            fileName={file?.name}
            onAddAttribute={addAttribute}
            onRemoveAttribute={removeAttribute}
            onUpdateAttribute={updateAttribute}
            is1155={is1155}
            amount={amount}
            setAmount={setAmount}
            maxSupply={maxSupply}
            setMaxSupply={setMaxSupply}
            supplyMode={supplyMode}
            setSupplyMode={setSupplyMode}
          />
        )}
        {currentStep === 3 && (
          <StepPin
            preview={shownPreview}
            name={metadata.name}
            description={metadata.description}
            attributes={metadata.attributes}
            jobDraft={jobDraft}
            onJobDraft={setJobDraft}
            onLoadJob={loadJob}
            loading={pinned.loading}
            error={pinned.error}
            mintEnabled={pinned.pin?.mintEnabled === true}
            tokenUri={tokenUri}
            usingDevFallback={usingDevFallback}
            gatewayUrl={pinned.pin?.gatewayUrl ?? null}
          />
        )}
        {currentStep === 4 && (
          <StepMint
            metadataUri={tokenUri}
            usingDevFallback={usingDevFallback}
            preview={shownPreview}
            name={metadata.name}
            description={metadata.description}
            attributes={metadata.attributes}
            mintBusy={mintBusy}
            mintError={mintError}
            txHash={txHash}
            mintedTokenId={mintedTokenId}
            listHref={listHref}
            chainId={collection?.chainId ?? chainId ?? baseSepolia.id}
            receipt={receipt?.status === 'success'}
            onMint={() => void handleMint()}
            is1155={is1155}
            amount={amount}
            supplyMode={supplyMode}
            maxSupply={maxSupply}
          />
        )}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-20 py-4">
          <button
            type="button"
            onClick={goBack}
            className={cn('text-[15px] text-muted hover:text-foreground', currentStep === 1 && 'invisible')}
          >
            ← Back
          </button>
          {currentStep < STEPS.length && (
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue}
              className="studio-btn disabled:opacity-40"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepUpload({
  file,
  preview,
  isAudioFile,
  onFiles,
}: {
  file: File | null;
  preview: string | null;
  isAudioFile: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-bold">{isAudioFile ? 'Upload audio' : 'Upload artwork'}</h2>
        <p className="mt-3 text-muted">
          Optional preview in this browser. The mint uses the confirmed Arweave pin. Audio uploads get a simple HTML player as animation URL.
        </p>
      </div>
      <DropZone accept={file?.type?.startsWith('audio/') || isAudioFile ? 'audio/*,.mp3,.wav,.flac,.ogg,.m4a' : undefined} onFiles={onFiles} />
      {file && (
        <div className="flex items-center gap-4">
          {isAudioFile && preview
            ? <audio controls src={preview} className="h-10 max-w-xs" />
            : preview
              ? <img src={preview} alt="" className="size-16 rounded-lg object-cover" />
              : null}
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StepMetadata({
  metadata,
  setMetadata,
  preview,
  fileName,
  onAddAttribute,
  onRemoveAttribute,
  onUpdateAttribute,
  is1155,
  amount,
  setAmount,
  maxSupply,
  setMaxSupply,
  supplyMode,
  setSupplyMode,
}: {
  metadata: TokenMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<TokenMetadata>>;
  preview: string | null;
  fileName?: string;
  onAddAttribute: () => void;
  onRemoveAttribute: (index: number) => void;
  onUpdateAttribute: (index: number, field: 'trait_type' | 'value', val: string) => void;
  is1155: boolean;
  amount: number;
  setAmount: (n: number) => void;
  maxSupply: number;
  setMaxSupply: (n: number) => void;
  supplyMode: 'open' | 'limited';
  setSupplyMode: (m: 'open' | 'limited') => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-bold">Token metadata</h2>
          <p className="mt-3 text-muted">
            Shown on this preview. The token URI is the confirmed pin, not this form.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Name</label>
          <input
            className="studio-input mt-2"
            value={metadata.name}
            onChange={(e) => setMetadata((m) => ({ ...m, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="studio-textarea mt-2"
            rows={4}
            value={metadata.description}
            onChange={(e) => setMetadata((m) => ({ ...m, description: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Animation URL (optional)</label>
          <input
            className="studio-input mt-2"
            value={metadata.animationUrl}
            onChange={(e) => setMetadata((m) => ({ ...m, animationUrl: e.target.value }))}
            placeholder="Leave blank unless you have a separate animation asset"
          />
        </div>
        {is1155 && (
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium">Supply</p>
            <p className="mt-1 text-sm text-muted">Limited cap or open. Not numbered editions.</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm',
                  supplyMode === 'open' ? 'border-foreground' : 'border-border',
                )}
                onClick={() => setSupplyMode('open')}
              >
                Open
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm',
                  supplyMode === 'limited' ? 'border-foreground' : 'border-border',
                )}
                onClick={() => setSupplyMode('limited')}
              >
                Limited
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Initial mint amount</label>
                <input
                  type="number"
                  min={1}
                  className="studio-input mt-2"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              {supplyMode === 'limited' && (
                <div>
                  <label className="text-sm font-medium">Max supply</label>
                  <input
                    type="number"
                    min={amount}
                    className="studio-input mt-2"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Attributes</label>
            <button type="button" className="text-sm text-muted hover:text-foreground" onClick={onAddAttribute}>
              + Add
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {metadata.attributes.map((attr, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="studio-input"
                  placeholder="trait_type"
                  value={attr.trait_type}
                  onChange={(e) => onUpdateAttribute(i, 'trait_type', e.target.value)}
                />
                <input
                  className="studio-input"
                  placeholder="value"
                  value={attr.value}
                  onChange={(e) => onUpdateAttribute(i, 'value', e.target.value)}
                />
                <button type="button" className="text-sm text-muted" onClick={() => onRemoveAttribute(i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <PreviewCard
        preview={preview}
        name={metadata.name}
        description={metadata.description}
        attributes={metadata.attributes}
        fileName={fileName}
      />
    </div>
  );
}

function StepPin({
  preview,
  name,
  description,
  attributes,
  jobDraft,
  onJobDraft,
  onLoadJob,
  loading,
  error,
  mintEnabled,
  tokenUri,
  usingDevFallback,
  gatewayUrl,
}: {
  preview: string | null;
  name: string;
  description: string;
  attributes: Attribute[];
  jobDraft: string;
  onJobDraft: (value: string) => void;
  onLoadJob: () => void;
  loading: boolean;
  error: string | null;
  mintEnabled: boolean;
  tokenUri: string | null;
  usingDevFallback: boolean;
  gatewayUrl: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-bold">Confirmed pin</h2>
          <p className="mt-3 text-muted">
            Pin the artwork on the paid Arweave page, then load that job here. Mint stays locked until the pin is confirmed.
          </p>
        </div>
        <p className="text-sm">
          <Link
            href={`/media/upload?name=${encodeURIComponent(name || 'Artwork')}&artist=${encodeURIComponent(attributes.find((attribute) => attribute.trait_type.toLowerCase() === 'artist')?.value || '')}&description=${encodeURIComponent(description)}`}
            className="underline"
          >
            Open the paid pin page
          </Link>
        </p>
        <label className="block text-sm font-semibold">
          Upload job id
          <input
            className="studio-input mt-2"
            value={jobDraft}
            onChange={(event) => onJobDraft(event.target.value)}
            placeholder="job id from the pin page"
          />
        </label>
        <button type="button" className="studio-btn w-fit disabled:opacity-40" disabled={loading} onClick={onLoadJob}>
          {loading ? 'Checking pin…' : 'Check pin'}
        </button>
        {error && <p className="text-sm text-error">{error}</p>}
        {mintEnabled && tokenUri && (
          <p className="text-sm font-medium text-foreground">
            Confirmed metadata URI: {tokenUri}
            {gatewayUrl ? (
              <>
                {' '}
                <a className="underline" href={gatewayUrl} target="_blank" rel="noreferrer">
                  Gateway
                </a>
              </>
            ) : null}
          </p>
        )}
        {!mintEnabled && !usingDevFallback && !error && (
          <p className="text-sm text-muted">Mint stays disabled until this job’s pin is confirmed.</p>
        )}
        {usingDevFallback && tokenUri && (
          <p className="text-sm text-muted">Dev fallback metadata URI (no job id): {tokenUri}</p>
        )}
      </div>
      <PreviewCard preview={preview} name={name} description={description} attributes={attributes} />
    </div>
  );
}

function StepMint({
  metadataUri,
  usingDevFallback,
  preview,
  name,
  description,
  attributes,
  mintBusy,
  mintError,
  txHash,
  mintedTokenId,
  listHref,
  chainId,
  receipt,
  onMint,
  is1155,
  amount,
  supplyMode,
  maxSupply,
}: {
  metadataUri: string | null;
  usingDevFallback: boolean;
  preview: string | null;
  name: string;
  description: string;
  attributes: Attribute[];
  mintBusy: boolean;
  mintError: string | null;
  txHash?: `0x${string}`;
  mintedTokenId: string | null;
  listHref: string;
  chainId: number;
  receipt: boolean;
  onMint: () => void;
  is1155: boolean;
  amount: number;
  supplyMode: 'open' | 'limited';
  maxSupply: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-bold">Mint on-chain</h2>
          <p className="mt-3 text-muted">
            {usingDevFallback
              ? 'Uses the dev fallback metadata URI. '
              : 'Uses the confirmed pin’s metadata URI. The button stays off until that pin is confirmed. '}
            {is1155 ? 'Multi-supply mint.' : '1/1 mint.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">Metadata URI</span>
            <span className="max-w-[320px] truncate font-medium">{metadataUri ?? '—'}</span>
          </div>
          {is1155 && (
            <>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Amount</span>
                <span className="font-medium">{amount}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Supply</span>
                <span className="font-medium">
                  {supplyMode === 'open' ? 'Open' : `Limited to ${maxSupply}`}
                </span>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          className="studio-btn w-fit disabled:opacity-40"
          disabled={!metadataUri || receipt || (mintBusy && !mintError)}
          onClick={onMint}
        >
          {receipt ? 'Minted' : mintError ? 'Mint' : txHash ? 'Waiting for confirmation…' : mintBusy ? 'Confirm in wallet…' : 'Mint'}
        </button>
        {mintError && <p className="text-sm text-error">{mintError}</p>}
        {txHash && <TxHashLine chainId={chainId} hash={txHash} confirmed={receipt} />}
        {receipt && (
          <div className="rounded-lg border border-border p-4 text-sm">
            <p>Mint confirmed on-chain{mintedTokenId ? ` as token ${mintedTokenId}` : ''}.</p>
            <p className="mt-2 text-muted">
              {mintedTokenId
                ? 'List it on the auction house next. Studio will check approval and confirm the listing with a chain read.'
                : 'The receipt did not include a token id. You can still open the listing form and enter the id.'}
            </p>
            <Link href={listHref} className="studio-btn mt-4">
              List this token
            </Link>
          </div>
        )}
      </div>
      <PreviewCard preview={preview} name={name} description={description} attributes={attributes} />
    </div>
  );
}

function TxHashLine({ chainId, hash, confirmed }: { chainId: number; hash: string; confirmed: boolean }) {
  const href = txExplorerUrl(chainId, hash);
  return (
    <p className="text-sm text-muted">
      {confirmed ? 'Confirmed' : 'Submitted'}{' '}
      {href ? (
        <a className="break-all font-mono text-xs text-foreground underline" href={href} target="_blank" rel="noreferrer">
          {hash}
        </a>
      ) : (
        <span className="break-all font-mono text-xs text-foreground">{hash}</span>
      )}
    </p>
  );
}

function PreviewCard({
  preview,
  name,
  description,
  attributes,
  fileName,
}: {
  preview: string | null;
  name: string;
  description: string;
  attributes: Attribute[];
  fileName?: string;
}) {
  return (
    <div className="sticky top-8 rounded-lg border border-border">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-lg bg-neutral-50">
        {preview ? (
          <img src={preview} alt={name || 'Token preview'} className="size-full object-cover" />
        ) : (
          <span className="text-sm text-muted">{fileName || 'No preview'}</span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold">{name || <span className="text-muted">Untitled</span>}</h3>
        {description && <p className="line-clamp-3 text-sm text-muted">{description}</p>}
        {attributes.filter((a) => a.trait_type && a.value).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attributes
              .filter((a) => a.trait_type && a.value)
              .map((a, i) => (
                <span key={i} className="rounded-md border border-border px-2.5 py-1 text-xs">
                  <span className="text-muted">{a.trait_type}:</span> <span className="font-medium">{a.value}</span>
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
