import { describe, expect, it } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { CAPABILITIES, SESSION_COOKIE } from './types';
import { createMemoryIdentityStore, newGrant } from './store';
import { createIdentityRouter } from './router';
import { hasCapability } from './roles';

function request(partial: {
  method: string;
  pathname: string;
  body?: unknown;
  cookies?: Record<string, string>;
  host?: string;
}): Parameters<ReturnType<typeof createIdentityRouter>['handle']>[0] {
  return {
    method: partial.method,
    pathname: partial.pathname,
    url: new URL('http://localhost:3002' + partial.pathname),
    headers: { host: partial.host ?? 'localhost:3002' },
    body: partial.body ?? {},
    cookies: partial.cookies ?? {},
  };
}

describe('identity roles', () => {
  it('keeps curator feed weight, gallery, and homepage publish independent', () => {
    const address = '0x1111111111111111111111111111111111111111';
    const grants = [
      newGrant({ walletAddress: address, role: 'curator', capability: CAPABILITIES.FEED_WEIGHT, grantedBy: address, scope: { weight: 20 } }),
    ];
    expect(hasCapability(grants, CAPABILITIES.FEED_WEIGHT)).toBe(true);
    expect(hasCapability(grants, CAPABILITIES.GALLERY_MANAGE)).toBe(false);
    expect(hasCapability(grants, CAPABILITIES.HOMEPAGE_PUBLISH)).toBe(false);
  });
});

describe('SIWE sessions and exhibitions', () => {
  it('creates a session from a valid signature and records audit history', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const store = createMemoryIdentityStore();
    const router = createIdentityRouter({ store, ownerAddress: account.address });
    const nonce = await router.handle(request({
      method: 'POST',
      pathname: '/session/nonce',
      body: { address: account.address, chainId: 1, uri: 'http://localhost:3002' },
    }));
    expect(nonce.status).toBe(200);
    const message = (nonce.body as { message: string }).message;
    const signature = await account.signMessage({ message });
    const verified = await router.handle(request({
      method: 'POST',
      pathname: '/session/verify',
      body: { message, signature },
    }));
    expect(verified.status).toBe(200);
    const token = verified.setCookies?.[0]?.value;
    expect(token).toBeTruthy();
    const session = await router.handle(request({
      method: 'GET',
      pathname: '/session',
      cookies: { [SESSION_COOKIE]: token! },
    }));
    expect(session.status).toBe(200);
    expect((session.body as { capabilities: { owner: boolean } }).capabilities.owner).toBe(true);

    const created = await router.handle(request({
      method: 'POST',
      pathname: '/exhibitions',
      cookies: { [SESSION_COOKIE]: token! },
      body: {
        slug: 'works-in-public',
        title: 'Works in Public',
        description: 'Editorial',
        items: [{
          position: 0, chainId: 1, contractAddress: '0x0000000000000000000000000000000000000001',
          tokenId: '1', title: 'Respiration',
        }],
      },
    }));
    expect(created.status).toBe(201);
    const exhibitionId = (created.body as { exhibition: { id: string } }).exhibition.id;
    const published = await router.handle(request({
      method: 'POST',
      pathname: `/exhibitions/${exhibitionId}/publish`,
      cookies: { [SESSION_COOKIE]: token! },
    }));
    expect(published.status).toBe(200);
    const audit = await router.handle(request({
      method: 'GET',
      pathname: '/admin/audit',
      cookies: { [SESSION_COOKIE]: token! },
    }));
    const actions = ((audit.body as { events: Array<{ action: string }> }).events).map((event) => event.action);
    expect(actions).toContain('exhibition.publish');
    expect(actions).toContain('session.created');
  });

  it('rejects a reused nonce', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const router = createIdentityRouter({ store: createMemoryIdentityStore() });
    const nonce = await router.handle(request({
      method: 'POST', pathname: '/session/nonce',
      body: { address: account.address, chainId: 1, uri: 'http://localhost:3002' },
    }));
    const message = (nonce.body as { message: string }).message;
    const signature = await account.signMessage({ message });
    const first = await router.handle(request({ method: 'POST', pathname: '/session/verify', body: { message, signature } }));
    const second = await router.handle(request({ method: 'POST', pathname: '/session/verify', body: { message, signature } }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
  });
});
