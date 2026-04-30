import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import SongCard from "../components/SongCard";



export default function LikedPage() {
  const { likedSongs } = useLibraryStore();
  const { playSong, addToQueue, currentSong, isPlaying } = usePlayerStore();

  const playAll = () => {
    if (!likedSongs.length) return;
    const [first, ...rest] = likedSongs;
    playSong(first, { fromQueue: true, updatedQueue: rest });
  };

  return (
    <div style={{ padding: "32px 0", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: "clamp(16px, 4vw, 32px)", marginBottom: "clamp(32px, 6vw, 56px)" }}>
        <div style={{ width: "clamp(100px, 25vw, 180px)", height: "clamp(100px, 25vw, 180px)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>
          <div style={{ fontSize: "clamp(80px, 15vw, 140px)", filter: "drop-shadow(0 20px 40px rgba(255,255,255,0.05))", lineHeight: 1 }}>♥</div>
        </div>
        <div style={{ paddingBottom: "12px", flex: "1 1 300px" }}>
          <h1 className="font-syne" style={{ fontSize: "clamp(28px, 6vw, 48px)", fontWeight: 800, letterSpacing: "-0.03em" }}>Liked Songs</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>COLLECTION · {likedSongs.length} TRACKS</p>
          
          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            {likedSongs.length > 0 && (
              <button onClick={playAll} style={{ padding: "12px 32px", background: "white", color: "black", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 800, textTransform: "uppercase" }}>
                PLAY ALL
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {likedSongs.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "120px", color: "var(--text-muted)" }}>
          <div className="font-syne" style={{ fontSize: "80px", fontWeight: 900, marginBottom: "24px", opacity: 0.1 }}>SONG</div>
          <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Your collection is empty.</p>
          <p style={{ fontSize: "14px", opacity: 0.6 }}>Add some tracks to see them here</p>
        </div>
      )}

      {/* Songs list */}
      <div className="stitch-top" style={{ paddingTop: "24px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {likedSongs.map((song, i) => (
          <SongCard key={song.id} song={song} index={i} />
        ))}
      </div>
    </div>
  );
}