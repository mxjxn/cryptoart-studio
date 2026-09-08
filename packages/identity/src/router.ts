import { CAPABILITIES, SESSION_COOKIE, SESSION_TTL_MS, type PlatformRequest, type PlatformResponse, type Role } from './types';
import { buildSiweMessage, nonceExpiry, normalizeAddress, randomNonce, verifySiweSignature } from './siwe';
import { assertCanGrant, curatorDirectoryRow, hasCapability, isRole } from './roles';
import { bootstrapOwner, createMemoryIdentityStore, hashToken, issueSessionToken, newAudit, newExhibition, newGrant, sessionExpiry, type IdentityStore } from './store';

function json(status: number, body: unknown, setCookies?: PlatformResponse['setCookies']): PlatformResponse {
  return { status, body, setCookies };
}

function cookie(secure: boolean, maxAge = Math.floor(SESSION_TTL_MS / 1000)) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge, secure };
}

function asRecord(body: unknown) {
  return body && typeof body === 'object' ? body as Record<string, unknown> : {};
}

async function actor(store: IdentityStore, req: PlatformRequest) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await store.getSessionByTokenHash(hashToken(token));
  if (!session) return null;
  const grants = await store.listGrants(session.address);
  return { session, grants };
}

export function createIdentityRouter(options: {
  store?: IdentityStore;
  ownerAddress?: string;
  secureCookies?: boolean;
}) {
  const store = options.store ?? createMemoryIdentityStore();
  const secure = options.secureCookies ?? false;
  let bootstrapped = false;

  async function ready() {
    if (!bootstrapped) {
      await bootstrapOwner(store, options.ownerAddress);
      bootstrapped = true;
    }
    return store;
  }

  return {
    store,
    async handle(req: PlatformRequest): Promise<PlatformResponse> {
      const db = await ready();
      const path = req.pathname.replace(/\/$/, '') || '/';
      const method = req.method.toUpperCase();

      if (path === '/session/nonce' && method === 'POST') {
        const body = asRecord(req.body);
        const address = normalizeAddress(String(body.address ?? ''));
        const domain = String(req.headers.host ?? body.domain ?? 'localhost');
        const uri = String(body.uri ?? `${req.url.protocol}//${domain}`);
        const chainId = Number(body.chainId ?? 1);
        const issuedAt = new Date();
        const expiresAt = nonceExpiry(issuedAt);
        const nonce = randomNonce();
        await db.putNonce({
          nonce,
          address,
          domain,
          uri,
          chainId,
          issuedAt: issuedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          consumedAt: null,
        });
        return json(200, {
          nonce,
          address,
          domain,
          uri,
          chainId,
          issuedAt: issuedAt.toISOString(),
          expirationTime: expiresAt.toISOString(),
          message: buildSiweMessage({
            domain,
            address,
            uri,
            chainId,
            nonce,
            issuedAt: issuedAt.toISOString(),
            expirationTime: expiresAt.toISOString(),
          }),
        });
      }

      if (path === '/session/verify' && method === 'POST') {
        const body = asRecord(req.body);
        const message = String(body.message ?? '');
        const signature = String(body.signature ?? '') as `0x${string}`;
        const parsed = await verifySiweSignature(message, signature);
        const domain = String(req.headers.host ?? parsed.domain);
        if (parsed.domain !== domain) return json(401, { error: 'SIWE domain mismatch' });
        const consumed = await db.consumeNonce(parsed.nonce, parsed.address.toLowerCase(), parsed.domain);
        if (!consumed) return json(401, { error: 'SIWE nonce is invalid or already used' });
        const { token, tokenHash } = issueSessionToken();
        const createdAt = new Date();
        await db.createSession({
          id: crypto.randomUUID(),
          tokenHash,
          address: parsed.address.toLowerCase(),
          chainId: parsed.chainId,
          fid: null,
          domain: parsed.domain,
          createdAt: createdAt.toISOString(),
          expiresAt: sessionExpiry(createdAt).toISOString(),
          revokedAt: null,
        });
        await db.appendAudit(newAudit({
          actorAddress: parsed.address,
          action: 'session.created',
          entityType: 'wallet_session',
          entityId: parsed.address.toLowerCase(),
          payload: { chainId: parsed.chainId, domain: parsed.domain },
        }));
        return json(200, { address: parsed.address.toLowerCase(), chainId: parsed.chainId }, [
          { name: SESSION_COOKIE, value: token, options: cookie(secure) },
        ]);
      }

      if (path === '/session' && method === 'GET') {
        const current = await actor(db, req);
        if (!current) return json(401, { error: 'No session' });
        return json(200, {
          address: current.session.address,
          chainId: current.session.chainId,
          fid: current.session.fid,
          grants: current.grants.filter((grant) => !grant.revokedAt),
          capabilities: {
            owner: hasCapability(current.grants, CAPABILITIES.ALL),
            roles: hasCapability(current.grants, CAPABILITIES.ROLES_MANAGE),
            publish: hasCapability(current.grants, CAPABILITIES.EXHIBITION_PUBLISH),
            submit: hasCapability(current.grants, CAPABILITIES.EXHIBITION_SUBMIT),
          },
        });
      }

      if (path === '/session' && method === 'DELETE') {
        const token = req.cookies[SESSION_COOKIE];
        if (token) await db.revokeSession(hashToken(token));
        return json(200, { ok: true }, [
          { name: SESSION_COOKIE, value: '', options: { ...cookie(secure, 0) } },
        ]);
      }

      if (path === '/admin/roles' && method === 'GET') {
        const current = await actor(db, req);
        if (!current || !hasCapability(current.grants, CAPABILITIES.ROLES_MANAGE)) {
          return json(403, { error: 'Forbidden' });
        }
        const grants = await db.listGrants();
        const addresses = [...new Set(grants.map((grant) => grant.walletAddress))];
        return json(200, {
          curators: addresses.map((address) => curatorDirectoryRow(address, grants)),
          grants,
        });
      }

      if (path === '/admin/roles' && method === 'POST') {
        const current = await actor(db, req);
        if (!current) return json(401, { error: 'No session' });
        const body = asRecord(req.body);
        const role = String(body.role ?? '');
        const capability = String(body.capability ?? '');
        if (!isRole(role) || !capability) return json(400, { error: 'role and capability are required' });
        try {
          assertCanGrant(current.grants, { role: role as Role, capability });
        } catch (error) {
          return json(403, { error: error instanceof Error ? error.message : 'Forbidden' });
        }
        const grant = newGrant({
          walletAddress: String(body.walletAddress ?? ''),
          role: role as Role,
          capability,
          scope: (body.scope as Record<string, unknown> | undefined) ?? null,
          grantedBy: current.session.address,
          expiresAt: body.expiresAt ? String(body.expiresAt) : null,
        });
        await db.addGrant(grant);
        await db.appendAudit(newAudit({
          actorAddress: current.session.address,
          action: 'role.granted',
          entityType: 'role_grant',
          entityId: grant.id,
          payload: { walletAddress: grant.walletAddress, role: grant.role, capability: grant.capability, scope: grant.scope },
        }));
        return json(201, { grant });
      }

      const revoke = /^\/admin\/roles\/([^/]+)$/.exec(path);
      if (revoke && method === 'DELETE') {
        const current = await actor(db, req);
        if (!current || !hasCapability(current.grants, CAPABILITIES.ROLES_MANAGE)) {
          return json(403, { error: 'Forbidden' });
        }
        const updated = await db.revokeGrant(revoke[1]!, current.session.address);
        if (!updated) return json(404, { error: 'Grant not found' });
        await db.appendAudit(newAudit({
          actorAddress: current.session.address,
          action: 'role.revoked',
          entityType: 'role_grant',
          entityId: updated.id,
          payload: { walletAddress: updated.walletAddress, role: updated.role, capability: updated.capability },
        }));
        return json(200, { grant: updated });
      }

      if (path === '/admin/audit' && method === 'GET') {
        const current = await actor(db, req);
        if (!current || !hasCapability(current.grants, CAPABILITIES.ROLES_MANAGE)) {
          return json(403, { error: 'Forbidden' });
        }
        return json(200, { events: await db.listAudit(200) });
      }

      if (path === '/exhibitions' && method === 'GET') {
        const current = await actor(db, req);
        const all = await db.listExhibitions();
        const visible = current && hasCapability(current.grants, CAPABILITIES.EXHIBITION_PUBLISH)
          ? all
          : all.filter((exhibition) => exhibition.status === 'published');
        return json(200, { exhibitions: visible });
      }

      if (path === '/exhibitions' && method === 'POST') {
        const current = await actor(db, req);
        if (!current) return json(401, { error: 'No session' });
        const canSubmit = hasCapability(current.grants, CAPABILITIES.EXHIBITION_SUBMIT)
          || hasCapability(current.grants, CAPABILITIES.EXHIBITION_PUBLISH);
        if (!canSubmit) return json(403, { error: 'Forbidden' });
        const body = asRecord(req.body);
        const exhibition = newExhibition({
          slug: String(body.slug ?? ''),
          title: String(body.title ?? ''),
          description: String(body.description ?? ''),
          curatorAddress: String(body.curatorAddress ?? current.session.address),
          curatorLabel: body.curatorLabel ? String(body.curatorLabel) : undefined,
          createdBy: current.session.address,
          items: Array.isArray(body.items) ? body.items as ExhibitionRecordItems : [],
        });
        if (!exhibition.slug || !exhibition.title) return json(400, { error: 'slug and title are required' });
        await db.saveExhibition(exhibition);
        await db.appendAudit(newAudit({
          actorAddress: current.session.address,
          action: 'exhibition.created',
          entityType: 'exhibition',
          entityId: exhibition.id,
          payload: { slug: exhibition.slug, title: exhibition.title },
        }));
        return json(201, { exhibition });
      }

      const exhibitionMatch = /^\/exhibitions\/([^/]+)$/.exec(path);
      if (exhibitionMatch && method === 'GET') {
        const exhibition = await db.getExhibition(exhibitionMatch[1]!);
        if (!exhibition) return json(404, { error: 'Exhibition not found' });
        if (exhibition.status !== 'published') {
          const current = await actor(db, req);
          const allowed = current && (
            hasCapability(current.grants, CAPABILITIES.EXHIBITION_PUBLISH)
            || current.session.address === exhibition.curatorAddress
          );
          if (!allowed) return json(404, { error: 'Exhibition not found' });
        }
        return json(200, { exhibition });
      }

      if (exhibitionMatch && method === 'PATCH') {
        const current = await actor(db, req);
        if (!current) return json(401, { error: 'No session' });
        const exhibition = await db.getExhibition(exhibitionMatch[1]!);
        if (!exhibition) return json(404, { error: 'Exhibition not found' });
        const canEdit = hasCapability(current.grants, CAPABILITIES.EXHIBITION_PUBLISH)
          || current.session.address === exhibition.curatorAddress;
        if (!canEdit) return json(403, { error: 'Forbidden' });
        const body = asRecord(req.body);
        const next = {
          ...exhibition,
          title: body.title ? String(body.title) : exhibition.title,
          description: body.description !== undefined ? String(body.description) : exhibition.description,
          curatorLabel: body.curatorLabel !== undefined ? String(body.curatorLabel) : exhibition.curatorLabel,
          items: Array.isArray(body.items)
            ? (body.items as ExhibitionRecordItems).map((item, index) => ({
                ...item,
                id: item.id ?? crypto.randomUUID(),
                position: item.position ?? index,
              }))
            : exhibition.items,
          updatedAt: new Date().toISOString(),
        };
        await db.saveExhibition(next);
        await db.appendAudit(newAudit({
          actorAddress: current.session.address,
          action: 'exhibition.updated',
          entityType: 'exhibition',
          entityId: next.id,
          payload: { slug: next.slug },
        }));
        return json(200, { exhibition: next });
      }

      const publish = /^\/exhibitions\/([^/]+)\/(publish|unpublish)$/.exec(path);
      if (publish && method === 'POST') {
        const current = await actor(db, req);
        if (!current || !hasCapability(current.grants, CAPABILITIES.EXHIBITION_PUBLISH)) {
          return json(403, { error: 'Forbidden' });
        }
        const exhibition = await db.getExhibition(publish[1]!);
        if (!exhibition) return json(404, { error: 'Exhibition not found' });
        const now = new Date().toISOString();
        const next = publish[2] === 'publish'
          ? { ...exhibition, status: 'published' as const, publishedAt: now, unpublishedAt: null, updatedAt: now }
          : { ...exhibition, status: 'unpublished' as const, unpublishedAt: now, updatedAt: now };
        await db.saveExhibition(next);
        await db.appendAudit(newAudit({
          actorAddress: current.session.address,
          action: `exhibition.${publish[2]}`,
          entityType: 'exhibition',
          entityId: next.id,
          payload: { slug: next.slug, status: next.status },
        }));
        return json(200, { exhibition: next });
      }

      const slotMatch = /^\/exhibitions\/slot\/([^/]+)$/.exec(path);
      if (slotMatch && method === 'GET') {
        const slot = await db.getSlot(slotMatch[1]!);
        const exhibition = slot?.exhibitionId ? await db.getExhibition(slot.exhibitionId) : null;
        return json(200, { slot, exhibition: exhibition?.status === 'published' ? exhibition : null });
      }

      if (slotMatch && method === 'PUT') {
        const current = await actor(db, req);
        if (!current || !(hasCapability(current.grants, CAPABILITIES.HOMEPAGE_PUBLISH)
          || hasCapability(current.grants, CAPABILITIES.EXHIBITION_PUBLISH))) {
          return json(403, { error: 'Forbidden' });
        }
        const body = asRecord(req.body);
        const exhibitionId = body.exhibitionId ? String(body.exhibitionId) : null;
        const slot = {
          slotKey: slotMatch[1]!,
          exhibitionId,
          assignedBy: current.session.address,
          assignedAt: new Date().toISOString(),
          scheduledAt: body.scheduledAt ? String(body.scheduledAt) : null,
        };
        await db.setSlot(slot);
        await db.appendAudit(newAudit({
          actorAddress: current.session.address,
          action: 'exhibition.slot_assigned',
          entityType: 'exhibition_slot',
          entityId: slot.slotKey,
          payload: { exhibitionId },
        }));
        return json(200, { slot });
      }

      return json(404, { error: 'Not found' });
    },
  };
}

type ExhibitionRecordItems = Array<{
  id?: string;
  position?: number;
  caption?: string;
  chainId: number;
  contractAddress: string;
  tokenId: string;
  listingId?: string;
  title: string;
  artist?: string;
  previewUrl?: string;
  canonicalUrl?: string;
}>;
