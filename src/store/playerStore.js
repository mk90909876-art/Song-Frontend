import { create } from "zustand";

const MAX_HISTORY = 50;

export const usePlayerStore = create((set, get) => ({
  currentSong: null,
  isPlaying: false,
  queue: [],
  history: [],
  shuffle: false,
  repeat: "none",
  volume: parseFloat(localStorage.getItem("volume") || "1"),
  progress: 0,
  duration: 0,
  autoQueue: localStorage.getItem("autoQueue") === "true",

  setDuration: (duration) => set({ duration }),
  setProgress: (progress) => set({ progress }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  playSong: (song) => {
    const { history, currentSong, autoQueue, queue } = get();
    const newHistory = currentSong
      ? [currentSong, ...history.filter(h => h.id !== currentSong.id)].slice(0, MAX_HISTORY)
      : history;
    set({ currentSong: song, isPlaying: true, progress: 0, duration: 0, history: newHistory });

    // Directly load in YT player
    const tryLoad = () => {
      if (window._ytPlayer?.loadVideoById) {
        window._ytPlayer.loadVideoById(song.id);
      } else {
        setTimeout(tryLoad, 150);
      }
    };
    tryLoad();

    // Auto queue: only fetch if queue is getting low
    if (autoQueue && queue.filter(s => s.id !== song.id).length < 3) {
      setTimeout(() => get().fetchRelated(song), 2000);
    }
  },

  // Search by title + artist for relevant results
  fetchRelated: async (song) => {
    try {
      const token = localStorage.getItem("access_token");
      // Use YouTube Mix — most similar songs to current
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/music/mix/${song.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.results?.length) {
        const { queue, currentSong, history } = get();
        const existingIds = new Set([
          ...queue.map(s => s.id),
          currentSong?.id,
          ...history.slice(0, 5).map(s => s.id), // avoid recently played too
        ]);
        const newSongs = data.results
          .filter(s => !existingIds.has(s.id))
          .slice(0, 5);
        if (newSongs.length > 0) {
          set({ queue: [...queue, ...newSongs] });
        }
      }
    } catch (err) {
      console.error("Failed to fetch related:", err);
    }
  },

  nextSong: () => {
    const { queue, shuffle, repeat, history } = get();
    if (repeat === "one") {
      window._ytPlayer?.seekTo?.(0, true);
      window._ytPlayer?.playVideo?.();
      set({ progress: 0 });
      return;
    }
    if (queue.length === 0) {
      if (repeat === "all" && history.length > 0) {
        get().playSong(history[history.length - 1]);
      } else {
        set({ isPlaying: false });
        window._ytPlayer?.pauseVideo?.();
      }
      return;
    }
    const nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : 0;
    const nextSong = queue[nextIndex];
    const newQueue = queue.filter((_, i) => i !== nextIndex);
    set({ queue: newQueue });
    get().playSong(nextSong);
  },

  prevSong: () => {
    const { history, progress } = get();
    if (progress > 3) {
      window._ytPlayer?.seekTo?.(0, true);
      window._ytPlayer?.playVideo?.();
      set({ progress: 0 });
      return;
    }
    if (history.length > 1) get().playSong(history[1]);
    else if (history.length === 1) get().playSong(history[0]);
  },

  playFromQueue: (index) => {
    const { queue } = get();
    const song = queue[index];
    if (!song) return;
    set({ queue: queue.filter((_, i) => i !== index) });
    get().playSong(song);
  },

  togglePlay: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      window._ytPlayer?.pauseVideo?.();
      set({ isPlaying: false });
    } else {
      window._ytPlayer?.playVideo?.();
      set({ isPlaying: true });
    }
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  toggleRepeat: () => set((s) => ({
    repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "one" : "none"
  })),

  setVolume: (volume) => {
    localStorage.setItem("volume", volume);
    window._ytPlayer?.setVolume?.(volume * 100);
    set({ volume });
  },

  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),
  playNext: (song) => set((s) => ({ queue: [song, ...s.queue] })),
  removeFromQueue: (index) => set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  moveQueueItem: (from, to) => set((s) => {
    const q = [...s.queue];
    const [item] = q.splice(from, 1);
    q.splice(to, 0, item);
    return { queue: q };
  }),
  clearQueue: () => set({ queue: [] }),
  toggleAutoQueue: () => set((s) => {
    const v = !s.autoQueue;
    localStorage.setItem("autoQueue", v);
    return { autoQueue: v };
  }),
}));