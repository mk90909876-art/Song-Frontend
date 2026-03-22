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

// ── YouTube channel names that are useless for Saavn search ──
const CHANNEL_NAMES = [
  "t-series", "sony music", "zee music", "tips official", "yrf", "eros now",
  "saregama", "speed records", "rajshri", "shemaroo", "colors tv", "star music",
  "universal music", "warner music", "atlantic records", "umg", "vevo",
  "official", "music", "records", "entertainment", "productions",
];

const isChannelName = (name) => {
  const n = name.toLowerCase();
  return CHANNEL_NAMES.some(c => n.includes(c));
};

// ── Title cleaner ─────────────────────────────────────────────
// YouTube titles follow patterns like:
//   "Song Name - Artist | Official Video | Channel"
//   "Artist - Song Name (Official Video)"
//   "Song Name (Lyrical) | Movie | Singer | Channel"
const cleanForSearch = (ytTitle, ytArtist) => {
  let title = ytTitle || "";
  let artist = ytArtist || "";

  // Step 1: Remove everything after | (channel info, movie names etc)
  title = title.split("|")[0].trim();

  // Step 2: Handle "X - Y" pattern
  // If title has " - ", figure out which side is song vs artist
  if (title.includes(" - ")) {
    const parts = title.split(" - ");
    const left = parts[0].trim();
    const right = parts.slice(1).join(" - ").trim();

    // If right side has spaces (longer), it's likely "Artist - Song Title"
    // If left side is short and right side is longer, left=artist, right=song
    if (right.length > left.length && left.split(" ").length <= 3) {
      // Pattern: "Aditya Rikhari - Paaro" → artist=left, song=right
      artist = left;
      title = right;
    } else {
      // Pattern: "Song Name - Official Video" → just use left
      title = left;
    }
  }

  // Step 3: Clean the title further
  title = title
    .replace(/\(official.*?\)/gi, "")
    .replace(/\(lyric.*?\)/gi, "")
    .replace(/\(full.*?\)/gi, "")
    .replace(/\(video.*?\)/gi, "")
    .replace(/\(audio.*?\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/feat\..*/gi, "")
    .replace(/ft\..*/gi, "")
    .replace(/:.*$/, "") // remove ": subtitle" like "Dil: Shreya's Version" → "Dil"
    .replace(/-\s*$/, "") // trailing dash
    .trim();

  // Step 4: Clean artist — if it's a channel name use empty (better to search by title only)
  if (isChannelName(artist)) {
    artist = "";
    // Try to extract artist from title if still has pattern
  }

  return {
    title: title.slice(0, 50).trim(),
    artist: artist.slice(0, 30).trim(),
  };
};

// ── Saavn search + match ──────────────────────────────────────
const findSaavnSong = async (song) => {
  const { title: ct, artist: ca } = cleanForSearch(song.title, song.artist);
  const ytDur = song.duration || 0; // seconds from yt-dlp search results
  console.log(`🎵 Looking for: "${ct}" by "${ca}" (${ytDur}s)`);

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

      // Log all candidates
      results.forEach((s, i) => {
        console.log(`  [${i}] "${s.name}" dur=${s.duration}s`);
      });

      let best;
      if (ytDur > 0) {
        // Pick closest duration match
        best = results.reduce((b, s) => {
          const sd = Number(s.duration) || 0;
          const bd = Number(b.duration) || 0;
          return Math.abs(sd - ytDur) < Math.abs(bd - ytDur) ? s : b;
        });
        const diff = Math.abs((Number(best.duration) || 0) - ytDur);
        console.log(`  → Best: "${best.name}" diff=${diff}s`);
        if (diff > 45) {
          console.warn(`  ⚠️ Too different (${diff}s), trying next query`);
          continue;
        }
      } else {
        best = results[0];
        console.log(`  → No YT duration, using first: "${best.name}"`);
      }

      const urls = best.downloadUrl || [];
      const audio = urls.find(u => u.quality === "320kbps")
        || urls.find(u => u.quality === "160kbps")
        || urls[urls.length - 1];
      if (!audio?.url) continue;

      console.log(`✅ Saavn: "${best.name}" @ ${audio.quality}`);
      return { url: audio.url, quality: audio.quality, name: best.name };
    } catch (e) {
      console.warn(`Saavn "${q}" error:`, e.message);
    }
  }
  console.warn(`❌ No match: "${song.title}"`);
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
    // Must be in DOM for Android media notification to appear
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
    document.body.appendChild(el);

    el.addEventListener("timeupdate", () => {
      if (el.src && el.currentTime > 0) {
        usePlayerStore.getState().setProgress(el.currentTime);
        // Keep notification seek bar in sync
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

    // Set handlers FIRST — Android requires handlers before showing notification
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
    } catch {} // some browsers don't support these

    // Set metadata after handlers
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      artwork: [
        { src: song.thumbnail, sizes: "480x360", type: "image/jpeg" },
        { src: song.thumbnail.replace("hqdefault", "maxresdefault"), sizes: "1280x720", type: "image/jpeg" },
      ],
    });
    navigator.mediaSession.playbackState = "playing";

    // Position state shows seek bar in notification
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