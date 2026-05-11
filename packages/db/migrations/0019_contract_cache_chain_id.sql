-- Scope contract_cache by chain: same 0x address on Base vs Ethereum are different contracts.
ALTER TABLE "contract_cache" ADD COLUMN IF NOT EXISTS "chain_id" integer NOT NULL DEFAULT 8453;
--> statement-breakpoint
ALTER TABLE "contract_cache" DROP CONSTRAINT IF EXISTS "contract_cache_pkey";
--> statement-breakpoint
ALTER TABLE "contract_cache" ADD CONSTRAINT "contract_cache_pkey" PRIMARY KEY ("chain_id", "contract_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_cache_contract_address_idx" ON "contract_cache" USING btree ("contract_address");
