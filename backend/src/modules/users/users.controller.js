const service = require("./users.service");

function toAbsoluteMediaUrl(req, value) {
  const raw = String(value || "").trim();
  if (!raw || /^https?:/i.test(raw) || /^data:/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${req.protocol}://${req.get("host")}${raw}`;
  }

  return raw;
}

function toPublicUserResponse(req, user) {
  if (!user || typeof user !== "object") {
    return user;
  }

  return {
    ...user,
    avatarUrl: toAbsoluteMediaUrl(req, user.avatarUrl),
    coverPhotoUrl: toAbsoluteMediaUrl(req, user.coverPhotoUrl)
  };
}

async function listUsers(req, res, next) {
  try {
    const users = await service.listUsers();
    res.status(200).json({
      success: true,
      data: Array.isArray(users) ? users.map((user) => toPublicUserResponse(req, user)) : users
    });
  } catch (error) {
    next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await service.getUserById(req.params.id, req.auth || {});
    res.status(200).json({
      success: true,
      data: toPublicUserResponse(req, user)
    });
  } catch (error) {
    next(error);
  }
}

async function getUserSettings(req, res, next) {
  try {
    const data = await service.getUserSettings(req.params.id, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function updateAccountSettings(req, res, next) {
  try {
    const data = await service.updateAccountSettings(req.params.id, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function updatePrivacySettings(req, res, next) {
  try {
    const data = await service.updatePrivacySettings(req.params.id, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function updateNotificationSettings(req, res, next) {
  try {
    const data = await service.updateNotificationSettings(req.params.id, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await service.updateUser(req.params.id, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data: toPublicUserResponse(req, user)
    });
  } catch (error) {
    next(error);
  }
}

async function uploadUserProfileMedia(req, res, next) {
  try {
    const payload = await service.uploadUserProfileMedia(req.params.id, req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data: {
        ...payload,
        url: toAbsoluteMediaUrl(req, payload.url),
        user: toPublicUserResponse(req, payload && payload.user)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function listDeletionRequests(req, res, next) {
  try {
    const requests = await service.listDeletionRequests(req.auth || {});
    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    next(error);
  }
}

async function requestAccountDeletion(req, res, next) {
  try {
    const data = await service.requestAccountDeletion(req.params.id, req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function sendDeletionWarning(req, res, next) {
  try {
    const request = await service.sendDeletionWarning(req.params.id, req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
}

async function reviewDeletionRequest(req, res, next) {
  try {
    const request = await service.reviewDeletionRequest(req.params.id, req.body || {}, req.auth || {});
    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const request = await service.deleteUser(req.params.id, req.auth || {});
    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  getUserById,
  getUserSettings,
  uploadUserProfileMedia,
  updateAccountSettings,
  updatePrivacySettings,
  updateNotificationSettings,
  updateUser,
  listDeletionRequests,
  requestAccountDeletion,
  sendDeletionWarning,
  reviewDeletionRequest,
  deleteUser
};
