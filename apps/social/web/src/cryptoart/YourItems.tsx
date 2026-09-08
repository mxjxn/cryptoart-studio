import { useAccount } from 'wagmi';
import { WalletIdentityButton } from './WalletIdentityButton';

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function YourItems() {
  const { address, chain, isConnected } = useAccount();
  return <section aria-labelledby="your-items" className="grid border-b border-white bg-[#f5b0d3] text-black md:grid-cols-2">
    <div className="border-b border-black p-8 md:border-b-0 md:border-r lg:p-12">
      <p className="cryptoart-mono text-[11px] uppercase tracking-[0.12em]">Personal collection</p>
      <h2 id="your-items" className="mt-2 text-[clamp(3rem,8vw,6rem)] font-medium leading-[0.82] tracking-[-0.05em]">Your items</h2>
    </div>
    <div className="flex flex-col justify-between gap-8 p-8 lg:p-12">
      {isConnected && address ? <>
        <div>
          <p className="cryptoart-mono text-[10px] uppercase tracking-[0.1em]">Wallet connected · {chain?.name ?? 'network pending'}</p>
          <p className="mt-3 text-2xl font-medium">{shortAddress(address)}</p>
          <p className="mt-4 max-w-xl text-sm leading-6">Ownership discovery is the next adapter in this phase. Your cached works will appear here first while decentralized metadata continues resolving.</p>
        </div>
        <div className="flex flex-wrap gap-2"><a href="https://cryptoart.social/create" className="cryptoart-mono border border-black bg-black px-5 py-3 text-[10px] uppercase tracking-[0.1em] text-white">Create listing</a><a href="https://cryptoart.studio" className="cryptoart-mono border border-black px-5 py-3 text-[10px] uppercase tracking-[0.1em]">Open Studio</a></div>
      </> : <>
        <p className="max-w-xl text-lg leading-7">Connect your wallet to share work, start a conversation, create a listing, or place an item in one of your galleries.</p>
        <div className="cryptoart-mono w-fit border border-black bg-black px-6 py-3 text-xs uppercase tracking-[0.1em] text-white"><WalletIdentityButton /></div>
      </>}
    </div>
  </section>;
}
