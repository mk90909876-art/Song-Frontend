import { create } from "zustand";
import { saavnToSong, SAAVN } from "../utils/saavn";

const MAX_HISTORY = 50;
const MAX_SEARCH_HISTORY = 20;
const QUEUE_MAX = 20;
const QUEUE_REFILL_AT = 10;

// ── Session persistence ───────────────────────────────────────
const saveSession = (state) => {
  try {
    localStorage.setItem("session_song", JSON.stringify(state.currentSong));
    localStorage.setItem("session_queue", JSON.stringify(state.queue));
    localStorage.setItem("session_progress", String(state.progress));
    localStorage.setItem("session_history", JSON.stringify(state.history));
    localStorage.setItem("session_station", state.stationId || "");
  } catch {}
};
const loadSession = () => {
  try {
    return {
      currentSong: JSON.parse(localStorage.getItem("session_song") || "null"),
      queue: JSON.parse(localStorage.getItem("session_queue") || "[]"),
      progress: parseFloat(localStorage.getItem("session_progress") || "0"),
      history: JSON.parse(localStorage.getItem("session_history") || "[]"),
      stationId: localStorage.getItem("session_station") || null,
    };
  } catch { return { currentSong: null, queue: [], progress: 0, history: [], stationId: null }; }
};
const loadSearchHistory = () => {
  try { return JSON.parse(localStorage.getItem("search_history") || "[]"); } catch { return []; }
};
const saveSearchHistory = (h) => {
  try { localStorage.setItem("search_history", JSON.stringify(h)); } catch {}
};

const session = loadSession();

// ── Resolve Saavn audio URL ───────────────────────────────────
// Songs from search results already carry downloadUrl.
// Songs loaded from the library (liked / playlists) don't — fetch by ID.
const resolveSaavnUrl = async (song) => {
  const urls = song.downloadUrl || [];
  const direct = urls.find(u => u.quality === "320kbps")
    || urls.find(u => u.quality === "160kbps")
    || urls[urls.length - 1];

  if (direct?.url) return direct.url;

  // Fetch full song details from Saavn worker by ID
  const res = await fetch(`${SAAVN}/api/songs/${song.id}`);
  const data = await res.json();
  const songData = data?.data?.[0];
  if (!songData?.downloadUrl?.length) return null;

  const fetched = songData.downloadUrl.find(u => u.quality === "320kbps")
    || songData.downloadUrl.find(u => u.quality === "160kbps")
    || songData.downloadUrl[songData.downloadUrl.length - 1];

  return fetched?.url || null;
};

// ── Single Audio Element ──────────────────────────────────────
let _currentLoadId = 0;

const getAudio = () => {
  if (!window._audioEl) {
    const el = new Audio();
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.preload = "auto";
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
    document.body.appendChild(el);

    el.addEventListener("timeupdate", () => {
      if (el.src && el.currentTime > 0) {
        usePlayerStore.getState().setProgress(el.currentTime);
        try {
          if ("mediaSession" in navigator && el.duration > 0) {
            navigator.mediaSession.setPositionState({
              duration: el.duration,
              playbackRate: 1,
              position: el.currentTime,
            });
          }
        } catch {}
      }
    });

    el.addEventListener("loadedmetadata", () => {
      if (el.duration > 0) usePlayerStore.getState().setDuration(el.duration);
    });

    el.addEventListener("ended", () => {
      if (el.currentTime > 1) usePlayerStore.getState().nextSong();
    });

    el.addEventListener("error", () => {
      const src = el.src;
      if (!src || src === window.location.href || src.endsWith("/")) return;
      console.warn("Audio error:", src.slice(0, 80));
      usePlayerStore.getState().setIsPlaying(false);
    });

    el.addEventListener("play", () => {
      usePlayerStore.getState().setIsPlaying(true);
      const song = usePlayerStore.getState().currentSong;
      if (song) setMediaSession(song);
    });

    el.addEventListener("pause", () => {
      usePlayerStore.getState().setIsPlaying(false);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    });

    window._audioEl = el;
  }
  return window._audioEl;
};

// ── Media Session ─────────────────────────────────────────────
const setMediaSession = (song) => {
  if (!("mediaSession" in navigator) || !song) return;
  try {
    const el = getAudio();

    navigator.mediaSession.setActionHandler("play", () => {
      el.play();
      usePlayerStore.getState().setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      el.pause();
      usePlayerStore.getState().setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().nextSong());
    navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().prevSong());
    navigator.mediaSession.setActionHandler("seekto", (a) => {
      el.currentTime = a.seekTime;
      usePlayerStore.getState().setProgress(a.seekTime);
    });
    try {
      navigator.mediaSession.setActionHandler("seekbackward", (a) => {
        el.currentTime = Math.max(0, el.currentTime - (a.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", (a) => {
        el.currentTime = Math.min(el.duration || 0, el.currentTime + (a.seekOffset || 10));
      });
    } catch {}

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      artwork: [
        { src: song.thumbnail, sizes: "480x360", type: "image/jpeg" },
        { src: song.thumbnail.replace("hqdefault", "maxresdefault"), sizes: "1280x720", type: "image/jpeg" },
      ],
    });
    navigator.mediaSession.playbackState = "playing";

    try {
      if (el.duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: el.duration,
          playbackRate: 1,
          position: el.currentTime || 0,
        });
      }
    } catch {}

    console.log("✅ MediaSession:", song.title);
  } catch (e) {
    console.warn("MediaSession error:", e.message);
  }
};

export const usePlayerStore = create((set, get) => ({
  currentSong: session.currentSong,
  isPlaying: false,
  queue: session.queue,
  history: session.history,
  shuffle: false,
  repeat: "none",
  volume: parseFloat(localStorage.getItem("volume") || "1"),
  progress: session.progress,
  duration: 0,
  autoQueue: localStorage.getItem("autoQueue") !== "false",
  savedProgress: session.progress,
  searchHistory: loadSearchHistory(),
  saavnUnavailable: false,
  stationId: session.stationId,

  setDuration: (d) => set({ duration: d }),
  setProgress: (p) => {
    set({ progress: p });
    if (Math.floor(p) % 5 === 0) {
      try { localStorage.setItem("session_progress", String(p)); } catch {}
    }
  },
  setIsPlaying: (v) => set({ isPlaying: v }),

  // ── Search history ─────────────────────────────────────────
  addSearchHistory: (q) => {
    if (!q?.trim()) return;
    const prev = get().searchHistory.filter(h => h !== q.trim());
    const updated = [q.trim(), ...prev].slice(0, MAX_SEARCH_HISTORY);
    set({ searchHistory: updated });
    saveSearchHistory(updated);
  },
  removeSearchHistory: (q) => {
    const updated = get().searchHistory.filter(h => h !== q);
    set({ searchHistory: updated });
    saveSearchHistory(updated);
  },
  clearSearchHistory: () => { set({ searchHistory: [] }); saveSearchHistory([]); },

  // ── Play a song ───────────────────────────────────────────
  playSong: (song, options = {}) => {
    const { fromQueue = false } = options;
    const { history, currentSong, autoQueue, queue } = get();

    const newHistory = currentSong
      ? [currentSong, ...history.filter(h => h.id !== currentSong.id)].slice(0, MAX_HISTORY)
      : history;

    const newQueue = fromQueue ? queue : [];
    set({ currentSong: song, isPlaying: false, progress: 0, duration: 0, history: newHistory, savedProgress: 0, queue: newQueue, saavnUnavailable: false, stationId: fromQueue ? get().stationId : null });
    saveSession({ currentSong: song, queue: newQueue, progress: 0.1, history: newHistory, stationId: fromQueue ? get().stationId : null });

    setMediaSession(song);

    const el = getAudio();
    el.pause();
    el.volume = get().volume;

    const loadId = ++_currentLoadId;

    const playAudio = (url, savedPos) => {
      el.src = url;
      el.load();
      el.play()
        .then(() => { if (savedPos > 3) el.currentTime = savedPos; })
        .catch(err => {
          console.warn("Autoplay blocked:", err.message);
          window._pendingPlay = true;
          set({ isPlaying: false });
        });
    };

    // All songs are Saavn-sourced.
    // If downloadUrl is present, use it directly.
    // Otherwise fetch song details from Saavn by ID (library songs don't carry downloadUrl).
    resolveSaavnUrl(song).then(url => {
      if (loadId !== _currentLoadId) return;
      if (!url) {
        console.warn("No Saavn URL for:", song.title);
        set({ saavnUnavailable: true, isPlaying: false });
        return;
      }
      playAudio(url, get().savedProgress);
    }).catch(err => {
      if (loadId !== _currentLoadId) return;
      console.warn("Saavn resolve error:", err.message);
      set({ saavnUnavailable: true, isPlaying: false });
    });

    // Auto queue refill via Saavn suggestions
    if (autoQueue && newQueue.filter(s => s.id !== song.id).length < QUEUE_REFILL_AT) {
      setTimeout(() => get().fetchSuggestions(song), 3000);
    }
  },

  fetchSuggestions: async (song) => {
    try {
      const { queue, currentSong, history, stationId } = get();
      if (queue.length >= QUEUE_MAX) return;

      const url = stationId 
        ? `${SAAVN}/api/songs/${song.id}/suggestions?limit=20&stationId=${encodeURIComponent(stationId)}`
        : `${SAAVN}/api/songs/${song.id}/suggestions?limit=20`;

      const res = await fetch(url);
      const data = await res.json();
      if (!data.success || !data.data?.length) return;

      const newStationId = data.stationId || stationId;
      const ids = new Set([...queue.map(s => s.id), currentSong?.id, ...history.slice(0, 10).map(s => s.id)]);
      
      const fresh = data.data
        .map(saavnToSong)
        .filter(s => !ids.has(s.id))
        .slice(0, QUEUE_MAX - queue.length);

      if (fresh.length || newStationId !== stationId) {
        const updated = [...get().queue, ...fresh];
        set({ queue: updated, stationId: newStationId });
        saveSession({ currentSong: get().currentSong, queue: updated, progress: get().progress, history: get().history, stationId: newStationId });
      }
    } catch (e) { console.error("fetchSuggestions:", e); }
  },

  nextSong: () => {
    const { queue, shuffle, repeat, history } = get();
    if (repeat === "one") {
      const el = getAudio(); el.currentTime = 0; el.play();
      set({ progress: 0 }); return;
    }
    if (!queue.length) {
      if (repeat === "all" && history.length) get().playSong(history[history.length - 1], { fromQueue: true });
      else set({ isPlaying: false });
      return;
    }
    const idx = shuffle ? Math.floor(Math.random() * queue.length) : 0;
    const next = queue[idx];
    set({ queue: queue.filter((_, i) => i !== idx) });
    get().playSong(next, { fromQueue: true });
  },

  prevSong: () => {
    const { history, progress } = get();
    if (progress > 3) { const el = getAudio(); el.currentTime = 0; set({ progress: 0 }); return; }
    if (history.length) get().playSong(history[0], { fromQueue: true });
  },

  playFromQueue: (index) => {
    const { queue } = get();
    const song = queue[index];
    if (!song) return;
    set({ queue: queue.filter((_, i) => i !== index) });
    get().playSong(song, { fromQueue: true });
  },

  togglePlay: () => {
    const el = getAudio();
    const { isPlaying } = get();
    if (isPlaying) { el.pause(); set({ isPlaying: false }); }
    else { el.play().catch(() => {}); set({ isPlaying: true }); }
  },

  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
  toggleRepeat: () => set(s => ({ repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "one" : "none" })),

  setVolume: (v) => {
    localStorage.setItem("volume", v);
    getAudio().volume = v;
    set({ volume: v });
  },

  addToQueue: (song) => {
    const q = [...get().queue, song];
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress, history: get().history, stationId: get().stationId });
  },
  playNext: (song) => {
    const q = [song, ...get().queue];
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress, history: get().history, stationId: get().stationId });
  },
  removeFromQueue: (index) => {
    const q = get().queue.filter((_, i) => i !== index);
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress, history: get().history, stationId: get().stationId });
  },
  moveQueueItem: (from, to) => {
    const q = [...get().queue];
    const [item] = q.splice(from, 1); q.splice(to, 0, item);
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress, history: get().history, stationId: get().stationId });
  },
  clearQueue: () => { set({ queue: [] }); saveSession({ currentSong: get().currentSong, queue: [], progress: get().progress, history: get().history, stationId: get().stationId }); },
  toggleAutoQueue: () => set(s => { const v = !s.autoQueue; localStorage.setItem("autoQueue", v); return { autoQueue: v }; }),
}));