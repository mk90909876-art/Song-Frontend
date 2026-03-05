import { create } from "zustand";
import api from "../utils/api";

const getAutoQueue = () => localStorage.getItem("autoQueue") !== "false";

export const usePlayerStore = create((set, get) => ({
  currentSong: null,
  streamUrl: null,
  queue: [],
  history: [],
  isPlaying: false,
  volume: parseFloat(localStorage.getItem("volume") || "1"),
  progress: 0,
  duration: 0,
  shuffle: false,
  repeat: "off", // off | all | one
  loadingStream: false,
  autoQueue: getAutoQueue(),

  setIsPlaying: (v) => set({ isPlaying: v }),
  setProgress: (v) => set({ progress: v }),
  setDuration: (v) => set({ duration: v }),
  setVolume: (v) => {
    localStorage.setItem("volume", v);
    set({ volume: v });
  },

  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),

  toggleRepeat: () => set(s => ({
    repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off"
  })),

  toggleAutoQueue: () => {
    const next = !get().autoQueue;
    localStorage.setItem("autoQueue", next);
    set({ autoQueue: next });
  },

  addToQueue: (song) => set(s => ({
    queue: s.queue.some(q => q.id === song.id) ? s.queue : [...s.queue, song]
  })),

  playSong: async (song) => {
    set({ loadingStream: true, currentSong: song, isPlaying: false });
    try {
      const { data } = await api.get(`/api/music/stream/${song.id}`);
      set({ streamUrl: data.stream_url, isPlaying: true, loadingStream: false, progress: 0 });

      // Add to history
      set(s => ({
        history: [song, ...s.history.filter(h => h.id !== song.id)].slice(0, 50)
      }));

      // Auto queue — fetch related if queue is low
      // Auto queue — fetch related if queue is low
if (get().autoQueue && get().queue.length < 3) {
  setTimeout(() => get().fetchRelated(song.id), 2000);
}
    } catch (err) {
      console.error("Stream error:", err);
      set({ loadingStream: false });
    }
  },

  fetchRelated: async (videoId) => {
    try {
      const { data } = await api.get(`/api/music/related/${videoId}`);
      const existing = new Set([
        get().currentSong?.id,
        ...get().queue.map(s => s.id),
        ...get().history.map(s => s.id),
      ]);
      const fresh = data.results.filter(s => !existing.has(s.id));
      set(s => ({ queue: [...s.queue, ...fresh.slice(0, 5)] }));
    } catch (err) {
      console.error("Failed to fetch related:", err);
    }
  },

  nextSong: () => {
    const { queue, shuffle, repeat, currentSong, history } = get();

    if (repeat === "one") {
      get().playSong(currentSong);
      return;
    }

    if (queue.length === 0) {
      if (repeat === "all" && history.length > 0) {
        get().playSong(history[history.length - 1]);
      }
      return;
    }

    let next;
    let newQueue;
    if (shuffle) {
      const idx = Math.floor(Math.random() * queue.length);
      next = queue[idx];
      newQueue = queue.filter((_, i) => i !== idx);
    } else {
      [next, ...newQueue] = queue;
    }

    set({ queue: newQueue });
    get().playSong(next);

    // Refill queue if low and autoQueue on
    if (get().autoQueue && newQueue.length < 3 && next) {
      get().fetchRelated(next.id);
    }
  },

  prevSong: () => {
    const { history, currentSong } = get();
    if (get().progress > 3) {
      get().playSong(currentSong);
      return;
    }
    if (history.length > 1) {
      const prev = history[1];
      set(s => ({ history: s.history.slice(1) }));
      get().playSong(prev);
    }
  },
}));