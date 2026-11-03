'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSendTransaction, useWaitForTransactionReceipt, useSignMessage } from 'wagmi';
import { Stepper } from '~/components/ui/Stepper';
import { DropZone } from '~/components/ui/DropZone';
import { useCollection } from '~/hooks/useCollections';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { useStudioSession } from '~/hooks/useStudioSession';
import { cn } from '~/lib/utils';

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

async function sha256Hex(bytes: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export default function MintWizardPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = use(params);
  const { data: collection } = useCollection(collectionId);
  const { address, chainId, isConnected } = useActiveWallet();
  const { session, verify } = useStudioSession();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync, data: txHash } = useSendTransaction();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata>({
    name: '',
    description: '',
    animationUrl: '',
    attributes: [],
  });
  const [amount, setAmount] = useState(1);
  const [maxSupply, setMaxSupply] = useState(0);
  const [supplyMode, setSupplyMode] = useState<'open' | 'limited'>('open');
  const [pinLog, setPinLog] = useState<string[]>([]);
  const [pinBusy, setPinBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [metadataUri, setMetadataUri] = useState<string | null>(null);
  const [mintBusy, setMintBusy] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const tokenStandard = (collection?.tokenStandard as string | undefined) ?? 'erc721';
  const is1155 = tokenStandard === 'erc1155';

  const handleFiles = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

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
    if (currentStep === 1) return !!file;
    if (currentStep === 2) {
      if (!metadata.name) return false;
      if (is1155 && amount < 1) return false;
      if (is1155 && supplyMode === 'limited' && maxSupply < amount) return false;
      return true;
    }
    if (currentStep === 3) return Boolean(metadataUri);
    return true;
  })();

  const collectionName = collection?.name ?? 'Collection';

  const reviewJson = {
    name: metadata.name,
    description: metadata.description,
    image: file?.name ?? '',
    ...(metadata.animationUrl ? { animation_url: metadata.animationUrl } : {}),
    ...(metadata.attributes.length > 0
      ? {
          attributes: metadata.attributes
            .filter((a) => a.trait_type && a.value)
            .map((a) => ({ trait_type: a.trait_type, value: a.value })),
        }
      : {}),
  };

  async function ensureSession() {
    if (session.data?.address || !address) return;
    await verify.mutateAsync({
      address,
      chainId: chainId ?? 8453,
      sign: (message) => signMessageAsync({ message }),
    });
  }

  async function pinToArweave() {
    if (!file || !address) return;
    setPinBusy(true);
    setPinLog([]);
    setMintError(null);
    const note = (msg: string) => setPinLog((current) => [...current, msg]);
    try {
      await ensureSession();
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256Hex(bytes);
      note(`Hashed ${file.name}`);

      const quoted = await fetch('/api/media/quote', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          files: [
            {
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              sha256,
            },
          ],
        }),
      });
      const quoteBody = await quoted.json();
      if (!quoted.ok && quoted.status !== 402) throw new Error(quoteBody.error || 'Quote failed');
      note(`Quote ${quoteBody.quote?.usdcAmount} USDC`);

      const mediaConfig = await fetch('/api/media/config', { credentials: 'include' }).then((r) => r.json());
      if (!mediaConfig.allowMockPayment) {
        throw new Error(
          'Mock x402 payment is disabled. Complete payment with X-PAYMENT from your facilitator, then retry pin.',
        );
      }
      const paid = await fetch('/api/media/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'X-PAYMENT': 'mock:allow' },
        body: JSON.stringify({
          idempotencyKey: quoteBody.quote.idempotencyKey,
          paymentHeader: 'mock:allow',
        }),
      });
      const paidBody = await paid.json();
      if (!paid.ok) throw new Error(paidBody.error || 'Payment failed');
      setJobId(paidBody.job.id);
      note(`Paid job ${paidBody.job.id}`);

      const media = await fetch(`/api/media/jobs/${paidBody.job.id}/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bytes: toBase64(bytes) }),
      });
      const mediaBody = await media.json();
      if (!media.ok) throw new Error(mediaBody.error || 'Media upload failed');
      note(`Media ${mediaBody.job.media.id}${mediaBody.simulated ? ' (simulated)' : ''}`);

      const metadataRes = await fetch(`/api/media/jobs/${paidBody.job.id}/metadata`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: metadata.name,
          description: metadata.description,
          animationUrl: metadata.animationUrl || undefined,
          attributes: metadata.attributes.filter((a) => a.trait_type && a.value),
        }),
      });
      const metadataBody = await metadataRes.json();
      if (!metadataRes.ok) throw new Error(metadataBody.error || 'Metadata upload failed');
      note(`Metadata ${metadataBody.job.metadata.id}`);

      const confirmed = await fetch(`/api/media/jobs/${paidBody.job.id}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      const confirmedBody = await confirmed.json();
      if (!confirmed.ok || !confirmedBody.mintEnabled) {
        throw new Error(confirmedBody.job?.errorMessage || 'Gateway confirmation failed');
      }
      const uri = `ar://${confirmedBody.job.metadata.id}`;
      setMetadataUri(uri);
      note(`Confirmed. Mint URI ${uri}`);
    } catch (error) {
      note(error instanceof Error ? error.message : 'Pin failed');
    } finally {
      setPinBusy(false);
    }
  }

  async function handleMint() {
    if (!address || !metadataUri) return;
    setMintBusy(true);
    setMintError(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/mint`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: address,
          metadataUri,
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
      setMintError(error instanceof Error ? error.message : 'Mint failed');
      setMintBusy(false);
    }
  }

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
        {currentStep === 1 && <StepUpload file={file} preview={preview} onFiles={handleFiles} />}
        {currentStep === 2 && (
          <StepMetadata
            metadata={metadata}
            setMetadata={setMetadata}
            preview={preview}
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
            reviewJson={reviewJson}
            preview={preview}
            pinLog={pinLog}
            pinBusy={pinBusy}
            metadataUri={metadataUri}
            onPin={() => void pinToArweave()}
          />
        )}
        {currentStep === 4 && (
          <StepMint
            metadataUri={metadataUri}
            preview={preview}
            name={metadata.name}
            description={metadata.description}
            attributes={metadata.attributes}
            mintBusy={mintBusy}
            mintError={mintError}
            receipt={Boolean(receipt)}
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
  onFiles,
}: {
  file: File | null;
  preview: string | null;
  onFiles: (files: File[]) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-bold">Upload artwork</h2>
        <p className="mt-3 text-muted">Studio will hash the file, quote Arweave cost, and pin after payment.</p>
      </div>
      <DropZone onFiles={onFiles} />
      {file && (
        <div className="flex items-center gap-4">
          {preview && (
            <img src={preview} alt="" className="size-16 rounded-lg object-cover" />
          )}
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
            Studio formats OpenSea-shaped JSON and pins it after the media upload confirms.
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
  reviewJson,
  preview,
  pinLog,
  pinBusy,
  metadataUri,
  onPin,
}: {
  reviewJson: Record<string, unknown>;
  preview: string | null;
  pinLog: string[];
  pinBusy: boolean;
  metadataUri: string | null;
  onPin: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-bold">Pin to Arweave</h2>
          <p className="mt-3 text-muted">
            Pay the x402 quote, upload media, then metadata. Mint unlocks only after gateway confirmation.
          </p>
        </div>
        <pre className="overflow-auto rounded-lg border border-border bg-neutral-50 p-6 text-sm">
          {JSON.stringify(reviewJson, null, 2)}
        </pre>
        <button type="button" className="studio-btn w-fit disabled:opacity-40" disabled={pinBusy || Boolean(metadataUri)} onClick={onPin}>
          {metadataUri ? 'Pinned' : pinBusy ? 'Pinning…' : 'Pay & pin'}
        </button>
        {pinLog.length > 0 && (
          <ul className="space-y-1 text-sm text-muted">
            {pinLog.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        {metadataUri && (
          <p className="text-sm font-medium text-foreground">Confirmed metadata URI: {metadataUri}</p>
        )}
      </div>
      <PreviewCard
        preview={preview}
        name={String(reviewJson.name ?? '')}
        description={String(reviewJson.description ?? '')}
        attributes={(reviewJson.attributes as Attribute[] | undefined) ?? []}
      />
    </div>
  );
}

function StepMint({
  metadataUri,
  preview,
  name,
  description,
  attributes,
  mintBusy,
  mintError,
  receipt,
  onMint,
  is1155,
  amount,
  supplyMode,
  maxSupply,
}: {
  metadataUri: string | null;
  preview: string | null;
  name: string;
  description: string;
  attributes: Attribute[];
  mintBusy: boolean;
  mintError: string | null;
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
            Uses the confirmed Arweave metadata URI. {is1155 ? 'Multi-supply mint.' : '1/1 mint.'}
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
          disabled={!metadataUri || mintBusy || receipt}
          onClick={onMint}
        >
          {receipt ? 'Mint submitted' : mintBusy ? 'Confirm in wallet…' : 'Mint'}
        </button>
        {mintError && <p className="text-sm text-error">{mintError}</p>}
        {receipt && <p className="text-sm text-muted">Transaction confirmed. Indexer will pick up the token shortly.</p>}
      </div>
      <PreviewCard preview={preview} name={name} description={description} attributes={attributes} />
    </div>
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
