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

// ── JioSaavn helpers ──────────────────────────────────────────
const cleanTitle = (title, artist) => {
  // YouTube titles are like "Song Name - Artist | Official Video | T-Series"
  // Strip everything after first | or ( or [ to get clean song name
  let t = title || "";
  t = t.split("|")[0].trim();       // remove "| Official Video | T-Series"
  t = t.split("(")[0].trim();       // remove "(Official Video)"
  t = t.split("[")[0].trim();       // remove "[Full Song]"
  t = t.split("feat.")[0].trim();   // remove "feat. xyz"
  t = t.split("Ft.")[0].trim();
  t = t.split("ft.")[0].trim();
  // If title has " - Artist" pattern, extract just song name
  if (t.includes(" - ")) t = t.split(" - ")[0].trim();
  // Clean artist too
  let a = artist || "";
  a = a.split(",")[0].trim();       // use only first artist
  a = a.split("&")[0].trim();
  a = a.replace(/VEVO/gi, "").trim();
  return { cleanTitle: t.slice(0, 50), cleanArtist: a.slice(0, 30) };
};

const getSaavnUrl = async (title, artist) => {
  try {
    const { cleanTitle: t, cleanArtist: a } = cleanTitle(title, artist);
    const query = `${t} ${a}`.trim();
    console.log(`🔍 Saavn searching: "${query}"`);

    const res = await fetch(`${SAAVN}/api/search/songs?query=${encodeURIComponent(query)}&limit=5`);
    if (!res.ok) throw new Error(`Saavn HTTP ${res.status}`);
    const data = await res.json();

    // Handle both response structures
    const songs = data?.data?.results || data?.results || [];
    if (!songs.length) {
      // Try with just the title, no artist
      const res2 = await fetch(`${SAAVN}/api/search/songs?query=${encodeURIComponent(t)}&limit=5`);
      const data2 = await res2.json();
      const songs2 = data2?.data?.results || data2?.results || [];
      if (!songs2.length) throw new Error("No results");
      songs.push(...songs2);
    }

    const song = songs[0];
    const urls = song.downloadUrl || song.download_url || [];
    const best = urls.find(u => u.quality === "320kbps") ||
                 urls.find(u => u.quality === "160kbps") ||
                 urls[urls.length - 1];

    if (!best?.url) throw new Error("No download URL in response");
    console.log(`✅ Saavn: "${song.name}" @ ${best.quality}`);
    return { url: best.url, quality: best.quality };
  } catch (err) {
    console.warn("Saavn lookup failed:", err.message);
    return null;
  }
};

// ── Audio element singleton ───────────────────────────────────
const initAudioEl = () => {
  if (window._audioEl) return window._audioEl;
  const el = new Audio();
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  el.preload = "auto";

  el.addEventListener("timeupdate", () => {
    const store = usePlayerStore.getState();
    store.setProgress(el.currentTime);
  });
  el.addEventListener("loadedmetadata", () => {
    usePlayerStore.getState().setDuration(el.duration);
  });
  el.addEventListener("ended", () => {
    usePlayerStore.getState().nextSong();
  });
  el.addEventListener("error", (e) => {
    console.warn("Audio element error:", e);
    // Fall back: mark saavn as unavailable, keep IFrame
    window._saavnActive = false;
    const vol = usePlayerStore.getState().volume;
    window._ytPlayerA?.setVolume?.(vol * 100);
  });
  el.addEventListener("play", () => {
    usePlayerStore.getState().setIsPlaying(true);
    window._saavnActive = true;
    // Mute IFrame when native audio is playing
    window._ytPlayerA?.setVolume?.(0);
    window._ytPlayerB?.setVolume?.(0);

    // ── Set Media Session here — this is what shows lock screen controls ──
    const song = usePlayerStore.getState().currentSong;
    if ("mediaSession" in navigator && song) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        artwork: [
          { src: song.thumbnail, sizes: "480x360", type: "image/jpeg" },
          { src: song.thumbnail.replace("hqdefault", "maxresdefault"), sizes: "1280x720", type: "image/jpeg" },
        ],
      });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("play", () => {
        window._audioEl?.play();
        usePlayerStore.getState().setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        window._audioEl?.pause();
        usePlayerStore.getState().setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        usePlayerStore.getState().nextSong();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        usePlayerStore.getState().prevSong();
      });
      navigator.mediaSession.setActionHandler("seekto", (e) => {
        if (window._audioEl) window._audioEl.currentTime = e.seekTime;
        usePlayerStore.getState().setProgress(e.seekTime);
      });
      console.log("✅ Media Session set for:", song.title);
    }
  });

  el.addEventListener("pause", () => {
    if (window._saavnActive) {
      usePlayerStore.getState().setIsPlaying(false);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    }
  });

  window._audioEl = el;
  window._saavnActive = false;
  return el;
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

  setDuration: (duration) => set({ duration }),
  setProgress: (progress) => {
    set({ progress });
    if (Math.floor(progress) % 5 === 0) {
      try { localStorage.setItem("session_progress", String(progress)); } catch {}
    }
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),

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

  // ── Play via JioSaavn (native audio) + IFrame (fallback) ───
  playSong: (song, options = {}) => {
    const { fromQueue = false } = options;
    const { history, currentSong, autoQueue, queue } = get();

    const newHistory = currentSong
      ? [currentSong, ...history.filter(h => h.id !== currentSong.id)].slice(0, MAX_HISTORY)
      : history;

    const newQueue = fromQueue ? queue : [];
    set({ currentSong: song, isPlaying: true, progress: 0, duration: 0, history: newHistory, savedProgress: 0, queue: newQueue });
    saveSession({ currentSong: song, queue: newQueue, progress: 0 });

    // ── 1. Load IFrame (provides duration/thumbnail on desktop, fallback on mobile) ──
    const tryLoad = (playerId = "primary") => {
      const player = playerId === "primary" ? window._ytPlayerA : window._ytPlayerB;
      if (player?.loadVideoById) {
        player.loadVideoById(song.id);
        window._activePlayer = playerId;
      } else {
        setTimeout(() => tryLoad(playerId), 150);
      }
    };
    tryLoad("primary");

    // ── 2. Try JioSaavn for native audio (background play) ───
    window._saavnActive = false;
    const audioEl = initAudioEl();
    audioEl.pause();
    audioEl.src = "";

    getSaavnUrl(song.title, song.artist).then(result => {
      // Make sure this song is still playing (user might have skipped)
      if (get().currentSong?.id !== song.id) return;

      if (result?.url) {
        const savedPos = get().savedProgress;
        audioEl.src = result.url;
        audioEl.volume = get().volume;
        audioEl.load();
        audioEl.play().then(() => {
          if (savedPos > 3) audioEl.currentTime = savedPos;
          // Mute IFrame — Saavn audio is playing
          window._ytPlayerA?.setVolume?.(0);
          window._ytPlayerB?.setVolume?.(0);
        }).catch(err => {
          console.warn("Saavn play() blocked (needs gesture):", err.message);
          // iOS requires user gesture — audio will start on next user tap
          window._saavnPending = true;
        });
      } else {
        // No Saavn match — use IFrame with volume
        const vol = get().volume;
        window._ytPlayerA?.setVolume?.(vol * 100);
        window._saavnActive = false;
        console.log("No Saavn match, using IFrame for:", song.title);
      }
    });

    // Preload next
    if (newQueue.length > 0) setTimeout(() => get().preloadNext(), 3000);

    // Auto queue refill
    if (autoQueue && newQueue.filter(s => s.id !== song.id).length < QUEUE_REFILL_AT) {
      setTimeout(() => get().fetchMix(song), 2000);
    }
  },

  preloadNext: () => {
    const { queue } = get();
    if (!queue.length) return;
    const next = queue[0];
    const inactive = window._activePlayer === "primary" ? window._ytPlayerB : window._ytPlayerA;
    inactive?.cueVideoById?.(next.id);
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
      const existingIds = new Set([...queue.map(s => s.id), currentSong?.id, ...history.slice(0, 10).map(s => s.id)]);
      const newSongs = data.results.filter(s => !existingIds.has(s.id)).slice(0, QUEUE_MAX - queue.length);
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
      if (window._saavnActive && window._audioEl) {
        window._audioEl.currentTime = 0;
        window._audioEl.play();
      } else {
        const player = window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;
        player?.seekTo?.(0, true); player?.playVideo?.();
      }
      set({ progress: 0 });
      return;
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
    if (progress > 3) {
      if (window._saavnActive && window._audioEl) {
        window._audioEl.currentTime = 0;
      } else {
        const player = window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;
        player?.seekTo?.(0, true); player?.playVideo?.();
      }
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
    if (window._saavnActive && window._audioEl?.src) {
      if (isPlaying) { window._audioEl.pause(); set({ isPlaying: false }); }
      else { window._audioEl.play(); set({ isPlaying: true }); }
    } else {
      const player = window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;
      if (isPlaying) { player?.pauseVideo?.(); set({ isPlaying: false }); }
      else { player?.playVideo?.(); set({ isPlaying: true }); }
    }
  },

  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
  toggleRepeat: () => set(s => ({
    repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "one" : "none"
  })),

  setVolume: (v) => {
    localStorage.setItem("volume", v);
    if (window._saavnActive && window._audioEl?.src) {
      window._audioEl.volume = v;
    } else {
      window._ytPlayerA?.setVolume?.(v * 100);
    }
    window._ytPlayerB?.setVolume?.(0);
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