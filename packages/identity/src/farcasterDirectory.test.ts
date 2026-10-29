import { describe, expect, it, vi } from 'vitest';
import { farcasterDisplayName, fetchFarcasterAccountByAddress, parseFarcasterAccountByAddress } from './farcasterDirectory';

const body = {
  users: [{
    fid: 4905,
    username: 'mxjxn',
    display_name: 'Max Jackson',
    pfp_url: 'https://example.test/pfp.png',
    custody_address: '0x0e43a2acb2fb3d9baa5222b183e0432bee2c65ab',
    verifications: ['0x6da0a1784de1abdde1734ba37eca3d560bf044c0', 'not-an-eth-address'],
  }],
};

describe('Hypersnap address directory', () => {
  it('matches a verified address and keeps only ethereum addresses', () => {
    const account = parseFarcasterAccountByAddress(body, '0x6da0a1784de1abdde1734ba37eca3d560bf044c0');
    expect(account?.fid).toBe(4905);
    expect(farcasterDisplayName(account!)).toBe('@mxjxn');
    expect(account?.verifiedAddresses).toEqual([
      '0x0e43a2acb2fb3d9baa5222b183e0432bee2c65ab',
      '0x6da0a1784de1abdde1734ba37eca3d560bf044c0',
    ]);
  });

  it('does not guess when several users omit the address', () => {
    const data = { users: [{ fid: 1, username: 'a' }, { fid: 2, username: 'b' }] };
    expect(parseFarcasterAccountByAddress(data, '0x0000000000000000000000000000000000000001')).toBeNull();
  });

  it('loads an account without an API key', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const account = await fetchFarcasterAccountByAddress('0x6da0a1784de1abdde1734ba37eca3d560bf044c0', request as typeof fetch, 'https://haatz.quilibrium.com/v2/farcaster');
    expect(account?.username).toBe('mxjxn');
    expect(String(request.mock.calls[0][0])).toBe('https://haatz.quilibrium.com/v2/farcaster/user/bulk-by-address?addresses=0x6da0a1784de1abdde1734ba37eca3d560bf044c0');
    expect(request.mock.calls[0][1].headers).toBeUndefined();
  });
});
