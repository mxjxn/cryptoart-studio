import { getAddress, isAddress, type Address } from 'viem';

export type AirdropRecipient721 = {
  address: Address;
  uri: string;
  line: number;
};

export type AirdropRecipient1155 = {
  address: Address;
  amount: bigint;
  line: number;
};

export type AirdropParseResult<T> = {
  recipients: T[];
  errors: string[];
  warnings: string[];
};

const MAX_BATCH = 500;
const RECOMMENDED_BATCH = 250;

function splitLines(raw: string): string[] {
  return raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

/** Parse paste or CSV for ERC-721 airdrops: `address` or `address,uri`. */
export function parseAirdrop721(
  raw: string,
  defaultUri = '',
): AirdropParseResult<AirdropRecipient721> {
  const lines = splitLines(raw);
  const recipients: AirdropRecipient721[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    const addrRaw = parts[0]?.trim() ?? '';
    const uri = (parts[1]?.trim() || defaultUri).trim();

    if (addrRaw.toLowerCase() === 'address' || addrRaw.toLowerCase() === 'recipient') {
      return;
    }
    if (!isAddress(addrRaw)) {
      errors.push(`Line ${lineNo}: that doesn’t look like a wallet address (“${addrRaw}”).`);
      return;
    }
    const address = getAddress(addrRaw);
    if (seen.has(address.toLowerCase())) {
      warnings.push(`Line ${lineNo}: ${address} appears more than once (kept).`);
    }
    seen.add(address.toLowerCase());
    if (!uri) {
      errors.push(`Line ${lineNo}: add an artwork link for ${address}, or set a default link.`);
      return;
    }
    recipients.push({ address, uri, line: lineNo });
  });

  if (recipients.length === 0 && errors.length === 0) {
    errors.push('Add at least one recipient.');
  }
  if (recipients.length > MAX_BATCH) {
    errors.push(`Batch too large (${recipients.length}). Max ${MAX_BATCH} per transaction.`);
  } else if (recipients.length > RECOMMENDED_BATCH) {
    warnings.push(
      `${recipients.length} recipients — consider splitting near ${RECOMMENDED_BATCH} for gas.`,
    );
  }

  return { recipients, errors, warnings };
}

/** Parse paste or CSV for ERC-1155: `address,amount`. */
export function parseAirdrop1155(raw: string): AirdropParseResult<AirdropRecipient1155> {
  const lines = splitLines(raw);
  const recipients: AirdropRecipient1155[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    const addrRaw = parts[0]?.trim() ?? '';
    const amountRaw = parts[1]?.trim() ?? '1';

    if (addrRaw.toLowerCase() === 'address' || addrRaw.toLowerCase() === 'recipient') {
      return;
    }
    if (!isAddress(addrRaw)) {
      errors.push(`Line ${lineNo}: that doesn’t look like a wallet address (“${addrRaw}”).`);
      return;
    }
    const address = getAddress(addrRaw);
    if (seen.has(address.toLowerCase())) {
      warnings.push(`Line ${lineNo}: ${address} appears more than once (both amounts will send).`);
    }
    seen.add(address.toLowerCase());
    let amount: bigint;
    try {
      amount = BigInt(amountRaw);
    } catch {
      errors.push(`Line ${lineNo}: amount “${amountRaw}” isn’t a whole number.`);
      return;
    }
    if (amount <= 0n) {
      errors.push(`Line ${lineNo}: amount needs to be at least 1.`);
      return;
    }
    recipients.push({ address, amount, line: lineNo });
  });

  if (recipients.length === 0 && errors.length === 0) {
    errors.push('Add at least one recipient.');
  }
  if (recipients.length > MAX_BATCH) {
    errors.push(`Batch too large (${recipients.length}). Max ${MAX_BATCH} per transaction.`);
  }

  return { recipients, errors, warnings };
}

export const AIRDROP_LIMITS = {
  maxBatch: MAX_BATCH,
  recommendedBatch: RECOMMENDED_BATCH,
} as const;
