import { describe, expect, it } from 'vitest';
import {
  buildExactPaymentHeader,
  createHttpFacilitator,
  exactAuthorization,
  facilitatorEndpoint,
} from './x402';
import type { X402Accepts } from './types';

const requirement: X402Accepts = {
  scheme: 'exact',
  network: 'eip155:84532',
  amount: '1050000',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  payTo: '0x1111111111111111111111111111111111111111',
  maxTimeoutSeconds: 90,
  extra: { idempotencyKey: 'job-1', name: 'USDC', version: '2' },
};

describe('x402 facilitator client', () => {
  it('keeps the facilitator base path when calling verify and settle', () => {
    expect(facilitatorEndpoint('https://x402.org/facilitator', 'verify')).toBe('https://x402.org/facilitator/verify');
    expect(facilitatorEndpoint('https://x402.org/facilitator/', 'settle')).toBe('https://x402.org/facilitator/settle');
  });

  it('posts an x402 v2 payload and reads the standard settlement fields', async () => {
    const authorization = exactAuthorization({
      requirement,
      from: '0x2222222222222222222222222222222222222222',
      nowSeconds: 1_700_000_000,
      nonce: '0x' + 'ab'.repeat(32),
    });
    expect(authorization.value).toBe(requirement.amount);
    expect(authorization.validBefore).toBe(String(1_700_000_000 + 90));
    const header = buildExactPaymentHeader({ requirement, authorization, signature: '0xsig' });
    const seen: Array<{ url: string; body: { paymentPayload?: { payload: { signature: string } }; paymentRequirements?: { amount: string } }; authorization?: string }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body));
      const requestHeaders = new Headers(init?.headers);
      seen.push({
        url: String(url),
        body,
        authorization: requestHeaders.get('authorization') ?? undefined,
      });
      const path = String(url);
      const payload = path.endsWith('/verify')
        ? { isValid: true, payer: authorization.from }
        : { success: true, transaction: '0xsettled', payer: authorization.from };
      return new Response(JSON.stringify(payload), { status: 200 });
    };
    const facilitator = await createHttpFacilitator('https://facilitator.x402.org/v2', {
      token: 'test-token',
      fetchImpl,
    });
    const verified = await facilitator.verify({ paymentHeader: header, requirement });
    const settled = await facilitator.settle({ paymentHeader: header, requirement });
    expect(verified).toEqual({ valid: true, payer: authorization.from, error: undefined });
    expect(settled).toEqual({ success: true, txHash: '0xsettled', error: undefined });
    expect(seen[0]?.url).toBe('https://facilitator.x402.org/v2/verify');
    expect(seen[0]?.body.paymentPayload?.payload.signature).toBe('0xsig');
    expect(seen[0]?.body.paymentRequirements?.amount).toBe('1050000');
    expect(seen[0]?.authorization).toBe('Bearer test-token');
    expect(seen[1]?.url).toBe('https://facilitator.x402.org/v2/settle');
  });
});
