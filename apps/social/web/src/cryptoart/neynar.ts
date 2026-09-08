import type { ApiCast, ApiUser } from 'farcaster-client-data';
import type { Candidate } from './ranking';
import { listingReferences } from './listing-links';

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
  embeds?: { url?: string; metadata?: { content_type?: string; image?: { width_px?: number; height_px?: number };
    html?: { ogTitle?: string; ogDescription?: string; ogSiteName?: string; ogImage?: { url: string }[] };
    frame?: { version?: string; title?: string; image?: string; frames_url?: string } } }[];
  viewer_context?: { liked?: boolean; recasted?: boolean };
}

export interface SocialCandidate extends Candidate {
  cast: ApiCast;
  listings: ReturnType<typeof listingReferences>;
}

/** Some media remains PENDING in Neynar; recognize established image delivery URLs. */
function isImage(embed: NonNullable<NeynarCast['embeds']>[number]) {
  if (!embed.url) return false;
  if (embed.metadata?.content_type) return embed.metadata.content_type.startsWith('image/');
  try {
    const url = new URL(embed.url);
    return /^https?:$/.test(url.protocol) && (url.hostname === 'imagedelivery.net' ||
      (url.hostname === 'res.cloudinary.com' && url.pathname.includes('/image/upload/')) ||
      /\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname));
  } catch { return false; }
}

function user(raw: NeynarUser): ApiUser {
  return { fid: raw.fid, username: raw.username, displayName: raw.display_name || raw.username || `FID ${raw.fid}`,
    pfp: raw.pfp_url ? { url: raw.pfp_url, verified: false } : undefined,
    profile: { bio: { text: raw.profile?.bio?.text ?? '', mentions: [] } },
    followerCount: raw.follower_count ?? 0, followingCount: raw.following_count ?? 0 };
}

export function normalizeCast(raw: NeynarCast, weightedLikerFids: number[] = []): SocialCandidate {
  const urls = (raw.embeds ?? []).flatMap(embed => embed.url ? [embed.url] : []);
  const images = (raw.embeds ?? []).filter(isImage)
    .map(embed => ({ type: 'image' as const, url: embed.url!, sourceUrl: embed.url!, alt: '' }));
  const imageUrls = new Set(images.map(image => image.url));
  const links = (raw.embeds ?? []).filter(embed => embed.url && !imageUrls.has(embed.url) && (embed.metadata?.html || embed.metadata?.frame))
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
      embeds: { images, urls: links, unknowns: urls.filter(url => !imageUrls.has(url) && !linkUrls.has(url)).map(source => ({ type: 'unknown', source })) },
      // The ranking curator is NOT the browsing user. Never copy their viewer_context here.
    },
  };
}
