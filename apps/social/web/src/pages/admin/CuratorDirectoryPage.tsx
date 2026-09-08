import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CryptoartHeader } from '~/cryptoart/CryptoartHeader';
import { useSiweSession } from '~/cryptoart/useSiweSession';

type Directory = {
  curators: Array<{
    walletAddress: string;
    roles: string[];
    feedWeight: number;
    galleryManage: boolean;
    exhibitionSubmit: boolean;
    homepagePublish: boolean;
    grants: Array<{ id: string; role: string; capability: string; expiresAt: string | null }>;
  }>;
};

async function json(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

export function CuratorDirectoryPage() {
  const queryClient = useQueryClient();
  const { session } = useSiweSession();
  const [walletAddress, setWalletAddress] = useState('');
  const [capability, setCapability] = useState('feed.weight');
  const [weight, setWeight] = useState('20');
  const directory = useQuery({
    queryKey: ['cryptoart-curators'],
    queryFn: async ({ signal }) => json(await fetch('/api/cryptoart/admin/roles', { signal, credentials: 'include' })) as Directory,
    enabled: Boolean(session.data?.capabilities.roles),
    retry: false,
  });
  const grant = useMutation({
    mutationFn: async () => json(await fetch('/api/cryptoart/admin/roles', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        role: 'curator',
        capability,
        scope: capability === 'feed.weight' ? { weight: Number(weight) } : null,
      }),
    })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cryptoart-curators'] }),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => json(await fetch(`/api/cryptoart/admin/roles/${id}`, { method: 'DELETE', credentials: 'include' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cryptoart-curators'] }),
  });
  return <main className="cryptoart-shell min-h-screen bg-black text-white">
    <CryptoartHeader active="market" />
    <section className="px-4 py-12 sm:px-8 lg:px-12">
      <p className="cryptoart-mono text-[11px] uppercase">Admin · curator directory</p>
      <h1 className="mt-3 text-5xl font-medium tracking-[-0.05em]">Curators</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">Feed weight, gallery management, and homepage publishing are independent grants. Every change is appended to the audit log.</p>
      {!session.data && <p className="mt-6">Create a SIWE session, then return here.</p>}
      {session.data && !session.data.capabilities.roles && <p className="mt-6">This wallet cannot manage roles.</p>}
      {directory.data && <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="cryptoart-mono text-[10px] uppercase text-neutral-500"><tr><th className="pb-3">Wallet</th><th>Roles</th><th>Weight</th><th>Gallery</th><th>Submit</th><th>Homepage</th><th></th></tr></thead>
          <tbody>
            {directory.data.curators.map((row) => <tr key={row.walletAddress} className="border-t border-[#333]">
              <td className="py-3 font-mono text-xs">{row.walletAddress}</td>
              <td>{row.roles.join(', ')}</td>
              <td>{row.feedWeight}</td>
              <td>{row.galleryManage ? 'yes' : 'no'}</td>
              <td>{row.exhibitionSubmit ? 'yes' : 'no'}</td>
              <td>{row.homepagePublish ? 'yes' : 'no'}</td>
              <td>{row.grants.filter((item) => item.role === 'curator').map((item) => <button key={item.id} type="button" className="mr-2 underline" onClick={() => revoke.mutate(item.id)}>Revoke {item.capability}</button>)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      {session.data?.capabilities.roles && <form className="mt-10 max-w-lg space-y-3" onSubmit={(event) => { event.preventDefault(); grant.mutate(); }}>
        <h2 className="text-2xl">Grant curator capability</h2>
        <input required placeholder="0x…" value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} className="w-full border border-white bg-black px-3 py-2 font-mono text-sm" />
        <select value={capability} onChange={(event) => setCapability(event.target.value)} className="w-full border border-white bg-black px-3 py-2 text-sm">
          <option value="feed.weight">Feed ranking weight</option>
          <option value="gallery.manage">Gallery management</option>
          <option value="exhibition.submit">Exhibition submission</option>
          <option value="homepage.publish">Homepage publishing</option>
        </select>
        {capability === 'feed.weight' && <input value={weight} onChange={(event) => setWeight(event.target.value)} className="w-full border border-white bg-black px-3 py-2 text-sm" />}
        <button type="submit" className="bg-[#dcf54c] px-4 py-3 text-black" disabled={grant.isPending}>Grant</button>
        {grant.error && <p role="alert">{grant.error.message}</p>}
      </form>}
    </section>
  </main>;
}
