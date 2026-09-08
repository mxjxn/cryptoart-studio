import { WalletIdentityButton } from './WalletIdentityButton';

export function CryptoartHeader({ active }: { active: 'feed' | 'market' | 'admin' }) {
  const tab = (name: 'feed' | 'market') =>
    active === name ? 'bg-white !text-black' : 'hover:bg-white hover:!text-black';
  return <>
    <a href="https://cryptoart.social/membership" className="cryptoart-mono block bg-[#f5b0d3] px-4 py-2 text-center text-[11px] font-medium text-black sm:text-xs">
      Support infrastructure &amp; open-source behind cryptoart.social&nbsp;&nbsp; 0.0001 ETH / month
    </a>
    <header className="border-b border-[#333] bg-black px-4 pb-0 pt-5 sm:px-8 lg:px-12">
      <div className="cryptoart-mono flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-[#aaa]">
        <span>Cryptoart · social marketplace</span>
        <div className="flex gap-4"><a href="/market" className="hover:text-white">Market</a><a href="/market#exhibitions" className="hover:text-white">Galleries</a><a href="/admin/curators" className="hover:text-white">Admin</a><WalletIdentityButton /></div>
      </div>
      <div className="grid items-end gap-5 py-8 md:grid-cols-[minmax(0,1.4fr)_minmax(230px,0.6fr)] md:py-12">
        <a href="/" aria-label="Cryptoart Social home"><img src="/cryptoart-logo-wgmeets.png" alt="Cryptoart" className="w-full max-w-[650px]" /></a>
        <div className="border-l-2 border-white pl-4 md:mb-2">
          <p className="text-[clamp(2rem,7vw,4.5rem)] font-medium leading-[0.78] tracking-[-0.06em]">SOCIAL</p>
          <p className="cryptoart-mono mt-4 text-xs leading-5 text-[#aaa]">Farcaster as an exhibition, marketplace and public conversation.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 border-x border-t border-[#444] sm:grid-cols-4">
        <a href="/" className={`px-4 py-3 text-center text-sm font-medium ${tab('feed')}`}>Feed</a>
        <a href="/market" className={`border-l border-[#444] px-4 py-3 text-center text-sm ${tab('market')}`}>Market</a>
        <a href="/market#exhibitions" className="border-l border-t border-[#444] px-4 py-3 text-center text-sm hover:bg-white hover:!text-black sm:border-t-0">Galleries</a>
        <a href="/create" className="border-l border-t border-[#444] px-4 py-3 text-center text-sm hover:bg-white hover:!text-black sm:border-t-0">Create listing</a>
      </div>
    </header>
  </>;
}
