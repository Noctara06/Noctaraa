ALTER TABLE "Chapter"
ADD COLUMN "likes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ChapterComment" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChapterComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChapterLike" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChapterLike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChapterComment_chapterId_idx" ON "ChapterComment"("chapterId");
CREATE INDEX "ChapterComment_userId_idx" ON "ChapterComment"("userId");
CREATE INDEX "ChapterComment_createdAt_idx" ON "ChapterComment"("createdAt");

CREATE INDEX "ChapterLike_chapterId_idx" ON "ChapterLike"("chapterId");
CREATE INDEX "ChapterLike_userId_idx" ON "ChapterLike"("userId");
CREATE INDEX "ChapterLike_createdAt_idx" ON "ChapterLike"("createdAt");
CREATE UNIQUE INDEX "ChapterLike_userId_chapterId_key" ON "ChapterLike"("userId", "chapterId");

ALTER TABLE "ChapterComment"
ADD CONSTRAINT "ChapterComment_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterComment"
ADD CONSTRAINT "ChapterComment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterLike"
ADD CONSTRAINT "ChapterLike_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterLike"
ADD CONSTRAINT "ChapterLike_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ChapterLike" ("id", "chapterId", "userId", "createdAt")
SELECT
  story_like."id" || '-chapter',
  first_chapter."id",
  story_like."userId",
  story_like."createdAt"
FROM "StoryLike" AS story_like
JOIN LATERAL (
  SELECT "id"
  FROM "Chapter"
  WHERE "storyId" = story_like."storyId"
  ORDER BY "position" ASC
  LIMIT 1
) AS first_chapter ON TRUE
ON CONFLICT ("userId", "chapterId") DO NOTHING;

INSERT INTO "ChapterComment" ("id", "chapterId", "userId", "text", "createdAt", "updatedAt")
SELECT
  story_comment."id" || '-chapter',
  first_chapter."id",
  story_comment."userId",
  story_comment."text",
  story_comment."createdAt",
  story_comment."updatedAt"
FROM "StoryComment" AS story_comment
JOIN LATERAL (
  SELECT "id"
  FROM "Chapter"
  WHERE "storyId" = story_comment."storyId"
  ORDER BY "position" ASC
  LIMIT 1
) AS first_chapter ON TRUE;

UPDATE "Chapter" AS chapter
SET "likes" = COALESCE(like_totals."count", 0)
FROM (
  SELECT "chapterId", COUNT(*)::integer AS "count"
  FROM "ChapterLike"
  GROUP BY "chapterId"
) AS like_totals
WHERE chapter."id" = like_totals."chapterId";

UPDATE "Story" AS story
SET "likes" = COALESCE(story_totals."count", 0)
FROM (
  SELECT chapter."storyId", COUNT(chapter_like."id")::integer AS "count"
  FROM "Chapter" AS chapter
  LEFT JOIN "ChapterLike" AS chapter_like ON chapter_like."chapterId" = chapter."id"
  GROUP BY chapter."storyId"
) AS story_totals
WHERE story."id" = story_totals."storyId";
