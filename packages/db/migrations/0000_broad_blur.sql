CREATE TABLE "artist_cache" (
	"eth_address" text PRIMARY KEY NOT NULL,
	"fid" integer,
	"username" text,
	"display_name" text,
	"pfp_url" text,
	"verified_wallets" jsonb,
	"ens_name" text,
	"source" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refreshed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contract_cache" (
	"contract_address" text PRIMARY KEY NOT NULL,
	"name" text,
	"symbol" text,
	"creator_address" text,
	"source" text NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refreshed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "artist_cache_fid_idx" ON "artist_cache" USING btree ("fid");--> statement-breakpoint
CREATE INDEX "artist_cache_username_idx" ON "artist_cache" USING btree ("username");--> statement-breakpoint
CREATE INDEX "artist_cache_expires_at_idx" ON "artist_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "contract_cache_creator_address_idx" ON "contract_cache" USING btree ("creator_address");--> statement-breakpoint
CREATE INDEX "contract_cache_expires_at_idx" ON "contract_cache" USING btree ("expires_at");