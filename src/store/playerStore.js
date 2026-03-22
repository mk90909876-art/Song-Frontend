import { create } from "zustand";

const MAX_HISTORY = 50;
const MAX_SEARCH_HISTORY = 20;
const QUEUE_MAX = 20;
const QUEUE_REFILL_AT = 10;
const SAAVN = "https://jiosaavn-api.mk90909876.workers.dev";

// ── Session persistence ───────────────────────────────────────
const saveSession = (state) => {
  try {
    localStorage.setItem("session_song", JSON.stringify(state.currentSong));
    localStorage.setItem("session_queue", JSON.stringify(state.queue));
    localStorage.setItem("session_progress", String(state.progress));
  } catch {}
};
const loadSession = () => {
  try {
    return {
      currentSong: JSON.parse(localStorage.getItem("session_song") || "null"),
      queue: JSON.parse(localStorage.getItem("session_queue") || "[]"),
      progress: parseFloat(localStorage.getItem("session_progress") || "0"),
    };
  } catch { return { currentSong: null, queue: [], progress: 0 }; }
};
const loadSearchHistory = () => {
  try { return JSON.parse(localStorage.getItem("search_history") || "[]"); } catch { return []; }
};
const saveSearchHistory = (h) => {
  try { localStorage.setItem("search_history", JSON.stringify(h)); } catch {}
};

const session = loadSession();

// ── Title cleaner ─────────────────────────────────────────────
const cleanForSearch = (title, artist) => {
  let t = (title || "")
    .split("|")[0].split("(")[0].split("[")[0]
    .replace(/feat\..*$/i, "").replace(/ft\..*$/i, "")
    .replace(/official.*$/i, "").replace(/video.*$/i, "")
    .replace(/lyric.*$/i, "").replace(/audio.*$/i, "")
    .trim();
  if (t.includes(" - ")) t = t.split(" - ")[0].trim();

  let a = (artist || "")
    .split(",")[0].split("&")[0].split(" x ")[0]
    .replace(/vevo/gi, "").replace(/official/gi, "")
    .trim();

  return { title: t.slice(0, 50), artist: a.slice(0, 30) };
};

// ── Saavn search + match ──────────────────────────────────────
const findSaavnSong = async (song) => {
  const { title: ct, artist: ca } = cleanForSearch(song.title, song.artist);
  // ytDuration may be 0 if not yet loaded — that's ok, we skip duration check
  const ytDur = song.duration || 0;

  // Try multiple queries from specific to broad
  const queries = [
    `${ct} ${ca}`.trim(),
    ct,
    `${ct} ${ca.split(" ")[0]}`.trim(),
  ].filter((q, i, arr) => q.length > 1 && arr.indexOf(q) === i);

  for (const q of queries) {
    try {
      console.log(`🔍 Saavn: "${q}"`);
      const res = await fetch(`${SAAVN}/api/search/songs?query=${encodeURIComponent(q)}&limit=10`);
      if (!res.ok) continue;
      const data = await res.json();
      const results = (data?.data?.results || data?.results || [])
        .filter(s => s.downloadUrl?.length > 0);
      if (!results.length) continue;

      let best = results[0];

      // If we have YouTube duration, pick closest match
      if (ytDur > 0) {
        best = results.reduce((b, s) => {
          // Saavn duration is in seconds as a string e.g. "331"
          const sd = parseInt(s.duration || "0");
          const bd = parseInt(b.duration || "0");
          return Math.abs(sd - ytDur) < Math.abs(bd - ytDur) ? s : b;
        });

        const saavnDur = parseInt(best.duration || "0");
        const diff = Math.abs(saavnDur - ytDur);
        // Reject if off by more than 45s — likely wrong song
        if (diff > 45) {
          console.warn(`⚠️ Duration mismatch ${diff}s for "${best.name}", trying next query`);
          continue;
        }
      }

      // Get highest quality URL
      const urls = best.downloadUrl || [];
      const audio = urls.find(u => u.quality === "320kbps")
        || urls.find(u => u.quality === "160kbps")
        || urls[urls.length - 1];

      if (!audio?.url) continue;

      console.log(`✅ Saavn match: "${best.name}" @ ${audio.quality}`);
      return { url: audio.url, quality: audio.quality, name: best.name };
    } catch (e) {
      console.warn(`Saavn query "${q}" error:`, e.message);
    }
  }

  console.warn(`❌ No Saavn match for: "${song.title}"`);
  return null;
};

// ── Single Audio Element ──────────────────────────────────────
// Track which song the audio element is currently loaded for
// to avoid race conditions when songs change quickly
let _currentLoadId = 0;

const getAudio = () => {
  if (!window._audioEl) {
    const el = new Audio();
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.preload = "auto";

    el.addEventListener("timeupdate", () => {
      if (el.src && el.currentTime > 0) {
        usePlayerStore.getState().setProgress(el.currentTime);
      }
    });

    el.addEventListener("loadedmetadata", () => {
      if (el.duration > 0) usePlayerStore.getState().setDuration(el.duration);
    });

    el.addEventListener("ended", () => {
      // Guard: only advance if we actually played something
      if (el.currentTime > 1) usePlayerStore.getState().nextSong();
    });

    el.addEventListener("error", (e) => {
      // Only show error if we have a real src loaded
      const src = el.src;
      if (!src || src === window.location.href || src.endsWith("/")) return;
      console.warn("Audio element error:", src.slice(0, 60));
      usePlayerStore.getState().setIsPlaying(false);
    });

    el.addEventListener("play", () => {
      usePlayerStore.getState().setIsPlaying(true);
      // Update media session with current song
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
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      artwork: [
        { src: song.thumbnail, sizes: "480x360", type: "image/jpeg" },
        { src: song.thumbnail.replace("hqdefault", "maxresdefault"), sizes: "1280x720", type: "image/jpeg" },
      ],
    });
    navigator.mediaSession.playbackState = "playing";
    const el = getAudio();
    navigator.mediaSession.setActionHandler("play", () => { el.play(); usePlayerStore.getState().setIsPlaying(true); });
    navigator.mediaSession.setActionHandler("pause", () => { el.pause(); usePlayerStore.getState().setIsPlaying(false); });
    navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().nextSong());
    navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().prevSong());
    navigator.mediaSession.setActionHandler("seekto", (a) => {
      el.currentTime = a.seekTime;
      usePlayerStore.getState().setProgress(a.seekTime);
    });
    navigator.mediaSession.setActionHandler("seekbackward", (a) => { el.currentTime = Math.max(0, el.currentTime - (a.seekOffset || 10)); });
    navigator.mediaSession.setActionHandler("seekforward", (a) => { el.currentTime = Math.min(el.duration, el.currentTime + (a.seekOffset || 10)); });
    console.log("✅ MediaSession set:", song.title);
  } catch (e) { console.warn("MediaSession error:", e.message); }
};

export const usePlayerStore = create((set, get) => ({
  currentSong: session.currentSong,
  isPlaying: false,
  queue: session.queue,
  history: [],
  shuffle: false,
  repeat: "none",
  volume: parseFloat(localStorage.getItem("volume") || "1"),
  progress: session.progress,
  duration: 0,
  autoQueue: localStorage.getItem("autoQueue") !== "false",
  savedProgress: session.progress,
  searchHistory: loadSearchHistory(),
  saavnUnavailable: false,

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
    set({ currentSong: song, isPlaying: false, progress: 0, duration: 0, history: newHistory, savedProgress: 0, queue: newQueue, saavnUnavailable: false });
    saveSession({ currentSong: song, queue: newQueue, progress: 0 });

    // Set media session immediately with song info (even before audio loads)
    setMediaSession(song);

    const el = getAudio();
    el.pause();
    el.volume = get().volume;

    // Tag this load so we can detect stale responses
    const loadId = ++_currentLoadId;

    findSaavnSong(song).then(result => {
      // Stale — user already moved to another song
      if (loadId !== _currentLoadId) {
        console.log("Stale Saavn response, ignoring");
        return;
      }

      if (!result) {
        set({ saavnUnavailable: true, isPlaying: false });
        return;
      }

      const savedPos = get().savedProgress;
      el.src = result.url;
      el.load();
      el.play()
        .then(() => {
          if (savedPos > 3) el.currentTime = savedPos;
        })
        .catch(err => {
          // iOS blocks autoplay — will resume on next tap
          console.warn("Autoplay blocked:", err.message);
          window._pendingPlay = true;
          set({ isPlaying: false });
        });
    });

    // Auto queue refill
    if (autoQueue && newQueue.filter(s => s.id !== song.id).length < QUEUE_REFILL_AT) {
      setTimeout(() => get().fetchMix(song), 3000);
    }
  },

  fetchMix: async (song) => {
    try {
      const { queue, currentSong, history } = get();
      if (queue.length >= QUEUE_MAX) return;
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/music/mix/${song.id}`,
        { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.results?.length) return;
      const ids = new Set([...queue.map(s => s.id), currentSong?.id, ...history.slice(0, 10).map(s => s.id)]);
      const fresh = data.results.filter(s => !ids.has(s.id)).slice(0, QUEUE_MAX - queue.length);
      if (fresh.length) {
        const updated = [...get().queue, ...fresh];
        set({ queue: updated });
        saveSession({ currentSong: get().currentSong, queue: updated, progress: get().progress });
      }
    } catch (e) { console.error("fetchMix:", e); }
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
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress });
  },
  playNext: (song) => {
    const q = [song, ...get().queue];
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress });
  },
  removeFromQueue: (index) => {
    const q = get().queue.filter((_, i) => i !== index);
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress });
  },
  moveQueueItem: (from, to) => {
    const q = [...get().queue];
    const [item] = q.splice(from, 1); q.splice(to, 0, item);
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress });
  },
  clearQueue: () => { set({ queue: [] }); saveSession({ currentSong: get().currentSong, queue: [], progress: get().progress }); },
  toggleAutoQueue: () => set(s => { const v = !s.autoQueue; localStorage.setItem("autoQueue", v); return { autoQueue: v }; }),
}));