import { mergePreviewFallback, pseudoSeedFromPreview, type GenerativePreviewInput } from './preview';

export const RUNTIME_SCRIPT_SRC = '/generative/cryptoart-runtime.js';

/** Inject studio-hosted runtime for iframe preview (replaces production CDN src). */
export function buildStudioPreviewHtml(artistHtml: string, preview: GenerativePreviewInput): string {
  const withRuntime = artistHtml.replace(
    /https:\/\/cryptoart\.studio\/generative\/cryptoart-runtime\.js/g,
    RUNTIME_SCRIPT_SRC,
  );
  const seed = preview.seed ?? pseudoSeedFromPreview(preview);
  const tokenId = preview.tokenId ?? 1;
  const paramQuery = Object.entries(preview.params ?? {})
    .map(([k, v]) => `param.${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const boot = `<script>
    window.__CRYPTOART_PREVIEW__ = ${JSON.stringify(mergePreviewFallback({ mode: 'preview' }, { ...preview, seed, tokenId }))};
  </script>`;
  if (withRuntime.includes('</head>')) {
    return withRuntime.replace('</head>', `${boot}</head>`);
  }
  return `${boot}${withRuntime}`;
}