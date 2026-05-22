-- CreateEnum
CREATE TYPE "StoryVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "UserMode" AS ENUM ('WRITER', 'READER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ADD COLUMN "bio" TEXT NOT NULL DEFAULT '',
ADD COLUMN "avatarColor" TEXT NOT NULL DEFAULT '#7C7CFF',
ADD COLUMN "website" TEXT,
ADD COLUMN "socialX" TEXT,
ADD COLUMN "socialInstagram" TEXT,
ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mode" "UserMode" NOT NULL DEFAULT 'READER';

-- AlterTable
ALTER TABLE "Story"
ADD COLUMN "visibility" "StoryVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "contentWarning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "reportedByUserId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_mode_idx" ON "User"("mode");

-- CreateIndex
CREATE INDEX "User_blocked_idx" ON "User"("blocked");

-- CreateIndex
CREATE INDEX "Story_visibility_idx" ON "Story"("visibility");

-- CreateIndex
CREATE INDEX "Story_scheduledAt_idx" ON "Story"("scheduledAt");

-- CreateIndex
CREATE INDEX "Story_publishedAt_idx" ON "Story"("publishedAt");

-- CreateIndex
CREATE INDEX "Report_storyId_idx" ON "Report"("storyId");

-- CreateIndex
CREATE INDEX "Report_reportedByUserId_idx" ON "Report"("reportedByUserId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
