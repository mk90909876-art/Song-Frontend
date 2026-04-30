import { create } from "zustand";
import api, { refreshClient, clearAuthAndRedirect } from "../utils/api";
import { useLibraryStore } from "./libraryStore";

// ── JWT helpers ──────────────────────────────────────────────────────────────

const decodeToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub,
      email: payload.email,
      username: payload.user_metadata?.username,
    };
  } catch {
    return null;
  }
};

const getTokenExp = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

// ── Proactive refresh timer ──────────────────────────────────────────────────
// Fires 1 minute before token expiry to silently get a fresh token.
// The reactive interceptor in api.js is the safety net if this fires late or fails.

let _proactiveTimer = null;
const MINUTES_BEFORE_EXPIRY = 1;

const scheduleTokenRefresh = (token) => {
  if (_proactiveTimer) clearTimeout(_proactiveTimer);
  if (!token) return;

  const expiresAt = getTokenExp(token);
  if (!expiresAt) return;

  const refreshIn = expiresAt - Date.now() - MINUTES_BEFORE_EXPIRY * 60 * 1000;

  if (refreshIn <= 0) {
    // Token already expired or expiring immediately.
    // Do NOT proactively refresh here — let the reactive interceptor handle it
    // when the next API call fails with 401. This avoids a startup race condition
    // where both the proactive timer and fetchMe() try to use the refresh_token.
    return;
  }

  _proactiveTimer = setTimeout(doProactiveRefresh, refreshIn);
};

const doProactiveRefresh = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return; // No token — reactive interceptor will handle it

  try {
    const { data } = await refreshClient.post("/api/auth/refresh", {
      refresh_token: refreshToken,
    });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    // Reschedule timer based on the new token's expiry
    scheduleTokenRefresh(data.access_token);
  } catch {
    // Silently fail — the reactive interceptor in api.js is the safety net.
    // If the refresh_token is expired, the next API call will get a 401 and
    // the interceptor will correctly log the user out.
  }
};

// ── Init: restore session from localStorage ──────────────────────────────────
const storedToken = localStorage.getItem("access_token");
const storedUser = storedToken ? decodeToken(storedToken) : null;

export const useAuthStore = create((set, get) => ({
  user: storedUser,
  token: storedToken,
  loading: true,

  setToken: (token) => {
    if (token) {
      const user = decodeToken(token);
      set({ user, token, loading: false });
      scheduleTokenRefresh(token);
    } else {
      set({ user: null, token: null, loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    const user = decodeToken(data.access_token);
    set({ user, token: data.access_token });
    scheduleTokenRefresh(data.access_token);
    useLibraryStore.getState().loadLibrary();
    window.location.href = "/";
  },

  signup: async (email, password, username) => {
    const { data } = await api.post("/api/auth/signup", { email, password, username });
    return data;
  },

  logout: async () => {
    // Cancel proactive timer immediately so it doesn't fire during logout
    if (_proactiveTimer) {
      clearTimeout(_proactiveTimer);
      _proactiveTimer = null;
    }
    try { await api.post("/api/auth/logout"); } catch { }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    useLibraryStore.getState().clearLibrary();
    set({ user: null, token: null });
    window.location.href = "/login";
  },

  fetchMe: async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      set({ user: null, token: null, loading: false });
      return;
    }

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 15000)
    );

    try {
      const { data } = await Promise.race([
        api.get("/api/auth/me"),
        timeout,
      ]);
      // Re-read token from localStorage — the reactive interceptor may have
      // silently refreshed it during the await above.
      const currentToken = localStorage.getItem("access_token") || token;
      set({ user: data, token: currentToken, loading: false });
      scheduleTokenRefresh(currentToken);
      useLibraryStore.getState().loadLibrary();
    } catch (err) {
      if (err.response?.status === 401) {
        // Reactive interceptor already tried to refresh and failed — session is gone.
        set({ user: null, token: null, loading: false });
      } else {
        // Network error / timeout — stay logged in with cached JWT.
        const currentToken = localStorage.getItem("access_token") || token;
        const user = decodeToken(currentToken);
        set({ user, token: currentToken, loading: false });
        scheduleTokenRefresh(currentToken);
        useLibraryStore.getState().loadLibrary();
      }
    }
  },
}));