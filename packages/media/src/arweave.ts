import type { ArweaveAdapter } from './types';

/**
 * Swappable uploader seam. Production pins go through Turbo x402 in the browser;
 * the server adapter is retrieve-only for gateway confirmation. Tests and mock
 * payment mode use {@link createSimulatedArweave}.
 */

const GATEWAYS = ['https://arweave.net', 'https://ar-io.net'];

export function createSimulatedArweave(): ArweaveAdapter {
  const stored = new Map<string, Uint8Array>();
  return {
    async upload({ bytes }) {
      const id = `sim-${Buffer.from(bytes.slice(0, 16)).toString('hex') || crypto.randomUUID()}`;
      stored.set(id, bytes);
      return { id, simulated: true };
    },
    async retrieve(id) {
      const ok = stored.has(id);
      return { ok, gateways: ok ? GATEWAYS : [] };
    },
  };
}

export function createGatewayArweave(upload: ArweaveAdapter['upload']): ArweaveAdapter {
  return {
    upload,
    async retrieve(id) {
      const gateways: string[] = [];
      for (const origin of GATEWAYS) {
        try {
          const response = await fetch(`${origin}/${id}`, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
          if (response.ok) gateways.push(origin);
        } catch {
          // try the next gateway
        }
      }
      return { ok: gateways.length >= 1, gateways };
    },
  };
}

/** Gateway HEAD checks only — used when uploads happen via Turbo x402 on the client. */
export function createRetrieveOnlyArweave(): ArweaveAdapter {
  return createGatewayArweave(async () => {
    throw new Error('Server-side Arweave upload is disabled; use Turbo x402 from the browser');
  });
}

/** @deprecated Operator-funded Turbo credits upload; replaced by client x402. */
export async function createTurboArweave(_privateKey: string): Promise<ArweaveAdapter> {
  return createRetrieveOnlyArweave();
}

export function metadataObject(input: {
  name: string;
  description?: string;
  mimeType: string;
  mediaId: string;
  sha256: string;
  width?: number;
  height?: number;
  animationUrl?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}) {
  const mediaUri = `ar://${input.mediaId}`;
  const isImage = input.mimeType.startsWith('image/');
  const animation_url = input.animationUrl || (isImage ? undefined : mediaUri);
  return {
    name: input.name,
    description: input.description ?? '',
    image: mediaUri,
    ...(animation_url ? { animation_url } : {}),
    ...(input.attributes && input.attributes.length > 0 ? { attributes: input.attributes } : {}),
    content: {
      uri: mediaUri,
      mime: input.mimeType,
      hash: `sha256:${input.sha256}`,
      width: input.width,
      height: input.height,
    },
  };
}
