-- Pending allowlist signatures table
-- Stores signatures for the secure allowlist flow (web signing + mini-app submission)
CREATE TABLE "pending_allowlist_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fid" integer NOT NULL,
	"associated_address" text NOT NULL,
	"membership_holder" text NOT NULL,
	"signature" text NOT NULL,
	"nonce" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"transaction_hash" text
);
--> statement-breakpoint
CREATE INDEX "pending_allowlist_signatures_fid_idx" ON "pending_allowlist_signatures" USING btree ("fid");
--> statement-breakpoint
CREATE INDEX "pending_allowlist_signatures_membership_holder_idx" ON "pending_allowlist_signatures" USING btree ("membership_holder");
--> statement-breakpoint
CREATE INDEX "pending_allowlist_signatures_associated_address_idx" ON "pending_allowlist_signatures" USING btree ("associated_address");
--> statement-breakpoint
CREATE INDEX "pending_allowlist_signatures_expires_at_idx" ON "pending_allowlist_signatures" USING btree ("expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_allowlist_signatures_unique_idx" ON "pending_allowlist_signatures" USING btree ("associated_address", "membership_holder", "nonce");

