'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { guessAudioMimeType, isAudioMimeType } from '@cryptoart/media/client';
import { useAccount, useSignMessage, useSignTypedData, useSwitchChain } from 'wagmi';
import type { X402Accepts } from '@cryptoart/media/client';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';
import { useStudioSession } from '~/hooks/useStudioSession';
import { chainIdFromNetwork, signExactUsdcPayment } from '../payForPin';
import { usePinnedMedia } from '../usePinnedMedia';

type MediaConfig = {
  allowMockPayment: boolean;
  hasTurbo: boolean;
  hasFacilitator: boolean;
  network: string | null;
  uploadMode: 'turbo' | 'simulated' | 'unconfigured';
};

type UploadQuote = {
  idempotencyKey: string;
  usdcAmount: string;
  usdcDisplay: string;
  usd: number;
  network: string;
  asset: string;
  payTo: string;
  expiresAt: string;
  safetyMarginBps: number;
  byteCount: number;
  metadataAllowanceBytes: number;
  costSource: string;
  arweaveWinston: string;
};

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

function networkLabel(network: string) {
  if (network === 'eip155:84532') return 'Base Sepolia';
  if (network === 'eip155:8453') return 'Base';
  if (network === 'eip155:1') return 'Ethereum';
  return network;
}

export default function MediaUploadPage() {
  const search = useSearchParams();
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();
  const { session, verify } = useStudioSession();
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [name, setName] = useState(search.get('name')?.trim() || 'Artwork');
  const [artist, setArtist] = useState(search.get('artist')?.trim() || '');
  const [description, setDescription] = useState(search.get('description')?.trim() || '');
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(undefined);
  const [config, setConfig] = useState<MediaConfig | null>(null);
  const [quote, setQuote] = useState<UploadQuote | null>(null);
  const [requirement, setRequirement] = useState<X402Accepts | null>(null);
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'quote' | 'pin' | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const pinned = usePinnedMedia(jobId, refreshKey);
  const isAudioUpload = useMemo(
    () => (file ? isAudioMimeType(guessAudioMimeType(file.name, file.type || 'application/octet-stream')) : false),
    [file],
  );

  useEffect(() => {
    if (!file || !isAudioUpload) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDurationSeconds(Math.round(audio.duration));
    });
    return () => URL.revokeObjectURL(url);
  }, [file, isAudioUpload]);

  useEffect(() => {
    let cancel = false;
    fetch('/api/media/config', { credentials: 'include' })
      .then(async (response) => response.json() as Promise<MediaConfig>)
      .then((body) => {
        if (!cancel) setConfig(body);
      })
      .catch(() => {
        if (!cancel) setConfig(null);
      });
    return () => {
      cancel = true;
    };
  }, []);

  function note(message: string) {
    setLog((current) => [...current, message]);
  }

  function resetQuote() {
    setQuote(null);
    setRequirement(null);
    setFileBytes(null);
    setJobId(null);
  }

  async function requestQuote() {
    if (!file || !session.data) return;
    setBusy('quote');
    setError(null);
    setLog([]);
    resetQuote();
    try {
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256Hex(bytes);
      const files: Array<{ name: string; mimeType: string; size: number; sha256: string }> = [{
        name: file.name,
        mimeType: guessAudioMimeType(file.name, file.type || 'application/octet-stream'),
        size: file.size,
        sha256,
      }];
      if (coverFile) {
        const coverBytes = await coverFile.arrayBuffer();
        files.push({
          name: coverFile.name,
          mimeType: coverFile.type || 'image/png',
          size: coverFile.size,
          sha256: await sha256Hex(coverBytes),
        });
      }
      const quoted = await fetch('/api/media/quote', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const body = await quoted.json() as { quote?: UploadQuote; accepts?: X402Accepts[]; error?: string };
      if ((!quoted.ok && quoted.status !== 402) || !body.quote || !body.accepts?.[0]) {
        throw new Error(body.error || 'Quote failed');
      }
      setFileBytes(bytes);
      setQuote(body.quote);
      setRequirement(body.accepts[0]);
      note(`Turbo quote ${body.quote.usdcDisplay} USDC on ${networkLabel(body.quote.network)} (${body.quote.costSource}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote failed');
    } finally {
      setBusy(null);
    }
  }

  async function payAndPin() {
    if (!file || !session.data || !quote || !requirement || !fileBytes || !address) return;
    setBusy('pin');
    setError(null);
    try {
      const mediaConfig = config ?? await fetch('/api/media/config', { credentials: 'include' }).then((response) => response.json() as Promise<MediaConfig>);
      if (!mediaConfig) throw new Error('Media config is unavailable');
      let paymentHeader: string;
      if (mediaConfig.allowMockPayment === true) {
        paymentHeader = 'mock:allow';
        note('Mock payment is enabled in this environment.');
      } else {
        const chainId = chainIdFromNetwork(requirement.network);
        if (chainId == null) throw new Error(`Unsupported payment network ${requirement.network}`);
        if (chain?.id !== chainId) {
          note(`Switching wallet to ${networkLabel(requirement.network)}.`);
          await switchChainAsync({ chainId });
        }
        note(`Sign the USDC authorization for ${quote.usdcDisplay} USDC.`);
        paymentHeader = await signExactUsdcPayment({
          requirement,
          from: address,
          signTypedData: (args) => signTypedDataAsync(args),
        });
      }
      const paid = await fetch('/api/media/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'X-PAYMENT': paymentHeader,
          'PAYMENT-SIGNATURE': paymentHeader,
        },
        body: JSON.stringify({ idempotencyKey: quote.idempotencyKey, quote, paymentHeader }),
      });
      const paidBody = await paid.json() as { job?: { id: string; status: string }; error?: string; code?: string };
      if (!paid.ok || !paidBody.job) {
        if (paidBody.code === 'mock_payment_disabled') {
          throw new Error('Mock payment is disabled. Sign the USDC authorization instead.');
        }
        throw new Error(paidBody.error || 'Payment failed');
      }
      note(`Paid job ${paidBody.job.id} (${paidBody.job.status}).`);
      setJobId(paidBody.job.id);

      const media = await fetch(`/api/media/jobs/${paidBody.job.id}/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bytes: toBase64(fileBytes) }),
      });
      const mediaBody = await media.json() as { job?: { media?: { id: string } }; error?: string; simulated?: boolean };
      if (!media.ok || !mediaBody.job?.media) throw new Error(mediaBody.error || 'Media upload failed');
      note(mediaBody.simulated ? `Media ${mediaBody.job.media.id} (simulated, not on Arweave).` : `Media pinned ${mediaBody.job.media.id}.`);

      let coverBytesBase64: string | undefined;
      if (coverFile) {
        const coverBytes = await coverFile.arrayBuffer();
        coverBytesBase64 = toBase64(coverBytes);
      }
      const metadata = await fetch(`/api/media/jobs/${paidBody.job.id}/metadata`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          artist: artist || undefined,
          durationSeconds,
          coverBytes: coverBytesBase64,
          coverMime: coverFile?.type || undefined,
        }),
      });
      const metadataBody = await metadata.json() as { job?: { metadata?: { id: string } }; error?: string };
      if (!metadata.ok || !metadataBody.job?.metadata) throw new Error(metadataBody.error || 'Metadata upload failed');
      note(`Metadata pinned ${metadataBody.job.metadata.id}.`);

      const confirmed = await fetch(`/api/media/jobs/${paidBody.job.id}/confirm`, { method: 'POST', credentials: 'include' });
      const confirmedBody = await confirmed.json() as { mintEnabled?: boolean; job?: { status: string; errorMessage?: string }; error?: string };
      if (!confirmed.ok) throw new Error(confirmedBody.error || confirmedBody.job?.errorMessage || 'Gateway confirmation failed');
      setRefreshKey((current) => current + 1);
      note(confirmedBody.mintEnabled ? 'Confirmed. The mint flow can use the metadata ar:// URI.' : `Not mint-ready: ${confirmedBody.job?.status ?? 'unknown'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pin failed');
    } finally {
      setBusy(null);
    }
  }

  const mockOff = config != null && config.allowMockPayment === false;
  const payBlocked = mockOff && config?.hasFacilitator === false;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="studio-card space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Studio · paid media</p>
          <h1 className="mt-2 text-3xl font-bold">Pin to Arweave</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Hash the file, review the Turbo price, pay in USDC, then pin the media and its metadata. Audio uploads also
            pin a minimal HTML player as the NFT animation URL. Mint stays locked until gateways can read everything.
          </p>
        </div>
        {config?.uploadMode === 'simulated' && (
          <p className="text-sm text-muted">No Turbo key is set here, so this pin is simulated and will not land on Arweave.</p>
        )}
        {config?.uploadMode === 'unconfigured' && (
          <p className="text-sm text-red-600">TURBO_PRIVATE_KEY is not set. A payment cannot be pinned until it is.</p>
        )}
        {mockOff && (
          <p className="text-sm text-muted">
            Mock payment is off. You will sign a USDC authorization on {networkLabel(config.network ?? quote?.network ?? 'eip155:84532')}.
          </p>
        )}
        <ConnectWalletButton />
        {address && !session.data && (
          <button
            type="button"
            className="studio-btn"
            disabled={verify.isPending}
            onClick={() => void verify.mutateAsync({
              address,
              chainId: chain?.id ?? 84532,
              sign: (message) => signMessageAsync({ message }),
            })}
          >
            {verify.isPending ? 'Signing…' : 'Create SIWE session'}
          </button>
        )}
        {session.data && <p className="text-sm">Signed in as {session.data.address}</p>}
        <label className="block text-sm font-semibold">
          {isAudioUpload ? 'Audio file' : 'Artwork file'}
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,image/*,video/*"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setDurationSeconds(undefined);
              resetQuote();
            }}
          />
        </label>
        {isAudioUpload && (
          <>
            <label className="block text-sm font-semibold">
              Cover image (optional)
              <input
                className="mt-2 block w-full text-sm"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  setCoverFile(event.target.files?.[0] ?? null);
                  resetQuote();
                }}
              />
            </label>
            <label className="block text-sm font-semibold">
              Artist
              <input className="studio-input mt-2" value={artist} onChange={(event) => setArtist(event.target.value)} />
            </label>
          </>
        )}
        <label className="block text-sm font-semibold">
          Title
          <input className="studio-input mt-2" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {isAudioUpload && (
          <label className="block text-sm font-semibold">
            Description (optional)
            <textarea className="studio-textarea mt-2" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="studio-btn disabled:cursor-not-allowed disabled:opacity-40" disabled={!file || !session.data || busy != null} onClick={() => void requestQuote()}>
            {busy === 'quote' ? 'Quoting…' : 'Get quote'}
          </button>
          <button
            type="button"
            className="studio-btn-outline disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!quote || !session.data || busy != null || payBlocked}
            onClick={() => void payAndPin()}
          >
            {busy === 'pin' ? 'Pinning…' : 'Pay and pin'}
          </button>
        </div>
        {payBlocked && (
          <p className="text-sm text-red-600">X402_FACILITATOR_URL is not set, and mock payment is disabled. Payment cannot settle.</p>
        )}
        {quote && (
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="text-2xl font-semibold">{quote.usdcDisplay} USDC</p>
            <p className="mt-1 text-muted">
              {networkLabel(quote.network)} · includes a {quote.safetyMarginBps / 100}% margin and {quote.metadataAllowanceBytes.toLocaleString()} bytes for metadata
            </p>
            <p className="mt-2 font-mono text-xs text-muted">
              Turbo USD {quote.usd} · winston {quote.arweaveWinston} · expires {new Date(quote.expiresAt).toLocaleString()}
            </p>
          </div>
        )}
        {(verify.error || error) && <p className="text-sm text-red-600">{error ?? verify.error?.message}</p>}
        <ol className="space-y-1 font-mono text-xs">
          {log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
        </ol>
        {pinned.error && <p className="text-sm text-red-600">{pinned.error}</p>}
        {pinned.pin && (
          <div className="space-y-2 text-sm">
            <p>Artwork <a className="underline" href={pinned.pin.mediaGatewayUrl}>{pinned.pin.mediaUri}</a></p>
            {pinned.pin.metadataUri && pinned.pin.metadataGatewayUrl && (
              <p>Metadata <a className="underline" href={pinned.pin.metadataGatewayUrl}>{pinned.pin.metadataUri}</a></p>
            )}
            <p className="text-muted">{pinned.pin.mintEnabled ? 'Mint can use the metadata URI.' : 'Mint is still locked.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
