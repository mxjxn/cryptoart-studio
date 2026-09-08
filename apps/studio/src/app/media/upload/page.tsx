'use client';

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectWalletButton } from '~/components/ConnectWalletButton';
import { useStudioSession } from '~/hooks/useStudioSession';

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

export default function MediaUploadProofPage() {
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { session, verify } = useStudioSession();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('Artwork');
  const [log, setLog] = useState<string[]>([]);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  function note(message: string) {
    setLog((current) => [...current, message]);
  }

  async function run(failAfterPay = false) {
    if (!file || !session.data) return;
    setBusy(true);
    setLog([]);
    try {
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256Hex(bytes);
      note(`Hashed ${file.name} → ${sha256.slice(0, 12)}…`);
      const quoted = await fetch('/api/media/quote', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ files: [{ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, sha256 }] }),
      });
      const quoteBody = await quoted.json();
      note(`Quote ${quoted.status}: ${quoteBody.quote?.usdcAmount} USDC on ${quoteBody.quote?.network}`);
      const paid = await fetch('/api/media/jobs', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', 'X-PAYMENT': 'mock:allow' },
        body: JSON.stringify({ idempotencyKey: quoteBody.quote.idempotencyKey, paymentHeader: 'mock:allow' }),
      });
      const paidBody = await paid.json();
      if (!paid.ok) throw new Error(paidBody.error || 'Payment failed');
      note(`Paid job ${paidBody.job.id} (${paidBody.job.status}${paidBody.replayed ? ', replayed' : ''})`);
      setJob(paidBody.job);
      if (failAfterPay) {
        const failed = await fetch(`/api/media/jobs/${paidBody.job.id}/simulate-failure`, { method: 'POST', credentials: 'include' });
        const failedBody = await failed.json();
        setJob(failedBody.job);
        note(`Simulated failure → ${failedBody.job.status}`);
        return;
      }
      const media = await fetch(`/api/media/jobs/${paidBody.job.id}/media`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bytes: toBase64(bytes) }),
      });
      const mediaBody = await media.json();
      if (!media.ok) throw new Error(mediaBody.error || 'Media upload failed');
      note(`Media ${mediaBody.job.media.id}${mediaBody.simulated ? ' (simulated Arweave)' : ''}`);
      const metadata = await fetch(`/api/media/jobs/${paidBody.job.id}/metadata`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const metadataBody = await metadata.json();
      if (!metadata.ok) throw new Error(metadataBody.error || 'Metadata upload failed');
      note(`Metadata ${metadataBody.job.metadata.id}`);
      const confirmed = await fetch(`/api/media/jobs/${paidBody.job.id}/confirm`, { method: 'POST', credentials: 'include' });
      const confirmedBody = await confirmed.json();
      setJob(confirmedBody.job);
      note(confirmedBody.mintEnabled ? 'Confirmed on multiple gateways. Mint is enabled.' : `Not mint-ready: ${confirmedBody.job.status}`);
    } catch (error) {
      note(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="studio-card space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Studio · paid media proof</p>
          <h1 className="mt-2 text-3xl font-bold">x402 + Arweave job</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Hash the file, receive an x402 quote, settle payment, upload media, upload metadata last,
            then confirm retrieval. Mock payment is on until <code>CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT=false</code>.
            Set <code>TURBO_PRIVATE_KEY</code> to send a real Arweave transaction.
          </p>
        </div>
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
          <input className="mt-2 block w-full text-sm" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <label className="block text-sm font-semibold">
          Title
          <input className="mt-2 w-full rounded-lg border border-border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="studio-btn" disabled={!file || !session.data || busy} onClick={() => void run(false)}>
            Quote, pay, upload, confirm
          </button>
          <button type="button" className="studio-btn-outline" disabled={!file || !session.data || busy} onClick={() => void run(true)}>
            Simulate failure after payment
          </button>
        </div>
        {verify.error && <p className="text-sm text-red-600">{verify.error.message}</p>}
        <ol className="space-y-1 font-mono text-xs">
          {log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
        </ol>
        {job && <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-4 text-xs">{JSON.stringify(job, null, 2)}</pre>}
      </div>
    </div>
  );
}
