import { useState, useEffect } from "react";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import LikeButton from "../components/LikeButton";

function formatDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function SongRow({ song, index, onRemove }) {
  const { playSong, currentSong, isPlaying, addToQueue } = usePlayerStore();
  const isActive = currentSong?.id === song.yt_video_id;
  const songObj = { id: song.yt_video_id, title: song.title, artist: song.artist, thumbnail: song.thumbnail_url, duration: song.duration_seconds };

  return (
    <div onClick={() => playSong(songObj)}
      style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", background: isActive ? "var(--bg-elevated)" : "transparent", transition: "background 0.15s" }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-elevated)"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: "20px", textAlign: "center", color: isActive ? "var(--accent)" : "var(--text-muted)", fontSize: "13px" }}>{isActive && isPlaying ? "▶" : index + 1}</div>
      <img src={song.thumbnail_url} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 500, color: isActive ? "var(--accent)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{song.artist}</div>
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatDuration(song.duration_seconds)}</div>
      <LikeButton song={songObj} />
      <button onClick={(e) => { e.stopPropagation(); addToQueue(songObj); }} title="Add to queue"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "4px" }}>+</button>
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(song.yt_video_id); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "4px" }}>✕</button>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const { playlists, playlistSongs, createPlaylist, deletePlaylist, loadPlaylistSongs, removeSongFromPlaylist } = useLibraryStore();
  const { playSong, addToQueue } = usePlayerStore();
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // Keep selectedPlaylist in sync with store
  useEffect(() => {
    if (selectedPlaylist) {
      loadPlaylistSongs(selectedPlaylist.id);
      const updated = playlists.find(p => p.id === selectedPlaylist.id);
      if (updated) setSelectedPlaylist(updated);
    }
  }, [selectedPlaylist?.id, playlists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPlaylist(newName.trim());
    setNewName(""); setCreating(false);
  };

  const playAll = (songs) => {
    if (!songs.length) return;
    const first = songs[0];
    playSong({ id: first.yt_video_id, title: first.title, artist: first.artist, thumbnail: first.thumbnail_url, duration: first.duration_seconds });
    songs.slice(1).forEach(s => addToQueue({ id: s.yt_video_id, title: s.title, artist: s.artist, thumbnail: s.thumbnail_url, duration: s.duration_seconds }));
  };

  const songs = selectedPlaylist ? (playlistSongs[selectedPlaylist.id] || []) : [];

  if (selectedPlaylist) {
    return (
      <div style={{ padding: "32px", overflowY: "auto", height: "100%" }}>
        <button onClick={() => setSelectedPlaylist(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "6px" }}>← Back to Library</button>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div style={{ width: "64px", height: "64px", background: "var(--bg-elevated)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>♫</div>
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: "24px", fontWeight: 800 }}>{selectedPlaylist.name}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>{songs.length} songs</p>
          </div>
        </div>

        {songs.length > 0 && (
          <button onClick={() => playAll(songs)} style={{ padding: "10px 24px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "24px", cursor: "pointer", fontSize: "14px", fontWeight: 600, marginBottom: "20px", fontFamily: "Syne" }}>
            ▶ Play All
          </button>
        )}

        {songs.length === 0 && <div style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "40px" }}><p>No songs yet — use ⋯ on any song to add here</p></div>}
        {songs.map((song, i) => (
          <SongRow key={song.yt_video_id} song={song} index={i} onRemove={(vid) => removeSongFromPlaylist(selectedPlaylist.id, vid)} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "Syne", fontSize: "28px", fontWeight: 800 }}>Your Library</h1>
        <button onClick={() => setCreating(true)} style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "Syne" }}>+ New Playlist</button>
      </div>

      {creating && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "16px", marginBottom: "24px", display: "flex", gap: "12px", alignItems: "center" }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} placeholder="Playlist name..."
            style={{ flex: 1, padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "14px", outline: "none" }} />
          <button onClick={handleCreate} style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Create</button>
          <button onClick={() => { setCreating(false); setNewName(""); }} style={{ padding: "8px 12px", background: "none", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
        </div>
      )}

      {playlists.length === 0 && !creating && (
        <div style={{ textAlign: "center", marginTop: "60px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>♫</div>
          <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>No playlists yet</p>
          <p style={{ fontSize: "14px" }}>Create one to get started</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {playlists.map(playlist => (
          <div key={playlist.id}
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", cursor: "pointer", background: "var(--bg-elevated)", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--bg-elevated)"}
          >
            <div onClick={() => setSelectedPlaylist(playlist)} style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
              <div style={{ width: "48px", height: "48px", background: "var(--bg-card)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>♫</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{playlist.name}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Playlist</div>
              </div>
            </div>
            {/* Play button */}
            <button onClick={async () => {
              await loadPlaylistSongs(playlist.id);
              const songs = useLibraryStore.getState().playlistSongs[playlist.id] || [];
              playAll(songs);
            }} style={{ background: "var(--accent)", border: "none", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", color: "#fff", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>▶</button>
            <button onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "4px" }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}