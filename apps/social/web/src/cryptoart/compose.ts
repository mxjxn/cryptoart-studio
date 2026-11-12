import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createSnapchainSubmitClient,
  getComposeReadiness,
  type ComposeReadiness,
} from './snapchainSubmit';

export type ComposeDraft = {
  text: string;
  /** Optional embed URL (artwork / listing deep link). */
  embedUrl?: string;
  /** Optional parent cast hash for replies (0x…). */
  parentHash?: string;
};

export type ComposePostResult =
  | { status: 202; body: { accepted: false; readiness: ComposeReadiness; message: string } }
  | { status: 501; body: { error: string; readiness: ComposeReadiness } }
  | { status: 400; body: { error: string } }
  | { status: 200; body: { submitted: true; result: unknown } }
  | { status: number; body: { error: string } };

/**
 * Compose publish is gated until submit URL + signer path are ready.
 * When callers pass pre-signed protobuf hex, we forward to Snapchain submit.
 */
export function createComposeService(
  env: Record<string, string | undefined>,
  options: { fetchImpl?: typeof fetch } = {},
) {
  const readiness = () =>
    getComposeReadiness({
      HYPERSNAP_BASE_URL: env.HYPERSNAP_BASE_URL,
      SNAPCHAIN_SUBMIT_URL: env.SNAPCHAIN_SUBMIT_URL,
      SNAPCHAIN_SUBMIT_AUTH: env.SNAPCHAIN_SUBMIT_AUTH,
      CRYPTOART_APP_FID: env.CRYPTOART_APP_FID,
      CRYPTOART_SIGNER_READY: env.CRYPTOART_SIGNER_READY,
    });

  const client = createSnapchainSubmitClient({
    baseUrl: env.SNAPCHAIN_SUBMIT_URL,
    authorization: env.SNAPCHAIN_SUBMIT_AUTH,
    fetchImpl: options.fetchImpl,
  });

  return {
    status(): { status: 200; body: ComposeReadiness } {
      return { status: 200, body: readiness() };
    },

    async publish(input: {
      draft?: ComposeDraft;
      /** Hex-encoded signed Message protobuf (no 0x prefix or with). */
      signedMessageHex?: string;
    }): Promise<ComposePostResult> {
      const current = readiness();
      if (!current.submitConfigured) {
        return {
          status: 202,
          body: {
            accepted: false,
            readiness: current,
            message: 'Compose draft acknowledged, but SNAPCHAIN_SUBMIT_URL is not configured yet.',
          },
        };
      }

      if (!input.signedMessageHex) {
        // Signer/makeCastAdd path not built yet — honest gate.
        return {
          status: 501,
          body: {
            error:
              'Signed cast bytes are required. Gasless app signer + makeCastAdd are not wired; pass signedMessageHex once the signer path is ready, or configure CRYPTOART_SIGNER_READY after KEY_ADD.',
            readiness: current,
          },
        };
      }

      const hex = input.signedMessageHex.replace(/^0x/i, '');
      if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
        return { status: 400, body: { error: 'signedMessageHex must be even-length hex' } };
      }
      const bytes = Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      const result = await client.submitMessageBytes(bytes);
      if (!result.ok) {
        return { status: result.status, body: { error: result.error } };
      }
      return { status: 200, body: { submitted: true, result: result.body } };
    },
  };
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

export function composeMiddleware(env: Record<string, string | undefined>) {
  const service = createComposeService(env);
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/cryptoart/compose' && url.pathname !== '/api/cryptoart/compose/status') {
      return next();
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, no-store');

    try {
      if (url.pathname === '/api/cryptoart/compose/status' || (url.pathname === '/api/cryptoart/compose' && req.method === 'GET')) {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        const result = service.status();
        res.statusCode = result.status;
        res.end(JSON.stringify(result.body));
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const body = (await readJsonBody(req)) as {
        text?: string;
        embedUrl?: string;
        parentHash?: string;
        signedMessageHex?: string;
      };

      const result = await service.publish({
        draft:
          body.text !== undefined
            ? {
                text: String(body.text ?? ''),
                embedUrl: body.embedUrl ? String(body.embedUrl) : undefined,
                parentHash: body.parentHash ? String(body.parentHash) : undefined,
              }
            : undefined,
        signedMessageHex: body.signedMessageHex ? String(body.signedMessageHex) : undefined,
      });
      res.statusCode = result.status;
      res.end(JSON.stringify(result.body));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Compose failed' }));
    }
  };
}
