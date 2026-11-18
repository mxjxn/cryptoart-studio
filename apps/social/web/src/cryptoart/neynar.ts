import type { Candidate } from './ranking';
import { listingReferences } from './listing-links';
import type { DeskCastEmbeds, DeskQuoteEmbed, DeskVideoEmbed } from './embeds/types';
import { parseTokenUrl } from './embeds/tokenUrls';

export type CastAuthor = {
  fid: number;
  username?: string;
  displayName: string;
  pfp?: { url: string; verified: boolean };
};

export type CastCard = {
  hash: string;
  threadHash: string;
  parentHash?: string;
  parentUrl?: string;
  author: CastAuthor;
  text: string;
  timestamp: number;
  mentions: CastAuthor[];
  channel?: { key: string; name: string; imageUrl?: string };
  reactions: { count: number };
  recasts: { count: number };
  replies: { count: number };
  watches: { count: number };
  embeds: DeskCastEmbeds;
};

type NeynarEmbed = {
  url?: string;
  cast_id?: { hash?: string; fid?: number };
  cast?: {
    hash?: string;
    text?: string;
    timestamp?: string;
    author?: NeynarUser;
  };
  metadata?: {
    content_type?: string;
    image?: { width_px?: number; height_px?: number };
    video?: { width_px?: number; height_px?: number; thumbnail_url?: string };
    html?: { ogTitle?: string; ogDescription?: string; ogSiteName?: string; ogImage?: { url: string }[] };
    frame?: { version?: string; title?: string; image?: string; frames_url?: string };
  };
};

export interface NeynarUser {
  fid: number; username?: string; display_name?: string; pfp_url?: string;
  follower_count?: number; following_count?: number;
  profile?: { bio?: { text?: string } };
  viewer_context?: { blocking?: boolean; blocked_by?: boolean };
}
export interface NeynarCast {
  hash: string; thread_hash?: string; parent_hash?: string | null; parent_url?: string;
  author: NeynarUser; text: string; timestamp: string;
  channel?: { id: string; name?: string; image_url?: string };
  reactions?: { likes_count?: number; recasts_count?: number; likes?: { fid: number }[] };
  replies?: { count?: number };
  mentioned_profiles?: NeynarUser[];
  embeds?: NeynarEmbed[];
  viewer_context?: { liked?: boolean; recasted?: boolean };
}

export interface SocialCandidate extends Candidate {
  cast: CastCard;
  listings: ReturnType<typeof listingReferences>;
}

/** Some media remains PENDING in Neynar; recognize established image delivery URLs. */
function isImage(embed: NeynarEmbed) {
  if (!embed.url) return false;
  if (embed.metadata?.content_type) return embed.metadata.content_type.startsWith('image/');
  try {
    const url = new URL(embed.url);
    return /^https?:$/.test(url.protocol) && (url.hostname === 'imagedelivery.net' ||
      (url.hostname === 'res.cloudinary.com' && url.pathname.includes('/image/upload/')) ||
      /\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname));
  } catch { return false; }
}

function isVideo(embed: NeynarEmbed) {
  if (!embed.url) return false;
  if (embed.metadata?.content_type?.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(embed.url);
}

function quoteFromEmbed(embed: NeynarEmbed): DeskQuoteEmbed | null {
  const hash = embed.cast?.hash ?? embed.cast_id?.hash;
  if (!hash) return null;
  const author = embed.cast?.author;
  return {
    hash,
    text: embed.cast?.text,
    author: author ? {
      username: author.username,
      displayName: author.display_name || author.username,
      pfpUrl: author.pfp_url,
    } : undefined,
  };
}

function user(raw: NeynarUser): CastAuthor {
  return {
    fid: raw.fid,
    username: raw.username,
    displayName: raw.display_name || raw.username || `FID ${raw.fid}`,
    pfp: raw.pfp_url ? { url: raw.pfp_url, verified: false } : undefined,
  };
}

export function normalizeCast(raw: NeynarCast, weightedLikerFids: number[] = []): SocialCandidate {
  const embeds = raw.embeds ?? [];
  const urls = embeds.flatMap(embed => embed.url ? [embed.url] : []);
  const images = embeds.filter(isImage)
    .map(embed => ({ type: 'image' as const, url: embed.url!, sourceUrl: embed.url!, alt: '' }));
  const imageUrls = new Set(images.map(image => image.url));
  const videos: DeskVideoEmbed[] = embeds.filter(isVideo).map(embed => ({
    url: embed.url!,
    sourceUrl: embed.url!,
    width: embed.metadata?.video?.width_px ?? embed.metadata?.image?.width_px,
    height: embed.metadata?.video?.height_px,
    thumbnailUrl: embed.metadata?.video?.thumbnail_url,
  }));
  const videoUrls = new Set(videos.map(video => video.url));
  const quotes: DeskQuoteEmbed[] = embeds.map(quoteFromEmbed).filter((quote): quote is DeskQuoteEmbed => Boolean(quote));
  const quoteHashes = new Set(quotes.map(quote => quote.hash));
  const tokens = [...urls, ...raw.text.match(/chain:\/\/[^\s]+/g) ?? []]
    .map(source => parseTokenUrl(source))
    .filter((token, index, list) => token && list.findIndex(other => other?.raw === token.raw) === index) as NonNullable<ReturnType<typeof parseTokenUrl>>[];

  const links = embeds.filter(embed => embed.url && !imageUrls.has(embed.url) && !videoUrls.has(embed.url) && (embed.metadata?.html || embed.metadata?.frame))
    .map(embed => {
      const html = embed.metadata?.html;
      const frame = embed.metadata?.frame;
      const frameUrl = frame?.frames_url || embed.url!;
      return { type: 'url' as const, openGraph: { url: embed.url!, sourceUrl: embed.url!,
        title: html?.ogTitle, description: html?.ogDescription, image: html?.ogImage?.[0]?.url,
        ...(frame ? { frameEmbedNext: { frameUrl, frameEmbed: { version: '1' as const,
          imageUrl: frame.image || html?.ogImage?.[0]?.url, button: { title: frame.title || 'Open Mini App',
            action: { type: 'launch_miniapp' as const, name: html?.ogSiteName || html?.ogTitle || 'Mini App', url: frameUrl } } } } } : {}) } };
    });
  const linkUrls = new Set(links.map(link => link.openGraph.url));
  const unknowns = urls.filter(url => !imageUrls.has(url) && !videoUrls.has(url) && !linkUrls.has(url)
    && !quoteHashes.has(url) && !tokens.some(token => token.raw === url))
    .map(source => ({ type: 'unknown' as const, source }));
  const timestamp = Date.parse(raw.timestamp);
  const likes = raw.reactions?.likes_count ?? 0;
  const recasts = raw.reactions?.recasts_count ?? 0;
  const replies = raw.replies?.count ?? 0;
  return {
    hash: raw.hash, channel: raw.channel?.id ?? '', timestamp, likes, recasts, replies, weightedLikerFids,
    hidden: raw.author.viewer_context?.blocking || raw.author.viewer_context?.blocked_by,
    listings: listingReferences(raw.text, urls),
    cast: {
      hash: raw.hash, threadHash: raw.thread_hash ?? raw.hash, parentHash: raw.parent_hash ?? undefined,
      parentUrl: raw.parent_url, author: user(raw.author), text: raw.text, timestamp,
      mentions: (raw.mentioned_profiles ?? []).map(user),
      channel: raw.channel ? { key: raw.channel.id, name: raw.channel.name ?? raw.channel.id, imageUrl: raw.channel.image_url } : undefined,
      reactions: { count: likes }, recasts: { count: recasts }, replies: { count: replies }, watches: { count: 0 },
      embeds: { images, urls: links, unknowns, videos, quotes, tokens },
    },
  };
}