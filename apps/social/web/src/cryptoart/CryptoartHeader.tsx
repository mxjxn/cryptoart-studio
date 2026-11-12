import { WalletIdentityButton } from './WalletIdentityButton';

export function CryptoartHeader({ active }: { active?: 'feed' | 'market' | 'compose' | 'admin' }) {
  const tab = (name: 'feed' | 'market' | 'compose') =>
    active === name ? 'text-white border-b-2 border-white' : 'text-[#aaa] hover:text-white border-b-2 border-transparent';
  return <>
    <a href="https://cryptoart.social/membership" className="cryptoart-mono block bg-[#f5b0d3] px-4 py-2 text-center text-[11px] font-medium text-black sm:text-xs">
      Support infrastructure &amp; open-source behind cryptoart.social&nbsp;&nbsp; 0.0001 ETH / month
    </a>
    <header className="border-b border-[#333] bg-black px-4 py-4 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <a href="/" aria-label="Cryptoart Social home" className="shrink-0">
          <img src="/cryptoart-logo-wgmeets.png" alt="Cryptoart" className="h-7 w-auto sm:h-8" />
        </a>
        <nav className="flex items-center gap-5 text-sm font-medium" aria-label="Primary">
          <a href="/" className={`pb-0.5 ${tab('feed')}`}>Feed</a>
          <a href="/market" className={`pb-0.5 ${tab('market')}`}>Market</a>
          <a href="/compose" className={`pb-0.5 ${tab('compose')}`}>Compose</a>
          <a href="https://cryptoart.studio" className="pb-0.5 text-[#aaa] hover:text-white">Studio ↗</a>
          {active === 'admin' && <a href="/admin/curators" className="pb-0.5 text-white border-b-2 border-white">Admin</a>}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <a href="/admin/curators" className="cryptoart-mono hidden text-[11px] uppercase tracking-[0.1em] text-[#666] hover:text-white sm:inline">Admin</a>
          <WalletIdentityButton />
        </div>
      </div>
    </header>
  </>;
}
