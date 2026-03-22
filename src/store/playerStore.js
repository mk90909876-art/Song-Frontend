import { create } from "zustand";

const MAX_HISTORY = 50;
const MAX_SEARCH_HISTORY = 20;
const QUEUE_MAX = 20;
const QUEUE_REFILL_AT = 10;
const SAAVN = "https://jiosaavn-api.mk90909876.workers.dev";

// ── Persist helpers ───────────────────────────────────────────
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
// YouTube titles are messy: "Song Name - Artist | Official Video | T-Series"
// We extract clean song name and artist for accurate Saavn matching
const cleanForSearch = (title, artist) => {
  let t = title || "";

  // Remove everything after these separators
  t = t.split("|")[0];
  t = t.split("(")[0];
  t = t.split("[")[0];
  t = t.split("feat.")[0];
  t = t.split("Feat.")[0];
  t = t.split("ft.")[0];
  t = t.split("Ft.")[0];
  t = t.split("//")[0];
  t = t.trim();

  // If "Song - Artist" pattern, take just song name
  if (t.includes(" - ")) t = t.split(" - ")[0].trim();

  // Clean artist — first name only, remove VEVO etc
  let a = (artist || "")
    .split(",")[0]
    .split("&")[0]
    .split("x")[0]
    .replace(/VEVO/gi, "")
    .replace(/official/gi, "")
    .trim();

  return {
    title: t.trim().slice(0, 60),
    artist: a.trim().slice(0, 40),
  };
};

// ── Duration matcher ──────────────────────────────────────────
// Pick the Saavn result whose duration is closest to YouTube duration
const bestDurationMatch = (songs, ytDuration) => {
  if (!ytDuration || songs.length === 1) return songs[0];
  return songs.reduce((best, song) => {
    const saavnDur = parseInt(song.duration?.total || song.duration || 0);
    const bestDur = parseInt(best.duration?.total || best.duration || 0);
    const diff = Math.abs(saavnDur - ytDuration);
    const bestDiff = Math.abs(bestDur - ytDuration);
    return diff < bestDiff ? song : best;
  });
};

// ── Saavn lookup ──────────────────────────────────────────────
const getSaavnAudio = async (song) => {
  const ytDuration = song.duration || 0;
  const { title: cleanTitle, artist: cleanArtist } = cleanForSearch(song.title, song.artist);

  // Strategy 1: search "title artist" together
  // Strategy 2: search just "title" if strategy 1 fails
  // Strategy 3: search "title" from a different angle using album/movie name if in title
  const queries = [
    `${cleanTitle} ${cleanArtist}`.trim(),
    cleanTitle,
    // If artist has multiple words, try with just first word
    `${cleanTitle} ${cleanArtist.split(" ")[0]}`.trim(),
  ].filter((q, i, arr) => q.length > 2 && arr.indexOf(q) === i); // dedupe

  for (const query of queries) {
    try {
      console.log(`🔍 Saavn: "${query}"`);
      const res = await fetch(
        `${SAAVN}/api/search/songs?query=${encodeURIComponent(query)}&limit=10`
      );
      if (!res.ok) continue;
      const data = await res.json();
      const results = data?.data?.results || data?.results || [];
      if (!results.length) continue;

      // Filter results with download URLs
      const withUrls = results.filter(s => s.downloadUrl?.length > 0);
      if (!withUrls.length) continue;

      // Pick best duration match
      const best = bestDurationMatch(withUrls, ytDuration);
      const urls = best.downloadUrl || [];

      // Prefer 320kbps, fallback down
      const audio = urls.find(u => u.quality === "320kbps")
        || urls.find(u => u.quality === "160kbps")
        || urls.find(u => u.quality === "96kbps")
        || urls[urls.length - 1];

      if (!audio?.url) continue;

      const saavnDur = parseInt(best.duration?.total || best.duration || 0);
      const durDiff = ytDuration ? Math.abs(saavnDur - ytDuration) : 0;

      // Reject if duration differs by more than 10 seconds (wrong song)
      if (ytDuration && durDiff > 10) {
        console.warn(`⚠️ Duration mismatch: YT=${ytDuration}s Saavn=${saavnDur}s diff=${durDiff}s — skipping "${best.name}"`);
        continue;
      }

      console.log(`✅ Saavn: "${best.name}" @ ${audio.quality} (dur diff: ${durDiff}s)`);
      return { url: audio.url, quality: audio.quality, name: best.name };
    } catch (err) {
      console.warn(`Saavn query "${query}" failed:`, err.message);
    }
  }

  console.warn(`❌ No Saavn match for: "${song.title}"`);
  return null;
};

// ── Audio element singleton ───────────────────────────────────
let audioElInitialized = false;
const getAudioEl = () => {
  if (!window._audioEl) {
    const el = new Audio();
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.preload = "auto";
    window._audioEl = el;
    window._audioReady = false;
  }
  return window._audioEl;
};

const setupAudioListeners = () => {
  if (audioElInitialized) return;
  audioElInitialized = true;
  const el = getAudioEl();

  el.addEventListener("timeupdate", () => {
    usePlayerStore.getState().setProgress(el.currentTime);
  });

  el.addEventListener("loadedmetadata", () => {
    usePlayerStore.getState().setDuration(el.duration);
  });

  el.addEventListener("ended", () => {
    usePlayerStore.getState().nextSong();
  });

  el.addEventListener("error", () => {
    console.warn("Audio error for:", usePlayerStore.getState().currentSong?.title);
    usePlayerStore.getState().setIsPlaying(false);
    // Try next song after brief pause
    setTimeout(() => usePlayerStore.getState().nextSong(), 1500);
  });

  el.addEventListener("play", () => {
    usePlayerStore.getState().setIsPlaying(true);
    updateMediaSession();
  });

  el.addEventListener("pause", () => {
    usePlayerStore.getState().setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  });
};

// ── Media Session ─────────────────────────────────────────────
const updateMediaSession = () => {
  if (!("mediaSession" in navigator)) return;
  const song = usePlayerStore.getState().currentSong;
  if (!song) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    artwork: [
      { src: song.thumbnail, sizes: "480x360", type: "image/jpeg" },
      { src: song.thumbnail.replace("hqdefault", "maxresdefault"), sizes: "1280x720", type: "image/jpeg" },
    ],
  });
  navigator.mediaSession.playbackState = "playing";

  const el = getAudioEl();
  navigator.mediaSession.setActionHandler("play", () => { el.play(); });
  navigator.mediaSession.setActionHandler("pause", () => { el.pause(); });
  navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().nextSong());
  navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().prevSong());
  navigator.mediaSession.setActionHandler("seekto", (e) => {
    el.currentTime = e.seekTime;
    usePlayerStore.getState().setProgress(e.seekTime);
  });
  navigator.mediaSession.setActionHandler("seekbackward", (e) => {
    el.currentTime = Math.max(0, el.currentTime - (e.seekOffset || 10));
  });
  navigator.mediaSession.setActionHandler("seekforward", (e) => {
    el.currentTime = Math.min(el.duration, el.currentTime + (e.seekOffset || 10));
  });
  console.log("✅ Media Session set:", song.title);
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
  saavnUnavailable: false, // true when Saavn can't find current song

  setDuration: (d) => set({ duration: d }),
  setProgress: (p) => {
    set({ progress: p });
    if (Math.floor(p) % 5 === 0) {
      try { localStorage.setItem("session_progress", String(p)); } catch {}
    }
  },
  setIsPlaying: (v) => set({ isPlaying: v }),

  // ── Search history ─────────────────────────────────────────
  addSearchHistory: (query) => {
    if (!query?.trim()) return;
    const q = query.trim();
    const prev = get().searchHistory.filter(h => h !== q);
    const updated = [q, ...prev].slice(0, MAX_SEARCH_HISTORY);
    set({ searchHistory: updated });
    saveSearchHistory(updated);
  },
  removeSearchHistory: (query) => {
    const updated = get().searchHistory.filter(h => h !== query);
    set({ searchHistory: updated });
    saveSearchHistory(updated);
  },
  clearSearchHistory: () => {
    set({ searchHistory: [] });
    saveSearchHistory([]);
  },

  // ── Core: play a song ─────────────────────────────────────
  playSong: (song, options = {}) => {
    const { fromQueue = false } = options;
    const { history, currentSong, autoQueue, queue } = get();

    const newHistory = currentSong
      ? [currentSong, ...history.filter(h => h.id !== currentSong.id)].slice(0, MAX_HISTORY)
      : history;

    const newQueue = fromQueue ? queue : [];
    set({
      currentSong: song, isPlaying: true, progress: 0, duration: 0,
      history: newHistory, savedProgress: 0, queue: newQueue,
      saavnUnavailable: false,
    });
    saveSession({ currentSong: song, queue: newQueue, progress: 0 });

    setupAudioListeners();
    const el = getAudioEl();
    el.pause();
    el.src = "";
    el.volume = get().volume;

    // Fetch Saavn URL and play
    getSaavnAudio(song).then(result => {
      // Make sure this song is still the current one
      if (get().currentSong?.id !== song.id) return;

      if (!result) {
        set({ saavnUnavailable: true, isPlaying: false });
        console.warn("Song not available on Saavn:", song.title);
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
          console.warn("play() blocked (needs gesture):", err.message);
          // Will auto-play on next user interaction via document listener
          window._pendingPlay = true;
        });
    });

    // Auto queue refill
    if (autoQueue && newQueue.filter(s => s.id !== song.id).length < QUEUE_REFILL_AT) {
      setTimeout(() => get().fetchMix(song), 2000);
    }
  },

  fetchMix: async (song) => {
    try {
      const { queue, currentSong, history } = get();
      if (queue.length >= QUEUE_MAX) return;
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/music/mix/${song.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.results?.length) return;
      const existingIds = new Set([
        ...queue.map(s => s.id),
        currentSong?.id,
        ...history.slice(0, 10).map(s => s.id),
      ]);
      const newSongs = data.results
        .filter(s => !existingIds.has(s.id))
        .slice(0, QUEUE_MAX - queue.length);
      if (newSongs.length) {
        const updated = [...get().queue, ...newSongs];
        set({ queue: updated });
        saveSession({ currentSong: get().currentSong, queue: updated, progress: get().progress });
      }
    } catch (err) { console.error("fetchMix failed:", err); }
  },

  nextSong: () => {
    const { queue, shuffle, repeat, history, currentSong } = get();
    if (repeat === "one") {
      const el = getAudioEl();
      el.currentTime = 0;
      el.play();
      set({ progress: 0 });
      return;
    }
    if (!queue.length) {
      if (repeat === "all" && history.length) {
        get().playSong(history[history.length - 1], { fromQueue: true });
      } else {
        set({ isPlaying: false });
      }
      return;
    }
    const idx = shuffle ? Math.floor(Math.random() * queue.length) : 0;
    const next = queue[idx];
    set({ queue: queue.filter((_, i) => i !== idx) });
    get().playSong(next, { fromQueue: true });
  },

  prevSong: () => {
    const { history, progress } = get();
    if (progress > 3) {
      const el = getAudioEl();
      el.currentTime = 0;
      set({ progress: 0 });
      return;
    }
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
    const { isPlaying } = get();
    const el = getAudioEl();
    if (isPlaying) {
      el.pause();
      set({ isPlaying: false });
    } else {
      el.play().catch(() => {});
      set({ isPlaying: true });
    }
  },

  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
  toggleRepeat: () => set(s => ({
    repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "one" : "none",
  })),

  setVolume: (v) => {
    localStorage.setItem("volume", v);
    const el = getAudioEl();
    if (el) el.volume = v;
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
    const [item] = q.splice(from, 1);
    q.splice(to, 0, item);
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress });
  },
  clearQueue: () => {
    set({ queue: [] });
    saveSession({ currentSong: get().currentSong, queue: [], progress: get().progress });
  },
  toggleAutoQueue: () => set(s => {
    const v = !s.autoQueue;
    localStorage.setItem("autoQueue", v);
    return { autoQueue: v };
  }),
}));