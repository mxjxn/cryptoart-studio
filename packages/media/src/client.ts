/**
 * Browser-safe helpers for the paid pin flow.
 * Server routes should keep importing `@cryptoart/media`.
 */
export { formatUsdc, METADATA_ALLOWANCE_BYTES } from './quote';
export { pinnedMediaForMint, DEFAULT_ARWEAVE_GATEWAY, type PinnedMedia } from './pin';
export { metadataObject } from './arweave';
export { turboX402NetworkFromEip155, defaultEip155Network } from './turboX402Network';
export {
  uploadRawTurboX402FromBrowser,
  buildTurboRawX402Post,
  parseTurboUploadResponse,
  DEFAULT_TURBO_UPLOAD_URL,
  TURBO_X402_UNSIGNED_PATH,
  type TurboRawUploadResult,
} from './turboX402Client';
export { isMockPaymentHeader } from './paymentPolicy';
export type { FileQuoteInput, UploadJob, UploadQuote } from './types';

export async function contentHash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}