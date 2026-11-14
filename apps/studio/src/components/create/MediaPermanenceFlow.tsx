'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSignMessage } from 'wagmi';
import { ArtPreview } from '~/components/flows/ArtPreview';
import { FlowDetails, FlowField, FlowShell, ReviewRow } from '~/components/flows/FlowShell';
import { TxStateBanner } from '~/components/flows/TxStateBanner';
import { ValidationList } from '~/components/flows/ValidationList';
import { WalletGate } from '~/components/flows/WalletGate';
import type { FlowMode, PreviewScenario, TxPhase } from '~/components/flows/types';
import { DropZone } from '~/components/ui/DropZone';
import { useActiveWallet } from '~/hooks/useActiveWallet';
import { useStudioSession } from '~/hooks/useStudioSession';
import {
  confirmMediaJob,
  createPaidMediaJob,
  estimateArweaveCostUsdc,
  fetchMediaConfig,
  metadataUriFromJob,
  quoteMediaUpload,
  sha256Hex,
  toBase64,
  uploadJobMedia,
  uploadJobMetadata,
  type MediaJob,
} from '~/lib/adapters/media';

const STEPS = ['Upload', 'Quote', 'Make permanent', 'Confirm'];

export type MediaPermanenceFlowProps = {
  mode?: FlowMode;
  previewScenario?: PreviewScenario;
  collectionId?: string;
  collectionName?: string;
  previewImage?: string | null;
  previewAspectRatio?: string;
};

function phaseFromScenario(scenario?: PreviewScenario): TxPhase {
  switch (scenario) {
    case 'wallet_missing':
      return 'wallet_missing';
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

export function MediaPermanenceFlow({
  mode = 'live',
  previewScenario = 'default',
  collectionId,
  collectionName = 'Studio',
  previewImage,
  previewAspectRatio = '3 / 4',
}: MediaPermanenceFlowProps) {
  const isPreview = mode === 'preview';
  const { address, chainId, isConnected } = useActiveWallet();
  const { session, verify } = useStudioSession();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    isPreview && previewScenario !== 'empty' ? previewImage ?? null : null,
  );
  const [title, setTitle] = useState(isPreview ? 'Untitled study' : '');
  const [description, setDescription] = useState(
    isPreview ? 'A quiet piece for the gallery wall.' : '',
  );
  const [quoteUsdc, setQuoteUsdc] = useState(isPreview ? '0.12' : '');
  const [job, setJob] = useState<MediaJob | null>(
    previewScenario === 'confirmed'
      ? { id: 'job_preview', status: 'confirmed', metadata: { id: 'metaPreview' } }
      : null,
  );
  const [log, setLog] = useState<string[]>(
    isPreview && previewScenario === 'pending' ? ['Quoted 0.12 USDC', 'Payment submitted…'] : [],
  );
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [metadataUri, setMetadataUri] = useState<string | null>(
    previewScenario === 'confirmed' ? 'ar://metaPreview' : null,
  );

  const estimate = useMemo(() => {
    if (file) return estimateArweaveCostUsdc(file.size);
    if (isPreview) return quoteUsdc || '0.12';
    return estimateArweaveCostUsdc(0);
  }, [file, isPreview, quoteUsdc]);

  const validationErrors = useMemo(() => {
    if (previewScenario === 'validation_error') {
      return ['That file is larger than we can accept right now.', 'Add a title for the artwork.'];
    }
    const errs: string[] = [];
    if (step >= 1 && !file && !isPreview) errs.push('Choose an artwork file.');
    if (step >= 2 && !title.trim()) errs.push('Add a title for the artwork.');
    return errs;
  }, [previewScenario, step, file, isPreview, title]);

  const livePhase: TxPhase = (() => {
    if (!isConnected) return 'wallet_missing';
    if (localError?.toLowerCase().includes('insufficient')) return 'insufficient_funds';
    if (localError) return 'failed';
    if (metadataUri) return 'confirmed';
    if (busy) return 'pending';
    if (previewScenario === 'empty' && isPreview) return 'empty';
    return 'idle';
  })();
  const phase = isPreview ? phaseFromScenario(previewScenario) : livePhase;

  const note = (msg: string) => setLog((current) => [...current, msg]);

  const handleFiles = useCallback((files: File[]) => {
    const next = files[0];
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setQuoteUsdc(estimateArweaveCostUsdc(next.size));
  }, []);

  const ensureSession = useCallback(async () => {
    if (session.data?.address || !address) return;
    await verify.mutateAsync({
      address,
      chainId: chainId ?? 8453,
      sign: (message) => signMessageAsync({ message }),
    });
  }, [session.data?.address, address, chainId, verify, signMessageAsync]);

  const handleQuote = useCallback(async () => {
    if (validationErrors.length) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (isPreview) {
        setQuoteUsdc(estimate);
        setStep(3);
        note(`Quote ${estimate} USDC`);
        return;
      }
      if (!file) return;
      await ensureSession();
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256Hex(bytes);
      const { quote } = await quoteMediaUpload([
        {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          sha256,
        },
      ]);
      setQuoteUsdc(quote.usdcAmount);
      note(`Quote ${quote.usdcAmount} USDC`);
      setStep(3);
      setJob({ id: quote.idempotencyKey, status: 'quoted' });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Couldn’t get a quote.');
    } finally {
      setBusy(false);
    }
  }, [validationErrors, isPreview, estimate, file, ensureSession]);

  const handlePermanence = useCallback(async () => {
    setBusy(true);
    setLocalError(null);
    try {
      if (isPreview) {
        note('Paid');
        note('Uploaded media');
        note('Uploaded metadata');
        setJob({
          id: 'job_preview',
          status: 'confirming',
          media: { id: 'mediaPreview' },
          metadata: { id: 'metaPreview' },
        });
        setStep(4);
        return;
      }
      if (!file || !job?.id) return;
      const config = await fetchMediaConfig();
      if (!config.allowMockPayment) {
        throw new Error('Live payment isn’t set up in this environment yet. Ask for help if you need to pin for real.');
      }
      const paid = await createPaidMediaJob(job.id, 'mock:allow');
      note(`Paid · job ${paid.id}`);
      const bytes = await file.arrayBuffer();
      const mediaJob = await uploadJobMedia(paid.id, toBase64(bytes));
      note(`Media ${mediaJob.media?.id ?? 'uploaded'}`);
      const metaJob = await uploadJobMetadata(paid.id, {
        name: title,
        description: description || undefined,
      });
      note(`Metadata ${metaJob.metadata?.id ?? 'uploaded'}`);
      setJob(metaJob);
      setStep(4);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Couldn’t make the file permanent.');
    } finally {
      setBusy(false);
    }
  }, [isPreview, file, job?.id, title, description]);

  const handleConfirm = useCallback(async () => {
    setBusy(true);
    setLocalError(null);
    try {
      if (isPreview) {
        setMetadataUri('ar://metaPreview');
        setJob((j) => (j ? { ...j, status: 'confirmed' } : j));
        note('Confirmed');
        return;
      }
      if (!job?.id) return;
      const result = await confirmMediaJob(job.id);
      if (!result.mintEnabled) {
        throw new Error(result.job.errorMessage || 'We couldn’t confirm the file on the network yet.');
      }
      setJob(result.job);
      setMetadataUri(metadataUriFromJob(result.job));
      note('Confirmed. Ready to use in a mint or listing.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }, [isPreview, job?.id]);

  if (phase === 'wallet_missing') {
    return (
      <FlowShell
        title="Make artwork permanent"
        subtitle="See the cost, pay once, and store the file forever — then use the link when you mint or list in Studio."
        breadcrumb={
          collectionId
            ? { href: `/collections/${collectionId}`, label: collectionName, current: 'Media' }
            : undefined
        }
        steps={STEPS}
        currentStep={step}
      >
        <WalletGate description="Sign in so we can quote and charge the permanence fee to your wallet." />
      </FlowShell>
    );
  }

  return (
    <FlowShell
      title="Make artwork permanent"
      subtitle="Upload, see the Arweave cost in USDC, then pay to keep the file forever. Mint and listing tools in Studio use the link you get back."
      breadcrumb={
        collectionId
          ? { href: `/collections/${collectionId}`, label: collectionName, current: 'Media' }
          : undefined
      }
      steps={STEPS}
      currentStep={step}
      aside={
        <ArtPreview
          src={preview}
          aspectRatio={previewAspectRatio}
          caption={title || (preview ? 'Untitled' : undefined)}
          subtitle={
            metadataUri ??
            (file ? `${(file.size / 1024).toFixed(1)} KB` : preview ? 'Sample' : undefined)
          }
          emptyTitle="Drop artwork to preview"
          emptyHint="We’ll show it here at its natural shape before you pay for permanence."
        />
      }
      footer={
        <>
          <button
            type="button"
            className={step === 1 ? 'invisible' : 'text-[15px] text-muted hover:text-foreground'}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            ← Back
          </button>
          {step === 1 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={(!file && !isPreview) || validationErrors.length > 0}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || validationErrors.length > 0}
              onClick={() => void handleQuote()}
            >
              {busy ? 'Getting quote…' : 'Get cost quote'}
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy}
              onClick={() => void handlePermanence()}
            >
              {busy ? 'Paying & uploading…' : `Pay $${quoteUsdc || estimate} USDC & keep forever`}
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              className="studio-btn disabled:opacity-40"
              disabled={busy || Boolean(metadataUri)}
              onClick={() => void handleConfirm()}
            >
              {metadataUri ? 'Confirmed' : busy ? 'Confirming…' : 'Confirm it’s live'}
            </button>
          )}
        </>
      }
    >
      <TxStateBanner
        phase={phase}
        message={
          phase === 'failed'
            ? localError ?? undefined
            : phase === 'insufficient_funds'
              ? 'Not enough USDC for the permanence payment.'
              : phase === 'empty'
                ? 'No media selected yet.'
                : phase === 'confirmed' && metadataUri
                  ? `Ready to use: ${metadataUri}`
                  : undefined
        }
        className="mb-6"
      />
      <ValidationList errors={validationErrors} className="mb-6" />

      {step === 1 && (
        <div className="space-y-6">
          <DropZone onFiles={handleFiles} />
          {file && (
            <ReviewRow
              label="File"
              value={`${file.name} · ${(file.size / 1024).toFixed(1)} KB · about $${estimate} USDC`}
            />
          )}
          {isPreview && !file && preview && (
            <ReviewRow label="Sample file" value={`study · about $${estimate} USDC`} />
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <FlowField label="Title">
            <input className="studio-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FlowField>
          <FlowField label="Description">
            <textarea
              className="studio-textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FlowField>
          <ReviewRow label="Estimated cost" value={`about $${estimate} USDC`} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <p className="text-muted">
            You’ll pay a one-time USDC fee, then we’ll upload the file and its metadata for permanent storage.
          </p>
          <ReviewRow label="Quote" value={`$${quoteUsdc || estimate} USDC`} />
          <ReviewRow label="Title" value={title || '—'} />
          <ul className="space-y-1 text-sm text-muted">
            {log.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
          <FlowDetails>
            <p>
              After payment clears and the file is confirmed, you’ll get a lasting link to use when you mint or list in Studio.
            </p>
          </FlowDetails>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <ReviewRow label="Job" value={job?.id ?? '—'} />
          <ReviewRow label="Status" value={job?.status ?? '—'} />
          <ReviewRow label="Artwork link" value={metadataUri ?? 'Waiting for confirmation'} />
          <ul className="space-y-1 text-sm text-muted">
            {log.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </FlowShell>
  );
}
