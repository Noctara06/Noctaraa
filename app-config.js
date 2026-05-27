window.MIDNIGHT_CONFIG = window.MIDNIGHT_CONFIG || window.AUDIO_HUB_CONFIG || {
  // Leave empty to auto-detect:
  // - file:// pages -> http://localhost:5000/api/v1
  // - deployed same-origin pages -> <current-origin>/api/v1
  apiBase: "https://noctaraa-1.onrender.com/api/v1"
};

window.AUDIO_HUB_CONFIG = window.AUDIO_HUB_CONFIG || window.MIDNIGHT_CONFIG;
