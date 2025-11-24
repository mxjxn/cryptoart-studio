import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

/**
 * Derives a private key from a mnemonic phrase and index
 * @param mnemonic - The mnemonic phrase (12 or 24 words)
 * @param index - The derivation index (default: 0)
 * @returns The private key as a hex string (0x-prefixed)
 */
export function derivePrivateKeyFromMnemonic(
  mnemonic: string,
  index: number = 0
): `0x${string}` {
  // Validate mnemonic
  if (!mnemonic || typeof mnemonic !== 'string') {
    throw new Error('Mnemonic must be a non-empty string');
  }

  // Derive seed from mnemonic
  const seed = mnemonicToSeedSync(mnemonic.trim());

  // Create HD key from seed
  const hdkey = HDKey.fromMasterSeed(seed);

  // Derive key at path m/44'/60'/0'/0/{index} (standard Ethereum derivation path)
  const derivedKey = hdkey.derive(`m/44'/60'/0'/0/${index}`);

  if (!derivedKey.privateKey) {
    throw new Error('Failed to derive private key from mnemonic');
  }

  // Convert private key to hex string with 0x prefix
  return `0x${Buffer.from(derivedKey.privateKey).toString('hex')}`;
}

/**
 * Gets the private key from environment variables
 * Prefers MNEMONIC and MNEMONIC_INDEX if present, otherwise falls back to PRIVATE_KEY
 * @param privateKeyEnvVar - Optional environment variable name for private key (default: 'PRIVATE_KEY')
 * @returns The private key as a hex string (0x-prefixed)
 * @throws Error if neither MNEMONIC nor PRIVATE_KEY is set
 */
export function getPrivateKeyFromEnv(privateKeyEnvVar: string = 'PRIVATE_KEY'): `0x${string}` {
  // Prefer mnemonic if available
  const mnemonic = process.env.MNEMONIC;
  if (mnemonic) {
    const index = parseInt(process.env.MNEMONIC_INDEX || '0', 10);
    if (isNaN(index) || index < 0) {
      throw new Error('MNEMONIC_INDEX must be a non-negative integer');
    }
    return derivePrivateKeyFromMnemonic(mnemonic, index);
  }

  // Fall back to private key
  const privateKey = process.env[privateKeyEnvVar];
  if (!privateKey) {
    throw new Error(`Either MNEMONIC or ${privateKeyEnvVar} environment variable must be set`);
  }

  // Ensure private key has 0x prefix
  return privateKey.startsWith('0x') ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`);
}

