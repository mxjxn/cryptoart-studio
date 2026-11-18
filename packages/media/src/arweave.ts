import type { ArweaveAdapter } from './types';

/**
 * Swappable uploader. Production uses {@link createTurboArweave}. Tests and
 * local dev without `TURBO_PRIVATE_KEY` use {@link createSimulatedArweave}.
 * Callers only see {@link ArweaveAdapter}.
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

export function createUnavailableArweave(reason: string): ArweaveAdapter {
  return {
    async upload() {
      throw new Error(reason);
    },
    async retrieve() {
      return { ok: false, gateways: [] };
    },
  };
}

function turboPrivateKey(privateKey: string): unknown {
  const trimmed = privateKey.trim();
  if (!trimmed) throw new Error('TURBO_PRIVATE_KEY is empty');
  if (!trimmed.startsWith('{')) return trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('TURBO_PRIVATE_KEY is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || !('kty' in parsed)) {
    throw new Error('TURBO_PRIVATE_KEY must be an Arweave JWK');
  }
  return parsed;
}

export async function createTurboArweave(privateKey: string): Promise<ArweaveAdapter> {
  const loaded = await import('@ardrive/turbo-sdk').catch(() => null) as {
    TurboFactory?: { authenticated: (input: { privateKey: unknown }) => {
      uploadFile: (input: {
        fileStreamFactory: () => import('node:stream').Readable;
        fileSizeFactory: () => number;
        dataItemOpts?: { tags?: Array<{ name: string; value: string }> };
      }) => Promise<{ id: string }>;
    } };
  } | null;
  if (!loaded?.TurboFactory) throw new Error('Install @ardrive/turbo-sdk to upload to Arweave');
  const turbo = loaded.TurboFactory.authenticated({ privateKey: turboPrivateKey(privateKey) });
  const { Readable } = await import('node:stream');
  return createGatewayArweave(async ({ bytes, mimeType, tags }) => {
    const itemTags = [
      { name: 'Content-Type', value: mimeType },
      ...Object.entries(tags ?? {})
        .filter(([name]) => name !== 'Content-Type')
        .map(([name, value]) => ({ name, value })),
    ];
    const result = await turbo.uploadFile({
      fileStreamFactory: () => {
        const stream = new Readable();
        stream.push(Buffer.from(bytes));
        stream.push(null);
        return stream;
      },
      fileSizeFactory: () => bytes.byteLength,
      dataItemOpts: { tags: itemTags },
    });
    return { id: result.id };
  });
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
  /** When generative HTML is the primary artifact, set to `html/generative`. */
  animationMimeType?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}) {
  const mediaUri = `ar://${input.mediaId}`;
  const isImage = input.mimeType.startsWith('image/');
  const isGenerativeHtml =
    input.mimeType === 'text/html' || input.animationMimeType === 'html/generative';
  const animation_url = input.animationUrl || (isImage ? undefined : mediaUri);
  const animation_mime_type =
    input.animationMimeType ?? (isGenerativeHtml ? 'html/generative' : undefined);
  return {
    name: input.name,
    description: input.description ?? '',
    image: mediaUri,
    ...(animation_url ? { animation_url } : {}),
    ...(animation_mime_type ? { animation_mime_type } : {}),
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
