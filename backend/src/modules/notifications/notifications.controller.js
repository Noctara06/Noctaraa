const service = require("./notifications.service");

async function listNotifications(req, res, next) {
  try {
    const data = await service.listNotifications(req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    const data = await service.markAllRead(req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  markAllRead
};
