import { create } from "zustand";
import api, { refreshManager } from "../utils/api";
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

export const useAuthStore = create((set, get) => ({
  user: storedUser,
  token: storedToken,
  loading: true,

  setToken: (token) => {
    if (token) {
      const user = decodeToken(token);
      set({ user, token, loading: false });
      refreshManager.scheduleRefresh();
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
    refreshManager.scheduleRefresh();
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

    try {
      const { data } = await api.get("/api/auth/me");
      set({ user: data, token, loading: false });
      refreshManager.scheduleRefresh();
      useLibraryStore.getState().loadLibrary();
    } catch (err) {
      if (err.response?.status === 401) {
        set({ user: null, token: null, loading: false });
      } else {
        console.warn("fetchMe network error, using cached token:", err.message);
        const user = decodeToken(token);
        set({ user, token, loading: false });
        refreshManager.scheduleRefresh();
        useLibraryStore.getState().loadLibrary();
      }
    }
  },
}));

// Start proactive refresh on module load if token exists
if (storedToken) refreshManager.scheduleRefresh();