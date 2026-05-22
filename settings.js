(() => {
  const api = window.MidnightAPI;
  if (!api) {
    return;
  }

  const state = {
    session: null,
    settings: null,
    privacy: null,
    notifications: null,
    deletionRequest: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(value) {
    return String(value || "").trim();
  }

  function setInlineStatus(node, message, type = "") {
    if (!node) {
      return;
    }

    node.textContent = safeText(message);
    node.className = `settings-inline-status ${type || ""}`.trim();
  }

  function setBanner(message, type = "") {
    const node = byId("settingsPageStatus");
    if (!node) {
      return;
    }

    const text = safeText(message);
    node.textContent = text;
    node.className = text ? `settings-banner ${type || ""}`.trim() : "settings-banner hidden";
    node.classList.toggle("hidden", !text);
  }

  function setSavePill(node, text, variant = "") {
    if (!node) {
      return;
    }

    node.textContent = safeText(text) || "Saved";
    node.className = `settings-save-pill ${variant || ""}`.trim();
  }

  function formatDateTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function currentSessionUser() {
    const session = api.getSession();
    return session && session.user ? session.user : null;
  }

  function syncHeader(user) {
    const sessionUser = user || currentSessionUser();
    const display = sessionUser && (sessionUser.displayName || sessionUser.username || sessionUser.email) || "Midnight User";
    const publicProfileLink = byId("settingsPublicProfileLink");
    const chip = byId("settingsUserChip");

    if (chip) {
      chip.textContent = display;
    }

    if (publicProfileLink && sessionUser && sessionUser.id) {
      publicProfileLink.href = `profile.html?authorId=${encodeURIComponent(sessionUser.id)}`;
    }
  }

  function renderDeletionState() {
    const button = byId("openDeleteRequestBtn");
    const meta = byId("deletionRequestMeta");
    const request = state.deletionRequest;

    if (!button || !meta) {
      return;
    }

    if (!request) {
      button.disabled = false;
      button.textContent = "Request Account Deletion";
      meta.textContent = "";
      meta.classList.add("hidden");
      return;
    }

    const status = safeText(request.status).toLowerCase();
    const createdAt = formatDateTime(request.createdAt);
    const reviewedAt = formatDateTime(request.updatedAt);
    const pieces = [];
    if (createdAt) {
      pieces.push(`Requested: ${createdAt}`);
    }
    if (request.reason) {
      pieces.push(`Reason: ${request.reason}`);
    }
    if (status !== "pending" && reviewedAt) {
      pieces.push(`Last updated: ${reviewedAt}`);
    }

    meta.textContent = pieces.join(" | ");
    meta.classList.toggle("hidden", !pieces.length);

    if (status === "pending") {
      button.disabled = true;
      button.textContent = "Deletion Request Pending";
      return;
    }

    button.disabled = false;
    button.textContent = "Request Account Deletion";
  }

  function applySettings(data) {
    state.settings = data || null;
    state.privacy = data && data.privacy ? { ...data.privacy } : null;
    state.notifications = data && data.notifications ? { ...data.notifications } : null;
    state.deletionRequest = data && data.deletionRequest ? data.deletionRequest : null;

    const account = data && data.account ? data.account : {};
    const privacy = state.privacy || {};
    const notifications = state.notifications || {};

    const emailInput = byId("settingsEmailInput");
    const profileVisibilitySelect = byId("profileVisibilitySelect");
    const followPermissionSelect = byId("followPermissionSelect");
    const storyCommentPermissionSelect = byId("storyCommentPermissionSelect");
    const readingActivityVisibilitySelect = byId("readingActivityVisibilitySelect");
    const notifyLikesToggle = byId("notifyLikesToggle");
    const notifyCommentsToggle = byId("notifyCommentsToggle");
    const notifyFollowsToggle = byId("notifyFollowsToggle");
    const notifyStoryUpdatesToggle = byId("notifyStoryUpdatesToggle");

    if (emailInput) {
      emailInput.value = account.email || "";
    }

    if (profileVisibilitySelect) {
      profileVisibilitySelect.value = privacy.profileVisibility || "public";
    }

    if (followPermissionSelect) {
      followPermissionSelect.value = privacy.followPermission || "everyone";
    }

    if (storyCommentPermissionSelect) {
      storyCommentPermissionSelect.value = privacy.storyCommentPermission || "everyone";
    }

    if (readingActivityVisibilitySelect) {
      readingActivityVisibilitySelect.value = privacy.readingActivityVisibility || "only_me";
    }

    if (notifyLikesToggle) {
      notifyLikesToggle.checked = notifications.likes !== false;
    }

    if (notifyCommentsToggle) {
      notifyCommentsToggle.checked = notifications.comments !== false;
    }

    if (notifyFollowsToggle) {
      notifyFollowsToggle.checked = notifications.follows !== false;
    }

    if (notifyStoryUpdatesToggle) {
      notifyStoryUpdatesToggle.checked = notifications.storyUpdates !== false;
    }

    syncHeader(data && data.user ? data.user : null);
    renderDeletionState();
    setSavePill(byId("privacySaveState"), "Saved");
    setSavePill(byId("notificationSaveState"), "Saved");
  }

  async function requireSession() {
    const existing = api.getSession();
    if (!existing) {
      window.location.href = "index.html";
      return null;
    }

    try {
      state.session = await api.hydrateCurrentUser();
      syncHeader(state.session && state.session.user ? state.session.user : null);
      return state.session;
    } catch (error) {
      await api.logout();
      window.location.href = "index.html";
      return null;
    }
  }

  async function loadSettings() {
    const data = await api.getCurrentUserSettings();
    applySettings(data);
    return data;
  }

  async function savePrivacy() {
    const pill = byId("privacySaveState");
    setSavePill(pill, "Saving...", "is-saving");

    try {
      const data = await api.updateCurrentUserPrivacySettings({
        ...state.privacy
      });
      applySettings(data);
      setSavePill(pill, "Saved");
    } catch (error) {
      if (state.settings) {
        applySettings(state.settings);
      }
      setSavePill(pill, "Retry needed", "is-error");
      setBanner(api.getErrorMessage(error, "Privacy settings could not be saved."), "error");
    }
  }

  async function saveNotifications() {
    const pill = byId("notificationSaveState");
    setSavePill(pill, "Saving...", "is-saving");

    try {
      const data = await api.updateCurrentUserNotificationSettings({
        ...state.notifications
      });
      applySettings(data);
      setSavePill(pill, "Saved");
    } catch (error) {
      if (state.settings) {
        applySettings(state.settings);
      }
      setSavePill(pill, "Retry needed", "is-error");
      setBanner(api.getErrorMessage(error, "Notification preferences could not be saved."), "error");
    }
  }

  function openDeleteModal() {
    const modal = byId("deleteRequestModal");
    if (!modal) {
      return;
    }

    setInlineStatus(byId("deleteModalStatus"), "");
    const passwordInput = byId("deleteRequestPasswordInput");
    if (passwordInput) {
      passwordInput.value = "";
    }
    modal.classList.remove("hidden");
  }

  function closeDeleteModal() {
    const modal = byId("deleteRequestModal");
    if (!modal) {
      return;
    }
    modal.classList.add("hidden");
  }

  function bindInteractions() {
    const logoutBtn = byId("settingsLogoutBtn");
    const emailForm = byId("accountEmailForm");
    const passwordForm = byId("passwordForm");
    const openDeleteRequestBtn = byId("openDeleteRequestBtn");
    const closeDeleteRequestModalBtn = byId("closeDeleteRequestModalBtn");
    const cancelDeleteRequestBtn = byId("cancelDeleteRequestBtn");
    const submitDeleteRequestBtn = byId("submitDeleteRequestBtn");
    const deleteRequestModal = byId("deleteRequestModal");

    const privacyControls = [
      byId("profileVisibilitySelect"),
      byId("followPermissionSelect"),
      byId("storyCommentPermissionSelect"),
      byId("readingActivityVisibilitySelect")
    ].filter(Boolean);

    const notificationControls = [
      byId("notifyLikesToggle"),
      byId("notifyCommentsToggle"),
      byId("notifyFollowsToggle"),
      byId("notifyStoryUpdatesToggle")
    ].filter(Boolean);

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await api.logout();
        window.location.href = "index.html";
      });
    }

    if (emailForm) {
      emailForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const emailInput = byId("settingsEmailInput");
        const saveEmailBtn = byId("saveEmailBtn");
        const statusNode = byId("accountEmailStatus");
        const email = safeText(emailInput && emailInput.value).toLowerCase();

        if (!email) {
          setInlineStatus(statusNode, "Email is required.", "error");
          return;
        }

        setInlineStatus(statusNode, "");
        if (saveEmailBtn) {
          saveEmailBtn.disabled = true;
          saveEmailBtn.textContent = "Saving...";
        }

        try {
          const data = await api.updateCurrentUserAccountSettings({ email });
          applySettings(data);
          setInlineStatus(statusNode, "Email updated successfully.", "success");
          setBanner("Account email updated.", "");
        } catch (error) {
          setInlineStatus(statusNode, api.getErrorMessage(error, "Email could not be updated."), "error");
        } finally {
          if (saveEmailBtn) {
            saveEmailBtn.disabled = false;
            saveEmailBtn.textContent = "Save Email";
          }
        }
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const statusNode = byId("passwordStatus");
        const button = byId("changePasswordBtn");
        const currentPassword = byId("currentPasswordInput");
        const newPassword = byId("newPasswordInput");
        const confirmPassword = byId("confirmPasswordInput");

        const currentValue = currentPassword ? currentPassword.value : "";
        const nextValue = newPassword ? newPassword.value : "";
        const confirmValue = confirmPassword ? confirmPassword.value : "";

        if (nextValue.length < 8) {
          setInlineStatus(statusNode, "New password must be at least 8 characters.", "error");
          return;
        }

        if (nextValue !== confirmValue) {
          setInlineStatus(statusNode, "Password confirmation does not match.", "error");
          return;
        }

        setInlineStatus(statusNode, "");
        if (button) {
          button.disabled = true;
          button.textContent = "Updating...";
        }

        try {
          state.session = await api.changePassword({
            currentPassword: currentValue,
            newPassword: nextValue,
            confirmPassword: confirmValue
          });
          syncHeader(state.session && state.session.user ? state.session.user : null);
          setInlineStatus(statusNode, "Password changed successfully.", "success");
          setBanner("Password updated and your session was refreshed.", "");
          if (currentPassword) currentPassword.value = "";
          if (newPassword) newPassword.value = "";
          if (confirmPassword) confirmPassword.value = "";
        } catch (error) {
          setInlineStatus(statusNode, api.getErrorMessage(error, "Password could not be changed."), "error");
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Change Password";
          }
        }
      });
    }

    privacyControls.forEach((control) => {
      control.addEventListener("change", async () => {
        state.privacy = {
          profileVisibility: byId("profileVisibilitySelect").value,
          followPermission: byId("followPermissionSelect").value,
          storyCommentPermission: byId("storyCommentPermissionSelect").value,
          readingActivityVisibility: byId("readingActivityVisibilitySelect").value
        };
        await savePrivacy();
      });
    });

    notificationControls.forEach((control) => {
      control.addEventListener("change", async () => {
        state.notifications = {
          likes: !!byId("notifyLikesToggle").checked,
          comments: !!byId("notifyCommentsToggle").checked,
          follows: !!byId("notifyFollowsToggle").checked,
          storyUpdates: !!byId("notifyStoryUpdatesToggle").checked
        };
        await saveNotifications();
      });
    });

    if (openDeleteRequestBtn) {
      openDeleteRequestBtn.addEventListener("click", openDeleteModal);
    }

    if (closeDeleteRequestModalBtn) {
      closeDeleteRequestModalBtn.addEventListener("click", closeDeleteModal);
    }

    if (cancelDeleteRequestBtn) {
      cancelDeleteRequestBtn.addEventListener("click", closeDeleteModal);
    }

    if (deleteRequestModal) {
      deleteRequestModal.addEventListener("click", (event) => {
        if (event.target === deleteRequestModal) {
          closeDeleteModal();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDeleteModal();
      }
    });

    if (submitDeleteRequestBtn) {
      submitDeleteRequestBtn.addEventListener("click", async () => {
        const button = submitDeleteRequestBtn;
        const statusNode = byId("deleteModalStatus");
        const requestStatus = byId("deletionRequestStatus");
        const reasonInput = byId("deleteRequestReasonInput");
        const passwordInput = byId("deleteRequestPasswordInput");
        const reason = safeText(reasonInput && reasonInput.value);
        const password = passwordInput ? passwordInput.value : "";

        if (!password) {
          setInlineStatus(statusNode, "Password is required to send this request.", "error");
          return;
        }

        setInlineStatus(statusNode, "");
        if (button) {
          button.disabled = true;
          button.textContent = "Sending...";
        }

        try {
          const data = await api.requestCurrentUserDeletion({
            reason,
            password
          });
          applySettings(data.settings || state.settings);
          state.deletionRequest = data.request || state.deletionRequest;
          renderDeletionState();
          closeDeleteModal();
          setInlineStatus(requestStatus, "Deletion request sent to admin review.", "success");
          setBanner("Your deletion request has been sent.", "");
        } catch (error) {
          setInlineStatus(statusNode, api.getErrorMessage(error, "Deletion request could not be sent."), "error");
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Send Request";
          }
        }
      });
    }
  }

  async function boot() {
    const session = await requireSession();
    if (!session) {
      return;
    }

    bindInteractions();

    try {
      await loadSettings();
    } catch (error) {
      setBanner(api.getErrorMessage(error, "Settings could not be loaded right now."), "error");
    }
  }

  boot().catch(async () => {
    await api.logout();
    window.location.href = "index.html";
  });
})();
