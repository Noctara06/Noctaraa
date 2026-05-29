(() => {
  const api = window.MidnightAPI;
  if (!api) {
    return;
  }

  const LEGACY_STORIES_KEY = "writer_stories_v1";
  const LEGACY_PROFILE_KEY_BASE = "writer_profile_v1";
  const NOTIFICATIONS_KEY_BASE = "writer_notifications_api_v1_";
  const DEFAULT_COVER = "linear-gradient(140deg,#7C7CFF,#0F172A)";
  const PROFILE_MEDIA_MAX_BYTES = 4 * 1024 * 1024;

  const page = document.body.dataset.writerPage;
  if (!page) {
    return;
  }

  let session = null;
  let currentUser = null;
  let statusTimer = null;

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function fmt(value) {
    return Number(value || 0).toLocaleString();
  }

  function dateLabel(value) {
    const date = new Date(value);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function dateTimeLabel(value) {
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function safe(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function mediaBackgroundStyle(value, fallback) {
    const source = String(value || "").trim();
    if (/^url\(/i.test(source)) {
      return source;
    }
    if (/^(https?:|data:|\/)/i.test(source)) {
      return `url("${source.replace(/"/g, "%22")}") center/cover no-repeat`;
    }
    return fallback || "none";
  }

  function applyMediaBackground(element, value, fallback) {
    if (!element) {
      return;
    }

    const source = String(value || "").trim();
    element.style.background = "";
    element.style.backgroundImage = "";
    element.style.backgroundColor = "";
    element.style.backgroundPosition = "";
    element.style.backgroundSize = "";
    element.style.backgroundRepeat = "";

    if (/^url\(/i.test(source)) {
      element.style.background = source;
      return;
    }

    if (/^(https?:|data:|\/)/i.test(source)) {
      if (fallback && !String(fallback).includes("gradient(") && !String(fallback).startsWith("url(")) {
        element.style.backgroundColor = fallback;
      }
      element.style.backgroundImage = `url("${source.replace(/"/g, "%22")}")`;
      element.style.backgroundPosition = "center";
      element.style.backgroundSize = "cover";
      element.style.backgroundRepeat = "no-repeat";
      return;
    }

    element.style.background = fallback || "none";
  }

  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve("");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Image could not be read."));
      reader.readAsDataURL(file);
    });
  }

  function bellIconMarkup() {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"></path>
        <path d="M9.5 17a2.5 2.5 0 0 0 5 0"></path>
      </svg>
    `;
  }

  function instagramIconMarkup() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
        <circle cx="12" cy="12" r="4"></circle>
        <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none"></circle>
      </svg>
    `;
  }

  function youtubeIconMarkup() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.2c0 2.5-.3 4.2-.7 5.1-.3.7-.9 1.3-1.6 1.6-.9.4-4 .7-6.7.7s-5.8-.3-6.7-.7c-.7-.3-1.3-.9-1.6-1.6-.4-.9-.7-2.6-.7-5.1s.3-4.2.7-5.1c.3-.7.9-1.3 1.6-1.6.9-.4 4-.7 6.7-.7s5.8.3 6.7.7c.7.3 1.3.9 1.6 1.6.4.9.7 2.6.7 5.1Z"></path>
        <path d="m10 15.5 5-3.3-5-3.2z" fill="currentColor" stroke="none"></path>
      </svg>
    `;
  }

  function normalizeExternalUrl(value, provider = "") {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    if (/^\/\//.test(raw)) {
      return `https:${raw}`;
    }

    if (provider === "instagram" && /^@?[a-z0-9._]+$/i.test(raw)) {
      return `https://www.instagram.com/${raw.replace(/^@/, "")}/`;
    }

    if (provider === "youtube") {
      if (/^@[\w.-]+$/i.test(raw)) {
        return `https://www.youtube.com/${raw}`;
      }

      if (/^(channel|c|user)\/[\w.-]+$/i.test(raw)) {
        return `https://www.youtube.com/${raw}`;
      }
    }

    return `https://${raw.replace(/^\/+/, "")}`;
  }

  function renderSocialLinks(node, socialLinks, linkClassName) {
    if (!node) {
      return;
    }

    const instagram = normalizeExternalUrl(socialLinks && socialLinks.instagram, "instagram");
    const youtube = normalizeExternalUrl(socialLinks && socialLinks.youtube, "youtube");
    const items = [];

    if (instagram) {
      items.push(`<a class="${safe(linkClassName)}" href="${safe(instagram)}" target="_blank" rel="noreferrer noopener" aria-label="Instagram">${instagramIconMarkup()}</a>`);
    }

    if (youtube) {
      items.push(`<a class="${safe(linkClassName)}" href="${safe(youtube)}" target="_blank" rel="noreferrer noopener" aria-label="YouTube">${youtubeIconMarkup()}</a>`);
    }

    node.innerHTML = items.join("");
    node.classList.toggle("hidden", !items.length);
  }

  function setNotificationBadge(badge, count) {
    if (!badge) {
      return;
    }

    const unread = Math.max(0, Number(count || 0));
    badge.classList.toggle("hidden", unread <= 0);
    badge.textContent = unread > 9 ? "9+" : String(unread);
  }

  function ensurePageStatus() {
    const main = document.querySelector(".writer-main");
    if (!main) {
      return null;
    }

    let node = document.getElementById("writerPageStatus");
    if (!node) {
      node = document.createElement("section");
      node.id = "writerPageStatus";
      node.className = "page-status hidden";
      main.prepend(node);
    }

    return node;
  }

  function clearPageStatus() {
    const node = document.getElementById("writerPageStatus");
    if (!node) {
      return;
    }

    node.textContent = "";
    node.className = "page-status hidden";
  }

  function showPageStatus(message, type = "info", persist = false) {
    const node = ensurePageStatus();
    if (!node) {
      return;
    }

    if (statusTimer) {
      window.clearTimeout(statusTimer);
      statusTimer = null;
    }

    node.textContent = String(message || "").trim();
    node.className = `page-status ${type || "info"}`.trim();

    if (!persist) {
      statusTimer = window.setTimeout(() => {
        clearPageStatus();
      }, 3200);
    }
  }

  function showMainLoading(title, detail) {
    const main = document.querySelector(".writer-main");
    if (!main) {
      return;
    }

    let card = document.getElementById("writerLoadingCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "writerLoadingCard";
      card.className = "section";
      card.innerHTML = '<article class="card loading-card"></article>';
      main.prepend(card);
    }

    const content = card.querySelector(".loading-card") || card;
    content.innerHTML = `
      <h1 class="section-title">${safe(title || "Loading writer workspace...")}</h1>
      <p class="loading-copy">${safe(detail || "Syncing profile, stories, analytics, and notifications.")}</p>
    `;
  }

  function clearMainLoading() {
    const card = document.getElementById("writerLoadingCard");
    if (card) {
      card.remove();
    }
  }

  function stripHtml(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function deriveDisplayName(email) {
    const prefix = String(email || "").split("@")[0] || "Writer";
    const normalized = prefix.replace(/[._-]+/g, " ").trim();
    return normalized || "Writer";
  }

  function deriveUsername(email) {
    return String(email || "").split("@")[0].toLowerCase().replace(/\s+/g, "_") || "writer";
  }

  function defaultChapter(index) {
    return {
      title: `Chapter ${index + 1}`,
      content: "<p></p>"
    };
  }

  function chapterDisplayTitle(chapter, index) {
    const chapterNumber = index + 1;
    const baseTitle = `Chapter ${chapterNumber}`;
    const title = String(chapter && chapter.title ? chapter.title : "").trim();

    if (!title || title === baseTitle) {
      return baseTitle;
    }

    if (/^Chapter\s+\d+\s*[-:]/i.test(title)) {
      return title;
    }

    return `${baseTitle} - ${title}`;
  }

  function normalizeStoryChapters(story) {
    if (story && Array.isArray(story.chapters) && story.chapters.length > 0) {
      return story.chapters.map((chapter, index) => ({
        title: String(chapter && chapter.title ? chapter.title : `Chapter ${index + 1}`),
        content: String(chapter && chapter.content ? chapter.content : "<p></p>")
      }));
    }

    const fallbackContent = story && typeof story.content === "string" && story.content.trim()
      ? story.content
      : "<p></p>";

    if (story && typeof story.content === "string" && story.content.trim()) {
      return [{ title: "Chapter 1", content: fallbackContent }];
    }

    return [];
  }

  function chapterStats(chapters) {
    let words = 0;

    (chapters || []).forEach((chapter) => {
      const text = stripHtml(chapter && chapter.content);
      if (text) {
        words += text.split(/\s+/).filter(Boolean).length;
      }
    });

    return {
      words,
      readingTime: Math.max(1, Math.ceil(words / 220))
    };
  }

  function mergeChapterHTML(chapters) {
    return (chapters || [])
      .map((chapter, index) => `<h2>${safe(chapterDisplayTitle(chapter, index))}</h2>${chapter.content || "<p></p>"}`)
      .join("");
  }

  function deriveSummary(chapters) {
    const content = (chapters || [])
      .map((chapter) => stripHtml(chapter && chapter.content))
      .join(" ")
      .trim();

    return content ? content.slice(0, 180) : "";
  }

  function statusClass(status) {
    if (status === "published") return "status-published";
    if (status === "scheduled") return "status-scheduled";
    return "status-draft";
  }

  function statusText(status) {
    if (status === "published") return "Published";
    if (status === "scheduled") return "Scheduled";
    return "Draft";
  }

  function readLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function profileKey() {
    return `${LEGACY_PROFILE_KEY_BASE}_${normalizeEmail(currentUser && currentUser.email)}`;
  }

  function notificationsKey() {
    return `${NOTIFICATIONS_KEY_BASE}${currentUser && currentUser.id ? currentUser.id : "writer"}`;
  }

  function toLegacyProfile(user) {
    return {
      displayName: user && user.displayName ? user.displayName : deriveDisplayName(user && user.email),
      username: user && user.username ? user.username : deriveUsername(user && user.email),
      bio: user && user.bio ? user.bio : "",
      avatarColor: user && user.avatarColor ? user.avatarColor : "#7C7CFF",
      avatarUrl: user && user.avatarUrl ? user.avatarUrl : "",
      coverPhotoUrl: user && user.coverPhotoUrl ? user.coverPhotoUrl : "",
      followers: Number(user && user.followersCount || 0),
      socials: {
        instagram: user && user.socials && user.socials.instagram ? user.socials.instagram : "",
        youtube: user && user.socials && user.socials.youtube ? user.socials.youtube : (user && user.website ? user.website : "")
      }
    };
  }

  function syncLegacyProfile(user) {
    if (!user || !user.email) {
      return;
    }

    writeLocal(profileKey(), toLegacyProfile(user));
  }

  function toLegacyStory(story) {
    const chapters = normalizeStoryChapters(story);
    const stats = chapterStats(chapters);

    return {
      id: story.id,
      title: story.title || "Untitled Story",
      genre: story.genre || "romance",
      tags: Array.isArray(story.tags) ? story.tags : [],
      cover: story.cover || story.coverUrl || DEFAULT_COVER,
      status: story.status || "draft",
      visibility: story.visibility || "public",
      warning: !!(story.warning || story.contentWarning),
      scheduledAt: story.scheduledAt || "",
      wordCount: Number(story.wordCount || stats.words),
      readingTime: Number(story.readingMinutes || stats.readingTime),
      reads: Number(story.reads || 0),
      likes: Number(story.likes || 0),
      comments: Number(story.comments || 0),
      createdAt: story.createdAt || new Date().toISOString(),
      updatedAt: story.updatedAt || new Date().toISOString(),
      content: mergeChapterHTML(chapters),
      chapters,
      ownerEmail: currentUser ? currentUser.email : ""
    };
  }

  function syncLegacyStories(stories) {
    const ownerEmail = normalizeEmail(currentUser && currentUser.email);
    const existing = readLocal(LEGACY_STORIES_KEY, []);
    const currentList = Array.isArray(existing) ? existing : [];
    const others = currentList.filter((story) => normalizeEmail(story && story.ownerEmail) !== ownerEmail);
    const ownStories = (Array.isArray(stories) ? stories : []).map(toLegacyStory);
    writeLocal(LEGACY_STORIES_KEY, [...others, ...ownStories]);
  }

  function upsertLegacyStory(story) {
    const ownerEmail = normalizeEmail(currentUser && currentUser.email);
    const existing = readLocal(LEGACY_STORIES_KEY, []);
    const currentList = Array.isArray(existing) ? existing : [];
    const filtered = currentList.filter((entry) => {
      return !(normalizeEmail(entry && entry.ownerEmail) === ownerEmail && String(entry && entry.id) === String(story && story.id));
    });
    filtered.push(toLegacyStory(story));
    writeLocal(LEGACY_STORIES_KEY, filtered);
  }

  function removeLegacyStory(storyId) {
    const ownerEmail = normalizeEmail(currentUser && currentUser.email);
    const existing = readLocal(LEGACY_STORIES_KEY, []);
    const currentList = Array.isArray(existing) ? existing : [];
    const filtered = currentList.filter((entry) => {
      return !(normalizeEmail(entry && entry.ownerEmail) === ownerEmail && String(entry && entry.id) === String(storyId));
    });
    writeLocal(LEGACY_STORIES_KEY, filtered);
  }

  function getNotifications() {
    const notifications = readLocal(notificationsKey(), []);
    return Array.isArray(notifications) ? notifications : [];
  }

  function saveNotifications(list) {
    writeLocal(notificationsKey(), Array.isArray(list) ? list : []);
  }

  function pushNotification(text) {
    const list = getNotifications();
    list.unshift({
      id: `writer-notif-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      text,
      unread: true,
      time: new Date().toISOString()
    });
    saveNotifications(list.slice(0, 50));
    syncWriterNotificationBadge();
  }

  async function syncWriterNotificationBadge() {
    const bellBadge = document.getElementById("writerNotificationBellCount");
    if (!bellBadge) {
      return;
    }

    const localUnread = getNotifications().filter((item) => item && item.unread).length;
    try {
      const notifications = await api.listNotifications();
      const remoteUnread = (Array.isArray(notifications) ? notifications : []).filter((item) => item && item.unread).length;
      setNotificationBadge(bellBadge, remoteUnread + localUnread);
    } catch (error) {
      setNotificationBadge(bellBadge, localUnread);
    }
  }

  function renderFatal(message) {
    const main = document.querySelector(".writer-main");
    if (!main) {
      return;
    }

    main.innerHTML = `
      <section class="section">
        <article class="card">
          <h1 class="section-title">Writer mode unavailable</h1>
          <p class="section-sub">${safe(message)}</p>
          <a class="btn" href="home.html">Back to Home</a>
        </article>
      </section>
    `;
  }

  function setStatus(element, message, isError) {
    if (!element) {
      return;
    }

    element.textContent = `Status: ${message}`;
    element.className = isError ? "status-text error" : "status-text";
  }

  async function loadStories() {
    const stories = await api.listOwnStories();
    const sorted = stories.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    syncLegacyStories(sorted);
    return sorted;
  }

  async function loadStoryById(id) {
    const story = await api.getStory(id, {
      auth: "required"
    });
    upsertLegacyStory(story);
    return story;
  }

  function initHeader(currentPage, user) {
    document.querySelectorAll("[data-writer-nav]").forEach((link) => {
      link.classList.toggle("active", link.dataset.writerNav === currentPage);
    });

    const navNotificationLink = document.querySelector('[data-writer-nav="notifications"]');
    if (navNotificationLink) {
      navNotificationLink.remove();
    }

    const line = document.getElementById("writerUserLine");
    if (line) {
      const menuUsername = user && user.username ? String(user.username).trim() : deriveUsername(user && user.email);
      line.textContent = menuUsername ? `@${menuUsername}` : "Writer";
    }

    const actions = document.querySelector(".writer-actions");
    const readerLink = document.querySelector(".reader-link");
    const menuWrap = document.querySelector(".menu-wrap");
    let bell = document.getElementById("writerNotificationBell");
    let bellBadge = document.getElementById("writerNotificationBellCount");
    let bellWrap = document.getElementById("writerNotificationWrap");
    let bellPanel = document.getElementById("writerNotificationPanel");
    let bellList = document.getElementById("writerNotificationPanelList");
    let bellMarkAll = document.getElementById("writerNotificationPanelMarkAll");
    let remoteNotifications = [];
    let localNotifications = getNotifications();

    if (actions && !bell) {
      bellWrap = document.createElement("div");
      bellWrap.id = "writerNotificationWrap";
      bellWrap.className = "notification-wrap";

      bell = document.createElement("button");
      bell.id = "writerNotificationBell";
      bell.className = "notification-link";
      bell.type = "button";
      bell.setAttribute("aria-label", "Notifications");
      bell.setAttribute("aria-expanded", "false");
      bell.setAttribute("aria-controls", "writerNotificationPanel");
      bell.innerHTML = `${bellIconMarkup()}<span id="writerNotificationBellCount" class="notification-badge hidden"></span>`;

      bellPanel = document.createElement("div");
      bellPanel.id = "writerNotificationPanel";
      bellPanel.className = "notification-panel";
      bellPanel.innerHTML = `
        <div class="notification-panel-head">
          <div>
            <h3 class="notification-panel-title">Notifications</h3>
            <p class="notification-panel-copy">Comments, follows, and story activity.</p>
          </div>
          <button id="writerNotificationPanelMarkAll" class="notification-panel-action" type="button">Mark all read</button>
        </div>
        <div id="writerNotificationPanelList" class="notification-panel-list"></div>
      `;

      bellWrap.append(bell, bellPanel);
      if (menuWrap) {
        actions.insertBefore(bellWrap, menuWrap);
      } else if (readerLink && readerLink.nextSibling) {
        actions.insertBefore(bellWrap, readerLink.nextSibling);
      } else {
        actions.appendChild(bellWrap);
      }
      bellBadge = bell.querySelector(".notification-badge");
      bellList = bellPanel.querySelector("#writerNotificationPanelList");
      bellMarkAll = bellPanel.querySelector("#writerNotificationPanelMarkAll");
    }

    const combinedNotifications = () => {
      return [
        ...remoteNotifications.map((item) => ({
          id: item.id,
          text: item.text,
          unread: !!item.unread,
          time: item.createdAt,
          story: item.story || null,
          actor: item.actor || null
        })),
        ...localNotifications
      ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    };

    const btn = document.getElementById("writerMenuBtn");
    const menu = document.getElementById("writerMenu");
    const logoutBtn = document.getElementById("writerLogoutBtn");
    const menuNotificationLink = menu ? menu.querySelector('a[href="notifications.html"]') : null;
    let settingsLink = document.getElementById("writerSettingsLink");

    if (menuNotificationLink) {
      menuNotificationLink.remove();
    }

    if (menu) {
      if (!settingsLink) {
        settingsLink = document.createElement("a");
        settingsLink.id = "writerSettingsLink";
        settingsLink.href = "settings.html";
        settingsLink.textContent = "Settings";
      }
      settingsLink.className = "menu-item";
      if (!menu.contains(settingsLink)) {
        menu.insertBefore(settingsLink, logoutBtn || null);
      }
    }

    const renderBellNotifications = () => {
      if (!bellList) {
        return;
      }

      const list = combinedNotifications();
      bellList.innerHTML = "";
      if (!list.length) {
        bellList.innerHTML = '<div class="notification-panel-empty">No notifications.</div>';
      } else {
        list.forEach((item) => {
          const article = document.createElement("article");
          article.className = `notify-item notification-panel-item ${item && item.unread ? "unread" : ""}`.trim();
          const actor = item && item.actor ? (item.actor.displayName || item.actor.username || item.actor.email) : "";
          const detail = actor && item.story
            ? `${actor} | ${item.story.title}`
            : actor || (item.story && item.story.title) || dateTimeLabel(item.time);
          article.innerHTML = `
            <div>${safe(item && item.text || "New notification")}</div>
            <div class="notify-time">${safe(detail)} | ${safe(dateTimeLabel(item.time))}</div>
          `;

          if (item && item.story && item.story.id) {
            article.classList.add("is-clickable");
            article.addEventListener("click", () => {
              closeNotifications();
              window.location.href = `analytics.html?story=${encodeURIComponent(item.story.id)}`;
            });
          }

          bellList.appendChild(article);
        });
      }

      if (bellMarkAll) {
        bellMarkAll.disabled = !list.some((item) => item && item.unread);
      }

      setNotificationBadge(bellBadge, list.filter((item) => item && item.unread).length);
    };

    const closeNotifications = () => {
      if (bellPanel) {
        bellPanel.classList.remove("open");
      }
      if (bell) {
        bell.classList.remove("active");
        bell.setAttribute("aria-expanded", "false");
      }
    };

    const closeMenu = () => {
      if (!menu || !btn) {
        return;
      }
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    };

    const loadBellNotifications = async () => {
      localNotifications = getNotifications();
      if (!bellList) {
        return;
      }

      bellList.innerHTML = '<div class="notification-panel-empty">Loading notifications...</div>';
      try {
        remoteNotifications = await api.listNotifications();
      } catch (error) {
        remoteNotifications = [];
      }
      renderBellNotifications();
    };

    if (btn && menu) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeNotifications();
        const open = menu.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(open));
      });

      document.addEventListener("click", (event) => {
        if (!menu.contains(event.target) && !btn.contains(event.target)) {
          closeMenu();
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await api.logout();
        window.location.href = "index.html";
      });
    }

    if (bell && bellPanel && !bell.dataset.bound) {
      bell.dataset.bound = "true";
      bell.addEventListener("click", async (event) => {
        event.stopPropagation();
        const opening = !bellPanel.classList.contains("open");
        closeMenu();
        if (opening) {
          bellPanel.classList.add("open");
          bell.classList.add("active");
          bell.setAttribute("aria-expanded", "true");
          await loadBellNotifications();
        } else {
          closeNotifications();
        }
      });
    }

    if (bellMarkAll && !bellMarkAll.dataset.bound) {
      bellMarkAll.dataset.bound = "true";
      bellMarkAll.addEventListener("click", async (event) => {
        event.stopPropagation();
        bellMarkAll.disabled = true;
        localNotifications = localNotifications.map((item) => ({
          ...item,
          unread: false
        }));
        remoteNotifications = remoteNotifications.map((item) => ({
          ...item,
          unread: false
        }));
        saveNotifications(localNotifications);
        try {
          await api.markAllNotificationsRead();
        } catch (error) {
          // Keep local UI usable even if backend mark-read fails.
        }
        renderBellNotifications();
        showPageStatus("Notifications marked as read.", "success");
      });
    }

    if (bellWrap) {
      document.addEventListener("click", (event) => {
        if (!bellWrap.contains(event.target)) {
          closeNotifications();
        }
      });
    }

    if (bellBadge) {
      syncWriterNotificationBadge();
    }
  }

  async function initDashboard() {
    const list = await loadStories();
    const totals = list.reduce((acc, story) => ({
      stories: acc.stories + 1,
      reads: acc.reads + Number(story.reads || 0),
      likes: acc.likes + Number(story.likes || 0)
    }), {
      stories: 0,
      reads: 0,
      likes: 0
    });

    const totalStories = document.getElementById("dashTotalStories");
    const totalReads = document.getElementById("dashTotalReads");
    const totalLikes = document.getElementById("dashTotalLikes");
    const followers = document.getElementById("dashFollowers");
    const writeBtn = document.getElementById("writeNewStoryBtn");
    const continueBtn = document.getElementById("continueDraftBtn");
    const box = document.getElementById("dashboardStories");

    if (totalStories) totalStories.textContent = fmt(totals.stories);
    if (totalReads) totalReads.textContent = fmt(totals.reads);
    if (totalLikes) totalLikes.textContent = fmt(totals.likes);
    if (followers) followers.textContent = fmt(currentUser && currentUser.followersCount || 0);

    if (writeBtn) {
      writeBtn.addEventListener("click", () => {
        window.location.href = "write.html?new=1";
      });
    }

    if (continueBtn) {
      const draft = list.find((story) => story.status === "draft");
      if (draft) {
        continueBtn.addEventListener("click", () => {
          window.location.href = `write.html?id=${encodeURIComponent(draft.id)}`;
        });
      } else {
        continueBtn.disabled = true;
        continueBtn.textContent = "No Draft Available";
      }
    }

    if (!box) {
      return;
    }

    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = '<div class="card">No stories yet. Click "Write New Story" to create your first story.</div>';
      return;
    }

    list.forEach((story) => {
      const row = document.createElement("article");
      row.className = "story-row";
      row.innerHTML = `
        <div class="story-row-main">
          <h3>${safe(story.title)}</h3>
          <div class="story-meta">
            <span class="status-badge ${statusClass(story.status)}">${statusText(story.status)}</span>
            <span>${fmt(story.reads)} reads</span>
            <span>${fmt(story.likes)} votes</span>
            <span>Updated ${dateLabel(story.updatedAt)}</span>
          </div>
        </div>
        <div class="story-actions">
          <button class="btn small" data-action="edit">Edit</button>
          <button class="btn small" data-action="analytics">Analytics</button>
        </div>
      `;

      row.querySelector('[data-action="edit"]').addEventListener("click", () => {
        window.location.href = `write.html?id=${encodeURIComponent(story.id)}`;
      });

      row.querySelector('[data-action="analytics"]').addEventListener("click", () => {
        window.location.href = `analytics.html?story=${encodeURIComponent(story.id)}`;
      });

      box.appendChild(row);
    });
  }

  async function initStories() {
    const container = document.getElementById("storyManagementRows");
    if (!container) {
      return;
    }

    async function render() {
      const list = await loadStories();
      container.innerHTML = "";

      if (!list.length) {
        container.innerHTML = '<article class="table-row"><span>No stories yet.</span><span>-</span><span>-</span><span>-</span><span><a class="btn small" href="write.html?new=1">Write New Story</a></span></article>';
        return;
      }

      list.forEach((story) => {
        const row = document.createElement("article");
        row.className = "table-row";
        row.innerHTML = `
          <span>${safe(story.title)}</span>
          <span><span class="status-badge ${statusClass(story.status)}">${statusText(story.status)}</span></span>
          <span>${fmt(story.reads)}</span>
          <span>${fmt(story.likes)}</span>
          <span style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn small" data-action="edit">Edit</button>
            <button class="btn small" data-action="unpublish">Unpublish</button>
            <button class="btn small" data-action="delete">Delete</button>
            <button class="btn small" data-action="stats">Stats</button>
          </span>
        `;

        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          window.location.href = `write.html?id=${encodeURIComponent(story.id)}`;
        });

        row.querySelector('[data-action="unpublish"]').addEventListener("click", async () => {
          try {
            const updated = await api.updateStory(story.id, {
              status: "draft",
              visibility: "private",
              scheduledAt: null
            });
            upsertLegacyStory(updated);
            pushNotification(`"${updated.title}" moved back to draft.`);
            showPageStatus(`"${updated.title}" moved back to draft.`, "success");
            await render();
          } catch (error) {
            showPageStatus(api.getErrorMessage(error, "Story update failed."), "error");
          }
        });

        row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!window.confirm(`Delete "${story.title}"?`)) {
            return;
          }

          try {
            await api.deleteStory(story.id);
            removeLegacyStory(story.id);
            pushNotification(`"${story.title}" was deleted.`);
            showPageStatus(`"${story.title}" was deleted.`, "success");
            await render();
          } catch (error) {
            showPageStatus(api.getErrorMessage(error, "Story delete failed."), "error");
          }
        });

        row.querySelector('[data-action="stats"]').addEventListener("click", () => {
          window.location.href = `analytics.html?story=${encodeURIComponent(story.id)}`;
        });

        container.appendChild(row);
      });
    }

    await render();
  }

  async function initAnalytics() {
    const list = await loadStories();
    const readsEl = document.getElementById("analyticsReads");
    const likesEl = document.getElementById("analyticsLikes");
    const commentsEl = document.getElementById("analyticsComments");
    const avgReadEl = document.getElementById("analyticsAvgRead");
    const bars = document.getElementById("growthBars");
    const topStoryName = document.getElementById("topStoryName");
    const topStoryStats = document.getElementById("topStoryStats");
    const insightBestTime = document.getElementById("insightBestTime");
    const insightBestGenre = document.getElementById("insightBestGenre");
    const insightFollowerGrowth = document.getElementById("insightFollowerGrowth");
    const analyticsFocus = document.getElementById("analyticsFocus");
    const query = new URLSearchParams(window.location.search);
    const focusedStory = list.find((story) => story.id === query.get("story")) || null;

    const totals = list.reduce((acc, story) => ({
      reads: acc.reads + Number(story.reads || 0),
      likes: acc.likes + Number(story.likes || 0),
      readingMinutes: acc.readingMinutes + Number(story.readingMinutes || 0)
    }), {
      reads: 0,
      likes: 0,
      readingMinutes: 0
    });

    if (readsEl) readsEl.textContent = fmt(totals.reads);
    if (likesEl) likesEl.textContent = fmt(totals.likes);
    if (commentsEl) commentsEl.textContent = fmt(list.reduce((sum, story) => sum + Number(story.comments || 0), 0));
    if (avgReadEl) {
      const average = list.length ? Math.max(1, Math.round(totals.readingMinutes / list.length)) : 0;
      avgReadEl.textContent = `${average} min`;
    }

    if (bars) {
      bars.innerHTML = "";
      const days = Array.from({ length: 7 }, () => 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      list.forEach((story) => {
        const source = new Date(story.updatedAt || story.createdAt || Date.now());
        source.setHours(0, 0, 0, 0);
        const diff = Math.floor((today - source) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < 7) {
          days[6 - diff] += Number(story.reads || 0);
        }
      });

      const maxValue = Math.max(...days, 0);
      if (maxValue === 0) {
        bars.innerHTML = '<p class="section-sub">Not enough data for growth graph yet.</p>';
      } else {
        days.forEach((reads, index) => {
          const bar = document.createElement("div");
          bar.className = "bar";
          bar.style.height = `${Math.max(40, Math.round((reads / maxValue) * 160))}px`;
          bar.innerHTML = `<span>D${index + 1}</span>`;
          bars.appendChild(bar);
        });
      }
    }

    const top = list.slice().sort((a, b) => Number(b.reads || 0) - Number(a.reads || 0))[0] || null;
    if (topStoryName) topStoryName.textContent = top ? top.title : "No stories yet";
    if (topStoryStats) topStoryStats.textContent = top ? `${fmt(top.reads)} reads | ${fmt(top.likes)} votes` : "-";

    if (!list.length) {
      if (insightBestTime) insightBestTime.textContent = "Best posting time: Not enough data";
      if (insightBestGenre) insightBestGenre.textContent = "Best genre: Not enough data";
      if (insightFollowerGrowth) insightFollowerGrowth.textContent = `Followers: ${fmt(currentUser && currentUser.followersCount || 0)}`;
      if (analyticsFocus) analyticsFocus.textContent = "No story data available yet.";
      return;
    }

    const hourSum = Array.from({ length: 24 }, () => 0);
    const genreSum = {};

    list.forEach((story) => {
      const reads = Number(story.reads || 0);
      genreSum[story.genre] = (genreSum[story.genre] || 0) + reads;
      const hour = new Date(story.updatedAt || story.createdAt || Date.now()).getHours();
      hourSum[hour] += reads;
    });

    const bestHour = hourSum.indexOf(Math.max(...hourSum));
    const nextHour = (bestHour + 1) % 24;
    const bestGenre = Object.keys(genreSum).sort((a, b) => genreSum[b] - genreSum[a])[0] || "N/A";
    const formatHour = (hour) => {
      const suffix = hour >= 12 ? "PM" : "AM";
      const base = hour % 12 || 12;
      return `${base} ${suffix}`;
    };

    if (insightBestTime) insightBestTime.textContent = `Best posting time: ${formatHour(bestHour)} - ${formatHour(nextHour)}`;
    if (insightBestGenre) insightBestGenre.textContent = `Best genre: ${bestGenre}`;
    if (insightFollowerGrowth) insightFollowerGrowth.textContent = `Followers: ${fmt(currentUser && currentUser.followersCount || 0)}`;
    if (analyticsFocus) analyticsFocus.textContent = focusedStory ? `Focused Analytics: ${focusedStory.title}` : "Showing all stories performance.";
  }

  async function initNotifications() {
    const markAll = document.getElementById("markAllReadBtn");
    const box = document.getElementById("notificationList");
    if (!box) {
      return;
    }

    let remote = await api.listNotifications();
    let local = getNotifications();

    function combined() {
      return [
        ...remote.map((item) => ({
          id: item.id,
          text: item.text,
          unread: !!item.unread,
          time: item.createdAt
        })),
        ...local
      ].sort((a, b) => new Date(b.time) - new Date(a.time));
    }

    function render() {
      const list = combined();
      box.innerHTML = "";
      if (!list.length) {
        box.innerHTML = '<div class="card">No notifications.</div>';
        return;
      }

      list.forEach((item) => {
        const article = document.createElement("article");
        article.className = `notify-item ${item.unread ? "unread" : ""}`;
        article.innerHTML = `
          <div>${safe(item.text)}</div>
          <div class="notify-time">${dateTimeLabel(item.time)}</div>
        `;
        box.appendChild(article);
      });
    }

    if (markAll) {
      markAll.addEventListener("click", async () => {
        local = local.map((item) => ({
          ...item,
          unread: false
        }));
        remote = remote.map((item) => ({
          ...item,
          unread: false
        }));
        local.forEach((item) => {
          item.unread = false;
        });
        saveNotifications(local);
        try {
          await api.markAllNotificationsRead();
        } catch (error) {
          // Keep local UI usable even if backend mark-read fails.
        }
        setNotificationBadge(document.getElementById("writerNotificationBellCount"), 0);
        render();
      });
    }

    render();
  }

  async function initProfile() {
    const user = currentUser;
    let avatarUrlDraft = String(user && user.avatarUrl || "").trim();
    let coverPhotoUrlDraft = String(user && user.coverPhotoUrl || "").trim();
    let avatarPreviewDraft = avatarUrlDraft;
    let coverPreviewDraft = coverPhotoUrlDraft;
    let pendingAvatarDataUrl = "";
    let pendingCoverDataUrl = "";
    const elements = {
      displayName: document.getElementById("writerDisplayName"),
      username: document.getElementById("writerUsername"),
      bio: document.getElementById("writerBio"),
      profilePhoto: document.getElementById("writerProfilePhoto"),
      coverPhoto: document.getElementById("writerCoverPhoto"),
      avatarColor: document.getElementById("writerAvatarColor"),
      socialInstagram: document.getElementById("writerSocialInsta"),
      socialYoutube: document.getElementById("writerSocialYoutube"),
      save: document.getElementById("saveWriterProfileBtn"),
      status: document.getElementById("writerProfileStatus"),
      coverPreview: document.getElementById("profileCoverPreview"),
      avatarPreview: document.getElementById("profileAvatarPreview"),
      namePreview: document.getElementById("profileNamePreview"),
      userPreview: document.getElementById("profileUserPreview"),
      bioPreview: document.getElementById("profileBioPreview"),
      followersPreview: document.getElementById("profileFollowersPreview"),
      socialPreview: document.getElementById("profileSocialPreview"),
      publicProfileLink: document.getElementById("publicProfileLink")
    };

    function collect() {
      return {
        displayName: elements.displayName.value.trim() || deriveDisplayName(user.email),
        username: elements.username.value.trim().toLowerCase().replace(/\s+/g, "_") || deriveUsername(user.email),
        bio: elements.bio.value.trim(),
        avatarColor: elements.avatarColor.value || "#7C7CFF",
        socialInstagram: elements.socialInstagram.value.trim(),
        socialYouTube: elements.socialYoutube.value.trim()
      };
    }

    function previewState() {
      return {
        ...collect(),
        avatarUrl: avatarPreviewDraft,
        coverPhotoUrl: coverPreviewDraft
      };
    }

    function fill(value) {
      elements.displayName.value = value.displayName || deriveDisplayName(value.email);
      elements.username.value = value.username || deriveUsername(value.email);
      elements.bio.value = value.bio || "";
      elements.avatarColor.value = value.avatarColor || "#7C7CFF";
      avatarUrlDraft = String(value.avatarUrl || "").trim();
      coverPhotoUrlDraft = String(value.coverPhotoUrl || "").trim();
      avatarPreviewDraft = avatarUrlDraft;
      coverPreviewDraft = coverPhotoUrlDraft;
      pendingAvatarDataUrl = "";
      pendingCoverDataUrl = "";
      if (elements.profilePhoto) {
        elements.profilePhoto.value = "";
      }
      if (elements.coverPhoto) {
        elements.coverPhoto.value = "";
      }
      elements.socialInstagram.value = value.socials && value.socials.instagram ? value.socials.instagram : "";
      elements.socialYoutube.value = value.socials && value.socials.youtube ? value.socials.youtube : (value.website || "");
    }

    function preview(value) {
      const displayName = value.displayName || deriveDisplayName(user.email);
      const username = value.username || deriveUsername(user.email);
      if (elements.coverPreview) {
        applyMediaBackground(
          elements.coverPreview,
          value.coverPhotoUrl,
          `radial-gradient(circle at 18% 18%, rgba(255,255,255,0.2), transparent 24%), radial-gradient(circle at 82% 24%, rgba(245,158,11,0.18), transparent 28%), linear-gradient(120deg, ${value.avatarColor || "#7C7CFF"} 0%, #172033 55%, #0f172a 100%)`
        );
      }
      if (elements.avatarPreview) {
        if (value.avatarUrl) {
          applyMediaBackground(elements.avatarPreview, value.avatarUrl, "#0f172a");
          elements.avatarPreview.textContent = "";
        } else {
          elements.avatarPreview.style.background = value.avatarColor || "#7C7CFF";
          elements.avatarPreview.textContent = displayName.charAt(0).toUpperCase();
        }
      }
      if (elements.namePreview) elements.namePreview.textContent = displayName;
      if (elements.userPreview) elements.userPreview.textContent = `@${username}`;
      if (elements.bioPreview) elements.bioPreview.textContent = value.bio || "";
      if (elements.followersPreview) elements.followersPreview.textContent = fmt(currentUser && currentUser.followersCount || 0);
      renderSocialLinks(elements.socialPreview, {
        instagram: value.socials && value.socials.instagram ? value.socials.instagram : value.socialInstagram,
        youtube: value.socials && value.socials.youtube ? value.socials.youtube : value.socialYouTube
      }, "profile-social-link");
      if (elements.publicProfileLink) {
        elements.publicProfileLink.href = `profile.html?author=${encodeURIComponent(username)}`;
      }
    }

    fill(user);
    preview(previewState());

    [elements.displayName, elements.username, elements.bio, elements.avatarColor, elements.socialInstagram, elements.socialYoutube].forEach((input) => {
      if (!input) {
        return;
      }

      input.addEventListener("input", () => {
        preview(previewState());
      });
    });

    if (elements.profilePhoto) {
      elements.profilePhoto.addEventListener("change", async () => {
        const file = elements.profilePhoto.files && elements.profilePhoto.files[0];
        if (!file) {
          return;
        }

        if (file.size > PROFILE_MEDIA_MAX_BYTES) {
          elements.profilePhoto.value = "";
          pendingAvatarDataUrl = "";
          avatarPreviewDraft = avatarUrlDraft;
          elements.status.textContent = "Main photo must be 4 MB or smaller.";
          elements.status.className = "status-text err";
          preview(previewState());
          return;
        }

        try {
          pendingAvatarDataUrl = await readImageFileAsDataUrl(file);
          avatarPreviewDraft = pendingAvatarDataUrl;
          preview(previewState());
          elements.status.textContent = "Main photo ready. Save Profile to apply it.";
          elements.status.className = "status-text";
        } catch (error) {
          elements.status.textContent = api.getErrorMessage(error, "Main photo load failed.");
          elements.status.className = "status-text err";
        }
      });
    }

    if (elements.coverPhoto) {
      elements.coverPhoto.addEventListener("change", async () => {
        const file = elements.coverPhoto.files && elements.coverPhoto.files[0];
        if (!file) {
          return;
        }

        if (file.size > PROFILE_MEDIA_MAX_BYTES) {
          elements.coverPhoto.value = "";
          pendingCoverDataUrl = "";
          coverPreviewDraft = coverPhotoUrlDraft;
          elements.status.textContent = "Background photo must be 4 MB or smaller.";
          elements.status.className = "status-text err";
          preview(previewState());
          return;
        }

        try {
          pendingCoverDataUrl = await readImageFileAsDataUrl(file);
          coverPreviewDraft = pendingCoverDataUrl;
          preview(previewState());
          elements.status.textContent = "Background photo ready. Save Profile to apply it.";
          elements.status.className = "status-text";
        } catch (error) {
          elements.status.textContent = api.getErrorMessage(error, "Background photo load failed.");
          elements.status.className = "status-text err";
        }
      });
    }

    if (elements.save) {
      elements.save.addEventListener("click", async () => {
        try {
          elements.save.disabled = true;
          elements.save.textContent = "Saving...";
          let latestUser = currentUser ? { ...currentUser } : null;

          if (pendingAvatarDataUrl) {
            const avatarUpload = await api.uploadCurrentUserMedia("avatar", pendingAvatarDataUrl);
            avatarUrlDraft = String(avatarUpload && avatarUpload.url || "").trim();
            avatarPreviewDraft = avatarUrlDraft;
            pendingAvatarDataUrl = "";
            if (avatarUpload && avatarUpload.user) {
              latestUser = avatarUpload.user;
            }
          }

          if (pendingCoverDataUrl) {
            const coverUpload = await api.uploadCurrentUserMedia("cover", pendingCoverDataUrl);
            coverPhotoUrlDraft = String(coverUpload && coverUpload.url || "").trim();
            coverPreviewDraft = coverPhotoUrlDraft;
            pendingCoverDataUrl = "";
            if (coverUpload && coverUpload.user) {
              latestUser = coverUpload.user;
            }
          }

          const updatedUser = await api.updateCurrentUser(collect());
          latestUser = updatedUser || {
            ...(latestUser || currentUser || {}),
            ...collect(),
            avatarUrl: avatarUrlDraft,
            coverPhotoUrl: coverPhotoUrlDraft
          };

          if (latestUser && latestUser.id) {
            try {
              latestUser = await api.getUserById(latestUser.id);
            } catch (error) {
              // Fall back to the latest successful payload if the refresh call fails.
            }
          }
          if (latestUser) {
            api.updateSessionUser(latestUser);
          }
          session = api.getSession();
          currentUser = session && session.user ? session.user : (latestUser || currentUser);
          syncLegacyProfile(currentUser);
          fill(currentUser);
          preview(currentUser);
          pushNotification("Writer profile updated.");
          elements.status.textContent = "Profile updated successfully.";
          elements.status.className = "status-text ok";
        } catch (error) {
          elements.status.textContent = api.getErrorMessage(error, "Profile update failed.");
          elements.status.className = "status-text err";
        } finally {
          elements.save.disabled = false;
          elements.save.textContent = "Save Profile";
        }
      });
    }
  }

  async function initEditor() {
    const query = new URLSearchParams(window.location.search);
    const storyId = query.get("id");
    const chapterParam = Number.parseInt(query.get("chapter") || "1", 10);
    const elements = {
      title: document.getElementById("editorTitle"),
      description: document.getElementById("editorDescription"),
      genre: document.getElementById("editorGenre"),
      tags: document.getElementById("editorTags"),
      coverInput: document.getElementById("editorCoverInput"),
      coverPreview: document.getElementById("editorCoverPreview"),
      chapterTabs: document.getElementById("chapterTabs"),
      status: document.getElementById("editorSaveStatus"),
      saveDraft: document.getElementById("saveDraftBtn"),
      update: document.getElementById("updateStoryBtn"),
      previewToggle: document.getElementById("previewToggleBtn"),
      previewPanel: document.getElementById("previewPanel"),
      previewTitle: document.getElementById("previewTitle"),
      previewMeta: document.getElementById("previewMeta"),
      previewDescription: document.getElementById("previewDescription"),
      previewBody: document.getElementById("previewBody"),
      openPublish: document.getElementById("openPublishBtn"),
      modal: document.getElementById("publishModal"),
      closeModal: document.getElementById("closePublishModal"),
      confirmTitle: document.getElementById("publishConfirmTitle"),
      confirmCover: document.getElementById("publishConfirmCover"),
      visibility: document.getElementById("publishVisibility"),
      schedule: document.getElementById("publishSchedule"),
      warning: document.getElementById("publishWarning"),
      confirmPublish: document.getElementById("confirmPublishBtn"),
      keepDraft: document.getElementById("publishDraftBtn"),
      publishStatus: document.getElementById("publishStatus"),
      success: document.getElementById("publishSuccess"),
      share: document.getElementById("publishShareLink"),
      goAnalytics: document.getElementById("goAnalyticsBtn"),
      closeSuccess: document.getElementById("closePublishSuccessBtn")
    };

    let current = null;
    let cover = DEFAULT_COVER;
    let chapters = [];
    let activeChapterIndex = -1;
    let autoSaveInFlight = false;
    let autoSaveTimer = null;

    function normalizeChapterState() {
      if (!chapters.length) {
        activeChapterIndex = -1;
        return;
      }

      if (activeChapterIndex < 0) {
        activeChapterIndex = 0;
      }

      if (activeChapterIndex >= chapters.length) {
        activeChapterIndex = chapters.length - 1;
      }
    }

    function getActiveChapter() {
      normalizeChapterState();
      if (activeChapterIndex < 0) {
        return null;
      }
      if (!chapters[activeChapterIndex]) {
        chapters[activeChapterIndex] = defaultChapter(activeChapterIndex);
      }
      return chapters[activeChapterIndex];
    }

    function syncActiveChapterTitle() {
      const chapter = getActiveChapter();
      if (!chapter) {
        return;
      }
      chapter.title = (chapter.title || "").trim() || `Chapter ${activeChapterIndex + 1}`;
    }

    function parseTags(value) {
      return String(value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    function applyChapterFromQuery() {
      if (Number.isNaN(chapterParam) || !chapters.length) {
        return;
      }

      activeChapterIndex = Math.max(0, Math.min(chapters.length - 1, chapterParam - 1));
    }

    function renderChapterTabs() {
      if (!elements.chapterTabs) {
        return;
      }

      normalizeChapterState();
      elements.chapterTabs.innerHTML = "";

      chapters.forEach((chapter, index) => {
        const row = document.createElement("div");
        row.className = "chapter-item";

        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = `chapter-open${index === activeChapterIndex ? " active" : ""}`;
        openButton.textContent = chapterDisplayTitle(chapter, index);
        openButton.addEventListener("click", () => {
          openChapterEditor(index).catch((error) => {
            setStatus(elements.status, api.getErrorMessage(error, "Chapter editor failed to open."), true);
          });
        });

        row.appendChild(openButton);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "chapter-delete";
        deleteButton.setAttribute("aria-label", `Delete ${chapterDisplayTitle(chapter, index)}`);
        deleteButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
          </svg>
        `;
        deleteButton.addEventListener("click", async (event) => {
          event.stopPropagation();
          try {
            await deleteChapterAt(index);
          } catch (error) {
            setStatus(elements.status, api.getErrorMessage(error, "Chapter delete failed."), true);
          }
        });

        row.appendChild(deleteButton);
        elements.chapterTabs.appendChild(row);
      });

      const addRow = document.createElement("button");
      addRow.type = "button";
      addRow.className = "chapter-add-row";
      addRow.innerHTML = `
        <svg class="chapter-add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
        <span>Add Chapter</span>
      `;
      addRow.addEventListener("click", () => {
        addChapterAndOpen().catch((error) => {
          setStatus(elements.status, api.getErrorMessage(error, "Chapter create failed."), true);
        });
      });
      elements.chapterTabs.appendChild(addRow);
    }

    function refreshPreview() {
      syncActiveChapterTitle();
      const stats = chapterStats(chapters);
      const summary = elements.description ? elements.description.value.trim() : "";

      if (elements.previewTitle) {
        elements.previewTitle.textContent = elements.title.value.trim() || "Untitled Story";
      }

      if (elements.previewMeta) {
        elements.previewMeta.textContent = `${elements.genre.value || "romance"} | ${chapters.length} chapters | ${stats.words} words | ${stats.readingTime} min`;
      }

      if (elements.previewDescription) {
        elements.previewDescription.textContent = summary || "Add a short description to show readers what your story is about.";
      }

      if (elements.previewBody) {
        elements.previewBody.innerHTML = chapters.length
          ? chapters
            .map((chapter, index) => `<section><h4>${safe(chapterDisplayTitle(chapter, index))}</h4>${chapter.content || "<p>No content yet.</p>"}</section>`)
            .join("")
          : "<p>No chapters added yet.</p>";
      }

      return stats;
    }

    function applyStory(story) {
      current = story;
      cover = story.cover || story.coverUrl || DEFAULT_COVER;
      const storyChapters = normalizeStoryChapters(story);
      const storySummary = String(story.summary || "").trim() || deriveSummary(storyChapters);

      if (elements.title) elements.title.value = story.title || "";
      if (elements.description) elements.description.value = storySummary;
      if (elements.genre) elements.genre.value = story.genre || "romance";
      if (elements.tags) elements.tags.value = (story.tags || []).join(", ");
      if (elements.coverPreview) {
        elements.coverPreview.style.background = cover;
        elements.coverPreview.textContent = "";
      }
      if (elements.visibility) elements.visibility.value = story.visibility || "public";
      if (elements.schedule) {
        elements.schedule.value = story.scheduledAt ? new Date(story.scheduledAt).toISOString().slice(0, 16) : "";
      }
      if (elements.warning) elements.warning.checked = !!(story.warning || story.contentWarning);

      chapters = storyChapters;
      activeChapterIndex = storyChapters.length ? 0 : -1;
      applyChapterFromQuery();
      renderChapterTabs();
      refreshPreview();
    }

    function buildPayload(statusOverride) {
      const stats = refreshPreview();
      const chapterPayload = chapters.map((chapter, index) => ({
        title: (chapter.title || "").trim() || `Chapter ${index + 1}`,
        content: chapter.content || "<p></p>"
      }));
      const manualSummary = elements.description ? elements.description.value.trim() : "";

      return {
        title: elements.title.value.trim() || "Untitled Story",
        genre: elements.genre.value || "romance",
        tags: parseTags(elements.tags.value),
        cover: cover,
        coverUrl: cover,
        chapters: chapterPayload,
        summary: manualSummary || deriveSummary(chapterPayload),
        status: statusOverride || (current && current.status) || "draft",
        visibility: elements.visibility.value || (current && current.visibility) || "public",
        warning: !!elements.warning.checked,
        scheduledAt: elements.schedule.value ? new Date(elements.schedule.value).toISOString() : null,
        wordCount: stats.words,
        readingMinutes: stats.readingTime
      };
    }

    async function saveStory(statusOverride, note, options) {
      const config = options || {};
      const payload = {
        ...buildPayload(statusOverride),
        notifySubscribers: !!config.notifySubscribers
      };
      const saved = current && current.id
        ? await api.updateStory(current.id, payload)
        : await api.createStory(payload);

      current = saved;
      upsertLegacyStory(saved);
      history.replaceState(null, "", `write.html?id=${encodeURIComponent(saved.id)}`);
      setStatus(elements.status, note, false);

      if (!config.silent && note) {
        pushNotification(note);
      }

      return saved;
    }

    async function openChapterEditor(index) {
      syncActiveChapterTitle();
      const saved = await saveStory(current ? current.status : "draft", "Draft saved", {
        silent: true
      });
      const chapterNumber = Math.max(1, Math.min(chapters.length, index + 1));
      window.location.href = `chapter-editor.html?id=${encodeURIComponent(saved.id)}&chapter=${encodeURIComponent(chapterNumber)}`;
    }

    async function addChapterAndOpen() {
      const nextIndex = chapters.length;
      chapters.push(defaultChapter(nextIndex));
      activeChapterIndex = nextIndex;
      renderChapterTabs();
      refreshPreview();
      await openChapterEditor(nextIndex);
    }

    async function deleteChapterAt(index) {
      syncActiveChapterTitle();
      if (!chapters[index]) {
        return;
      }

      chapters.splice(index, 1);
      normalizeChapterState();
      renderChapterTabs();
      refreshPreview();

      await saveStory(current ? current.status : "draft", "Chapter deleted", {
        silent: false,
        notifySubscribers: true
      });
    }

    async function publish(forceDraft) {
      let status = "published";
      const scheduleValue = elements.schedule.value ? new Date(elements.schedule.value).toISOString() : null;
      if (forceDraft || elements.visibility.value === "private") {
        status = "draft";
      } else if (scheduleValue && new Date(scheduleValue).getTime() > Date.now()) {
        status = "scheduled";
      }

      const saved = await saveStory(status, status === "published" ? `Published "${elements.title.value.trim() || "Untitled Story"}".` : "Draft updated.", {
        silent: false,
        notifySubscribers: status === "published"
      });

      if (elements.publishStatus) {
        elements.publishStatus.textContent = status === "scheduled"
          ? `Scheduled for ${dateTimeLabel(saved.scheduledAt)}.`
          : status === "draft"
            ? "Saved as draft/private."
            : "Published successfully.";
      }

      if (elements.share) {
        elements.share.value = `story.html?id=${encodeURIComponent(saved.id)}`;
      }

      if (elements.success) {
        elements.success.classList.remove("hidden");
      }

      if (elements.goAnalytics) {
        elements.goAnalytics.onclick = () => {
          window.location.href = `analytics.html?story=${encodeURIComponent(saved.id)}`;
        };
      }
    }

    function openPublishModal() {
      const payload = buildPayload(current ? current.status : "draft");
      if (elements.confirmTitle) elements.confirmTitle.textContent = payload.title;
      if (elements.confirmCover) {
        elements.confirmCover.style.background = payload.cover || DEFAULT_COVER;
        elements.confirmCover.textContent = "";
      }
      if (elements.publishStatus) elements.publishStatus.textContent = "";
      if (elements.success) elements.success.classList.add("hidden");
      if (elements.modal) elements.modal.classList.remove("hidden");
    }

    function closePublishModal() {
      if (elements.modal) {
        elements.modal.classList.add("hidden");
      }
    }

    if (storyId) {
      try {
        const story = await loadStoryById(storyId);
        applyStory(story);
      } catch (error) {
        renderFatal(api.getErrorMessage(error, "Story load failed."));
        return;
      }
    } else {
      if (elements.coverPreview) {
        elements.coverPreview.style.background = cover;
        elements.coverPreview.textContent = "";
      }
      if (elements.visibility) elements.visibility.value = "public";
      if (elements.warning) elements.warning.checked = false;
      chapters = [];
      activeChapterIndex = -1;
      renderChapterTabs();
      refreshPreview();
    }

    [elements.title, elements.description, elements.genre, elements.tags].forEach((input) => {
      if (!input) {
        return;
      }
      input.addEventListener("input", refreshPreview);
    });

    if (elements.coverInput) {
      elements.coverInput.addEventListener("change", () => {
        const file = elements.coverInput.files && elements.coverInput.files[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          cover = `url('${reader.result}') center/cover no-repeat`;
          if (elements.coverPreview) {
            elements.coverPreview.style.background = cover;
            elements.coverPreview.textContent = "";
          }
          refreshPreview();
        };
        reader.readAsDataURL(file);
      });
    }

    if (elements.saveDraft) {
      elements.saveDraft.addEventListener("click", async () => {
        try {
          await saveStory("draft", "Draft saved", {
            silent: false
          });
        } catch (error) {
          setStatus(elements.status, api.getErrorMessage(error, "Draft save failed."), true);
        }
      });
    }

    if (elements.update) {
      elements.update.addEventListener("click", async () => {
        try {
          await saveStory(current ? current.status : "draft", "Story updated", {
            silent: false,
            notifySubscribers: true
          });
        } catch (error) {
          setStatus(elements.status, api.getErrorMessage(error, "Story update failed."), true);
        }
      });
    }

    if (elements.previewToggle) {
      elements.previewToggle.addEventListener("click", () => {
        if (!elements.previewPanel) {
          return;
        }

        elements.previewPanel.classList.toggle("hidden");
        elements.previewToggle.textContent = elements.previewPanel.classList.contains("hidden") ? "Preview Mode" : "Hide Preview";
        refreshPreview();
      });
    }

    if (elements.openPublish) {
      elements.openPublish.addEventListener("click", openPublishModal);
    }

    if (elements.closeModal) {
      elements.closeModal.addEventListener("click", closePublishModal);
    }

    if (elements.closeSuccess) {
      elements.closeSuccess.addEventListener("click", closePublishModal);
    }

    if (elements.keepDraft) {
      elements.keepDraft.addEventListener("click", async () => {
        try {
          await publish(true);
        } catch (error) {
          if (elements.publishStatus) {
            elements.publishStatus.textContent = api.getErrorMessage(error, "Publish failed.");
          }
        }
      });
    }

    if (elements.confirmPublish) {
      elements.confirmPublish.addEventListener("click", async () => {
        try {
          await publish(false);
        } catch (error) {
          if (elements.publishStatus) {
            elements.publishStatus.textContent = api.getErrorMessage(error, "Publish failed.");
          }
        }
      });
    }

    autoSaveTimer = window.setInterval(async () => {
      if (autoSaveInFlight) {
        return;
      }

      autoSaveInFlight = true;
      try {
        await saveStory(current ? current.status : "draft", `Auto-saved ${dateTimeLabel(new Date())}`, {
          silent: true
        });
      } catch (error) {
        // Autosave errors stay quiet so typing flow does not get interrupted.
      } finally {
        autoSaveInFlight = false;
      }
    }, 6000);

    window.addEventListener("beforeunload", () => {
      if (autoSaveTimer) {
        window.clearInterval(autoSaveTimer);
      }
    });
  }

  async function initChapterEditor() {
    const query = new URLSearchParams(window.location.search);
    const storyId = query.get("id");
    const chapterParam = Number.parseInt(query.get("chapter") || "1", 10);
    if (!storyId) {
      window.location.href = "write.html";
      return;
    }

    let current = null;
    try {
      current = await loadStoryById(storyId);
    } catch (error) {
      renderFatal(api.getErrorMessage(error, "Story load failed."));
      return;
    }

    let chapters = normalizeStoryChapters(current);
    let activeChapterIndex = Number.isNaN(chapterParam)
      ? 0
      : Math.max(0, Math.min(chapters.length - 1, chapterParam - 1));
    let saveInFlight = false;
    let timer = null;

    const elements = {
      storyTitle: document.getElementById("chapterEditorStoryTitle"),
      meta: document.getElementById("chapterEditorMeta"),
      backBtn: document.getElementById("chapterBackToStoryBtn"),
      chapterTitle: document.getElementById("chapterEditorTitle"),
      content: document.getElementById("editorContent"),
      words: document.getElementById("chapterEditorWordCount"),
      time: document.getElementById("chapterEditorReadingTime"),
      status: document.getElementById("chapterEditorSaveStatus"),
      saveBtn: document.getElementById("chapterEditorSaveBtn"),
      closeBtn: document.getElementById("chapterEditorCloseBtn")
    };
    const toolbarButtons = Array.from(document.querySelectorAll("[data-editor-cmd]"));
    const toolbarButtonMap = new Map(toolbarButtons.map((button) => [button.dataset.editorCmd, button]));
    const blockTags = new Set(["blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "pre"]);

    function currentChapter() {
      if (!chapters[activeChapterIndex]) {
        chapters[activeChapterIndex] = defaultChapter(activeChapterIndex);
      }
      return chapters[activeChapterIndex];
    }

    function chapterLabel() {
      return chapterDisplayTitle(currentChapter(), activeChapterIndex);
    }

    function selectionInsideEditor() {
      if (!elements.content) {
        return false;
      }

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return document.activeElement === elements.content;
      }

      const anchor = selection.anchorNode;
      const focus = selection.focusNode;
      return !!(
        (anchor && (anchor === elements.content || elements.content.contains(anchor))) ||
        (focus && (focus === elements.content || elements.content.contains(focus))) ||
        document.activeElement === elements.content
      );
    }

    function closestEditorBlock(node) {
      let currentNode = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (currentNode && currentNode !== elements.content) {
        const tag = String(currentNode.tagName || "").toLowerCase();
        if (blockTags.has(tag)) {
          return currentNode;
        }
        currentNode = currentNode.parentElement;
      }
      return elements.content || null;
    }

    function normalizeFormatBlock(value) {
      return String(value || "").replace(/[<>]/g, "").trim().toLowerCase();
    }

    function queryState(command) {
      try {
        return document.queryCommandState(command);
      } catch (error) {
        return false;
      }
    }

    function queryValue(command) {
      try {
        return document.queryCommandValue(command);
      } catch (error) {
        return "";
      }
    }

    function setToolActive(command, active) {
      const button = toolbarButtonMap.get(command);
      if (!button) {
        return;
      }

      button.classList.toggle("active-tool", !!active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }

    function activeAlignmentCommand() {
      const selection = window.getSelection();
      const block = closestEditorBlock(selection && selection.anchorNode);
      const explicitAlign = String(block && (block.style.textAlign || block.getAttribute("align")) || "").trim().toLowerCase();
      const computedAlign = block && block !== elements.content
        ? String(window.getComputedStyle(block).textAlign || "").trim().toLowerCase()
        : "";
      const align = explicitAlign || computedAlign;

      if (align === "center") {
        return "justifyCenter";
      }

      if (align === "right" || align === "end") {
        return "justifyRight";
      }

      if (queryState("justifyCenter")) {
        return "justifyCenter";
      }

      if (queryState("justifyRight")) {
        return "justifyRight";
      }

      return "justifyLeft";
    }

    function updateToolbarState() {
      if (!toolbarButtons.length) {
        return;
      }

      const inEditor = selectionInsideEditor();
      const selection = window.getSelection();
      const block = closestEditorBlock(selection && selection.anchorNode);
      const activeFormat = normalizeFormatBlock(queryValue("formatBlock")) || String(block && block.tagName || "").trim().toLowerCase();
      const activeAlignment = inEditor ? activeAlignmentCommand() : "";

      setToolActive("bold", inEditor && queryState("bold"));
      setToolActive("italic", inEditor && queryState("italic"));
      setToolActive("h2", inEditor && activeFormat === "h2");
      setToolActive("justifyLeft", inEditor && activeAlignment === "justifyLeft");
      setToolActive("justifyCenter", inEditor && activeAlignment === "justifyCenter");
      setToolActive("justifyRight", inEditor && activeAlignment === "justifyRight");
    }

    function updateStats() {
      const stats = chapterStats([currentChapter()]);
      if (elements.words) elements.words.textContent = `Words: ${fmt(stats.words)}`;
      if (elements.time) elements.time.textContent = `Reading time: ${stats.readingTime} min`;
    }

    function syncChapter() {
      const chapter = currentChapter();
      chapter.title = (elements.chapterTitle.value || "").trim() || `Chapter ${activeChapterIndex + 1}`;
      chapter.content = (elements.content.innerHTML || "").trim() || "<p></p>";
      updateStats();

      if (elements.meta) {
        elements.meta.textContent = `Editing ${chapterLabel()} | Chapter ${activeChapterIndex + 1} of ${chapters.length}`;
      }
    }

    function hydrate() {
      const chapter = currentChapter();
      if (elements.storyTitle) elements.storyTitle.textContent = current.title || "Untitled Story";
      if (elements.meta) {
        elements.meta.textContent = `Editing ${chapterLabel()} | Chapter ${activeChapterIndex + 1} of ${chapters.length}`;
      }
      if (elements.backBtn) {
        elements.backBtn.href = `write.html?id=${encodeURIComponent(current.id)}&chapter=${encodeURIComponent(activeChapterIndex + 1)}`;
      }
      if (elements.chapterTitle) {
        elements.chapterTitle.value = chapter.title || `Chapter ${activeChapterIndex + 1}`;
      }
      if (elements.content) {
        elements.content.innerHTML = chapter.content || "<p></p>";
      }
      updateStats();
      if (elements.status) {
        elements.status.textContent = "Status: Ready";
        elements.status.className = "status-text";
      }
      updateToolbarState();
    }

    async function persist(note, options) {
      const config = options || {};
      syncChapter();
      const payload = chapters.map((chapter, index) => ({
        title: (chapter.title || "").trim() || `Chapter ${index + 1}`,
        content: chapter.content || "<p></p>"
      }));

      const updated = await api.updateStory(current.id, {
        chapters: payload,
        notifySubscribers: !!config.notifySubscribers
      });

      current = updated;
      chapters = normalizeStoryChapters(updated);
      upsertLegacyStory(updated);

      if (elements.status) {
        elements.status.textContent = `Status: ${note}`;
        elements.status.className = "status-text";
      }
    }

    document.querySelectorAll("[data-editor-cmd]").forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.dataset.editorCmd;
        elements.content.focus();
        if (command === "h2") {
          document.execCommand("formatBlock", false, "h2");
        } else if (command === "p") {
          document.execCommand("formatBlock", false, "p");
        } else if (command === "ul") {
          document.execCommand("insertUnorderedList", false, null);
        } else if (command === "justifyLeft" || command === "justifyCenter" || command === "justifyRight") {
          document.execCommand(command, false, null);
        } else {
          document.execCommand(command, false, null);
        }
        syncChapter();
        updateToolbarState();
      });
    });

    if (elements.chapterTitle) {
      elements.chapterTitle.addEventListener("input", () => {
        syncChapter();
        if (elements.status) elements.status.textContent = "Status: Editing...";
      });
    }

    if (elements.content) {
      elements.content.addEventListener("input", () => {
        syncChapter();
        updateToolbarState();
        if (elements.status) elements.status.textContent = "Status: Editing...";
      });
      elements.content.addEventListener("keyup", updateToolbarState);
      elements.content.addEventListener("mouseup", updateToolbarState);
      elements.content.addEventListener("focus", updateToolbarState);
    }

    document.addEventListener("selectionchange", updateToolbarState);

    if (elements.saveBtn) {
      elements.saveBtn.addEventListener("click", async () => {
        try {
          await persist("Chapter saved", {
            notifySubscribers: true
          });
        } catch (error) {
          if (elements.status) {
            elements.status.textContent = `Status: ${api.getErrorMessage(error, "Chapter save failed.")}`;
            elements.status.className = "status-text error";
          }
        }
      });
    }

    if (elements.closeBtn) {
      elements.closeBtn.addEventListener("click", async () => {
        try {
          await persist("Chapter saved", {
            notifySubscribers: true
          });
          window.close();
          if (!window.closed) {
            window.location.href = `write.html?id=${encodeURIComponent(current.id)}&chapter=${encodeURIComponent(activeChapterIndex + 1)}`;
          }
        } catch (error) {
          if (elements.status) {
            elements.status.textContent = `Status: ${api.getErrorMessage(error, "Chapter save failed.")}`;
            elements.status.className = "status-text error";
          }
        }
      });
    }

    timer = window.setInterval(async () => {
      if (saveInFlight) {
        return;
      }
      saveInFlight = true;
      try {
        await persist(`Auto-saved ${dateTimeLabel(new Date())}`, {
          notifySubscribers: false
        });
      } catch (error) {
        // Quiet autosave.
      } finally {
        saveInFlight = false;
      }
    }, 6000);

    window.addEventListener("beforeunload", () => {
      if (timer) {
        window.clearInterval(timer);
      }
    });

    hydrate();
  }

  async function boot() {
    session = api.getSession();
    if (!session) {
      window.location.href = "index.html";
      return;
    }
    showMainLoading("Loading writer workspace...", "Syncing profile, stories, analytics, and notifications.");

    try {
      session = await api.hydrateCurrentUser();
      session = await api.ensureUserMode("writer");
      currentUser = session.user;
      syncLegacyProfile(currentUser);
    } catch (error) {
      await api.logout();
      window.location.href = "index.html";
      return;
    }

    initHeader(page, currentUser);

    const routes = {
      dashboard: initDashboard,
      editor: initEditor,
      "chapter-editor": initChapterEditor,
      stories: initStories,
      analytics: initAnalytics,
      notifications: initNotifications,
      profile: initProfile
    };

    const route = routes[page];
    if (!route) {
      return;
    }

    try {
      await route();
      clearMainLoading();
      clearPageStatus();
    } catch (error) {
      renderFatal(api.getErrorMessage(error, "Writer page failed to load."));
    }
  }

  boot().catch((error) => {
    renderFatal(api.getErrorMessage(error, "Writer mode failed to load."));
  });
})();
