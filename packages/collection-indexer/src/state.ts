import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { indexedContracts } from '@cryptoart/db';
import type * as schema from 'drizzle-orm/pg-core';

export interface IndexedContract {
  contractAddress: string;
  chainId: number;
  lastIndexedBlock: number;
  status: string;
  contractType: string;
  errorMessage: string | null;
}

export async function loadActiveCollections(
  db: PostgresJsDatabase<Record<string, never>>,
  chainId: number,
): Promise<IndexedContract[]> {
  const rows = await db
    .select()
    .from(indexedContracts)
    .where(
      and(
        eq(indexedContracts.chainId, chainId),
        eq(indexedContracts.status, 'active'),
        eq(indexedContracts.contractType, 'such_collection'),
      ),
    );
  return rows as IndexedContract[];
}

export async function loadFactoryCursor(
  db: PostgresJsDatabase<Record<string, never>>,
  contractAddress: string,
  chainId: number,
): Promise<IndexedContract | null> {
  const rows = await db
    .select()
    .from(indexedContracts)
    .where(
      and(
        eq(indexedContracts.contractAddress, contractAddress),
        eq(indexedContracts.chainId, chainId),
      ),
    )
    .limit(1);
  return (rows[0] as IndexedContract | undefined) ?? null;
}

export async function upsertIndexedContract(
  db: PostgresJsDatabase<Record<string, never>>,
  data: {
    contractAddress: string;
    chainId: number;
    lastIndexedBlock: number;
    contractType: string;
    status?: string;
  },
): Promise<void> {
  await db
    .insert(indexedContracts)
    .values({
      contractAddress: data.contractAddress,
      chainId: data.chainId,
      lastIndexedBlock: data.lastIndexedBlock,
      contractType: data.contractType,
      status: data.status ?? 'active',
    })
    .onConflictDoUpdate({
      target: [indexedContracts.contractAddress, indexedContracts.chainId],
      set: {
        lastIndexedBlock: data.lastIndexedBlock,
        status: data.status ?? 'active',
        errorMessage: null,
      },
    });
}

export async function updateCursor(
  db: PostgresJsDatabase<Record<string, never>>,
  contractAddress: string,
  chainId: number,
  lastIndexedBlock: number,
): Promise<void> {
  await db
    .update(indexedContracts)
    .set({ lastIndexedBlock })
    .where(
      and(
        eq(indexedContracts.contractAddress, contractAddress),
        eq(indexedContracts.chainId, chainId),
      ),
    );
}

export async function markContractError(
  db: PostgresJsDatabase<Record<string, never>>,
  contractAddress: string,
  chainId: number,
  errorMessage: string,
): Promise<void> {
  await db
    .update(indexedContracts)
    .set({ status: 'error', errorMessage })
    .where(
      and(
        eq(indexedContracts.contractAddress, contractAddress),
        eq(indexedContracts.chainId, chainId),
      ),
    );
}
