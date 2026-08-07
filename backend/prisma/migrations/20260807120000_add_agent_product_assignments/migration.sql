-- CreateTable
-- IF NOT EXISTS throughout: this project's migration history is out of sync with
-- the database (schema changes have been applied with `prisma db push`), so this
-- migration must be safe to run against a database where the table already exists.

CREATE TABLE IF NOT EXISTS "agent_product_assignments" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "influencerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_product_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agent_product_assignments_agentId_influencerId_productId_key" ON "agent_product_assignments"("agentId", "influencerId", "productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_product_assignments_agentId_idx" ON "agent_product_assignments"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_product_assignments_influencerId_idx" ON "agent_product_assignments"("influencerId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "agent_product_assignments" ADD CONSTRAINT "agent_product_assignments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "agent_product_assignments" ADD CONSTRAINT "agent_product_assignments_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "agent_product_assignments" ADD CONSTRAINT "agent_product_assignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
