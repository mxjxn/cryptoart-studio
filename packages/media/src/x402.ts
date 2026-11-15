import { isMockPaymentHeader } from './paymentPolicy';
import type { Facilitator, X402Accepts } from './types';

const USDC_EIP712: Record<string, { name: string; version: string }> = {
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { name: 'USDC', version: '2' },
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { name: 'USDC', version: '2' },
};

export function usdcEip712Domain(asset: string, override?: { name?: string; version?: string }): { name: string; version: string } {
  const known = USDC_EIP712[asset.toLowerCase()] ?? { name: 'USDC', version: '2' };
  return {
    name: override?.name || known.name,
    version: override?.version || known.version,
  };
}

export function createMockFacilitator(): Facilitator {
  const seen = new Set<string>();
  return {
    kind: 'mock',
    async verify({ paymentHeader, requirement }) {
      if (paymentHeader.trim() === 'mock:allow') return { valid: true, payer: requirement.payTo };
      if (!isMockPaymentHeader(paymentHeader)) return { valid: false, error: 'Unsupported payment header' };
      return { valid: true, payer: paymentHeader.trim().slice(5) };
    },
    async settle({ paymentHeader, requirement }) {
      const key = `${requirement.extra.idempotencyKey}:${paymentHeader.trim()}`;
      if (seen.has(key)) return { success: true, txHash: `0xmock-replay-${requirement.extra.idempotencyKey}` };
      seen.add(key);
      return { success: true, txHash: `0xmock-${requirement.extra.idempotencyKey}` };
    },
  };
}

export function facilitatorEndpoint(baseUrl: string, path: 'verify' | 'settle'): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return `${trimmed}/${path}`;
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export type ExactAuthorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

export function exactAuthorization(input: {
  requirement: X402Accepts;
  from: string;
  nowSeconds: number;
  nonce: string;
}): ExactAuthorization {
  return {
    from: input.from,
    to: input.requirement.payTo,
    value: input.requirement.amount,
    validAfter: '0',
    validBefore: String(input.nowSeconds + input.requirement.maxTimeoutSeconds),
    nonce: input.nonce,
  };
}

export function buildExactPaymentHeader(input: {
  requirement: X402Accepts;
  authorization: ExactAuthorization;
  signature: string;
}): string {
  const payload = {
    x402Version: 2,
    accepted: input.requirement,
    payload: {
      signature: input.signature,
      authorization: input.authorization,
    },
  };
  return encodeBase64(JSON.stringify(payload));
}

export function decodePaymentHeader(header: string): {
  x402Version: number;
  accepted: X402Accepts;
  payload: { signature: string; authorization: ExactAuthorization };
} | null {
  if (!header || isMockPaymentHeader(header)) return null;
  try {
    const parsed = JSON.parse(decodeBase64(header.trim())) as {
      x402Version?: number;
      accepted?: X402Accepts;
      payload?: { signature?: string; authorization?: ExactAuthorization };
    };
    if (parsed.x402Version !== 2 || !parsed.payload?.signature || !parsed.payload.authorization || !parsed.accepted) return null;
    return {
      x402Version: 2,
      accepted: parsed.accepted,
      payload: { signature: parsed.payload.signature, authorization: parsed.payload.authorization },
    };
  } catch {
    return null;
  }
}

export async function createHttpFacilitator(baseUrl: string, options?: {
  token?: string;
  fetchImpl?: typeof fetch;
}): Promise<Facilitator> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options?.token) headers.authorization = `Bearer ${options.token}`;

  async function post(path: 'verify' | 'settle', paymentHeader: string, requirement: X402Accepts) {
    const decoded = decodePaymentHeader(paymentHeader);
    const body = decoded
      ? { x402Version: 2, paymentPayload: decoded, paymentRequirements: requirement }
      : { x402Version: 2, paymentHeader, paymentRequirements: requirement };
    const response = await fetchImpl(facilitatorEndpoint(baseUrl, path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      parsed = {};
    }
    return { ok: response.ok, status: response.status, parsed };
  }

  return {
    kind: 'http',
    async verify({ paymentHeader, requirement }) {
      const result = await post('verify', paymentHeader, requirement);
      if (!result.ok) return { valid: false, error: `Facilitator verify failed (${result.status})` };
      const valid = result.parsed.isValid === true || result.parsed.valid === true;
      return {
        valid,
        payer: stringField(result.parsed, 'payer'),
        error: valid ? undefined : stringField(result.parsed, 'invalidReason') ?? stringField(result.parsed, 'invalidMessage') ?? stringField(result.parsed, 'error') ?? 'Payment invalid',
      };
    },
    async settle({ paymentHeader, requirement }) {
      const result = await post('settle', paymentHeader, requirement);
      if (!result.ok) return { success: false, error: `Facilitator settle failed (${result.status})` };
      const success = result.parsed.success === true;
      return {
        success,
        txHash: stringField(result.parsed, 'transaction') ?? stringField(result.parsed, 'txHash'),
        error: success ? undefined : stringField(result.parsed, 'errorReason') ?? stringField(result.parsed, 'errorMessage') ?? stringField(result.parsed, 'error') ?? 'Settlement failed',
      };
    },
  };
}

export function requirementFromQuote(quote: {
  network: string;
  usdcAmount: string;
  asset: string;
  payTo: string;
  idempotencyKey: string;
}, domain?: { name: string; version: string }): X402Accepts {
  const eip712 = domain ?? usdcEip712Domain(quote.asset);
  return {
    scheme: 'exact',
    network: quote.network,
    amount: quote.usdcAmount,
    asset: quote.asset,
    payTo: quote.payTo,
    maxTimeoutSeconds: 90,
    extra: { idempotencyKey: quote.idempotencyKey, name: eip712.name, version: eip712.version },
  };
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
