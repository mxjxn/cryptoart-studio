export const HYPERSNAP_FARCASTER_URL = 'https://haatz.quilibrium.com/v2/farcaster';

export type FarcasterAccount = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  custodyAddress: string | null;
  verifiedAddresses: string[];
};

const ETH_ADDRESS = /^0x[0-9a-f]{40}$/;

function listedAddresses(user: Record<string, unknown>): string[] {
  const verifications = Array.isArray(user.verifications) ? user.verifications : [];
  return [user.custody_address, ...verifications]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.toLowerCase());
}

function toAccount(user: Record<string, unknown>): FarcasterAccount {
  const addresses = listedAddresses(user).filter(value => ETH_ADDRESS.test(value));
  return {
    fid: user.fid as number,
    username: typeof user.username === 'string' ? user.username : null,
    displayName: typeof user.display_name === 'string' ? user.display_name : null,
    pfpUrl: typeof user.pfp_url === 'string' ? user.pfp_url : null,
    custodyAddress: typeof user.custody_address === 'string' ? user.custody_address.toLowerCase() : null,
    verifiedAddresses: [...new Set(addresses)],
  };
}

/** Read a Hypersnap `user/bulk-by-address` body. A listed address is not permission to post. */
export function parseFarcasterAccountsByAddress(data: unknown, address: string): FarcasterAccount[] {
  if (!data || typeof data !== 'object') return [];
  const users = (data as { users?: unknown }).users;
  if (!Array.isArray(users) || users.length === 0) return [];
  const records = users.filter((user): user is Record<string, unknown> => !!user && typeof user === 'object' && typeof (user as { fid?: unknown }).fid === 'number');
  const wanted = address.toLowerCase();
  const matched = records.filter(user => listedAddresses(user).includes(wanted));
  const chosen = matched.length > 0 ? matched : records.length === 1 ? records : [];
  return chosen.map(toAccount);
}

/** Read a Hypersnap `user/bulk-by-address` body. This associates an address with a FID. It does not authorize posting. */
export function parseFarcasterAccountByAddress(data: unknown, address: string): FarcasterAccount | null {
  return parseFarcasterAccountsByAddress(data, address)[0] ?? null;
}

export function farcasterDisplayName(account: FarcasterAccount): string | null {
  if (account.username) return `@${account.username.replace(/^@/, '')}`;
  return account.displayName;
}

export async function fetchFarcasterAccountsByAddress(
  address: string,
  request: typeof fetch = fetch,
  baseUrl: string = HYPERSNAP_FARCASTER_URL,
): Promise<FarcasterAccount[]> {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/user/bulk-by-address`);
  url.searchParams.set('addresses', address);
  const response = await request(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return [];
  return parseFarcasterAccountsByAddress(await response.json(), address);
}

export async function fetchFarcasterAccountByAddress(
  address: string,
  request: typeof fetch = fetch,
  baseUrl: string = HYPERSNAP_FARCASTER_URL,
): Promise<FarcasterAccount | null> {
  const accounts = await fetchFarcasterAccountsByAddress(address, request, baseUrl);
  return accounts[0] ?? null;
}
