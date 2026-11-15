export const METADATA_ALLOWANCE_BYTES = 8_192;
/** 0.01 USDC. Below this, facilitators and wallets round the charge away. */
export const MIN_USDC_ATOMIC = 10_000n;

export type UploadCost = {
  winston: string;
  usd: number;
  source: 'turbo';
};

export function costFromTurboEstimate(estimate: { amount: unknown; winc: unknown }): UploadCost {
  const winc = typeof estimate.winc === 'string'
    ? estimate.winc
    : typeof estimate.winc === 'number' && Number.isFinite(estimate.winc)
      ? String(estimate.winc)
      : '';
  if (!/^[0-9]+$/.test(winc)) throw new Error('Turbo did not return an integer winc price');
  const amount = typeof estimate.amount === 'number' ? estimate.amount : Number(estimate.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Turbo did not return a usable USD price');
  return { winston: winc, usd: amount, source: 'turbo' };
}

export function sumUploadCosts(parts: UploadCost[]): UploadCost {
  if (!parts.length) throw new Error('At least one Turbo cost is required');
  const usd = parts.reduce((sum, part) => sum + part.usd, 0);
  return {
    winston: parts.reduce((sum, part) => sum + BigInt(part.winston), 0n).toString(),
    // Turbo's fiat estimate is already cent-rounded. Summing those floats
    // (0.06 + 0.01) must not leak a binary artifact into the quote.
    usd: Number(usd.toFixed(6)),
    source: 'turbo',
  };
}

export function withSafetyMargin(value: bigint, safetyMarginBps: number): bigint {
  if (!Number.isInteger(safetyMarginBps) || safetyMarginBps < 0 || safetyMarginBps > 10_000) {
    throw new Error('Safety margin must be an integer from 0 to 10000 basis points');
  }
  return value + (value * BigInt(safetyMarginBps) + 9_999n) / 10_000n;
}

export function usdToUsdcAtomic(usd: number): bigint {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('Invalid USD quote');
  const [whole = '0', frac = ''] = usd.toFixed(6).split('.');
  const frac6 = `${frac}000000`.slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(frac6);
}

export function usdcAtomicFromUsd(usd: number, safetyMarginBps: number): string {
  const charged = withSafetyMargin(usdToUsdcAtomic(usd), safetyMarginBps);
  return (charged < MIN_USDC_ATOMIC ? MIN_USDC_ATOMIC : charged).toString();
}

export function formatUsdc(atomic: string): string {
  if (!/^[0-9]+$/.test(atomic)) throw new Error('USDC amount must be an integer atomic value');
  const value = BigInt(atomic);
  const whole = value / 1_000_000n;
  const frac = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac.length > 0 ? `${whole.toString()}.${frac}` : `${whole.toString()}.00`;
}
