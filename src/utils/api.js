import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── Main API client ───────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Bare client for refresh calls — no interceptors, prevents recursion ───
// This is also exported so authStore can use it for proactive refresh calls.
export const refreshClient = axios.create({ baseURL: BASE_URL });

// ── Reactive refresh state ────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const flushQueue = (error, token) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  failedQueue = [];
};

// ── Request interceptor: attach access token to every request ─────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: reactive 401 → refresh → retry ─────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only handle 401s, and only once per request (prevents infinite loops)
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      // No refresh token stored — session is definitively gone
      clearAuthAndRedirect();
      return Promise.reject(err);
    }

    // Another request is already refreshing — join the queue and wait
    if (isRefreshing) {
      return new Promise((resolve, reject) =>
        failedQueue.push({ resolve, reject })
      ).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await refreshClient.post("/api/auth/refresh", {
        refresh_token: refreshToken,
      });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      flushQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);
      // Only log out on a definitive auth failure (4xx).
      // Network errors (no response) must NOT log the user out — they may be offline.
      if (refreshErr.response && refreshErr.response.status < 500) {
        clearAuthAndRedirect();
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── Shared logout helper ──────────────────────────────────────────────────
export function clearAuthAndRedirect() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/login";
}

export default api;