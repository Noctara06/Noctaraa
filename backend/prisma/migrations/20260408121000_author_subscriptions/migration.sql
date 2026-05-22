CREATE TABLE "AuthorSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorSubscription_userId_authorId_key" ON "AuthorSubscription"("userId", "authorId");
CREATE INDEX "AuthorSubscription_userId_idx" ON "AuthorSubscription"("userId");
CREATE INDEX "AuthorSubscription_authorId_idx" ON "AuthorSubscription"("authorId");
CREATE INDEX "AuthorSubscription_createdAt_idx" ON "AuthorSubscription"("createdAt");

ALTER TABLE "AuthorSubscription"
ADD CONSTRAINT "AuthorSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AuthorSubscription"
ADD CONSTRAINT "AuthorSubscription_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
