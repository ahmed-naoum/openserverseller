-- Device push tokens (Firebase Cloud Messaging / APNs) for the SILACOD mobile app.
CREATE TABLE "push_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fcm',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
