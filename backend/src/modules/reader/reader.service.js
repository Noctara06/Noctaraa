const AppError = require("../../common/AppError");
const prisma = require("../../config/prisma");
const {
  canFollowAuthorByPolicy,
  canCommentOnStoryByPolicy,
  canViewProfileByPrivacy,
  shouldDeliverNotification
} = require("../../common/user-settings");

const CURRENT_READ_LIMIT = 24;
const COMPLETED_COLLECTION_KEY = "COMPLETED";

function normalizeActor(actor) {
  return {
    userId: String(actor?.userId || "").trim(),
    role: String(actor?.role || "user").trim().toLowerCase()
  };
}

function isPrivilegedRole(role) {
  return role === "admin" || role === "manager";
}

function isReadablePublicStory(story) {
  const now = Date.now();
  const scheduledAt = story.scheduledAt ? new Date(story.scheduledAt).getTime() : null;

  return story.status === "PUBLISHED" &&
    story.visibility === "PUBLIC" &&
    (scheduledAt === null || scheduledAt <= now);
}

async function isFollowingAuthor(client, followerId, authorId) {
  if (!followerId || !authorId || followerId === authorId) {
    return false;
  }

  const existing = await client.userFollow.findUnique({
    where: {
      followerId_authorId: {
        followerId,
        authorId
      }
    },
    select: {
      id: true
    }
  });

  return !!existing;
}

async function ensureReadableStory(storyId, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const story = await prisma.story.findUnique({
    where: {
      id: storyId
    },
    select: {
      id: true,
      authorId: true,
      status: true,
      visibility: true,
      scheduledAt: true
    }
  });

  if (!story) {
    throw new AppError(404, "Story not found.");
  }

  if (
    isPrivilegedRole(currentActor.role) ||
    story.authorId === currentActor.userId ||
    isReadablePublicStory(story)
  ) {
    return story;
  }

  throw new AppError(404, "Story not found.");
}

async function ensureReadableAuthor(authorId, actor) {
  const currentActor = normalizeActor(actor);
  const normalizedAuthorId = String(authorId || "").trim();
  const isPrivileged = isPrivilegedRole(currentActor.role);

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedAuthorId) {
    throw new AppError(400, "authorId is required.");
  }

  const author = await prisma.user.findUnique({
    where: {
      id: normalizedAuthorId
    },
    select: {
      id: true,
      blocked: true,
      profileVisibility: true
    }
  });

  if (!author || author.blocked) {
    throw new AppError(404, "Author not found.");
  }

  const isSelf = currentActor.userId === author.id;
  const isFollower = await isFollowingAuthor(prisma, currentActor.userId, author.id);
  if (!canViewProfileByPrivacy(author, {
    isSelf,
    isFollower,
    isPrivileged
  })) {
    throw new AppError(403, "This profile is private.");
  }

  return author;
}

async function ensureReadableChapter(chapterId, actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const chapter = await prisma.chapter.findUnique({
    where: {
      id: chapterId
    },
    select: {
      id: true,
      title: true,
      storyId: true,
      likes: true,
      story: {
        select: {
          id: true,
          authorId: true,
          status: true,
          visibility: true,
          scheduledAt: true
        }
      }
    }
  });

  if (!chapter || !chapter.story) {
    throw new AppError(404, "Chapter not found.");
  }

  if (
    isPrivilegedRole(currentActor.role) ||
    chapter.story.authorId === currentActor.userId ||
    isReadablePublicStory(chapter.story)
  ) {
    return chapter;
  }

  throw new AppError(404, "Chapter not found.");
}

async function ensurePrimaryChapter(storyId, actor) {
  const story = await ensureReadableStory(storyId, actor);
  const chapter = await prisma.chapter.findFirst({
    where: {
      storyId: story.id
    },
    orderBy: {
      position: "asc"
    },
    select: {
      id: true,
      title: true,
      storyId: true,
      likes: true,
      story: {
        select: {
          id: true,
          authorId: true,
          status: true,
          visibility: true,
          scheduledAt: true
        }
      }
    }
  });

  if (!chapter) {
    throw new AppError(400, "Story has no chapters yet.");
  }

  return chapter;
}

function normalizePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new AppError(400, "percent must be a valid number.");
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeChapterPosition(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new AppError(400, "chapterPosition must be a positive integer.");
  }

  return numeric;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function toPublicProgress(progress) {
  return {
    storyId: progress.storyId,
    percent: Number(progress.percent || 0),
    chapterPosition: progress.chapterPosition || null,
    completedAt: toIsoString(progress.completedAt),
    lastReadAt: toIsoString(progress.lastReadAt),
    createdAt: toIsoString(progress.createdAt),
    updatedAt: toIsoString(progress.updatedAt)
  };
}

function toPublicComment(comment) {
  return {
    id: comment.id,
    storyId: comment.storyId || comment.chapter?.storyId || null,
    chapterId: comment.chapterId || null,
    text: comment.text,
    user: comment.user ? {
      id: comment.user.id,
      email: comment.user.email,
      displayName: comment.user.displayName || null,
      username: comment.user.username || null,
      avatarColor: comment.user.avatarColor || "#7C7CFF"
    } : null,
    createdAt: toIsoString(comment.createdAt),
    updatedAt: toIsoString(comment.updatedAt)
  };
}

function toPublicAuthorProfileComment(comment) {
  return {
    id: comment.id,
    authorId: comment.authorId,
    text: comment.text,
    replyText: comment.replyText || "",
    repliedAt: toIsoString(comment.repliedAt),
    user: comment.user ? {
      id: comment.user.id,
      email: comment.user.email,
      displayName: comment.user.displayName || null,
      username: comment.user.username || null,
      avatarColor: comment.user.avatarColor || "#7C7CFF",
      avatarUrl: comment.user.avatarUrl || null
    } : null,
    createdAt: toIsoString(comment.createdAt),
    updatedAt: toIsoString(comment.updatedAt)
  };
}

function toPublicFollowerUser(entry) {
  return {
    id: entry.follower.id,
    email: entry.follower.email,
    displayName: entry.follower.displayName || null,
    username: entry.follower.username || null,
    avatarColor: entry.follower.avatarColor || "#7C7CFF",
    avatarUrl: entry.follower.avatarUrl || null,
    followedAt: toIsoString(entry.createdAt)
  };
}

function normalizeProfileThreadText(value, fieldLabel, maxLength) {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (!text) {
    throw new AppError(400, `${fieldLabel} is required.`);
  }

  if (text.length > maxLength) {
    throw new AppError(400, `${fieldLabel} must be ${maxLength} characters or fewer.`);
  }

  return text;
}

async function countStoryFeedback(db, storyId) {
  return db.chapterComment.count({
    where: {
      chapter: {
        storyId
      }
    }
  });
}

function normalizeCollectionName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  if (!name) {
    throw new AppError(400, "Collection name is required.");
  }

  if (name.length > 40) {
    throw new AppError(400, "Collection name must be 40 characters or fewer.");
  }

  if (name.toLowerCase() === "completed") {
    throw new AppError(400, "Completed is reserved for finished books.");
  }

  return name;
}

function normalizeCollectionNameKey(name) {
  return normalizeCollectionName(name).toLowerCase();
}

function normalizeCollectionVisibility(value, fallback) {
  if (value === undefined) {
    if (fallback === undefined) {
      throw new AppError(400, "Collection visibility is required.");
    }
    return !!fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    if (fallback === undefined) {
      throw new AppError(400, "Collection visibility is required.");
    }
    return !!fallback;
  }

  if (["public", "true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["private", "false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new AppError(400, "Collection visibility must be public or private.");
}

function toPublicCollection(collection, options = {}) {
  const items = Array.isArray(collection.items) ? collection.items : [];
  const filterStory = typeof options.filterStory === "function" ? options.filterStory : null;

  return {
    id: collection.id,
    name: collection.name,
    systemKey: collection.systemKey ? String(collection.systemKey).toLowerCase() : null,
    isSystem: !!collection.systemKey,
    isPublic: !!collection.isPublic,
    storyIds: items
      .filter((item) => !filterStory || filterStory(item.story || null))
      .map((item) => item.storyId),
    createdAt: toIsoString(collection.createdAt),
    updatedAt: toIsoString(collection.updatedAt)
  };
}

function sortCollections(collections) {
  return [...(Array.isArray(collections) ? collections : [])].sort((left, right) => {
    if (left.systemKey === COMPLETED_COLLECTION_KEY && right.systemKey !== COMPLETED_COLLECTION_KEY) {
      return -1;
    }

    if (right.systemKey === COMPLETED_COLLECTION_KEY && left.systemKey !== COMPLETED_COLLECTION_KEY) {
      return 1;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

async function ensureCompletedCollection(db, userId) {
  return db.readerCollection.upsert({
    where: {
      userId_systemKey: {
        userId,
        systemKey: COMPLETED_COLLECTION_KEY
      }
    },
    update: {
      name: "Completed",
      nameKey: "completed",
      isPublic: false
    },
    create: {
      userId,
      name: "Completed",
      nameKey: "completed",
      systemKey: COMPLETED_COLLECTION_KEY,
      isPublic: false
    }
  });
}

async function ensureOwnedCollection(collectionId, actor, db = prisma) {
  const currentActor = normalizeActor(actor);
  const normalizedCollectionId = String(collectionId || "").trim();

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedCollectionId) {
    throw new AppError(400, "collectionId is required.");
  }

  const collection = await db.readerCollection.findFirst({
    where: {
      id: normalizedCollectionId,
      userId: currentActor.userId
    },
    include: {
      items: {
        select: {
          storyId: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!collection) {
    throw new AppError(404, "Collection not found.");
  }

  return collection;
}

async function createNotification(tx, payload) {
  const userId = String(payload.userId || "").trim();
  const actorUserId = String(payload.actorUserId || "").trim() || null;
  const storyId = String(payload.storyId || "").trim() || null;
  const text = String(payload.text || "").trim();
  const type = String(payload.type || "").trim().toUpperCase();

  if (!userId || !text || !type) {
    return null;
  }

  const recipient = await tx.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      notifyLikes: true,
      notifyComments: true,
      notifyFollows: true,
      notifyStoryUpdates: true
    }
  });

  if (!recipient || !shouldDeliverNotification(type, recipient)) {
    return null;
  }

  return tx.notification.create({
    data: {
      userId,
      actorUserId,
      storyId,
      type,
      text
    }
  });
}

async function getReaderState(actor) {
  const currentActor = normalizeActor(actor);
  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  await ensureCompletedCollection(prisma, currentActor.userId);

  const [likes, libraryItems, follows, subscriptions, authorSubscriptions, progressEntries, collections] = await Promise.all([
    prisma.chapterLike.findMany({
      where: {
        userId: currentActor.userId
      },
      select: {
        chapterId: true,
        chapter: {
          select: {
            storyId: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.libraryItem.findMany({
      where: {
        userId: currentActor.userId
      },
      select: {
        storyId: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.userFollow.findMany({
      where: {
        followerId: currentActor.userId
      },
      select: {
        authorId: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.storySubscription.findMany({
      where: {
        userId: currentActor.userId
      },
      select: {
        storyId: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.authorSubscription.findMany({
      where: {
        userId: currentActor.userId
      },
      select: {
        authorId: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.readingProgress.findMany({
      where: {
        userId: currentActor.userId
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.readerCollection.findMany({
      where: {
        userId: currentActor.userId
      },
      include: {
        items: {
          select: {
            storyId: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    })
  ]);

  const sortedCollections = sortCollections(collections);
  const completedCollection = sortedCollections.find((collection) => collection.systemKey === COMPLETED_COLLECTION_KEY);
  const currentReadStoryIds = libraryItems.map((entry) => entry.storyId);
  const likedChapterIds = likes.map((entry) => entry.chapterId);
  const likedStoryIds = [...new Set(likes.map((entry) => entry.chapter?.storyId).filter(Boolean))];

  return {
    likedChapterIds,
    likedStoryIds,
    savedStoryIds: currentReadStoryIds,
    currentReadStoryIds,
    completedStoryIds: completedCollection ? completedCollection.items.map((entry) => entry.storyId) : [],
    collectionLists: sortedCollections.map(toPublicCollection),
    followedAuthorIds: follows.map((entry) => entry.authorId),
    subscribedStoryIds: subscriptions.map((entry) => entry.storyId),
    subscribedAuthorIds: authorSubscriptions.map((entry) => entry.authorId),
    progress: progressEntries.reduce((acc, entry) => {
      acc[entry.storyId] = toPublicProgress(entry);
      return acc;
    }, {})
  };
}

async function likeChapter(chapterId, actor) {
  const currentActor = normalizeActor(actor);
  const chapter = await ensureReadableChapter(chapterId, actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chapterLike.findUnique({
      where: {
        userId_chapterId: {
          userId: currentActor.userId,
          chapterId: chapter.id
        }
      }
    });

    if (!existing) {
      await tx.chapterLike.create({
        data: {
          userId: currentActor.userId,
          chapterId: chapter.id
        }
      });

      await tx.chapter.update({
        where: {
          id: chapter.id
        },
        data: {
          likes: {
            increment: 1
          }
        }
      });

      await tx.story.update({
        where: {
          id: chapter.storyId
        },
        data: {
          likes: {
            increment: 1
          }
        }
      });
    }

    const [updatedChapter, updatedStory] = await Promise.all([
      tx.chapter.findUnique({
        where: {
          id: chapter.id
        },
        select: {
          id: true,
          likes: true
        }
      }),
      tx.story.findUnique({
        where: {
          id: chapter.storyId
        },
        select: {
          id: true,
          likes: true
        }
      })
    ]);

    return {
      chapterId: chapter.id,
      storyId: chapter.storyId,
      liked: true,
      chapterLikes: Number(updatedChapter?.likes || 0),
      likes: Number(updatedStory?.likes || 0),
      storyLikes: Number(updatedStory?.likes || 0)
    };
  });
}

async function unlikeChapter(chapterId, actor) {
  const currentActor = normalizeActor(actor);
  const chapter = await ensureReadableChapter(chapterId, actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chapterLike.findUnique({
      where: {
        userId_chapterId: {
          userId: currentActor.userId,
          chapterId: chapter.id
        }
      }
    });

    if (existing) {
      await tx.chapterLike.delete({
        where: {
          userId_chapterId: {
            userId: currentActor.userId,
            chapterId: chapter.id
          }
        }
      });

      const [currentChapter, currentStory] = await Promise.all([
        tx.chapter.findUnique({
          where: {
            id: chapter.id
          },
          select: {
            likes: true
          }
        }),
        tx.story.findUnique({
          where: {
            id: chapter.storyId
          },
          select: {
            likes: true
          }
        })
      ]);

      await tx.chapter.update({
        where: {
          id: chapter.id
        },
        data: {
          likes: Math.max(0, Number(currentChapter?.likes || 0) - 1)
        }
      });

      await tx.story.update({
        where: {
          id: chapter.storyId
        },
        data: {
          likes: Math.max(0, Number(currentStory?.likes || 0) - 1)
        }
      });
    }

    const [updatedChapter, updatedStory] = await Promise.all([
      tx.chapter.findUnique({
        where: {
          id: chapter.id
        },
        select: {
          id: true,
          likes: true
        }
      }),
      tx.story.findUnique({
        where: {
          id: chapter.storyId
        },
        select: {
          id: true,
          likes: true
        }
      })
    ]);

    return {
      chapterId: chapter.id,
      storyId: chapter.storyId,
      liked: false,
      chapterLikes: Number(updatedChapter?.likes || 0),
      likes: Number(updatedStory?.likes || 0),
      storyLikes: Number(updatedStory?.likes || 0)
    };
  });
}

async function likeStory(storyId, actor) {
  const chapter = await ensurePrimaryChapter(storyId, actor);
  return likeChapter(chapter.id, actor);
}

async function unlikeStory(storyId, actor) {
  const chapter = await ensurePrimaryChapter(storyId, actor);
  return unlikeChapter(chapter.id, actor);
}

async function saveStory(storyId, actor) {
  const currentActor = normalizeActor(actor);
  const story = await ensureReadableStory(storyId, actor);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.libraryItem.findUnique({
      where: {
        userId_storyId: {
          userId: currentActor.userId,
          storyId: story.id
        }
      }
    });

    if (!existing) {
      const currentReadsCount = await tx.libraryItem.count({
        where: {
          userId: currentActor.userId
        }
      });

      if (currentReadsCount >= CURRENT_READ_LIMIT) {
        throw new AppError(400, "Finish a book first bro 😤");
      }

      await tx.libraryItem.create({
        data: {
          userId: currentActor.userId,
          storyId: story.id
        }
      });
    }

    const nextCount = await tx.libraryItem.count({
      where: {
        userId: currentActor.userId
      }
    });

    return {
      storyId: story.id,
      saved: true,
      currentReadsCount: nextCount,
      currentReadsLimit: CURRENT_READ_LIMIT
    };
  });
}

async function unsaveStory(storyId, actor) {
  const currentActor = normalizeActor(actor);
  const story = await ensureReadableStory(storyId, actor);

  const existing = await prisma.libraryItem.findUnique({
    where: {
      userId_storyId: {
        userId: currentActor.userId,
        storyId: story.id
      }
    },
    select: {
      id: true
    }
  });

  if (existing) {
    await prisma.libraryItem.delete({
      where: {
        userId_storyId: {
          userId: currentActor.userId,
          storyId: story.id
        }
      }
    });
  }

  return {
    storyId: story.id,
    saved: false
  };
}

async function createCollection(payload, actor) {
  const currentActor = normalizeActor(actor);
  const name = normalizeCollectionName(payload?.name);
  const nameKey = normalizeCollectionNameKey(payload?.name);
  const isPublic = normalizeCollectionVisibility(payload?.isPublic, false);

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  const existing = await prisma.readerCollection.findUnique({
    where: {
      userId_nameKey: {
        userId: currentActor.userId,
        nameKey
      }
    }
  });

  if (existing) {
    throw new AppError(409, "A collection with this name already exists.");
  }

  const collection = await prisma.readerCollection.create({
    data: {
      userId: currentActor.userId,
      name,
      nameKey,
      isPublic
    },
    include: {
      items: {
        select: {
          storyId: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  return {
    collection: toPublicCollection(collection)
  };
}

async function updateCollection(collectionId, payload, actor) {
  const collection = await ensureOwnedCollection(collectionId, actor);

  if (collection.systemKey === COMPLETED_COLLECTION_KEY) {
    throw new AppError(400, "The Completed collection visibility cannot be changed.");
  }

  const isPublic = normalizeCollectionVisibility(payload?.isPublic);

  const updated = await prisma.readerCollection.update({
    where: {
      id: collection.id
    },
    data: {
      isPublic
    },
    include: {
      items: {
        select: {
          storyId: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  return {
    collection: toPublicCollection(updated),
    updated: true
  };
}

async function deleteCollection(collectionId, actor) {
  const collection = await ensureOwnedCollection(collectionId, actor);

  if (collection.systemKey === COMPLETED_COLLECTION_KEY) {
    throw new AppError(400, "The Completed collection cannot be deleted.");
  }

  await prisma.readerCollection.delete({
    where: {
      id: collection.id
    }
  });

  return {
    collectionId: collection.id,
    deleted: true
  };
}

async function addStoryToCollection(collectionId, storyId, actor) {
  const currentActor = normalizeActor(actor);
  const collection = await ensureOwnedCollection(collectionId, actor);
  const story = await ensureReadableStory(storyId, actor);

  await prisma.readerCollectionItem.upsert({
    where: {
      collectionId_storyId: {
        collectionId: collection.id,
        storyId: story.id
      }
    },
    update: {},
    create: {
      collectionId: collection.id,
      storyId: story.id
    }
  });

  return {
    collectionId: collection.id,
    storyId: story.id,
    userId: currentActor.userId,
    added: true
  };
}

async function removeStoryFromCollection(collectionId, storyId, actor) {
  const collection = await ensureOwnedCollection(collectionId, actor);
  const story = await ensureReadableStory(storyId, actor);

  await prisma.readerCollectionItem.deleteMany({
    where: {
      collectionId: collection.id,
      storyId: story.id
    }
  });

  return {
    collectionId: collection.id,
    storyId: story.id,
    removed: true
  };
}

async function listPublicCollectionsByUser(userId, actor) {
  const currentActor = normalizeActor(actor);
  const normalizedUserId = String(userId || "").trim();

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedUserId) {
    throw new AppError(400, "userId is required.");
  }

  await ensureReadableAuthor(normalizedUserId, actor);

  const collections = await prisma.readerCollection.findMany({
    where: {
      userId: normalizedUserId,
      systemKey: null,
      isPublic: true
    },
    include: {
      items: {
        select: {
          storyId: true,
          story: {
            select: {
              id: true,
              authorId: true,
              status: true,
              visibility: true,
              scheduledAt: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: [
      {
        name: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });

  const canViewStory = (story) => {
    if (!story) {
      return false;
    }

    return isPrivilegedRole(currentActor.role) ||
      story.authorId === currentActor.userId ||
      isReadablePublicStory(story);
  };

  return collections.map((collection) => toPublicCollection(collection, {
    filterStory: canViewStory
  }));
}

async function subscribeStoryUpdates(storyId, actor) {
  const currentActor = normalizeActor(actor);
  const story = await ensureReadableStory(storyId, actor);

  if (story.authorId === currentActor.userId) {
    throw new AppError(400, "You cannot subscribe to your own story.");
  }

  await prisma.storySubscription.upsert({
    where: {
      userId_storyId: {
        userId: currentActor.userId,
        storyId: story.id
      }
    },
    update: {},
    create: {
      userId: currentActor.userId,
      storyId: story.id
    }
  });

  return {
    storyId: story.id,
    subscribed: true
  };
}

async function unsubscribeStoryUpdates(storyId, actor) {
  const currentActor = normalizeActor(actor);
  const story = await ensureReadableStory(storyId, actor);

  const existing = await prisma.storySubscription.findUnique({
    where: {
      userId_storyId: {
        userId: currentActor.userId,
        storyId: story.id
      }
    },
    select: {
      id: true
    }
  });

  if (existing) {
    await prisma.storySubscription.delete({
      where: {
        userId_storyId: {
          userId: currentActor.userId,
          storyId: story.id
        }
      }
    });
  }

  return {
    storyId: story.id,
    subscribed: false
  };
}

async function subscribeAuthorUpdates(authorId, actor) {
  const currentActor = normalizeActor(actor);
  const author = await ensureReadableAuthor(authorId, actor);

  if (author.id === currentActor.userId) {
    throw new AppError(400, "You cannot subscribe to your own author profile.");
  }

  await prisma.authorSubscription.upsert({
    where: {
      userId_authorId: {
        userId: currentActor.userId,
        authorId: author.id
      }
    },
    update: {},
    create: {
      userId: currentActor.userId,
      authorId: author.id
    }
  });

  return {
    authorId: author.id,
    subscribed: true
  };
}

async function unsubscribeAuthorUpdates(authorId, actor) {
  const currentActor = normalizeActor(actor);
  const author = await ensureReadableAuthor(authorId, actor);

  const existing = await prisma.authorSubscription.findUnique({
    where: {
      userId_authorId: {
        userId: currentActor.userId,
        authorId: author.id
      }
    },
    select: {
      id: true
    }
  });

  if (existing) {
    await prisma.authorSubscription.delete({
      where: {
        userId_authorId: {
          userId: currentActor.userId,
          authorId: author.id
        }
      }
    });
  }

  return {
    authorId: author.id,
    subscribed: false
  };
}

async function updateReadingProgress(storyId, payload, actor) {
  const currentActor = normalizeActor(actor);
  const story = await ensureReadableStory(storyId, actor);
  const percent = normalizePercent(payload.percent);
  const chapterPosition = normalizeChapterPosition(payload.chapterPosition);
  const completedAt = percent >= 100 ? new Date() : null;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.readingProgress.findUnique({
      where: {
        userId_storyId: {
          userId: currentActor.userId,
          storyId: story.id
        }
      }
    });

    let progress;

    if (existing) {
      progress = await tx.readingProgress.update({
        where: {
          userId_storyId: {
            userId: currentActor.userId,
            storyId: story.id
          }
        },
        data: {
          percent,
          chapterPosition,
          completedAt,
          lastReadAt: now
        }
      });
    } else {
      progress = await tx.readingProgress.create({
        data: {
          userId: currentActor.userId,
          storyId: story.id,
          percent,
          chapterPosition,
          completedAt,
          lastReadAt: now
        }
      });

      await tx.story.update({
        where: {
          id: story.id
        },
        data: {
          reads: {
            increment: 1
          }
        }
      });
    }

    if (percent >= 100) {
      const completedCollection = await ensureCompletedCollection(tx, currentActor.userId);

      await tx.readerCollectionItem.upsert({
        where: {
          collectionId_storyId: {
            collectionId: completedCollection.id,
            storyId: story.id
          }
        },
        update: {},
        create: {
          collectionId: completedCollection.id,
          storyId: story.id
        }
      });

      await tx.libraryItem.deleteMany({
        where: {
          userId: currentActor.userId,
          storyId: story.id
        }
      });
    }

    const updatedStory = await tx.story.findUnique({
      where: {
        id: story.id
      },
      select: {
        reads: true
      }
    });

    return {
      storyId: story.id,
      reads: Number(updatedStory?.reads || 0),
      completed: percent >= 100,
      progress: toPublicProgress(progress)
    };
  });
}

async function followAuthor(authorId, actor) {
  const currentActor = normalizeActor(actor);
  const normalizedAuthorId = String(authorId || "").trim();

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedAuthorId) {
    throw new AppError(400, "authorId is required.");
  }

  if (currentActor.userId === normalizedAuthorId) {
    throw new AppError(400, "You cannot follow yourself.");
  }

  const author = await prisma.user.findUnique({
    where: {
      id: normalizedAuthorId
    },
    select: {
      id: true,
      followPermission: true,
      displayName: true,
      username: true,
      email: true
    }
  });

  if (!author) {
    throw new AppError(404, "Author not found.");
  }

  if (!canFollowAuthorByPolicy(author.followPermission)) {
    throw new AppError(403, "This author is not accepting new followers right now.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.userFollow.findUnique({
      where: {
        followerId_authorId: {
          followerId: currentActor.userId,
          authorId: normalizedAuthorId
        }
      }
    });

    if (!existing) {
      await tx.userFollow.create({
        data: {
          followerId: currentActor.userId,
          authorId: normalizedAuthorId
        }
      });

      await createNotification(tx, {
        userId: normalizedAuthorId,
        actorUserId: currentActor.userId,
        type: "FOLLOW",
        text: "You have a new follower."
      });
    }

    const followersCount = await tx.userFollow.count({
      where: {
        authorId: normalizedAuthorId
      }
    });

    return {
      authorId: normalizedAuthorId,
      following: true,
      followersCount
    };
  });
}

async function unfollowAuthor(authorId, actor) {
  const currentActor = normalizeActor(actor);
  const normalizedAuthorId = String(authorId || "").trim();

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedAuthorId) {
    throw new AppError(400, "authorId is required.");
  }

  const existing = await prisma.userFollow.findUnique({
    where: {
      followerId_authorId: {
        followerId: currentActor.userId,
        authorId: normalizedAuthorId
      }
    },
    select: {
      id: true
    }
  });

  if (existing) {
    await prisma.userFollow.delete({
      where: {
        followerId_authorId: {
          followerId: currentActor.userId,
          authorId: normalizedAuthorId
        }
      }
    });
  }

  const followersCount = await prisma.userFollow.count({
    where: {
      authorId: normalizedAuthorId
    }
  });

  return {
    authorId: normalizedAuthorId,
    following: false,
    followersCount
  };
}

async function listAuthorFollowers(authorId, actor) {
  const author = await ensureReadableAuthor(authorId, actor);

  const followers = await prisma.userFollow.findMany({
    where: {
      authorId: author.id
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      follower: {
        select: {
          id: true,
          email: true,
          displayName: true,
          username: true,
          avatarColor: true,
          avatarUrl: true
        }
      }
    }
  });

  return followers.map(toPublicFollowerUser);
}

async function listChapterComments(chapterId, actor) {
  const chapter = await ensureReadableChapter(chapterId, actor);

  const comments = await prisma.chapterComment.findMany({
    where: {
      chapterId: chapter.id
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          username: true,
          avatarColor: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return comments.map(toPublicComment);
}

async function createChapterComment(chapterId, payload, actor) {
  const currentActor = normalizeActor(actor);
  const chapter = await ensureReadableChapter(chapterId, actor);
  const text = String(payload.text || "").trim();

  if (!text) {
    throw new AppError(400, "Comment text is required.");
  }

  const storyAuthor = await prisma.user.findUnique({
    where: {
      id: chapter.story.authorId
    },
    select: {
      id: true,
      storyCommentPermission: true
    }
  });

  if (!storyAuthor) {
    throw new AppError(404, "Author not found.");
  }

  const isFollower = await isFollowingAuthor(prisma, currentActor.userId, storyAuthor.id);
  if (!canCommentOnStoryByPolicy(storyAuthor.storyCommentPermission, {
    isSelf: currentActor.userId === storyAuthor.id,
    isFollower
  })) {
    throw new AppError(403, "This author has limited who can comment on stories.");
  }

  return prisma.$transaction(async (tx) => {
    const comment = await tx.chapterComment.create({
      data: {
        chapterId: chapter.id,
        userId: currentActor.userId,
        text
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            username: true,
            avatarColor: true
          }
        },
        chapter: {
          select: {
            storyId: true
          }
        }
      }
    });

    if (chapter.story.authorId !== currentActor.userId) {
      await createNotification(tx, {
        userId: chapter.story.authorId,
        actorUserId: currentActor.userId,
        storyId: chapter.storyId,
        type: "COMMENT",
        text: `New comment on your chapter.`
      });
    }

    const [commentsCount, storyCommentsCount] = await Promise.all([
      tx.chapterComment.count({
        where: {
          chapterId: chapter.id
        }
      }),
      countStoryFeedback(tx, chapter.storyId)
    ]);

    return {
      chapterId: chapter.id,
      storyId: chapter.storyId,
      comment: toPublicComment(comment),
      commentsCount,
      storyCommentsCount
    };
  });
}

async function listStoryComments(storyId, actor) {
  const chapter = await ensurePrimaryChapter(storyId, actor);
  return listChapterComments(chapter.id, actor);
}

async function createStoryComment(storyId, payload, actor) {
  const chapter = await ensurePrimaryChapter(storyId, actor);
  return createChapterComment(chapter.id, payload, actor);
}

async function listAuthorProfileComments(authorId, actor) {
  const author = await ensureReadableAuthor(authorId, actor);

  const comments = await prisma.authorProfileComment.findMany({
    where: {
      authorId: author.id
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          username: true,
          avatarColor: true,
          avatarUrl: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return comments.map(toPublicAuthorProfileComment);
}

async function createAuthorProfileComment(authorId, payload, actor) {
  const currentActor = normalizeActor(actor);
  const author = await ensureReadableAuthor(authorId, actor);

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (currentActor.userId === author.id) {
    throw new AppError(400, "Use reply to answer reader questions on your own profile.");
  }

  const text = normalizeProfileThreadText(payload.text, "Question", 600);

  return prisma.$transaction(async (tx) => {
    const comment = await tx.authorProfileComment.create({
      data: {
        authorId: author.id,
        userId: currentActor.userId,
        text
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            username: true,
            avatarColor: true,
            avatarUrl: true
          }
        }
      }
    });

    await createNotification(tx, {
      userId: author.id,
      actorUserId: currentActor.userId,
      type: "COMMENT",
      text: "New question on your author profile."
    });

    return {
      authorId: author.id,
      comment: toPublicAuthorProfileComment(comment)
    };
  });
}

async function replyAuthorProfileComment(commentId, payload, actor) {
  const currentActor = normalizeActor(actor);
  const normalizedCommentId = String(commentId || "").trim();

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedCommentId) {
    throw new AppError(400, "commentId is required.");
  }

  const text = normalizeProfileThreadText(payload.text, "Reply", 1000);

  const existing = await prisma.authorProfileComment.findUnique({
    where: {
      id: normalizedCommentId
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          username: true,
          avatarColor: true,
          avatarUrl: true
        }
      }
    }
  });

  if (!existing) {
    throw new AppError(404, "Question not found.");
  }

  if (!isPrivilegedRole(currentActor.role) && existing.authorId !== currentActor.userId) {
    throw new AppError(403, "Only the author can reply here.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.authorProfileComment.update({
      where: {
        id: existing.id
      },
      data: {
        replyText: text,
        repliedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            username: true,
            avatarColor: true,
            avatarUrl: true
          }
        }
      }
    });

    if (updated.userId && updated.userId !== currentActor.userId) {
      await createNotification(tx, {
        userId: updated.userId,
        actorUserId: currentActor.userId,
        type: "COMMENT",
        text: "Author replied to your profile question."
      });
    }

    return {
      authorId: updated.authorId,
      comment: toPublicAuthorProfileComment(updated)
    };
  });
}

async function deleteAuthorProfileComment(commentId, actor) {
  const currentActor = normalizeActor(actor);
  const normalizedCommentId = String(commentId || "").trim();

  if (!currentActor.userId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!normalizedCommentId) {
    throw new AppError(400, "commentId is required.");
  }

  const existing = await prisma.authorProfileComment.findUnique({
    where: {
      id: normalizedCommentId
    },
    select: {
      id: true,
      authorId: true
    }
  });

  if (!existing) {
    throw new AppError(404, "Question not found.");
  }

  if (!isPrivilegedRole(currentActor.role) && existing.authorId !== currentActor.userId) {
    throw new AppError(403, "Only the author can delete questions here.");
  }

  await prisma.authorProfileComment.delete({
    where: {
      id: existing.id
    }
  });

  return {
    id: existing.id,
    authorId: existing.authorId,
    deleted: true
  };
}

module.exports = {
  getReaderState,
  likeChapter,
  unlikeChapter,
  likeStory,
  unlikeStory,
  saveStory,
  unsaveStory,
  createCollection,
  updateCollection,
  deleteCollection,
  addStoryToCollection,
  removeStoryFromCollection,
  listPublicCollectionsByUser,
  subscribeStoryUpdates,
  unsubscribeStoryUpdates,
  subscribeAuthorUpdates,
  unsubscribeAuthorUpdates,
  updateReadingProgress,
  followAuthor,
  unfollowAuthor,
  listAuthorFollowers,
  listChapterComments,
  createChapterComment,
  listStoryComments,
  createStoryComment,
  listAuthorProfileComments,
  createAuthorProfileComment,
  replyAuthorProfileComment,
  deleteAuthorProfileComment
};
