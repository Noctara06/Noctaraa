CREATE TABLE "AuthorProfileComment" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "replyText" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorProfileComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthorProfileComment_authorId_idx" ON "AuthorProfileComment"("authorId");
CREATE INDEX "AuthorProfileComment_userId_idx" ON "AuthorProfileComment"("userId");
CREATE INDEX "AuthorProfileComment_createdAt_idx" ON "AuthorProfileComment"("createdAt");

ALTER TABLE "AuthorProfileComment" ADD CONSTRAINT "AuthorProfileComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthorProfileComment" ADD CONSTRAINT "AuthorProfileComment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
