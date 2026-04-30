import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import api from "../utils/api";
import { saavnToSong } from "../utils/saavn";

import { THEMES, getStoredTheme, applyTheme } from "../utils/theme";

// -- Spotify Import Section --
function SpotifyImport() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { createPlaylist, addSongToPlaylist } = useLibraryStore();

  const handleImport = async () => {
    if (!url.trim()) return;
    setStatus("loading");
    setLoadingMsg("ESTABLISHING CONNECTION...");
    setError("");
    try {
      const { data } = await api.post("/api/saavn/import-spotify", { url: url.trim() });
      setLoadingMsg(`SYNCING ${data.totalTracks} TRACKS...`);
      const matched = [];
      const tracks = data.matched || [];
      for (let i = 0; i < tracks.length; i += 5) {
        const batch = tracks.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (track) => {
            const q = encodeURIComponent(`${track.title} ${track.artist}`.trim());
            const { data: d } = await api.get(`/api/saavn/search/songs?query=${q}&limit=3`);
            if (d?.data?.results?.[0]) return saavnToSong(d.data.results[0]);
            throw new Error();
          })
        );
        results.forEach(r => r.status === "fulfilled" && matched.push(r.value));
        setLoadingMsg(`INDEXING: ${matched.length} / ${tracks.length}`);
      }
      setResult({ playlistName: data.playlistName, matched, totalTracks: data.totalTracks });
      setStatus("done");
    } catch (err) {
      setError("Import failed. Ensure the playlist is public.");
      setStatus("error");
    }
  };

  const saveToLibrary = async () => {
    if (!result?.matched?.length || saving || saved) return;
    setSaving(true);
    try {
      const playlist = await createPlaylist(result.playlistName, "Imported from Spotify");
      await Promise.all(result.matched.map(s => addSongToPlaylist(playlist.id, s)));
      setSaved(true);
    } catch (err) { setError("Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px", letterSpacing: "0.02em" }}>SYNC EXTERNAL PLAYLISTS INTO THE VOID</p>
      {status === "idle" || status === "error" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="SPOTIFY URL"
            style={{ width: "100%", padding: "14px", background: "var(--bg-glass)", border: "1px solid var(--border-thin)", borderRadius: "12px", color: "white", fontSize: "12px", outline: "none", fontFamily: "Outfit" }} />
          {error && <div style={{ fontSize: "11px", color: "#ff4444", fontWeight: 700 }}>{error}</div>}
          <button onClick={handleImport} style={{ padding: "14px", background: "white", color: "black", border: "none", borderRadius: "12px", fontSize: "12px", fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}>BEGIN IMPORT</button>
        </div>
      ) : status === "loading" ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.2em" }}>{loadingMsg}</div>
        </div>
      ) : status === "done" && result ? (
        <div className="glass" style={{ padding: "20px", borderRadius: "16px", border: "1px solid var(--border-thin)" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px" }}>{result.playlistName}</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "20px" }}>{result.matched.length} / {result.totalTracks} TRACKS MATCHED</div>
          <button onClick={saveToLibrary} style={{ width: "100%", padding: "14px", background: saved ? "transparent" : "white", color: saved ? "white" : "black", border: saved ? "1px solid var(--border-thin)" : "none", borderRadius: "12px", fontWeight: 800, fontSize: "12px" }}>
            {saving ? "SAVING..." : saved ? "ADDED TO LIBRARY" : "CONFIRM IMPORT"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// -- Settings Page --
export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { autoQueue, toggleAutoQueue } = usePlayerStore();
  const [currentTheme, setCurrentTheme] = useState(getStoredTheme());

  const setTheme = (theme) => {
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    setCurrentTheme(theme);
    window.dispatchEvent(new Event("themechange"));
  };

  return (
    <div style={{ padding: "32px 0", maxWidth: "600px", margin: "0 auto" }}>
      <h1 className="font-syne" style={{ fontSize: "36px", fontWeight: 800, marginBottom: "24px", letterSpacing: "-0.03em" }}>Settings</h1>

      <Section title="IDENTITY">
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "white", color: "black", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 900 }}>
            {user?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>{user?.username || "GUEST"}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{user?.email || "NOT SIGNED IN"}</div>
          </div>
        </div>
      </Section>

      <Section title="AESTHETIC">
        <div style={{ display: "flex", gap: "12px" }}>
          {THEMES.map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)} className="glass" style={{
              flex: 1, padding: "20px 12px",
              background: currentTheme === t.id ? "var(--text-primary)" : "transparent",
              border: `1px solid ${currentTheme === t.id ? "var(--text-primary)" : "var(--border-thin)"}`,
              borderRadius: "16px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
              transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              <span style={{ fontSize: "18px", color: currentTheme === t.id ? "var(--bg-void)" : "var(--text-primary)", fontWeight: 900 }}>{t.icon}</span>
              <span style={{ fontSize: "10px", fontWeight: 800, color: currentTheme === t.id ? "var(--bg-void)" : "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="EXTERNAL">
        <SpotifyImport />
      </Section>

      <Section title="SYSTEM">
        <SettingRow label="Session" desc="Terminate current authentication">
          <button onClick={logout} style={{ padding: "10px 20px", background: "transparent", border: "1px solid #ff4444", borderRadius: "8px", color: "#ff4444", cursor: "pointer", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>LOGOUT</button>
        </SettingRow>
      </Section>

      <div className="stitch-top" style={{ paddingTop: "32px", textAlign: "center" }}>
        <div className="font-syne" style={{ fontSize: "24px", fontWeight: 900, opacity: 0.2, letterSpacing: "0.5em" }}>SONG</div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "8px", letterSpacing: "0.1em" }}>VERSION 2.0.0</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "clamp(24px, 5vw, 48px)" }}>
      <h2 style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.2em", marginBottom: "clamp(12px, 2vw, 16px)" }}>{title}</h2>
      <div className="glass" style={{ borderRadius: "20px", padding: "clamp(16px, 4vw, 24px)", border: "1px solid var(--border-thin)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 800 }}>{label}</div>
        {desc && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width: "48px", height: "26px", background: on ? "white" : "rgba(255,255,255,0.05)", borderRadius: "13px", cursor: "pointer", position: "relative", transition: "0.3s", border: "1px solid var(--border-thin)" }}>
      <div style={{ position: "absolute", top: "4px", left: on ? "26px" : "4px", width: "16px", height: "16px", background: on ? "black" : "white", borderRadius: "50%", transition: "0.3s" }} />
    </div>
  );
}