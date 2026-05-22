(() => {
  const api = window.MidnightAPI;
  const page = document.body.dataset.page;

  if (!api || page !== "admin") {
    return;
  }

  const state = {
    session: null,
    currentUser: null,
    users: [],
    stories: [],
    reports: [],
    deletionRequests: []
  };
  let statusTimer = null;

  const elements = {
    adminUserLine: document.getElementById("adminUserLine"),
    goHomeBtn: document.getElementById("goHomeBtn"),
    adminLogoutBtn: document.getElementById("adminLogoutBtn"),
    statTotalUsers: document.getElementById("statTotalUsers"),
    statTotalStories: document.getElementById("statTotalStories"),
    statTotalReports: document.getElementById("statTotalReports"),
    statTotalViews: document.getElementById("statTotalViews"),
    statActiveUsers: document.getElementById("statActiveUsers"),
    usersTableBody: document.getElementById("usersTableBody"),
    storiesTableBody: document.getElementById("storiesTableBody"),
    deletionRequestsList: document.getElementById("deletionRequestsList"),
    reportsList: document.getElementById("reportsList")
  };

  function normalizeEmail(value) {
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

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatRole(role) {
    const value = String(role || "user").trim().toLowerCase();
    return value || "user";
  }

  function formatStatus(status, fallback = "pending") {
    const value = String(status || fallback).trim().toLowerCase();
    return value || fallback;
  }

  function dateTime(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatIdentity(entity, fallback = "-") {
    if (!entity) {
      return fallback;
    }

    return entity.displayName || entity.email || entity.username || fallback;
  }

  function isPrivilegedRole(role) {
    const value = formatRole(role);
    return value === "admin" || value === "manager";
  }

  function canManageUsers() {
    return formatRole(state.currentUser && state.currentUser.role) === "admin";
  }

  function isManagerView() {
    return formatRole(state.currentUser && state.currentUser.role) === "manager";
  }

  function getRoleWeight(role) {
    const map = {
      admin: 0,
      manager: 1,
      user: 2
    };

    return map[formatRole(role)] ?? 3;
  }

  function getActiveUsersCount() {
    return state.users.filter((user) => !user.blocked).length;
  }

  function getLatestPendingDeletionRequestForUser(userId) {
    const targetId = String(userId || "").trim();
    if (!targetId) {
      return null;
    }

    const requests = state.deletionRequests
      .filter((request) => request && request.targetUserId === targetId && formatStatus(request.status) === "pending")
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

    return requests[0] || null;
  }

  function setTableEmpty(container, colspan, message) {
    if (!container) {
      return;
    }

    container.innerHTML = `<tr><td colspan="${colspan}"><div class="empty">${escapeHTML(message)}</div></td></tr>`;
  }

  function ensureStatusNode() {
    const main = document.querySelector(".admin-main");
    if (!main) {
      return null;
    }

    let node = document.getElementById("adminPageStatus");
    if (!node) {
      node = document.createElement("section");
      node.id = "adminPageStatus";
      node.className = "page-status hidden";
      main.prepend(node);
    }

    return node;
  }

  function clearStatus() {
    const node = document.getElementById("adminPageStatus");
    if (!node) {
      return;
    }

    node.textContent = "";
    node.className = "page-status hidden";
  }

  function showStatus(message, type = "info", persist = false) {
    const node = ensureStatusNode();
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
        clearStatus();
      }, 3200);
    }
  }

  function renderLoadingState() {
    [
      elements.statTotalUsers,
      elements.statTotalStories,
      elements.statTotalReports,
      elements.statTotalViews,
      elements.statActiveUsers
    ].forEach((node) => {
      if (node) {
        node.textContent = "--";
      }
    });

    setTableEmpty(elements.usersTableBody, 4, "Loading users...");
    setTableEmpty(elements.storiesTableBody, 5, "Loading stories...");

    if (elements.deletionRequestsList) {
      elements.deletionRequestsList.innerHTML = '<div class="empty">Loading deletion requests...</div>';
    }

    if (elements.reportsList) {
      elements.reportsList.innerHTML = '<div class="empty">Loading reports...</div>';
    }
  }

  function bindStaticActions() {
    if (elements.goHomeBtn) {
      elements.goHomeBtn.addEventListener("click", () => {
        window.location.href = "home.html";
      });
    }

    if (elements.adminLogoutBtn) {
      elements.adminLogoutBtn.addEventListener("click", async () => {
        await api.logout();
        window.location.href = "index.html";
      });
    }
  }

  async function loadData() {
    const [users, stories, reports, deletionRequests] = await Promise.all([
      api.listUsers(),
      api.listStories({}, { auth: "required" }),
      api.listReports(),
      api.listUserDeletionRequests()
    ]);

    state.users = Array.isArray(users) ? users : [];
    state.stories = Array.isArray(stories) ? stories : [];
    state.reports = Array.isArray(reports) ? reports : [];
    state.deletionRequests = Array.isArray(deletionRequests) ? deletionRequests : [];
  }

  function renderStats() {
    const openReports = state.reports.filter((report) => String(report.status || "open") !== "resolved");
    const totalViews = state.stories.reduce((sum, story) => sum + Number(story && story.reads ? story.reads : 0), 0);

    if (elements.statTotalUsers) {
      elements.statTotalUsers.textContent = formatNumber(state.users.length);
    }

    if (elements.statTotalStories) {
      elements.statTotalStories.textContent = formatNumber(state.stories.length);
    }

    if (elements.statTotalReports) {
      elements.statTotalReports.textContent = formatNumber(openReports.length);
    }

    if (elements.statTotalViews) {
      elements.statTotalViews.textContent = formatNumber(totalViews);
    }

    if (elements.statActiveUsers) {
      elements.statActiveUsers.textContent = formatNumber(getActiveUsersCount());
    }
  }

  async function refreshAndRender(message, type = "success") {
    await loadData();
    renderAll();
    if (message) {
      showStatus(message, type);
    }
  }

  async function handleUserRoleToggle(user) {
    const nextRole = formatRole(user.role) === "manager" ? "user" : "manager";
    await api.updateUser(user.id, { role: nextRole });
    await refreshAndRender(
      nextRole === "manager" ? "Manager access granted." : "Manager access removed.",
      "success"
    );
  }

  async function handleUserBlockToggle(user) {
    await api.updateUser(user.id, { blocked: !user.blocked });
    await refreshAndRender(user.blocked ? "User unblocked." : "User blocked.", "success");
  }

  async function handleSendDeletionWarning(user) {
    const reason = window.prompt(`Optional deletion reason for ${user.email}:`, "");
    if (reason === null) {
      return;
    }

    const isAdminAction = canManageUsers();
    const confirmed = window.confirm(
      isAdminAction
        ? `Send deletion warning to ${user.email}? After that, admin can permanently delete this account.`
        : `Request deletion for ${user.email}? The user will be warned and the request will go to admin approval.`
    );

    if (!confirmed) {
      return;
    }

    await api.sendUserDeletionWarning(user.id, {
      reason
    });

    await refreshAndRender(
      isAdminAction
        ? "Deletion warning sent. Account is now eligible for admin delete."
        : "Deletion request sent to admin and warning delivered to the user.",
      "success"
    );
  }

  async function handleDeleteUser(user, request) {
    const isManagerRequest = formatRole(request && request.requestedBy && request.requestedBy.role) === "manager";
    const confirmed = window.confirm(
      isManagerRequest
        ? `Approve and permanently delete ${user.email}? This manager request cannot be undone.`
        : `Permanently delete ${user.email}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    await api.deleteUser(user.id);
    await refreshAndRender(
      isManagerRequest ? "Deletion request approved and account removed." : "Account deleted permanently.",
      "success"
    );
  }

  async function handleReviewDeletionRequest(request, action) {
    const targetEmail = request.targetEmail || formatIdentity(request.targetUser, "this user");
    const normalizedAction = formatStatus(action, "approve");
    const confirmed = window.confirm(
      normalizedAction === "approve"
        ? `Approve deletion for ${targetEmail}? This permanently deletes the account.`
        : `Reject deletion request for ${targetEmail}?`
    );

    if (!confirmed) {
      return;
    }

    await api.reviewUserDeletionRequest(request.id, {
      action: normalizedAction
    });

    await refreshAndRender(
      normalizedAction === "approve" ? "Deletion request approved and account removed." : "Deletion request rejected.",
      "success"
    );
  }

  function renderUsersTable() {
    if (!elements.usersTableBody) {
      return;
    }

    const sortedUsers = [...state.users].sort((left, right) => {
      const roleGap = getRoleWeight(left.role) - getRoleWeight(right.role);
      if (roleGap !== 0) {
        return roleGap;
      }

      return normalizeEmail(left.email).localeCompare(normalizeEmail(right.email));
    });

    elements.usersTableBody.innerHTML = "";

    if (!sortedUsers.length) {
      setTableEmpty(elements.usersTableBody, 4, "No users found.");
      return;
    }

    sortedUsers.forEach((user) => {
      const role = formatRole(user.role);
      const isSelf = state.currentUser && state.currentUser.id === user.id;
      const isAdminTarget = role === "admin";
      const pendingRequest = getLatestPendingDeletionRequestForUser(user.id);
      const canEditUser = canManageUsers() && !isSelf && !isAdminTarget;
      const canWarnUser = canManageUsers() && !isSelf && !pendingRequest;
      const canDeleteUser = canManageUsers() && !isSelf && !!pendingRequest;
      const canRequestDelete = isManagerView() && !isSelf && role !== "admin" && !pendingRequest;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHTML(user.email)}</td>
        <td><span class="role ${escapeHTML(role)}">${escapeHTML(role)}</span></td>
        <td><span class="status ${user.blocked ? "blocked" : "active"}">${user.blocked ? "Blocked" : "Active"}</span></td>
        <td>
          <div class="cell-actions">
            <button class="btn small ${role === "manager" ? "warn" : "success"}" data-action="manager">
              ${role === "manager" ? "Remove Manager" : "Assign Manager"}
            </button>
            <button class="btn small ${user.blocked ? "success" : "danger"}" data-action="block">
              ${user.blocked ? "Unblock User" : "Block User"}
            </button>
            ${canManageUsers() ? `
              <button class="btn small warn" data-action="warn-delete">
                ${pendingRequest ? "Warning Sent" : "Send Warning"}
              </button>
              <button class="btn small danger" data-action="delete-user">
                ${pendingRequest && formatRole(pendingRequest.requestedBy && pendingRequest.requestedBy.role) === "manager"
                  ? "Approve Delete"
                  : "Delete User"}
              </button>
            ` : ""}
            ${isManagerView() ? `
              <button class="btn small danger" data-action="request-delete">
                ${pendingRequest ? "Approval Pending" : "Request Delete"}
              </button>
            ` : ""}
          </div>
        </td>
      `;

      const managerBtn = row.querySelector('[data-action="manager"]');
      const blockBtn = row.querySelector('[data-action="block"]');
      const warnBtn = row.querySelector('[data-action="warn-delete"]');
      const deleteBtn = row.querySelector('[data-action="delete-user"]');
      const requestBtn = row.querySelector('[data-action="request-delete"]');

      if (managerBtn) {
        managerBtn.disabled = !canEditUser;
        managerBtn.title = canEditUser
          ? ""
          : (canManageUsers() ? "Admin role cannot be changed." : "Only admin can manage roles.");

        if (canEditUser) {
          managerBtn.addEventListener("click", async () => {
            try {
              managerBtn.disabled = true;
              await handleUserRoleToggle(user);
            } catch (error) {
              showStatus(api.getErrorMessage(error, "User role update failed."), "error");
              renderUsersTable();
            }
          });
        }
      }

      if (blockBtn) {
        blockBtn.disabled = !canEditUser;
        blockBtn.title = canEditUser
          ? ""
          : (canManageUsers() ? "Admin account cannot be blocked." : "Only admin can manage block status.");

        if (canEditUser) {
          blockBtn.addEventListener("click", async () => {
            try {
              blockBtn.disabled = true;
              await handleUserBlockToggle(user);
            } catch (error) {
              showStatus(api.getErrorMessage(error, "User block update failed."), "error");
              renderUsersTable();
            }
          });
        }
      }

      if (warnBtn) {
        warnBtn.disabled = !canWarnUser;
        warnBtn.title = canWarnUser
          ? ""
          : (isSelf
            ? "You cannot delete your own account."
            : (pendingRequest ? "A deletion warning is already pending." : ""));

        if (canWarnUser) {
          warnBtn.addEventListener("click", async () => {
            try {
              warnBtn.disabled = true;
              await handleSendDeletionWarning(user);
            } catch (error) {
              showStatus(api.getErrorMessage(error, "Deletion warning failed."), "error");
              renderUsersTable();
            }
          });
        }
      }

      if (deleteBtn) {
        deleteBtn.disabled = !canDeleteUser;
        deleteBtn.title = canDeleteUser
          ? ""
          : (isSelf
            ? "You cannot delete your own account."
            : "Send a warning first.");

        if (canDeleteUser) {
          deleteBtn.addEventListener("click", async () => {
            try {
              deleteBtn.disabled = true;
              await handleDeleteUser(user, pendingRequest);
            } catch (error) {
              showStatus(api.getErrorMessage(error, "Account delete failed."), "error");
              renderUsersTable();
            }
          });
        }
      }

      if (requestBtn) {
        requestBtn.disabled = !canRequestDelete;
        requestBtn.title = canRequestDelete
          ? ""
          : (isSelf
            ? "You cannot request deletion of your own account."
            : (role === "admin"
              ? "Manager cannot request deletion of an admin."
              : (pendingRequest ? "Deletion approval is already pending." : "")));

        if (canRequestDelete) {
          requestBtn.addEventListener("click", async () => {
            try {
              requestBtn.disabled = true;
              await handleSendDeletionWarning(user);
            } catch (error) {
              showStatus(api.getErrorMessage(error, "Deletion request failed."), "error");
              renderUsersTable();
            }
          });
        }
      }

      elements.usersTableBody.appendChild(row);
    });
  }

  function renderDeletionRequests() {
    if (!elements.deletionRequestsList) {
      return;
    }

    const requests = [...state.deletionRequests].sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });

    elements.deletionRequestsList.innerHTML = "";

    if (!requests.length) {
      elements.deletionRequestsList.innerHTML = '<div class="empty">No deletion requests yet.</div>';
      return;
    }

    requests.forEach((request) => {
      const status = formatStatus(request.status, "pending");
      const targetLabel = formatIdentity(request.targetUser, request.targetEmail || "-");
      const requesterLabel = formatIdentity(request.requestedBy, request.requestedByEmail || "-");
      const reviewerLabel = formatIdentity(request.reviewedBy, request.reviewedByEmail || "-");

      const card = document.createElement("article");
      card.className = "report-card";
      card.innerHTML = `
        <div class="report-head">
          <strong>${escapeHTML(targetLabel)}</strong>
          <span class="status ${escapeHTML(status)}">${escapeHTML(status)}</span>
        </div>
        <p class="report-sub">Requested by: ${escapeHTML(requesterLabel)}</p>
        <p class="report-sub">Reason: ${escapeHTML(request.reason || "-")}</p>
        <p class="report-sub">Warning sent: ${escapeHTML(dateTime(request.warningSentAt))}</p>
        <p class="report-sub">Created: ${escapeHTML(dateTime(request.createdAt))}</p>
        <p class="report-sub">Reviewed by: ${escapeHTML(status === "pending" ? "-" : reviewerLabel)}</p>
        <div class="cell-actions">
          ${canManageUsers() && status === "pending" ? `
            <button class="btn small success" data-action="approve">Approve Delete</button>
            <button class="btn small warn" data-action="reject">Reject</button>
          ` : ""}
        </div>
      `;

      const approveBtn = card.querySelector('[data-action="approve"]');
      const rejectBtn = card.querySelector('[data-action="reject"]');

      if (approveBtn) {
        approveBtn.addEventListener("click", async () => {
          try {
            approveBtn.disabled = true;
            await handleReviewDeletionRequest(request, "approve");
          } catch (error) {
            showStatus(api.getErrorMessage(error, "Deletion approval failed."), "error");
            renderDeletionRequests();
          }
        });
      }

      if (rejectBtn) {
        rejectBtn.addEventListener("click", async () => {
          try {
            rejectBtn.disabled = true;
            await handleReviewDeletionRequest(request, "reject");
          } catch (error) {
            showStatus(api.getErrorMessage(error, "Deletion rejection failed."), "error");
            renderDeletionRequests();
          }
        });
      }

      elements.deletionRequestsList.appendChild(card);
    });
  }

  function renderStoriesTable() {
    if (!elements.storiesTableBody) {
      return;
    }

    const stories = [...state.stories].sort((left, right) => {
      return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
    });

    elements.storiesTableBody.innerHTML = "";

    if (!stories.length) {
      setTableEmpty(elements.storiesTableBody, 5, "No stories found.");
      return;
    }

    stories.forEach((story) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHTML(story.title || "Untitled Story")}</td>
        <td>${escapeHTML((story.author && (story.author.displayName || story.author.email || story.author.username)) || "-")}</td>
        <td><span class="status ${escapeHTML(String(story.status || "draft"))}">${escapeHTML(String(story.status || "draft"))}</span></td>
        <td>${formatNumber(story.reads || 0)}</td>
        <td>
          <div class="cell-actions">
            <button class="btn small danger" data-action="delete">Delete Story</button>
          </div>
        </td>
      `;

      const deleteBtn = row.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          const title = story.title || "this story";
          const confirmed = window.confirm(`Delete "${title}"?`);
          if (!confirmed) {
            return;
          }

          try {
            deleteBtn.disabled = true;
            await api.deleteStory(story.id);
            await refreshAndRender(`"${title}" deleted.`, "success");
          } catch (error) {
            deleteBtn.disabled = false;
            showStatus(api.getErrorMessage(error, "Story delete failed."), "error");
          }
        });
      }

      elements.storiesTableBody.appendChild(row);
    });
  }

  function renderReports() {
    if (!elements.reportsList) {
      return;
    }

    const reports = [...state.reports].sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });

    elements.reportsList.innerHTML = "";

    if (!reports.length) {
      elements.reportsList.innerHTML = '<div class="empty">No reports yet.</div>';
      return;
    }

    reports.forEach((report) => {
      const status = String(report.status || "open") === "resolved" ? "resolved" : "open";
      const reporter = report.reportedBy && (report.reportedBy.email || report.reportedBy.username || report.reportedBy.displayName)
        ? (report.reportedBy.email || report.reportedBy.username || report.reportedBy.displayName)
        : "-";

      const card = document.createElement("article");
      card.className = "report-card";
      card.innerHTML = `
        <div class="report-head">
          <strong>${escapeHTML(report.storyTitle || "Story Report")}</strong>
          <span class="status ${status}">${status === "resolved" ? "Resolved" : "Open"}</span>
        </div>
        <p class="report-sub">Reporter: ${escapeHTML(reporter)}</p>
        <p class="report-sub">Reason: ${escapeHTML(report.reason || "Content report")}</p>
        <p class="report-sub">Details: ${escapeHTML(report.details || "-")}</p>
        <p class="report-sub">Time: ${escapeHTML(dateTime(report.createdAt))}</p>
        <div class="cell-actions">
          <button class="btn small ${status === "resolved" ? "warn" : "success"}" data-action="toggle">
            ${status === "resolved" ? "Reopen" : "Mark Resolved"}
          </button>
          <button class="btn small danger" data-action="delete">Delete Report</button>
        </div>
      `;

      const toggleBtn = card.querySelector('[data-action="toggle"]');
      const deleteBtn = card.querySelector('[data-action="delete"]');

      if (toggleBtn) {
        toggleBtn.addEventListener("click", async () => {
          try {
            toggleBtn.disabled = true;
            await api.updateReport(report.id, {
              status: status === "resolved" ? "open" : "resolved"
            });
            await refreshAndRender(status === "resolved" ? "Report reopened." : "Report marked resolved.", "success");
          } catch (error) {
            toggleBtn.disabled = false;
            showStatus(api.getErrorMessage(error, "Report update failed."), "error");
          }
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          try {
            deleteBtn.disabled = true;
            await api.deleteReport(report.id);
            await refreshAndRender("Report deleted.", "success");
          } catch (error) {
            deleteBtn.disabled = false;
            showStatus(api.getErrorMessage(error, "Report delete failed."), "error");
          }
        });
      }

      elements.reportsList.appendChild(card);
    });
  }

  function renderAll() {
    renderStats();
    renderUsersTable();
    renderDeletionRequests();
    renderStoriesTable();
    renderReports();
  }

  async function initialize() {
    const existingSession = api.getSession();
    if (!existingSession) {
      window.location.href = "index.html";
      return;
    }

    state.session = await api.hydrateCurrentUser();
    state.currentUser = state.session && state.session.user ? state.session.user : null;

    if (!state.currentUser || !isPrivilegedRole(state.currentUser.role)) {
      window.location.href = "home.html";
      return;
    }

    if (elements.adminUserLine) {
      elements.adminUserLine.textContent = state.currentUser.email || "Admin";
    }

    bindStaticActions();
    renderLoadingState();
    showStatus("Loading admin dashboard...", "info", true);
    await loadData();
    renderAll();
    clearStatus();
  }

  initialize().catch(async (error) => {
    const message = api.getErrorMessage(error, "Admin dashboard load failed.");

    if (error && error.status === 401) {
      await api.logout();
      window.location.href = "index.html";
      return;
    }

    if (error && error.status === 403) {
      window.location.href = "home.html";
      return;
    }

    if (elements.deletionRequestsList) {
      elements.deletionRequestsList.innerHTML = `<div class="empty">${escapeHTML(message)}</div>`;
    }
    if (elements.reportsList) {
      elements.reportsList.innerHTML = `<div class="empty">${escapeHTML(message)}</div>`;
    }
    showStatus(message, "error", true);
  });
})();
