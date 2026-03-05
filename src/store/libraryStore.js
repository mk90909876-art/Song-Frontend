import { create } from "zustand";
import api from "../utils/api";

export const useLibraryStore = create((set, get) => ({
  likedSongs: [],
  playlists: [],
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
        likedSongs: likedRes.data.songs,
        playlists: playlistsRes.data.playlists,
        loaded: true,
      });
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  },

  // ── Clear on logout ────────────────────────────────────────
  clearLibrary: () => set({ likedSongs: [], playlists: [], playlistSongs: {}, loaded: false }),

  // ── Liked Songs ────────────────────────────────────────────
  isLiked: (videoId) => get().likedSongs.some(s => s.yt_video_id === videoId),

  likeSong: async (song) => {
    // Optimistic update — update UI instantly
    const newSong = {
      yt_video_id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail_url: song.thumbnail,
      duration_seconds: song.duration,
      liked_at: new Date().toISOString(),
    };
    set(s => ({ likedSongs: [newSong, ...s.likedSongs] }));

    // Sync to server in background
    try {
      await api.post("/api/library/liked", {
        yt_video_id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail_url: song.thumbnail,
        duration_seconds: song.duration,
      });
    } catch (err) {
      // Revert on failure
      set(s => ({ likedSongs: s.likedSongs.filter(s => s.yt_video_id !== song.id) }));
      console.error("Failed to like song:", err);
    }
  },

  unlikeSong: async (videoId) => {
    // Optimistic update
    const prev = get().likedSongs;
    set(s => ({ likedSongs: s.likedSongs.filter(s => s.yt_video_id !== videoId) }));

    // Sync to server
    try {
      await api.delete(`/api/library/liked/${videoId}`);
    } catch (err) {
      // Revert on failure
      set({ likedSongs: prev });
      console.error("Failed to unlike song:", err);
    }
  },

  // ── Playlists ──────────────────────────────────────────────
  createPlaylist: async (name, description = "") => {
    const { data } = await api.post("/api/library/playlists", { name, description });
    set(s => ({ playlists: [data.playlist, ...s.playlists] }));
    return data.playlist;
  },

  deletePlaylist: async (id) => {
    set(s => ({ playlists: s.playlists.filter(p => p.id !== id) }));
    try {
      await api.delete(`/api/library/playlists/${id}`);
    } catch (err) {
      console.error("Failed to delete playlist:", err);
    }
  },

  // ── Playlist Songs ─────────────────────────────────────────
  loadPlaylistSongs: async (playlistId) => {
    // always fetch fresh
    const { data } = await api.get(`/api/library/playlists/${playlistId}/songs`);
    set(s => ({ playlistSongs: { ...s.playlistSongs, [playlistId]: data.songs } }));
  },

  addSongToPlaylist: async (playlistId, song) => {
    // Optimistic update
    const newSong = {
      yt_video_id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail_url: song.thumbnail,
      duration_seconds: song.duration,
    };
    set(s => ({
      playlistSongs: {
        ...s.playlistSongs,
        [playlistId]: [...(s.playlistSongs[playlistId] || []), newSong],
      }
    }));

    try {
      await api.post(`/api/library/playlists/${playlistId}/songs`, {
        yt_video_id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail_url: song.thumbnail,
        duration_seconds: song.duration,
      });
    } catch (err) {
      console.error("Failed to add song to playlist:", err);
    }
  },

  removeSongFromPlaylist: async (playlistId, videoId) => {
    set(s => ({
      playlistSongs: {
        ...s.playlistSongs,
        [playlistId]: (s.playlistSongs[playlistId] || []).filter(s => s.yt_video_id !== videoId),
      }
    }));
    try {
      await api.delete(`/api/library/playlists/${playlistId}/songs/${videoId}`);
    } catch (err) {
      console.error("Failed to remove song:", err);
    }
  },
}));