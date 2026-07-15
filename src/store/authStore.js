import { create } from "zustand";
import api, { clearAuthAndRedirect } from "../utils/api";
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
    useLibraryStore.getState().loadLibrary();
    window.location.href = "/";
  },

  signup: async (email, password, username) => {
    const { data } = await api.post("/api/auth/signup", { email, password, username });
    return data;
  },

  logout: async () => {
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
        useLibraryStore.getState().loadLibrary();
      }
    }
  },
}));