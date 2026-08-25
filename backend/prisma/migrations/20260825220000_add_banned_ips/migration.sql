-- CreateTable
CREATE TABLE "banned_ips" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "bannedById" INTEGER,
    "bannedByEmail" TEXT,
    "leadId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banned_ips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banned_ips_value_key" ON "banned_ips"("value");
CREATE INDEX "banned_ips_expiresAt_idx" ON "banned_ips"("expiresAt");
CREATE INDEX "banned_ips_createdAt_idx" ON "banned_ips"("createdAt");

-- Carry over the addresses that were sitting in the security_settings JSON blob.
-- They were never actually enforced (enableIPBlocking was false), but somebody
-- entered them deliberately and dropping them silently would be wrong.
INSERT INTO "banned_ips" ("value", "reason", "source", "createdAt", "updatedAt")
SELECT DISTINCT lower(trim(ip)), 'Migrated from security_settings.blockedIPs', 'MANUAL', now(), now()
FROM platform_settings ps
CROSS JOIN LATERAL jsonb_array_elements_text(ps.value::jsonb -> 'blockedIPs') AS ip
WHERE ps.key = 'security_settings'
  AND jsonb_typeof(ps.value::jsonb -> 'blockedIPs') = 'array'
  AND trim(ip) <> ''
ON CONFLICT ("value") DO NOTHING;
