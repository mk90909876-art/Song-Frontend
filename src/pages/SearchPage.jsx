import { useState, useRef } from "react";
import SongCard from "../components/SongCard";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { saavnToSong } from "../utils/saavn";
import api from "../utils/api";

const TABS = ["Songs", "Artists", "Playlists"];
const truncate = (str, n = 40) => str?.length > n ? str.slice(0, n).trimEnd() + "..." : str;

const getImage = (images, quality = "500x500") =>
  images?.find(i => i.quality === quality)?.url || images?.[images.length - 1]?.url || "";

// -- Playlist Card --
const PlaylistCard = ({ playlist }) => {
  const [expanded, setExpanded] = useState(false);
  const [songs, setSongs] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { playSong } = usePlayerStore();
  const { createPlaylist, addSongToPlaylist } = useLibraryStore();

  const loadSongs = async () => {
    if (songs.length > 0) { setExpanded(!expanded); return; }
    setExpanded(true);
    setLoadingSongs(true);
    try {
      const { data } = await api.get(`/api/saavn/playlists/${playlist.id}`);
      setSongs((data?.data?.songs || []).map(saavnToSong));
    } catch { setSongs([]); }
    finally { setLoadingSongs(false); }
  };

  const playAll = async (e) => {
    e.stopPropagation();
    let songList = songs;
    if (!songList.length) {
      try {
        const { data } = await api.get(`/api/saavn/playlists/${playlist.id}`);
        songList = (data?.data?.songs || []).map(saavnToSong);
        setSongs(songList);
      } catch { return; }
    }
    if (!songList.length) return;
    const [first, ...rest] = songList;
    playSong(first, { fromQueue: true, updatedQueue: rest });
  };

  const saveToLibrary = async (e) => {
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    try {
      let songList = songs;
      if (!songList.length) {
        const { data } = await api.get(`/api/saavn/playlists/${playlist.id}`);
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
    <div className="glass" style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border-thin)", marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", cursor: "pointer" }}
        onClick={loadSongs}>
        <img src={playlist.thumbnail} alt="" style={{ width: "60px", height: "60px", borderRadius: "12px", objectFit: "cover", border: "1px solid var(--border-thin)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-syne" style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>{truncate(playlist.title, 45)}</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {playlist.songCount} TRACKS · {playlist.language}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }} onClick={e => e.stopPropagation()}>
          <button onClick={saveToLibrary} style={{
            padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)",
            background: saved ? "white" : "transparent",
            color: saved ? "black" : "white",
            fontSize: "11px", fontWeight: 800, cursor: saving ? "wait" : "pointer",
            textTransform: "uppercase", letterSpacing: "0.05em"
          }}>
            {saving ? "..." : saved ? "SAVED" : "+ LIB"}
          </button>
          <button onClick={playAll} style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "white", border: "none", color: "black",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>PLAY</button>
        </div>
      </div>

      {expanded && (
        <div className="stitch-top" style={{ padding: "8px 0" }}>
          {loadingSongs ? (
            <div style={{ padding: "24px", color: "var(--text-muted)", textAlign: "center", fontSize: "12px", letterSpacing: "0.1em" }}>LOADING...</div>
          ) : (
            songs.map((song, i) => (
              <SongCard key={song.id} song={song} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// -- Search Page --
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ songs: [], artists: [], playlists: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("Songs");
  const [artistSongs, setArtistSongs] = useState(null);
  const debounceRef = useRef(null);
  const { playSong, searchHistory, addSearchHistory, removeSearchHistory, clearSearchHistory } = usePlayerStore();

  const search = async (q, tab = activeTab, saveHistory = false) => {
    if (!q.trim()) { setResults({ songs: [], artists: [], playlists: [] }); setSearched(false); setArtistSongs(null); return; }
    setLoading(true);
    setArtistSongs(null);
    if (saveHistory) addSearchHistory(q.trim());
    try {
      if (tab === "Songs") {
        const { data } = await api.get(`/api/saavn/search/songs?query=${encodeURIComponent(q)}&limit=20`);
        const songs = (data?.data?.results || []).map(saavnToSong);
        setResults(r => ({ ...r, songs }));
      } else if (tab === "Artists") {
        const { data } = await api.get(`/api/saavn/search/artists?query=${encodeURIComponent(q)}&limit=20`);
        setResults(r => ({ ...r, artists: data?.data?.results || [] }));
      } else if (tab === "Playlists") {
        const { data } = await api.get(`/api/saavn/search/playlists?query=${encodeURIComponent(q)}&limit=10`);
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
      const { data } = await api.get(`/api/saavn/artists/${artist.id}/songs?limit=20`);
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

  const switchTab = (tab) => {
    setActiveTab(tab);
    setArtistSongs(null);
    if (query.trim()) search(query, tab, false);
  };

  return (
    <div style={{ padding: "32px 0", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 className="font-syne" style={{ fontSize: "36px", fontWeight: 800, marginBottom: "32px", letterSpacing: "-0.03em" }}>Search</h1>

      {/* Search bar */}
      <form onSubmit={e => { e.preventDefault(); search(query, activeTab, true); }} style={{ marginBottom: "32px" }}>
        <div className="glass" style={{ position: "relative", maxWidth: "600px", borderRadius: "16px", border: "1px solid var(--border-thin)" }}>
          <span style={{ position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "20px", fontWeight: 800 }}>⌕</span>
          <input value={query} onChange={handleInput} placeholder="Search tracks, artists, collections..."
            autoFocus style={{ width: "100%", padding: "16px 18px 16px 52px", background: "transparent", border: "none", color: "var(--text-primary)", fontSize: "16px", outline: "none", fontFamily: "Outfit" }} />
        </div>
      </form>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => switchTab(tab)} style={{
            padding: "10px 24px", borderRadius: "12px", border: "1px solid var(--border-thin)", cursor: "pointer",
            fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
            background: activeTab === tab ? "var(--text-primary)" : "var(--bg-glass)",
            color: activeTab === tab ? "var(--bg-void)" : "var(--text-primary)",
            transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}>{tab}</button>
        ))}
      </div>

      {loading && <div style={{ color: "var(--text-muted)", fontSize: "12px", letterSpacing: "0.1em" }}>SEARCHING...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {activeTab === "Songs" && results.songs.map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
        {activeTab === "Playlists" && results.playlists.map(p => <PlaylistCard key={p.id} playlist={p} />)}
        
        {activeTab === "Artists" && !artistSongs && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "24px" }}>
            {results.artists.map(artist => (
              <div key={artist.id} onClick={() => loadArtistSongs(artist)} className="glass" style={{ cursor: "pointer", textAlign: "center", padding: "20px", borderRadius: "24px", border: "1px solid var(--border-thin)" }}>
                <img src={getImage(artist.image)} alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", objectFit: "cover", marginBottom: "16px", border: "1px solid var(--border-thin)" }} />
                <div style={{ fontSize: "14px", fontWeight: 700 }}>{artist.name}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", textTransform: "uppercase" }}>{artist.role}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Artists" && artistSongs && (
          <div className="fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <button onClick={() => setArtistSongs(null)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: "20px", cursor: "pointer" }}>BACK</button>
              <img src={getImage(artistSongs.artist.image)} alt="" style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover" }} />
              <span className="font-syne" style={{ fontSize: "18px", fontWeight: 700 }}>{artistSongs.artist.name}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {artistSongs.songs.map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
            </div>
          </div>
        )}
      </div>

      {!searched && !loading && (
        <div style={{ marginTop: "16px" }}>
          {searchHistory.length > 0 && (
            <div className="stitch-top" style={{ paddingTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.15em" }}>RECENT SEARCHES</span>
                <button onClick={clearSearchHistory} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "10px", fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}>Clear all</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {searchHistory.map(h => (
                  <div key={h} className="glass" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px", borderRadius: "12px", border: "1px solid var(--border-thin)", cursor: "pointer" }}
                    onClick={() => { setQuery(h); search(h, activeTab, false); }}>
                    <span style={{ fontSize: "14px" }}>{h}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeSearchHistory(h); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>X</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}