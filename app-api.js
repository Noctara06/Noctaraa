(function initMidnightApi() {
  const API_BASE_STORAGE_KEY = "midnight_api_base";
  const LEGACY_API_BASE_STORAGE_KEY = "audio_platform_api_base";
  const API_BASE_STORAGE_KEYS = [API_BASE_STORAGE_KEY, LEGACY_API_BASE_STORAGE_KEY];
const DEFAULT_LOCAL_API_BASE = "https://noctaraa-1.onrender.com/api/v1";
const API_BASE = resolveApiBase();
  const SESSION_KEY = "midnight_session";
  const LEGACY_SESSION_KEY = "audio_platform_session";
  const SESSION_STORAGE_KEYS = [SESSION_KEY, LEGACY_SESSION_KEY];
  const USERS_KEY = "midnight_users";
  const LEGACY_USERS_KEY = "audio_platform_users";
  const USER_STORAGE_KEYS = [USERS_KEY, LEGACY_USERS_KEY];

  function normalizeApiBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function isInlineMediaUrl(value) {
    return /^data:/i.test(String(value || "").trim());
  }

  function readFirstStorageValue(keys) {
    const list = Array.isArray(keys) ? keys : [keys];

    for (const key of list) {
      const value = localStorage.getItem(key);
      if (value) {
        return value;
      }
    }

    return "";
  }

  function readConfiguredApiBase() {
    const globalBase = window.MIDNIGHT_CONFIG && window.MIDNIGHT_CONFIG.apiBase;
    const legacyGlobalBase = window.AUDIO_HUB_CONFIG && window.AUDIO_HUB_CONFIG.apiBase;
    const storedBase = readFirstStorageValue(API_BASE_STORAGE_KEYS);
    return normalizeApiBase(globalBase || legacyGlobalBase || storedBase);
  }

  function resolveApiBase() {
    const configuredBase = readConfiguredApiBase();
    if (configuredBase) {
      return configuredBase;
    }

    if (typeof window !== "undefined" && window.location) {
      if (window.location.protocol === "file:") {
        return DEFAULT_LOCAL_API_BASE;
      }

      const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "");
      if (isLocalHost && String(window.location.port || "") !== "5000") {
        return DEFAULT_LOCAL_API_BASE;
      }

      if (window.location.origin && /^https?:/i.test(window.location.origin)) {
        return `${window.location.origin.replace(/\/+$/, "")}/api/v1`;
      }
    }

    return DEFAULT_LOCAL_API_BASE;
  }

  function resolveAssetBase() {
    try {
      return new URL(API_BASE).origin;
    } catch (error) {
      if (typeof window !== "undefined" && window.location && /^https?:/i.test(window.location.origin || "")) {
        return window.location.origin.replace(/\/+$/, "");
      }

      return "https://noctaraa-1.onrender.com";
    }
  }

  function absolutizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || /^https?:/i.test(raw) || /^data:/i.test(raw) || /^url\(/i.test(raw)) {
      return raw;
    }

    if (raw.startsWith("/")) {
      return `${resolveAssetBase()}${raw}`;
    }

    return raw;
  }

  function normalizeUserMedia(user) {
    if (!user || typeof user !== "object") {
      return user;
    }

    return {
      ...user,
      avatarUrl: absolutizeUrl(user.avatarUrl),
      coverPhotoUrl: absolutizeUrl(user.coverPhotoUrl)
    };
  }

  function normalizeStoryMedia(story) {
    if (!story || typeof story !== "object") {
      return story;
    }

    const normalizedCover = absolutizeUrl(story.coverUrl || story.cover || "");
    return {
      ...story,
      coverUrl: normalizedCover || story.coverUrl || "",
      cover: normalizedCover || story.cover || "",
      author: normalizeUserMedia(story.author)
    };
  }

  function normalizeAuthorProfileComment(comment) {
    if (!comment || typeof comment !== "object") {
      return comment;
    }

    return {
      ...comment,
      user: normalizeUserMedia(comment.user)
    };
  }

  function normalizeFollowerUser(user) {
    if (!user || typeof user !== "object") {
      return user;
    }

    return normalizeUserMedia(user);
  }

  function readJSON(keys, fallback) {
    const list = Array.isArray(keys) ? keys : [keys];

    try {
      for (const key of list) {
        const value = localStorage.getItem(key);
        if (value) {
          return JSON.parse(value);
        }
      }

      return fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(keys, value) {
    const serialized = JSON.stringify(value);
    const list = Array.isArray(keys) ? keys : [keys];
    const [primaryKey, ...legacyKeys] = list;

    for (const key of legacyKeys) {
      localStorage.removeItem(key);
    }

    if (!primaryKey) {
      return;
    }

    localStorage.setItem(primaryKey, serialized);
  }

  function removeStorageKeys(keys) {
    const list = Array.isArray(keys) ? keys : [keys];

    for (const key of list) {
      localStorage.removeItem(key);
    }
  }

  function normalizeRole(value) {
    return String(value || "user").trim().toLowerCase();
  }

  function normalizeMode(value) {
    return String(value || "reader").trim().toLowerCase();
  }

  function getSession() {
    const session = readJSON(SESSION_STORAGE_KEYS, null);
    return session && typeof session === "object" ? session : null;
  }

  function buildStoredSessionUser(user) {
    if (!user || typeof user !== "object") {
      return user;
    }

    return {
      ...user,
      // Avoid blowing up localStorage when old profiles still store inline base64 media.
      avatarUrl: isInlineMediaUrl(user.avatarUrl) ? "" : String(user.avatarUrl || "").trim(),
      coverPhotoUrl: isInlineMediaUrl(user.coverPhotoUrl) ? "" : String(user.coverPhotoUrl || "").trim()
    };
  }

  function syncUserStore(user) {
    if (!user || !user.email) {
      return;
    }

    const users = readJSON(USER_STORAGE_KEYS, []);
    const list = Array.isArray(users) ? users : [];
    const email = String(user.email).trim().toLowerCase();
    const next = list.filter((entry) => String(entry && entry.email || "").trim().toLowerCase() !== email);
    next.push({
      email: user.email,
      role: normalizeRole(user.role),
      blocked: !!user.blocked
    });
    writeJSON(USER_STORAGE_KEYS, next);
  }

  function normalizeSessionPayload(authData, previousSession) {
    const current = previousSession || getSession();
    const user = normalizeUserMedia(authData && authData.user ? authData.user : current && current.user);
    const storedUser = buildStoredSessionUser(user);

    if (!storedUser || !storedUser.id || !storedUser.email) {
      return null;
    }

    const session = {
      accessToken: authData && authData.accessToken ? authData.accessToken : (current && current.accessToken) || "",
      refreshToken: authData && authData.refreshToken ? authData.refreshToken : (current && current.refreshToken) || "",
      tokenType: authData && authData.tokenType ? authData.tokenType : (current && current.tokenType) || "Bearer",
      expiresIn: authData && authData.expiresIn ? authData.expiresIn : (current && current.expiresIn) || "",
      loggedInAt: (current && current.loggedInAt) || new Date().toISOString(),
      email: storedUser.email,
      role: normalizeRole(storedUser.role),
      mode: normalizeMode(storedUser.mode),
      user: storedUser
    };

    syncUserStore(storedUser);
    return session;
  }

  function setSession(authData) {
    const session = normalizeSessionPayload(authData);
    if (!session) {
      throw new Error("Invalid session payload.");
    }
    writeJSON(SESSION_STORAGE_KEYS, session);
    return session;
  }

  function updateSessionUser(user) {
    const current = getSession();
    if (!current) {
      return null;
    }

    const session = normalizeSessionPayload({ user }, current);
    if (!session) {
      return null;
    }

    writeJSON(SESSION_STORAGE_KEYS, session);
    return session;
  }

  function clearSession() {
    removeStorageKeys(SESSION_STORAGE_KEYS);
  }

  function getApiBase() {
    return API_BASE;
  }

  function setApiBaseOverride(value) {
    const nextBase = normalizeApiBase(value);
    if (!nextBase) {
      removeStorageKeys(API_BASE_STORAGE_KEYS);
      return resolveApiBase();
    }

    const [primaryKey, ...legacyKeys] = API_BASE_STORAGE_KEYS;
    for (const key of legacyKeys) {
      localStorage.removeItem(key);
    }

    if (primaryKey) {
      localStorage.setItem(primaryKey, nextBase);
    }

    return nextBase;
  }

  function clearApiBaseOverride() {
    removeStorageKeys(API_BASE_STORAGE_KEYS);
    return resolveApiBase();
  }

  function createError(message, status, payload) {
    const error = new Error(message);
    error.status = status || 500;
    error.payload = payload || null;
    error.details = payload && payload.details ? payload.details : null;
    return error;
  }

  async function parseResponse(response) {
    let payload = null;

    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      throw createError(
        payload && payload.message ? payload.message : `Request failed with status ${response.status}.`,
        response.status,
        payload
      );
    }

    return payload;
  }

  function buildUrl(path, params) {
    const url = new URL(`${API_BASE}${path}`);

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  async function request(path, options) {
    const config = options || {};
    const method = config.method || "GET";
    const auth = config.auth || "optional";
    const retryOnUnauthorized = config.retryOnUnauthorized !== false;
    const session = getSession();

    if (auth === "required" && (!session || !session.accessToken)) {
      throw createError("Please log in again.", 401, null);
    }

    const headers = new Headers(config.headers || {});
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (auth !== "none" && session && session.accessToken) {
      headers.set("Authorization", `${session.tokenType || "Bearer"} ${session.accessToken}`);
    }

    let body = config.body;
    if (body !== undefined && body !== null && !(body instanceof FormData)) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      body = JSON.stringify(body);
    }

    try {
      const response = await fetch(buildUrl(path, config.query), {
        method,
        headers,
        body,
        cache: "no-store"
      });
      return await parseResponse(response);
    } catch (error) {
      if (
        retryOnUnauthorized &&
        auth !== "none" &&
        error &&
        error.status === 401 &&
        session &&
        session.refreshToken
      ) {
        await refreshSession();
        return request(path, {
          ...config,
          retryOnUnauthorized: false
        });
      }

      throw error;
    }
  }

  async function refreshSession() {
    const session = getSession();
    if (!session || !session.refreshToken) {
      clearSession();
      throw createError("Session expired. Please log in again.", 401, null);
    }

    try {
      const response = await request("/auth/refresh", {
        method: "POST",
        auth: "none",
        body: {
          refreshToken: session.refreshToken
        },
        retryOnUnauthorized: false
      });
      return setSession(response.data);
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function login(payload) {
    const response = await request("/auth/login", {
      method: "POST",
      auth: "none",
      body: payload,
      retryOnUnauthorized: false
    });
    return setSession(response.data);
  }

  async function signup(payload) {
    const response = await request("/auth/signup", {
      method: "POST",
      auth: "none",
      body: payload,
      retryOnUnauthorized: false
    });
    return setSession(response.data);
  }

  async function logout() {
    const session = getSession();

    if (session && session.refreshToken) {
      try {
        await request("/auth/logout", {
          method: "POST",
          auth: "none",
          body: {
            refreshToken: session.refreshToken
          },
          retryOnUnauthorized: false
        });
      } catch (error) {
        // Logout should still clear the local session even if the backend call fails.
      }
    }

    clearSession();
  }

  async function hydrateCurrentUser() {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}`, {
      method: "GET",
      auth: "required"
    });

    return updateSessionUser(response.data);
  }

  async function getUserById(id) {
    const userId = String(id || "").trim();
    if (!userId) {
      throw createError("User id is required.", 400, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}`, {
      method: "GET",
      auth: "required"
    });

    return normalizeUserMedia(response.data);
  }

  async function getCurrentUserSettings() {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}/settings`, {
      method: "GET",
      auth: "required"
    });

    const data = response.data || {};
    if (data.user) {
      data.user = normalizeUserMedia(data.user);
    }
    return data;
  }

  async function updateCurrentUserAccountSettings(payload) {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}/settings/account`, {
      method: "PATCH",
      auth: "required",
      body: payload || {}
    });

    const data = response.data || {};
    if (data.user) {
      data.user = normalizeUserMedia(data.user);
      updateSessionUser(data.user);
    }
    return data;
  }

  async function updateCurrentUserPrivacySettings(payload) {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}/settings/privacy`, {
      method: "PATCH",
      auth: "required",
      body: payload || {}
    });

    const data = response.data || {};
    if (data.user) {
      data.user = normalizeUserMedia(data.user);
      updateSessionUser(data.user);
    }
    return data;
  }

  async function updateCurrentUserNotificationSettings(payload) {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}/settings/notifications`, {
      method: "PATCH",
      auth: "required",
      body: payload || {}
    });

    const data = response.data || {};
    if (data.user) {
      data.user = normalizeUserMedia(data.user);
      updateSessionUser(data.user);
    }
    return data;
  }

  async function changePassword(payload) {
    const response = await request("/auth/change-password", {
      method: "POST",
      auth: "required",
      body: payload || {}
    });

    return setSession(response.data);
  }

  async function requestCurrentUserDeletion(payload) {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}/deletion-request`, {
      method: "POST",
      auth: "required",
      body: payload || {}
    });

    const data = response.data || {};
    if (data.settings && data.settings.user) {
      data.settings.user = normalizeUserMedia(data.settings.user);
      updateSessionUser(data.settings.user);
    }
    return data;
  }

  async function updateCurrentUser(payload) {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      auth: "required",
      body: payload
    });

    const user = normalizeUserMedia(response.data);
    updateSessionUser(user);
    return user;
  }

  async function updateUser(id, payload) {
    const userId = String(id || "").trim();
    if (!userId) {
      throw createError("User id is required.", 400, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      auth: "required",
      body: payload
    });

    const user = normalizeUserMedia(response.data);
    const session = getSession();
    if (session && session.user && session.user.id === userId) {
      updateSessionUser(user);
    } else {
      syncUserStore(user);
    }

    return user;
  }

  async function listUsers() {
    const response = await request("/users", {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data.map((user) => normalizeUserMedia(user)) : [];
  }

  async function listUserDeletionRequests() {
    const response = await request("/users/deletion-requests", {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async function sendUserDeletionWarning(id, payload) {
    const userId = String(id || "").trim();
    if (!userId) {
      throw createError("User id is required.", 400, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}/deletion-warning`, {
      method: "POST",
      auth: "required",
      body: payload || {}
    });

    return response.data;
  }

  async function reviewUserDeletionRequest(id, payload) {
    const requestId = String(id || "").trim();
    if (!requestId) {
      throw createError("Deletion request id is required.", 400, null);
    }

    const response = await request(`/users/deletion-requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      auth: "required",
      body: payload || {}
    });

    return response.data;
  }

  async function deleteUser(id) {
    const userId = String(id || "").trim();
    if (!userId) {
      throw createError("User id is required.", 400, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function ensureUserMode(mode) {
    const nextMode = normalizeMode(mode);
    let session = getSession();
    if (!session || !session.user) {
      throw createError("Please log in again.", 401, null);
    }

    session = await hydrateCurrentUser();
    if (!session || !session.user) {
      throw createError("Please log in again.", 401, null);
    }

    if (normalizeRole(session.user.role) !== "user") {
      return session;
    }

    if (normalizeMode(session.user.mode) === nextMode) {
      return session;
    }

    await updateCurrentUser({
      mode: nextMode
    });

    return getSession();
  }

  async function uploadCurrentUserMedia(kind, dataUrl) {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    const response = await request(`/users/${encodeURIComponent(userId)}/media`, {
      method: "POST",
      auth: "required",
      body: {
        kind,
        dataUrl
      }
    });

    const payload = response.data || {};
    const user = normalizeUserMedia(payload.user);
    if (user) {
      updateSessionUser(user);
    }

    return {
      ...payload,
      url: absolutizeUrl(payload.url),
      user
    };
  }

  async function listStories(params, config) {
    const response = await request("/stories", {
      method: "GET",
      auth: config && config.auth ? config.auth : "optional",
      query: params || {}
    });

    return Array.isArray(response.data) ? response.data.map((story) => normalizeStoryMedia(story)) : [];
  }

  async function listOwnStories(params) {
    const session = getSession();
    const userId = session && session.user && session.user.id;
    if (!userId) {
      throw createError("Please log in again.", 401, null);
    }

    return listStories(
      {
        ...(params || {}),
        authorId: userId
      },
      {
        auth: "required"
      }
    );
  }

  async function getStory(id, config) {
    const response = await request(`/stories/${encodeURIComponent(id)}`, {
      method: "GET",
      auth: config && config.auth ? config.auth : "optional"
    });

    return normalizeStoryMedia(response.data);
  }

  async function createStory(payload) {
    const response = await request("/stories", {
      method: "POST",
      auth: "required",
      body: payload
    });

    return response.data;
  }

  async function updateStory(id, payload) {
    const response = await request(`/stories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      auth: "required",
      body: payload
    });

    return response.data;
  }

  async function deleteStory(id) {
    const response = await request(`/stories/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function getReaderState() {
    const response = await request("/reader/state", {
      method: "GET",
      auth: "required"
    });

    return response.data || {
      likedChapterIds: [],
      likedStoryIds: [],
      savedStoryIds: [],
      currentReadStoryIds: [],
      completedStoryIds: [],
      collectionLists: [],
      followedAuthorIds: [],
      subscribedStoryIds: [],
      subscribedAuthorIds: [],
      progress: {}
    };
  }

  async function createCollection(name) {
    const response = await request("/reader/collections", {
      method: "POST",
      auth: "required",
      body: {
        name
      }
    });

    return response.data;
  }

  async function updateCollection(collectionId, payload) {
    const response = await request(`/reader/collections/${encodeURIComponent(collectionId)}`, {
      method: "PATCH",
      auth: "required",
      body: payload || {}
    });

    return response.data;
  }

  async function deleteCollection(collectionId) {
    const response = await request(`/reader/collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function addStoryToCollection(collectionId, storyId) {
    const response = await request(`/reader/collections/${encodeURIComponent(collectionId)}/stories/${encodeURIComponent(storyId)}`, {
      method: "POST",
      auth: "required"
    });

    return response.data;
  }

  async function removeStoryFromCollection(collectionId, storyId) {
    const response = await request(`/reader/collections/${encodeURIComponent(collectionId)}/stories/${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function listPublicCollectionsByUser(userId) {
    const response = await request(`/reader/collections/public/${encodeURIComponent(userId)}`, {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async function likeChapter(chapterId) {
    const response = await request(`/reader/chapters/${encodeURIComponent(chapterId)}/likes`, {
      method: "POST",
      auth: "required"
    });

    return response.data;
  }

  async function unlikeChapter(chapterId) {
    const response = await request(`/reader/chapters/${encodeURIComponent(chapterId)}/likes`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function likeStory(storyId) {
    const response = await request(`/reader/likes/${encodeURIComponent(storyId)}`, {
      method: "POST",
      auth: "required"
    });

    return response.data;
  }

  async function unlikeStory(storyId) {
    const response = await request(`/reader/likes/${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function saveStory(storyId) {
    const response = await request(`/reader/library/${encodeURIComponent(storyId)}`, {
      method: "POST",
      auth: "required"
    });

    return response.data;
  }

  async function unsaveStory(storyId) {
    const response = await request(`/reader/library/${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function subscribeStoryUpdates(storyId) {
    const response = await request(`/reader/subscriptions/${encodeURIComponent(storyId)}`, {
      method: "POST",
      auth: "required"
    });

    return response.data;
  }

  async function unsubscribeStoryUpdates(storyId) {
    const response = await request(`/reader/subscriptions/${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function subscribeAuthorUpdates(authorId) {
    const response = await request(`/reader/author-subscriptions/${encodeURIComponent(authorId)}`, {
      method: "POST",
      auth: "required"
    });

    return response.data;
  }

  async function unsubscribeAuthorUpdates(authorId) {
    const response = await request(`/reader/author-subscriptions/${encodeURIComponent(authorId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function listAuthorFollowers(authorId) {
    const response = await request(`/reader/authors/${encodeURIComponent(authorId)}/followers`, {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data.map((user) => normalizeFollowerUser(user)) : [];
  }

  async function updateReadingProgress(storyId, payload) {
    const response = await request(`/reader/progress/${encodeURIComponent(storyId)}`, {
      method: "PUT",
      auth: "required",
      body: payload || {}
    });

    return response.data;
  }

  async function followAuthor(authorId) {
    const response = await request(`/reader/follows/${encodeURIComponent(authorId)}`, {
      method: "POST",
      auth: "required"
    });

    return response.data;
  }

  async function unfollowAuthor(authorId) {
    const response = await request(`/reader/follows/${encodeURIComponent(authorId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function listChapterComments(chapterId) {
    const response = await request(`/reader/chapters/${encodeURIComponent(chapterId)}/comments`, {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async function createChapterComment(chapterId, payload) {
    const response = await request(`/reader/chapters/${encodeURIComponent(chapterId)}/comments`, {
      method: "POST",
      auth: "required",
      body: payload || {}
    });

    return response.data;
  }

  async function listStoryComments(storyId) {
    const response = await request(`/reader/comments/${encodeURIComponent(storyId)}`, {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async function createStoryComment(storyId, payload) {
    const response = await request(`/reader/comments/${encodeURIComponent(storyId)}`, {
      method: "POST",
      auth: "required",
      body: payload || {}
    });

    return response.data;
  }

  async function listAuthorProfileComments(authorId) {
    const response = await request(`/reader/authors/${encodeURIComponent(authorId)}/questions`, {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data.map((comment) => normalizeAuthorProfileComment(comment)) : [];
  }

  async function createAuthorProfileComment(authorId, payload) {
    const response = await request(`/reader/authors/${encodeURIComponent(authorId)}/questions`, {
      method: "POST",
      auth: "required",
      body: payload || {}
    });

    return response.data ? {
      ...response.data,
      comment: normalizeAuthorProfileComment(response.data.comment)
    } : response.data;
  }

  async function replyAuthorProfileComment(commentId, payload) {
    const response = await request(`/reader/author-questions/${encodeURIComponent(commentId)}/reply`, {
      method: "PATCH",
      auth: "required",
      body: payload || {}
    });

    return response.data ? {
      ...response.data,
      comment: normalizeAuthorProfileComment(response.data.comment)
    } : response.data;
  }

  async function deleteAuthorProfileComment(commentId) {
    const response = await request(`/reader/author-questions/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  async function listNotifications() {
    const response = await request("/notifications", {
      method: "GET",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async function markAllNotificationsRead() {
    const response = await request("/notifications/read-all", {
      method: "POST",
      auth: "required"
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async function listReports(query) {
    const response = await request("/reports", {
      method: "GET",
      auth: "required",
      query: query || {}
    });

    return Array.isArray(response.data) ? response.data : [];
  }

  async function createReport(payload) {
    const response = await request("/reports", {
      method: "POST",
      auth: "required",
      body: payload
    });

    return response.data;
  }

  async function updateReport(id, payload) {
    const response = await request(`/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      auth: "required",
      body: payload
    });

    return response.data;
  }

  async function deleteReport(id) {
    const response = await request(`/reports/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: "required"
    });

    return response.data;
  }

  function getErrorMessage(error, fallback) {
    return (error && error.message) || fallback || "Something went wrong.";
  }

  const midnightApi = {
    API_BASE,
    API_BASE_STORAGE_KEY,
    SESSION_KEY,
    USERS_KEY,
    getApiBase,
    setApiBaseOverride,
    clearApiBaseOverride,
    getSession,
    setSession,
    updateSessionUser,
    clearSession,
    request,
    refreshSession,
    login,
    signup,
    logout,
    hydrateCurrentUser,
    getUserById,
    getCurrentUserSettings,
    updateCurrentUserAccountSettings,
    updateCurrentUserPrivacySettings,
    updateCurrentUserNotificationSettings,
    changePassword,
    requestCurrentUserDeletion,
    updateCurrentUser,
    updateUser,
    uploadCurrentUserMedia,
    listUsers,
    listUserDeletionRequests,
    sendUserDeletionWarning,
    reviewUserDeletionRequest,
    deleteUser,
    ensureUserMode,
    listStories,
    listOwnStories,
    getStory,
    createStory,
    updateStory,
    deleteStory,
    getReaderState,
    createCollection,
    updateCollection,
    deleteCollection,
    addStoryToCollection,
    removeStoryFromCollection,
    listPublicCollectionsByUser,
    likeChapter,
    unlikeChapter,
    likeStory,
    unlikeStory,
    saveStory,
    unsaveStory,
    subscribeStoryUpdates,
    unsubscribeStoryUpdates,
    subscribeAuthorUpdates,
    unsubscribeAuthorUpdates,
    listAuthorFollowers,
    updateReadingProgress,
    followAuthor,
    unfollowAuthor,
    listChapterComments,
    createChapterComment,
    listStoryComments,
    createStoryComment,
    listAuthorProfileComments,
    createAuthorProfileComment,
    replyAuthorProfileComment,
    deleteAuthorProfileComment,
    listNotifications,
    markAllNotificationsRead,
    listReports,
    createReport,
    updateReport,
    deleteReport,
    getErrorMessage
  };

  window.MidnightAPI = midnightApi;
  window.AudioHubAPI = midnightApi;
})();
