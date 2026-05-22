-- CreateEnum
CREATE TYPE "ReaderCollectionSystemKey" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "ReaderCollection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "systemKey" "ReaderCollectionSystemKey",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReaderCollection_userId_idx" ON "ReaderCollection"("userId");

-- CreateIndex
CREATE INDEX "ReaderCollection_systemKey_idx" ON "ReaderCollection"("systemKey");

-- CreateIndex
CREATE INDEX "ReaderCollection_createdAt_idx" ON "ReaderCollection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderCollection_userId_nameKey_key" ON "ReaderCollection"("userId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderCollection_userId_systemKey_key" ON "ReaderCollection"("userId", "systemKey");

-- CreateIndex
CREATE INDEX "ReaderCollectionItem_collectionId_idx" ON "ReaderCollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "ReaderCollectionItem_storyId_idx" ON "ReaderCollectionItem"("storyId");

-- CreateIndex
CREATE INDEX "ReaderCollectionItem_createdAt_idx" ON "ReaderCollectionItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderCollectionItem_collectionId_storyId_key" ON "ReaderCollectionItem"("collectionId", "storyId");

-- AddForeignKey
ALTER TABLE "ReaderCollection" ADD CONSTRAINT "ReaderCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderCollectionItem" ADD CONSTRAINT "ReaderCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ReaderCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderCollectionItem" ADD CONSTRAINT "ReaderCollectionItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
