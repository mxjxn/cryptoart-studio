import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { composeMiddleware, createComposeService } from './compose';

describe('createComposeService', () => {
  it('reports gated status without submit URL', () => {
    const service = createComposeService({ HYPERSNAP_BASE_URL: 'https://haatz.example/v2/farcaster' });
    const status = service.status();
    expect(status.status).toBe(200);
    expect(status.body.canPublish).toBe(false);
    expect(status.body.submitConfigured).toBe(false);
  });

  it('acknowledges drafts with 202 when submit is missing', async () => {
    const service = createComposeService({});
    const result = await service.publish({ draft: { text: 'hello artwork' } });
    expect(result.status).toBe(202);
    if (result.status === 202) {
      expect(result.body.accepted).toBe(false);
    }
  });

  it('returns 501 when submit is set but signed bytes and signer are missing', async () => {
    const service = createComposeService({
      SNAPCHAIN_SUBMIT_URL: 'https://validator.example.com',
    });
    const result = await service.publish({ draft: { text: 'hello' } });
    expect(result.status).toBe(501);
  });

  it('forwards signed hex to the submit client', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const service = createComposeService(
      {
        SNAPCHAIN_SUBMIT_URL: 'https://validator.example.com',
        CRYPTOART_SIGNER_READY: 'true',
      },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    const result = await service.publish({ signedMessageHex: '0a0b' });
    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalled();
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/octet-stream' });
  });
});

describe('composeMiddleware', () => {
  it('serves GET /api/cryptoart/compose/status', async () => {
    const handler = composeMiddleware({
      SNAPCHAIN_SUBMIT_URL: 'https://validator.example.com',
      CRYPTOART_SIGNER_READY: 'true',
      CRYPTOART_APP_FID: '42',
    });
    const req = { method: 'GET', url: '/api/cryptoart/compose/status' } as IncomingMessage;
    let body = '';
    const res = {
      statusCode: 0,
      setHeader() {},
      end(value: string) {
        body = value;
      },
    } as unknown as ServerResponse;
    await handler(req, res, () => {
      throw new Error('next');
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(body)).toMatchObject({
      submitConfigured: true,
      signerReady: true,
      canPublish: true,
    });
  });
});
