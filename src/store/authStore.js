import { create } from "zustand";
import api from "../utils/api";
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

export const useAuthStore = create((set) => ({
  user: storedUser,
  token: storedToken,
  loading: false,

  login: async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    const user = decodeToken(data.access_token);
    set({ user, token: data.access_token });

    // Load library after login
    useLibraryStore.getState().loadLibrary();

    window.location.href = "/";
  },

  signup: async (email, password, username) => {
    const { data } = await api.post("/api/auth/signup", { email, password, username });
    return data;
  },

  logout: async () => {
    try { await api.post("/api/auth/logout"); } catch {}
    localStorage.clear();
    // Clear library cache on logout
    useLibraryStore.getState().clearLibrary();
    set({ user: null, token: null });
    window.location.href = "/login";
  },

  fetchMe: async () => {
    set({ loading: false });
    // Load library if token exists
    if (localStorage.getItem("access_token")) {
      useLibraryStore.getState().loadLibrary();
    }
  },
}));