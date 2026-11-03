import postgres from 'postgres';
import type { UploadJob } from './types';
import type { MediaStore } from './store';

const clients = new Map<string, ReturnType<typeof postgres>>();

function sql(url: string) {
  const existing = clients.get(url);
  if (existing) return existing;
  const client = postgres(url, { max: 1, idle_timeout: 10 });
  clients.set(url, client);
  return client;
}

export function createPostgresMediaStore(connectionString: string): MediaStore {
  const db = sql(connectionString);
  return {
    async getById(id) {
      const rows = await db<Record<string, unknown>[]>`SELECT * FROM upload_jobs WHERE id = ${id} LIMIT 1`;
      return rows[0] ? asJob(rows[0]) : null;
    },
    async getByIdempotencyKey(key) {
      const rows = await db<Record<string, unknown>[]>`SELECT * FROM upload_jobs WHERE idempotency_key = ${key} LIMIT 1`;
      return rows[0] ? asJob(rows[0]) : null;
    },
    async save(job) {
      await db`
        INSERT INTO upload_jobs ${db(toRow(job))}
        ON CONFLICT (idempotency_key) DO UPDATE SET
          status = EXCLUDED.status,
          payment = EXCLUDED.payment,
          media = EXCLUDED.media,
          metadata = EXCLUDED.metadata,
          confirmation = EXCLUDED.confirmation,
          credit = EXCLUDED.credit,
          error_message = EXCLUDED.error_message,
          updated_at = EXCLUDED.updated_at`;
      if (job.payment) {
        await db`
          INSERT INTO payment_receipts ${db({
            id: crypto.randomUUID(),
            job_id: job.id,
            idempotency_key: job.idempotencyKey,
            network: job.payment.network,
            asset: job.payment.asset,
            amount: job.payment.amount,
            payer: job.payment.payer,
            pay_to: job.payment.payTo,
            settlement_tx: job.payment.settlementTx ?? null,
            facilitator: job.payment.facilitator,
            status: job.payment.status,
            created_at: job.updatedAt,
          })}
          ON CONFLICT (idempotency_key) DO NOTHING`;
      }
      await upsertArweaveRecord(db, job, 'media', job.media);
      await upsertArweaveRecord(db, job, 'metadata', job.metadata);
    },
  };
}

async function upsertArweaveRecord(
  db: ReturnType<typeof sql>,
  job: UploadJob,
  role: 'media' | 'metadata',
  record: UploadJob['media'],
) {
  if (!record?.id) return;
  const simulated = record.id.startsWith('sim-');
  await db`
    INSERT INTO arweave_records ${db({
      id: crypto.randomUUID(),
      job_id: job.id,
      role,
      tx_id: record.id,
      sha256: record.sha256,
      mime_type: record.mimeType,
      byte_size: record.size,
      gateways: record.gateways ?? [],
      simulated,
      created_at: job.updatedAt,
      updated_at: job.updatedAt,
    })}
    ON CONFLICT (job_id, role) DO UPDATE SET
      tx_id = EXCLUDED.tx_id,
      sha256 = EXCLUDED.sha256,
      mime_type = EXCLUDED.mime_type,
      byte_size = EXCLUDED.byte_size,
      gateways = EXCLUDED.gateways,
      simulated = EXCLUDED.simulated,
      updated_at = EXCLUDED.updated_at`;
}

function toRow(job: UploadJob) {
  return {
    id: job.id,
    idempotency_key: job.idempotencyKey,
    payer_address: job.payerAddress,
    status: job.status,
    quote: job.quote,
    payment: job.payment,
    media: job.media,
    metadata: job.metadata,
    confirmation: job.confirmation,
    credit: job.credit,
    error_message: job.errorMessage,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

function asJob(row: Record<string, unknown>): UploadJob {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotency_key),
    payerAddress: String(row.payer_address),
    status: row.status as UploadJob['status'],
    quote: row.quote as UploadJob['quote'],
    payment: (row.payment as UploadJob['payment']) ?? null,
    media: (row.media as UploadJob['media']) ?? null,
    metadata: (row.metadata as UploadJob['metadata']) ?? null,
    confirmation: (row.confirmation as UploadJob['confirmation']) ?? null,
    credit: (row.credit as UploadJob['credit']) ?? null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}
