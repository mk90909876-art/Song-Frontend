import { create } from "zustand";
import api, { refreshTokenOnce } from "../utils/api";
import { useLibraryStore } from "./libraryStore";

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

const storedToken = localStorage.getItem("access_token");
const storedUser = storedToken ? decodeToken(storedToken) : null;

// ── Proactive Token Refresh Timer ─────────────────────────────
let _refreshTimer = null;
const scheduleTokenRefresh = () => {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const token = localStorage.getItem("access_token");
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiresAt = payload.exp * 1000;
    const refreshIn = expiresAt - Date.now() - 60000; // 1 min before expiry
    if (refreshIn > 0) {
      _refreshTimer = setTimeout(async () => {
        try {
          const newToken = await refreshTokenOnce();
          const user = decodeToken(newToken);
          useAuthStore.setState({ user, token: newToken });
          scheduleTokenRefresh();
        } catch (err) {
          console.warn("Proactive token refresh failed:", err.message);
        }
      }, refreshIn);
    }
  } catch { }
};

export const useAuthStore = create((set, get) => ({
  user: storedUser,
  token: storedToken,
  loading: true,

  setToken: (token) => {
    if (token) {
      const user = decodeToken(token);
      set({ user, token, loading: false });
      scheduleTokenRefresh();
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

    // Schedule proactive refresh
    scheduleTokenRefresh();
    // Load library after login
    useLibraryStore.getState().loadLibrary();

    window.location.href = "/";
  },

  signup: async (email, password, username) => {
    const { data } = await api.post("/api/auth/signup", { email, password, username });
    return data;
  },

  logout: async () => {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    try { await api.post("/api/auth/logout"); } catch { }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    // Clear library cache on logout
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

    try {
      const { data } = await api.get("/api/auth/me");
      set({ user: data, token, loading: false });
      scheduleTokenRefresh();
      useLibraryStore.getState().loadLibrary();
    } catch (err) {
      if (err.response?.status === 401) {
        // Token refresh was attempted by interceptor and failed
        set({ user: null, token: null, loading: false });
      } else {
        // Network error / timeout — DON'T log out, use decoded token
        console.warn("fetchMe network error, using cached token:", err.message);
        const user = decodeToken(token);
        set({ user, token, loading: false });
        scheduleTokenRefresh();
        useLibraryStore.getState().loadLibrary();
      }
    }
  },
}));

// Start proactive refresh on module load if token exists
if (storedToken) scheduleTokenRefresh();