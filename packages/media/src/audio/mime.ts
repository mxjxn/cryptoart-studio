const AUDIO_MIME_PREFIX = 'audio/';

export const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'application/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
]);

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'ogg', 'oga', 'm4a', 'aac', 'webm']);

export function normalizeMimeType(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function isAudioMimeType(mime: string): boolean {
  const normalized = normalizeMimeType(mime);
  if (SUPPORTED_AUDIO_MIME_TYPES.has(normalized)) return true;
  return normalized.startsWith(AUDIO_MIME_PREFIX);
}

export function isAudioFileName(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return false;
  return AUDIO_EXTENSIONS.has(fileName.slice(dot + 1).toLowerCase());
}

export function guessAudioMimeType(fileName: string, fallback = 'application/octet-stream'): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'flac': return 'audio/flac';
    case 'ogg':
    case 'oga': return 'audio/ogg';
    case 'm4a': return 'audio/mp4';
    case 'aac': return 'audio/aac';
    case 'webm': return 'audio/webm';
    default: return isAudioMimeType(fallback) ? normalizeMimeType(fallback) : fallback;
  }
}