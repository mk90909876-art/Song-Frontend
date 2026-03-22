import { useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import LikeButton from "./LikeButton";
import api from "../utils/api";
import { useLibraryStore } from "../store/libraryStore";
function formatDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Bottom Sheet ──────────────────────────────────────────────
export function BottomSheet({ song, onClose }) {
  const { playSong, addToQueue, queue } = usePlayerStore();
  const { playlists, addSongToPlaylist } = useLibraryStore();
  const [loadingPlaylists] = useState(false); // playlists already loaded in libraryStore



  const addToPlaylist = async (playlistId) => {
    try {
      await api.post(`/api/library/playlists/${playlistId}/songs`, {
        yt_video_id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail_url: song.thumbnail,
        duration_seconds: song.duration,
      });
      onClose();
    } catch (err) {
      console.error("Add to playlist error:", err);
    }
  };

  const playNext = () => {
    usePlayerStore.setState({ queue: [song, ...queue] });
    onClose();
  };

  const addToEnd = () => {
    addToQueue(song);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 10000, backdropFilter: "blur(2px)",
      }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        borderRadius: "20px 20px 0 0",
        zIndex: 10001, maxHeight: "55vh",
        display: "flex", flexDirection: "column",
        animation: "slideUp 0.25s ease",
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: "36px", height: "4px", background: "var(--border)", borderRadius: "2px" }} />
        </div>

        {/* Song info */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 20px 16px" }}>
          <img src={song.thumbnail} alt="" style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{song.artist}</div>
          </div>
        </div>

        <div style={{ height: "1px", background: "var(--border)" }} />

        {/* Actions */}
        <div style={{ overflowY: "auto", padding: "8px 0" }}>
          <SheetItem icon="▶" label="Play now" onClick={() => { playSong(song); onClose(); }} />
        <SheetItem icon="⏭" label="Play next" onClick={playNext} />
        <SheetItem icon="⬇" label="Add to end of queue" onClick={addToEnd} />

          <div style={{ height: "1px", background: "var(--border)", margin: "8px 0" }} />
          <div style={{ padding: "6px 20px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
            ADD TO PLAYLIST
          </div>

          {loadingPlaylists && (
            <div style={{ padding: "12px 20px", color: "var(--text-muted)", fontSize: "13px" }}>Loading...</div>
          )}
          {!loadingPlaylists && playlists.length === 0 && (
            <div style={{ padding: "12px 20px", color: "var(--text-muted)", fontSize: "13px" }}>
              No playlists yet — create one in Library
            </div>
          )}
          {playlists.map(p => (
            <SheetItem key={p.id} icon="♫" label={p.name} onClick={() => addToPlaylist(p.id)} />
          ))}
        </div>
      </div>
    </>
  );
}

function SheetItem({ icon, label, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "14px",
      padding: "12px 20px", cursor: "pointer", transition: "background 0.1s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ fontSize: "18px", width: "24px", textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: "14px" }}>{label}</span>
    </div>
  );
}

// ── Song Card ─────────────────────────────────────────────────
export default function SongCard({ song, index }) {
  const { playSong, currentSong, isPlaying } = usePlayerStore();
  const isActive = currentSong?.id === song.id;
  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      <div
        onClick={() => playSong(song)}
        style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
          background: isActive ? "var(--bg-elevated)" : "transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-elevated)"; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        {/* Index */}
        <div style={{ width: "20px", textAlign: "center", flexShrink: 0, fontSize: "13px", color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
          {isActive && isPlaying ? "▶" : (index != null ? index + 1 : "♪")}
        </div>

        {/* Thumbnail */}
        <img src={song.thumbnail} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />

        {/* Title + Artist */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 500, color: isActive ? "var(--accent)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{song.artist}</div>
        </div>

        {/* Duration */}
        <div style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>{formatDuration(song.duration)}</div>

        {/* Like */}
        <LikeButton song={song} />

        {/* Three dots */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowSheet(true); }}
          title="More options"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "18px", padding: "4px",
            lineHeight: 1,
          }}>⋯</button>
      </div>

      {showSheet && <BottomSheet song={song} onClose={() => setShowSheet(false)} />}
    </>
  );
}