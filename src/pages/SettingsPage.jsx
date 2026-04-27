import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import api from "../utils/api";
import { saavnToSong } from "../utils/saavn";

const THEMES = [
  { id: "dark", label: "Dark", icon: "🌙" },
  { id: "light", label: "Light", icon: "☀️" },
  { id: "device", label: "Device", icon: "💻" },
];

const getStoredTheme = () => localStorage.getItem("theme") || "dark";

export const applyTheme = (theme) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "device" && prefersDark);
  const root = document.documentElement;
  if (isDark) {
    root.style.setProperty("--bg-primary", "#0a0a0a");
    root.style.setProperty("--bg-secondary", "#111111");
    root.style.setProperty("--bg-elevated", "#1a1a1a");
    root.style.setProperty("--bg-card", "#1e1e1e");
    root.style.setProperty("--text-primary", "#ffffff");
    root.style.setProperty("--text-secondary", "#a0a0a0");
    root.style.setProperty("--text-muted", "#555555");
    root.style.setProperty("--border", "#2a2a2a");
  } else {
    root.style.setProperty("--bg-primary", "#f5f5f5");
    root.style.setProperty("--bg-secondary", "#ffffff");
    root.style.setProperty("--bg-elevated", "#ebebeb");
    root.style.setProperty("--bg-card", "#e0e0e0");
    root.style.setProperty("--text-primary", "#111111");
    root.style.setProperty("--text-secondary", "#555555");
    root.style.setProperty("--text-muted", "#999999");
    root.style.setProperty("--border", "#d0d0d0");
  }
};

// ── Spotify Import Section ────────────────────────────────────
function SpotifyImport() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [loadingMsg, setLoadingMsg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { createPlaylist, addSongToPlaylist } = useLibraryStore();

  const handleImport = async () => {
    if (!url.trim()) return;
    if (!url.includes("spotify.com/playlist/")) {
      setError("Please enter a valid Spotify playlist URL");
      return;
    }
    setStatus("loading");
    setLoadingMsg("Fetching playlist from Spotify…");
    setError("");
    setResult(null);
    setSaved(false);
    try {
      // Step 1: Get Spotify track list from backend
      const { data } = await api.post("/api/music/import-spotify", { url: url.trim() });

      // Step 2: Match each track to JioSaavn on the frontend
      setLoadingMsg(`Matching ${data.totalTracks} tracks on JioSaavn…`);
      const matched = [];
      let failed = 0;

      // Process in small batches to avoid hammering the API
      const tracks = data.matched || [];
      const BATCH = 5;
      for (let i = 0; i < tracks.length; i += BATCH) {
        const batch = tracks.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (track) => {
            const q = encodeURIComponent(`${track.title} ${track.artist}`.trim());
            const { data: d } = await api.get(`/api/saavn/search/songs?query=${q}&limit=3`);
            const first = d?.data?.results?.[0];
            if (!first) throw new Error("no result");
            return saavnToSong(first);
          })
        );
        results.forEach(r => {
          if (r.status === "fulfilled") matched.push(r.value);
          else failed++;
        });
        setLoadingMsg(`Matched ${matched.length} / ${tracks.length} tracks on JioSaavn…`);
      }

      setResult({
        playlistName: data.playlistName,
        matched,
        matchedCount: matched.length,
        failedCount: data.totalTracks - matched.length,
        totalTracks: data.totalTracks,
      });
      setStatus("done");
    } catch (err) {
      setError(err.response?.data?.error || "Import failed. Make sure the playlist is public.");
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
    } catch (err) {
      setError("Failed to save to library");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setUrl(""); setStatus("idle"); setResult(null); setError(""); setSaved(false);
  };

  return (
    <div>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: "1.5" }}>
        Paste a public Spotify playlist URL to import it into your library.
      </p>

      {status === "idle" || status === "error" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/..."
            style={{
              width: "100%", padding: "10px 14px", background: "var(--bg-primary)",
              border: "1px solid var(--border)", borderRadius: "8px",
              color: "var(--text-primary)", fontSize: "13px", outline: "none",
              boxSizing: "border-box", fontFamily: "DM Sans",
            }}
          />
          {error && <div style={{ fontSize: "12px", color: "#ff6b6b" }}>{error}</div>}
          <button onClick={handleImport} disabled={!url.trim()} style={{
            padding: "10px", background: "#1DB954", border: "none",
            borderRadius: "8px", color: "#fff", fontSize: "13px", fontWeight: 700,
            cursor: url.trim() ? "pointer" : "not-allowed", opacity: url.trim() ? 1 : 0.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}>
            <span>♫</span> Import from Spotify
          </button>
        </div>
      ) : status === "loading" ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: "24px", marginBottom: "10px", animation: "spin 1s linear infinite", display: "inline-block" }}>↻</div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{loadingMsg || "Importing…"}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>This may take a moment</div>
        </div>
      ) : status === "done" && result ? (
        <div>
          {/* Result summary */}
          <div style={{ background: "var(--bg-primary)", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
              "{result.playlistName}"
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
              <span style={{ color: "#1DB954" }}>✓ {result.matchedCount} matched</span>
              {result.failedCount > 0 && <span style={{ color: "var(--text-muted)" }}>✗ {result.failedCount} not found</span>}
              <span style={{ color: "var(--text-secondary)" }}>of {result.totalTracks} songs</span>
            </div>
          </div>

          {/* Preview songs */}
          <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
            {result.matched.slice(0, 20).map((song, i) => (
              <div key={song.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderBottom: i < Math.min(result.matched.length, 20) - 1 ? "1px solid var(--border)" : "none" }}>
                <img src={song.thumbnail} alt="" style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{song.artist}</div>
                </div>
              </div>
            ))}
            {result.matched.length > 20 && (
              <div style={{ padding: "8px 10px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
                +{result.matched.length - 20} more songs
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={saveToLibrary} disabled={saving || saved} style={{
              flex: 1, padding: "10px", background: saved ? "var(--bg-elevated)" : "#1DB954",
              border: "none", borderRadius: "8px", color: saved ? "var(--text-secondary)" : "#fff",
              fontSize: "13px", fontWeight: 700, cursor: saving || saved ? "default" : "pointer",
            }}>
              {saving ? "Saving…" : saved ? "✓ Saved to Library" : "Save to Library"}
            </button>
            <button onClick={reset} style={{
              padding: "10px 16px", background: "var(--bg-primary)", border: "1px solid var(--border)",
              borderRadius: "8px", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
            }}>
              Import Another
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────
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
    <div style={{ padding: "32px", overflowY: "auto", height: "100%", maxWidth: "560px" }}>
      <h1 style={{ fontFamily: "Syne", fontSize: "28px", fontWeight: 800, marginBottom: "32px" }}>Settings</h1>

      {/* Profile */}
      <Section title="Profile">
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "4px 0" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700 }}>
            {user?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 600 }}>{user?.username || "User"}</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>{user?.email || ""}</div>
          </div>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>Choose how Song looks to you</p>
        <div style={{ display: "flex", gap: "10px" }}>
          {THEMES.map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)} style={{
              flex: 1, padding: "14px 8px",
              background: currentTheme === t.id ? "var(--accent)" : "var(--bg-elevated)",
              border: `2px solid ${currentTheme === t.id ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "12px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: "22px" }}>{t.icon}</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: currentTheme === t.id ? "#fff" : "var(--text-primary)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Playback */}
      <Section title="Playback">
        <SettingRow label="Auto Queue" desc="Automatically add related songs when queue is low">
          <Toggle on={autoQueue} onToggle={toggleAutoQueue} />
        </SettingRow>
      </Section>

      {/* Spotify Import */}
      <Section title="Import from Spotify">
        <SpotifyImport />
      </Section>

      {/* Account */}
      <Section title="Account">
        <SettingRow label="Log out" desc="Sign out of your account">
          <button onClick={logout} style={{
            padding: "8px 20px", background: "transparent",
            border: "1px solid var(--accent)", borderRadius: "8px",
            color: "var(--accent)", cursor: "pointer",
            fontSize: "13px", fontWeight: 600,
          }}>Log out</button>
        </SettingRow>
      </Section>

      {/* About */}
      <Section title="About">
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          <p>Song — a private music player for friends.</p>
          <p style={{ marginTop: "6px", color: "var(--text-muted)" }}>Streams audio via JioSaavn · No ads · No tracking</p>
        </div>
      </Section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      width: "44px", height: "24px",
      background: on ? "var(--accent)" : "var(--bg-card)",
      borderRadius: "12px", cursor: "pointer",
      position: "relative", transition: "background 0.2s",
      border: "1px solid var(--border)", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: "3px",
        left: on ? "22px" : "3px",
        width: "16px", height: "16px",
        background: "#fff", borderRadius: "50%",
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <h2 style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: "14px" }}>{title.toUpperCase()}</h2>
      <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}