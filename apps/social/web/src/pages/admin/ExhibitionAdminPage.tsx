import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';
import { useSiweSession } from '~/cryptoart/useSiweSession';

type Exhibition = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  curatorAddress: string;
};

async function json(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

export function ExhibitionAdminPage() {
  const queryClient = useQueryClient();
  const { session } = useSiweSession();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const list = useQuery({
    queryKey: ['cryptoart-exhibitions-admin'],
    queryFn: async ({ signal }) => json(await fetch('/api/cryptoart/exhibitions', { signal, credentials: 'include' })) as { exhibitions: Exhibition[] },
    enabled: Boolean(session.data),
    retry: false,
  });
  const create = useMutation({
    mutationFn: async () => json(await fetch('/api/cryptoart/exhibitions', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, slug, description, curatorAddress: session.data?.address, items: [] }),
    })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cryptoart-exhibitions-admin'] }),
  });
  const publish = useMutation({
    mutationFn: async (input: { id: string; action: 'publish' | 'unpublish' }) =>
      json(await fetch(`/api/cryptoart/exhibitions/${input.id}/${input.action}`, { method: 'POST', credentials: 'include' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cryptoart-exhibitions-admin'] }),
  });
  const assign = useMutation({
    mutationFn: async (exhibitionId: string) => json(await fetch('/api/cryptoart/exhibitions/slot/market-current', {
      method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exhibitionId }),
    })),
  });
  return <main className="cryptoart-shell min-h-screen bg-black text-white">
    <CryptoartHeader active="market" />
    <section className="px-4 py-12 sm:px-8 lg:px-12">
      <p className="cryptoart-mono text-[11px] uppercase">Admin · exhibitions</p>
      <h1 className="mt-3 text-5xl font-medium tracking-[-0.05em]">Publish exhibitions</h1>
      {!session.data && <p className="mt-6">Create a SIWE session to draft and publish.</p>}
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <h2 className="text-2xl">New draft</h2>
          <input required placeholder="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} className="w-full border border-white bg-black px-3 py-2 text-sm" />
          <input required placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} className="w-full border border-white bg-black px-3 py-2 text-sm" />
          <textarea placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} className="h-32 w-full border border-white bg-black px-3 py-2 text-sm" />
          <button type="submit" className="bg-[#dcf54c] px-4 py-3 text-black" disabled={!session.data || create.isPending}>Create draft</button>
          {create.error && <p role="alert">{create.error.message}</p>}
        </form>
        <div className="space-y-4">
          {list.data?.exhibitions.map((exhibition) => <article key={exhibition.id} className="border border-white p-4">
            <p className="cryptoart-mono text-[10px] uppercase">{exhibition.status} · {exhibition.slug}</p>
            <h3 className="mt-2 text-2xl">{exhibition.title}</h3>
            <p className="mt-2 text-sm text-neutral-300">{exhibition.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <a className="underline" href={`/exhibitions/${exhibition.slug}`}>Preview</a>
              <button type="button" className="underline" onClick={() => publish.mutate({ id: exhibition.id, action: exhibition.status === 'published' ? 'unpublish' : 'publish' })}>
                {exhibition.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button type="button" className="underline" onClick={() => assign.mutate(exhibition.id)}>Assign to /market</button>
            </div>
          </article>)}
        </div>
      </div>
    </section>
  </main>;
}
