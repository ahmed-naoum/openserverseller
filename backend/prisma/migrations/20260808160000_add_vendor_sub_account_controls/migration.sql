-- Finer-grained vendor sub-account controls.
--
-- Each of these is carved out of a broader grant added in
-- 20260808130000_add_vendor_sub_accounts, because the action is destructive,
-- costs money, or is visible to the end customer.
--
-- IF NOT EXISTS everywhere: this project's migration history is out of sync
-- with the database (schema changes get applied with `prisma db push`).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanDeleteLeads"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanPushToCallCenter"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanRespondPriceRequests"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanImportIntegrationLeads" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanClaimProducts"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanEditProducts"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanRequestCustomProduct"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanCreateLinks"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanUseLinkBuilder"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanRegenerateLinks"        BOOLEAN NOT NULL DEFAULT false;

-- Master read-only switch and an optional end of access for temporary helpers.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subReadOnly"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subAccessExpiresAt" TIMESTAMP(3);

-- Sub-accounts that already exist were created when the broader grant implied
-- these actions. Carry that intent forward so nobody silently loses access.
UPDATE "users" SET
  "subCanDeleteLeads"            = "subCanEditLeads",
  "subCanPushToCallCenter"       = "subCanEditLeads",
  "subCanRespondPriceRequests"   = "subCanEditLeads",
  "subCanImportIntegrationLeads" = "subCanCreateLeads",
  "subCanClaimProducts"          = "subCanViewInventory",
  "subCanEditProducts"           = "subCanViewInventory",
  "subCanRequestCustomProduct"   = "subCanViewInventory",
  "subCanCreateLinks"            = "subCanManageLinks",
  "subCanUseLinkBuilder"         = "subCanManageLinks",
  "subCanRegenerateLinks"        = "subCanManageLinks"
WHERE "parentVendorId" IS NOT NULL;
