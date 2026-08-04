-- CreateTable
-- IF NOT EXISTS throughout: this project's migration history is out of sync with
-- the database (schema changes have been applied with `prisma db push`), so this
-- migration must be safe to run against a database where the tables already exist.

CREATE TABLE IF NOT EXISTS "deployments" (
    "id" TEXT NOT NULL,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "commitAuthor" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'master',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "triggeredById" INTEGER,
    "triggeredBy" TEXT,
    "exitCode" INTEGER,
    "errorMessage" TEXT,
    "logPath" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pending_commits" (
    "id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT,
    "branch" TEXT NOT NULL,
    "url" TEXT,
    "committedAt" TIMESTAMP(3),
    "deployed" BOOLEAN NOT NULL DEFAULT false,
    "deploymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_commits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deployments_status_idx" ON "deployments"("status");
CREATE INDEX IF NOT EXISTS "deployments_createdAt_idx" ON "deployments"("createdAt");
CREATE INDEX IF NOT EXISTS "deployments_commitSha_idx" ON "deployments"("commitSha");

CREATE UNIQUE INDEX IF NOT EXISTS "pending_commits_sha_key" ON "pending_commits"("sha");
CREATE INDEX IF NOT EXISTS "pending_commits_deployed_idx" ON "pending_commits"("deployed");
CREATE INDEX IF NOT EXISTS "pending_commits_branch_idx" ON "pending_commits"("branch");
CREATE INDEX IF NOT EXISTS "pending_commits_createdAt_idx" ON "pending_commits"("createdAt");
