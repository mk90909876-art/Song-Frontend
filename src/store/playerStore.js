import { create } from "zustand";

const MAX_HISTORY = 50;
const QUEUE_MAX = 20;
const QUEUE_REFILL_AT = 10;

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

const session = loadSession();

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
  savedProgress: session.progress, // used to seek on restore

  setDuration: (duration) => set({ duration }),
  setProgress: (progress) => {
    set({ progress });
    // Save progress every ~5s to avoid too many writes
    if (Math.floor(progress) % 5 === 0) {
      try { localStorage.setItem("session_progress", String(progress)); } catch {}
    }
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  playSong: (song, options = {}) => {
    const { fromQueue = false } = options;
    const { history, currentSong, autoQueue, queue } = get();
    const newHistory = currentSong
      ? [currentSong, ...history.filter(h => h.id !== currentSong.id)].slice(0, MAX_HISTORY)
      : history;

    // If triggered from search/pages (not from queue), clear queue and fetch fresh mix
    const newQueue = fromQueue ? queue : [];
    const newState = { currentSong: song, isPlaying: true, progress: 0, duration: 0, history: newHistory, savedProgress: 0, queue: newQueue };
    set(newState);
    saveSession({ currentSong: song, queue: newQueue, progress: 0 });

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

    // Preload next song into secondary player
    if (newQueue.length > 0) {
      setTimeout(() => get().preloadNext(), 3000);
    }

    // Fetch fresh mix for new song (always when from search/pages, or when queue is low)
    if (autoQueue && (!fromQueue || newQueue.filter(s => s.id !== song.id).length < QUEUE_REFILL_AT)) {
      setTimeout(() => get().fetchMix(song), 2000);
    }
  },

  // Preload next song into the inactive player
  preloadNext: () => {
    const { queue } = get();
    if (queue.length === 0) return;
    const nextSong = queue[0];
    const inactivePlayer = window._activePlayer === "primary" ? window._ytPlayerB : window._ytPlayerA;
    if (inactivePlayer?.cueVideoById) {
      inactivePlayer.cueVideoById(nextSong.id);
      console.log("Preloaded:", nextSong.title);
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

      if (newSongs.length > 0) {
        const updatedQueue = [...get().queue, ...newSongs];
        set({ queue: updatedQueue });
        saveSession({ currentSong: get().currentSong, queue: updatedQueue, progress: get().progress });
        console.log(`Auto queue: added ${newSongs.length} songs, total ${updatedQueue.length}`);
      }
    } catch (err) {
      console.error("fetchMix failed:", err);
    }
  },

  nextSong: () => {
    const { queue, shuffle, repeat, history, currentSong } = get();

    if (repeat === "one") {
      const player = window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;
      player?.seekTo?.(0, true);
      player?.playVideo?.();
      set({ progress: 0 });
      return;
    }

    if (queue.length === 0) {
      if (repeat === "all" && history.length > 0) {
        get().playSong(history[history.length - 1], { fromQueue: true });
      } else {
        set({ isPlaying: false });
      }
      return;
    }

    const nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : 0;
    const next = queue[nextIndex];
    const newQueue = queue.filter((_, i) => i !== nextIndex);
    set({ queue: newQueue });
    get().playSong(next, { fromQueue: true });
  },

  prevSong: () => {
    const { history, progress } = get();
    if (progress > 3) {
      const player = window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;
      player?.seekTo?.(0, true);
      player?.playVideo?.();
      set({ progress: 0 });
      return;
    }
    if (history.length > 0) get().playSong(history[0], { fromQueue: true });
  },

  playFromQueue: (index) => {
    const { queue } = get();
    const song = queue[index];
    if (!song) return;
    const newQueue = queue.filter((_, i) => i !== index);
    set({ queue: newQueue });
    get().playSong(song, { fromQueue: true });
  },

  togglePlay: () => {
    const { isPlaying } = get();
    const player = window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;
    if (isPlaying) {
      player?.pauseVideo?.();
      set({ isPlaying: false });
    } else {
      player?.playVideo?.();
      set({ isPlaying: true });
    }
  },

  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
  toggleRepeat: () => set(s => ({
    repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "one" : "none"
  })),

  setVolume: (v) => {
    localStorage.setItem("volume", v);
    window._ytPlayerA?.setVolume?.(v * 100);
    window._ytPlayerB?.setVolume?.(0); // keep secondary silent
    set({ volume: v });
  },

  addToQueue: (song) => {
    const newQueue = [...get().queue, song];
    set({ queue: newQueue });
    saveSession({ currentSong: get().currentSong, queue: newQueue, progress: get().progress });
  },
  playNext: (song) => {
    const newQueue = [song, ...get().queue];
    set({ queue: newQueue });
    saveSession({ currentSong: get().currentSong, queue: newQueue, progress: get().progress });
  },
  removeFromQueue: (index) => {
    const newQueue = get().queue.filter((_, i) => i !== index);
    set({ queue: newQueue });
    saveSession({ currentSong: get().currentSong, queue: newQueue, progress: get().progress });
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