-- VENDOR sub-accounts (role VENDOR_HELPER)
--
-- IF NOT EXISTS everywhere: this project's migration history is out of sync
-- with the database (schema changes have been applied with `prisma db push`),
-- so this migration must be safe to run against a database where the columns
-- already exist.

-- The VENDOR_HELPER role itself. Seeded here rather than only in seed.ts so a
-- plain `prisma migrate deploy` on a production database is enough to make
-- sub-account login work.
INSERT INTO "roles" ("name", "guardName", "createdAt", "updatedAt")
VALUES ('VENDOR_HELPER', 'web', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Link a sub-account to the vendor that owns it.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parentVendorId" INTEGER;

-- Per-page grants.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewDashboard"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewLeads"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanEditLeads"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanCreateLeads"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewInventory"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanManageLinks"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewWallet"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewInvoices"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewIntegrations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewMarketplace"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanManageSupport"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanUseChat"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanManagePixels"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanManageDomains"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subAllowedModes"        TEXT    NOT NULL DEFAULT 'BOTH';

-- Deleting a vendor takes its helpers with it; a helper with a dangling parent
-- would authenticate into nothing.
DO $$
BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_parentVendorId_fkey"
    FOREIGN KEY ("parentVendorId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "users_parentVendorId_idx" ON "users"("parentVendorId");
