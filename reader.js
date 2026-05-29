(() => {
  const api = window.MidnightAPI;
  const page = document.body.dataset.readerPage;
  if (!api || !page) {
    return;
  }

  const BASE = {
    library: "reader_library",
    liked: "reader_liked",
    follow: "reader_following",
    notify: "reader_notify",
    authorNotify: "reader_notify_author",
    recent: "reader_recent",
    progress: "reader_progress",
    comments: "reader_comments"
  };

  const ICONS = ["heart", "moon", "spark", "bolt", "orbit"];
  const ALLOWED_RICH_TEXT_TAGS = new Set(["a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6", "i", "li", "ol", "p", "pre", "span", "strong", "sub", "sup", "u", "ul"]);
  const SECTION_TAGS = new Set(["blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ol", "p", "pre", "ul"]);
  const state = {
    session: null,
    keys: {},
    readerState: {
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
    },
    progressSyncTimers: new Map(),
    stories: [],
    storyMap: new Map(),
    chapters: [],
    chapterMap: new Map(),
    authors: [],
    authorMap: new Map(),
    genres: [],
    genreMap: new Map()
  };
  let statusTimer = null;

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function bellIconMarkup() {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"></path>
        <path d="M9.5 17a2.5 2.5 0 0 0 5 0"></path>
      </svg>
    `;
  }

  function eyeIconMarkup() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }

  function commentIconMarkup() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"></path>
      </svg>
    `;
  }

  function heartIconMarkup(filled = false) {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 20.7 4.8 13.6a4.8 4.8 0 0 1 6.8-6.8l.4.4.4-.4a4.8 4.8 0 1 1 6.8 6.8Z"></path>
      </svg>
    `;
  }

  function clockIconMarkup() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5"></circle>
        <path d="M12 7.5v5l3.5 2"></path>
      </svg>
    `;
  }

  function stackIconMarkup() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 4 3 8.5 12 13l9-4.5Z"></path>
        <path d="M7 11.5 3 13.5 12 18l9-4.5-4-2"></path>
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

  function metricChipMarkup(iconMarkup, label, extraClass = "", srLabel = "") {
    const hiddenLabel = String(srLabel || "").trim();
    return `<span class="metric-chip${extraClass ? ` ${extraClass}` : ""}">${iconMarkup}<span>${escapeHTML(label)}</span>${hiddenLabel ? `<span class="sr-only">${escapeHTML(hiddenLabel)}</span>` : ""}</span>`;
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

  function hasSocialValue(source, key) {
    return !!source && typeof source === "object" && source.socials && typeof source.socials === "object" && Object.prototype.hasOwnProperty.call(source.socials, key);
  }

  function readUserSocialLink(source, key) {
    if (!source || typeof source !== "object") {
      return "";
    }

    if (hasSocialValue(source, key)) {
      return String(source.socials[key] || "").trim();
    }

    if (key === "instagram" && hasOwnValue(source, "socialInstagram")) {
      return String(source.socialInstagram || "").trim();
    }

    if (key === "youtube") {
      if (hasOwnValue(source, "socialYouTube")) {
        return String(source.socialYouTube || "").trim();
      }

      if (hasOwnValue(source, "website")) {
        return String(source.website || "").trim();
      }
    }

    return "";
  }

  function renderProfileSocials(node, socialLinks) {
    if (!node) {
      return;
    }

    const instagram = normalizeExternalUrl(socialLinks && socialLinks.instagram, "instagram");
    const youtube = normalizeExternalUrl(socialLinks && socialLinks.youtube, "youtube");
    const items = [];

    if (instagram) {
      items.push(`<a class="author-social-link" href="${escapeHTML(instagram)}" target="_blank" rel="noreferrer noopener" aria-label="Instagram">${instagramIconMarkup()}</a>`);
    }

    if (youtube) {
      items.push(`<a class="author-social-link" href="${escapeHTML(youtube)}" target="_blank" rel="noreferrer noopener" aria-label="YouTube">${youtubeIconMarkup()}</a>`);
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
    const main = document.querySelector(".reader-main");
    if (!main) {
      return null;
    }

    let node = document.getElementById("readerPageStatus");
    if (!node) {
      node = document.createElement("section");
      node.id = "readerPageStatus";
      node.className = "page-status hidden";
      main.prepend(node);
    }

    return node;
  }

  function clearPageStatus() {
    const node = document.getElementById("readerPageStatus");
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
    const main = document.querySelector(".reader-main");
    if (!main) {
      return;
    }

    let card = document.getElementById("readerLoadingCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "readerLoadingCard";
      card.className = "hero-card loading-card";
      main.prepend(card);
    }

    card.innerHTML = `
      <h1 class="section-title">${escapeHTML(title || "Loading reader experience...")}</h1>
      <p class="loading-copy">${escapeHTML(detail || "Fetching stories, progress, and your latest activity.")}</p>
    `;
  }

  function clearMainLoading() {
    const card = document.getElementById("readerLoadingCard");
    if (card) {
      card.remove();
    }
  }

  function getState(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function setState(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function numberLabel(value) {
    return Number(value || 0).toLocaleString();
  }

  function titleCase(value) {
    return String(value || "")
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "General";
  }

  function toDateLabel(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Recently"
      : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function collectionVisibilityLabel(collection) {
    return collection && collection.isPublic ? "Public Board" : "Private Board";
  }

  function paragraphs(value) {
    const text = String(value || "").replace(/\r/g, "").trim();
    if (!text) {
      return ["Story content is not available."];
    }
    const list = text
      .split(/\n{2,}/)
      .map((line) => line.replace(/\n+/g, " ").trim())
      .filter(Boolean);
    return list.length ? list : [text];
  }

  function stripHtml(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function contentLooksLikeHTML(value) {
    return /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
  }

  function plainTextToHTML(value) {
    return paragraphs(value)
      .map((line) => `<p>${escapeHTML(line)}</p>`)
      .join("");
  }

  function sanitizeRichTextNode(node) {
    if (!node) {
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const tag = String(node.tagName || "").toLowerCase();
    if (["embed", "iframe", "object", "script", "style"].includes(tag)) {
      return null;
    }
    const safeChildren = Array.from(node.childNodes || [])
      .map((child) => sanitizeRichTextNode(child))
      .filter(Boolean);

    if (!ALLOWED_RICH_TEXT_TAGS.has(tag)) {
      const fragment = document.createDocumentFragment();
      safeChildren.forEach((child) => fragment.appendChild(child));
      return fragment;
    }

    const element = document.createElement(tag);
    const alignValue = String(node.getAttribute("align") || "").trim().toLowerCase();
    const inlineStyle = String(node.getAttribute("style") || "");
    const styleMatch = inlineStyle.match(/text-align\s*:\s*(left|center|right|justify)\b/i);
    const safeAlign = ["left", "center", "right", "justify"].includes(alignValue)
      ? alignValue
      : (styleMatch ? String(styleMatch[1] || "").trim().toLowerCase() : "");

    if (tag === "a") {
      const href = String(node.getAttribute("href") || "").trim();
      if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) {
        element.setAttribute("href", href);
        if (!href.startsWith("#") && !href.startsWith("/")) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      }
    }

    if (safeAlign && ["blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6", "p", "pre"].includes(tag)) {
      element.style.textAlign = safeAlign;
    }

    safeChildren.forEach((child) => element.appendChild(child));
    return element;
  }

  function normalizeChapterContent(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "<p>Story content is not available.</p>";
    }

    if (!contentLooksLikeHTML(raw)) {
      return plainTextToHTML(raw);
    }

    const template = document.createElement("template");
    template.innerHTML = raw;
    const container = document.createElement("div");
    Array.from(template.content.childNodes || []).forEach((node) => {
      const safeNode = sanitizeRichTextNode(node);
      if (safeNode) {
        container.appendChild(safeNode);
      }
    });

    const sanitized = container.innerHTML.trim();
    return sanitized || "<p>Story content is not available.</p>";
  }

  function chapterSectionCount(content) {
    const html = normalizeChapterContent(content);
    const template = document.createElement("template");
    template.innerHTML = html;

    const blockCount = Array.from(template.content.querySelectorAll(Array.from(SECTION_TAGS).join(",")))
      .filter((node) => stripHtml(node.innerHTML || node.textContent || "")).length;

    return Math.max(1, blockCount || (stripHtml(html) ? 1 : 0));
  }

  function setKeys(email) {
    const scope = normalize(email || "reader") || "reader";
    state.keys = {
      library: `${BASE.library}_${scope}`,
      liked: `${BASE.liked}_${scope}`,
      follow: `${BASE.follow}_${scope}`,
      notify: `${BASE.notify}_${scope}`,
      authorNotify: `${BASE.authorNotify}_${scope}`,
      recent: `${BASE.recent}_${scope}`,
      progress: `${BASE.progress}_${scope}`,
      comments: `${BASE.comments}_${scope}`
    };
  }

  function normalizeReaderState(value) {
    const data = value && typeof value === "object" ? value : {};
    const currentReadStoryIds = Array.isArray(data.currentReadStoryIds)
      ? [...new Set(data.currentReadStoryIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : Array.isArray(data.savedStoryIds)
        ? [...new Set(data.savedStoryIds.map((id) => String(id || "").trim()).filter(Boolean))]
        : [];

    return {
      likedChapterIds: Array.isArray(data.likedChapterIds) ? [...new Set(data.likedChapterIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
      likedStoryIds: Array.isArray(data.likedStoryIds) ? [...new Set(data.likedStoryIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
      savedStoryIds: currentReadStoryIds,
      currentReadStoryIds,
      completedStoryIds: Array.isArray(data.completedStoryIds) ? [...new Set(data.completedStoryIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
      collectionLists: Array.isArray(data.collectionLists)
        ? data.collectionLists
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: String(item.id || "").trim(),
            name: String(item.name || "Untitled Collection").trim() || "Untitled Collection",
            systemKey: String(item.systemKey || "").trim() || null,
            isSystem: !!item.isSystem,
            isPublic: !!item.isPublic,
            storyIds: Array.isArray(item.storyIds) ? [...new Set(item.storyIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
            createdAt: String(item.createdAt || "").trim(),
            updatedAt: String(item.updatedAt || "").trim()
          }))
        : [],
      followedAuthorIds: Array.isArray(data.followedAuthorIds) ? [...new Set(data.followedAuthorIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
      subscribedStoryIds: Array.isArray(data.subscribedStoryIds) ? [...new Set(data.subscribedStoryIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
      subscribedAuthorIds: Array.isArray(data.subscribedAuthorIds) ? [...new Set(data.subscribedAuthorIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
      progress: data.progress && typeof data.progress === "object" ? { ...data.progress } : {}
    };
  }

  function setReaderState(value) {
    state.readerState = normalizeReaderState(value);
  }

  function mirrorReaderStateToLocal() {
    if (!state.keys.liked) {
      return;
    }

    setState(state.keys.liked, state.readerState.likedChapterIds);
    setState(state.keys.library, state.readerState.savedStoryIds);
    setState(state.keys.follow, state.readerState.followedAuthorIds);
    setState(state.keys.notify, state.readerState.subscribedStoryIds);
    setState(state.keys.authorNotify, state.readerState.subscribedAuthorIds);
    setState(state.keys.progress, state.readerState.progress);
  }

  function likedChapterIds() {
    return new Set(state.readerState.likedChapterIds);
  }

  function likedStoryIds() {
    return new Set(state.readerState.likedStoryIds);
  }

  function savedStoryIds() {
    return new Set(state.readerState.savedStoryIds);
  }

  function completedStoryIds() {
    return new Set(state.readerState.completedStoryIds);
  }

  function collectionListsState() {
    return Array.isArray(state.readerState.collectionLists) ? state.readerState.collectionLists : [];
  }

  function followedAuthorIds() {
    return new Set(state.readerState.followedAuthorIds);
  }

  function subscribedStoryIds() {
    return new Set(state.readerState.subscribedStoryIds);
  }

  function subscribedAuthorIds() {
    return new Set(state.readerState.subscribedAuthorIds);
  }

  function progressState() {
    return state.readerState.progress && typeof state.readerState.progress === "object"
      ? state.readerState.progress
      : {};
  }

  function updateStoryMetrics(storyId, patch) {
    const story = storyById(storyId);
    if (!story || !patch || typeof patch !== "object") {
      return;
    }

    if (patch.likes !== undefined || patch.storyLikes !== undefined) {
      story.likes = Number(patch.storyLikes !== undefined ? patch.storyLikes : patch.likes || 0);
    }

    if (patch.reads !== undefined) {
      story.reads = Number(patch.reads || 0);
    }
  }

  async function loadReaderState() {
    setReaderState(await api.getReaderState());
    mirrorReaderStateToLocal();
  }

  function authorGradient(color) {
    return `linear-gradient(145deg, ${color || "#7C7CFF"}, #0F172A)`;
  }

  function displayName(user) {
    const email = String(user && user.email || "").trim();
    const shown = String(user && user.displayName || "").trim();
    const username = String(user && user.username || "").trim();
    return shown || username || (email ? email.split("@")[0] : "Author");
  }

  function hasOwnValue(source, key) {
    return !!source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, key);
  }

  function usernameValue(user, fallback) {
    const explicit = normalize(user && user.username);
    if (explicit) {
      return explicit;
    }
    const derived = normalize(displayName(user)).replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, "");
    return derived || normalize(fallback || "author") || "author";
  }

  function ensureGenre(id, label) {
    const key = normalize(id || "general") || "general";
    if (state.genreMap.has(key)) {
      return state.genreMap.get(key);
    }
    const genre = {
      id: key,
      label: String(label || titleCase(key)).trim() || titleCase(key),
      icon: ICONS[state.genreMap.size % ICONS.length]
    };
    state.genreMap.set(key, genre);
    state.genres.push(genre);
    return genre;
  }

  function ensureAuthor(user) {
    const id = String(user && (user.id || user.authorId) || "").trim();
    if (!id) {
      return null;
    }
    const existing = state.authorMap.get(id);
    const color = hasOwnValue(user, "avatarColor")
      ? String(user.avatarColor || "").trim() || "#7C7CFF"
      : String(existing && existing.avatarColor || "").trim() || "#7C7CFF";
    const author = existing || {};
    const mergedIdentity = user && typeof user === "object"
      ? {
        ...author,
        ...user,
        id
      }
      : author;
    author.id = id;
    author.email = hasOwnValue(user, "email") ? String(user.email || "").trim() : String(author.email || "").trim();
    author.name = displayName(mergedIdentity);
    author.username = usernameValue(mergedIdentity, id);
    author.bio = hasOwnValue(user, "bio") ? String(user.bio || "").trim() : String(author.bio || "").trim();
    author.avatarColor = color;
    author.avatarUrl = hasOwnValue(user, "avatarUrl") ? String(user.avatarUrl || "").trim() : String(author.avatarUrl || "").trim();
    author.coverPhotoUrl = hasOwnValue(user, "coverPhotoUrl") ? String(user.coverPhotoUrl || "").trim() : String(author.coverPhotoUrl || "").trim();
    const existingSocials = author.socials && typeof author.socials === "object" ? author.socials : {};
    author.socials = {
      instagram: hasSocialValue(user, "instagram") || hasOwnValue(user, "socialInstagram")
        ? readUserSocialLink(user, "instagram")
        : String(existingSocials.instagram || "").trim(),
      youtube: hasSocialValue(user, "youtube") || hasOwnValue(user, "socialYouTube") || hasOwnValue(user, "website")
        ? readUserSocialLink(user, "youtube")
        : String(existingSocials.youtube || "").trim()
    };
    author.followersCount = hasOwnValue(user, "followersCount")
      ? Number(user.followersCount ?? 0)
      : Number(author.followersCount ?? 0);
    author.photoGradient = authorGradient(color);
    if (!existing) {
      state.authorMap.set(id, author);
      state.authors.push(author);
    }
    return author;
  }

  function coverStyle(story) {
    const cover = String(story && story.cover || "").trim();
    if (/^url\(/i.test(cover)) {
      return `background:${cover};`;
    }
    if (/^(https?:|data:|\/)/i.test(cover)) {
      return `background-image:url("${cover.replace(/"/g, "%22")}");background-size:cover;background-position:center;`;
    }
    if (cover && (cover.includes("gradient(") || cover.startsWith("#") || cover.startsWith("rgb"))) {
      return `background:${cover};`;
    }
    const author = story ? state.authorMap.get(story.authorId) : null;
    return `background:${authorGradient(author && author.avatarColor)};`;
  }

  function authorCoverStyle(author, stories = []) {
    const explicitCover = String(author && author.coverPhotoUrl || "").trim();
    if (/^url\(/i.test(explicitCover)) {
      return `background:${explicitCover};`;
    }
    if (/^(https?:|data:|\/)/i.test(explicitCover)) {
      return `background-image:url("${explicitCover.replace(/"/g, "%22")}");background-size:cover;background-position:center;`;
    }

    const featuredStory = Array.isArray(stories)
      ? stories.find((item) => {
        const cover = String(item && item.cover || "").trim();
        return /^url\(/i.test(cover) || /^(https?:|data:|\/)/i.test(cover);
      })
      : null;

    if (featuredStory) {
      return coverStyle(featuredStory);
    }

    const accent = String(author && author.avatarColor || "").trim() || "#7C7CFF";
    return `background:
      radial-gradient(circle at 18% 18%, rgba(255,255,255,0.22), transparent 24%),
      radial-gradient(circle at 82% 24%, rgba(245,158,11,0.18), transparent 28%),
      linear-gradient(120deg, ${accent} 0%, #172033 55%, #0f172a 100%);`;
  }

  function storyGenre(story) {
    return state.genreMap.get(normalize(story && story.genre || "general")) || ensureGenre("general", "General");
  }

  function storyById(id) {
    return state.storyMap.get(String(id || "").trim()) || null;
  }

  function chapterById(id) {
    return state.chapterMap.get(String(id || "").trim()) || null;
  }

  function authorById(id) {
    return state.authorMap.get(String(id || "").trim()) || null;
  }

  function currentAuthor() {
    return state.session && state.session.user ? ensureAuthor(state.session.user) : null;
  }

  function isOwnAuthor(author) {
    const current = currentAuthor();
    return !!(author && current && author.id === current.id);
  }

  async function loadData() {
    const fallbackGenres = Array.isArray(window.READER_DATA && window.READER_DATA.genres) ? window.READER_DATA.genres : [];
    fallbackGenres.forEach((genre) => {
      const item = ensureGenre(genre && genre.id, genre && genre.label);
      if (genre && genre.icon) {
        item.icon = genre.icon;
      }
    });
    ensureAuthor(state.session && state.session.user);

    const stories = await api.listStories({}, { auth: "none" });
    state.chapters = [];
    state.stories = stories.map((story) => {
      const author = ensureAuthor({ ...(story.author || {}), id: story.authorId || story.author && story.author.id });
      const genre = ensureGenre(story.genre, story.genreName);
      const chapters = Array.isArray(story.chapters) ? story.chapters : [];
      const mappedChapters = chapters.map((chapter, index) => ({
        id: chapter.id || `${story.id}-chapter-${index + 1}`,
        storyId: story.id,
        title: chapter.title || `Chapter ${index + 1}`,
        content: normalizeChapterContent(chapter.content),
        sectionCount: chapterSectionCount(chapter.content),
        position: Number(chapter.position || index + 1),
        likes: Number(chapter.likes || 0),
        comments: Number(chapter.comments || 0)
      }));
      state.chapters.push(...mappedChapters);
      return {
        id: story.id,
        title: story.title || "Untitled Story",
        summary: String(story.summary || story.content || "").trim(),
        genre: genre.id,
        authorId: author ? author.id : String(story.authorId || "").trim(),
        cover: story.coverUrl || story.cover || "",
        likes: Number(story.likes || 0),
        comments: Number(story.comments || 0),
        reads: Number(story.reads || 0),
        readingMinutes: Number(story.readingMinutes || 0) || Math.max(1, Math.ceil(Number(story.wordCount || 0) / 200)) || 1,
        publishedAt: story.publishedAt || story.updatedAt || story.createdAt || "",
        updatedAt: story.updatedAt || story.createdAt || "",
        chapters: mappedChapters
      };
    }).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    state.storyMap = new Map(state.stories.map((story) => [story.id, story]));
    state.chapterMap = new Map(state.chapters.map((chapter) => [chapter.id, chapter]));
  }

  async function syncLegacyReaderState() {
    const remoteLikedChapters = likedChapterIds();
    const remoteLikedStories = likedStoryIds();
    const remoteSaved = savedStoryIds();
    const remoteSubscribed = subscribedStoryIds();
    const remoteAuthorSubscribed = subscribedAuthorIds();
    const remoteProgress = progressState();
    const localLiked = Array.isArray(getState(state.keys.liked, [])) ? getState(state.keys.liked, []) : [];
    const localSaved = Array.isArray(getState(state.keys.library, [])) ? getState(state.keys.library, []) : [];
    const localNotify = Array.isArray(getState(state.keys.notify, [])) ? getState(state.keys.notify, []) : [];
    const localAuthorNotify = Array.isArray(getState(state.keys.authorNotify, [])) ? getState(state.keys.authorNotify, []) : [];
    const localProgress = getState(state.keys.progress, {});
    let changed = false;

    for (const likedId of localLiked) {
      const chapter = chapterById(likedId);
      const story = chapter ? storyById(chapter.storyId) : storyById(likedId);
      const targetChapter = chapter || (story ? chaptersFor(story)[0] : null);
      if (!targetChapter || remoteLikedChapters.has(targetChapter.id) || (story && remoteLikedStories.has(story.id))) {
        continue;
      }
      try {
        const result = await api.likeChapter(targetChapter.id);
        remoteLikedChapters.add(targetChapter.id);
        if (story) {
          remoteLikedStories.add(story.id);
          updateStoryMetrics(story.id, result);
        }
        changed = true;
      } catch (error) {
        // Keep going so one bad local record does not block the rest.
      }
    }

    for (const storyId of localSaved) {
      if (!storyById(storyId) || remoteSaved.has(storyId)) {
        continue;
      }
      try {
        await api.saveStory(storyId);
        remoteSaved.add(storyId);
        changed = true;
      } catch (error) {
        // Keep going so one bad local record does not block the rest.
      }
    }

    for (const [storyId, meta] of Object.entries(localProgress && typeof localProgress === "object" ? localProgress : {})) {
      if (!storyById(storyId) || !meta || typeof meta !== "object") {
        continue;
      }

      const localPercent = Number(meta.percent || 0);
      const remotePercent = Number(remoteProgress[storyId] && remoteProgress[storyId].percent || 0);
      if (localPercent <= remotePercent) {
        continue;
      }

      try {
        const result = await api.updateReadingProgress(storyId, {
          percent: localPercent,
          chapterPosition: meta.chapterPosition || null
        });
        remoteProgress[storyId] = result.progress;
        updateStoryMetrics(storyId, result);
        changed = true;
      } catch (error) {
        // Keep going so one bad local record does not block the rest.
      }
    }

    const localFollow = Array.isArray(getState(state.keys.follow, [])) ? getState(state.keys.follow, []) : [];
    const remoteFollow = followedAuthorIds();
    for (const authorId of localFollow) {
      if (!authorById(authorId) || remoteFollow.has(authorId)) {
        continue;
      }

      try {
        await api.followAuthor(authorId);
        remoteFollow.add(authorId);
        changed = true;
      } catch (error) {
        // Keep going so one bad local record does not block the rest.
      }
    }

    for (const storyId of localNotify) {
      const story = storyById(storyId);
      if (!story || remoteSubscribed.has(storyId) || String(story.authorId || "").trim() === String(state.session && state.session.user && state.session.user.id || "").trim()) {
        continue;
      }

      try {
        await api.subscribeStoryUpdates(storyId);
        remoteSubscribed.add(storyId);
        changed = true;
      } catch (error) {
        // Keep going so one bad local record does not block the rest.
      }
    }

    for (const authorId of localAuthorNotify) {
      const author = authorById(authorId);
      if (!author || remoteAuthorSubscribed.has(authorId) || isOwnAuthor(author)) {
        continue;
      }

      try {
        await api.subscribeAuthorUpdates(authorId);
        remoteAuthorSubscribed.add(authorId);
        changed = true;
      } catch (error) {
        // Keep going so one bad local record does not block the rest.
      }
    }

    if (changed) {
      setReaderState({
        ...state.readerState,
        likedChapterIds: [...remoteLikedChapters],
        likedStoryIds: [...remoteLikedStories],
        savedStoryIds: [...remoteSaved],
        currentReadStoryIds: [...remoteSaved],
        followedAuthorIds: [...remoteFollow],
        subscribedStoryIds: [...remoteSubscribed],
        subscribedAuthorIds: [...remoteAuthorSubscribed],
        progress: remoteProgress
      });
      mirrorReaderStateToLocal();
    }
  }

  function likesCount(story) {
    return Number(story && story.likes || 0);
  }

  function readsCount(story) {
    return Number(story && story.reads || 0);
  }

  function membershipCount(prefix, itemId) {
    if (!itemId) {
      return 0;
    }
    const members = new Set();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) {
        continue;
      }
      const list = getState(key, []);
      if (Array.isArray(list) && list.includes(itemId)) {
        members.add(key.slice(prefix.length));
      }
    }
    return members.size;
  }

  function feedbackList(chapterId) {
    const comments = [];
    const prefix = `${BASE.comments}_`;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) {
        continue;
      }
      const map = getState(key, {});
      if (map && Array.isArray(map[chapterId])) {
        comments.push(...map[chapterId]);
      }
    }
    return comments.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  }

  function pushRecent(storyId) {
    const recent = getState(state.keys.recent, []);
    const next = (Array.isArray(recent) ? recent : []).filter((id) => id !== storyId);
    next.unshift(storyId);
    setState(state.keys.recent, next.slice(0, 30));
  }

  function setRemoteProgress(storyId, progress) {
    state.readerState.progress = {
      ...progressState(),
      [storyId]: progress
    };
    mirrorReaderStateToLocal();
  }

  function scheduleProgressSync(storyId, payload, onSuccess) {
    const existing = state.progressSyncTimers.get(storyId);
    if (existing) {
      window.clearTimeout(existing);
    }

    const timer = window.setTimeout(async () => {
      try {
        const result = await api.updateReadingProgress(storyId, payload);
        setRemoteProgress(storyId, result.progress);
        updateStoryMetrics(storyId, result);
        if (result && (result.completed || Number(result.progress && result.progress.percent || 0) >= 100)) {
          loadReaderState().catch(() => {
            // Keep completion sync non-blocking.
          });
        }
        if (typeof onSuccess === "function") {
          onSuccess(result);
        }
      } catch (error) {
        // Keep UI responsive even if background sync fails.
      } finally {
        state.progressSyncTimers.delete(storyId);
      }
    }, 400);

    state.progressSyncTimers.set(storyId, timer);
  }

  function chaptersFor(story) {
    if (Array.isArray(story && story.chapters) && story.chapters.length) {
      return story.chapters;
    }
    return [{
      id: `${story && story.id || "story"}-chapter-1`,
      storyId: story && story.id || "",
      title: "Chapter 1",
      content: normalizeChapterContent(story && story.summary),
      sectionCount: chapterSectionCount(story && story.summary),
      position: 1,
      likes: 0,
      comments: 0
    }];
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

  function openStory(id) {
    pushRecent(id);
    window.location.href = `story.html?id=${encodeURIComponent(id)}`;
  }

  function openAuthor(author) {
    if (author && author.id) {
      window.location.href = `profile.html?authorId=${encodeURIComponent(author.id)}`;
    }
  }

  function openChapter(storyId, chapterNumber) {
    const url = `chapter.html?id=${encodeURIComponent(storyId)}&chapter=${encodeURIComponent(chapterNumber)}`;
    const opened = window.open(url, "_blank");
    if (!opened) {
      window.location.href = url;
    }
  }

  function quickMenuIconMarkup() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8"></circle>
        <circle cx="12" cy="12" r="1.8"></circle>
        <circle cx="19" cy="12" r="1.8"></circle>
      </svg>
    `;
  }

  function attachExploreQuickActions(card, story) {
    if (!card || page !== "explore") {
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "story-card-menu-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "story-card-menu-btn";
    button.setAttribute("aria-label", `More actions for ${story.title}`);
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = quickMenuIconMarkup();

    const menu = document.createElement("div");
    menu.className = "story-card-quick-menu hidden";

    const customCollections = () => collectionListsState().filter((item) => !item.isSystem);

    const closeMenu = () => {
      menu.classList.add("hidden");
      wrap.classList.remove("open");
      card.classList.remove("story-card-menu-active");
      button.setAttribute("aria-expanded", "false");
      menu.querySelectorAll(".story-card-collection-wrap.open").forEach((node) => {
        node.classList.remove("open");
      });
    };

    const renderMenu = () => {
      const library = savedStoryIds();
      const lists = customCollections();
      const inLibrary = library.has(story.id);

      menu.innerHTML = "";

      const libraryBtn = document.createElement("button");
      libraryBtn.type = "button";
      libraryBtn.className = `menu-item${inLibrary ? " primary" : ""}`;
      libraryBtn.textContent = inLibrary ? "Remove from Library" : "Library";
      libraryBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        libraryBtn.disabled = true;
        try {
          if (inLibrary) {
            await api.unsaveStory(story.id);
            showPageStatus(`Removed "${story.title}" from Library.`, "success");
          } else {
            await api.saveStory(story.id);
            showPageStatus(`Added "${story.title}" to Library.`, "success");
          }
          await loadReaderState();
          renderMenu();
          closeMenu();
        } catch (error) {
          libraryBtn.disabled = false;
          showPageStatus(api.getErrorMessage(error, "Library update failed."), "error");
        }
      });
      menu.appendChild(libraryBtn);

      const collectionWrap = document.createElement("div");
      collectionWrap.className = "story-card-collection-wrap";

      const collectionTrigger = document.createElement("button");
      collectionTrigger.type = "button";
      collectionTrigger.className = "menu-item story-card-submenu-trigger";
      collectionTrigger.innerHTML = `<span>Add to Collection</span><span class="story-card-submenu-arrow">></span>`;
      collectionWrap.appendChild(collectionTrigger);

      const submenu = document.createElement("div");
      submenu.className = "story-card-submenu";

      const positionSubmenu = () => {
        collectionWrap.classList.remove("open-right", "open-up");
        submenu.style.maxWidth = "";

        const computedDisplay = window.getComputedStyle(submenu).display;
        const wasHidden = computedDisplay === "none";
        const previousDisplay = submenu.style.display;
        const previousVisibility = submenu.style.visibility;

        if (wasHidden) {
          submenu.style.visibility = "hidden";
          submenu.style.display = "grid";
        }

        const wrapRect = collectionWrap.getBoundingClientRect();
        const submenuRect = submenu.getBoundingClientRect();
        const viewportPadding = 12;
        const spaceLeft = Math.max(0, wrapRect.left - viewportPadding);
        const spaceRight = Math.max(0, window.innerWidth - wrapRect.right - viewportPadding);
        const spaceBelow = Math.max(0, window.innerHeight - wrapRect.top - viewportPadding);
        const spaceAbove = Math.max(0, wrapRect.bottom - viewportPadding);
        const openRight = spaceLeft < submenuRect.width && spaceRight > spaceLeft;
        const activeWidth = Math.max(140, Math.floor(openRight ? spaceRight : spaceLeft));

        if (openRight) {
          collectionWrap.classList.add("open-right");
        }

        if (submenuRect.height > spaceBelow && spaceAbove > spaceBelow) {
          collectionWrap.classList.add("open-up");
        }

        submenu.style.maxWidth = `${activeWidth}px`;

        if (wasHidden) {
          submenu.style.display = previousDisplay;
          submenu.style.visibility = previousVisibility;
        }
      };

      collectionTrigger.addEventListener("click", (event) => {
        event.stopPropagation();
        positionSubmenu();
        collectionWrap.classList.toggle("open");
      });
      collectionTrigger.addEventListener("mouseenter", positionSubmenu);
      collectionTrigger.addEventListener("focus", positionSubmenu);
      collectionWrap.addEventListener("mouseenter", positionSubmenu);
      collectionWrap.addEventListener("focusin", positionSubmenu);

      if (!lists.length) {
        const note = document.createElement("p");
        note.className = "story-action-note";
        note.textContent = "No collection category yet.";
        submenu.appendChild(note);

        const openCollections = document.createElement("button");
        openCollections.type = "button";
        openCollections.className = "menu-item";
        openCollections.textContent = "Open Collection";
        openCollections.addEventListener("click", (event) => {
          event.stopPropagation();
          window.location.href = "collection.html";
        });
        submenu.appendChild(openCollections);
      } else {
        lists.forEach((collection) => {
          const exists = Array.isArray(collection.storyIds) && collection.storyIds.includes(story.id);
          const itemBtn = document.createElement("button");
          itemBtn.type = "button";
          itemBtn.className = `menu-item${exists ? " primary" : ""}`;
          itemBtn.textContent = exists ? `Remove from ${collection.name}` : collection.name;
          itemBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            itemBtn.disabled = true;
            try {
              if (exists) {
                await api.removeStoryFromCollection(collection.id, story.id);
                showPageStatus(`Removed "${story.title}" from ${collection.name}.`, "success");
              } else {
                await api.addStoryToCollection(collection.id, story.id);
                showPageStatus(`Added "${story.title}" to ${collection.name}.`, "success");
              }
              await loadReaderState();
              renderMenu();
              closeMenu();
            } catch (error) {
              itemBtn.disabled = false;
              showPageStatus(api.getErrorMessage(error, "Collection update failed."), "error");
            }
          });
          submenu.appendChild(itemBtn);
        });
      }

      collectionWrap.appendChild(submenu);
      menu.appendChild(collectionWrap);
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = menu.classList.contains("hidden");
      document.querySelectorAll(".story-card-menu-wrap.open").forEach((node) => {
        if (node !== wrap) {
          node.classList.remove("open");
          const parentCard = node.closest(".story-card");
          if (parentCard) {
            parentCard.classList.remove("story-card-menu-active");
          }
          const otherMenu = node.querySelector(".story-card-quick-menu");
          const otherButton = node.querySelector(".story-card-menu-btn");
          if (otherMenu) {
            otherMenu.classList.add("hidden");
          }
          if (otherButton) {
            otherButton.setAttribute("aria-expanded", "false");
          }
          node.querySelectorAll(".story-card-collection-wrap.open").forEach((item) => {
            item.classList.remove("open");
          });
        }
      });

      if (opening) {
        renderMenu();
        wrap.classList.add("open");
        card.classList.add("story-card-menu-active");
        menu.classList.remove("hidden");
        button.setAttribute("aria-expanded", "true");
      } else {
        closeMenu();
      }
    });

    wrap.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) {
        closeMenu();
      }
    });

    wrap.append(button, menu);
    card.appendChild(wrap);
  }

  function storyCard(story, progress) {
    const author = authorById(story.authorId);
    const card = document.createElement("article");
    card.className = "story-card";
    card.innerHTML = `
      <div class="story-cover" style="${escapeHTML(coverStyle(story))}">
        <span>${escapeHTML(storyGenre(story).label)}</span>
      </div>
      <div class="story-body">
        <h3 class="story-title">${escapeHTML(story.title)}</h3>
        <div class="story-meta">
          <span class="author-link story-author" data-author="1">${escapeHTML(author ? author.name : "Unknown")}</span>
          <div class="story-stats-inline">
            ${metricChipMarkup(eyeIconMarkup(), numberLabel(readsCount(story)), "", `${numberLabel(readsCount(story))} reads`)}
            ${metricChipMarkup(commentIconMarkup(), numberLabel(Number(story.comments || 0)), "", `${numberLabel(Number(story.comments || 0))} comments`)}
            ${metricChipMarkup(heartIconMarkup(), numberLabel(likesCount(story)), "", `${numberLabel(likesCount(story))} votes`)}
            ${progress ? metricChipMarkup(stackIconMarkup(), `${String(progress.percent || 0)}% complete`) : ""}
          </div>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openStory(story.id));
    const authorLink = card.querySelector("[data-author]");
    if (authorLink && author) {
      authorLink.addEventListener("click", (event) => {
        event.stopPropagation();
        openAuthor(author);
      });
    }
    attachExploreQuickActions(card, story);
    return card;
  }

  function initHeader() {
    const searchForm = document.getElementById("globalSearchForm");
    const searchInput = document.getElementById("globalSearchInput");
    const headerLinks = document.querySelector(".header-links");
    const headerProfile = document.querySelector(".header-profile");
    const profileBtn = document.getElementById("headerProfileBtn");
    const profileMenu = document.getElementById("headerProfileMenu");
    const logoutBtn = document.getElementById("headerLogoutBtn");
    const profileLink = document.getElementById("headerProfileLink");
    let settingsLink = document.getElementById("headerSettingsLink");
    const userLine = document.getElementById("headerUserLine");
    let collectionNavLink = document.getElementById("readerCollectionNav") || (headerLinks ? headerLinks.querySelector('[data-nav="collection"]') : null);
    let writerModeBtn = document.getElementById("readerWriterModeBtn");

    let bell = document.getElementById("readerNotificationBell");
    let bellBadge = document.getElementById("readerNotificationBellCount");
    let bellWrap = document.getElementById("readerNotificationWrap");
    let bellPanel = document.getElementById("readerNotificationPanel");
    let bellList = document.getElementById("readerNotificationPanelList");
    let bellMarkAll = document.getElementById("readerNotificationPanelMarkAll");
    let bellItems = [];

    if (headerProfile && profileBtn && !bell) {
      bellWrap = document.createElement("div");
      bellWrap.id = "readerNotificationWrap";
      bellWrap.className = "notification-wrap";

      bell = document.createElement("button");
      bell.id = "readerNotificationBell";
      bell.className = "notification-link";
      bell.type = "button";
      bell.setAttribute("aria-label", "Notifications");
      bell.setAttribute("aria-expanded", "false");
      bell.setAttribute("aria-controls", "readerNotificationPanel");
      bell.innerHTML = `${bellIconMarkup()}<span id="readerNotificationBellCount" class="notification-badge hidden"></span>`;

      bellPanel = document.createElement("div");
      bellPanel.id = "readerNotificationPanel";
      bellPanel.className = "notification-panel";
      bellPanel.innerHTML = `
        <div class="notification-panel-head">
          <div>
            <h3 class="notification-panel-title">Notifications</h3>
            <p class="notification-panel-copy">Updates, follows, and comments.</p>
          </div>
          <button id="readerNotificationPanelMarkAll" class="notification-panel-action" type="button">Mark all read</button>
        </div>
        <div id="readerNotificationPanelList" class="notification-panel-list"></div>
      `;

      bellWrap.append(bell, bellPanel);
      headerProfile.insertBefore(bellWrap, profileBtn);
      bellBadge = bell.querySelector(".notification-badge");
      bellList = bellPanel.querySelector("#readerNotificationPanelList");
      bellMarkAll = bellPanel.querySelector("#readerNotificationPanelMarkAll");
    }

    const renderBellNotifications = () => {
      if (!bellList) {
        return;
      }

      bellList.innerHTML = "";
      if (!bellItems.length) {
        bellList.innerHTML = '<div class="notification-panel-empty">No notifications yet.</div>';
      } else {
        const actorLabel = (item) => {
          const actor = item && item.actor ? (item.actor.displayName || item.actor.username || item.actor.email) : "";
          return String(actor || "").trim();
        };

        bellItems.forEach((item) => {
          const article = document.createElement("article");
          article.className = `notify-item notification-panel-item ${item && item.unread ? "unread" : ""}`.trim();
          const actor = actorLabel(item);
          const detail = actor && item.story
            ? `${actor} | ${item.story.title}`
            : actor || (item.story && item.story.title) || "Midnight";
          article.innerHTML = `
            <div>${escapeHTML(item && item.text || "New notification")}</div>
            <div class="notify-time">${escapeHTML(detail)} | ${escapeHTML(toDateLabel(item && item.createdAt))}</div>
          `;

          if (item && item.story && item.story.id) {
            article.classList.add("is-clickable");
            article.addEventListener("click", () => {
              if (bellPanel) {
                bellPanel.classList.remove("open");
              }
              if (bell) {
                bell.classList.remove("active");
                bell.setAttribute("aria-expanded", "false");
              }
              openStory(item.story.id);
            });
          }

          bellList.appendChild(article);
        });
      }

      if (bellMarkAll) {
        bellMarkAll.disabled = !bellItems.some((item) => item && item.unread);
      }
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

    const loadBellNotifications = async (force = false) => {
      if (!bellList) {
        return;
      }

      if (!force && bellItems.length) {
        renderBellNotifications();
        setNotificationBadge(bellBadge, bellItems.filter((item) => item && item.unread).length);
        return;
      }

      bellList.innerHTML = '<div class="notification-panel-empty">Loading notifications...</div>';
      try {
        bellItems = await api.listNotifications();
        setNotificationBadge(bellBadge, bellItems.filter((item) => item && item.unread).length);
        renderBellNotifications();
      } catch (error) {
        bellItems = [];
        setNotificationBadge(bellBadge, 0);
        bellList.innerHTML = '<div class="notification-panel-empty">Notifications could not be loaded.</div>';
        if (bellMarkAll) {
          bellMarkAll.disabled = true;
        }
      }
    };

    document.querySelectorAll("[data-nav]").forEach((link) => {
      link.classList.toggle("active", String(link.dataset.nav || "") === page);
    });

    if (searchForm && searchInput) {
      const params = new URLSearchParams(window.location.search);
      if (page === "search") {
        searchInput.value = params.get("q") || "";
      }
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        window.location.href = `search.html?q=${encodeURIComponent(searchInput.value.trim())}`;
      });
    }

    if (profileLink && state.session && state.session.user && state.session.user.id) {
      profileLink.href = `profile.html?authorId=${encodeURIComponent(state.session.user.id)}`;
    }
    if (profileLink) {
      profileLink.textContent = "Profile";
    }
    if (userLine) {
      const sessionUser = state.session && state.session.user ? state.session.user : null;
      const menuUsername = sessionUser ? usernameValue(sessionUser, "reader") : "";
      userLine.textContent = menuUsername ? `@${menuUsername}` : "Reader";
    }

    if (profileMenu) {
      const existingNotificationsLink = document.getElementById("headerNotificationsLink");
      if (existingNotificationsLink) {
        existingNotificationsLink.remove();
      }

      if (collectionNavLink) {
        collectionNavLink.id = "headerCollectionLink";
        collectionNavLink.className = "menu-item";
        collectionNavLink.textContent = "Collection";
        if (!profileMenu.contains(collectionNavLink)) {
          profileMenu.insertBefore(collectionNavLink, logoutBtn || null);
        }
      } else if (!document.getElementById("headerCollectionLink")) {
        collectionNavLink = document.createElement("a");
        collectionNavLink.id = "headerCollectionLink";
        collectionNavLink.className = "menu-item";
        collectionNavLink.href = "collection.html";
        collectionNavLink.dataset.nav = "collection";
        collectionNavLink.textContent = "Collection";
        profileMenu.insertBefore(collectionNavLink, logoutBtn || null);
      }

      const collectionMenuLink = document.getElementById("headerCollectionLink");
      if (collectionMenuLink) {
        collectionMenuLink.classList.toggle("active", page === "collection");
      }

      if (!settingsLink) {
        settingsLink = document.createElement("a");
        settingsLink.id = "headerSettingsLink";
        settingsLink.href = "settings.html";
        settingsLink.textContent = "Settings";
      }
      settingsLink.className = "menu-item";
      if (!profileMenu.contains(settingsLink)) {
        profileMenu.insertBefore(settingsLink, logoutBtn || null);
      }

      if (!writerModeBtn) {
        writerModeBtn = document.createElement("button");
        writerModeBtn.id = "readerWriterModeBtn";
        writerModeBtn.type = "button";
        writerModeBtn.textContent = "Writer Mode";
      }
      writerModeBtn.className = "menu-item";
      if (!profileMenu.contains(writerModeBtn)) {
        profileMenu.appendChild(writerModeBtn);
      }

      const orderedMenuItems = [
        profileLink,
        collectionMenuLink || collectionNavLink,
        writerModeBtn,
        settingsLink,
        logoutBtn
      ].filter(Boolean);

      orderedMenuItems.forEach((node) => {
        profileMenu.appendChild(node);
      });
    }

    if (writerModeBtn && !writerModeBtn.dataset.bound) {
      writerModeBtn.dataset.bound = "true";
      writerModeBtn.addEventListener("click", async () => {
        const defaultLabel = "Writer Mode";
        writerModeBtn.disabled = true;
        writerModeBtn.textContent = "Opening Writer...";

        try {
          await api.ensureUserMode("writer");
          window.location.href = "writer.html";
        } catch (error) {
          writerModeBtn.disabled = false;
          writerModeBtn.textContent = defaultLabel;
          showPageStatus(api.getErrorMessage(error, "Writer mode could not be opened."), "error");
        }
      });
    }

    if (profileBtn && profileMenu) {
      const close = () => {
        profileMenu.classList.remove("open");
        profileBtn.setAttribute("aria-expanded", "false");
      };
      profileBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeNotifications();
        const open = profileMenu.classList.toggle("open");
        profileBtn.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", (event) => {
        if (!profileBtn.contains(event.target) && !profileMenu.contains(event.target)) {
          close();
        }
      });
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          await api.logout();
          window.location.href = "index.html";
        });
      }
    }

    if (bell && bellPanel && !bell.dataset.bound) {
      bell.dataset.bound = "true";
      bell.addEventListener("click", async (event) => {
        event.stopPropagation();
        const opening = !bellPanel.classList.contains("open");
        if (profileMenu) {
          profileMenu.classList.remove("open");
        }
        if (profileBtn) {
          profileBtn.setAttribute("aria-expanded", "false");
        }
        if (opening) {
          bellPanel.classList.add("open");
          bell.classList.add("active");
          bell.setAttribute("aria-expanded", "true");
          await loadBellNotifications(true);
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
        try {
          bellItems = await api.markAllNotificationsRead();
          setNotificationBadge(bellBadge, 0);
          renderBellNotifications();
          showPageStatus("Notifications marked as read.", "success");
        } catch (error) {
          renderBellNotifications();
          showPageStatus(api.getErrorMessage(error, "Notifications update failed."), "error");
        }
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
      loadBellNotifications(true);
    }
  }

  function emptyMain(message) {
    const main = document.querySelector(".reader-main");
    if (main) {
      main.innerHTML = `<section class="hero-card"><h1 class="section-title">Not found</h1><p class="section-sub">${escapeHTML(message)}</p><a class="btn" href="explore.html">Back to Explore</a></section>`;
    }
  }

  async function initPage() {
    if (page === "explore") {
      const trendingGrid = document.getElementById("trendingGrid");
      const latestGrid = document.getElementById("latestGrid");
      const recommendedGrid = document.getElementById("recommendedGrid");
      const genresRow = document.getElementById("genresRow");
      const liked = likedStoryIds();
      const likedGenres = new Set(state.stories.filter((story) => liked.has(story.id)).map((story) => story.genre));
      const trending = [...state.stories].sort((a, b) => likesCount(b) - likesCount(a)).slice(0, 8);
      const latest = [...state.stories].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 8);
      let recommended = state.stories.filter((story) => likedGenres.has(story.genre));
      if (recommended.length < 6) {
        recommended = [...state.stories].sort((a, b) => readsCount(b) - readsCount(a));
      }
      recommended = recommended.slice(0, 8);

      const fillGrid = (node, list, message) => {
        if (!node) {
          return;
        }
        node.innerHTML = "";
        if (!list.length) {
          node.innerHTML = `<div class="empty">${escapeHTML(message)}</div>`;
          return;
        }
        list.forEach((story) => node.appendChild(storyCard(story)));
      };

      fillGrid(trendingGrid, trending, "No published stories yet.");
      fillGrid(latestGrid, latest, "No latest stories yet.");
      fillGrid(recommendedGrid, recommended, "Recommendations will appear after you start reading.");

      if (genresRow) {
        genresRow.innerHTML = "";
        if (!state.genres.length) {
          genresRow.innerHTML = '<div class="empty">No genres available yet.</div>';
        } else {
          state.genres.forEach((genre) => {
            const chip = document.createElement("button");
            chip.className = "genre-chip";
            chip.type = "button";
            chip.textContent = genre.label;
            chip.addEventListener("click", () => {
              window.location.href = `genre.html?genre=${encodeURIComponent(genre.id)}`;
            });
            genresRow.appendChild(chip);
          });
        }
      }
      return;
    }

    if (page === "genre") {
      const params = new URLSearchParams(window.location.search);
      const sortSelect = document.getElementById("genreSort");
      const grid = document.getElementById("genreStories");
      const loadMoreBtn = document.getElementById("loadMoreStories");
      const title = document.getElementById("genreTitle");
      const sub = document.getElementById("genreSub");
      const icon = document.getElementById("genreIcon");
      const genre = state.genreMap.get(normalize(params.get("genre") || state.genres[0] && state.genres[0].id || "")) || state.genres[0];
      if (!genre || !sortSelect || !grid || !loadMoreBtn) {
        return;
      }
      const stories = state.stories.filter((story) => story.genre === genre.id);
      let visible = 6;
      if (title) title.textContent = `${genre.label} Stories`;
      if (sub) sub.textContent = `${stories.length} stories available`;
      if (icon) icon.textContent = String(genre.icon || "genre").toUpperCase();

      const sorted = () => {
        const list = [...stories];
        if (sortSelect.value === "most-liked") return list.sort((a, b) => likesCount(b) - likesCount(a));
        if (sortSelect.value === "most-read") return list.sort((a, b) => readsCount(b) - readsCount(a));
        return list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      };

      const render = () => {
        const list = sorted();
        grid.innerHTML = "";
        if (!list.length) {
          grid.innerHTML = '<div class="empty">No stories in this genre yet.</div>';
          loadMoreBtn.classList.add("hidden");
          return;
        }
        list.slice(0, visible).forEach((story) => grid.appendChild(storyCard(story)));
        loadMoreBtn.classList.toggle("hidden", visible >= list.length);
      };

      sortSelect.addEventListener("change", () => {
        visible = 6;
        render();
      });
      loadMoreBtn.addEventListener("click", () => {
        visible += 6;
        render();
      });
      render();
      return;
    }

    if (page === "search") {
      const params = new URLSearchParams(window.location.search);
      const query = normalize(params.get("q") || "");
      const heading = document.getElementById("searchHeading");
      const sub = document.getElementById("searchSub");
      const titleResults = document.getElementById("titleResults");
      const authorResults = document.getElementById("authorResults");
      const empty = document.getElementById("searchEmpty");
      if (!heading || !sub || !titleResults || !authorResults || !empty) {
        return;
      }

      heading.textContent = query ? `Search Results: ${query}` : "Search Results";
      sub.textContent = query ? "Matched by title and author." : "Type something in the search bar.";
      titleResults.innerHTML = "";
      authorResults.innerHTML = "";

      if (!query) {
        empty.classList.remove("hidden");
        titleResults.classList.add("hidden");
        authorResults.classList.add("hidden");
        return;
      }

      const stories = state.stories.filter((story) => {
        const author = authorById(story.authorId);
        return normalize(story.title).includes(query) ||
          normalize(story.summary).includes(query) ||
          normalize(author && author.name).includes(query) ||
          normalize(author && author.username).includes(query);
      });
      const authors = state.authors.filter((author) => normalize(author.name).includes(query) || normalize(author.username).includes(query));

      stories.forEach((story) => titleResults.appendChild(storyCard(story)));
      authors.forEach((author) => {
        const card = document.createElement("article");
        card.className = "hero-card author-result";
        card.innerHTML = `
          <div class="author-result-avatar" style="background:${escapeHTML(author.photoGradient)}">${escapeHTML((author.name || "A").charAt(0))}</div>
          <div>
            <h3>${escapeHTML(author.name)}</h3>
            <p class="section-sub">@${escapeHTML(author.username)}</p>
            <p class="section-sub">${escapeHTML(author.bio || "Midnight author")}</p>
          </div>
        `;
        card.addEventListener("click", () => openAuthor(author));
        authorResults.appendChild(card);
      });

      if (!stories.length && !authors.length) {
        empty.classList.remove("hidden");
        empty.textContent = "No results found. Try another title or author.";
      } else {
        empty.classList.add("hidden");
      }
      if (!stories.length) titleResults.innerHTML = '<div class="empty">No story titles matched this search.</div>';
      if (!authors.length) authorResults.innerHTML = '<div class="empty">No author profiles matched this search.</div>';
      return;
    }

    if (page === "story") {
      const params = new URLSearchParams(window.location.search);
      const story = storyById(params.get("id")) || state.stories[0];
      if (!story) {
        emptyMain("No published story is available yet.");
        return;
      }
      const author = authorById(story.authorId);
      const chapters = chaptersFor(story);
      pushRecent(story.id);

      const title = document.getElementById("storyTitle");
      const cover = document.getElementById("storyCover");
      const authorLink = document.getElementById("storyAuthor");
      const genre = document.getElementById("storyGenre");
      const likes = document.getElementById("storyLikes");
      const reads = document.getElementById("storyReads");
      const time = document.getElementById("storyTime");
      const content = document.getElementById("storyContent");
      const chapterList = document.getElementById("chapterList");
      const chapterCount = document.getElementById("chapterCount");
      const progressFill = document.getElementById("progressFill");
      const progressLabel = document.getElementById("progressLabel");
      const saveBtn = document.getElementById("saveStoryBtn");
      const followBtn = document.getElementById("followAuthorBtn");
      const notifyBtn = document.getElementById("notifyStoryBtn");
      const moreWrap = document.getElementById("storyMoreWrap");
      const moreBtn = document.getElementById("storyMoreBtn");
      const moreMenu = document.getElementById("storyMoreMenu");
      const reportPanel = document.getElementById("storyReportPanel");
      const reportReason = document.getElementById("storyReportReason");
      const reportCustomReasonWrap = document.getElementById("storyReportCustomReasonWrap");
      const reportCustomReason = document.getElementById("storyReportCustomReason");
      const reportDetails = document.getElementById("storyReportDetails");
      const reportSubmitBtn = document.getElementById("storyReportSubmitBtn");
      const reportCancelBtn = document.getElementById("storyReportCancelBtn");
      const reportBtn = document.getElementById("reportStoryBtn");
      const reportStatus = document.getElementById("reportStatus");
      const library = savedStoryIds();
      const follow = followedAuthorIds();
      const notify = subscribedStoryIds();
      const ownStory = isOwnAuthor(author);

      if (ownStory && author) {
        follow.delete(author.id);
        state.readerState.followedAuthorIds = [...follow];
        mirrorReaderStateToLocal();
      }

      if (title) title.textContent = story.title;
      if (cover) {
        cover.textContent = story.title;
        cover.style.cssText = coverStyle(story);
      }
      if (authorLink) {
        authorLink.textContent = author ? author.name : "Unknown";
        authorLink.href = author ? `profile.html?authorId=${encodeURIComponent(author.id)}` : "#";
      }
      if (genre) genre.textContent = storyGenre(story).label;
      if (reads) reads.innerHTML = metricChipMarkup(eyeIconMarkup(), numberLabel(readsCount(story)), "", `${numberLabel(readsCount(story))} reads`);
      if (time) time.innerHTML = metricChipMarkup(clockIconMarkup(), `${story.readingMinutes} min read`);
      if (chapterCount) chapterCount.textContent = `${chapters.length} chapters`;

      const closeMoreMenu = () => {
        if (!moreMenu || !moreBtn) {
          return;
        }

        moreMenu.classList.add("hidden");
        moreBtn.setAttribute("aria-expanded", "false");
      };

      const clearReportStatus = () => {
        if (!reportStatus) {
          return;
        }

        reportStatus.textContent = "";
        reportStatus.className = "section-sub";
      };

      const syncReportReasonFields = () => {
        if (!reportReason || !reportCustomReasonWrap) {
          return;
        }

        const usingCustomReason = reportReason.value === "other";
        reportCustomReasonWrap.classList.toggle("hidden", !usingCustomReason);
        if (reportCustomReason) {
          reportCustomReason.disabled = !usingCustomReason;
          if (!usingCustomReason) {
            reportCustomReason.value = "";
          }
        }
      };

      const resetReportForm = () => {
        if (reportReason) {
          reportReason.value = "";
        }
        if (reportDetails) {
          reportDetails.value = "";
        }
        if (reportCustomReason) {
          reportCustomReason.value = "";
        }
        syncReportReasonFields();
      };

      const closeReportPanel = () => {
        if (!reportPanel || !reportBtn) {
          return;
        }

        reportPanel.classList.add("hidden");
        reportBtn.setAttribute("aria-expanded", "false");
      };

      const openReportPanel = () => {
        if (!reportPanel || !reportBtn) {
          return;
        }

        reportPanel.classList.remove("hidden");
        reportBtn.setAttribute("aria-expanded", "true");
        syncReportReasonFields();
        if (reportReason) {
          reportReason.focus();
        }
      };

      const selectedReportReason = () => {
        if (!reportReason) {
          return "";
        }

        if (reportReason.value === "other") {
          return String(reportCustomReason && reportCustomReason.value || "").trim();
        }

        const option = reportReason.selectedOptions && reportReason.selectedOptions[0];
        return String(option && option.textContent || "").trim();
      };

      const customCollections = () => collectionListsState().filter((item) => !item.isSystem);

      const renderMoreMenu = () => {
        if (!moreMenu) {
          return;
        }

        const lists = customCollections();
        const hasSave = library.has(story.id);
        moreMenu.innerHTML = "";

        const libraryGroup = document.createElement("div");
        libraryGroup.className = "story-action-group";
        libraryGroup.innerHTML = `
          <div class="story-action-label">Library</div>
          <button class="menu-item${hasSave ? " primary" : ""}" type="button">${hasSave ? "Remove from Library" : "Add to Library"}</button>
        `;
        const libraryBtn = libraryGroup.querySelector("button");
        if (libraryBtn) {
          libraryBtn.addEventListener("click", async () => {
            libraryBtn.disabled = true;
            try {
              await setLibraryStatus(!hasSave);
              showPageStatus(hasSave ? `Removed "${story.title}" from Library.` : `Added "${story.title}" to Library.`, "success");
              refreshActions();
              renderMoreMenu();
            } catch (error) {
              libraryBtn.disabled = false;
              showPageStatus(api.getErrorMessage(error, "Library update failed."), "error");
            }
          });
        }
        moreMenu.appendChild(libraryGroup);

        const collectionGroup = document.createElement("div");
        collectionGroup.className = "story-action-group";
        const label = document.createElement("div");
        label.className = "story-action-label";
        label.textContent = "Collection";
        collectionGroup.appendChild(label);

        if (!lists.length) {
          const note = document.createElement("p");
          note.className = "story-action-note";
          note.textContent = "Create a custom list in Collection first, then you can add this story there.";
          collectionGroup.appendChild(note);

          const openCollectionBtn = document.createElement("button");
          openCollectionBtn.type = "button";
          openCollectionBtn.className = "menu-item";
          openCollectionBtn.textContent = "Open Collection";
          openCollectionBtn.addEventListener("click", () => {
            window.location.href = "collection.html";
          });
          collectionGroup.appendChild(openCollectionBtn);
        } else {
          lists.forEach((collection) => {
            const inCollection = Array.isArray(collection.storyIds) && collection.storyIds.includes(story.id);
            const button = document.createElement("button");
            button.type = "button";
            button.className = `menu-item${inCollection ? " primary" : ""}`;
            button.textContent = inCollection ? `Remove from ${collection.name}` : `Add to ${collection.name}`;
            button.addEventListener("click", async () => {
              button.disabled = true;
              try {
                if (inCollection) {
                  await api.removeStoryFromCollection(collection.id, story.id);
                  showPageStatus(`Removed "${story.title}" from ${collection.name}.`, "success");
                } else {
                  await api.addStoryToCollection(collection.id, story.id);
                  showPageStatus(`Added "${story.title}" to ${collection.name}.`, "success");
                }
                await loadReaderState();
                refreshActions();
                renderMoreMenu();
              } catch (error) {
                button.disabled = false;
                showPageStatus(api.getErrorMessage(error, "Collection update failed."), "error");
              }
            });
            collectionGroup.appendChild(button);
          });
        }

        moreMenu.appendChild(collectionGroup);
      };

      const openMoreMenu = () => {
        if (!moreMenu || !moreBtn) {
          return;
        }

        renderMoreMenu();
        moreMenu.classList.remove("hidden");
        moreBtn.setAttribute("aria-expanded", "true");
      };

      const toggleMoreMenu = () => {
        if (!moreMenu || !moreBtn) {
          return;
        }

        if (moreMenu.classList.contains("hidden")) {
          openMoreMenu();
        } else {
          closeMoreMenu();
        }
      };

      const refreshActions = () => {
        const hasSave = library.has(story.id);
        const hasFollow = ownStory ? false : !!(author && follow.has(author.id));
        const hasNotify = notify.has(story.id);
        if (likes) likes.innerHTML = metricChipMarkup(heartIconMarkup(), numberLabel(likesCount(story)), "", `${numberLabel(likesCount(story))} votes`);
        if (saveBtn) {
          saveBtn.classList.add("primary");
          saveBtn.textContent = "Start Reading";
        }
        if (followBtn) {
          followBtn.classList.add("action-pill-btn");
          followBtn.classList.toggle("primary", hasFollow && !ownStory);
          followBtn.textContent = ownStory ? "Your Story" : (hasFollow ? "Following" : "Follow");
          followBtn.setAttribute("aria-pressed", hasFollow && !ownStory ? "true" : "false");
          followBtn.disabled = ownStory;
        }
        if (notifyBtn) {
          notifyBtn.classList.add("icon-action-btn");
          notifyBtn.classList.toggle("primary", hasNotify && !ownStory);
          notifyBtn.innerHTML = `${bellIconMarkup()}<span class="sr-only">${ownStory ? "Your Story" : (hasNotify ? "Updates enabled" : "Get Updates")}</span>`;
          notifyBtn.setAttribute("aria-label", ownStory ? "Your Story" : (hasNotify ? "Updates enabled" : "Get Updates"));
          notifyBtn.setAttribute("aria-pressed", hasNotify && !ownStory ? "true" : "false");
          notifyBtn.setAttribute("data-tooltip", ownStory ? "Your Story" : (hasNotify ? "Story Updates On" : "Get Story Updates"));
          notifyBtn.disabled = ownStory;
        }
        if (moreBtn) {
          moreBtn.classList.toggle("primary", hasSave || customCollections().some((collection) => collection.storyIds.includes(story.id)));
        }
      };

      if (chapterList) {
        chapterList.innerHTML = "";
        chapters.forEach((chapter, index) => {
          const card = document.createElement("article");
          card.className = "chapter-card";
          card.innerHTML = `
            <div class="chapter-head">
              <div>
                <h3 class="chapter-title">${escapeHTML(chapterDisplayTitle(chapter, index))}</h3>
                <div class="chapter-meta chapter-meta-stats">
                  ${metricChipMarkup(stackIconMarkup(), `${chapter.sectionCount || 1} section${Number(chapter.sectionCount || 1) > 1 ? "s" : ""}`)}
                  ${metricChipMarkup(heartIconMarkup(), numberLabel(chapter.likes || 0), "", `${numberLabel(chapter.likes || 0)} votes`)}
                  ${metricChipMarkup(commentIconMarkup(), numberLabel(chapter.comments || 0), "", `${numberLabel(chapter.comments || 0)} comments`)}
                </div>
              </div>
              <button class="btn chapter-toggle" type="button">Read Chapter</button>
            </div>
          `;
          const button = card.querySelector(".chapter-toggle");
          if (button) {
            if (index === 0) button.classList.add("primary");
            button.addEventListener("click", () => openChapter(story.id, index + 1));
          }
          chapterList.appendChild(card);
        });
      }

      const saveProgress = () => {
        if (!content || !progressFill || !progressLabel) {
          return;
        }
        const start = content.getBoundingClientRect().top + window.scrollY;
        const end = start + content.offsetHeight - window.innerHeight;
        let percent = end > start ? ((window.scrollY - start) / (end - start)) * 100 : 100;
        const existingPercent = Number(progressState()[story.id] && progressState()[story.id].percent || 0);
        percent = Math.max(existingPercent, Math.max(0, Math.min(100, Math.round(percent))));
        progressFill.style.width = `${percent}%`;
        progressLabel.textContent = `${percent}% read`;
        const localProgress = getState(state.keys.progress, {});
        localProgress[story.id] = { percent, updatedAt: new Date().toISOString() };
        setState(state.keys.progress, localProgress);
        setRemoteProgress(story.id, {
          ...(progressState()[story.id] || {}),
          storyId: story.id,
          percent,
          chapterPosition: progressState()[story.id] && progressState()[story.id].chapterPosition || null,
          updatedAt: new Date().toISOString()
        });
        scheduleProgressSync(story.id, {
          percent,
          chapterPosition: progressState()[story.id] && progressState()[story.id].chapterPosition || null
        }, (result) => {
          if (reads) {
            reads.innerHTML = metricChipMarkup(eyeIconMarkup(), numberLabel(readsCount(story)), "", `${numberLabel(readsCount(story))} reads`);
          }
          if (result && result.progress) {
            progressLabel.textContent = `${result.progress.percent}% read`;
          }
          if (result && (result.completed || Number(result.progress && result.progress.percent || 0) >= 100)) {
            loadReaderState()
              .then(() => {
                refreshActions();
              })
              .catch(() => {
                // Keep completion refresh non-blocking.
              });
          }
        });
      };

      const setLibraryStatus = async (shouldSave) => {
        const alreadySaved = library.has(story.id);
        if (shouldSave === alreadySaved) {
          return { saved: alreadySaved };
        }

        const result = shouldSave
          ? await api.saveStory(story.id)
          : await api.unsaveStory(story.id);
        if (result.saved) {
          library.add(story.id);
        } else {
          library.delete(story.id);
        }
        state.readerState.savedStoryIds = [...library];
        state.readerState.currentReadStoryIds = [...library];
        mirrorReaderStateToLocal();
        refreshActions();
        if (moreMenu && !moreMenu.classList.contains("hidden")) {
          renderMoreMenu();
        }
        return result;
      };
      const startReadingStory = async () => {
        if (!chapters.length) {
          showPageStatus("No chapters are available for this story yet.", "error");
          return;
        }

        if (!library.has(story.id)) {
          await setLibraryStatus(true);
        }

        const progress = progressState()[story.id] || {};
        const rawChapter = Number.parseInt(progress.chapterPosition, 10);
        const chapterNumber = Math.max(1, Math.min(chapters.length, Number.isNaN(rawChapter) ? 1 : rawChapter));
        openChapter(story.id, chapterNumber);
      };
      if (saveBtn) saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        try {
          await startReadingStory();
        } catch (error) {
          showPageStatus(api.getErrorMessage(error, "Unable to start reading right now."), "error");
        } finally {
          saveBtn.disabled = false;
        }
      });
      if (followBtn) followBtn.addEventListener("click", async () => {
        if (!author || ownStory) return;
        followBtn.disabled = true;
        try {
          const result = follow.has(author.id)
            ? await api.unfollowAuthor(author.id)
            : await api.followAuthor(author.id);
          if (result.following) {
            follow.add(author.id);
          } else {
            follow.delete(author.id);
          }
          state.readerState.followedAuthorIds = [...follow];
          if (author) {
            author.followersCount = Number(result.followersCount || 0);
          }
          mirrorReaderStateToLocal();
          refreshActions();
        } catch (error) {
          showPageStatus(api.getErrorMessage(error, "Follow update failed."), "error");
        } finally {
          followBtn.disabled = false;
        }
      });
      if (notifyBtn) notifyBtn.addEventListener("click", async () => {
        if (ownStory) {
          return;
        }
        notifyBtn.disabled = true;
        try {
          const result = notify.has(story.id)
            ? await api.unsubscribeStoryUpdates(story.id)
            : await api.subscribeStoryUpdates(story.id);
          if (result.subscribed) {
            notify.add(story.id);
          } else {
            notify.delete(story.id);
          }
          state.readerState.subscribedStoryIds = [...notify];
          mirrorReaderStateToLocal();
          refreshActions();
          showPageStatus(result.subscribed ? `You'll get updates for "${story.title}".` : `Story updates turned off for "${story.title}".`, "success");
        } catch (error) {
          showPageStatus(api.getErrorMessage(error, "Notification update failed."), "error");
        } finally {
          notifyBtn.disabled = false;
        }
      });
      if (moreBtn && moreMenu && moreWrap) {
        moreBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleMoreMenu();
        });

        document.addEventListener("click", (event) => {
          if (!moreWrap.contains(event.target)) {
            closeMoreMenu();
          }
        });
      }
      if (reportReason) {
        reportReason.addEventListener("change", () => {
          clearReportStatus();
          syncReportReasonFields();
        });
      }
      if (reportCancelBtn) {
        reportCancelBtn.addEventListener("click", () => {
          resetReportForm();
          clearReportStatus();
          closeReportPanel();
        });
      }
      if (reportBtn && reportPanel) {
        reportBtn.addEventListener("click", () => {
          clearReportStatus();
          if (reportPanel.classList.contains("hidden")) {
            openReportPanel();
          } else {
            closeReportPanel();
          }
        });
      }
      if (reportSubmitBtn && reportStatus) {
        reportSubmitBtn.addEventListener("click", async () => {
          const reasonValue = selectedReportReason();
          const selectedValue = String(reportReason && reportReason.value || "").trim();
          const detailsValue = String(reportDetails && reportDetails.value || "").trim();

          reportStatus.className = "section-sub";

          if (!selectedValue) {
            reportStatus.textContent = "Please select a reason before submitting.";
            reportStatus.classList.add("status-error");
            return;
          }

          if (selectedValue === "other" && !reasonValue) {
            reportStatus.textContent = "Please write your reason for this report.";
            reportStatus.classList.add("status-error");
            if (reportCustomReason) {
              reportCustomReason.focus();
            }
            return;
          }

          reportSubmitBtn.disabled = true;
          if (reportBtn) {
            reportBtn.disabled = true;
          }

          try {
            await api.createReport({
              storyId: story.id,
              reason: reasonValue,
              details: detailsValue
            });
            reportStatus.textContent = "Report sent to moderation team.";
            reportStatus.classList.add("status-ok");
            resetReportForm();
            closeReportPanel();
          } catch (error) {
            reportStatus.textContent = api.getErrorMessage(error, "Report submission failed.");
            reportStatus.classList.add("status-error");
          } finally {
            reportSubmitBtn.disabled = false;
            if (reportBtn) {
              reportBtn.disabled = false;
            }
          }
        });
      }

      refreshActions();
      saveProgress();
      window.addEventListener("scroll", saveProgress, { passive: true });
      return;
    }

    if (page === "notifications") {
      const box = document.getElementById("readerNotificationList");
      const markAll = document.getElementById("readerMarkAllReadBtn");
      if (!box) {
        return;
      }

      let remote = await api.listNotifications();

      function actorLabel(item) {
        const actor = item && item.actor ? (item.actor.displayName || item.actor.username || item.actor.email) : "";
        return String(actor || "").trim();
      }

      function render() {
        box.innerHTML = "";
        if (!remote.length) {
          box.innerHTML = '<div class="empty">No notifications yet.</div>';
          return;
        }

        remote.forEach((item) => {
          const article = document.createElement("article");
          article.className = `notify-item ${item.unread ? "unread" : ""}`;
          const actor = actorLabel(item);
          const detail = actor && item.story
            ? `${actor} | ${item.story.title}`
            : actor || (item.story && item.story.title) || "Midnight";
          article.innerHTML = `
            <div>${escapeHTML(item.text || "New notification")}</div>
            <div class="notify-time">${escapeHTML(detail)} | ${escapeHTML(toDateLabel(item.createdAt))}</div>
          `;

          if (item.story && item.story.id) {
            article.style.cursor = "pointer";
            article.addEventListener("click", () => {
              openStory(item.story.id);
            });
          }

          box.appendChild(article);
        });
      }

      if (markAll) {
        markAll.addEventListener("click", async () => {
          markAll.disabled = true;
          try {
            remote = await api.markAllNotificationsRead();
            setNotificationBadge(document.getElementById("readerNotificationBellCount"), 0);
            render();
            showPageStatus("Notifications marked as read.", "success");
          } catch (error) {
            showPageStatus(api.getErrorMessage(error, "Notifications update failed."), "error");
          } finally {
            markAll.disabled = false;
          }
        });
      }

      render();
      return;
    }

    if (page === "chapter") {
      const params = new URLSearchParams(window.location.search);
      const story = storyById(params.get("id")) || state.stories[0];
      if (!story) {
        emptyMain("No story data is available yet.");
        return;
      }
      const author = authorById(story.authorId);
      const chapters = chaptersFor(story);
      const rawNumber = Number.parseInt(params.get("chapter") || "1", 10);
      const index = Math.max(0, Math.min(chapters.length - 1, Number.isNaN(rawNumber) ? 0 : rawNumber - 1));
      const chapter = chapters[index];
      const title = document.getElementById("chapterTitle");
      const meta = document.getElementById("chapterMeta");
      const badge = document.getElementById("chapterBadge");
      const likeBtn = document.getElementById("chapterLikeBtn");
      const storyBtn = document.getElementById("chapterStoryBtn");
      const prevBtn = document.getElementById("chapterPrevBtn");
      const nextBtn = document.getElementById("chapterNextBtn");
      const body = document.getElementById("chapterBody");
      const commentsNode = document.getElementById("chapterCommentsList");
      const commentInput = document.getElementById("chapterCommentInput");
      const commentSubmit = document.getElementById("chapterCommentSubmit");
      const likedChapters = likedChapterIds();
      const likedStories = likedStoryIds();
      let comments = [];
      pushRecent(story.id);

      try {
        comments = await api.listChapterComments(chapter.id);
      } catch (error) {
        comments = feedbackList(chapter.id);
      }
      chapter.comments = Math.max(Number(chapter.comments || 0), comments.length);
      story.comments = chapters.reduce((sum, item) => sum + Number(item.comments || 0), 0);

      const refreshChapterMeta = () => {
        if (title) title.textContent = chapterDisplayTitle(chapter, index);
        if (meta) {
          meta.textContent = `${story.title} | ${author ? author.name : "Unknown"} | ${storyGenre(story).label} | ${numberLabel(chapter.likes || 0)} votes | ${numberLabel(chapter.comments || 0)} comments`;
        }
        if (likeBtn) {
          const hasLike = likedChapters.has(chapter.id);
          likeBtn.classList.add("icon-action-btn", "vote-action-btn");
          likeBtn.classList.toggle("primary", hasLike);
          likeBtn.innerHTML = `${heartIconMarkup(hasLike)}<span class="sr-only">${hasLike ? "Voted Chapter" : "Vote Chapter"}</span>`;
          likeBtn.setAttribute("aria-label", hasLike ? "Voted Chapter" : "Vote Chapter");
          likeBtn.setAttribute("aria-pressed", hasLike ? "true" : "false");
          likeBtn.setAttribute("data-tooltip", hasLike ? "Voted Chapter" : "Vote Chapter");
        }
      };

      const saveFeedbackLocal = () => {
        const localComments = getState(state.keys.comments, {});
        localComments[chapter.id] = comments;
        setState(state.keys.comments, localComments);
      };

      const renderComments = () => {
        if (!commentsNode) {
          return;
        }
        commentsNode.innerHTML = comments.length
          ? comments.map((comment) => `<div class="comment-card"><div class="comment-head">${escapeHTML(displayName(comment.user || {}) || "Reader")} | ${escapeHTML(toDateLabel(comment.createdAt || comment.time))}</div><div>${escapeHTML(comment.text || "")}</div></div>`).join("")
          : '<div class="empty">No comments yet for this chapter.</div>';
      };
      saveFeedbackLocal();

      refreshChapterMeta();
      if (badge) badge.textContent = `Chapter ${index + 1} / ${chapters.length}`;
      if (storyBtn) storyBtn.href = `story.html?id=${encodeURIComponent(story.id)}`;
      if (prevBtn) {
        if (index > 0) {
          prevBtn.href = `chapter.html?id=${encodeURIComponent(story.id)}&chapter=${index}`;
          prevBtn.classList.remove("hidden");
        } else {
          prevBtn.classList.add("hidden");
        }
      }
      if (nextBtn) {
        if (index + 1 < chapters.length) {
          nextBtn.href = `chapter.html?id=${encodeURIComponent(story.id)}&chapter=${index + 2}`;
          nextBtn.classList.remove("hidden");
        } else {
          nextBtn.classList.add("hidden");
        }
      }
      if (body) body.innerHTML = chapter.content || "<p>Story content is not available.</p>";

      if (likeBtn) likeBtn.addEventListener("click", async () => {
        likeBtn.disabled = true;
        try {
          const result = likedChapters.has(chapter.id)
            ? await api.unlikeChapter(chapter.id)
            : await api.likeChapter(chapter.id);
          if (result.liked) {
            likedChapters.add(chapter.id);
            likedStories.add(story.id);
          } else {
            likedChapters.delete(chapter.id);
            if (!chapters.some((item) => item.id !== chapter.id && likedChapters.has(item.id))) {
              likedStories.delete(story.id);
            }
          }
          chapter.likes = Number(result.chapterLikes || 0);
          state.readerState.likedChapterIds = [...likedChapters];
          state.readerState.likedStoryIds = [...likedStories];
          mirrorReaderStateToLocal();
          updateStoryMetrics(story.id, result);
          refreshChapterMeta();
        } catch (error) {
          showPageStatus(api.getErrorMessage(error, "Chapter vote update failed."), "error");
        } finally {
          likeBtn.disabled = false;
        }
      });

      if (commentSubmit && commentInput) {
        commentSubmit.addEventListener("click", async () => {
          const text = commentInput.value.trim();
          if (!text) {
            return;
          }
          commentSubmit.disabled = true;
          try {
            const result = await api.createChapterComment(chapter.id, { text });
            comments = [result.comment, ...comments];
            chapter.comments = Number(result.commentsCount || comments.length);
            story.comments = Number(result.storyCommentsCount || chapters.reduce((sum, item) => sum + Number(item.comments || 0), 0));
            commentInput.value = "";
            saveFeedbackLocal();
            refreshChapterMeta();
            renderComments();
            showPageStatus("Comment posted.", "success");
          } catch (error) {
            showPageStatus(api.getErrorMessage(error, "Comment submit failed."), "error");
          } finally {
            commentSubmit.disabled = false;
          }
        });
      }

      renderComments();

      const progressPercent = Math.round(((index + 1) / chapters.length) * 100);
      const localProgress = getState(state.keys.progress, {});
      localProgress[story.id] = {
        percent: progressPercent,
        chapterPosition: index + 1,
        updatedAt: new Date().toISOString()
      };
      setState(state.keys.progress, localProgress);
      setRemoteProgress(story.id, {
        ...(progressState()[story.id] || {}),
        storyId: story.id,
        percent: progressPercent,
        chapterPosition: index + 1,
        updatedAt: new Date().toISOString()
      });
      scheduleProgressSync(story.id, {
        percent: progressPercent,
        chapterPosition: index + 1
      });
      return;
    }

    if (page === "profile") {
      const params = new URLSearchParams(window.location.search);
      const requestedId = String(params.get("authorId") || "").trim();
      const requestedUser = normalize(params.get("author") || "");
      let author = requestedId ? authorById(requestedId) : null;
      if (!author && requestedUser) {
        author = state.authors.find((item) => normalize(item.username) === requestedUser) || null;
      }
      if (!author) {
        author = currentAuthor();
      }

      const cover = document.getElementById("profileCover");
      const avatar = document.getElementById("profileAvatar");
      const name = document.getElementById("profileName");
      const username = document.getElementById("profileUsername");
      const bio = document.getElementById("profileBio");
      const stats = document.getElementById("profileStats");
      const socialsNode = document.getElementById("profileSocials");
      const followersModal = document.getElementById("profileFollowersModal");
      const followersModalTitle = document.getElementById("profileFollowersModalTitle");
      const followersModalCount = document.getElementById("profileFollowersModalCount");
      const followersModalList = document.getElementById("profileFollowersModalList");
      const followersModalClose = document.getElementById("profileFollowersModalClose");
      const storiesTab = document.getElementById("profileStoriesTab");
      const collectionsTab = document.getElementById("profileCollectionsTab");
      const questionsTab = document.getElementById("profileQuestionsTab");
      const storiesSection = document.getElementById("profileStoriesSection");
      const collectionsSection = document.getElementById("profileCollectionsSection");
      const questionsSection = document.getElementById("profileQuestionsSection");
      const questionsTitle = document.getElementById("profileQuestionsTitle");
      const questionsIntro = document.getElementById("profileQuestionsIntro");
      const questionForm = document.getElementById("profileQuestionForm");
      const questionInput = document.getElementById("profileQuestionInput");
      const questionSubmit = document.getElementById("profileQuestionSubmitBtn");
      const questionStatus = document.getElementById("profileQuestionStatus");
      const questionList = document.getElementById("profileQuestionList");
      const editBtn = document.getElementById("profileEditBtn");
      const settingsBtn = document.getElementById("profileSettingsBtn");
      const followBtn = document.getElementById("profileFollowBtn");
      const notifyBtn = document.getElementById("profileNotifyBtn");
      const storiesNode = document.getElementById("profileStories");
      const collectionsIntro = document.getElementById("profileCollectionsIntro");
      const collectionsNode = document.getElementById("profileCollections");
      if (!avatar || !name || !username || !bio || !stats || !followBtn || !storiesNode || !collectionsIntro || !collectionsNode || !storiesTab || !collectionsTab || !questionsTab || !storiesSection || !collectionsSection || !questionsSection || !questionsTitle || !questionsIntro || !questionForm || !questionInput || !questionSubmit || !questionStatus || !questionList || !followersModal || !followersModalTitle || !followersModalCount || !followersModalList || !followersModalClose) {
        return;
      }

      let activeProfileTab = "stories";
      const setActiveProfileTab = (tab) => {
        activeProfileTab = tab === "collections" || tab === "questions" ? tab : "stories";
        storiesSection.classList.toggle("hidden", activeProfileTab !== "stories");
        collectionsSection.classList.toggle("hidden", activeProfileTab !== "collections");
        questionsSection.classList.toggle("hidden", activeProfileTab !== "questions");
        storiesTab.classList.toggle("active", activeProfileTab === "stories");
        collectionsTab.classList.toggle("active", activeProfileTab === "collections");
        questionsTab.classList.toggle("active", activeProfileTab === "questions");
        storiesTab.setAttribute("aria-selected", activeProfileTab === "stories" ? "true" : "false");
        collectionsTab.setAttribute("aria-selected", activeProfileTab === "collections" ? "true" : "false");
        questionsTab.setAttribute("aria-selected", activeProfileTab === "questions" ? "true" : "false");
      };

      const updateProfileTabs = (displayLabel, isOwnProfile = false) => {
        const safeLabel = String(displayLabel || "Author").trim() || "Author";
        storiesTab.textContent = `Stories By ${safeLabel}`;
        collectionsTab.textContent = "Public Collections";
        questionsTab.textContent = isOwnProfile ? "Reader Questions" : `Ask ${safeLabel}`;
      };

      const setQuestionStatus = (message, type = "") => {
        const text = String(message || "").trim();
        if (!text) {
          questionStatus.textContent = "";
          questionStatus.className = "section-sub profile-question-status hidden";
          return;
        }

        questionStatus.textContent = text;
        questionStatus.className = `section-sub profile-question-status ${type || ""}`.trim();
      };

      if (!storiesTab.dataset.bound) {
        storiesTab.dataset.bound = "true";
        storiesTab.addEventListener("click", () => {
          setActiveProfileTab("stories");
        });
      }

      if (!collectionsTab.dataset.bound) {
        collectionsTab.dataset.bound = "true";
        collectionsTab.addEventListener("click", () => {
          setActiveProfileTab("collections");
        });
      }

      if (!questionsTab.dataset.bound) {
        questionsTab.dataset.bound = "true";
        questionsTab.addEventListener("click", () => {
          setActiveProfileTab("questions");
        });
      }

      setActiveProfileTab(activeProfileTab);

      let fullUser = null;
      let publicCollections = [];
      let profileFollowers = [];
      let followersLoaded = false;
      let profileQuestions = [];
      let activeReplyEditorId = "";
      let profileAccessBlocked = false;
      if (author && author.id) {
        try {
          fullUser = await api.getUserById(author.id);
          author = ensureAuthor(fullUser) || author;
        } catch (error) {
          fullUser = null;
          profileAccessBlocked = !!(error && error.status === 403);
        }

        try {
          publicCollections = await api.listPublicCollectionsByUser(author.id);
        } catch (error) {
          publicCollections = [];
        }

        try {
          profileFollowers = await api.listAuthorFollowers(author.id);
          followersLoaded = true;
        } catch (error) {
          profileFollowers = [];
          followersLoaded = false;
        }

        try {
          profileQuestions = await api.listAuthorProfileComments(author.id);
        } catch (error) {
          profileQuestions = [];
        }
      }

      if (!author) {
        if (cover) {
          cover.style.cssText = authorCoverStyle(null, []);
        }
        avatar.style.background = authorGradient("#7C7CFF");
        avatar.style.backgroundImage = "";
        avatar.style.backgroundSize = "";
        avatar.style.backgroundPosition = "";
        avatar.textContent = "A";
        name.textContent = "Author not found";
        username.textContent = "";
        bio.textContent = "No author profile available yet.";
        stats.innerHTML = "<span>0 stories</span><span>0 followers</span>";
        updateProfileTabs("Author", false);
        questionsTitle.textContent = "Ask Author";
        questionsIntro.textContent = "Readers can ask the author questions here.";
        questionForm.classList.add("hidden");
        questionList.innerHTML = '<div class="empty">No reader questions are available yet.</div>';
        setQuestionStatus("");
        followersModal.classList.add("hidden");
        followersModalList.innerHTML = "";
        renderProfileSocials(socialsNode, null);
        if (editBtn) {
          editBtn.classList.add("hidden");
        }
        if (settingsBtn) {
          settingsBtn.classList.add("hidden");
        }
        followBtn.classList.add("hidden");
        if (notifyBtn) {
          notifyBtn.classList.add("hidden");
        }
        storiesNode.innerHTML = '<div class="empty">No stories published yet.</div>';
        collectionsNode.innerHTML = '<div class="empty">No public collections available yet.</div>';
        return;
      }

      const stories = state.stories.filter((story) => story.authorId === author.id);
      const follow = followedAuthorIds();
      const authorNotify = subscribedAuthorIds();
      const ownProfile = isOwnAuthor(author);
      const authorLabel = fullUser && fullUser.displayName ? fullUser.displayName : author.name;
      if (cover) {
        cover.style.cssText = authorCoverStyle(author, stories);
      }
      if (author.avatarUrl) {
        avatar.style.background = "#0f172a";
        avatar.style.backgroundImage = `url("${author.avatarUrl.replace(/"/g, "%22")}")`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.textContent = "";
      } else {
        avatar.style.background = author.photoGradient;
        avatar.style.backgroundImage = "";
        avatar.style.backgroundSize = "";
        avatar.style.backgroundPosition = "";
        avatar.textContent = (author.name || "A").charAt(0).toUpperCase();
      }
      name.textContent = authorLabel;
      username.textContent = `@${fullUser && fullUser.username ? fullUser.username : author.username}`;
      bio.textContent = fullUser && fullUser.bio ? fullUser.bio : (author.bio || "Midnight author.");
      if (profileAccessBlocked && !ownProfile) {
        bio.textContent = "This profile is private. Follow this author to see more profile details.";
      }
      updateProfileTabs(authorLabel, ownProfile);
      questionsTitle.textContent = ownProfile ? "Reader Questions" : `Ask ${authorLabel}`;
      questionsIntro.textContent = ownProfile
        ? "Readers can ask you questions here. Reply to them or delete anything you do not want to keep."
        : `Ask ${authorLabel} something here and the author can reply to you on this profile.`;
      questionForm.classList.toggle("hidden", ownProfile);
      questionInput.placeholder = `Ask ${authorLabel} about the stories, writing, or updates...`;
      collectionsIntro.textContent = ownProfile
        ? "Only your public lists appear here to other readers."
        : "Public reading lists shared on this profile.";
      if (profileAccessBlocked && !ownProfile) {
        collectionsIntro.textContent = "Collections are hidden while this profile is private.";
      }
      renderProfileSocials(socialsNode, author.socials);
      if (profileAccessBlocked && !ownProfile) {
        renderProfileSocials(socialsNode, null);
        collectionsTab.classList.add("hidden");
        questionsTab.classList.add("hidden");
        if (activeProfileTab !== "stories") {
          setActiveProfileTab("stories");
        }
      } else {
        collectionsTab.classList.remove("hidden");
        questionsTab.classList.remove("hidden");
      }

      const syncFollowerList = (isFollowing) => {
        const viewer = state.session && state.session.user;
        const viewerId = String(viewer && viewer.id || "").trim();
        if (!viewerId || viewerId === String(author.id || "").trim()) {
          return;
        }

        const existing = profileFollowers.find((item) => String(item && item.id || "").trim() === viewerId);
        if (isFollowing) {
          if (existing) {
            return;
          }
          profileFollowers = [{
            id: viewerId,
            email: viewer.email || "",
            displayName: viewer.displayName || null,
            username: viewer.username || null,
            avatarColor: viewer.avatarColor || "#7C7CFF",
            avatarUrl: viewer.avatarUrl || null,
            followedAt: new Date().toISOString()
          }, ...profileFollowers];
          return;
        }

        profileFollowers = profileFollowers.filter((item) => String(item && item.id || "").trim() !== viewerId);
      };

      const renderFollowersModal = () => {
        const followerCount = Number(author.followersCount || 0);
        followersModalTitle.textContent = `${authorLabel} Followers`;
        followersModalCount.textContent = `${numberLabel(followerCount)} follower${followerCount === 1 ? "" : "s"}`;
        followersModalList.innerHTML = "";

        if (!followerCount) {
          const empty = document.createElement("p");
          empty.className = "empty";
          empty.textContent = ownProfile ? "You do not have any followers yet." : `${authorLabel} does not have any followers yet.`;
          followersModalList.appendChild(empty);
          return;
        }

        if (!followersLoaded) {
          const empty = document.createElement("p");
          empty.className = "empty";
          empty.textContent = "Followers could not be loaded right now.";
          followersModalList.appendChild(empty);
          return;
        }

        if (!profileFollowers.length) {
          const empty = document.createElement("p");
          empty.className = "empty";
          empty.textContent = ownProfile ? "You do not have any followers yet." : `${authorLabel} does not have any followers yet.`;
          followersModalList.appendChild(empty);
          return;
        }

        profileFollowers.forEach((follower) => {
          const followerId = String(follower && follower.id || "").trim();
          const card = document.createElement("a");
          card.className = "profile-followers-row";
          card.href = followerId
            ? `profile.html?authorId=${encodeURIComponent(followerId)}`
            : "#";

          const avatarMarkup = follower && follower.avatarUrl
            ? `background-image:url("${String(follower.avatarUrl || "").replace(/"/g, "%22")}");background-size:cover;background-position:center;background-color:#0f172a;`
            : `background:${authorGradient(follower && follower.avatarColor || "#7C7CFF")};`;
          const followerName = displayName(follower || {}) || "Reader";
          const followerHandle = usernameValue(follower || {}, "reader");

          card.innerHTML = `
            <div class="profile-followers-avatar" style="${avatarMarkup}">${follower && follower.avatarUrl ? "" : escapeHTML(followerName.charAt(0).toUpperCase())}</div>
            <div class="profile-followers-copy">
              <p class="profile-followers-name">${escapeHTML(followerName)}</p>
              <p class="profile-followers-handle">@${escapeHTML(followerHandle)}</p>
            </div>
          `;
          card.addEventListener("click", (event) => {
            if (!followerId) {
              event.preventDefault();
              return;
            }
            followersModal.classList.add("hidden");
          });
          followersModalList.appendChild(card);
        });
      };

      const closeFollowersModal = () => {
        followersModal.classList.add("hidden");
      };

      const ensureFollowersLoaded = async () => {
        if (followersLoaded || !author || !author.id) {
          return;
        }

        try {
          profileFollowers = await api.listAuthorFollowers(author.id);
          followersLoaded = true;
        } catch (error) {
          profileFollowers = [];
          followersLoaded = false;
        }
      };

      const openFollowersModal = async () => {
        followersModal.classList.remove("hidden");
        followersModalList.innerHTML = '<div class="empty">Loading followers...</div>';
        followersModalTitle.textContent = `${authorLabel} Followers`;
        followersModalCount.textContent = `${numberLabel(Number(author.followersCount || 0))} follower${Number(author.followersCount || 0) === 1 ? "" : "s"}`;
        await ensureFollowersLoaded();
        renderFollowersModal();
      };

      const renderStats = () => {
        const followerCount = Number(author.followersCount || 0);
        stats.innerHTML = "";

        const storiesStat = document.createElement("span");
        storiesStat.textContent = `${stories.length} stories`;

        const followersStat = document.createElement("button");
        followersStat.type = "button";
        followersStat.className = "author-stat-btn";
        followersStat.textContent = `${numberLabel(followerCount)} followers`;
        followersStat.setAttribute("aria-label", `Open followers list for ${authorLabel}`);
        followersStat.addEventListener("click", async () => {
          if (profileAccessBlocked && !ownProfile) {
            showPageStatus("Followers are hidden because this profile is private.", "info");
            return;
          }
          await openFollowersModal();
        });

        stats.appendChild(storiesStat);
        stats.appendChild(followersStat);

        if (ownProfile) {
          if (editBtn) {
            editBtn.classList.remove("hidden");
          }
          if (settingsBtn) {
            settingsBtn.classList.remove("hidden");
          }
          followBtn.classList.add("hidden");
          if (notifyBtn) {
            notifyBtn.classList.add("hidden");
          }
          return;
        }
        if (editBtn) {
          editBtn.classList.add("hidden");
        }
        if (settingsBtn) {
          settingsBtn.classList.add("hidden");
        }
        followBtn.classList.remove("hidden");
        followBtn.classList.toggle("primary", follow.has(author.id));
        followBtn.textContent = follow.has(author.id) ? "Following" : "Follow";
        followBtn.setAttribute("aria-pressed", follow.has(author.id) ? "true" : "false");
        if (notifyBtn) {
          const hasNotify = authorNotify.has(author.id);
          notifyBtn.classList.remove("hidden");
          notifyBtn.classList.add("icon-action-btn");
          notifyBtn.classList.toggle("primary", hasNotify);
          notifyBtn.innerHTML = `${bellIconMarkup()}<span class="sr-only">${hasNotify ? "Author updates enabled" : "Get Author Updates"}</span>`;
          notifyBtn.setAttribute("aria-label", hasNotify ? "Author updates enabled" : "Get Author Updates");
          notifyBtn.setAttribute("aria-pressed", hasNotify ? "true" : "false");
          notifyBtn.setAttribute("data-tooltip", hasNotify ? "Author Updates On" : "Get Author Updates");
        }
      };

      if (editBtn) {
        editBtn.onclick = () => {
          window.location.href = "writer-profile.html";
        };
      }
      if (settingsBtn) {
        settingsBtn.onclick = () => {
          window.location.href = "settings.html";
        };
      }

      if (!followersModal.dataset.bound) {
        followersModal.dataset.bound = "true";
        followersModal.addEventListener("click", (event) => {
          if (event.target === followersModal) {
            closeFollowersModal();
          }
        });
        followersModalClose.addEventListener("click", closeFollowersModal);
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && !followersModal.classList.contains("hidden")) {
            closeFollowersModal();
          }
        });
      }

      if (!ownProfile) {
        followBtn.addEventListener("click", async () => {
          followBtn.disabled = true;
          try {
            const result = follow.has(author.id)
              ? await api.unfollowAuthor(author.id)
              : await api.followAuthor(author.id);
            if (result.following) {
              follow.add(author.id);
            } else {
              follow.delete(author.id);
            }
            state.readerState.followedAuthorIds = [...follow];
            author.followersCount = Number(result.followersCount || 0);
            syncFollowerList(!!result.following);
            mirrorReaderStateToLocal();
            renderStats();
            if (!followersModal.classList.contains("hidden")) {
              renderFollowersModal();
            }
          } catch (error) {
            showPageStatus(api.getErrorMessage(error, "Follow update failed."), "error");
          } finally {
            followBtn.disabled = false;
          }
        });

        if (notifyBtn) {
          notifyBtn.addEventListener("click", async () => {
            notifyBtn.disabled = true;
            try {
              const result = authorNotify.has(author.id)
                ? await api.unsubscribeAuthorUpdates(author.id)
                : await api.subscribeAuthorUpdates(author.id);
              if (result.subscribed) {
                authorNotify.add(author.id);
              } else {
                authorNotify.delete(author.id);
              }
              state.readerState.subscribedAuthorIds = [...authorNotify];
              mirrorReaderStateToLocal();
              renderStats();
              showPageStatus(result.subscribed ? `You'll get updates from ${author.name}.` : `Author updates turned off for ${author.name}.`, "success");
            } catch (error) {
              showPageStatus(api.getErrorMessage(error, "Author update toggle failed."), "error");
            } finally {
              notifyBtn.disabled = false;
            }
          });
        }
      }

      const renderPublicCollections = () => {
        collectionsNode.innerHTML = "";

        if (!publicCollections.length) {
          collectionsNode.innerHTML = `<div class="empty">${ownProfile ? "You have not shared any public collections yet." : "No public collections available yet."}</div>`;
          return;
        }

        publicCollections.forEach((collection) => {
          const card = document.createElement("article");
          card.className = "hero-card profile-collection-card";

          const storiesInCollection = collection.storyIds.map((id) => storyById(id)).filter(Boolean);
          const title = document.createElement("div");
          title.className = "profile-collection-head";
          title.innerHTML = `
            <div>
              <h3 class="section-title">${escapeHTML(collection.name)}</h3>
              <p class="profile-collection-meta">${storiesInCollection.length} book${storiesInCollection.length === 1 ? "" : "s"} | Updated ${escapeHTML(toDateLabel(collection.updatedAt))}</p>
            </div>
            <span class="visibility-badge is-public">Public List</span>
          `;
          card.appendChild(title);

          const grid = document.createElement("div");
          grid.className = "story-grid";

          if (!storiesInCollection.length) {
            grid.innerHTML = '<div class="empty">No public books are available in this list right now.</div>';
          } else {
            storiesInCollection.forEach((story) => grid.appendChild(storyCard(story)));
          }

          card.appendChild(grid);
          collectionsNode.appendChild(card);
        });
      };

      const openReplyEditor = (entry) => {
        const entryId = String(entry && entry.id || "").trim();
        if (!entryId) {
          return;
        }
        activeReplyEditorId = entryId;
        renderProfileQuestions();
      };

      const closeReplyEditor = (entryId) => {
        if (activeReplyEditorId === String(entryId || "").trim()) {
          activeReplyEditorId = "";
        }
        renderProfileQuestions();
      };

      const createDeleteQuestionButton = (entry) => {
        const button = document.createElement("button");
        button.className = "btn";
        button.type = "button";
        button.textContent = "Delete Question";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await api.deleteAuthorProfileComment(entry.id);
            profileQuestions = profileQuestions.filter((item) => item.id !== entry.id);
            if (activeReplyEditorId === entry.id) {
              activeReplyEditorId = "";
            }
            renderProfileQuestions();
            setQuestionStatus("Question deleted.", "ok");
          } catch (error) {
            setQuestionStatus(api.getErrorMessage(error, "Question could not be deleted."), "err");
          } finally {
            button.disabled = false;
          }
        });
        return button;
      };

      const renderProfileQuestions = () => {
        questionList.innerHTML = "";

        if (!profileQuestions.length) {
          questionList.innerHTML = `<div class="empty">${ownProfile ? "No reader questions yet. Once readers ask something, you can reply here." : `No one has asked ${escapeHTML(authorLabel)} anything yet. Be the first to ask.`}</div>`;
          return;
        }

        profileQuestions.forEach((entry) => {
          const card = document.createElement("article");
          card.className = "profile-question-card";
          const entryId = String(entry && entry.id || "").trim();
          const hasReply = !!String(entry && entry.replyText || "").trim();
          const isEditingReply = ownProfile && activeReplyEditorId === entryId;
          const asker = entry && entry.user ? entry.user : null;
          const askerName = displayName(asker || {}) || "Reader";
          const avatarStyle = asker && asker.avatarUrl
            ? `background-image:url("${String(asker.avatarUrl || "").replace(/"/g, "%22")}");background-size:cover;background-position:center;background-color:#0f172a;`
            : `background:${authorGradient(asker && asker.avatarColor || "#7C7CFF")};`;

          card.innerHTML = `
            <div class="profile-question-head">
              <div class="profile-question-avatar" style="${avatarStyle}">${asker && asker.avatarUrl ? "" : escapeHTML(askerName.charAt(0).toUpperCase())}</div>
              <div class="profile-question-meta">
                <strong>${escapeHTML(askerName)}</strong>
                <div class="profile-question-time">@${escapeHTML(usernameValue(asker || {}, "reader"))} | ${escapeHTML(toDateLabel(entry.createdAt))}</div>
              </div>
            </div>
            <div class="profile-question-text">${plainTextToHTML(entry.text || "")}</div>
          `;

          if (hasReply && !isEditingReply) {
            const replyCard = document.createElement("div");
            replyCard.className = "profile-reply-card";
            replyCard.innerHTML = `
              <div class="profile-reply-label">${escapeHTML(authorLabel)} replied</div>
              <div class="profile-reply-text">${plainTextToHTML(entry.replyText)}</div>
            `;
            card.appendChild(replyCard);
          }

          if (ownProfile) {
            if (isEditingReply) {
              const replyEditor = document.createElement("div");
              replyEditor.className = "profile-reply-card profile-reply-editor";

              const replyLabel = document.createElement("div");
              replyLabel.className = "profile-reply-label";
              replyLabel.textContent = hasReply ? `Edit reply to ${askerName}` : `Reply to ${askerName}`;

              const replyInput = document.createElement("textarea");
              replyInput.className = "profile-reply-input";
              replyInput.maxLength = 1000;
              replyInput.placeholder = `Reply to ${askerName}...`;
              replyInput.value = entry.replyText || "";

              const replyActions = document.createElement("div");
              replyActions.className = "profile-reply-actions";

              const saveReplyBtn = document.createElement("button");
              saveReplyBtn.className = "btn primary";
              saveReplyBtn.type = "button";
              saveReplyBtn.textContent = hasReply ? "Save Reply" : "Post Reply";
              saveReplyBtn.addEventListener("click", async () => {
                saveReplyBtn.disabled = true;
                cancelReplyBtn.disabled = true;
                deleteQuestionBtn.disabled = true;
                try {
                  const result = await api.replyAuthorProfileComment(entry.id, {
                    text: replyInput.value
                  });
                  profileQuestions = profileQuestions.map((item) => item.id === entry.id ? result.comment : item);
                  activeReplyEditorId = "";
                  renderProfileQuestions();
                  setQuestionStatus(hasReply ? "Reply updated." : "Reply posted.", "ok");
                } catch (error) {
                  setQuestionStatus(api.getErrorMessage(error, "Reply could not be saved."), "err");
                } finally {
                  saveReplyBtn.disabled = false;
                  cancelReplyBtn.disabled = false;
                  deleteQuestionBtn.disabled = false;
                }
              });

              const cancelReplyBtn = document.createElement("button");
              cancelReplyBtn.className = "btn";
              cancelReplyBtn.type = "button";
              cancelReplyBtn.textContent = "Cancel";
              cancelReplyBtn.addEventListener("click", () => {
                closeReplyEditor(entry.id);
              });

              const deleteQuestionBtn = createDeleteQuestionButton(entry);

              replyActions.appendChild(saveReplyBtn);
              replyActions.appendChild(cancelReplyBtn);
              replyActions.appendChild(deleteQuestionBtn);
              replyEditor.appendChild(replyLabel);
              replyEditor.appendChild(replyInput);
              replyEditor.appendChild(replyActions);
              card.appendChild(replyEditor);

              window.requestAnimationFrame(() => {
                if (activeReplyEditorId === entryId) {
                  replyInput.focus();
                  replyInput.setSelectionRange(replyInput.value.length, replyInput.value.length);
                }
              });
            } else {
              const ownerActions = document.createElement("div");
              ownerActions.className = "profile-question-owner-actions";

              const editReplyBtn = document.createElement("button");
              editReplyBtn.className = `btn${hasReply ? "" : " primary"}`;
              editReplyBtn.type = "button";
              editReplyBtn.textContent = hasReply ? "Edit Reply" : "Reply";
              editReplyBtn.addEventListener("click", () => {
                openReplyEditor(entry);
              });

              ownerActions.appendChild(editReplyBtn);
              ownerActions.appendChild(createDeleteQuestionButton(entry));
              card.appendChild(ownerActions);
            }
          }

          questionList.appendChild(card);
        });
      };

      questionForm.onsubmit = async (event) => {
        event.preventDefault();
        if (ownProfile) {
          return;
        }

        questionSubmit.disabled = true;
        try {
          const result = await api.createAuthorProfileComment(author.id, {
            text: questionInput.value
          });
          profileQuestions = [result.comment, ...profileQuestions];
          questionInput.value = "";
          renderProfileQuestions();
          setActiveProfileTab("questions");
          setQuestionStatus(`Question sent to ${authorLabel}.`, "ok");
        } catch (error) {
          setQuestionStatus(api.getErrorMessage(error, "Question could not be posted."), "err");
        } finally {
          questionSubmit.disabled = false;
        }
      };

      storiesNode.innerHTML = "";
      if (!stories.length) {
        storiesNode.innerHTML = '<div class="empty">No stories published yet.</div>';
      } else {
        stories.forEach((story) => storiesNode.appendChild(storyCard(story)));
      }
      renderPublicCollections();
      renderProfileQuestions();
      renderStats();
      return;
    }

    if (page === "library" || page === "collection") {
      const isLibraryPage = page === "library";
      const isCollectionPage = page === "collection";
      const currentReadsNode = document.getElementById("currentReads");
      const continueNode = document.getElementById("continueStories");
      const currentReadsCount = document.getElementById("currentReadsCount");
      const currentReadsRemaining = document.getElementById("currentReadsRemaining");
      const collectionCount = document.getElementById("collectionCount");
      const collectionSavedCount = document.getElementById("collectionSavedCount");
      const collectionCreateForm = document.getElementById("collectionCreateForm");
      const collectionNameInput = document.getElementById("collectionNameInput");
      const collectionTabs = document.getElementById("collectionTabs");
      const collectionFocusSection = document.getElementById("collectionFocusSection");
      const collectionActiveTitle = document.getElementById("collectionActiveTitle");
      const collectionInfo = document.getElementById("collectionInfo");
      const collectionStories = document.getElementById("collectionStories");
      const collectionSourceWrap = document.getElementById("collectionSourceWrap");
      const collectionSourceTitle = document.getElementById("collectionSourceTitle");
      const collectionSourceStories = document.getElementById("collectionSourceStories");
      const collectionVisibilityBtn = document.getElementById("collectionVisibilityBtn");
      const collectionVisibilityBadge = document.getElementById("collectionVisibilityBadge");
      const deleteCollectionBtn = document.getElementById("deleteCollectionBtn");

      if (isLibraryPage && (!currentReadsNode || !continueNode)) {
        return;
      }

      if (
        isCollectionPage && (
          !collectionCreateForm ||
          !collectionNameInput ||
          !collectionTabs ||
          !collectionFocusSection ||
          !collectionActiveTitle ||
          !collectionInfo ||
          !collectionStories ||
          !collectionSourceWrap ||
          !collectionSourceTitle ||
          !collectionSourceStories ||
          !collectionVisibilityBtn ||
          !collectionVisibilityBadge ||
          !deleteCollectionBtn
        )
      ) {
        return;
      }
      const CURRENT_READ_LIMIT = 24;
      const collectionParams = new URLSearchParams(window.location.search);
      let selectedCollectionId = String(collectionParams.get("collection") || collectionParams.get("board") || "").trim();

      function uniqueStories(list) {
        const seen = new Set();
        return (Array.isArray(list) ? list : []).filter((story) => {
          const id = String(story && story.id || "").trim();
          if (!id || seen.has(id)) {
            return false;
          }
          seen.add(id);
          return true;
        });
      }

      function currentReadStories() {
        const ids = Array.isArray(state.readerState.currentReadStoryIds) && state.readerState.currentReadStoryIds.length
          ? state.readerState.currentReadStoryIds
          : state.readerState.savedStoryIds;
        return (Array.isArray(ids) ? ids : []).map((id) => storyById(id)).filter(Boolean);
      }

      function completedStories() {
        return (Array.isArray(state.readerState.completedStoryIds) ? state.readerState.completedStoryIds : []).map((id) => storyById(id)).filter(Boolean);
      }

      function recentStories() {
        const recentIds = getState(state.keys.recent, []);
        return (Array.isArray(recentIds) ? recentIds.slice(0, 12) : []).map((id) => storyById(id)).filter(Boolean);
      }

      function continueStories() {
        const progress = progressState();
        const currentIds = new Set((Array.isArray(state.readerState.currentReadStoryIds) && state.readerState.currentReadStoryIds.length
          ? state.readerState.currentReadStoryIds
          : state.readerState.savedStoryIds) || []);
        return Object.entries(progress || {})
          .filter(([storyId, meta]) => currentIds.has(storyId) && meta && meta.percent > 0 && meta.percent < 100)
          .sort((a, b) => new Date(b[1].updatedAt || 0) - new Date(a[1].updatedAt || 0))
          .slice(0, 8)
          .map(([storyId, meta]) => ({
            story: storyById(storyId),
            meta
          }))
          .filter((entry) => !!entry.story);
      }

      function availableCollections() {
        return collectionListsState();
      }

      function selectedCollection() {
        const lists = availableCollections();
        if (!lists.length) {
          selectedCollectionId = "";
          return null;
        }

        const existing = lists.find((item) => item.id === selectedCollectionId);
        if (existing) {
          return existing;
        }

        selectedCollectionId = "";
        return null;
      }

      function replaceCollectionQuery(collectionId) {
        if (!isCollectionPage || !window.history || typeof window.history.replaceState !== "function") {
          return;
        }

        const nextUrl = new URL(window.location.href);
        if (collectionId) {
          nextUrl.searchParams.set("collection", collectionId);
        } else {
          nextUrl.searchParams.delete("collection");
          nextUrl.searchParams.delete("board");
        }
        window.history.replaceState({}, "", nextUrl.toString());
      }

      function openCollectionBoard(collectionId, options = {}) {
        const nextId = String(collectionId || "").trim();
        const shouldScroll = options.scroll !== false;
        const behavior = options.behavior || "smooth";

        selectedCollectionId = nextId;
        renderLibraryPage();
        replaceCollectionQuery(nextId);

        if (!nextId || !shouldScroll || !collectionFocusSection || collectionFocusSection.classList.contains("hidden")) {
          return;
        }

        window.requestAnimationFrame(() => {
          collectionFocusSection.scrollIntoView({
            behavior,
            block: "start"
          });
        });
      }

      function collectionPreviewStories(collection, limit = 4) {
        return (Array.isArray(collection && collection.storyIds) ? collection.storyIds : [])
          .map((id) => storyById(id))
          .filter(Boolean)
          .slice(0, limit);
      }

      function collectionBadgeText(collection) {
        if (!collection) {
          return "";
        }

        if (collection.isSystem) {
          return "Automatic";
        }

        return collection.isPublic ? "Public" : "Private";
      }

      function collectionSummaryText(collection) {
        if (!collection) {
          return "";
        }

        const storyCount = Array.isArray(collection.storyIds) ? collection.storyIds.length : 0;

        if (collection.isSystem) {
          return `${storyCount} finished book${storyCount === 1 ? "" : "s"}`;
        }

        return `${storyCount} book${storyCount === 1 ? "" : "s"} | ${collection.isPublic ? "Shared board" : "Only you can see this"}`;
      }

      function collectionUniqueStoryCount(list) {
        const ids = new Set();
        (Array.isArray(list) ? list : []).forEach((collection) => {
          (Array.isArray(collection && collection.storyIds) ? collection.storyIds : []).forEach((storyId) => {
            if (storyId) {
              ids.add(storyId);
            }
          });
        });
        return ids.size;
      }

      function renderCollectionVisibilityControls(collection) {
        if (!collectionVisibilityBtn || !collectionVisibilityBadge) {
          return;
        }

        if (!collection || collection.isSystem) {
          collectionVisibilityBtn.classList.add("hidden");
          collectionVisibilityBadge.classList.add("hidden");
          collectionVisibilityBadge.classList.remove("is-public", "is-private");
          collectionVisibilityBadge.textContent = "";
          return;
        }

        collectionVisibilityBadge.classList.remove("hidden", "is-public", "is-private");
        collectionVisibilityBadge.classList.add(collection.isPublic ? "is-public" : "is-private");
        collectionVisibilityBadge.textContent = collectionVisibilityLabel(collection);

        collectionVisibilityBtn.classList.remove("hidden");
        collectionVisibilityBtn.textContent = collection.isPublic ? "Keep Private" : "Share Board";
      }

      function makeActionButton(label, onClick, primary = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = primary ? "btn primary" : "btn";
        button.textContent = label;
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          button.disabled = true;
          try {
            await onClick();
          } catch (error) {
            button.disabled = false;
            showPageStatus(api.getErrorMessage(error, "Action failed."), "error");
          }
        });
        return button;
      }

      function buildManagedStoryCard(story, options = {}) {
        const card = storyCard(story, options.progress);
        const body = card.querySelector(".story-body");
        const actions = Array.isArray(options.actions) ? options.actions : [];

        if (!body || !actions.length) {
          return card;
        }

        const footer = document.createElement("div");
        footer.className = "story-card-actions";

        actions.forEach((action) => {
          footer.appendChild(makeActionButton(action.label, action.onClick, !!action.primary));
        });

        body.appendChild(footer);
        return card;
      }

      async function refreshLibraryView(message, type = "success") {
        await loadReaderState();
        renderLibraryPage();
        if (message) {
          showPageStatus(message, type);
        }
      }

      async function removeFromCurrentReads(story) {
        await api.unsaveStory(story.id);
        await refreshLibraryView(`Removed "${story.title}" from Current Reads.`);
      }

      async function markAsFinished(story) {
        const chapters = chaptersFor(story);
        await api.updateReadingProgress(story.id, {
          percent: 100,
          chapterPosition: chapters.length
        });
        await refreshLibraryView(`"${story.title}" moved to Completed.`);
      }

      async function addToCollection(story, collection) {
        await api.addStoryToCollection(collection.id, story.id);
        await refreshLibraryView(`Added "${story.title}" to ${collection.name}.`);
      }

      async function removeFromCollection(story, collection) {
        await api.removeStoryFromCollection(collection.id, story.id);
        await refreshLibraryView(`Removed "${story.title}" from ${collection.name}.`);
      }

      function renderStats() {
        const reads = currentReadStories();
        const allLists = availableCollections();
        const lists = allLists.filter((item) => !item.isSystem);
        if (currentReadsCount) {
          currentReadsCount.textContent = `${reads.length} / ${CURRENT_READ_LIMIT}`;
        }
        if (currentReadsRemaining) {
          currentReadsRemaining.textContent = String(Math.max(0, CURRENT_READ_LIMIT - reads.length));
        }
        if (collectionCount) {
          collectionCount.textContent = String(lists.length);
        }
        if (collectionSavedCount) {
          collectionSavedCount.textContent = String(collectionUniqueStoryCount(allLists));
        }
      }

      function renderCurrentReads() {
        const reads = currentReadStories();
        const activeCollection = isCollectionPage ? selectedCollection() : null;
        currentReadsNode.innerHTML = "";

        if (!reads.length) {
          currentReadsNode.innerHTML = '<div class="empty">No active books yet. Start a story to claim one of your 24 reading slots.</div>';
          return;
        }

        reads.forEach((story) => {
          const actions = [
            {
              label: "Open Story",
              primary: true,
              onClick: async () => {
                openStory(story.id);
              }
            },
            {
              label: "Mark Finished",
              onClick: async () => {
                await markAsFinished(story);
              }
            },
            {
              label: "Remove",
              onClick: async () => {
                await removeFromCurrentReads(story);
              }
            }
          ];

          if (activeCollection && !activeCollection.isSystem && !activeCollection.storyIds.includes(story.id)) {
            actions.push({
              label: `Add to ${activeCollection.name}`,
              onClick: async () => {
                await addToCollection(story, activeCollection);
              }
            });
          }

          currentReadsNode.appendChild(buildManagedStoryCard(story, {
            progress: progressState()[story.id],
            actions
          }));
        });
      }

      function renderContinueReading() {
        const list = continueStories();
        continueNode.innerHTML = "";

        if (!list.length) {
          continueNode.innerHTML = '<div class="empty">No active reading progress yet. Once you start reading, your in-progress stories will show up here.</div>';
          return;
        }

        list.forEach(({ story, meta }) => {
          continueNode.appendChild(buildManagedStoryCard(story, {
            progress: meta,
            actions: [
              {
                label: "Continue",
                primary: true,
                onClick: async () => {
                  openStory(story.id);
                }
              }
            ]
          }));
        });
      }

      function renderCollectionTabs() {
        if (!collectionTabs) {
          return;
        }
        const lists = availableCollections();
        const activeCollection = selectedCollection();
        collectionTabs.innerHTML = "";

        if (!lists.length) {
          collectionTabs.innerHTML = '<div class="empty">Your collection lists will appear here.</div>';
          return;
        }

        lists.forEach((collection) => {
          const storyCount = Array.isArray(collection.storyIds) ? collection.storyIds.length : 0;
          const button = document.createElement("button");
          button.type = "button";
          const previewStories = collectionPreviewStories(collection);
          button.className = `collection-board${activeCollection && activeCollection.id === collection.id ? " active" : ""}${collection.isSystem ? " is-system" : ""}`;
          button.setAttribute("aria-pressed", activeCollection && activeCollection.id === collection.id ? "true" : "false");
          button.setAttribute("aria-expanded", activeCollection && activeCollection.id === collection.id ? "true" : "false");
          button.setAttribute("aria-controls", "collectionFocusSection");

          const media = document.createElement("div");
          media.className = "collection-board-media";

          for (let index = 0; index < 4; index += 1) {
            const tile = document.createElement("div");
            tile.className = "collection-board-tile";
            const previewStory = previewStories[index];

            if (previewStory) {
              tile.style.cssText = coverStyle(previewStory);
            } else {
              tile.classList.add("is-empty");
              tile.style.background = collection.isSystem
                ? "linear-gradient(160deg, rgba(14,165,233,0.36), rgba(15,23,42,0.94))"
                : "linear-gradient(160deg, rgba(124,124,255,0.26), rgba(15,23,42,0.94))";
            }

            media.appendChild(tile);
          }

          const countPill = document.createElement("span");
          countPill.className = "collection-board-count";
          countPill.textContent = String(storyCount);
          media.appendChild(countPill);

          const footer = document.createElement("div");
          footer.className = "collection-board-foot";

          const heading = document.createElement("div");
          heading.className = "collection-board-heading";

          const title = document.createElement("strong");
          title.className = "collection-board-title";
          title.textContent = collection.name;

          const badge = document.createElement("span");
          badge.className = `collection-board-chip${collection.isSystem ? " is-system" : collection.isPublic ? " is-public" : " is-private"}`;
          badge.textContent = collectionBadgeText(collection);

          heading.appendChild(title);
          heading.appendChild(badge);

          const meta = document.createElement("p");
          meta.className = "collection-board-meta";
          meta.textContent = collectionSummaryText(collection);

          const dateLine = document.createElement("p");
          dateLine.className = "collection-board-date";
          dateLine.textContent = `Updated ${toDateLabel(collection.updatedAt)}`;

          footer.appendChild(heading);
          footer.appendChild(meta);
          footer.appendChild(dateLine);
          button.appendChild(media);
          button.appendChild(footer);
          button.addEventListener("click", () => {
            openCollectionBoard(collection.id);
          });
          collectionTabs.appendChild(button);
        });
      }

      function renderSelectedCollection() {
        if (!collectionFocusSection || !collectionActiveTitle || !collectionInfo || !collectionStories || !collectionSourceWrap || !collectionSourceTitle || !collectionSourceStories || !deleteCollectionBtn || !collectionVisibilityBtn || !collectionVisibilityBadge) {
          return;
        }
        const activeCollection = selectedCollection();
        const reads = currentReadStories();
        const completed = completedStories();
        const recent = recentStories();
        collectionStories.innerHTML = "";
        collectionSourceStories.innerHTML = "";

        if (!activeCollection) {
          collectionFocusSection.classList.add("hidden");
          collectionActiveTitle.textContent = "Select a board";
          collectionInfo.textContent = "Create your first custom board to start organizing books.";
          collectionStories.innerHTML = '<div class="empty">No collection selected yet.</div>';
          collectionSourceWrap.classList.add("hidden");
          deleteCollectionBtn.classList.add("hidden");
          renderCollectionVisibilityControls(null);
          replaceCollectionQuery("");
          return;
        }

        collectionFocusSection.classList.remove("hidden");
        const storiesInCollection = activeCollection.storyIds.map((id) => storyById(id)).filter(Boolean);
        renderCollectionVisibilityControls(activeCollection);
        collectionActiveTitle.textContent = activeCollection.name;
        collectionInfo.textContent = activeCollection.isSystem
          ? `Completed books land here automatically after you finish them. ${storiesInCollection.length} book${storiesInCollection.length === 1 ? "" : "s"} currently inside.`
          : `${storiesInCollection.length} book${storiesInCollection.length === 1 ? "" : "s"} in this ${activeCollection.isPublic ? "public" : "private"} board. Updated ${toDateLabel(activeCollection.updatedAt)}.`;

        deleteCollectionBtn.classList.toggle("hidden", !!activeCollection.isSystem);
        deleteCollectionBtn.textContent = "Delete Board";

        if (!storiesInCollection.length) {
          collectionStories.innerHTML = `<div class="empty">${activeCollection.isSystem ? "No books have been completed yet." : `No books in ${escapeHTML(activeCollection.name)} yet. Add some titles from the suggestions below.`}</div>`;
        } else {
          storiesInCollection.forEach((story) => {
            const actions = [
              {
                label: "Open Story",
                primary: true,
                onClick: async () => {
                  openStory(story.id);
                }
              }
            ];

            if (!activeCollection.isSystem) {
              actions.push({
                label: "Remove from List",
                onClick: async () => {
                  await removeFromCollection(story, activeCollection);
                }
              });
            }

            collectionStories.appendChild(buildManagedStoryCard(story, {
              progress: progressState()[story.id],
              actions
            }));
          });
        }

        if (activeCollection.isSystem) {
          collectionSourceWrap.classList.add("hidden");
          return;
        }

        collectionSourceWrap.classList.remove("hidden");
        collectionSourceTitle.textContent = `Suggestions for ${activeCollection.name}`;

        const sourceStories = uniqueStories([...reads, ...completed, ...recent]).filter((story) => !activeCollection.storyIds.includes(story.id));

        if (!sourceStories.length) {
          collectionSourceStories.innerHTML = '<div class="empty">No extra books available to add right now. Start or finish more stories to expand this list.</div>';
          return;
        }

        sourceStories.forEach((story) => {
          collectionSourceStories.appendChild(buildManagedStoryCard(story, {
            progress: progressState()[story.id],
            actions: [
              {
                label: `Save to ${activeCollection.name}`,
                primary: true,
                onClick: async () => {
                  await addToCollection(story, activeCollection);
                }
              }
            ]
          }));
        });
      }

      function renderLibraryPage() {
        renderStats();
        if (isLibraryPage) {
          renderCurrentReads();
          renderContinueReading();
        }
        if (isCollectionPage) {
          renderCollectionTabs();
          renderSelectedCollection();
        }
      }

      if (collectionCreateForm) {
        collectionCreateForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const name = collectionNameInput.value.trim();
          if (!name) {
            showPageStatus("Please enter a collection name.", "error");
            return;
          }

          const submitBtn = collectionCreateForm.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
          }

          try {
            await api.createCollection(name);
            await loadReaderState();
            const created = availableCollections().find((item) => !item.isSystem && item.name.toLowerCase() === name.toLowerCase());
            collectionNameInput.value = "";
            openCollectionBoard(created ? created.id : "", {
              scroll: !!created,
              behavior: "smooth"
            });
            showPageStatus(`Board "${name}" created.`, "success");
          } catch (error) {
            showPageStatus(api.getErrorMessage(error, "Collection could not be created."), "error");
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
            }
          }
        });
      }

      if (collectionVisibilityBtn) {
        collectionVisibilityBtn.addEventListener("click", async () => {
          const activeCollection = selectedCollection();
          if (!activeCollection || activeCollection.isSystem) {
            return;
          }

          collectionVisibilityBtn.disabled = true;
          try {
            const nextIsPublic = !activeCollection.isPublic;
            await api.updateCollection(activeCollection.id, {
              isPublic: nextIsPublic
            });
            await loadReaderState();
            renderLibraryPage();
            replaceCollectionQuery(activeCollection.id);
            showPageStatus(`Board "${activeCollection.name}" is now ${nextIsPublic ? "public" : "private"}.`, "success");
          } catch (error) {
            showPageStatus(api.getErrorMessage(error, "Collection visibility could not be updated."), "error");
          } finally {
            collectionVisibilityBtn.disabled = false;
          }
        });
      }

      if (deleteCollectionBtn) {
        deleteCollectionBtn.addEventListener("click", async () => {
          const activeCollection = selectedCollection();
          if (!activeCollection || activeCollection.isSystem) {
            return;
          }

          if (!window.confirm(`Delete "${activeCollection.name}"?`)) {
            return;
          }

          deleteCollectionBtn.disabled = true;
          try {
            await api.deleteCollection(activeCollection.id);
            selectedCollectionId = "";
            await refreshLibraryView(`Board "${activeCollection.name}" deleted.`);
          } catch (error) {
            deleteCollectionBtn.disabled = false;
            showPageStatus(api.getErrorMessage(error, "Collection could not be deleted."), "error");
          } finally {
            deleteCollectionBtn.disabled = false;
          }
        });
      }

      renderLibraryPage();
      return;
    }
  }

  async function boot() {
    const session = api.getSession();
    if (!session) {
      window.location.href = "index.html";
      return;
    }
    showMainLoading("Loading reader space...", "Syncing stories, profile, and progress.");
    state.session = await api.hydrateCurrentUser();
    if (!state.session || !state.session.user) {
      await api.logout();
      window.location.href = "index.html";
      return;
    }
    setKeys(state.session.email);
    await Promise.all([
      loadData(),
      loadReaderState()
    ]);
    await syncLegacyReaderState();
    initHeader();
    await initPage();
    clearMainLoading();
    clearPageStatus();
  }

  boot().catch(async (error) => {
    if (error && error.status === 401) {
      await api.logout();
      window.location.href = "index.html";
      return;
    }
    const main = document.querySelector(".reader-main");
    if (main) {
      main.innerHTML = `<section class="hero-card"><h1 class="section-title">Something went wrong</h1><p class="section-sub">${escapeHTML(api.getErrorMessage(error, "Reader page failed to load."))}</p><a class="btn" href="explore.html">Try Explore Again</a></section>`;
    }
  });
})();
