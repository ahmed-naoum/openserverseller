-- Finance and Outils controls for vendor sub-accounts.
--
-- Note what is deliberately absent: there is no grant for POST /payouts.
-- That endpoint takes the destination RIB from the request body rather than
-- from the vendor's registered bank account, so any helper able to call it
-- could move the whole balance to an account of their choosing. Withdrawals
-- stay with the account owner. Reading the payout history is safe, and is what
-- subCanViewPayouts opens.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewTransactions"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewPayouts"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewCommissions"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanDownloadInvoices"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanViewPixels"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanCreateTickets"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanSendMessages"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanManageConversations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subCanRefreshDomain"       BOOLEAN NOT NULL DEFAULT false;

-- Carry forward what the broader grants already implied, so no existing
-- sub-account silently loses an ability it had this morning.
-- subCanViewPayouts is left false on purpose: reading the payout history was
-- refused before this migration, so nobody had it to keep.
UPDATE "users" SET
  "subCanViewTransactions"    = "subCanViewWallet",
  "subCanViewCommissions"     = "subCanViewDashboard",
  "subCanDownloadInvoices"    = "subCanViewInvoices",
  "subCanViewPixels"          = "subCanManagePixels",
  "subCanCreateTickets"       = "subCanManageSupport",
  "subCanSendMessages"        = "subCanUseChat",
  "subCanManageConversations" = "subCanUseChat",
  "subCanRefreshDomain"       = "subCanManageDomains"
WHERE "parentVendorId" IS NOT NULL;
