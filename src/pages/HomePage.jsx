import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import SongCard from "../components/SongCard";
import api from "../utils/api";
import { saavnToSong } from "../utils/saavn";

export default function HomePage() {
  const { user } = useAuthStore();
  const { history, queue, currentSong } = usePlayerStore();
  const { likedSongs } = useLibraryStore();
  const [recommended, setRecommended] = useState([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isWideDesktop, setIsWideDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handler = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsWideDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

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
    
    // Only fetch if we haven't loaded recommendations for this session yet
    if (recommended.length === 0) {
      fetchRec();
    }
  }, [history[0]?.id, likedSongs[0]?.id]); // Only re-run if the seed changes AND we have no recs

  return (
    <div style={{ padding: "32px 0", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Greeting */}
      <h1 className="font-syne" style={{ fontSize: isMobile ? "28px" : "36px", fontWeight: 800, marginBottom: "48px", letterSpacing: "-0.03em" }}>
        {greeting}{user?.username ? `, ${user.username}` : ""}
      </h1>

      {/* Now Playing Hero */}
      {currentSong && (
        <section style={{ marginBottom: isMobile ? "32px" : "56px" }}>
          <h2 style={{ fontSize: "10px", fontWeight: 800, marginBottom: isMobile ? "12px" : "16px", color: "var(--text-muted)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Current Vibe</h2>
          <div className="glass" style={{
            display: "flex", alignItems: "center", gap: isMobile ? "16px" : "24px",
            borderRadius: "24px", padding: isMobile ? "16px" : "24px",
            border: "1px solid var(--border-thin)",
            position: "relative",
            overflow: "hidden"
          }}>
             {/* Background Glow */}
            <div style={{ position: "absolute", top: "-50%", left: "-20%", width: "100%", height: "200%", background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)", zIndex: 0 }} />
            
            <img src={currentSong.thumbnail} alt="" style={{ width: isMobile ? "80px" : "120px", height: isMobile ? "80px" : "120px", borderRadius: "16px", objectFit: "cover", zIndex: 1, boxShadow: "0 20px 40px rgba(0,0,0,0.4)", border: "1px solid var(--border-thin)" }} />
            <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
              <div className="font-syne" style={{ fontWeight: 800, fontSize: isMobile ? "20px" : "24px", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentSong.title}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: isMobile ? "12px" : "16px", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{currentSong.artist}</div>
              
              <div style={{ display: "flex", gap: "3px", alignItems: "flex-end", marginTop: "16px", height: "20px" }}>
                {[1,0.6,0.8,0.5,0.9,0.7].map((h, i) => (
                  <div key={i} className="pulse" style={{ width: "3px", background: "white", borderRadius: "2px", height: `${h * 100}%`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isWideDesktop ? "1fr 1fr" : "1fr", gap: isMobile ? "24px" : "48px" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "48px", minWidth: 0 }}>
          {/* Recommended */}
          {recommended.length > 0 && (
            <section>
              <h2 style={{ fontSize: "10px", fontWeight: 800, marginBottom: isMobile ? "12px" : "20px", color: "var(--text-muted)", letterSpacing: "0.15em" }}>SELECTED FOR YOU</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {recommended.slice(0, 6).map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
              </div>
            </section>
          )}

          {/* Recently Played */}
          {history.length > 0 && (
            <section>
              <h2 style={{ fontSize: "10px", fontWeight: 800, marginBottom: isMobile ? "12px" : "20px", color: "var(--text-muted)", letterSpacing: "0.15em" }}>RECENT EXPLORATIONS</h2>
              <div className="stitch-top" style={{ paddingTop: isMobile ? "12px" : "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {history.slice(0, 6).map((song, i) => <SongCard key={`${song.id}-${i}`} song={song} index={i} />)}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "48px", minWidth: 0 }}>
          {/* Up Next */}
          {queue.length > 0 && (
            <section>
              <h2 style={{ fontSize: "10px", fontWeight: 800, marginBottom: isMobile ? "12px" : "20px", color: "var(--text-muted)", letterSpacing: "0.15em" }}>UP NEXT</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {queue.slice(0, 6).map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
              </div>
            </section>
          )}

          {/* Liked Songs */}
          {likedSongs.length > 0 && (
            <section>
              <h2 style={{ fontSize: "10px", fontWeight: 800, marginBottom: isMobile ? "12px" : "20px", color: "var(--text-muted)", letterSpacing: "0.15em" }}>COLLECTED WORKS</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {likedSongs.slice(0, 6).map((song, i) => (
                  <SongCard key={song.id} song={song} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!currentSong && history.length === 0 && likedSongs.length === 0 && (
        <div style={{ textAlign: "center", marginTop: "120px", color: "var(--text-muted)" }}>
          <div className="font-syne" style={{ fontSize: "80px", fontWeight: 900, marginBottom: "24px", opacity: 0.1 }}>VOID</div>
          <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Welcome to the aesthetic.</p>
          <p style={{ fontSize: "14px", opacity: 0.6 }}>Head to Search to begin your session</p>
        </div>
      )}
    </div>
  );
}