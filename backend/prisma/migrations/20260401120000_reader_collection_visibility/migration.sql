ALTER TABLE "ReaderCollection"
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ReaderCollection_userId_isPublic_idx"
ON "ReaderCollection"("userId", "isPublic");
