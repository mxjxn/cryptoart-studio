import postgres from 'postgres';
import type { IdentityStore } from './store';
import type { AuditEvent, ExhibitionRecord, ExhibitionSlot, RoleGrant } from './types';

type Sql = ReturnType<typeof postgres>;

const clients = new Map<string, Sql>();

function sql(url: string) {
  const existing = clients.get(url);
  if (existing) return existing;
  const client = postgres(url, { max: 1, idle_timeout: 10 });
  clients.set(url, client);
  return client;
}

function grantRow(row: Record<string, unknown>): RoleGrant {
  return {
    id: String(row.id),
    walletAddress: String(row.wallet_address),
    role: row.role as RoleGrant['role'],
    capability: String(row.capability),
    scope: (row.scope as Record<string, unknown> | null) ?? null,
    grantedBy: String(row.granted_by),
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null,
    revokedBy: row.revoked_by ? String(row.revoked_by) : null,
  };
}

export function createPostgresIdentityStore(connectionString: string): IdentityStore {
  const db = sql(connectionString);

  return {
    async putNonce(nonce: SiweNonce) {
      await db`INSERT INTO siwe_nonces ${db({
        nonce: nonce.nonce,
        address: nonce.address,
        domain: nonce.domain,
        uri: nonce.uri,
        chain_id: nonce.chainId,
        issued_at: nonce.issuedAt,
        expires_at: nonce.expiresAt,
        consumed_at: nonce.consumedAt,
      })}`;
    },
    async consumeNonce(nonce, address, domain) {
      const rows = await db<Record<string, unknown>[]>`
        UPDATE siwe_nonces
        SET consumed_at = NOW()
        WHERE nonce = ${nonce}
          AND address = ${address}
          AND domain = ${domain}
          AND consumed_at IS NULL
          AND expires_at > NOW()
        RETURNING *`;
      const row = rows[0];
      if (!row) return null;
      return {
        nonce: String(row.nonce),
        address: String(row.address),
        domain: String(row.domain),
        uri: String(row.uri),
        chainId: Number(row.chain_id),
        issuedAt: new Date(String(row.issued_at)).toISOString(),
        expiresAt: new Date(String(row.expires_at)).toISOString(),
        consumedAt: row.consumed_at ? new Date(String(row.consumed_at)).toISOString() : null,
      };
    },
    async createSession(session: SessionRecord) {
      await db`INSERT INTO wallet_sessions ${db({
        id: session.id,
        token_hash: session.tokenHash,
        address: session.address,
        chain_id: session.chainId,
        fid: session.fid,
        domain: session.domain,
        created_at: session.createdAt,
        expires_at: session.expiresAt,
        revoked_at: session.revokedAt,
        last_seen_at: session.createdAt,
      })}`;
    },
    async getSessionByTokenHash(tokenHash) {
      const rows = await db<Record<string, unknown>[]>`
        SELECT * FROM wallet_sessions
        WHERE token_hash = ${tokenHash}
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1`;
      const row = rows[0];
      if (!row) return null;
      return {
        id: String(row.id),
        tokenHash: String(row.token_hash),
        address: String(row.address),
        chainId: Number(row.chain_id),
        fid: row.fid === null ? null : Number(row.fid),
        domain: String(row.domain),
        createdAt: new Date(String(row.created_at)).toISOString(),
        expiresAt: new Date(String(row.expires_at)).toISOString(),
        revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null,
      };
    },
    async revokeSession(tokenHash) {
      await db`UPDATE wallet_sessions SET revoked_at = NOW() WHERE token_hash = ${tokenHash} AND revoked_at IS NULL`;
    },
    async listGrants(address) {
      const rows = address
        ? await db<Record<string, unknown>[]>`SELECT * FROM role_grants WHERE wallet_address = ${address} ORDER BY created_at DESC`
        : await db<Record<string, unknown>[]>`SELECT * FROM role_grants ORDER BY created_at DESC`;
      return rows.map(grantRow);
    },
    async addGrant(grant: RoleGrant) {
      await db`INSERT INTO role_grants ${db({
        id: grant.id,
        wallet_address: grant.walletAddress,
        role: grant.role,
        capability: grant.capability,
        scope: grant.scope ? db.json(grant.scope) : null,
        granted_by: grant.grantedBy,
        created_at: grant.createdAt,
        expires_at: grant.expiresAt,
        revoked_at: grant.revokedAt,
        revoked_by: grant.revokedBy,
      })}`;
    },
    async revokeGrant(id, revokedBy) {
      const rows = await db<Record<string, unknown>[]>`
        UPDATE role_grants
        SET revoked_at = NOW(), revoked_by = ${revokedBy}
        WHERE id = ${id} AND revoked_at IS NULL
        RETURNING *`;
      return rows[0] ? grantRow(rows[0]) : null;
    },
    async appendAudit(event: AuditEvent) {
      await db`INSERT INTO audit_events ${db({
        id: event.id,
        occurred_at: event.occurredAt,
        actor_address: event.actorAddress,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        payload: event.payload ? db.json(event.payload) : null,
      })}`;
    },
    async listAudit(limit = 100) {
      const rows = await db<Record<string, unknown>[]>`
        SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT ${limit}`;
      return rows.map((row) => ({
        id: String(row.id),
        occurredAt: new Date(String(row.occurred_at)).toISOString(),
        actorAddress: String(row.actor_address),
        action: String(row.action),
        entityType: String(row.entity_type),
        entityId: String(row.entity_id),
        payload: (row.payload as Record<string, unknown> | null) ?? null,
      }));
    },
    async listExhibitions() {
      const rows = await db<Record<string, unknown>[]>`SELECT * FROM exhibitions ORDER BY updated_at DESC`;
      return Promise.all(rows.map((row) => hydrateExhibition(db, row)));
    },
    async getExhibition(idOrSlug) {
      const rows = await db<Record<string, unknown>[]>`
        SELECT * FROM exhibitions WHERE id::text = ${idOrSlug} OR slug = ${idOrSlug} LIMIT 1`;
      return rows[0] ? hydrateExhibition(db, rows[0]) : null;
    },
    async saveExhibition(record: ExhibitionRecord) {
      await db`
        INSERT INTO exhibitions ${db({
          id: record.id,
          slug: record.slug,
          title: record.title,
          description: record.description,
          curator_address: record.curatorAddress,
          curator_label: record.curatorLabel,
          status: record.status,
          created_by: record.createdBy,
          created_at: record.createdAt,
          updated_at: record.updatedAt,
          published_at: record.publishedAt,
          unpublished_at: record.unpublishedAt,
        })}
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          curator_address = EXCLUDED.curator_address,
          curator_label = EXCLUDED.curator_label,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at,
          published_at = EXCLUDED.published_at,
          unpublished_at = EXCLUDED.unpublished_at`;
      await db`DELETE FROM exhibition_items WHERE exhibition_id = ${record.id}`;
      if (record.items.length) {
        await db`INSERT INTO exhibition_items ${db(record.items.map((item) => ({
          id: item.id,
          exhibition_id: record.id,
          position: item.position,
          caption: item.caption ?? null,
          chain_id: item.chainId,
          contract_address: item.contractAddress,
          token_id: item.tokenId,
          listing_id: item.listingId ?? null,
          title: item.title,
          artist: item.artist ?? null,
          preview_url: item.previewUrl ?? null,
          canonical_url: item.canonicalUrl ?? null,
        })))}`;
      }
    },
    async getSlot(slotKey) {
      const rows = await db<Record<string, unknown>[]>`SELECT * FROM exhibition_slots WHERE slot_key = ${slotKey} LIMIT 1`;
      const row = rows[0];
      if (!row) return null;
      return {
        slotKey: String(row.slot_key),
        exhibitionId: row.exhibition_id ? String(row.exhibition_id) : null,
        assignedBy: row.assigned_by ? String(row.assigned_by) : null,
        assignedAt: row.assigned_at ? new Date(String(row.assigned_at)).toISOString() : null,
        scheduledAt: row.scheduled_at ? new Date(String(row.scheduled_at)).toISOString() : null,
      };
    },
    async setSlot(slot: ExhibitionSlot) {
      await db`
        INSERT INTO exhibition_slots ${db({
          slot_key: slot.slotKey,
          exhibition_id: slot.exhibitionId,
          assigned_by: slot.assignedBy,
          assigned_at: slot.assignedAt,
          scheduled_at: slot.scheduledAt,
        })}
        ON CONFLICT (slot_key) DO UPDATE SET
          exhibition_id = EXCLUDED.exhibition_id,
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = EXCLUDED.assigned_at,
          scheduled_at = EXCLUDED.scheduled_at`;
    },
  };
}

async function hydrateExhibition(db: Sql, row: Record<string, unknown>): Promise<ExhibitionRecord> {
  const items = await db<Record<string, unknown>[]>`
    SELECT * FROM exhibition_items WHERE exhibition_id = ${String(row.id)} ORDER BY position ASC`;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    curatorAddress: String(row.curator_address),
    curatorLabel: row.curator_label ? String(row.curator_label) : null,
    status: row.status as ExhibitionRecord['status'],
    createdBy: String(row.created_by),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    unpublishedAt: row.unpublished_at ? new Date(String(row.unpublished_at)).toISOString() : null,
    items: items.map((item) => ({
      id: String(item.id),
      position: Number(item.position),
      caption: item.caption ? String(item.caption) : undefined,
      chainId: Number(item.chain_id),
      contractAddress: String(item.contract_address),
      tokenId: String(item.token_id),
      listingId: item.listing_id ? String(item.listing_id) : undefined,
      title: String(item.title),
      artist: item.artist ? String(item.artist) : undefined,
      previewUrl: item.preview_url ? String(item.preview_url) : undefined,
      canonicalUrl: item.canonical_url ? String(item.canonical_url) : undefined,
    } satisfies ExhibitionItemInput & { id: string })),
  };
}
