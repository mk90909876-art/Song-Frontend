import { useState, useRef } from "react";
import SongCard from "../components/SongCard";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { saavnToSong, SAAVN } from "../utils/saavn";

const TABS = ["Songs", "Artists", "Playlists"];
const truncate = (str, n = 40) => str?.length > n ? str.slice(0, n).trimEnd() + "…" : str;

const getImage = (images, quality = "500x500") =>
  images?.find(i => i.quality === quality)?.url || images?.[images.length - 1]?.url || "";

// ── Playlist Card ─────────────────────────────────────────────
const PlaylistCard = ({ playlist }) => {
  const [expanded, setExpanded] = useState(false);
  const [songs, setSongs] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { playSong, addToQueue } = usePlayerStore();
  const { createPlaylist, addSongToPlaylist } = useLibraryStore();

  const loadSongs = async () => {
    if (songs.length > 0) { setExpanded(!expanded); return; }
    setExpanded(true);
    setLoadingSongs(true);
    try {
      const res = await fetch(`${SAAVN}/api/playlists?id=${playlist.id}`);
      const data = await res.json();
      setSongs((data?.data?.songs || []).map(saavnToSong));
    } catch { setSongs([]); }
    finally { setLoadingSongs(false); }
  };

  const playAll = async (e) => {
    e.stopPropagation();
    let songList = songs;
    if (!songList.length) {
      try {
        const res = await fetch(`${SAAVN}/api/playlists?id=${playlist.id}`);
        const data = await res.json();
        songList = (data?.data?.songs || []).map(saavnToSong);
        setSongs(songList);
      } catch { return; }
    }
    if (!songList.length) return;
    usePlayerStore.getState().clearQueue();
    songList.slice(1).forEach(s => addToQueue(s));
    playSong(songList[0], { fromQueue: true });
  };

  const saveToLibrary = async (e) => {
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    try {
      let songList = songs;
      if (!songList.length) {
        const res = await fetch(`${SAAVN}/api/playlists?id=${playlist.id}`);
        const data = await res.json();
        songList = (data?.data?.songs || []).map(saavnToSong);
        setSongs(songList);
      }
      const newPlaylist = await createPlaylist(playlist.title, `Imported from JioSaavn`);
      await Promise.all(songList.map(s => addSongToPlaylist(newPlaylist.id, s)));
      setSaved(true);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ borderRadius: "12px", overflow: "hidden", background: "var(--bg-elevated)", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", cursor: "pointer" }}
        onClick={loadSongs}>
        <img src={playlist.thumbnail} alt="" style={{ width: "52px", height: "52px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{truncate(playlist.title, 45)}</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            <span>{playlist.songCount} songs · {playlist.language}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={saveToLibrary} style={{
            padding: "6px 12px", borderRadius: "20px", border: "1px solid var(--accent)",
            background: saved ? "var(--accent)" : "transparent",
            color: saved ? "#fff" : "var(--accent)",
            fontSize: "12px", fontWeight: 600, cursor: saving ? "wait" : "pointer",
            whiteSpace: "nowrap", transition: "all 0.2s",
          }}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "+ Library"}
          </button>
          <button onClick={playAll} style={{
            width: "34px", height: "34px", borderRadius: "50%",
            background: "var(--accent)", border: "none", color: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px",
          }}>▶</button>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "16px", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>⌄</div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "4px 0" }}>
          {loadingSongs ? (
            <div style={{ padding: "16px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>Loading songs…</div>
          ) : songs.length === 0 ? (
            <div style={{ padding: "16px", color: "var(--text-muted)", textAlign: "center", fontSize: "13px" }}>No songs found</div>
          ) : (
            songs.map((song, i) => (
              <div key={song.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                onClick={() => {
                  usePlayerStore.getState().clearQueue();
                  songs.slice(i + 1).forEach(s => addToQueue(s));
                  playSong(song, { fromQueue: true });
                }}>
                <div style={{ width: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", flexShrink: 0 }}>{i + 1}</div>
                <img src={song.thumbnail} alt="" style={{ width: "36px", height: "36px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{truncate(song.title, 50)}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{truncate(song.artist, 35)}</div>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                  {song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── Search Page ───────────────────────────────────────────────
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ songs: [], artists: [], playlists: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("Songs");
  const [artistSongs, setArtistSongs] = useState(null); // { artist, songs }
  const debounceRef = useRef(null);
  const { playSong, searchHistory, addSearchHistory, removeSearchHistory, clearSearchHistory } = usePlayerStore();

  const search = async (q, tab = activeTab, saveHistory = false) => {
    if (!q.trim()) { setResults({ songs: [], artists: [], playlists: [] }); setSearched(false); setArtistSongs(null); return; }
    setLoading(true);
    setArtistSongs(null);
    if (saveHistory) addSearchHistory(q.trim());
    try {
      if (tab === "Songs") {
        const res = await fetch(`${SAAVN}/api/search/songs?query=${encodeURIComponent(q)}&limit=20`);
        const data = await res.json();
        const songs = (data?.data?.results || []).map(saavnToSong);
        setResults(r => ({ ...r, songs }));
      } else if (tab === "Artists") {
        const res = await fetch(`${SAAVN}/api/search/artists?query=${encodeURIComponent(q)}&limit=20`);
        const data = await res.json();
        setResults(r => ({ ...r, artists: data?.data?.results || [] }));
      } else if (tab === "Playlists") {
        const res = await fetch(`${SAAVN}/api/search/playlists?query=${encodeURIComponent(q)}&limit=10`);
        const data = await res.json();
        const playlists = (data?.data?.results || []).map(p => ({
          id: p.id,
          title: p.name,
          thumbnail: getImage(p.image),
          songCount: p.songCount ?? "?",
          language: p.language || "",
        }));
        setResults(r => ({ ...r, playlists }));
      }
      setSearched(true);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadArtistSongs = async (artist) => {
    setLoading(true);
    try {
      const res = await fetch(`${SAAVN}/api/artists/${artist.id}/songs?limit=20`);
      const data = await res.json();
      const songs = (data?.data?.results || []).map(saavnToSong);
      setArtistSongs({ artist, songs });
    } catch { setArtistSongs({ artist, songs: [] }); }
    finally { setLoading(false); }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val, activeTab, false), 500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    search(query, activeTab, true);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setArtistSongs(null);
    if (query.trim()) search(query, tab, false);
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
            autoFocus style={{ width: "100%", padding: "12px 14px 12px 42px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "15px", outline: "none", fontFamily: "DM Sans", boxSizing: "border-box" }} />
        </div>
      </form>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => switchTab(tab)} style={{
            padding: "8px 18px", borderRadius: "20px", border: "none", cursor: "pointer",
            fontSize: "13px", fontWeight: 600, fontFamily: "Syne",
            background: activeTab === tab ? "var(--accent)" : "var(--bg-elevated)",
            color: activeTab === tab ? "#fff" : "var(--text-secondary)",
            transition: "all 0.15s",
          }}>{tab}</button>
        ))}
      </div>

      {loading && <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px" }}><span className="spin">↻</span> Searching...</div>}

      {!loading && searched && currentResults.length === 0 && !artistSongs && (
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
      {!loading && activeTab === "Artists" && !artistSongs && results.artists.length > 0 && (
        <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "16px" }}>
          {results.artists.map(artist => (
            <div key={artist.id} onClick={() => loadArtistSongs(artist)} style={{ cursor: "pointer", textAlign: "center" }}>
              <div style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", overflow: "hidden", marginBottom: "10px", background: "var(--bg-elevated)" }}>
                <img src={getImage(artist.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{artist.role}</div>
            </div>
          ))}
        </div>
      )}

      {/* Artist songs drilldown */}
      {!loading && activeTab === "Artists" && artistSongs && (
        <div className="fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <button onClick={() => setArtistSongs(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer" }}>←</button>
            <img src={getImage(artistSongs.artist.image)} alt="" style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover" }} />
            <span style={{ fontSize: "18px", fontWeight: 700, fontFamily: "Syne" }}>{artistSongs.artist.name}</span>
          </div>
          {artistSongs.songs.length === 0
            ? <div style={{ color: "var(--text-muted)" }}>No songs found</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {artistSongs.songs.map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
              </div>
          }
        </div>
      )}

      {/* Playlists */}
      {!loading && activeTab === "Playlists" && results.playlists.length > 0 && (
        <div className="fade-in">
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>{results.playlists.length} playlists · Click to expand songs</p>
          {results.playlists.map(p => <PlaylistCard key={p.id} playlist={p} />)}
        </div>
      )}

      {!searched && !loading && (
        <div>
          {searchHistory.length > 0 ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em" }}>RECENT SEARCHES</span>
                <button onClick={clearSearchHistory} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer" }}>Clear all</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {searchHistory.map(h => (
                  <div key={h} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: "16px", color: "var(--text-muted)" }}>↺</span>
                    <span onClick={() => { setQuery(h); search(h, activeTab, false); }} style={{ flex: 1, fontSize: "14px", cursor: "pointer" }}>{h}</span>
                    <button onClick={() => removeSearchHistory(h)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", padding: "2px 6px" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", marginTop: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>♪</div>
              <p>Search for any song, artist or playlist</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}