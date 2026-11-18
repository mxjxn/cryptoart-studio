export const SUPPORTED_MODEL_MIME_TYPES = new Set([
  'model/gltf-binary',
  'model/gltf+json',
  'model/obj',
  'model/fbx',
  'application/octet-stream',
]);

export type ModelFileFormat = 'glb' | 'gltf' | 'obj' | 'fbx';

export function modelExtensionFromName(fileName: string): ModelFileFormat | null {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  if (ext === 'glb') return 'glb';
  if (ext === 'gltf') return 'gltf';
  if (ext === 'obj') return 'obj';
  if (ext === 'fbx') return 'fbx';
  return null;
}

export function isModelFileName(fileName: string): boolean {
  const ext = modelExtensionFromName(fileName);
  return ext != null;
}

export function guessModelMimeType(fileName: string, hint: string): string {
  const ext = modelExtensionFromName(fileName);
  if (ext === 'glb') return 'model/gltf-binary';
  if (ext === 'gltf') return 'model/gltf+json';
  if (ext === 'obj') return 'model/obj';
  if (ext === 'fbx') return 'model/fbx';
  const normalized = hint.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalized && SUPPORTED_MODEL_MIME_TYPES.has(normalized)) return normalized;
  if (isModelFileName(fileName)) return 'application/octet-stream';
  return hint || 'application/octet-stream';
}

export function normalizeModelMimeType(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function isModelMimeType(mime: string): boolean {
  const normalized = normalizeModelMimeType(mime);
  if (normalized.startsWith('model/')) return true;
  return false;
}

export function isModelUpload(fileName: string, mimeHint: string): boolean {
  if (isModelFileName(fileName)) return true;
  return isModelMimeType(guessModelMimeType(fileName, mimeHint));
}