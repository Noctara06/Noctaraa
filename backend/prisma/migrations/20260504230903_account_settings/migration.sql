-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "FollowPermission" AS ENUM ('EVERYONE', 'NO_ONE');

-- CreateEnum
CREATE TYPE "CommentPermission" AS ENUM ('EVERYONE', 'FOLLOWERS', 'NO_ONE');

-- CreateEnum
CREATE TYPE "ReadingActivityVisibility" AS ENUM ('EVERYONE', 'FOLLOWERS', 'ONLY_ME');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "followPermission" "FollowPermission" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "notifyComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyFollows" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLikes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyStoryUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "readingActivityVisibility" "ReadingActivityVisibility" NOT NULL DEFAULT 'ONLY_ME',
ADD COLUMN     "storyCommentPermission" "CommentPermission" NOT NULL DEFAULT 'EVERYONE';

-- CreateIndex
CREATE INDEX "User_profileVisibility_idx" ON "User"("profileVisibility");
