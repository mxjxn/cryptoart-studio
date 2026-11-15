'use client';

import { useEffect, useState } from 'react';
import { useAccount, useSignMessage, useSwitchChain, useWalletClient } from 'wagmi';
import {
  contentHash,
  metadataObject,
  uploadRawTurboX402FromBrowser,
} from '@cryptoart/media/client';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';
import { useStudioSession } from '~/hooks/useStudioSession';
import { usePinnedMedia } from '../usePinnedMedia';

type MediaConfig = {
  allowMockPayment: boolean;
  network: string | null;
  uploadMode: 'turbo-x402' | 'simulated';
  turboUploadUrl?: string;
};

type UploadQuote = {
  idempotencyKey: string;
  usdcAmount: string;
  usdcDisplay: string;
  usd: number;
  network: string;
  asset: string;
  expiresAt: string;
  safetyMarginBps: number;
  byteCount: number;
  metadataAllowanceBytes: number;
  costSource: string;
  mediaUsdcAmount?: string;
  metadataUsdcAmount?: string;
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

function chainIdFromNetwork(network: string) {
  if (network === 'eip155:84532') return 84532;
  if (network === 'eip155:8453') return 8453;
  if (network === 'eip155:1') return 1;
  return null;
}

export default function MediaUploadPage() {
  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const { session, verify } = useStudioSession();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('Artwork');
  const [config, setConfig] = useState<MediaConfig | null>(null);
  const [quote, setQuote] = useState<UploadQuote | null>(null);
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'quote' | 'pin' | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const pinned = usePinnedMedia(jobId, refreshKey);

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
      const quoted = await fetch('/api/media/quote', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          files: [{ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, sha256 }],
        }),
      });
      const body = await quoted.json() as { quote?: UploadQuote; error?: string };
      if (!quoted.ok || !body.quote) {
        throw new Error(body.error || 'Quote failed');
      }
      setFileBytes(bytes);
      setQuote(body.quote);
      note(`Turbo x402 estimate ${body.quote.usdcDisplay} USDC on ${networkLabel(body.quote.network)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote failed');
    } finally {
      setBusy(null);
    }
  }

  async function payAndPin() {
    if (!file || !session.data || !quote || !fileBytes || !address) return;
    setBusy('pin');
    setError(null);
    try {
      const mediaConfig = config ?? await fetch('/api/media/config', { credentials: 'include' }).then((response) => response.json() as Promise<MediaConfig>);
      if (!mediaConfig) throw new Error('Media config is unavailable');

      const chainId = chainIdFromNetwork(quote.network);
      if (chainId == null) throw new Error(`Unsupported payment network ${quote.network}`);
      if (chain?.id !== chainId) {
        note(`Switching wallet to ${networkLabel(quote.network)}.`);
        await switchChainAsync({ chainId });
      }

      const jobHeaders: Record<string, string> = { 'content-type': 'application/json' };
      if (mediaConfig.allowMockPayment) {
        jobHeaders['X-PAYMENT'] = 'mock:allow';
        jobHeaders['PAYMENT-SIGNATURE'] = 'mock:allow';
        note('Mock payment is enabled in this environment.');
      }

      const paid = await fetch('/api/media/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: jobHeaders,
        body: JSON.stringify({ idempotencyKey: quote.idempotencyKey, quote }),
      });
      const paidBody = await paid.json() as { job?: { id: string; status: string }; error?: string; code?: string };
      if (!paid.ok || !paidBody.job) {
        if (paidBody.code === 'mock_payment_disabled') {
          throw new Error('Mock payment is disabled.');
        }
        throw new Error(paidBody.error || 'Could not start pin job');
      }
      note(`Job ${paidBody.job.id} (${paidBody.job.status}).`);
      setJobId(paidBody.job.id);

      const mimeType = file.type || 'application/octet-stream';
      const fileSha256 = await sha256Hex(fileBytes);

      if (mediaConfig.allowMockPayment && mediaConfig.uploadMode === 'simulated') {
        const media = await fetch(`/api/media/jobs/${paidBody.job.id}/media`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bytes: toBase64(fileBytes) }),
        });
        const mediaBody = await media.json() as { job?: { media?: { id: string } }; error?: string; simulated?: boolean };
        if (!media.ok || !mediaBody.job?.media) throw new Error(mediaBody.error || 'Media upload failed');
        note(mediaBody.simulated ? `Media ${mediaBody.job.media.id} (simulated).` : `Media pinned ${mediaBody.job.media.id}.`);

        const metadata = await fetch(`/api/media/jobs/${paidBody.job.id}/metadata`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const metadataBody = await metadata.json() as { job?: { metadata?: { id: string } }; error?: string };
        if (!metadata.ok || !metadataBody.job?.metadata) throw new Error(metadataBody.error || 'Metadata upload failed');
        note(`Metadata pinned ${metadataBody.job.metadata.id}.`);
      } else {
        if (!walletClient) throw new Error('Connect a wallet that can sign USDC on Base.');
        const mediaCap = BigInt(quote.mediaUsdcAmount ?? quote.usdcAmount);
        note(`Pay Turbo ~${formatAtomic(mediaCap)} USDC for the artwork.`);
        const mediaUpload = await uploadRawTurboX402FromBrowser({
          data: new Uint8Array(fileBytes),
          network: quote.network,
          walletClient,
          maxUsdcAtomic: mediaCap + 10_000n,
          uploadServiceUrl: mediaConfig.turboUploadUrl,
          tags: [
            { name: 'Content-Type', value: mimeType },
            { name: 'File-Hash', value: fileSha256 },
          ],
        });
        note(`Media on Arweave ${mediaUpload.id}.`);

        const media = await fetch(`/api/media/jobs/${paidBody.job.id}/media`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            record: {
              id: mediaUpload.id,
              sha256: fileSha256,
              mimeType,
              size: file.size,
            },
          }),
        });
        const mediaBody = await media.json() as { error?: string };
        if (!media.ok) throw new Error(mediaBody.error || 'Could not register media pin');

        const metadataPayload = metadataObject({
          name,
          mimeType,
          mediaId: mediaUpload.id,
          sha256: fileSha256,
        });
        const metadataBytes = new TextEncoder().encode(JSON.stringify(metadataPayload));
        const metadataSha256 = await contentHash(metadataBytes);
        const metadataCap = BigInt(quote.metadataUsdcAmount ?? '25000');
        note(`Pay Turbo ~${formatAtomic(metadataCap)} USDC for metadata.`);
        const metadataUpload = await uploadRawTurboX402FromBrowser({
          data: metadataBytes,
          network: quote.network,
          walletClient,
          maxUsdcAtomic: metadataCap + 10_000n,
          uploadServiceUrl: mediaConfig.turboUploadUrl,
          tags: [{ name: 'Content-Type', value: 'application/json' }],
        });
        note(`Metadata on Arweave ${metadataUpload.id}.`);

        const metadata = await fetch(`/api/media/jobs/${paidBody.job.id}/metadata`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            record: {
              id: metadataUpload.id,
              sha256: metadataSha256,
              mimeType: 'application/json',
              size: metadataBytes.byteLength,
            },
          }),
        });
        const metadataBody = await metadata.json() as { error?: string };
        if (!metadata.ok) throw new Error(metadataBody.error || 'Could not register metadata pin');
      }

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

  function formatAtomic(atomic: bigint) {
    const whole = atomic / 1_000_000n;
    const frac = (atomic % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="studio-card space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Studio · paid media</p>
          <h1 className="mt-2 text-3xl font-bold">Pin to Arweave</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Hash the file, review Turbo&apos;s x402 price, pay USDC per upload from your wallet, then confirm gateways.
            Mint stays locked until a gateway can read both the artwork and metadata.
          </p>
        </div>
        {config?.uploadMode === 'simulated' && (
          <p className="text-sm text-muted">Mock payment is on, so pins are simulated locally and will not land on Arweave.</p>
        )}
        {config?.uploadMode === 'turbo-x402' && (
          <p className="text-sm text-muted">
            You will sign two USDC x402 payments (artwork, then metadata) to Turbo on {networkLabel(config.network ?? quote?.network ?? 'eip155:84532')}.
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
          Artwork file
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              resetQuote();
            }}
          />
        </label>
        <label className="block text-sm font-semibold">
          Title
          <input className="studio-input mt-2" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="studio-btn disabled:cursor-not-allowed disabled:opacity-40" disabled={!file || !session.data || busy != null} onClick={() => void requestQuote()}>
            {busy === 'quote' ? 'Quoting…' : 'Get quote'}
          </button>
          <button
            type="button"
            className="studio-btn-outline disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!quote || !session.data || busy != null}
            onClick={() => void payAndPin()}
          >
            {busy === 'pin' ? 'Pinning…' : 'Pay Turbo and pin'}
          </button>
        </div>
        {quote && (
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="text-2xl font-semibold">{quote.usdcDisplay} USDC</p>
            <p className="mt-1 text-muted">
              {networkLabel(quote.network)} · two Turbo x402 uploads (media + metadata)
            </p>
            <p className="mt-2 font-mono text-xs text-muted">
              Turbo USD ~{quote.usd} · expires {new Date(quote.expiresAt).toLocaleString()}
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