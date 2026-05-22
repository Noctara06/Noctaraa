const assert = require("node:assert/strict");

const BASE_URL = String(process.env.SMOKE_BASE_URL || "http://localhost:5000/api/v1").replace(/\/+$/, "");
const DEFAULT_PASSWORD = String(process.env.SMOKE_PASSWORD || "SmokePass123!");
const ADMIN_EMAIL = String(process.env.SMOKE_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.SMOKE_ADMIN_PASSWORD || "").trim();

if (typeof fetch !== "function") {
  throw new Error("Global fetch is not available. Use Node.js 18+.");
}

function logStep(prefix, label, detail = "") {
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${prefix} ${label}${suffix}`);
}

function uniqueEmail(label) {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  return `smoke_${label}_${stamp}@example.com`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  const token = String(options.token || "").trim();
  let body = options.body;

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body
  });

  const raw = await response.text();
  let payload = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (error) {
    payload = raw;
  }

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : `Request failed with status ${response.status}`;
    throw new Error(`${method} ${path} -> ${response.status}: ${message}`);
  }

  return payload;
}

async function signupUser({ email, password, displayName, mode }) {
  const payload = await request("/auth/signup", {
    method: "POST",
    body: {
      email,
      password,
      displayName,
      mode
    }
  });

  assert.equal(payload.success, true, "Signup should return success=true");
  return payload.data;
}

async function loginUser(email, password) {
  const payload = await request("/auth/login", {
    method: "POST",
    body: {
      email,
      password
    }
  });

  assert.equal(payload.success, true, "Login should return success=true");
  return payload.data;
}

async function main() {
  logStep("[info]", "Smoke test started", BASE_URL);

  const health = await request("/health");
  assert.equal(health.success, true, "Health route must be healthy");
  logStep("[ok]", "Health check");

  const writerEmail = uniqueEmail("writer");
  const readerEmail = uniqueEmail("reader");

  const writerSession = await signupUser({
    email: writerEmail,
    password: DEFAULT_PASSWORD,
    displayName: "Smoke Writer",
    mode: "writer"
  });
  logStep("[ok]", "Writer signup", writerEmail);

  const createStory = await request("/stories", {
    method: "POST",
    token: writerSession.accessToken,
    body: {
      title: "Smoke Story",
      genre: "fantasy",
      status: "published",
      visibility: "public",
      summary: "Smoke story summary for automated verification.",
      tags: ["smoke", "phase4"],
      chapters: [
        {
          title: "Chapter 1",
          content: "This chapter is created by the automated smoke test."
        }
      ]
    }
  });
  assert.equal(createStory.success, true, "Story create should return success=true");
  const story = createStory.data;
  assert.ok(story && story.id, "Created story must have an id");
  logStep("[ok]", "Writer story created", story.id);

  const readerSession = await signupUser({
    email: readerEmail,
    password: DEFAULT_PASSWORD,
    displayName: "Smoke Reader",
    mode: "reader"
  });
  logStep("[ok]", "Reader signup", readerEmail);

  const likeResult = await request(`/reader/likes/${encodeURIComponent(story.id)}`, {
    method: "POST",
    token: readerSession.accessToken
  });
  assert.equal(likeResult.data.liked, true, "Reader should like story");

  const libraryResult = await request(`/reader/library/${encodeURIComponent(story.id)}`, {
    method: "POST",
    token: readerSession.accessToken
  });
  assert.equal(libraryResult.data.saved, true, "Reader should save story");

  const followResult = await request(`/reader/follows/${encodeURIComponent(writerSession.user.id)}`, {
    method: "POST",
    token: readerSession.accessToken
  });
  assert.equal(followResult.data.following, true, "Reader should follow writer");

  const subscribeResult = await request(`/reader/subscriptions/${encodeURIComponent(story.id)}`, {
    method: "POST",
    token: readerSession.accessToken
  });
  assert.equal(subscribeResult.data.subscribed, true, "Reader should subscribe to story updates");

  const commentResult = await request(`/reader/comments/${encodeURIComponent(story.id)}`, {
    method: "POST",
    token: readerSession.accessToken,
    body: {
      text: "Smoke comment from automated test."
    }
  });
  assert.ok(commentResult.data.comment && commentResult.data.comment.id, "Comment should be created");
  logStep("[ok]", "Reader story interactions", "like + save + follow + subscribe + comment");

  const readerState = await request("/reader/state", {
    token: readerSession.accessToken
  });
  assert.ok(readerState.data.likedStoryIds.includes(story.id), "Reader state should include liked story");
  assert.ok(readerState.data.savedStoryIds.includes(story.id), "Reader state should include saved story");
  assert.ok(readerState.data.followedAuthorIds.includes(writerSession.user.id), "Reader state should include followed author");
  assert.ok(readerState.data.subscribedStoryIds.includes(story.id), "Reader state should include subscribed story");
  logStep("[ok]", "Reader state verified");

  await sleep(150);
  const writerNotifications = await request("/notifications", {
    token: writerSession.accessToken
  });
  const writerNotificationList = Array.isArray(writerNotifications.data) ? writerNotifications.data : [];
  assert.ok(
    writerNotificationList.some((item) => item.type === "follow" && item.actor && item.actor.email === readerEmail),
    "Writer should receive follow notification from reader"
  );
  assert.ok(
    writerNotificationList.some((item) => item.type === "comment" && item.actor && item.actor.email === readerEmail && item.story && item.story.id === story.id),
    "Writer should receive comment notification for story"
  );
  logStep("[ok]", "Writer notifications verified", "follow + comment");

  const updateStory = await request(`/stories/${encodeURIComponent(story.id)}`, {
    method: "PATCH",
    token: writerSession.accessToken,
    body: {
      summary: `${story.summary} Updated by smoke test.`,
      notifySubscribers: true
    }
  });
  assert.equal(updateStory.success, true, "Story update should return success=true");

  await sleep(150);
  const readerNotifications = await request("/notifications", {
    token: readerSession.accessToken
  });
  const readerNotificationList = Array.isArray(readerNotifications.data) ? readerNotifications.data : [];
  assert.ok(
    readerNotificationList.some((item) => item.type === "story_update" && item.story && item.story.id === story.id),
    "Reader should receive story update notification"
  );
  logStep("[ok]", "Reader notifications verified", "story_update");

  const markRead = await request("/notifications/read-all", {
    method: "POST",
    token: readerSession.accessToken
  });
  const markedNotifications = Array.isArray(markRead.data) ? markRead.data : [];
  assert.ok(markedNotifications.every((item) => item.unread === false), "Mark all read should clear unread state");
  logStep("[ok]", "Reader mark all read");

  const reportResult = await request("/reports", {
    method: "POST",
    token: readerSession.accessToken,
    body: {
      storyId: story.id,
      reason: "Smoke test report",
      details: "Created during automated smoke test."
    }
  });
  assert.ok(reportResult.data && reportResult.data.id, "Report should be created");
  logStep("[ok]", "Report created", reportResult.data.id);

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adminSession = await loginUser(ADMIN_EMAIL, ADMIN_PASSWORD);
    const reportsList = await request("/reports", {
      token: adminSession.accessToken
    });
    const allReports = Array.isArray(reportsList.data) ? reportsList.data : [];
    assert.ok(allReports.some((item) => item.id === reportResult.data.id), "Admin should see smoke report");

    const resolveReport = await request(`/reports/${encodeURIComponent(reportResult.data.id)}`, {
      method: "PATCH",
      token: adminSession.accessToken,
      body: {
        status: "resolved"
      }
    });
    assert.equal(resolveReport.data.status, "resolved", "Admin should resolve report");

    const usersList = await request("/users", {
      token: adminSession.accessToken
    });
    const allUsers = Array.isArray(usersList.data) ? usersList.data : [];
    assert.ok(allUsers.some((item) => item.email === writerEmail), "Admin should list smoke writer");
    assert.ok(allUsers.some((item) => item.email === readerEmail), "Admin should list smoke reader");
    logStep("[ok]", "Admin verification", "reports + users");
  } else {
    logStep("[skip]", "Admin verification", "Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD to include admin checks");
  }

  logStep("[done]", "Smoke test passed", "auth + writer + reader + notifications + reports");
}

main().catch((error) => {
  logStep("[fail]", "Smoke test failed", error.message || String(error));
  process.exitCode = 1;
});
