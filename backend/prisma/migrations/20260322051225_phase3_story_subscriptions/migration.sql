-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'STORY_UPDATE';

-- CreateTable
CREATE TABLE "StorySubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorySubscription_userId_idx" ON "StorySubscription"("userId");

-- CreateIndex
CREATE INDEX "StorySubscription_storyId_idx" ON "StorySubscription"("storyId");

-- CreateIndex
CREATE INDEX "StorySubscription_createdAt_idx" ON "StorySubscription"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StorySubscription_userId_storyId_key" ON "StorySubscription"("userId", "storyId");

-- AddForeignKey
ALTER TABLE "StorySubscription" ADD CONSTRAINT "StorySubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySubscription" ADD CONSTRAINT "StorySubscription_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
