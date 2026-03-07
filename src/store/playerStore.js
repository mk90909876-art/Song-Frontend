import { create } from "zustand";

const MAX_HISTORY = 50;

export const usePlayerStore = create((set, get) => ({
  currentSong: null,
  isPlaying: false,
  queue: [],
  history: [],
  shuffle: false,
  repeat: "none", // none | all | one
  volume: parseFloat(localStorage.getItem("volume") || "1"),
  progress: 0,
  duration: 0,
  autoQueue: localStorage.getItem("autoQueue") === "true",

  // Called by Player.jsx when YouTube IFrame reports duration
  setDuration: (duration) => set({ duration }),

  // Called by Player.jsx when YouTube IFrame reports progress
  setProgress: (progress) => set({ progress }),

  // Called by Player.jsx when song ends
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  playSong: (song) => {
    const { history, currentSong, autoQueue, queue, fetchRelated } = get();
    const newHistory = currentSong
      ? [currentSong, ...history.filter(h => h.id !== currentSong.id)].slice(0, MAX_HISTORY)
      : history;

    set({ currentSong: song, isPlaying: true, progress: 0, history: newHistory });

    // Auto queue related songs if queue is low
    if (autoQueue && queue.length < 3) {
      setTimeout(() => fetchRelated(song.id), 2000);
    }
  },

  fetchRelated: async (videoId) => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/music/related/${videoId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.results?.length) {
        const { queue } = get();
        const existingIds = new Set(queue.map(s => s.id));
        const newSongs = data.results.filter(s => s.id !== videoId && !existingIds.has(s.id)).slice(0, 5);
        set({ queue: [...queue, ...newSongs] });
      }
    } catch (err) {
      console.error("Failed to fetch related:", err);
    }
  },

  nextSong: () => {
    const { queue, shuffle, repeat, currentSong, history, playSong } = get();
    if (repeat === "one") {
      set({ progress: 0, isPlaying: true });
      return;
    }
    if (queue.length === 0) {
      if (repeat === "all" && history.length > 0) {
        const song = history[history.length - 1];
        playSong(song);
      }
      return;
    }
    let nextIndex = 0;
    if (shuffle) nextIndex = Math.floor(Math.random() * queue.length);
    const nextSong = queue[nextIndex];
    const newQueue = queue.filter((_, i) => i !== nextIndex);
    set({ queue: newQueue });
    playSong(nextSong);
  },

  prevSong: () => {
    const { history, progress, playSong } = get();
    if (progress > 3) {
      set({ progress: 0, isPlaying: true });
      return;
    }
    if (history.length > 1) {
      playSong(history[1]);
    }
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  toggleRepeat: () => set((state) => ({
    repeat: state.repeat === "none" ? "all" : state.repeat === "all" ? "one" : "none"
  })),

  setVolume: (volume) => {
    localStorage.setItem("volume", volume);
    set({ volume });
  },

  seekTo: (progress) => set({ progress }),

  addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),

  playNext: (song) => set((state) => ({ queue: [song, ...state.queue] })),

  removeFromQueue: (index) => set((state) => ({
    queue: state.queue.filter((_, i) => i !== index)
  })),

  moveQueueItem: (from, to) => set((state) => {
    const newQueue = [...state.queue];
    const [item] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, item);
    return { queue: newQueue };
  }),

  clearQueue: () => set({ queue: [] }),

  toggleAutoQueue: () => set((state) => {
    const newVal = !state.autoQueue;
    localStorage.setItem("autoQueue", newVal);
    return { autoQueue: newVal };
  }),
}));