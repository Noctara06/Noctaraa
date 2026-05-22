const AppError = require("../../common/AppError");
const prisma = require("../../config/prisma");
const { shouldDeliverNotification } = require("../../common/user-settings");

const STATUS_INPUT_TO_ENUM = Object.freeze({
  draft: "DRAFT",
  published: "PUBLISHED",
  scheduled: "SCHEDULED"
});

const STATUS_ENUM_TO_OUTPUT = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  SCHEDULED: "scheduled"
});

const VISIBILITY_INPUT_TO_ENUM = Object.freeze({
  public: "PUBLIC",
  private: "PRIVATE"
});

const VISIBILITY_ENUM_TO_OUTPUT = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private"
});

const STORY_INCLUDE = Object.freeze({
  genre: true,
  author: {
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true,
      bio: true,
      avatarColor: true,
      avatarUrl: true,
      coverPhotoUrl: true,
      website: true,
      socialInstagram: true,
      _count: {
        select: {
          followers: true
        }
      }
    }
  },
  _count: {
    select: {
      comments: true
    }
  },
  chapters: {
    orderBy: {
      position: "asc"
    },
    include: {
      _count: {
        select: {
          comments: true
        }
      }
    }
  }
});

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatGenreName(rawName, slug) {
  const value = String(rawName || "").trim();
  if (value) {
    return value;
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeActor(actor) {
  const userId = String(actor?.userId || "").trim();
  const role = String(actor?.role || "user").trim().toLowerCase();
  return { userId, role };
}

function isPrivilegedRole(role) {
  return role === "admin" || role === "manager";
}

function normalizeStatusForCreateOrUpdate(rawStatus, fallback = "draft") {
  const key = String(rawStatus || fallback).trim().toLowerCase();
  const status = STATUS_INPUT_TO_ENUM[key];
  if (!status) {
    throw new AppError(400, "Invalid status. Use draft/published/scheduled.");
  }
  return status;
}

function normalizeStatusForQuery(rawStatus) {
  const key = String(rawStatus || "").trim().toLowerCase();
  if (!key) {
    return undefined;
  }

  const status = STATUS_INPUT_TO_ENUM[key];
  if (!status) {
    throw new AppError(400, "Invalid status. Use draft/published/scheduled.");
  }
  return status;
}

function normalizeVisibility(rawVisibility, fallback = "public") {
  const key = String(rawVisibility || fallback).trim().toLowerCase();
  const visibility = VISIBILITY_INPUT_TO_ENUM[key];
  if (!visibility) {
    throw new AppError(400, "Invalid visibility. Use public/private.");
  }
  return visibility;
}

function normalizeTags(rawTags) {
  if (!Array.isArray(rawTags)) {
    return undefined;
  }

  return rawTags
    .map((tag) => String(tag || "").trim())
    .filter(Boolean);
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeDateInput(rawValue, fieldName) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === null || rawValue === "") {
    return null;
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, `${fieldName} must be a valid date.`);
  }

  return date;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(content) {
  const value = stripHtml(content);
  if (!value) {
    return 0;
  }
  return value.split(/\s+/).length;
}

function countReadingMinutes(wordCount) {
  if (!wordCount) {
    return 0;
  }
  return Math.max(1, Math.ceil(wordCount / 200));
}

function normalizeChapter(rawChapter, index) {
  const fallbackTitle = `Chapter ${index + 1}`;
  const title = String(rawChapter?.title || fallbackTitle).trim() || fallbackTitle;
  const content = String(rawChapter?.content || "").trim();

  const parsedPosition = Number.parseInt(rawChapter?.position, 10);
  const position = Number.isInteger(parsedPosition) && parsedPosition > 0 ? parsedPosition : index + 1;

  const wordCount = countWords(content);

  return {
    title,
    content,
    position,
    wordCount,
    readingMinutes: countReadingMinutes(wordCount)
  };
}

function prepareChapterRecords(rawChapters, fallbackContent) {
  let chapters = [];

  if (Array.isArray(rawChapters)) {
    chapters = rawChapters
      .map((chapter, index) => normalizeChapter(chapter, index))
      .filter((chapter) => chapter.title || chapter.content);
  } else {
    const content = String(fallbackContent || "").trim();
    if (content) {
      const wordCount = countWords(content);
      chapters = [
        {
          title: "Chapter 1",
          content,
          position: 1,
          wordCount,
          readingMinutes: countReadingMinutes(wordCount)
        }
      ];
    }
  }

  chapters.sort((a, b) => a.position - b.position);

  return chapters.map((chapter, index) => ({
    ...chapter,
    position: index + 1
  }));
}

function sumChapterStats(chapters) {
  return (chapters || []).reduce((acc, chapter) => {
    return {
      wordCount: acc.wordCount + Number(chapter.wordCount || 0),
      readingMinutes: acc.readingMinutes + Number(chapter.readingMinutes || 0)
    };
  }, { wordCount: 0, readingMinutes: 0 });
}

function toPublicChapter(chapter) {
  return {
    id: chapter.id,
    title: chapter.title,
    content: chapter.content,
    position: chapter.position,
    likes: Number(chapter.likes || 0),
    comments: Number(chapter._count?.comments || 0),
    wordCount: chapter.wordCount,
    readingMinutes: chapter.readingMinutes,
    createdAt: toIsoString(chapter.createdAt),
    updatedAt: toIsoString(chapter.updatedAt)
  };
}

function toPublicStory(story) {
  const chapters = Array.isArray(story.chapters) ? story.chapters.map(toPublicChapter) : [];
  const stats = sumChapterStats(chapters);
  const totalComments = chapters.reduce((sum, chapter) => sum + Number(chapter.comments || 0), 0) || Number(story._count?.comments || 0);
  const totalLikes = Number(story.likes || chapters.reduce((sum, chapter) => sum + Number(chapter.likes || 0), 0));

  return {
    id: story.id,
    title: story.title,
    summary: story.summary,
    genre: story.genre?.slug || "general",
    genreName: story.genre?.name || "General",
    authorId: story.authorId,
    author: story.author ? {
      id: story.author.id,
      email: story.author.email,
      displayName: story.author.displayName || null,
      username: story.author.username || null,
      bio: story.author.bio || "",
      avatarColor: story.author.avatarColor || "#7C7CFF",
      avatarUrl: story.author.avatarUrl || null,
      coverPhotoUrl: story.author.coverPhotoUrl || null,
      socials: {
        instagram: story.author.socialInstagram || "",
        youtube: story.author.website || ""
      },
      followersCount: Number(story.author._count?.followers || 0)
    } : null,
    content: chapters[0]?.content || "",
    status: STATUS_ENUM_TO_OUTPUT[story.status] || "draft",
    visibility: VISIBILITY_ENUM_TO_OUTPUT[story.visibility] || "public",
    contentWarning: !!story.contentWarning,
    warning: !!story.contentWarning,
    coverUrl: story.coverUrl || null,
    cover: story.coverUrl || null,
    tags: Array.isArray(story.tags) ? story.tags : [],
    reads: story.reads,
    likes: totalLikes,
    comments: totalComments,
    wordCount: stats.wordCount,
    readingMinutes: stats.readingMinutes,
    chapterCount: chapters.length,
    scheduledAt: toIsoString(story.scheduledAt),
    publishedAt: toIsoString(story.publishedAt),
    createdAt: toIsoString(story.createdAt),
    updatedAt: toIsoString(story.updatedAt),
    chapters
  };
}

async function ensureGenre(rawGenre) {
  const slug = toSlug(rawGenre);
  if (!slug) {
    return null;
  }

  const name = formatGenreName(rawGenre, slug);

  return prisma.genre.upsert({
    where: {
      slug
    },
    update: {
      name
    },
    create: {
      slug,
      name
    }
  });
}

async function ensureAuthor(authorId) {
  const id = String(authorId || "").trim();
  if (!id) {
    throw new AppError(400, "authorId is required.");
  }

  const author = await prisma.user.findUnique({
    where: {
      id
    },
    select: {
      id: true
    }
  });

  if (!author) {
    throw new AppError(404, "Author not found.");
  }

  return id;
}

async function resolveStoryAuthorId(payloadAuthorId, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (payloadAuthorId !== undefined && payloadAuthorId !== null && String(payloadAuthorId).trim()) {
    if (!isPrivilegedRole(currentActor.role)) {
      return ensureAuthor(currentActor.userId);
    }

    return ensureAuthor(payloadAuthorId);
  }

  return ensureAuthor(currentActor.userId);
}

function ensureStoryPermission(story, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (isPrivilegedRole(currentActor.role)) {
    return;
  }

  if (story.authorId !== currentActor.userId) {
    throw new AppError(403, "You can modify only your own stories.");
  }
}

function isReadablePublicStory(story) {
  const now = Date.now();
  const scheduledAt = story.scheduledAt ? new Date(story.scheduledAt).getTime() : null;

  return story.status === "PUBLISHED" &&
    story.visibility === "PUBLIC" &&
    (scheduledAt === null || scheduledAt <= now);
}

function ensureStoryReadable(story, actor) {
  const currentActor = normalizeActor(actor);
  if (isPrivilegedRole(currentActor.role) || story.authorId === currentActor.userId) {
    return;
  }

  if (!isReadablePublicStory(story)) {
    throw new AppError(404, "Story not found.");
  }
}

function shouldNotifySubscribers(payload, existing, story) {
  if (!payload || !payload.notifySubscribers) {
    return false;
  }

  const nowPublic = !!story && isReadablePublicStory(story);
  const wasPublic = !!existing && isReadablePublicStory(existing);
  if (!nowPublic) {
    return false;
  }

  if (!wasPublic) {
    return true;
  }

  return payload.title !== undefined ||
    payload.summary !== undefined ||
    payload.genre !== undefined ||
    payload.tags !== undefined ||
    payload.cover !== undefined ||
    payload.coverUrl !== undefined ||
    payload.content !== undefined ||
    payload.chapters !== undefined ||
    payload.contentWarning !== undefined ||
    payload.warning !== undefined;
}

async function notifyStorySubscribers(story, existing) {
  const [subscribers, authorSubscribers] = await Promise.all([
    prisma.storySubscription.findMany({
      where: {
        storyId: story.id,
        userId: {
          not: story.authorId
        }
      },
      select: {
        userId: true
      }
    }),
    prisma.authorSubscription.findMany({
      where: {
        authorId: story.authorId,
        userId: {
          not: story.authorId
        }
      },
      select: {
        userId: true
      }
    })
  ]);
  const candidateIds = [...new Set([...subscribers, ...authorSubscribers].map((entry) => entry.userId).filter(Boolean))];

  if (!candidateIds.length) {
    return;
  }

  const recipients = (await prisma.user.findMany({
    where: {
      id: {
        in: candidateIds
      }
    },
    select: {
      id: true,
      notifyStoryUpdates: true
    }
  }))
    .filter((user) => shouldDeliverNotification("STORY_UPDATE", user))
    .map((user) => user.id);

  if (!recipients.length) {
    return;
  }

  const authorName = String(story.author?.displayName || story.author?.username || "This author").trim() || "This author";
  const message = existing && isReadablePublicStory(existing)
    ? `New update from ${authorName} on "${story.title}".`
    : `${authorName} published "${story.title}".`;

  await prisma.$transaction(async (tx) => {
    for (const userId of recipients) {
      await tx.notification.deleteMany({
        where: {
          userId,
          storyId: story.id,
          type: "STORY_UPDATE",
          readAt: null
        }
      });

      await tx.notification.create({
        data: {
          userId,
          actorUserId: story.authorId,
          storyId: story.id,
          type: "STORY_UPDATE",
          text: message
        }
      });
    }
  });
}

function resolvePublishingState(status, scheduledAtInput, existingPublishedAt = null) {
  const scheduledAt = scheduledAtInput === undefined ? undefined : scheduledAtInput;
  const now = new Date();

  if (status === "SCHEDULED") {
    if (!scheduledAt) {
      throw new AppError(400, "scheduledAt is required when status is scheduled.");
    }

    if (scheduledAt.getTime() <= now.getTime()) {
      throw new AppError(400, "scheduledAt must be in the future for scheduled stories.");
    }

    return {
      scheduledAt,
      publishedAt: null
    };
  }

  if (status === "PUBLISHED") {
    return {
      scheduledAt: null,
      publishedAt: existingPublishedAt || now
    };
  }

  return {
    scheduledAt: null,
    publishedAt: null
  };
}

async function listStories(query = {}, actor = {}) {
  const where = {};
  const status = normalizeStatusForQuery(query.status);
  const visibility = query.visibility ? normalizeVisibility(query.visibility) : undefined;
  const authorId = String(query.authorId || "").trim();
  const genreSlug = toSlug(query.genre);
  const currentActor = normalizeActor(actor);
  const canReadRestrictedStories = isPrivilegedRole(currentActor.role) ||
    (currentActor.userId && authorId && currentActor.userId === authorId);

  if (status && canReadRestrictedStories) {
    where.status = status;
  }

  if (visibility && canReadRestrictedStories) {
    where.visibility = visibility;
  }

  if (authorId) {
    where.authorId = authorId;
  }

  if (genreSlug) {
    where.genre = {
      slug: genreSlug
    };
  }

  if (!canReadRestrictedStories) {
    where.status = "PUBLISHED";
    where.visibility = "PUBLIC";
    where.OR = [
      { scheduledAt: null },
      { scheduledAt: { lte: new Date() } }
    ];
  }

  const stories = await prisma.story.findMany({
    where,
    include: STORY_INCLUDE,
    orderBy: {
      updatedAt: "desc"
    }
  });

  return stories.map(toPublicStory);
}

async function getStoryById(id, actor = {}) {
  const story = await prisma.story.findUnique({
    where: {
      id
    },
    include: STORY_INCLUDE
  });

  if (!story) {
    throw new AppError(404, "Story not found.");
  }

  ensureStoryReadable(story, actor);
  return toPublicStory(story);
}

async function createStory(payload, actor) {
  const title = String(payload.title || "").trim();
  if (!title) {
    throw new AppError(400, "Title is required.");
  }

  const authorId = await resolveStoryAuthorId(payload.authorId, actor);
  const status = normalizeStatusForCreateOrUpdate(payload.status, "draft");
  const visibility = normalizeVisibility(payload.visibility, "public");
  const summary = String(payload.summary || "").trim();
  const coverUrl = normalizeOptionalText(payload.coverUrl || payload.cover);
  const contentWarning = payload.contentWarning !== undefined
    ? !!payload.contentWarning
    : !!payload.warning;
  const tags = normalizeTags(payload.tags) || [];
  const genre = await ensureGenre(payload.genre || "general");
  const chapters = prepareChapterRecords(payload.chapters, payload.content);
  const publishing = resolvePublishingState(status, normalizeDateInput(payload.scheduledAt, "scheduledAt"));

  const story = await prisma.story.create({
    data: {
      title,
      summary,
      coverUrl,
      tags,
      status,
      visibility,
      contentWarning,
      authorId,
      genreId: genre?.id || null,
      scheduledAt: publishing.scheduledAt,
      publishedAt: publishing.publishedAt,
      chapters: chapters.length ? { create: chapters } : undefined
    },
    include: STORY_INCLUDE
  });

  if (shouldNotifySubscribers(payload, null, story)) {
    await notifyStorySubscribers(story, null);
  }

  return toPublicStory(story);
}

async function updateStory(id, payload, actor) {
  const existing = await prisma.story.findUnique({
    where: {
      id
    },
    include: STORY_INCLUDE
  });

  if (!existing) {
    throw new AppError(404, "Story not found.");
  }

  ensureStoryPermission(existing, actor);

  const data = {};

  if (payload.title !== undefined) {
    const title = String(payload.title || "").trim();
    if (!title) {
      throw new AppError(400, "Title cannot be empty.");
    }
    data.title = title;
  }

  if (payload.summary !== undefined) {
    data.summary = String(payload.summary || "").trim();
  }

  if (payload.status !== undefined) {
    data.status = normalizeStatusForCreateOrUpdate(payload.status);
  }

  if (payload.visibility !== undefined) {
    data.visibility = normalizeVisibility(payload.visibility);
  }

  if (payload.contentWarning !== undefined || payload.warning !== undefined) {
    data.contentWarning = payload.contentWarning !== undefined
      ? !!payload.contentWarning
      : !!payload.warning;
  }

  if (payload.coverUrl !== undefined || payload.cover !== undefined) {
    data.coverUrl = normalizeOptionalText(payload.coverUrl || payload.cover);
  }

  if (payload.tags !== undefined) {
    data.tags = normalizeTags(payload.tags) || [];
  }

  if (payload.genre !== undefined) {
    const rawGenre = String(payload.genre || "").trim();
    if (!rawGenre) {
      data.genreId = null;
    } else {
      const genre = await ensureGenre(rawGenre);
      data.genreId = genre?.id || null;
    }
  }

  if (payload.authorId !== undefined) {
    if (!isPrivilegedRole(normalizeActor(actor).role)) {
      throw new AppError(403, "Only admin/manager can reassign story author.");
    }
    data.authorId = await ensureAuthor(payload.authorId);
  }

  if (payload.chapters !== undefined || payload.content !== undefined) {
    const chapters = prepareChapterRecords(payload.chapters, payload.content);
    data.chapters = {
      deleteMany: {},
      ...(chapters.length ? { create: chapters } : {})
    };
  }

  if (payload.scheduledAt !== undefined || data.status !== undefined) {
    const nextStatus = data.status || existing.status;
    const nextScheduledAt = payload.scheduledAt !== undefined
      ? normalizeDateInput(payload.scheduledAt, "scheduledAt")
      : existing.scheduledAt;
    const publishing = resolvePublishingState(nextStatus, nextScheduledAt, existing.publishedAt);
    data.scheduledAt = publishing.scheduledAt;
    data.publishedAt = publishing.publishedAt;
  }

  if (!Object.keys(data).length) {
    return toPublicStory(existing);
  }

  const story = await prisma.story.update({
    where: {
      id
    },
    data,
    include: STORY_INCLUDE
  });

  if (shouldNotifySubscribers(payload, existing, story)) {
    await notifyStorySubscribers(story, existing);
  }

  return toPublicStory(story);
}

async function deleteStory(id, actor) {
  const existing = await prisma.story.findUnique({
    where: {
      id
    },
    select: {
      id: true,
      authorId: true
    }
  });

  if (!existing) {
    throw new AppError(404, "Story not found.");
  }

  ensureStoryPermission(existing, actor);

  const deleted = await prisma.story.delete({
    where: {
      id
    },
    include: STORY_INCLUDE
  });

  return toPublicStory(deleted);
}

module.exports = {
  listStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory
};
