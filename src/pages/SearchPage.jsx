import { useState, useRef } from "react";
import api from "../utils/api";
import SongCard from "../components/SongCard";
import { usePlayerStore } from "../store/playerStore";

const TABS = ["Songs", "Artists", "Playlists"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ songs: [], artists: [], playlists: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("Songs");
  const debounceRef = useRef(null);
  const { playSong, addToQueue } = usePlayerStore();

  const search = async (q, tab = activeTab) => {
    if (!q.trim()) { setResults({ songs: [], artists: [], playlists: [] }); setSearched(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/api/music/search?q=${encodeURIComponent(q)}`);
      const songs = data.results;

      const artistMap = {};
      songs.forEach(s => {
        if (s.artist && s.artist !== "Unknown Artist") {
          if (!artistMap[s.artist]) artistMap[s.artist] = { name: s.artist, thumbnail: s.thumbnail, songs: 0 };
          artistMap[s.artist].songs++;
        }
      });

      const playlistRes = await api.get(`/api/music/search?q=${encodeURIComponent(q + " playlist mix")}`);
      setResults({ songs, artists: Object.values(artistMap), playlists: playlistRes.data.results.slice(0, 8) });
      setSearched(true);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    search(query);
  };

  // Play a playlist — fetch related songs and add to queue
  const playPlaylist = async (item) => {
    playSong(item);
    try {
      const { data } = await api.get(`/api/music/related/${item.id}`);
      data.results.forEach(s => addToQueue(s));
    } catch {}
  };

  const currentResults = results[activeTab.toLowerCase()] || [];

  return (
    <div style={{ padding: "32px", overflowY: "auto", height: "100%" }}>
      <h1 style={{ fontFamily: "Syne", fontSize: "28px", fontWeight: 800, marginBottom: "24px" }}>Search</h1>

      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <div style={{ position: "relative", maxWidth: "500px" }}>
          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "18px", pointerEvents: "none" }}>⌕</span>
          <input value={query} onChange={handleInput} placeholder="Search songs, artists, playlists..."
            autoFocus style={{ width: "100%", padding: "12px 14px 12px 42px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "15px", outline: "none", fontFamily: "DM Sans" }} />
        </div>
      </form>

      {/* Tabs — always visible */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "8px 18px", borderRadius: "20px", border: "none", cursor: "pointer",
            fontSize: "13px", fontWeight: 600, fontFamily: "Syne",
            background: activeTab === tab ? "var(--accent)" : "var(--bg-elevated)",
            color: activeTab === tab ? "#fff" : "var(--text-secondary)",
            transition: "all 0.15s",
          }}>{tab}</button>
        ))}
      </div>

      {loading && <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px" }}><span className="spin">↻</span> Searching...</div>}

      {!loading && searched && currentResults.length === 0 && (
        <div style={{ color: "var(--text-muted)" }}>No {activeTab.toLowerCase()} found for "{query}"</div>
      )}

      {/* Songs */}
      {!loading && activeTab === "Songs" && results.songs.length > 0 && (
        <div className="fade-in">
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>{results.songs.length} results</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {results.songs.map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
          </div>
        </div>
      )}

      {/* Artists */}
      {!loading && activeTab === "Artists" && results.artists.length > 0 && (
        <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px" }}>
          {results.artists.map(artist => (
            <div key={artist.name} onClick={() => { setQuery(artist.name); search(artist.name, "Songs"); setActiveTab("Songs"); }} style={{ cursor: "pointer", textAlign: "center" }}>
              <div style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", overflow: "hidden", marginBottom: "10px", background: "var(--bg-elevated)" }}>
                <img src={artist.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{artist.songs} songs</div>
            </div>
          ))}
        </div>
      )}

      {/* Playlists */}
      {!loading && activeTab === "Playlists" && results.playlists.length > 0 && (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {results.playlists.map((item, i) => (
            <div key={item.id}
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "8px", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>{i + 1}</div>
              <img src={item.thumbnail} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover", cursor: "pointer" }} onClick={() => playPlaylist(item)} />
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => playPlaylist(item)}>
                <div style={{ fontSize: "14px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{item.artist}</div>
              </div>
              {/* Play button */}
              <button onClick={() => playPlaylist(item)} style={{ background: "var(--accent)", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", color: "#fff", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>▶</button>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div style={{ color: "var(--text-muted)", marginTop: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>♪</div>
          <p>Search for any song, artist or playlist</p>
        </div>
      )}
    </div>
  );
}