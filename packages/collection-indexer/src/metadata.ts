import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, lt, asc } from 'drizzle-orm';
import { getDatabase, collectionTokens } from '@cryptoart/db';
import type { IndexerConfig } from './config.js';

interface TokenRow {
  id: string;
  contractAddress: string;
  chainId: number;
  tokenId: number;
  tokenURI: string | null;
  metadataRetries: number;
}

interface MetadataFields {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  attributes: unknown | null;
}

export class MetadataResolver {
  private db: PostgresJsDatabase<Record<string, never>>;
  private config: IndexerConfig;
  private isRunning = false;

  constructor(config: IndexerConfig) {
    this.db = getDatabase();
    this.config = config;
  }

  async poll(): Promise<void> {
    const tokens = await this.db
      .select({
        id: collectionTokens.id,
        contractAddress: collectionTokens.contractAddress,
        chainId: collectionTokens.chainId,
        tokenId: collectionTokens.tokenId,
        tokenURI: collectionTokens.tokenURI,
        metadataRetries: collectionTokens.metadataRetries,
      })
      .from(collectionTokens)
      .where(
        and(
          eq(collectionTokens.metadataStatus, 'pending'),
          lt(collectionTokens.metadataRetries, this.config.maxMetadataRetries),
        ),
      )
      .orderBy(asc(collectionTokens.mintedAt))
      .limit(this.config.metadataBatchSize);

    if (tokens.length === 0) return;

    console.log(`[MetadataResolver] processing ${tokens.length} pending tokens`);

    for (const token of tokens) {
      await this.resolveToken(token as TokenRow);
    }
  }

  private async resolveToken(token: TokenRow): Promise<void> {
    try {
      const uri = token.tokenURI;
      if (!uri) {
        await this.markFailed(token, 'no tokenURI');
        return;
      }

      const resolvedUrl = this.resolveUri(uri);
      const metadata = await this.fetchMetadata(resolvedUrl);

      if (!metadata) {
        await this.markFailed(token, 'fetch returned empty');
        return;
      }

      await this.db
        .update(collectionTokens)
        .set({
          name: metadata.name ?? null,
          description: metadata.description ?? null,
          imageUrl: metadata.imageUrl ?? null,
          animationUrl: metadata.animationUrl ?? null,
          attributes: metadata.attributes ?? null,
          metadataStatus: 'resolved',
          updatedAt: new Date(),
        })
        .where(eq(collectionTokens.id, token.id));

      console.log(
        `[MetadataResolver] resolved token ${token.contractAddress}:${token.tokenId} → ${metadata.name ?? 'unnamed'}`,
      );
    } catch (error) {
      console.error(
        `[MetadataResolver] error resolving token ${token.contractAddress}:${token.tokenId}:`,
        error,
      );
      const retries = token.metadataRetries + 1;
      if (retries >= this.config.maxMetadataRetries) {
        await this.markFailed(token, String(error));
      } else {
        await this.db
          .update(collectionTokens)
          .set({
            metadataRetries: retries,
            updatedAt: new Date(),
          })
          .where(eq(collectionTokens.id, token.id));
      }
    }
  }

  private async markFailed(token: TokenRow, reason: string): Promise<void> {
    await this.db
      .update(collectionTokens)
      .set({
        metadataStatus: 'failed',
        metadataRetries: token.metadataRetries + 1,
        updatedAt: new Date(),
      })
      .where(eq(collectionTokens.id, token.id));
    console.warn(
      `[MetadataResolver] failed token ${token.contractAddress}:${token.tokenId}: ${reason}`,
    );
  }

  resolveUri(uri: string): string {
    if (uri.startsWith('ipfs://')) {
      const cid = uri.slice(7);
      return `${this.config.ipfsGateway}/${cid}`;
    }
    if (uri.startsWith('ipfs/')) {
      return `${this.config.ipfsGateway}/${uri.slice(5)}`;
    }
    return uri;
  }

  private async fetchMetadata(url: string): Promise<MetadataFields | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return null;

      const json = await response.json() as Record<string, unknown>;

      let imageUrl: string | null = null;
      const rawImage = json['image'] ?? json['imageUrl'] ?? json['image_url'];
      if (typeof rawImage === 'string') {
        imageUrl = this.resolveUri(rawImage);
      }

      let animationUrl: string | null = null;
      const rawAnimation = json['animation_url'] ?? json['animationUrl'];
      if (typeof rawAnimation === 'string') {
        animationUrl = this.resolveUri(rawAnimation);
      }

      const attributes = json['attributes'] ?? json['properties'] ?? null;

      return {
        name: typeof json['name'] === 'string' ? json['name'] : null,
        description: typeof json['description'] === 'string' ? json['description'] : null,
        imageUrl,
        animationUrl,
        attributes: Array.isArray(attributes) ? attributes : null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log(
      `[MetadataResolver] started (poll every ${this.config.metadataPollInterval}ms)`,
    );
    while (this.isRunning) {
      try {
        await this.poll();
      } catch (error) {
        console.error('[MetadataResolver] poll error:', error);
      }
      await this.sleep(this.config.metadataPollInterval);
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
