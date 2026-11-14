'use client';

import { useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import type { Address } from 'viem';
import { AirdropFlow } from '~/components/create/AirdropFlow';
import { BlindDropFlow } from '~/components/create/BlindDropFlow';
import { BurnToMintFlow } from '~/components/create/BurnToMintFlow';
import { LazyMintFlow } from '~/components/create/LazyMintFlow';
import { MediaPermanenceFlow } from '~/components/create/MediaPermanenceFlow';
import type { PreviewScenario } from '~/components/flows/types';
import { cn } from '~/lib/utils';

const PREVIEW_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_STUDIO_PREVIEW === '1';

const MOCK_COLLECTION = {
  id: 'preview-collection',
  name: 'Chromatic Frequencies',
  address: '0xCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc' as Address,
  chainId: 84532,
  image: 'https://picsum.photos/seed/gallery-talks/900/1200',
};

const FLOWS = [
  { id: 'lazy', label: 'Lazy mint' },
  { id: 'blind', label: 'Blind drop' },
  { id: 'burn', label: 'Burn to mint' },
  { id: 'airdrop', label: 'Airdrop' },
  { id: 'media', label: 'Media permanence' },
] as const;

const SCENARIOS: { id: PreviewScenario; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'wallet_missing', label: 'Wallet missing' },
  { id: 'wrong_chain', label: 'Wrong chain' },
  { id: 'validation_error', label: 'Validation errors' },
  { id: 'pending', label: 'Pending tx' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'failed', label: 'Failed tx' },
  { id: 'insufficient_funds', label: 'Insufficient funds' },
  { id: 'empty', label: 'Empty' },
  { id: 'locked', label: 'Locked (blind)' },
  { id: 'revealed', label: 'Revealed (blind)' },
];

type FlowId = (typeof FLOWS)[number]['id'];

function DevPreviewInner() {
  const [flow, setFlow] = useState<FlowId>('lazy');
  const [scenario, setScenario] = useState<PreviewScenario>('default');
  const [standard, setStandard] = useState<'erc721' | 'erc1155'>('erc721');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const scenariosForFlow = useMemo(() => {
    if (flow === 'blind') return SCENARIOS;
    return SCENARIOS.filter((s) => s.id !== 'locked' && s.id !== 'revealed');
  }, [flow]);

  return (
    <div data-theme={theme} className={cn(theme === 'dark' && 'dark', 'min-h-screen bg-background text-foreground')}>
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-4 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Dev preview</p>
              <h1 className="font-display text-2xl text-foreground">Studio create flows</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  theme === 'light' ? 'border-foreground' : 'border-border',
                )}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  theme === 'dark' ? 'border-foreground' : 'border-border',
                )}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FLOWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFlow(item.id)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  flow === item.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">State</span>
            {scenariosForFlow.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScenario(item.id)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  scenario === item.id
                    ? 'border-accent text-accent'
                    : 'border-border text-muted hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
            {(flow === 'lazy' || flow === 'airdrop' || flow === 'burn') && (
              <>
                <span className="ml-2 text-xs text-muted">Standard</span>
                {(['erc721', 'erc1155'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStandard(s)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs',
                      standard === s ? 'border-foreground text-foreground' : 'border-border text-muted',
                    )}
                  >
                    {s === 'erc721' ? '721' : '1155'}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px]" key={`${flow}-${scenario}-${standard}`}>
        {flow === 'lazy' && (
          <LazyMintFlow
            mode="preview"
            previewScenario={scenario}
            collectionId={MOCK_COLLECTION.id}
            collectionName={MOCK_COLLECTION.name}
            collectionAddress={MOCK_COLLECTION.address}
            chainId={MOCK_COLLECTION.chainId}
            tokenStandard={standard}
            marketplaceApproved
            previewImage={MOCK_COLLECTION.image}
          />
        )}
        {flow === 'blind' && (
          <BlindDropFlow
            mode="preview"
            previewScenario={scenario}
            collectionId={MOCK_COLLECTION.id}
            collectionName={MOCK_COLLECTION.name}
            collectionAddress={MOCK_COLLECTION.address}
            chainId={MOCK_COLLECTION.chainId}
            previewImage={MOCK_COLLECTION.image}
            initiallyLocked={scenario === 'locked'}
            initiallyRevealed={scenario === 'revealed'}
          />
        )}
        {flow === 'burn' && (
          <BurnToMintFlow
            mode="preview"
            previewScenario={scenario}
            collectionId={MOCK_COLLECTION.id}
            collectionName={MOCK_COLLECTION.name}
            collectionAddress={MOCK_COLLECTION.address}
            chainId={MOCK_COLLECTION.chainId}
            tokenStandard={standard}
            previewImage={MOCK_COLLECTION.image}
          />
        )}
        {flow === 'airdrop' && (
          <AirdropFlow
            mode="preview"
            previewScenario={scenario}
            collectionId={MOCK_COLLECTION.id}
            collectionName={MOCK_COLLECTION.name}
            collectionAddress={MOCK_COLLECTION.address}
            chainId={MOCK_COLLECTION.chainId}
            tokenStandard={standard}
            previewImage={MOCK_COLLECTION.image}
          />
        )}
        {flow === 'media' && (
          <MediaPermanenceFlow
            mode="preview"
            previewScenario={scenario}
            collectionId={MOCK_COLLECTION.id}
            collectionName={MOCK_COLLECTION.name}
          />
        )}
      </div>
    </div>
  );
}

export default function DevPreviewPage() {
  if (!PREVIEW_ENABLED) {
    notFound();
  }
  return <DevPreviewInner />;
}
