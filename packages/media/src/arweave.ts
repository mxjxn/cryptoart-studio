import type { ArweaveAdapter } from './types';

const GATEWAYS = ['https://arweave.net', 'https://ar-io.net'];

/**
 * Simulated Arweave uploader for local development and testing.
 * Does not hit the real Arweave network.
 */
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

/**
 * Gateway-aware wrapper that adds retrieval verification to any upload implementation.
 */
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

/**
 * ArDrive Turbo uploader (paid service, credit-based).
 * Uses the same JWK format as arweave-js for wallet compatibility.
 */
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

/**
 * Direct Arweave L1 uploader using arweave-js.
 * Uses the same JWK format as Turbo for wallet compatibility.
 * 
 * NOTE: This is a stub implementation. To complete:
 * 1. Add arweave-js to dependencies
 * 2. Initialize: Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' })
 * 3. Create transaction: await arweave.createTransaction({ data: bytes }, jwk)
 * 4. Add tags: transaction.addTag(key, value)
 * 5. Sign: await arweave.transactions.sign(transaction, jwk)
 * 6. Post: await arweave.transactions.post(transaction)
 * 7. Return: { id: transaction.id }
 */
export async function createDirectArweave(jwk: string): Promise<ArweaveAdapter> {
  // Stub: parse JWK and validate format
  const key = JSON.parse(jwk);
  if (!key.n || !key.e) {
    throw new Error('Invalid JWK format. Expected RSA key with n and e fields.');
  }
  
  // Direct Arweave L1 uploader is not yet implemented
  // Throw an error in production to prevent silent failures
  const isVercelProduction = process.env.VERCEL_ENV === 'production';
  if (isVercelProduction) {
    throw new Error(
      'Direct Arweave L1 uploader is not implemented. ' +
      'Install arweave-js and complete createDirectArweave() to enable direct uploads, ' +
      'or use ARWEAVE_UPLOADER=turbo instead.'
    );
  }
  
  // In non-production, fall back to simulated uploader with a warning
  console.warn(
    'Direct Arweave L1 uploader is not implemented. ' +
    'Install arweave-js and complete createDirectArweave() to enable direct uploads. ' +
    'Falling back to simulated uploader.'
  );
  return createSimulatedArweave();
  
  /* Full implementation outline:
  const Arweave = await import('arweave');
  const arweave = Arweave.default.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
  });
  
  return createGatewayArweave(async ({ bytes, mimeType, tags }) => {
    const transaction = await arweave.createTransaction({ data: bytes }, key);
    transaction.addTag('Content-Type', mimeType);
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        transaction.addTag(k, v);
      }
    }
    await arweave.transactions.sign(transaction, key);
    await arweave.transactions.post(transaction);
    return { id: transaction.id };
  });
  */
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
