import type { ArweaveAdapter } from './types';

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

export async function createTurboArweave(privateKey: string): Promise<ArweaveAdapter> {
  const loaded = await import('@ardrive/turbo-sdk').catch(() => null) as {
    TurboFactory?: { authenticated: (input: { privateKey: string }) => {
      uploadFile: (input: {
        fileStreamFactory: () => import('node:stream').Readable;
        fileSizeFactory: () => number;
      }) => Promise<{ id: string }>;
    } };
  } | null;
  if (!loaded?.TurboFactory) throw new Error('Install @ardrive/turbo-sdk to upload to Arweave');
  const turbo = loaded.TurboFactory.authenticated({ privateKey });
  const { Readable } = await import('node:stream');
  return createGatewayArweave(async ({ bytes, mimeType, tags }) => {
    const result = await turbo.uploadFile({
      fileStreamFactory: () => {
        const stream = new Readable();
        stream.push(Buffer.from(bytes));
        stream.push(null);
        return stream;
      },
      fileSizeFactory: () => bytes.byteLength,
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
}) {
  return {
    name: input.name,
    description: input.description ?? '',
    image: `ar://${input.mediaId}`,
    animation_url: input.mimeType.startsWith('image/') ? undefined : `ar://${input.mediaId}`,
    content: {
      uri: `ar://${input.mediaId}`,
      mime: input.mimeType,
      hash: `sha256:${input.sha256}`,
      width: input.width,
      height: input.height,
    },
  };
}
