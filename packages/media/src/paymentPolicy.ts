/**
 * Mock settlement is on only when the operator sets the flag to the exact
 * string "true". `false` (any environment, including development) is a hard
 * deny. Unset follows NODE_ENV: off in production, on in local dev.
 */
export function resolveAllowMockPayment(env: {
  CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT?: string;
  NODE_ENV?: string;
} = {}): boolean {
  const flag = env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT?.trim();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  if (flag) return false;
  return env.NODE_ENV !== 'production';
}

export function isMockPaymentHeader(header: string): boolean {
  return header.trim().toLowerCase().startsWith('mock:');
}
