import { getAddress, isAddress, verifyMessage } from 'viem';
import { randomBytes } from 'node:crypto';
import { NONCE_TTL_MS } from './types';

export function normalizeAddress(value: string) {
  if (!isAddress(value)) throw new Error('Invalid wallet address');
  return getAddress(value).toLowerCase();
}

export function randomNonce() {
  return randomBytes(16).toString('hex');
}

export function buildSiweMessage(input: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}) {
  const address = getAddress(input.address);
  return [
    `${input.domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to Cryptoart.',
    '',
    `URI: ${input.uri}`,
    'Version: 1',
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
  ].join('\n');
}

export function parseSiweMessage(message: string) {
  const lines = message.split('\n');
  const domain = lines[0]?.replace(/ wants you to sign in with your Ethereum account:$/, '');
  const address = lines[1];
  const field = (label: string) =>
    lines.find((line) => line.startsWith(`${label}: `))?.slice(label.length + 2);
  if (!domain || !address || !isAddress(address)) throw new Error('Invalid SIWE message');
  const uri = field('URI');
  const nonce = field('Nonce');
  const chainId = Number(field('Chain ID'));
  const issuedAt = field('Issued At');
  const expirationTime = field('Expiration Time');
  if (!uri || !nonce || !Number.isInteger(chainId) || !issuedAt || !expirationTime) {
    throw new Error('Invalid SIWE message');
  }
  return { domain, address: getAddress(address), uri, chainId, nonce, issuedAt, expirationTime };
}

export function nonceExpiry(from = new Date()) {
  return new Date(from.getTime() + NONCE_TTL_MS);
}

export async function verifySiweSignature(message: string, signature: `0x${string}`) {
  const parsed = parseSiweMessage(message);
  const valid = await verifyMessage({
    address: parsed.address,
    message,
    signature,
  });
  if (!valid) throw new Error('SIWE signature is invalid');
  if (Date.parse(parsed.expirationTime) <= Date.now()) throw new Error('SIWE message expired');
  return parsed;
}
