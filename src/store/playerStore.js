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
    if (autoQueue && queue.filter(s => s.id !== song.id).length < 3) {
      setTimeout(() => get().fetchRelated(song.id), 2000);
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
        const { queue, currentSong } = get();
        const existingIds = new Set([...queue.map(s => s.id), currentSong?.id]);
        const newSongs = data.results.filter(s => !existingIds.has(s.id)).slice(0, 5);
        set({ queue: [...queue, ...newSongs] });
      }
    } catch (err) {
      console.error("Failed to fetch related:", err);
    }
  },

  nextSong: () => {
    const { queue, shuffle, repeat, history, playSong, currentSong } = get();
    if (repeat === "one") {
      // replay current — signal Player to seek to 0
      set({ progress: 0 });
      if (window._ytPlayer?.seekTo) {
        window._ytPlayer.seekTo(0, true);
        window._ytPlayer.playVideo();
      }
      return;
    }
    if (queue.length === 0) {
      if (repeat === "all" && history.length > 0) {
        playSong(history[history.length - 1]);
      } else {
        set({ isPlaying: false });
      }
      return;
    }
    const nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : 0;
    const nextSong = queue[nextIndex];
    const newQueue = queue.filter((_, i) => i !== nextIndex);
    set({ queue: newQueue });
    playSong(nextSong);
  },

  prevSong: () => {
    const { history, progress, playSong } = get();
    if (progress > 3) {
      set({ progress: 0 });
      if (window._ytPlayer?.seekTo) {
        window._ytPlayer.seekTo(0, true);
        window._ytPlayer.playVideo();
      }
      return;
    }
    if (history.length > 1) {
      playSong(history[1]);
    } else if (history.length === 1) {
      playSong(history[0]);
    }
  },

  playFromQueue: (index) => {
    const { queue, playSong } = get();
    const song = queue[index];
    if (!song) return;
    const newQueue = queue.filter((_, i) => i !== index);
    set({ queue: newQueue });
    playSong(song);
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

  setProgress: (progress) => set({ progress }),
  addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),
  playNext: (song) => set((state) => ({ queue: [song, ...state.queue] })),
  removeFromQueue: (index) => set((state) => ({ queue: state.queue.filter((_, i) => i !== index) })),

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