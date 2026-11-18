export type GenerativePreviewInput = {
  seed?: string;
  tokenId?: number | string;
  params?: Record<string, string | number | boolean>;
  derived?: Record<string, string | number>;
};

export type GenerativeRuntimeSource = {
  mode: 'preview' | 'live';
  chainId?: number;
  collection?: string;
  extension?: string;
  tokenId?: string;
  rpcUrl?: string;
  seed?: string;
  params?: Record<string, string | number | boolean>;
  derived?: Record<string, string | number>;
};

/** Parse studio / wallet URL overrides (`?cryptoart_preview=1`, hash params). */
export function parseGenerativeUrlOverrides(href: string): GenerativeRuntimeSource {
  const url = new URL(href);
  const preview = url.searchParams.get('cryptoart_preview') === '1' || url.hash.includes('cryptoart_preview=1');
  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('param.')) params[key.slice('param.'.length)] = value;
    if (key.startsWith('derived.')) params[key] = value;
  }
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    for (const [key, value] of hashParams.entries()) {
      if (key.startsWith('param.')) params[key.slice('param.'.length)] = value;
    }
  }

  const tokenId = url.searchParams.get('tokenId') ?? hashParamsFromHash(hash).get('tokenId') ?? undefined;
  const seed = url.searchParams.get('seed') ?? hashParamsFromHash(hash).get('seed') ?? undefined;

  return {
    mode: preview || !url.searchParams.get('chainId') ? 'preview' : 'live',
    chainId: url.searchParams.get('chainId') ? Number(url.searchParams.get('chainId')) : undefined,
    collection: url.searchParams.get('collection') ?? undefined,
    extension: url.searchParams.get('extension') ?? undefined,
    tokenId: tokenId ?? undefined,
    rpcUrl: url.searchParams.get('rpcUrl') ?? undefined,
    seed: seed ?? undefined,
    params,
    derived: {},
  };
}

function hashParamsFromHash(hash: string): URLSearchParams {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(body);
}

export function mergePreviewFallback(
  live: GenerativeRuntimeSource,
  fallback: GenerativePreviewInput,
): GenerativeRuntimeSource {
  if (live.mode === 'live' && live.seed && live.tokenId) return live;
  return {
    ...live,
    mode: live.mode === 'live' && live.seed ? 'live' : 'preview',
    seed: live.seed ?? (fallback.seed != null ? String(fallback.seed) : pseudoSeedFromPreview(fallback)),
    tokenId: live.tokenId ?? (fallback.tokenId != null ? String(fallback.tokenId) : '1'),
    params: { ...fallback.params, ...live.params },
    derived: { ...mapNumericDerived(fallback.derived), ...live.derived },
  };
}

function mapNumericDerived(derived?: Record<string, string | number>) {
  if (!derived) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(derived)) out[key] = String(value);
  return out;
}

export function pseudoSeedFromPreview(input: GenerativePreviewInput): string {
  const basis = JSON.stringify({
    tokenId: input.tokenId ?? 1,
    params: input.params ?? {},
  });
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, '0')}deadbeef`;
}

export function mulberry32(seedHex: string): () => number {
  const cleaned = seedHex.replace(/^0x/, '');
  let a = Number.parseInt(cleaned.slice(0, 8), 16) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}