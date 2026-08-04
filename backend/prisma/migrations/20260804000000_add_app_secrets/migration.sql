-- CreateTable
-- IF NOT EXISTS: this project's migration history is out of sync with the
-- database (some schema changes were applied with `prisma db push`), so this
-- migration must be safe to run against a database where the table is present.
CREATE TABLE IF NOT EXISTS "app_secrets" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" INTEGER,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "app_secrets_key_key" ON "app_secrets"("key");
