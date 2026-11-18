'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  GENERATIVE_TEMPLATES,
  buildStudioPreviewHtml,
  type GenerativeTemplateId,
} from '@cryptoart/generative';
import { GenerativeHowTo } from '~/components/generative/GenerativeHowTo';
import { cn } from '~/lib/utils';

const DEFAULT_TEMPLATE: GenerativeTemplateId = 'p5-starter';

export default function GenerativeStudioPage() {
  const [templateId, setTemplateId] = useState<GenerativeTemplateId>(DEFAULT_TEMPLATE);
  const [source, setSource] = useState(() => GENERATIVE_TEMPLATES[0].html);
  const [hue, setHue] = useState(210);
  const [previewSeed, setPreviewSeed] = useState('0xgenerative-preview');

  const template = useMemo(
    () => GENERATIVE_TEMPLATES.find((t) => t.id === templateId) ?? GENERATIVE_TEMPLATES[0],
    [templateId],
  );

  const loadTemplate = useCallback((id: GenerativeTemplateId) => {
    const next = GENERATIVE_TEMPLATES.find((t) => t.id === id);
    if (!next) return;
    setTemplateId(id);
    setSource(next.html);
  }, []);

  const previewDoc = useMemo(
    () =>
      buildStudioPreviewHtml(source, {
        seed: previewSeed,
        tokenId: 1,
        params: { hue },
      }),
    [hue, previewSeed, source],
  );

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-20 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-extrabold">Generative HTML</h1>
        <p className="max-w-2xl text-muted">
          Starter templates use <code className="text-foreground">window.$cryptoart</code> for seed, params, and
          derived values. Export HTML and pin it on the media page before minting with{' '}
          <code className="text-foreground">html/generative</code> metadata.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Templates</p>
          {GENERATIVE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'rounded-lg border px-4 py-3 text-left text-sm',
                t.id === templateId ? 'border-foreground bg-neutral-50' : 'border-border',
              )}
              onClick={() => loadTemplate(t.id)}
            >
              <span className="font-medium">{t.title}</span>
              <span className="mt-1 block text-muted">{t.description}</span>
            </button>
          ))}
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <label className="block text-sm font-medium">
              Preview seed
              <input
                className="studio-input mt-1 font-mono text-xs"
                value={previewSeed}
                onChange={(e) => setPreviewSeed(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              param.hue
              <input
                type="number"
                className="studio-input mt-1"
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
              />
            </label>
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            <iframe title="Generative preview" className="aspect-square w-full bg-black" srcDoc={previewDoc} />
          </div>
          <label className="block text-sm font-semibold">
            HTML source
            <textarea
              className="studio-textarea mt-2 min-h-[280px] font-mono text-xs"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
            />
          </label>
          <p className="text-sm text-muted">
            Active template: <span className="text-foreground">{template.title}</span>. Replace the runtime script URL
            with your pinned copy before mainnet mint.
          </p>
        </div>
      </div>

      <GenerativeHowTo />
    </div>
  );
}