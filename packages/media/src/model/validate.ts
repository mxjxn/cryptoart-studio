import type { ModelFileFormat } from './mime';
import { modelExtensionFromName } from './mime';

/** GLB/glTF use model-viewer; OBJ/FBX load from the pinned file via three.js in the viewer page. */
export type ModelViewerEngine = 'model-viewer' | 'three';

export function viewerEngineForFormat(format: ModelFileFormat): ModelViewerEngine {
  return format === 'obj' || format === 'fbx' ? 'three' : 'model-viewer';
}

export function viewerEngineForFileName(fileName: string): ModelViewerEngine {
  const format = modelExtensionFromName(fileName);
  if (!format) return 'model-viewer';
  return viewerEngineForFormat(format);
}

/**
 * Reject glTF that references separate buffer/texture files we did not pin.
 * Artists should upload GLB or a self-contained glTF (data URIs / GLB buffers).
 */
export function assertSelfContainedGltf(bytes: Uint8Array, fileName: string): void {
  const format = modelExtensionFromName(fileName);
  if (format !== 'gltf') return;
  let json: { buffers?: Array<{ uri?: string }>; images?: Array<{ uri?: string }> };
  try {
    json = JSON.parse(new TextDecoder().decode(bytes)) as typeof json;
  } catch {
    throw new Error('Invalid glTF JSON.');
  }
  for (const buffer of json.buffers ?? []) {
    const uri = buffer.uri?.trim();
    if (uri && !uri.startsWith('data:')) {
      throw new Error(
        'Multi-file glTF is not supported on this pin flow. Export as .glb or embed buffers as data URIs.',
      );
    }
  }
  for (const image of json.images ?? []) {
    const uri = image.uri?.trim();
    if (uri && !uri.startsWith('data:')) {
      throw new Error(
        'glTF with external texture files is not supported. Use .glb or embed textures.',
      );
    }
  }
}