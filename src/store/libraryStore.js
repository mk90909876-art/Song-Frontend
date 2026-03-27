import { create } from "zustand";
import api from "../utils/api";

// ── Local Persistence ────────────────────────────────────────
const saveLibraryLocal = (state) => {
  try {
    localStorage.setItem("local_liked", JSON.stringify(state.likedSongs));
    localStorage.setItem("local_playlists", JSON.stringify(state.playlists));
  } catch {}
};
const loadLibraryLocal = () => {
  try {
    return {
      likedSongs: JSON.parse(localStorage.getItem("local_liked") || "[]"),
      playlists: JSON.parse(localStorage.getItem("local_playlists") || "[]"),
    };
  } catch { return { likedSongs: [], playlists: [] }; }
};

const localData = loadLibraryLocal();

export const useLibraryStore = create((set, get) => ({
  likedSongs: localData.likedSongs,
  playlists: localData.playlists,
  playlistSongs: {}, // { playlistId: [songs] }
  loaded: false,

  // ── Load everything once on login ──────────────────────────
  loadLibrary: async () => {
    if (get().loaded) return; // already loaded
    try {
      const [likedRes, playlistsRes] = await Promise.all([
        api.get("/api/library/liked"),
        api.get("/api/library/playlists"),
      ]);
      set({
        likedSongs: likedRes.data.songs.map(s => ({
          id: s.saavn_id,
          title: s.title,
          artist: s.artist,
          thumbnail: s.thumbnail_url,
          duration: s.duration_seconds,
          source: "saavn",
          liked_at: s.liked_at,
        })),
        playlists: playlistsRes.data.playlists,
        loaded: true,
      });
      saveLibraryLocal(get());
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  },

  // ── Clear on logout ────────────────────────────────────────
  clearLibrary: () => set({ likedSongs: [], playlists: [], playlistSongs: {}, loaded: false }),

  // ── Liked Songs ────────────────────────────────────────────
  isLiked: (id) => get().likedSongs.some(s => s.id === id),

  likeSong: async (song) => {
    // Standardize before adding to state
    const standardized = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
      duration: song.duration,
      source: "saavn",
      liked_at: new Date().toISOString(),
    };
    
    set(s => ({ likedSongs: [standardized, ...s.likedSongs] }));
    saveLibraryLocal(get());

    try {
      await api.post("/api/library/liked", {
        saavn_id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail_url: song.thumbnail,
        duration_seconds: song.duration,
      });
    } catch (err) {
      set(s => ({ likedSongs: s.likedSongs.filter(s => s.id !== song.id) }));
      console.error("Failed to like song:", err);
    }
  },

  unlikeSong: async (id) => {
    const prev = get().likedSongs;
    set(s => ({ likedSongs: s.likedSongs.filter(s => s.id !== id) }));
    saveLibraryLocal(get());

    try {
      await api.delete(`/api/library/liked/${id}`);
    } catch (err) {
      set({ likedSongs: prev });
      console.error("Failed to unlike song:", err);
    }
  },

  // ── Playlists ──────────────────────────────────────────────
  createPlaylist: async (name, description = "") => {
    const { data } = await api.post("/api/library/playlists", { name, description });
    set(s => ({ playlists: [data.playlist, ...s.playlists] }));
    saveLibraryLocal(get());
    return data.playlist;
  },

  deletePlaylist: async (id) => {
    set(s => ({ playlists: s.playlists.filter(p => p.id !== id) }));
    saveLibraryLocal(get());
    try {
      await api.delete(`/api/library/playlists/${id}`);
    } catch (err) {
      console.error("Failed to delete playlist:", err);
    }
  },

  // ── Playlist Songs ─────────────────────────────────────────
  loadPlaylistSongs: async (playlistId) => {
    const { data } = await api.get(`/api/library/playlists/${playlistId}/songs`);
    const standardized = data.songs.map(s => ({
      id: s.saavn_id,
      title: s.title,
      artist: s.artist,
      thumbnail: s.thumbnail_url,
      duration: s.duration_seconds,
      source: "saavn",
    }));
    set(s => ({ playlistSongs: { ...s.playlistSongs, [playlistId]: standardized } }));
  },

  addSongToPlaylist: async (playlistId, song) => {
    const standardized = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
      duration: song.duration,
      source: "saavn",
    };
    set(s => ({
      playlistSongs: {
        ...s.playlistSongs,
        [playlistId]: [...(s.playlistSongs[playlistId] || []), standardized],
      }
    }));

    try {
      await api.post(`/api/library/playlists/${playlistId}/songs`, {
        saavn_id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail_url: song.thumbnail,
        duration_seconds: song.duration,
      });
    } catch (err) {
      console.error("Failed to add song to playlist:", err);
    }
  },

  removeSongFromPlaylist: async (playlistId, id) => {
    set(s => ({
      playlistSongs: {
        ...s.playlistSongs,
        [playlistId]: (s.playlistSongs[playlistId] || []).filter(s => s.id !== id),
      }
    }));
    try {
      await api.delete(`/api/library/playlists/${playlistId}/songs/${id}`);
    } catch (err) {
      console.error("Failed to remove song:", err);
    }
  },
}));