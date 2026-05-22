(() => {
  const api = window.MidnightAPI;
  if (!api) {
    return;
  }

  const page = document.body.dataset.page;
  const SESSION_KEY = api.SESSION_KEY;

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function setMessage(element, message, type) {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = `msg ${type || ""}`.trim();
  }

  function setButtonState(button, disabled, label) {
    if (!button) {
      return;
    }

    button.disabled = !!disabled;
    if (label) {
      button.textContent = label;
    }
  }

  function deriveDisplayName(email) {
    const prefix = String(email || "").split("@")[0] || "Reader";
    const normalized = prefix.replace(/[._-]+/g, " ").trim();
    return normalized || "Reader";
  }

  async function redirectToReaderMode() {
    await api.ensureUserMode("reader");
    window.location.href = "explore.html";
  }

  async function initAuthPage() {
    const showLoginBtn = document.getElementById("showLogin");
    const showSignupBtn = document.getElementById("showSignup");
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const loginMsg = document.getElementById("loginMsg");
    const signupMsg = document.getElementById("signupMsg");
    const loginEmailInput = document.getElementById("loginEmail");
    const loginPasswordInput = document.getElementById("loginPassword");
    const signupEmailInput = document.getElementById("signupEmail");
    const signupPasswordInput = document.getElementById("signupPassword");
    const loginSubmitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
    const signupSubmitBtn = signupForm ? signupForm.querySelector('button[type="submit"]') : null;

    function switchAuthMode(mode) {
      const isLogin = mode === "login";
      if (showLoginBtn) showLoginBtn.classList.toggle("active", isLogin);
      if (showSignupBtn) showSignupBtn.classList.toggle("active", !isLogin);
      if (loginForm) loginForm.classList.toggle("active", isLogin);
      if (signupForm) signupForm.classList.toggle("active", !isLogin);
      setMessage(loginMsg, "", "");
      setMessage(signupMsg, "", "");
    }

    if (showLoginBtn) {
      showLoginBtn.addEventListener("click", () => switchAuthMode("login"));
    }

    if (showSignupBtn) {
      showSignupBtn.addEventListener("click", () => switchAuthMode("signup"));
    }

    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage(loginMsg, "", "");

        const email = normalizeEmail(loginEmailInput && loginEmailInput.value);
        const password = loginPasswordInput ? loginPasswordInput.value : "";

        if (!email || !password) {
          setMessage(loginMsg, "Please enter your email and password.", "error");
          return;
        }

        try {
          setButtonState(loginSubmitBtn, true, "Logging In...");
          await api.login({
            email,
            password
          });
          await redirectToReaderMode();
        } catch (error) {
          setMessage(loginMsg, api.getErrorMessage(error, "Login failed."), "error");
        } finally {
          setButtonState(loginSubmitBtn, false, "Log In");
        }
      });
    }

    if (signupForm) {
      signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage(signupMsg, "", "");

        const emailRaw = signupEmailInput ? signupEmailInput.value : "";
        const email = normalizeEmail(emailRaw);
        const password = signupPasswordInput ? signupPasswordInput.value : "";

        if (!email) {
          setMessage(signupMsg, "Please enter a valid email address.", "error");
          return;
        }

        if (password.length < 8) {
          setMessage(signupMsg, "Your password must be at least 8 characters long.", "error");
          return;
        }

        try {
          setButtonState(signupSubmitBtn, true, "Creating...");
          await api.signup({
            email,
            password,
            displayName: deriveDisplayName(emailRaw),
            mode: "reader"
          });
          setMessage(signupMsg, "Your account has been created successfully. Redirecting to reader mode...", "success");
          await redirectToReaderMode();
        } catch (error) {
          setMessage(signupMsg, api.getErrorMessage(error, "Signup failed."), "error");
        } finally {
          setButtonState(signupSubmitBtn, false, "Create Account");
        }
      });
    }
  }

  async function initHomePage(session) {
    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = document.getElementById("profileMenu");
    const homeProfileLink = document.getElementById("homeProfileLink");
    const homeCollectionLink = document.getElementById("homeCollectionLink");
    const homeModeMenuBtn = document.getElementById("homeModeMenuBtn");
    const homeSettingsLink = document.getElementById("homeSettingsLink");
    const logoutBtn = document.getElementById("logoutBtn");
    const readingModeBtn = document.getElementById("readingModeBtn");
    const writtingModeBtn = document.getElementById("writtingModeBtn");
    const adminDashboardBtn = document.getElementById("adminDashboardBtn");
    const adminMenuLink = document.getElementById("adminMenuLink");

    const role = String(session.role || "").toLowerCase();
    const currentMode = String((session.user && session.user.mode) || session.mode || "reader").toLowerCase();
    const isPrivilegedUser = role === "admin" || role === "manager";

    function closeProfileMenu() {
      if (!profileMenu || !profileBtn) {
        return;
      }

      profileMenu.classList.remove("open");
      profileBtn.setAttribute("aria-expanded", "false");
    }

    function toggleProfileMenu() {
      if (!profileMenu || !profileBtn) {
        return;
      }

      const isOpen = profileMenu.classList.toggle("open");
      profileBtn.setAttribute("aria-expanded", String(isOpen));
    }

    async function logout() {
      await api.logout();
      window.location.href = "index.html";
    }

    async function continueWithMode(nextMode, nextUrl, button) {
      try {
        setButtonState(button, true, nextMode === "writer" ? "Opening Writer..." : "Opening Reader...");
        await api.ensureUserMode(nextMode);
        window.location.href = nextUrl;
      } catch (error) {
        alert(api.getErrorMessage(error, "Mode switch failed. Please log in again."));
        await api.logout();
        window.location.href = "index.html";
      } finally {
        if (button === readingModeBtn) {
          setButtonState(button, false, "CONTINUE AS READER");
        } else if (button === writtingModeBtn) {
          setButtonState(button, false, "CONTINUE AS WRITER");
        }
      }
    }

    async function openMenuMode(nextMode, nextUrl) {
      if (!homeModeMenuBtn) {
        return;
      }

      const defaultLabel = nextMode === "writer" ? "Writer Mode" : "Reader Mode";
      try {
        setButtonState(homeModeMenuBtn, true, nextMode === "writer" ? "Opening Writer..." : "Opening Reader...");
        await api.ensureUserMode(nextMode);
        window.location.href = nextUrl;
      } catch (error) {
        alert(api.getErrorMessage(error, "Mode switch failed. Please log in again."));
        await api.logout();
        window.location.href = "index.html";
      } finally {
        setButtonState(homeModeMenuBtn, false, defaultLabel);
      }
    }

    if (homeProfileLink && session.user && session.user.id) {
      homeProfileLink.href = `profile.html?authorId=${encodeURIComponent(session.user.id)}`;
    }

    if (homeCollectionLink) {
      homeCollectionLink.href = "collection.html";
    }

    if (homeModeMenuBtn) {
      const nextMode = currentMode === "writer" ? "reader" : "writer";
      const nextUrl = nextMode === "writer" ? "writer.html" : "explore.html";
      homeModeMenuBtn.textContent = nextMode === "writer" ? "Writer Mode" : "Reader Mode";
      homeModeMenuBtn.addEventListener("click", async () => {
        await openMenuMode(nextMode, nextUrl);
      });
    }

    if (profileMenu) {
      [
        homeProfileLink,
        homeCollectionLink,
        homeModeMenuBtn,
        homeSettingsLink,
        adminMenuLink,
        logoutBtn
      ].filter(Boolean).forEach((node) => {
        profileMenu.appendChild(node);
      });
    }

    if (isPrivilegedUser) {
      if (adminDashboardBtn) {
        adminDashboardBtn.classList.remove("hidden");
        adminDashboardBtn.addEventListener("click", () => {
          window.location.href = "admin.html";
        });
      }
      if (adminMenuLink) {
        adminMenuLink.classList.remove("hidden");
      }
    } else {
      if (adminDashboardBtn) {
        adminDashboardBtn.classList.add("hidden");
      }
      if (adminMenuLink) {
        adminMenuLink.classList.add("hidden");
      }
    }

    if (profileBtn) {
      profileBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleProfileMenu();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }

    document.addEventListener("click", (event) => {
      if (
        profileMenu &&
        profileBtn &&
        !profileMenu.contains(event.target) &&
        !profileBtn.contains(event.target)
      ) {
        closeProfileMenu();
      }
    });

    if (readingModeBtn) {
      readingModeBtn.addEventListener("click", () => continueWithMode("reader", "explore.html", readingModeBtn));
    }

    if (writtingModeBtn) {
      writtingModeBtn.addEventListener("click", () => continueWithMode("writer", "writer.html", writtingModeBtn));
    }

    closeProfileMenu();
  }

  async function boot() {
    if (page === "auth") {
      const existingSession = api.getSession();
      if (existingSession) {
        try {
          await api.hydrateCurrentUser();
          await redirectToReaderMode();
          return;
        } catch (error) {
          api.clearSession();
          localStorage.removeItem(SESSION_KEY);
        }
      }

      await initAuthPage();
      return;
    }

    if (page === "home") {
      const session = api.getSession();
      if (!session) {
        window.location.href = "index.html";
        return;
      }

      try {
        const currentSession = await api.hydrateCurrentUser();
        await initHomePage(currentSession);
      } catch (error) {
        api.clearSession();
        window.location.href = "index.html";
      }
    }
  }

  boot().catch(() => {
    api.clearSession();
    window.location.href = "index.html";
  });
})();
