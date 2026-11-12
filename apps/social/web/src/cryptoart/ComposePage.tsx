import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CryptoartHeader } from './CryptoartHeader';

type ComposeStatus = {
  readsConfigured: boolean;
  submitConfigured: boolean;
  submitBaseUrl: string | null;
  signerReady: boolean;
  canPublish: boolean;
  blockers: string[];
};

async function fetchComposeStatus(): Promise<ComposeStatus> {
  const response = await fetch('/api/cryptoart/compose/status');
  if (!response.ok) throw new Error('Compose status unavailable');
  return response.json();
}

export function ComposePage() {
  const [params] = useSearchParams();
  const initialText = useMemo(() => params.get('text') ?? '', [params]);
  const [text, setText] = useState(initialText);
  const [embedUrl, setEmbedUrl] = useState(params.get('embed') ?? '');

  const statusQuery = useQuery({
    queryKey: ['compose-status'],
    queryFn: fetchComposeStatus,
    staleTime: 30_000,
  });

  const publish = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/cryptoart/compose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          embedUrl: embedUrl.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      return { status: response.status, body };
    },
  });

  const status = statusQuery.data;
  const gated = !status?.canPublish;

  return (
    <main className="cryptoart-shell min-h-screen bg-black text-white">
      <CryptoartHeader active="compose" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <p className="cryptoart-mono text-[11px] uppercase tracking-[0.18em] text-[#666]">
            Hypersnap write
          </p>
          <h1 className="text-3xl font-medium tracking-tight">Compose</h1>
          <p className="text-sm text-[#aaa]">
            Drafts stay local until a writable Snapchain submit URL and gasless signer are ready.
            Feed reads use Hypersnap HTTP; casts publish via{' '}
            <code className="text-xs text-[#ccc]">POST /v1/submitMessage</code>.
          </p>
        </div>

        {statusQuery.isLoading ? (
          <p className="text-sm text-[#888]">Checking write path…</p>
        ) : statusQuery.isError ? (
          <p className="text-sm text-red-400">Could not load compose status.</p>
        ) : status ? (
          <section className="border border-[#333] bg-[#111] px-4 py-3 text-sm">
            <p className="font-medium text-white">
              {status.canPublish ? 'Write path ready' : 'Write path gated'}
            </p>
            <ul className="mt-2 space-y-1 text-[#aaa]">
              <li>Reads: {status.readsConfigured ? 'configured' : 'default Hypersnap'}</li>
              <li>
                Submit:{' '}
                {status.submitConfigured
                  ? status.submitBaseUrl
                  : 'SNAPCHAIN_SUBMIT_URL not set'}
              </li>
              <li>Signer: {status.signerReady ? 'ready' : 'not ready'}</li>
            </ul>
            {status.blockers.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-[#f5b0d3]">
                {status.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            publish.mutate();
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Cast text</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              maxLength={320}
              placeholder="Share a work, a drop, or a note…"
              className="resize-y border border-[#333] bg-[#0a0a0a] px-3 py-2 text-white outline-none focus:border-[#888]"
            />
            <span className="cryptoart-mono text-[11px] text-[#666]">
              {text.trim().length}/320
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Embed URL (optional)</span>
            <input
              type="url"
              value={embedUrl}
              onChange={(event) => setEmbedUrl(event.target.value)}
              placeholder="https://… listing or artwork"
              className="border border-[#333] bg-[#0a0a0a] px-3 py-2 text-white outline-none focus:border-[#888]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!text.trim() || publish.isPending}
              className="bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {publish.isPending ? 'Submitting…' : gated ? 'Probe write path' : 'Publish cast'}
            </button>
            <a href="/" className="text-sm text-[#aaa] underline-offset-2 hover:text-white hover:underline">
              Back to desk
            </a>
          </div>
        </form>

        {publish.data ? (
          <pre className="overflow-x-auto border border-[#333] bg-[#111] p-3 text-xs text-[#ccc]">
            {JSON.stringify({ httpStatus: publish.data.status, ...publish.data.body }, null, 2)}
          </pre>
        ) : null}
        {publish.isError ? <p className="text-sm text-red-400">Request failed.</p> : null}
      </div>
    </main>
  );
}
