const service = require("./stories.service");

async function listStories(req, res, next) {
  try {
    const stories = await service.listStories(req.query || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data: stories
    });
  } catch (error) {
    next(error);
  }
}

async function getStoryById(req, res, next) {
  try {
    const story = await service.getStoryById(req.params.id, req.auth || {});
    res.status(200).json({
      success: true,
      data: story
    });
  } catch (error) {
    next(error);
  }
}

async function createStory(req, res, next) {
  try {
    const story = await service.createStory(req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data: story
    });
  } catch (error) {
    next(error);
  }
}

async function updateStory(req, res, next) {
  try {
    const story = await service.updateStory(req.params.id, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data: story
    });
  } catch (error) {
    next(error);
  }
}

async function deleteStory(req, res, next) {
  try {
    const deleted = await service.deleteStory(req.params.id, req.auth || {});
    res.status(200).json({
      success: true,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory
};
