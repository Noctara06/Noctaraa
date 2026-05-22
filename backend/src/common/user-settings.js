const AppError = require("./AppError");

const PROFILE_VISIBILITY = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private"
});

const FOLLOW_PERMISSION = Object.freeze({
  EVERYONE: "everyone",
  NO_ONE: "no_one"
});

const COMMENT_PERMISSION = Object.freeze({
  EVERYONE: "everyone",
  FOLLOWERS: "followers",
  NO_ONE: "no_one"
});

const READING_ACTIVITY_VISIBILITY = Object.freeze({
  EVERYONE: "everyone",
  FOLLOWERS: "followers",
  ONLY_ME: "only_me"
});

const PROFILE_VISIBILITY_INPUT_TO_ENUM = Object.freeze({
  public: "PUBLIC",
  private: "PRIVATE"
});

const FOLLOW_PERMISSION_INPUT_TO_ENUM = Object.freeze({
  everyone: "EVERYONE",
  no_one: "NO_ONE"
});

const COMMENT_PERMISSION_INPUT_TO_ENUM = Object.freeze({
  everyone: "EVERYONE",
  followers: "FOLLOWERS",
  no_one: "NO_ONE"
});

const READING_ACTIVITY_INPUT_TO_ENUM = Object.freeze({
  everyone: "EVERYONE",
  followers: "FOLLOWERS",
  only_me: "ONLY_ME",
  private: "ONLY_ME"
});

const PROFILE_VISIBILITY_ENUM_TO_OUTPUT = Object.freeze({
  PUBLIC: PROFILE_VISIBILITY.PUBLIC,
  PRIVATE: PROFILE_VISIBILITY.PRIVATE
});

const FOLLOW_PERMISSION_ENUM_TO_OUTPUT = Object.freeze({
  EVERYONE: FOLLOW_PERMISSION.EVERYONE,
  NO_ONE: FOLLOW_PERMISSION.NO_ONE
});

const COMMENT_PERMISSION_ENUM_TO_OUTPUT = Object.freeze({
  EVERYONE: COMMENT_PERMISSION.EVERYONE,
  FOLLOWERS: COMMENT_PERMISSION.FOLLOWERS,
  NO_ONE: COMMENT_PERMISSION.NO_ONE
});

const READING_ACTIVITY_ENUM_TO_OUTPUT = Object.freeze({
  EVERYONE: READING_ACTIVITY_VISIBILITY.EVERYONE,
  FOLLOWERS: READING_ACTIVITY_VISIBILITY.FOLLOWERS,
  ONLY_ME: READING_ACTIVITY_VISIBILITY.ONLY_ME
});

function normalizeProfileVisibility(value, fallback = PROFILE_VISIBILITY.PUBLIC) {
  const key = String(value || fallback).trim().toLowerCase();
  const normalized = PROFILE_VISIBILITY_INPUT_TO_ENUM[key];
  if (!normalized) {
    throw new AppError(400, "Profile visibility must be public or private.");
  }

  return normalized;
}

function normalizeFollowPermission(value, fallback = FOLLOW_PERMISSION.EVERYONE) {
  const key = String(value || fallback).trim().toLowerCase();
  const normalized = FOLLOW_PERMISSION_INPUT_TO_ENUM[key];
  if (!normalized) {
    throw new AppError(400, "Follow permission must be everyone or no_one.");
  }

  return normalized;
}

function normalizeCommentPermission(value, fallback = COMMENT_PERMISSION.EVERYONE) {
  const key = String(value || fallback).trim().toLowerCase();
  const normalized = COMMENT_PERMISSION_INPUT_TO_ENUM[key];
  if (!normalized) {
    throw new AppError(400, "Story comment permission must be everyone, followers, or no_one.");
  }

  return normalized;
}

function normalizeReadingActivityVisibility(value, fallback = READING_ACTIVITY_VISIBILITY.ONLY_ME) {
  const key = String(value || fallback).trim().toLowerCase();
  const normalized = READING_ACTIVITY_INPUT_TO_ENUM[key];
  if (!normalized) {
    throw new AppError(400, "Reading activity visibility must be everyone, followers, or only_me.");
  }

  return normalized;
}

function toPublicPrivacySettings(user) {
  return {
    profileVisibility: PROFILE_VISIBILITY_ENUM_TO_OUTPUT[String(user?.profileVisibility || "PUBLIC").trim().toUpperCase()] || PROFILE_VISIBILITY.PUBLIC,
    followPermission: FOLLOW_PERMISSION_ENUM_TO_OUTPUT[String(user?.followPermission || "EVERYONE").trim().toUpperCase()] || FOLLOW_PERMISSION.EVERYONE,
    storyCommentPermission: COMMENT_PERMISSION_ENUM_TO_OUTPUT[String(user?.storyCommentPermission || "EVERYONE").trim().toUpperCase()] || COMMENT_PERMISSION.EVERYONE,
    readingActivityVisibility: READING_ACTIVITY_ENUM_TO_OUTPUT[String(user?.readingActivityVisibility || "ONLY_ME").trim().toUpperCase()] || READING_ACTIVITY_VISIBILITY.ONLY_ME
  };
}

function toPublicNotificationPreferences(user) {
  return {
    likes: user?.notifyLikes !== false,
    comments: user?.notifyComments !== false,
    follows: user?.notifyFollows !== false,
    storyUpdates: user?.notifyStoryUpdates !== false
  };
}

function canFollowAuthorByPolicy(policy) {
  return String(policy || "EVERYONE").trim().toUpperCase() !== "NO_ONE";
}

function canCommentOnStoryByPolicy(policy, options = {}) {
  const normalized = String(policy || "EVERYONE").trim().toUpperCase();
  if (normalized === "NO_ONE") {
    return !!options.isSelf;
  }

  if (normalized === "FOLLOWERS") {
    return !!options.isSelf || !!options.isFollower;
  }

  return true;
}

function canViewProfileByPrivacy(user, options = {}) {
  const visibility = String(user?.profileVisibility || "PUBLIC").trim().toUpperCase();
  if (visibility !== "PRIVATE") {
    return true;
  }

  return !!options.isSelf || !!options.isFollower || !!options.isPrivileged;
}

function shouldDeliverNotification(type, preferences = {}) {
  const normalized = String(type || "").trim().toUpperCase();
  if (!normalized) {
    return false;
  }

  if (normalized === "FOLLOW") {
    return preferences.notifyFollows !== false;
  }

  if (normalized === "COMMENT") {
    return preferences.notifyComments !== false;
  }

  if (normalized === "STORY_UPDATE") {
    return preferences.notifyStoryUpdates !== false;
  }

  if (normalized === "LIKE") {
    return preferences.notifyLikes !== false;
  }

  return true;
}

module.exports = {
  PROFILE_VISIBILITY,
  FOLLOW_PERMISSION,
  COMMENT_PERMISSION,
  READING_ACTIVITY_VISIBILITY,
  normalizeProfileVisibility,
  normalizeFollowPermission,
  normalizeCommentPermission,
  normalizeReadingActivityVisibility,
  toPublicPrivacySettings,
  toPublicNotificationPreferences,
  canFollowAuthorByPolicy,
  canCommentOnStoryByPolicy,
  canViewProfileByPrivacy,
  shouldDeliverNotification
};
