import { isAudioMimeType, normalizeMimeType } from './audio/mime';
import { isModelMimeType, modelExtensionFromName, normalizeModelMimeType } from './model/mime';

/** Extensible set for studio, indexer, and social. Generative/HTML mints are handled by another track. */
export type NftMediaType = 'image' | 'video' | 'audio' | 'model' | 'html' | 'generative' | 'unknown';

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
  if (ext === 'glb') return 'model/gltf-binary';
  if (ext === 'gltf') return 'model/gltf+json';
  if (ext === 'obj') return 'model/obj';
  if (ext === 'fbx') return 'model/fbx';
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
  const declared = cryptoart?.mediaType;
  if (declared === 'audio') return 'audio';
  if (declared === 'video') return 'video';
  if (declared === 'image') return 'image';
  if (declared === 'model') return 'model';
  if (declared === 'generative') return 'generative';
  if (declared === 'html') return 'html';

  const properties = asRecord(metadata.properties);
  if (properties?.category === 'audio') return 'audio';
  if (properties?.category === 'model' || properties?.category === '3d') return 'model';

  for (const file of filesFromMetadata(metadata)) {
    const mime = normalizeMimeType(String(file.type ?? file.mime ?? ''));
    if (isAudioMimeType(mime)) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (isModelMimeType(mime)) return 'model';
  }

  const content = asRecord(metadata.content);
  const contentMime = typeof content?.mime === 'string' ? normalizeMimeType(content.mime) : '';
  if (contentMime && isAudioMimeType(contentMime)) return 'audio';
  if (contentMime.startsWith('video/')) return 'video';
  if (isModelMimeType(contentMime)) return 'model';

  const animation = typeof metadata.animation_url === 'string' ? metadata.animation_url : '';
  const animationMime = animation ? mimeFromUrl(animation) : null;
  if (animationMime) {
    if (isAudioMimeType(animationMime)) return 'audio';
    if (animationMime.startsWith('video/')) return 'video';
    if (isModelMimeType(animationMime)) return 'model';
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

export function modelSourceFromMetadata(metadata: Record<string, unknown>): string | null {
  for (const file of filesFromMetadata(metadata)) {
    const mime = normalizeModelMimeType(String(file.type ?? file.mime ?? ''));
    const fileName = typeof (file as { name?: string }).name === 'string' ? (file as { name: string }).name : '';
    if (!isModelMimeType(mime) && !modelExtensionFromName(fileName)) continue;
    const uri = typeof (file as { uri?: string }).uri === 'string' ? (file as { uri: string }).uri : null;
    if (uri) return uri;
  }
  const content = asRecord(metadata.content);
  const contentMime = typeof content?.mime === 'string' ? content.mime : '';
  if (content && typeof content.uri === 'string' && (isModelMimeType(contentMime) || modelExtensionFromName(content.uri))) {
    return content.uri;
  }
  return null;
}