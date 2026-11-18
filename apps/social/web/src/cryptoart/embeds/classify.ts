import { parseListingUrl } from '../listing-links';
import type { CastCard } from '../neynar';
import { parseTokenUrl } from './tokenUrls';
import type { ClassifiedEmbed, DeskCastEmbeds, DeskEmbedKind, DeskQuoteEmbed, DeskStubKind } from './types';
import { DESK_EMBED_CAP } from './types';

const PRIORITY: DeskEmbedKind[] = [
  'cryptoart-listing',
  'nft-token',
  'frame',
  'quote',
  'video',
  'image',
  'open-graph',
  'plain-link',
  'stub-gallery',
  'stub-studio-collection',
  'stub-burn-to-mint',
  'stub-lssvm-pool',
];

function priorityIndex(kind: DeskEmbedKind) {
  const index = PRIORITY.indexOf(kind);
  return index === -1 ? PRIORITY.length : index;
}

const QUOTE_PATH = /^(?:https?:\/\/)?(?:www\.)?(?:farcaster\.xyz|warpcast\.com)\/([^/?#]+)\/(0x[a-fA-F0-9]+)\/?$/;

function quoteFromUrl(raw: string): DeskQuoteEmbed | null {
  const match = QUOTE_PATH.exec(raw.trim());
  if (!match) return null;
  return { hash: match[2], author: { username: match[1] } };
}

function stubKindForUrl(raw: string): DeskStubKind | null {
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith('cryptoart.studio') && /\/gallery\//i.test(url.pathname)) return 'gallery';
    if (url.hostname.endsWith('cryptoart.studio') && /\/collection\//i.test(url.pathname)) return 'studio-collection';
    if (/burn-to-mint|burntomint/i.test(url.pathname)) return 'burn-to-mint';
    if (/lssvm|sudoswap/i.test(url.hostname + url.pathname)) return 'lssvm-pool';
  } catch { /* ignore */ }
  return null;
}

function textUrls(text: string): string[] {
  const https = (text.match(/https?:\/\/[^\s<>]+/g) ?? []).map(url => url.replace(/[),.!?;]+$/, ''));
  const chain = text.match(/chain:\/\/[^\s]+/g) ?? [];
  return [...new Set([...https, ...chain])];
}

type CollectInput = {
  text: string;
  embeds: DeskCastEmbeds;
};

function collectCandidates({ text, embeds }: CollectInput): ClassifiedEmbed[] {
  const out: ClassifiedEmbed[] = [];
  const seen = new Set<string>();

  const push = (item: ClassifiedEmbed) => {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    out.push(item);
  };

  const urlsInText = textUrls(text);

  for (const ref of [
    ...urlsInText,
    ...embeds.urls.map((u: DeskCastEmbeds['urls'][number]) => u.openGraph.url),
    ...embeds.unknowns.map((u: DeskCastEmbeds['unknowns'][number]) => u.source),
  ]) {
    const listing = parseListingUrl(ref);
    if (listing) {
      push({ kind: 'cryptoart-listing', key: `listing:${listing.chainId}:${listing.listingId}`, listing: { ...listing, originalUrl: ref } });
      continue;
    }
    const token = parseTokenUrl(ref);
    if (token) {
      push({ kind: 'nft-token', key: `token:${token.raw}`, token });
      continue;
    }
    const stub = stubKindForUrl(ref);
    if (stub) {
      push({ kind: `stub-${stub}`, key: `stub:${stub}:${ref}`, href: ref, stub });
    }
    const quote = quoteFromUrl(ref);
    if (quote) {
      push({ kind: 'quote', key: `quote:${quote.hash}`, quote });
    }
  }

  for (const token of embeds.tokens ?? []) {
    push({ kind: 'nft-token', key: `token:${token.raw}`, token });
  }

  for (const url of embeds.urls) {
    const og = url.openGraph;
    if (og.frameEmbedNext) {
      push({
        kind: 'frame',
        key: `frame:${og.frameEmbedNext.frameUrl}`,
        url: og.url,
        frame: og.frameEmbedNext,
      });
      continue;
    }
    const quote = quoteFromUrl(og.url) ?? quoteFromUrl(og.sourceUrl);
    if (quote) {
      push({ kind: 'quote', key: `quote:${quote.hash}`, quote });
      continue;
    }
    if (og.title || og.description || og.image) {
      push({ kind: 'open-graph', key: `og:${og.url}`, urlEmbed: url });
    } else {
      push({ kind: 'plain-link', key: `link:${og.url}`, href: og.url });
    }
  }

  for (const quote of embeds.quotes ?? []) {
    push({ kind: 'quote', key: `quote:${quote.hash}`, quote });
  }

  for (const video of embeds.videos ?? []) {
    push({ kind: 'video', key: `video:${video.url}`, video });
  }

  for (const image of embeds.images ?? []) {
    push({ kind: 'image', key: `image:${image.url}`, image });
  }

  for (const unknown of embeds.unknowns ?? []) {
    const listing = parseListingUrl(unknown.source);
    if (listing) {
      push({ kind: 'cryptoart-listing', key: `listing:${listing.chainId}:${listing.listingId}`, listing: { ...listing, originalUrl: unknown.source } });
      continue;
    }
    const token = parseTokenUrl(unknown.source);
    if (token) {
      push({ kind: 'nft-token', key: `token:${token.raw}`, token });
      continue;
    }
    const stub = stubKindForUrl(unknown.source);
    if (stub) {
      push({ kind: `stub-${stub}`, key: `stub:${stub}:${unknown.source}`, href: unknown.source, stub });
      continue;
    }
    push({ kind: 'plain-link', key: `link:${unknown.source}`, href: unknown.source });
  }

  return out;
}

export function classifyCastEmbeds(cast: CastCard, cap = DESK_EMBED_CAP): ClassifiedEmbed[] {
  const embeds = cast.embeds as DeskCastEmbeds;
  const ranked = collectCandidates({ text: cast.text, embeds })
    .sort((a, b) => priorityIndex(a.kind) - priorityIndex(b.kind));
  return ranked.slice(0, cap);
}

export function embedLayoutClass(count: number) {
  if (count <= 1) return 'mt-2';
  return 'mt-2 flex flex-col gap-2';
}