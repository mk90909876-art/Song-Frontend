import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import LikeButton from "../components/LikeButton";

function formatDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function LikedPage() {
  const { likedSongs, unlikeSong } = useLibraryStore();
  const { playSong, addToQueue, currentSong, isPlaying } = usePlayerStore();

  const playAll = () => {
    if (!likedSongs.length) return;
    const [first, ...rest] = likedSongs;
    playSong({ id: first.yt_video_id, title: first.title, artist: first.artist, thumbnail: first.thumbnail_url, duration: first.duration_seconds });
    rest.forEach(s => addToQueue({ id: s.yt_video_id, title: s.title, artist: s.artist, thumbnail: s.thumbnail_url, duration: s.duration_seconds }));
  };

  return (
    <div style={{ padding: "32px", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <div style={{ width: "64px", height: "64px", background: "var(--accent)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>♥</div>
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: "28px", fontWeight: 800 }}>Liked Songs</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>{likedSongs.length} songs</p>
        </div>
      </div>

      {/* Play All button */}
      {likedSongs.length > 0 && (
        <button onClick={playAll} style={{
          padding: "10px 28px",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: "24px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 700,
          fontFamily: "Syne",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          ▶ Play All
        </button>
      )}

      {/* Empty state */}
      {likedSongs.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "60px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>♡</div>
          <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>No liked songs yet</p>
          <p style={{ fontSize: "14px" }}>Click the ♡ on any song to like it</p>
        </div>
      )}

      {/* Songs list */}
      {likedSongs.map((song, i) => {
        const isActive = currentSong?.id === song.yt_video_id;
        const songObj = { id: song.yt_video_id, title: song.title, artist: song.artist, thumbnail: song.thumbnail_url, duration: song.duration_seconds };
        return (
          <div key={song.yt_video_id} onClick={() => playSong(songObj)}
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
              background: isActive ? "var(--bg-elevated)" : "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-elevated)"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ width: "20px", textAlign: "center", color: isActive ? "var(--accent)" : "var(--text-muted)", fontSize: "13px" }}>
              {isActive && isPlaying ? "▶" : i + 1}
            </div>
            <img src={song.thumbnail_url} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 500, color: isActive ? "var(--accent)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{song.artist}</div>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatDuration(song.duration_seconds)}</div>
            <LikeButton song={songObj} />
            <button onClick={(e) => { e.stopPropagation(); addToQueue(songObj); }} title="Add to queue"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "4px" }}>+</button>
          </div>
        );
      })}
    </div>
  );
}