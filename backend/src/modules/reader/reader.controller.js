const service = require("./reader.service");

async function getReaderState(req, res, next) {
  try {
    const data = await service.getReaderState(req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function likeChapter(req, res, next) {
  try {
    const data = await service.likeChapter(req.params.chapterId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function unlikeChapter(req, res, next) {
  try {
    const data = await service.unlikeChapter(req.params.chapterId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function likeStory(req, res, next) {
  try {
    const data = await service.likeStory(req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function unlikeStory(req, res, next) {
  try {
    const data = await service.unlikeStory(req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function saveStory(req, res, next) {
  try {
    const data = await service.saveStory(req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function unsaveStory(req, res, next) {
  try {
    const data = await service.unsaveStory(req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function createCollection(req, res, next) {
  try {
    const data = await service.createCollection(req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function deleteCollection(req, res, next) {
  try {
    const data = await service.deleteCollection(req.params.collectionId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function updateCollection(req, res, next) {
  try {
    const data = await service.updateCollection(req.params.collectionId, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function addStoryToCollection(req, res, next) {
  try {
    const data = await service.addStoryToCollection(req.params.collectionId, req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function removeStoryFromCollection(req, res, next) {
  try {
    const data = await service.removeStoryFromCollection(req.params.collectionId, req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function listPublicCollectionsByUser(req, res, next) {
  try {
    const data = await service.listPublicCollectionsByUser(req.params.userId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function subscribeStoryUpdates(req, res, next) {
  try {
    const data = await service.subscribeStoryUpdates(req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function unsubscribeStoryUpdates(req, res, next) {
  try {
    const data = await service.unsubscribeStoryUpdates(req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function subscribeAuthorUpdates(req, res, next) {
  try {
    const data = await service.subscribeAuthorUpdates(req.params.authorId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function unsubscribeAuthorUpdates(req, res, next) {
  try {
    const data = await service.unsubscribeAuthorUpdates(req.params.authorId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function updateReadingProgress(req, res, next) {
  try {
    const data = await service.updateReadingProgress(req.params.storyId, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function followAuthor(req, res, next) {
  try {
    const data = await service.followAuthor(req.params.authorId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function unfollowAuthor(req, res, next) {
  try {
    const data = await service.unfollowAuthor(req.params.authorId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function listAuthorFollowers(req, res, next) {
  try {
    const data = await service.listAuthorFollowers(req.params.authorId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function listChapterComments(req, res, next) {
  try {
    const data = await service.listChapterComments(req.params.chapterId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function createChapterComment(req, res, next) {
  try {
    const data = await service.createChapterComment(req.params.chapterId, req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function listStoryComments(req, res, next) {
  try {
    const data = await service.listStoryComments(req.params.storyId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function createStoryComment(req, res, next) {
  try {
    const data = await service.createStoryComment(req.params.storyId, req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function listAuthorProfileComments(req, res, next) {
  try {
    const data = await service.listAuthorProfileComments(req.params.authorId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function createAuthorProfileComment(req, res, next) {
  try {
    const data = await service.createAuthorProfileComment(req.params.authorId, req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function replyAuthorProfileComment(req, res, next) {
  try {
    const data = await service.replyAuthorProfileComment(req.params.commentId, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAuthorProfileComment(req, res, next) {
  try {
    const data = await service.deleteAuthorProfileComment(req.params.commentId, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
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
