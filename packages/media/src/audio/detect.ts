import { isAudioMimeType, normalizeMimeType } from './mime';

export type NftMediaType = 'image' | 'audio' | 'video' | 'html' | 'model' | 'unknown';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function mimeFromUrl(url: string): string | null {
  const clean = url.split('?')[0]?.split('#')[0] ?? '';
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = clean.slice(dot + 1).toLowerCase();
  if (['mp3', 'mpeg'].includes(ext)) return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'flac') return 'audio/flac';
  if (['ogg', 'oga'].includes(ext)) return 'audio/ogg';
  if (ext === 'm4a') return 'audio/mp4';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video/mp4';
  if (['glb', 'gltf'].includes(ext)) return 'model/gltf-binary';
  if (['html', 'htm'].includes(ext)) return 'text/html';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image/*';
  return null;
}

function filesFromMetadata(metadata: Record<string, unknown>): Array<{ type?: string; mime?: string }> {
  const properties = asRecord(metadata.properties);
  const files = properties?.files;
  if (!Array.isArray(files)) return [];
  return files.filter((entry) => entry && typeof entry === 'object') as Array<{ type?: string; mime?: string }>;
}

export function detectNftMediaType(metadata: Record<string, unknown>): NftMediaType {
  const cryptoart = asRecord(metadata.cryptoart);
  const mediaType = cryptoart?.mediaType;
  if (mediaType === 'audio') return 'audio';
  if (mediaType === 'video') return 'video';
  if (mediaType === 'image') return 'image';

  const properties = asRecord(metadata.properties);
  if (properties?.category === 'audio') return 'audio';

  for (const file of filesFromMetadata(metadata)) {
    const mime = normalizeMimeType(String(file.type ?? file.mime ?? ''));
    if (isAudioMimeType(mime)) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('model/')) return 'model';
  }

  const content = asRecord(metadata.content);
  const contentMime = typeof content?.mime === 'string' ? normalizeMimeType(content.mime) : '';
  if (contentMime && isAudioMimeType(contentMime)) return 'audio';
  if (contentMime.startsWith('video/')) return 'video';

  const animation = typeof metadata.animation_url === 'string' ? metadata.animation_url : '';
  const animationMime = animation ? mimeFromUrl(animation) : null;
  if (animationMime) {
    if (isAudioMimeType(animationMime)) return 'audio';
    if (animationMime.startsWith('video/')) return 'video';
    if (animationMime === 'text/html') return 'html';
  }

  const image = typeof metadata.image === 'string' ? metadata.image : '';
  const imageMime = image ? mimeFromUrl(image) : null;
  if (imageMime?.startsWith('image/')) return 'image';

  return 'unknown';
}

export function audioSourceFromMetadata(metadata: Record<string, unknown>): string | null {
  for (const file of filesFromMetadata(metadata)) {
    const mime = normalizeMimeType(String(file.type ?? file.mime ?? ''));
    if (!isAudioMimeType(mime)) continue;
    const uri = typeof (file as { uri?: string }).uri === 'string' ? (file as { uri: string }).uri : null;
    if (uri) return uri;
  }
  const content = asRecord(metadata.content);
  if (content && typeof content.uri === 'string' && isAudioMimeType(String(content.mime ?? ''))) {
    return content.uri;
  }
  const animation = typeof metadata.animation_url === 'string' ? metadata.animation_url : '';
  if (animation && isAudioMimeType(mimeFromUrl(animation) ?? '')) return animation;
  return null;
}