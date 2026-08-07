-- AddColumn
-- IF NOT EXISTS: this project's migration history is out of sync with the
-- database (schema changes have been applied with `prisma db push`), so this
-- migration must be safe to run against a database where the column exists.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "confirmedPriceMad" DOUBLE PRECISION;
