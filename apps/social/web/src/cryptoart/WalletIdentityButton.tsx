import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

export function WalletIdentityButton() {
  const [open, setOpen] = useState(false);
  const { address, chain, isConnected, isConnecting } = useAccount();
  const { connectors, connectAsync, error, isPending, reset } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  if (isConnected && address) {
    return <div className="group relative">
      <button type="button" className="hover:text-white" aria-label={`Connected wallet ${address}`}>
        {shortAddress(address)}
      </button>
      <div className="invisible absolute right-0 top-full z-50 min-w-48 border border-white bg-black p-3 text-left opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <p className="text-[9px] text-neutral-400">{chain?.name ?? 'Unknown network'}</p>
        <button type="button" className="mt-3 block w-full border border-white px-3 py-2 text-center text-[10px] hover:bg-white hover:text-black" onClick={() => disconnect()}>Disconnect</button>
      </div>
    </div>;
  }

  return <>
    <button type="button" className="hover:text-white" onClick={() => setOpen(true)} disabled={isConnecting}>Connect wallet</button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="wallet-dialog-title" className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 p-3 text-black sm:items-center" onMouseDown={event => { if (event.currentTarget === event.target) setOpen(false); }}>
      <div className="w-full max-w-md border-2 border-black bg-[#dcf54c] p-5 shadow-[8px_8px_0_#f5b0d3] sm:p-7">
        <div className="flex items-start justify-between gap-6">
          <div><p className="text-[10px] uppercase tracking-[0.12em]">Cryptoart identity</p><h2 id="wallet-dialog-title" className="mt-2 text-4xl font-medium leading-none tracking-[-0.04em]">Connect wallet</h2></div>
          <button type="button" aria-label="Close wallet dialog" className="text-2xl leading-none" onClick={() => setOpen(false)}>×</button>
        </div>
        <p className="mt-5 text-sm leading-6">Use an installed browser wallet or Coinbase Wallet. WalletConnect mobile pairing will join this dialog after its connector is stabilized.</p>
        <div className="mt-6 space-y-2">
          {connectors.map(connector => <button key={connector.uid} type="button" disabled={isPending} onClick={() => void connectAsync({ connector }).then(() => setOpen(false)).catch(() => undefined)} className="flex w-full items-center justify-between border border-black bg-white px-4 py-3 text-left text-sm font-medium hover:bg-black hover:text-white disabled:opacity-50">
            <span>{connector.name === 'Injected' ? 'Browser wallet' : connector.name}</span><span aria-hidden="true">→</span>
          </button>)}
        </div>
        {error && <p role="alert" className="mt-4 border border-black bg-[#f5b0d3] p-3 text-xs leading-5">{error.message.includes('rejected') ? 'The wallet request was declined.' : 'That wallet could not connect. Check the wallet and try again.'}</p>}
        <p className="mt-5 text-[9px] uppercase leading-4 tracking-[0.08em]">Connecting is free. Cryptoart will ask for a separate signature before creating a secure account session.</p>
      </div>
    </div>}
  </>;
}
