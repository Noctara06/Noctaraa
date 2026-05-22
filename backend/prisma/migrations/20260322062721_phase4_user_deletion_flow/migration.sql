-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'DELETION_REQUEST';

-- CreateTable
CREATE TABLE "UserDeletionRequest" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT,
    "requestedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "targetEmail" TEXT NOT NULL,
    "requestedByEmail" TEXT,
    "reviewedByEmail" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "warningSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDeletionRequest_targetUserId_idx" ON "UserDeletionRequest"("targetUserId");

-- CreateIndex
CREATE INDEX "UserDeletionRequest_requestedByUserId_idx" ON "UserDeletionRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "UserDeletionRequest_reviewedByUserId_idx" ON "UserDeletionRequest"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "UserDeletionRequest_status_idx" ON "UserDeletionRequest"("status");

-- CreateIndex
CREATE INDEX "UserDeletionRequest_createdAt_idx" ON "UserDeletionRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "UserDeletionRequest" ADD CONSTRAINT "UserDeletionRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDeletionRequest" ADD CONSTRAINT "UserDeletionRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDeletionRequest" ADD CONSTRAINT "UserDeletionRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
