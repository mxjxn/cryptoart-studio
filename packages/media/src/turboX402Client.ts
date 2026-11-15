/**
 * Browser-only Turbo raw x402 upload. Uses the artist's wallet (viem) and pays
 * Turbo directly — same route as `uploadRawX402Data`, with an explicit chain so
 * Base Sepolia preview works (the SDK default signer is Base mainnet-only).
 */

import { turboX402NetworkFromEip155 } from './turboX402Network';

export const DEFAULT_TURBO_UPLOAD_URL = 'https://upload.ardrive.io';
export const TURBO_X402_UNSIGNED_PATH = '/v1/x402/data-item/unsigned';

export type TurboRawUploadTag = { name: string; value: string };

export type TurboRawUploadResult = {
  id: string;
  winc?: string;
  payer?: string;
};

type WalletClientLike = {
  chain?: { id?: number };
  account?: { address?: string };
};

function parseTurboUploadResponse(body: unknown): TurboRawUploadResult {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const receipt = record.receipt && typeof record.receipt === 'object'
    ? record.receipt as Record<string, unknown>
    : null;
  const id = (typeof record.id === 'string' && record.id)
    || (receipt && typeof receipt.id === 'string' && receipt.id)
    || '';
  if (!id) throw new Error('Turbo upload did not return a transaction id');
  return {
    id,
    winc: typeof record.winc === 'string' ? record.winc : (receipt && typeof receipt.winc === 'string' ? receipt.winc : undefined),
    payer: typeof record.payer === 'string' ? record.payer : undefined,
  };
}

/**
 * Upload raw bytes to Turbo's unsigned x402 endpoint; the browser wallet pays USDC.
 */
export async function uploadRawTurboX402FromBrowser(input: {
  data: Uint8Array;
  tags?: TurboRawUploadTag[];
  /** eip155:8453 or eip155:84532 */
  network: string;
  /** viem WalletClient from wagmi (connected account on the correct chain). */
  walletClient: WalletClientLike;
  /** Hard cap in USDC atomic units (6 decimals). */
  maxUsdcAtomic: bigint;
  uploadServiceUrl?: string;
  signal?: AbortSignal;
}): Promise<TurboRawUploadResult> {
  if (typeof window === 'undefined') throw new Error('Turbo x402 upload is browser-only');
  const x402Network = turboX402NetworkFromEip155(input.network);
  const { wrapFetchWithPayment } = await import('x402-fetch');
  const baseUrl = (input.uploadServiceUrl ?? DEFAULT_TURBO_UPLOAD_URL).replace(/\/+$/, '');
  const url = `${baseUrl}${TURBO_X402_UNSIGNED_PATH}`;
  const fetchWithPay = wrapFetchWithPayment(fetch, input.walletClient as never, input.maxUsdcAtomic);
  void x402Network;
  const headers: Record<string, string> = {
    'content-type': 'application/octet-stream',
  };
  if (input.tags?.length) headers['x-data-item-tags'] = JSON.stringify(input.tags);
  const response = await fetchWithPay(url, {
    method: 'POST',
    headers,
    body: new Uint8Array(input.data),
    signal: input.signal,
  });
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const message = typeof parsed === 'object' && parsed && 'error' in parsed && typeof (parsed as { error?: string }).error === 'string'
      ? (parsed as { error: string }).error
      : text || `Turbo upload failed (${response.status})`;
    throw new Error(message);
  }
  return parseTurboUploadResponse(parsed);
}