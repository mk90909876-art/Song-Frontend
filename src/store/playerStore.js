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
// ── Noise words in YouTube titles ────────────────────────────
const NOISE_WORDS = new Set([
  "official","video","audio","lyric","lyrics","lyrical","full","song","music",
  "hd","4k","8k","visualizer","visualiser","animation","animated",
  "unplugged","live","acoustic","remix","remaster","remastered",
  "extended","version","original","promo","teaser","trailer",
  "making","behind","scenes","bonus","track","new","latest",
  "2020","2021","2022","2023","2024","2025","2026",
]);

// Inline uppercase noise phrases to strip after all other processing
const INLINE_NOISE_RE = /\b(FULL\s+VIDEO\s+SONG|FULL\s+VIDEO|FULL\s+SONG|FULL\s+AUDIO|LYRIC\s+VIDEO|OFFICIAL\s+VIDEO|OFFICIAL\s+AUDIO|MUSIC\s+VIDEO)\b/g;

const CHANNEL_NAMES = [
  "t-series","tseries","sony music","zee music","tips official","tips films",
  "yrf","eros now","saregama","speed records","rajshri","shemaroo",
  "colors tv","star music","universal music","warner music","atlantic",
  "umg","vevo","desi music","crown records","romance rewind",
  "bollywood lofi","mr jatt","pagalworld","gaana","wynk",
];

const isNoise = (str) => {
  const s = str.toLowerCase().trim();
  if (!s) return true;
  if (CHANNEL_NAMES.some(c => s.includes(c))) return true;
  const words = s.split(/\s+/);
  return words.length > 0 && words.every(w => NOISE_WORDS.has(w) || /^\d{4}$/.test(w));
};

const looksLikeArtistList = (str) => str.includes(",");
const isAllCaps = (str) => str.length > 1 && str === str.toUpperCase() && /[A-Z]/.test(str);

// Patterns that mean "what comes AFTER the colon is the real title"
const COLON_LEFT_IS_NOISE = /^(full\s+video|full\s+song|official\s+video|lyrical?\s+video|audio\s+song|title\s+track|title\s+song)/i;

// ── Title cleaner — handles ALL YouTube title patterns ────────
const cleanForSearch = (ytTitle, ytArtist) => {
  // Normalise smart/curly quotes to straight
  let raw = (ytTitle || "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/@\S+/g, "")
    .trim();

  // "Arijit Singh | Song Name" — if left of | looks like a single person name (no noise), swap
  if (raw.includes("|")) {
    const parts = raw.split("|").map(p => p.trim());
    const left = parts[0];
    const right = parts.slice(1).join("|").trim();
    const leftWords = left.split(/\s+/).length;
    // If left is 1-3 words and right has more content, left is likely the artist
    if (leftWords <= 3 && right.length > left.length && !isNoise(left)) {
      raw = right;
    } else {
      raw = left;
    }
  }

  // Remove noise parentheses: (Official Video), (Full Song), (4K HD) etc.
  raw = raw.replace(/\(([^)]*)\)/gi, (match, inner) => {
    const low = inner.toLowerCase();
    return [...NOISE_WORDS].some(n => low.includes(n)) ? "" : match;
  });

  // Remove square brackets entirely
  raw = raw.replace(/\[.*?\]/g, "").trim();

  // Remove feat/ft/with and everything after
  raw = raw.replace(/\s+(feat\.|ft\.|featuring)\s*.*/gi, "").trim();

  // Strip "Title Song", "Title Track" suffix
  raw = raw.replace(/\s+(title\s+song|title\s+track)\b/gi, "").trim();

  // Handle colon
  if (raw.includes(":")) {
    const colonIdx = raw.indexOf(":");
    const left = raw.slice(0, colonIdx).trim();
    const right = raw.slice(colonIdx + 1).trim();
    if (COLON_LEFT_IS_NOISE.test(left)) {
      raw = right;
    } else {
      raw = left.trim();
    }
  }

  // Normalise dashes — handle no-space dash: "-Official", "-Lyric" etc.
  raw = raw.replace(/\s*-(?=[A-Z])/g, " - ");

  let songTitle = raw;
  let extractedArtist = "";

  // Handle "A - B" pattern
  if (raw.includes(" - ")) {
    // Use only the FIRST dash to split
    const dashIdx = raw.indexOf(" - ");
    const left = raw.slice(0, dashIdx).trim();
    const right = raw.slice(dashIdx + 3).trim();

    // Strip any remaining "- noise" suffixes from right recursively
    const stripNoiseSuffix = (s) => s.replace(/\s+-\s+\S.*$/, "").trim();
    const cleanRight = stripNoiseSuffix(right);

    const rightIsNoise = isNoise(cleanRight);
    const leftIsArtistList = looksLikeArtistList(left);
    const rightIsArtistList = looksLikeArtistList(cleanRight);
    const leftWords = left.split(/\s+/).length;

    if (rightIsNoise) {
      songTitle = left;
    } else if (leftIsArtistList) {
      // "TALWIINDER, NDS - Song" → song is on right
      songTitle = cleanRight;
      extractedArtist = left.split(",")[0].trim();
    } else if (rightIsArtistList) {
      // "HASEEN - TALWIINDER, NDS, RIPPY" → song=left
      songTitle = left;
      extractedArtist = cleanRight.split(",")[0].trim();
    } else if (leftWords <= 3 && !isNoise(left) && !isAllCaps(left)) {
      // "Aditya Rikhari - Paaro" → artist=left, song=right
      extractedArtist = left;
      songTitle = cleanRight;
    } else {
      // Default: left is song
      songTitle = left;
    }
  }

  // Strip inline uppercase noise phrases: "FULL VIDEO SONG" etc.
  songTitle = songTitle.replace(INLINE_NOISE_RE, "").trim();

  // Final cleanup
  songTitle = songTitle.replace(/[-:]\s*$/, "").replace(/\s+/g, " ").trim();

  // Determine final artist
  let cleanArtist = (ytArtist || "").split(/[,&]/)[0].replace(/@\S+/g, "").replace(/vevo/gi, "").trim();

  if (isNoise(cleanArtist)) {
    cleanArtist = extractedArtist;
  } else if (extractedArtist && !isNoise(extractedArtist)) {
    cleanArtist = extractedArtist;
  }

  console.log(`🧹 "${ytTitle}" → title="${songTitle}" artist="${cleanArtist}"`);
  return {
    title: songTitle.slice(0, 60).trim(),
    artist: cleanArtist.slice(0, 40).trim(),
  };
};

// ── Scoring helpers ───────────────────────────────────────────

// Normalise a string for comparison: lowercase, strip punctuation, split to word set
const tokenize = (str) =>
  new Set((str || "").toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean));

// Jaccard similarity between two word sets
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach(w => { if (b.has(w)) intersection++; });
  return intersection / (a.size + b.size - intersection);
};

// Duration score: 1.0 at 0s diff, linear decay, 0 at 90s diff
const durationScore = (saavnDur, ytDur) => {
  if (!ytDur || !saavnDur) return 0.5; // no duration info — neutral
  const diff = Math.abs(Number(saavnDur) - ytDur);
  return Math.max(0, 1 - diff / 90);
};

// Score a single Saavn result against our target
const scoreSaavnResult = (saavnSong, cleanTitle, cleanArtist, ytDur) => {
  const titleTokens = tokenize(cleanTitle);
  const artistTokens = tokenize(cleanArtist);

  const saavnTitleTokens = tokenize(saavnSong.name);
  const saavnArtistStr = saavnSong.artists?.primary?.map(a => a.name).join(" ")
    || saavnSong.primaryArtists
    || saavnSong.more_info?.artistMap?.primary_artists?.map(a => a.name).join(" ")
    || "";
  const saavnArtistTokens = tokenize(saavnArtistStr);

  const nameSim = jaccard(titleTokens, saavnTitleTokens);
  const artistSim = jaccard(artistTokens, saavnArtistTokens);
  const durSim = durationScore(saavnSong.duration, ytDur);

  const score = nameSim * 0.50 + durSim * 0.35 + artistSim * 0.15;

  return { score, nameSim, artistSim, durSim };
};

// ── Saavn search + scored match ───────────────────────────────
const findSaavnSong = async (song) => {
  const { title: ct, artist: ca } = cleanForSearch(song.title, song.artist);
  const ytDur = song.duration || 0;
  console.log(`🎵 Looking for: "${ct}" by "${ca}" (${ytDur}s)`);

  const queries = [
    `${ct} ${ca}`.trim(),
    ct,
    `${ct} ${ca.split(" ")[0]}`.trim(),
  ].filter((q, i, arr) => q.length > 1 && arr.indexOf(q) === i);

  let globalBest = null;
  let globalBestScore = -1;

  for (const q of queries) {
    try {
      console.log(`🔍 Saavn: "${q}"`);
      const res = await fetch(`${SAAVN}/api/search/songs?query=${encodeURIComponent(q)}&limit=10`);
      if (!res.ok) continue;
      const data = await res.json();
      const results = (data?.data?.results || data?.results || [])
        .filter(s => s.downloadUrl?.length > 0);
      if (!results.length) continue;

      for (const s of results) {
        const { score, nameSim, artistSim, durSim } = scoreSaavnResult(s, ct, ca, ytDur);
        console.log(`  "${s.name}" → score=${score.toFixed(2)} (name=${nameSim.toFixed(2)} dur=${durSim.toFixed(2)} artist=${artistSim.toFixed(2)})`);
        if (score > globalBestScore) {
          globalBestScore = score;
          globalBest = s;
        }
      }
    } catch (e) {
      console.warn(`Saavn "${q}" error:`, e.message);
    }
  }

  // Minimum threshold: name similarity must be non-zero (at least one word overlap)
  const { nameSim } = globalBest ? scoreSaavnResult(globalBest, ct, ca, ytDur) : { nameSim: 0 };
  if (!globalBest || nameSim === 0) {
    console.warn(`❌ No match: "${song.title}"`);
    return null;
  }

  const urls = globalBest.downloadUrl || [];
  const audio = urls.find(u => u.quality === "320kbps")
    || urls.find(u => u.quality === "160kbps")
    || urls[urls.length - 1];
  if (!audio?.url) {
    console.warn(`❌ No stream URL for best match: "${globalBest.name}"`);
    return null;
  }

  console.log(`✅ Saavn: "${globalBest.name}" score=${globalBestScore.toFixed(2)} @ ${audio.quality}`);
  return { url: audio.url, quality: audio.quality, name: globalBest.name };
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