/**
 * Snapchain / Hypersnap message submit client.
 *
 * Hypersnap `/v2/farcaster/cast` is 501 — casts go here as signed protobuf bytes
 * via Hub HTTP `POST /v1/submitMessage` (or a compatible relay such as imgnAI).
 */

export type SnapchainSubmitConfig = {
  /** Base URL of a writable node, e.g. https://validator.example.com */
  baseUrl?: string | null;
  /** Optional Authorization header value (e.g. `Bearer …` or `Basic …`) */
  authorization?: string | null;
  /** Path appended to baseUrl. Default Hub HTTP message path. */
  submitPath?: string;
  fetchImpl?: typeof fetch;
};

export type ComposeReadiness = {
  readsConfigured: boolean;
  submitConfigured: boolean;
  submitBaseUrl: string | null;
  /** Gasless app-held signer path is not wired yet — compose publishes stay gated. */
  signerReady: boolean;
  canPublish: boolean;
  blockers: string[];
};

export function resolveSubmitUrl(config: SnapchainSubmitConfig): string | null {
  const base = (config.baseUrl ?? '').trim().replace(/\/$/, '');
  if (!base) return null;
  const path = (config.submitPath ?? '/v1/submitMessage').startsWith('/')
    ? (config.submitPath ?? '/v1/submitMessage')
    : `/${config.submitPath}`;
  return `${base}${path}`;
}

export function getComposeReadiness(env: {
  HYPERSNAP_BASE_URL?: string;
  SNAPCHAIN_SUBMIT_URL?: string;
  SNAPCHAIN_SUBMIT_AUTH?: string;
  CRYPTOART_APP_FID?: string;
  CRYPTOART_SIGNER_READY?: string;
}): ComposeReadiness {
  const submitBaseUrl = (env.SNAPCHAIN_SUBMIT_URL ?? '').trim().replace(/\/$/, '') || null;
  const signerReady = env.CRYPTOART_SIGNER_READY === 'true';
  const blockers: string[] = [];
  if (!submitBaseUrl) {
    blockers.push('Set SNAPCHAIN_SUBMIT_URL to a writable Snapchain/Hypersnap submit base (e.g. imgnAI validator).');
  }
  if (!signerReady) {
    blockers.push('App-held gasless signer is not ready (CRYPTOART_SIGNER_READY). Authorize a CAST_ADD-scoped key first.');
  }
  if (!env.CRYPTOART_APP_FID) {
    blockers.push('Optional but recommended: CRYPTOART_APP_FID for SignedKeyRequest metadata when adding gasless signers.');
  }
  return {
    readsConfigured: Boolean((env.HYPERSNAP_BASE_URL ?? '').trim()),
    submitConfigured: Boolean(submitBaseUrl),
    submitBaseUrl,
    signerReady,
    canPublish: Boolean(submitBaseUrl) && signerReady,
    blockers,
  };
}

export function createSnapchainSubmitClient(config: SnapchainSubmitConfig) {
  const request = config.fetchImpl ?? fetch;
  const submitUrl = resolveSubmitUrl(config);

  return {
    submitUrl,
    configured: Boolean(submitUrl),
    /**
     * Submit an already-signed Farcaster `Message` protobuf.
     * Body must be raw bytes (`application/octet-stream`).
     */
    async submitMessageBytes(bytes: Uint8Array): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: string }> {
      if (!submitUrl) {
        return { ok: false, status: 503, error: 'SNAPCHAIN_SUBMIT_URL is not configured' };
      }
      if (!bytes.byteLength) {
        return { ok: false, status: 400, error: 'Empty message bytes' };
      }
      const headers: Record<string, string> = {
        'content-type': 'application/octet-stream',
      };
      if (config.authorization) headers.authorization = config.authorization;

      try {
        const response = await request(submitUrl, {
          method: 'POST',
          headers,
          body: bytes,
        });
        const text = await response.text();
        let body: unknown = text;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          // keep raw text
        }
        if (!response.ok) {
          const err =
            typeof body === 'object' && body && 'error' in body
              ? String((body as { error: unknown }).error)
              : `Submit failed (${response.status})`;
          return { ok: false, status: response.status, error: err };
        }
        return { ok: true, body };
      } catch (error) {
        return {
          ok: false,
          status: 502,
          error: error instanceof Error ? error.message : 'Submit request failed',
        };
      }
    },
  };
}
