-- CreateTable
CREATE TABLE IF NOT EXISTS "lead_contact_clicks" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_contact_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_contact_clicks_leadId_idx" ON "lead_contact_clicks"("leadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_contact_clicks_leadId_channel_idx" ON "lead_contact_clicks"("leadId", "channel");

-- AddForeignKey
ALTER TABLE "lead_contact_clicks" ADD CONSTRAINT "lead_contact_clicks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_contact_clicks" ADD CONSTRAINT "lead_contact_clicks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
