import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { usePlayerStore } from "../store/playerStore";

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
          <p style={{ marginTop: "6px", color: "var(--text-muted)" }}>Streams audio via yt-dlp · No ads · No tracking</p>
        </div>
      </Section>
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