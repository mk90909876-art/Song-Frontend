import { create } from "zustand";
import { saavnToSong } from "../utils/saavn";
import api from "../utils/api";
import { resumeAudioSession, nudgeVolume, startNudgeHeartbeat, stopNudgeHeartbeat, requestWakeLock, releaseWakeLock, registerRecoveryCallback } from "../utils/audioSession";

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
  } catch { }
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
  try { localStorage.setItem("search_history", JSON.stringify(h)); } catch { }
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

  // Fetch full song details from Saavn proxy by ID
  const { data } = await api.get(`/api/saavn/songs/${song.id}`);
  const songData = data?.data?.[0];
  if (!songData?.downloadUrl?.length) return null;

  const fetched = songData.downloadUrl.find(u => u.quality === "320kbps")
    || songData.downloadUrl.find(u => u.quality === "160kbps")
    || songData.downloadUrl[songData.downloadUrl.length - 1];

  return fetched?.url || null;
};

// ── Pre-resolve download URLs for queued songs ───────────────
// Resolves in batches: first 5 immediately (covers ~20 min of music),
// then batches of 3 to avoid API rate-limiting on large playlists.
let _resolveAbort = 0;
const preResolveQueueUrls = async (storeGet) => {
  const resolveId = ++_resolveAbort;
  const queue = storeGet().queue;
  const unresolved = queue
    .map((s, i) => ({ song: s, index: i }))
    .filter(({ song }) => !song.downloadUrl?.length);

  if (!unresolved.length) return;

  const resolveSong = async (song) => {
    try {
      const { data } = await api.get(`/api/saavn/songs/${song.id}`);
      const sd = data?.data?.[0];
      if (sd?.downloadUrl) song.downloadUrl = sd.downloadUrl;
    } catch { }
  };

  // Batch 1: first 5 unresolved songs in parallel (next ~20 min of music)
  const batch1 = unresolved.slice(0, 5);
  await Promise.all(batch1.map(({ song }) => resolveSong(song)));
  if (resolveId !== _resolveAbort) return; // abort if new playSong fired
  // Update state with resolved URLs
  const q1 = [...storeGet().queue];
  usePlayerStore.setState({ queue: q1 });
  saveSession({ currentSong: storeGet().currentSong, queue: q1, progress: storeGet().progress, history: storeGet().history, stationId: storeGet().stationId });

  // Batch 2+: remaining songs in groups of 3
  const remaining = unresolved.slice(5);
  for (let i = 0; i < remaining.length; i += 3) {
    if (resolveId !== _resolveAbort) return;
    const batch = remaining.slice(i, i + 3);
    await Promise.all(batch.map(({ song }) => resolveSong(song)));
    if (resolveId !== _resolveAbort) return;
    const q = [...storeGet().queue];
    usePlayerStore.setState({ queue: q });
    saveSession({ currentSong: storeGet().currentSong, queue: q, progress: storeGet().progress, history: storeGet().history, stationId: storeGet().stationId });
  }
};

// ── Single Audio Element ──────────────────────────────────────
let _currentLoadId = 0;
let _isTransitioning = false; // Flag to prevent Android killing notification between songs
let _preResolvedNextUrl = null; // Pre-resolved URL for the next song in queue
let _preResolvedNextId = null; // ID of the song whose URL was pre-resolved

const getAudio = () => {
  if (!window._audioEl) {
    const el = new Audio();
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.preload = "auto";
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
    document.body.appendChild(el);

    // ── Single timeupdate handler (consolidated) ──
    el.addEventListener("timeupdate", () => {
      if (el.src && el.currentTime > 0) {
        usePlayerStore.getState().setProgress(el.currentTime);
        try {
          if ("mediaSession" in navigator && el.duration > 0) {
            navigator.mediaSession.setPositionState({
              duration: el.duration,
              playbackRate: el.playbackRate || 1,
              position: el.currentTime,
            });
          }
        } catch { }

        // ── Pre-resolve next song URL ~15s before current ends ──
        // This is critical for Android background playback: by resolving
        // the URL while we're still actively playing (and the tab is alive),
        // the ended->nextSong transition needs zero network calls.
        const remaining = el.duration - el.currentTime;
        if (el.duration > 0 && remaining > 0 && remaining <= 15) {
          const { queue, shuffle } = usePlayerStore.getState();
          if (queue.length > 0) {
            const nextIdx = shuffle ? 0 : 0; // Pre-resolve first item regardless
            const nextSong = queue[nextIdx];
            if (nextSong && nextSong.id !== _preResolvedNextId) {
              _preResolvedNextId = nextSong.id;
              resolveSaavnUrl(nextSong).then(url => {
                if (url && nextSong.id === _preResolvedNextId) {
                  _preResolvedNextUrl = url;
                }
              }).catch(() => {});
            }
          }
        }
      }
    });

    // ── Single loadedmetadata handler (consolidated) ──
    el.addEventListener("loadedmetadata", () => {
      if (el.duration > 0) usePlayerStore.getState().setDuration(el.duration);
      const song = usePlayerStore.getState().currentSong;
      if (song) setMediaSession(song);
    });

    el.addEventListener("ended", async () => {
      // Run as async so the await chain below (URL resolve → el.play) stays
      // within one task, giving Android less opportunity to suspend JS mid-call.
      if (el.currentTime <= 1) return;

      const state = usePlayerStore.getState();
      const { queue, shuffle, repeat, history } = state;

      // Repeat-one: just restart
      if (repeat === "one") {
        el.currentTime = 0;
        try { await el.play(); } catch { }
        state.setProgress(0);
        return;
      }

      // No queue and repeat-all: restart from history
      if (!queue.length) {
        if (repeat === "all" && history.length) {
          state.playSong(history[history.length - 1], { fromQueue: true });
        } else {
          state.setIsPlaying(false);
        }
        return;
      }

      const idx = shuffle ? Math.floor(Math.random() * queue.length) : 0;
      const next = queue[idx];

      // Use pre-resolved URL if ready; otherwise resolve now (network call).
      // Either way, we await it here so play() is called in the same async task.
      let url = (_preResolvedNextUrl && _preResolvedNextId === next.id)
        ? _preResolvedNextUrl
        : null;

      if (!url) {
        // Inject any existing downloadUrl into the song first (library songs)
        try { url = await resolveSaavnUrl(next); } catch { }
      }

      _preResolvedNextUrl = null;
      _preResolvedNextId = null;

      if (!url) {
        // URL unavailable — fall back to the normal playSong path
        state.nextSong();
        return;
      }

      // Inject URL so playSong's resolveSaavnUrl() finds it immediately
      if (!next.downloadUrl?.length) {
        next.downloadUrl = [{ quality: "320kbps", url }];
      }

      // Transition: set _isTransitioning before touching el.src
      _isTransitioning = true;
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";

      el.src = url;
      el.load();
      try {
        await el.play();
      } catch (err) {
        console.warn("ended auto-play blocked:", err.message);
        // Play was blocked — let the store handle state cleanly
        state.nextSong();
        return;
      }

      // Update store state after successful play
      const newQueue = queue.filter((_, i) => i !== idx);
      const newHistory = state.currentSong
        ? [state.currentSong, ...state.history.filter(h => h.id !== state.currentSong.id)].slice(0, 50)
        : state.history;

      usePlayerStore.setState({
        currentSong: next,
        isPlaying: true,
        queue: newQueue,
        history: newHistory,
        progress: 0,
        duration: 0,
        saavnUnavailable: false,
      });

      // Sync MediaSession metadata for the new track
      setMediaSession(next);

      // Persist session
      try {
        localStorage.setItem("session_song", JSON.stringify(next));
        localStorage.setItem("session_queue", JSON.stringify(newQueue));
        localStorage.setItem("session_progress", "0");
        localStorage.setItem("session_history", JSON.stringify(newHistory));
      } catch { }

      // Refill queue if running low
      const autoQueue = localStorage.getItem("autoQueue") !== "false";
      if (autoQueue && newQueue.filter(s => s.id !== next.id).length < 10) {
        setTimeout(() => usePlayerStore.getState().fetchSuggestions(next), 3000);
      }
    });

    // ── Error recovery: auto-skip to next song instead of dead stop ──
    el.addEventListener("error", () => {
      const src = el.src;
      if (!src || src === window.location.href || src.endsWith("/")) return;
      console.warn("Audio error, auto-skipping:", src.slice(0, 80));
      const { queue } = usePlayerStore.getState();
      if (queue.length > 0) {
        // Auto-skip to next song after a brief delay
        setTimeout(() => usePlayerStore.getState().nextSong(), 1500);
      } else {
        usePlayerStore.getState().setIsPlaying(false);
      }
    });

    el.addEventListener("play", () => {
      _isTransitioning = false;
      usePlayerStore.getState().setIsPlaying(true);
      resumeAudioSession();
      requestWakeLock(); // Keep Android from suspending the tab
      startNudgeHeartbeat();
      setTimeout(nudgeVolume, 100);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
        const song = usePlayerStore.getState().currentSong;
        if (song) setMediaSession(song);
      }
    });

    // ── Pause handler: skip mediaSession update during song transitions ──
    el.addEventListener("pause", () => {
      if (_isTransitioning) return; // Don't tell OS we paused during song switch
      usePlayerStore.getState().setIsPlaying(false);
      stopNudgeHeartbeat();
      releaseWakeLock(); // Release wake lock when truly paused
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    });

    // NOTE: Do NOT listen to 'emptied' — it fires during song transitions
    // and corrupts playbackState before the new song can set it back.

    // ── Singleton Media Session Handlers ──
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        el.play().catch(() => { });
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        el.pause();
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
      } catch { }
      try { navigator.mediaSession.setActionHandler("stop", () => { el.pause(); el.currentTime = 0; }); } catch { }
    }

    window._audioEl = el;
  }
  return window._audioEl;
};

// ── Media Session ─────────────────────────────────────────────
const setMediaSession = (song) => {
  if (!("mediaSession" in navigator) || !song) return;
  try {
    const el = getAudio();
    const artwork = [{ src: song.thumbnail, sizes: "500x500", type: "image/jpeg" }];
    if (song.thumbnail.includes("googleusercontent") || song.thumbnail.includes("ytimg")) {
      artwork.push({ src: song.thumbnail.replace("hqdefault", "maxresdefault"), sizes: "1280x720", type: "image/jpeg" });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      artwork
    });

    // Update position state if duration is known
    if (el.duration > 0 && !isNaN(el.duration)) {
      navigator.mediaSession.setPositionState({
        duration: el.duration,
        playbackRate: el.playbackRate || 1,
        position: el.currentTime || 0,
      });
    }
  } catch (e) {
    console.warn("MediaSession update error:", e.message);
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
      try { localStorage.setItem("session_progress", String(p)); } catch { }
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
    const { fromQueue = false, fromHistory = false, updatedQueue = null, initialProgress = 0 } = options;
    const { history, currentSong, autoQueue, queue } = get();

    let newHistory;
    let newQueue;

    if (fromHistory) {
      // Going BACK: pop target from history, push current song to queue front
      newHistory = history.filter(h => h.id !== song.id);
      newQueue = currentSong ? [currentSong, ...queue] : queue;
    } else {
      // Normal: push current song to history
      newHistory = currentSong
        ? [currentSong, ...history.filter(h => h.id !== currentSong.id)].slice(0, MAX_HISTORY)
        : history;
      newQueue = updatedQueue !== null ? updatedQueue : (fromQueue ? queue : []);
    }

    set({
      currentSong: song,
      isPlaying: false,
      progress: initialProgress,
      duration: 0,
      history: newHistory,
      savedProgress: initialProgress,
      queue: newQueue,
      saavnUnavailable: false,
      stationId: (fromQueue || fromHistory) ? get().stationId : null
    });
    saveSession({ currentSong: song, queue: newQueue, progress: initialProgress, history: newHistory, stationId: (fromQueue || fromHistory) ? get().stationId : null });

    setMediaSession(song);

    const el = getAudio();
    // Mark as transitioning so the pause handler doesn't tell Android we stopped
    _isTransitioning = true;
    // Pre-set mediaSession to "playing" so OS doesn't kill notification
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    el.volume = get().volume;

    const loadId = ++_currentLoadId;
    // Clear pre-resolved cache since we're loading a new song
    _preResolvedNextUrl = null;
    _preResolvedNextId = null;

    const playAudio = (url, savedPos) => {
      el.src = url;
      el.load();
      el.play()
        .then(() => {
          if (savedPos > 3) el.currentTime = savedPos;
          // Explicitly sync MediaSession after play succeeds
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        })
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

    // Pre-resolve download URLs for queued songs (critical for iOS background)
    // Runs immediately so URLs are ready before user locks screen
    if (newQueue.some(s => !s.downloadUrl?.length)) {
      preResolveQueueUrls(get);
    }

    // Auto queue refill via Saavn suggestions
    if (autoQueue && newQueue.filter(s => s.id !== song.id).length < QUEUE_REFILL_AT) {
      setTimeout(() => get().fetchSuggestions(song), 3000);
    }
  },

  fetchSuggestions: async (song) => {
    try {
      const { queue, currentSong, history, stationId } = get();
      if (queue.length >= QUEUE_MAX) return;

      const params = stationId
        ? `?limit=20&stationId=${encodeURIComponent(stationId)}`
        : `?limit=20`;

      const { data } = await api.get(`/api/saavn/songs/${song.id}/suggestions${params}`);
      if (!data.success || !data.data?.length) return;

      const newStationId = data.stationId || stationId;
      const ids = new Set([...queue.map(s => s.id), currentSong?.id, ...history.slice(0, 10).map(s => s.id)]);

      const freshRaw = data.data
        .map(saavnToSong)
        .filter(s => !ids.has(s.id))
        .slice(0, QUEUE_MAX - queue.length);

      // Pre-resolve download URLs while in foreground
      const fresh = await Promise.all(
        freshRaw.map(async (s) => {
          if (!s.downloadUrl?.length) {
            try {
              const { data: d } = await api.get(`/api/saavn/songs/${s.id}`);
              const sd = d?.data?.[0];
              if (sd?.downloadUrl) s.downloadUrl = sd.downloadUrl;
            } catch { }
          }
          return s;
        })
      );

      if (fresh.length || newStationId !== stationId) {
        const updated = [...get().queue, ...fresh];
        set({ queue: updated, stationId: newStationId });
        saveSession({ currentSong: get().currentSong, queue: updated, progress: get().progress, history: get().history, stationId: newStationId });
      }
    } catch (e) { console.error("fetchSuggestions:", e); }
  },

  nextSong: async () => {
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

    // ── Use pre-resolved URL if available (critical for Android background) ──
    // If we pre-resolved this song's URL during the timeupdate handler,
    // inject it into the song object so playSong() can skip the network call.
    if (_preResolvedNextUrl && _preResolvedNextId === next.id) {
      if (!next.downloadUrl?.length) {
        // Inject the pre-resolved URL as a downloadUrl entry so resolveSaavnUrl()
        // finds it immediately without making a network call
        next.downloadUrl = [{ quality: "320kbps", url: _preResolvedNextUrl }];
      }
    }
    _preResolvedNextUrl = null;
    _preResolvedNextId = null;

    const newQueue = queue.filter((_, i) => i !== idx);
    get().playSong(next, { fromQueue: true, updatedQueue: newQueue });
  },

  prevSong: () => {
    const { history, progress } = get();
    if (progress > 3) { const el = getAudio(); el.currentTime = 0; set({ progress: 0 }); return; }
    if (history.length) get().playSong(history[0], { fromHistory: true });
  },

  playFromQueue: (index) => {
    const { queue } = get();
    const song = queue[index];
    if (!song) return;
    const newQueue = queue.filter((_, i) => i !== index);
    get().playSong(song, { fromQueue: true, updatedQueue: newQueue });
  },

  togglePlay: () => {
    const el = getAudio();
    // Let the audio element's play/pause events handle isPlaying state
    // This prevents race conditions with MediaSession
    if (el.paused) {
      // Handle first interaction after app reload (no src yet)
      if (!el.src && get().currentSong) {
        get().playSong(get().currentSong, {
          fromQueue: true,
          updatedQueue: get().queue,
          initialProgress: get().progress
        });
      } else {
        el.play().catch(() => { });
      }
    }
    else { el.pause(); }
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
    // Pre-resolve if library song without downloadUrl
    if (!song.downloadUrl?.length) preResolveQueueUrls(get);
  },
  playNext: (song) => {
    const q = [song, ...get().queue];
    set({ queue: q });
    saveSession({ currentSong: get().currentSong, queue: q, progress: get().progress, history: get().history, stationId: get().stationId });
    // Pre-resolve if library song without downloadUrl
    if (!song.downloadUrl?.length) preResolveQueueUrls(get);
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
  clearQueue: () => {
    set({ queue: [], stationId: null });
    saveSession({ currentSong: get().currentSong, queue: [], progress: get().progress, history: get().history, stationId: null });
  },
  toggleAutoQueue: () => set(s => { const v = !s.autoQueue; localStorage.setItem("autoQueue", v); return { autoQueue: v }; }),
}));

// ── Register recovery callback with audioSession ──────────────
// audioSession needs a way to call nextSong on visibility-recovery
// without importing playerStore (which would create a circular dep).
// We pass a thin arrow so it always calls the latest store state.
registerRecoveryCallback(() => usePlayerStore.getState().nextSong());