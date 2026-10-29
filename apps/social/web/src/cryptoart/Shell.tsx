import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { CuratorDirectoryPage } from '~/pages/admin/CuratorDirectoryPage';
import { ExhibitionAdminPage } from '~/pages/admin/ExhibitionAdminPage';
import { ExhibitionPage } from '~/pages/exhibitions/ExhibitionPage';
import { CreateListingPage } from '~/pages/listing/CreateListingPage';
import { ListingPage } from '~/pages/listing/ListingPage';
import { MarketAllPage } from '~/pages/market/MarketAllPage';
import { MarketPage } from '~/pages/market/MarketPage';
import { CryptoartFeed } from './Feed';
import { CryptoartHeader } from './CryptoartHeader';
import { wagmiConfig } from './wagmi';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

function MissingPage() {
  return <main className="cryptoart-shell min-h-screen bg-black text-white">
    <CryptoartHeader active="feed" />
    <p className="p-8 text-sm">This page is not part of Cryptoart yet.</p>
  </main>;
}

export function Shell() {
  return <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CryptoartFeed />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/market/all" element={<MarketAllPage />} />
          <Route path="/listing/eth/:listingId" element={<ListingPage chainHint="eth" />} />
          <Route path="/listing/base/:listingId" element={<ListingPage chainHint="base" />} />
          <Route path="/listing/:listingId" element={<ListingPage chainHint="base" />} />
          <Route path="/create" element={<CreateListingPage />} />
          <Route path="/exhibitions/:slug" element={<ExhibitionPage />} />
          <Route path="/admin" element={<CuratorDirectoryPage />} />
          <Route path="/admin/curators" element={<CuratorDirectoryPage />} />
          <Route path="/admin/exhibitions" element={<ExhibitionAdminPage />} />
          <Route path="*" element={<MissingPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </WagmiProvider>;
}
