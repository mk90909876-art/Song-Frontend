import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import SongCard from "../components/SongCard";
import api from "../utils/api";
import { saavnToSong } from "../utils/saavn";

export default function HomePage() {
  const { user } = useAuthStore();
  const { history, queue, currentSong, playSong, addToQueue } = usePlayerStore();
  const { likedSongs } = useLibraryStore();
  const [recommended, setRecommended] = useState([]);
  const [loadingRec, setLoadingRec] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Fetch recommendations based on most recent history
  useEffect(() => {
    const fetchRec = async () => {
      const seed = history[0] || likedSongs[0];
      if (!seed) return;
      
      setLoadingRec(true);
      try {
        const { data } = await api.get(`/api/saavn/songs/${seed.id}/suggestions?limit=15`);
        if (data.success && data.data) {
          setRecommended(data.data.map(saavnToSong).slice(0, 10));
        }
      } catch (e) {
        console.error("Home suggestions failed:", e);
      } finally { setLoadingRec(false); }
    };
    fetchRec();
  }, [history.length]);

  return (
    <div style={{ padding: "32px", overflowY: "auto", height: "100%" }}>
      {/* Greeting */}
      <h1 style={{ fontFamily: "Syne", fontSize: "28px", fontWeight: 800, marginBottom: "32px" }}>
        {greeting}{user?.username ? `, ${user.username}` : ""}
      </h1>

      {/* Now Playing */}
      {currentSong && (
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 700, marginBottom: "14px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>NOW PLAYING</h2>
          <div style={{
            display: "flex", alignItems: "center", gap: "16px",
            background: "var(--bg-elevated)", borderRadius: "12px", padding: "16px",
            border: "1px solid var(--border)",
          }}>
            <img src={currentSong.thumbnail} alt="" style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentSong.title}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>{currentSong.artist}</div>
            </div>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {[1,2,3].map(i => (
                <div key={i} className="pulse" style={{ width: "3px", background: "var(--accent)", borderRadius: "2px", height: `${8 + i * 6}px`, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Up Next */}
      {queue.length > 0 && (
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 700, marginBottom: "14px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>UP NEXT</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {queue.slice(0, 5).map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
          </div>
        </section>
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 700, marginBottom: "14px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>RECOMMENDED FOR YOU</h2>
          {loadingRec && <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading...</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {recommended.map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
          </div>
        </section>
      )}

      {/* Recently Played */}
      {history.length > 0 && (
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 700, marginBottom: "14px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>RECENTLY PLAYED</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {history.slice(0, 10).map((song, i) => <SongCard key={`${song.id}-${i}`} song={song} index={i} />)}
          </div>
        </section>
      )}

      {/* Liked Songs quick access */}
      {likedSongs.length > 0 && (
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "12px", fontWeight: 700, marginBottom: "14px", color: "var(--text-muted)", letterSpacing: "0.08em" }}>FROM YOUR LIKED SONGS</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {likedSongs.slice(0, 5).map((song, i) => (
              <SongCard key={song.id} song={song} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!currentSong && history.length === 0 && likedSongs.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "80px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>♪</div>
          <p style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Welcome to Song!</p>
          <p style={{ fontSize: "14px" }}>Head to Search to find something to play</p>
        </div>
      )}
    </div>
  );
}