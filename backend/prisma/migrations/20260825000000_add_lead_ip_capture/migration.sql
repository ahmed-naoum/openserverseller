-- AlterTable
ALTER TABLE "leads" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "leads" ADD COLUMN "ipCountry" TEXT;
ALTER TABLE "leads" ADD COLUMN "userAgent" TEXT;

-- Index to spot multiple orders coming from the same IP
CREATE INDEX "leads_ipAddress_idx" ON "leads"("ipAddress");
