import { useState } from "react";
import { createPortal } from "react-dom";
import { usePlayerStore } from "../store/playerStore";
import LikeButton from "./LikeButton";
import { useLibraryStore } from "../store/libraryStore";

function formatDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// -- Bottom Sheet --
export function BottomSheet({ song, onClose }) {
  const { playSong, addToQueue } = usePlayerStore();
  const { playlists, addSongToPlaylist, likedSongs, toggleLike } = useLibraryStore();
  const isLiked = likedSongs.some(s => s.id === song.id);

  const addToPlaylist = async (playlistId) => {
    try {
      await addSongToPlaylist(playlistId, song);
      onClose();
    } catch (err) {
      console.error("Add to playlist error:", err);
    }
  };

  const playNext = () => {
    usePlayerStore.getState().playNext(song);
    onClose();
  };

  const addToEnd = () => {
    addToQueue(song);
    onClose();
  };

  const getBottomOffset = () => {
    // Measure the actual mini player so the sheet always clears it
    const miniPlayer = document.querySelector('[data-mini-player="true"]');
    if (miniPlayer) {
      const rect = miniPlayer.getBoundingClientRect();
      return window.innerHeight - rect.top + 8;
    }
    return window.innerWidth <= 768 ? 90 : 24;
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, backdropFilter: "blur(4px)" }} />
      <div className="glass" style={{
        position: "fixed",
        bottom: `${getBottomOffset()}px`,
        left: "12px", right: "12px",
        borderRadius: "24px",
        zIndex: 10001,
        maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        animation: "slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        padding: "20px",
        background: "var(--bg-surface)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: "16px" }}>
          <div style={{ width: "36px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          <img src={song.thumbnail} alt="" style={{ width: "56px", height: "56px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--border-thin)" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>{song.title}</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>{song.artist}</div>
          </div>
        </div>

        <div className="stitch-top" style={{ overflowY: "auto", paddingTop: "12px" }}>
          <SheetItem icon={isLiked ? "♥" : "♡"} label={isLiked ? "Unlike" : "Like"} onClick={() => { toggleLike(song); onClose(); }} />
          <SheetItem icon=">" label="Play now" onClick={() => { playSong(song); onClose(); }} />
          <SheetItem icon=">>" label="Play next" onClick={playNext} />
          <SheetItem icon="+" label="Add to queue" onClick={addToEnd} />

          <div className="stitch-top" style={{ margin: "16px 0", opacity: 0.5 }} />
          <div style={{ padding: "0 12px 12px", fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.1em" }}>ADD TO PLAYLIST</div>

          {playlists.map(p => (
            <SheetItem key={p.id} icon="#" label={p.name} onClick={() => addToPlaylist(p.id)} />
          ))}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>,
    document.body
  );
}

function SheetItem({ icon, label, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "16px",
      padding: "12px", borderRadius: "12px", cursor: "pointer", transition: "0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ fontSize: "10px", width: "40px", textAlign: "center", fontWeight: 800 }}>{icon}</span>
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// -- Song Card --
export default function SongCard({ song, index, onRemove }) {
  const { playSong, currentSong, isPlaying } = usePlayerStore();
  const isActive = currentSong?.id === song.id;
  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      <div
        onClick={() => playSong(song)}
        style={{
          display: "flex", alignItems: "center", gap: "16px",
          padding: "12px 16px", borderRadius: "16px", cursor: "pointer",
          background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
          border: isActive ? "1px solid var(--border-thin)" : "1px solid transparent",
          transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ width: "24px", textAlign: "center", fontSize: "12px", fontWeight: 800, color: isActive ? "white" : "var(--text-muted)" }}>
          {isActive && isPlaying ? ">" : (index != null ? index + 1 : "#")}
        </div>

        <img src={song.thumbnail} alt="" style={{ width: "48px", height: "48px", borderRadius: "10px", objectFit: "cover", border: "1px solid var(--border-thin)" }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: isActive ? "white" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {song.title}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.02em" }}>{song.artist}</div>
        </div>

        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{formatDuration(song.duration)}</div>

        <LikeButton song={song} />

        {onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(song.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "18px", padding: "8px" }}>✕</button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); setShowSheet(true); }}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", padding: "8px", cursor: "pointer" }}
        >...</button>
      </div>

      {showSheet && <BottomSheet song={song} onClose={() => setShowSheet(false)} />}
    </>
  );
}
