import { useState, useEffect } from "react";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import SongCard from "../components/SongCard";

export default function LibraryPage() {
  const { playlists, playlistSongs, createPlaylist, deletePlaylist, loadPlaylistSongs, removeSongFromPlaylist } = useLibraryStore();
  const { playSong } = usePlayerStore();
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

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

  const playAll = (playlistSongs) => {
    if (!playlistSongs.length) return;
    const [first, ...rest] = playlistSongs;
    playSong(first, { fromQueue: true, updatedQueue: rest });
  };

  const songs = selectedPlaylist ? (playlistSongs[selectedPlaylist.id] || []) : [];

  if (selectedPlaylist) {
    return (
      <div style={{ padding: "32px 0", maxWidth: "1200px", margin: "0 auto" }}>
        <button onClick={() => setSelectedPlaylist(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "32px", display: "flex", alignItems: "center", gap: "8px" }}>← RETURN TO LIBRARY</button>
        
        <div style={{ display: "flex", alignItems: "flex-end", gap: "32px", marginBottom: "48px" }}>
          <div className="glass" style={{ width: "180px", height: "180px", borderRadius: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "64px", border: "1px solid var(--border-thin)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>♫</div>
          <div style={{ paddingBottom: "12px" }}>
            <h1 className="font-syne" style={{ fontSize: "48px", fontWeight: 800, letterSpacing: "-0.03em" }}>{selectedPlaylist.name}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              COLLECTION · {songs.length || selectedPlaylist.playlist_songs?.[0]?.count || 0} TRACKS
            </p>
            
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              {songs.length > 0 && (
                <button onClick={() => playAll(songs)} style={{ padding: "12px 32px", background: "white", color: "black", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 800, textTransform: "uppercase" }}>
                  PLAY ALL
                </button>
              )}
              <button onClick={() => deletePlaylist(selectedPlaylist.id)} style={{ padding: "12px 24px", background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid var(--border-thin)", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 800, textTransform: "uppercase" }}>
                DELETE
              </button>
            </div>
          </div>
        </div>

        <div className="stitch-top" style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {songs.length === 0 && <div style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "80px", fontSize: "14px", letterSpacing: "0.1em" }}>THE COLLECTION IS EMPTY</div>}
          {songs.map((song, i) => (
            <SongCard key={song.id} song={song} index={i} onRemove={(id) => removeSongFromPlaylist(selectedPlaylist.id, id)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 0", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "48px" }}>
        <h1 className="font-syne" style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em" }}>Library</h1>
        <button onClick={() => setCreating(true)} style={{ padding: "10px 24px", background: "white", color: "black", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>+ NEW COLLECTION</button>
      </div>

      {creating && (
        <div className="glass" style={{ borderRadius: "20px", padding: "24px", marginBottom: "32px", display: "flex", gap: "16px", alignItems: "center", border: "1px solid var(--border-thin)" }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} placeholder="Collection name..."
            style={{ flex: 1, padding: "14px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-thin)", borderRadius: "12px", color: "white", fontSize: "15px", outline: "none", fontFamily: "Outfit" }} />
          <button onClick={handleCreate} style={{ padding: "14px 28px", background: "white", color: "black", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}>CREATE</button>
          <button onClick={() => { setCreating(false); setNewName(""); }} style={{ padding: "14px 20px", background: "none", color: "var(--text-muted)", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}>CANCEL</button>
        </div>
      )}

      {playlists.length === 0 && !creating && (
        <div style={{ textAlign: "center", marginTop: "120px", color: "var(--text-muted)" }}>
          <div className="font-syne" style={{ fontSize: "80px", fontWeight: 900, marginBottom: "24px", opacity: 0.1 }}>EMPTY</div>
          <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>No collections yet.</p>
          <p style={{ fontSize: "14px", opacity: 0.6 }}>Create a playlist to organize your sound</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
        {playlists.map(playlist => (
          <div key={playlist.id}
            className="glass"
            style={{ display: "flex", flexDirection: "column", padding: "20px", borderRadius: "24px", cursor: "pointer", border: "1px solid var(--border-thin)", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", position: "relative", overflow: "hidden" }}
            onClick={() => setSelectedPlaylist(playlist)}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border-thin)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              <div style={{ width: "60px", height: "60px", background: "rgba(255,255,255,0.05)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", border: "1px solid var(--border-thin)" }}>♫</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-syne" style={{ fontSize: "18px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playlist.name}</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>PRIVATE COLLECTION</div>
              </div>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>
                {(playlistSongs[playlist.id]?.length ?? playlist.playlist_songs?.[0]?.count ?? 0)} TRACKS
              </span>
              <button onClick={async (e) => {
                e.stopPropagation();
                await loadPlaylistSongs(playlist.id);
                const songs = useLibraryStore.getState().playlistSongs[playlist.id] || [];
                playAll(songs);
              }} style={{ background: "white", border: "none", borderRadius: "50%", width: "40px", height: "40px", cursor: "pointer", color: "black", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 16px rgba(0,0,0,0.4)" }}>▶</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}