import { createHash, randomBytes } from 'node:crypto';
import { CAPABILITIES, SESSION_TTL_MS, type AuditEvent, type ExhibitionItemInput, type ExhibitionRecord, type ExhibitionSlot, type Role, type RoleGrant, type SessionRecord, type SiweNonce } from './types';
import { normalizeAddress } from './siwe';

function id() {
  return crypto.randomUUID();
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function issueSessionToken() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export { hashToken };

export interface IdentityStore {
  putNonce(nonce: SiweNonce): Promise<void>;
  consumeNonce(nonce: string, address: string, domain: string): Promise<SiweNonce | null>;
  createSession(session: SessionRecord): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string): Promise<void>;
  listGrants(address?: string): Promise<RoleGrant[]>;
  addGrant(grant: RoleGrant): Promise<void>;
  revokeGrant(id: string, revokedBy: string): Promise<RoleGrant | null>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(limit?: number): Promise<AuditEvent[]>;
  listExhibitions(): Promise<ExhibitionRecord[]>;
  getExhibition(idOrSlug: string): Promise<ExhibitionRecord | null>;
  saveExhibition(record: ExhibitionRecord): Promise<void>;
  getSlot(slotKey: string): Promise<ExhibitionSlot | null>;
  setSlot(slot: ExhibitionSlot): Promise<void>;
}

export function createMemoryIdentityStore(): IdentityStore {
  const nonces = new Map<string, SiweNonce>();
  const sessions = new Map<string, SessionRecord>();
  const grants: RoleGrant[] = [];
  const audit: AuditEvent[] = [];
  const exhibitions = new Map<string, ExhibitionRecord>();
  const slots = new Map<string, ExhibitionSlot>();

  return {
    async putNonce(nonce) { nonces.set(nonce.nonce, nonce); },
    async consumeNonce(nonce, address, domain) {
      const row = nonces.get(nonce);
      if (!row || row.consumedAt) return null;
      if (row.address !== address || row.domain !== domain) return null;
      if (Date.parse(row.expiresAt) <= Date.now()) return null;
      const consumed = { ...row, consumedAt: new Date().toISOString() };
      nonces.set(nonce, consumed);
      return consumed;
    },
    async createSession(session) { sessions.set(session.tokenHash, session); },
    async getSessionByTokenHash(tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session || session.revokedAt) return null;
      if (Date.parse(session.expiresAt) <= Date.now()) return null;
      return session;
    },
    async revokeSession(tokenHash) {
      const session = sessions.get(tokenHash);
      if (session) sessions.set(tokenHash, { ...session, revokedAt: new Date().toISOString() });
    },
    async listGrants(address) {
      return address ? grants.filter((grant) => grant.walletAddress === address) : [...grants];
    },
    async addGrant(grant) { grants.push(grant); },
    async revokeGrant(grantId, revokedBy) {
      const index = grants.findIndex((grant) => grant.id === grantId);
      if (index < 0) return null;
      const current = grants[index]!;
      if (current.revokedAt) return current;
      const updated = { ...current, revokedAt: new Date().toISOString(), revokedBy };
      grants[index] = updated;
      return updated;
    },
    async appendAudit(event) { audit.unshift(event); },
    async listAudit(limit = 100) { return audit.slice(0, limit); },
    async listExhibitions() { return [...exhibitions.values()]; },
    async getExhibition(idOrSlug) {
      for (const record of exhibitions.values()) {
        if (record.id === idOrSlug || record.slug === idOrSlug) return record;
      }
      return null;
    },
    async saveExhibition(record) { exhibitions.set(record.id, record); },
    async getSlot(slotKey) { return slots.get(slotKey) ?? null; },
    async setSlot(slot) { slots.set(slot.slotKey, slot); },
  };
}

export function newGrant(input: {
  walletAddress: string;
  role: Role;
  capability: string;
  scope?: Record<string, unknown> | null;
  grantedBy: string;
  expiresAt?: string | null;
}): RoleGrant {
  return {
    id: id(),
    walletAddress: normalizeAddress(input.walletAddress),
    role: input.role,
    capability: input.capability,
    scope: input.scope ?? null,
    grantedBy: input.grantedBy.startsWith('0x') ? normalizeAddress(input.grantedBy) : input.grantedBy,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    revokedBy: null,
  };
}

export function newAudit(input: Omit<AuditEvent, 'id' | 'occurredAt'> & { occurredAt?: string }): AuditEvent {
  return {
    id: id(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    actorAddress: input.actorAddress.toLowerCase(),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload ?? null,
  };
}

export async function bootstrapOwner(store: IdentityStore, ownerAddress: string | undefined) {
  if (!ownerAddress) return;
  const address = normalizeAddress(ownerAddress);
  const existing = await store.listGrants(address);
  if (existing.some((grant) => grant.role === 'owner' && !grant.revokedAt)) return;
  const grant = newGrant({
    walletAddress: address,
    role: 'owner',
    capability: CAPABILITIES.ALL,
    grantedBy: 'onchain-owner-bootstrap',
  });
  grant.grantedBy = 'onchain-owner-bootstrap';
  await store.addGrant(grant);
  await store.appendAudit(newAudit({
    actorAddress: address,
    action: 'role.bootstrap_owner',
    entityType: 'role_grant',
    entityId: grant.id,
    payload: { address, source: 'documented-onchain-owner' },
  }));
}

export function sessionExpiry(from = new Date()) {
  return new Date(from.getTime() + SESSION_TTL_MS);
}

export function newExhibition(input: {
  slug: string;
  title: string;
  description: string;
  curatorAddress: string;
  curatorLabel?: string;
  createdBy: string;
  items?: ExhibitionItemInput[];
}): ExhibitionRecord {
  const now = new Date().toISOString();
  return {
    id: id(),
    slug: input.slug,
    title: input.title,
    description: input.description,
    curatorAddress: normalizeAddress(input.curatorAddress),
    curatorLabel: input.curatorLabel ?? null,
    status: 'draft',
    createdBy: input.createdBy.toLowerCase(),
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    unpublishedAt: null,
    items: (input.items ?? []).map((item, index) => ({ ...item, id: id(), position: item.position ?? index })),
  };
}
