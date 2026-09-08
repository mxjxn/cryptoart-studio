import type { Facilitator, X402Accepts } from './types';

export function createMockFacilitator(): Facilitator {
  const seen = new Set<string>();
  return {
    async verify({ paymentHeader, requirement }) {
      if (paymentHeader === 'mock:allow') {
        return { valid: true, payer: requirement.payTo };
      }
      if (!paymentHeader.startsWith('mock:')) return { valid: false, error: 'Unsupported payment header' };
      return { valid: true, payer: paymentHeader.slice(5) };
    },
    async settle({ paymentHeader, requirement }) {
      const key = `${requirement.extra.idempotencyKey}:${paymentHeader}`;
      if (seen.has(key)) return { success: true, txHash: `0xmock-replay-${requirement.extra.idempotencyKey}` };
      seen.add(key);
      return { success: true, txHash: `0xmock-${requirement.extra.idempotencyKey}` };
    },
  };
}

export async function createHttpFacilitator(baseUrl: string): Promise<Facilitator> {
  return {
    async verify({ paymentHeader, requirement }) {
      const response = await fetch(new URL('/verify', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentHeader, requirement }),
      });
      if (!response.ok) return { valid: false, error: `Facilitator verify failed (${response.status})` };
      return await response.json() as { valid: boolean; payer?: string; error?: string };
    },
    async settle({ paymentHeader, requirement }) {
      const response = await fetch(new URL('/settle', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentHeader, requirement }),
      });
      if (!response.ok) return { success: false, error: `Facilitator settle failed (${response.status})` };
      return await response.json() as { success: boolean; txHash?: string; error?: string };
    },
  };
}

export function requirementFromQuote(quote: {
  network: string;
  usdcAmount: string;
  asset: string;
  payTo: string;
  idempotencyKey: string;
}): X402Accepts {
  return {
    scheme: 'exact',
    network: quote.network,
    amount: quote.usdcAmount,
    asset: quote.asset,
    payTo: quote.payTo,
    maxTimeoutSeconds: 90,
    extra: { idempotencyKey: quote.idempotencyKey },
  };
}
