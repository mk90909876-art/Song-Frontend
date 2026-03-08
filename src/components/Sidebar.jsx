import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const NAV = [
  { to: "/", icon: "⊞", label: "Home" },
  { to: "/search", icon: "⌕", label: "Search" },
  { to: "/library", icon: "≡", label: "Library" },
  { to: "/liked", icon: "♥", label: "Liked" },
  { to: "/settings", icon: "⚙", label: "Settings" },
];

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

export default function Sidebar() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <nav id="bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "8px 0 16px", zIndex: 50,
      }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === "/"} style={({ isActive }) => ({
            display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
            textDecoration: "none", padding: "4px 8px",
            color: isActive ? "var(--accent)" : "var(--text-muted)",
          })}>
            <span style={{ fontSize: "22px" }}>{icon}</span>
            <span style={{ fontSize: "10px", fontWeight: 600 }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <aside style={{
      width: "220px", minWidth: "220px",
      background: "var(--bg-secondary)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "24px 12px", height: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 12px", marginBottom: "32px" }}>
        <div style={{ width: "32px", height: "32px", background: "var(--accent)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>♪</div>
        <span style={{ fontFamily: "Syne", fontWeight: 800, fontSize: "20px" }}>Song</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === "/"} style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: "12px",
            padding: "10px 12px", borderRadius: "10px",
            textDecoration: "none",
            color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
            background: isActive ? "var(--bg-elevated)" : "transparent",
            fontSize: "14px", fontWeight: isActive ? 600 : 400,
            transition: "0.15s",
          })}>
            <span style={{ fontSize: "18px" }}>{icon}</span>{label}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 12px 10px", borderTop: "1px solid var(--border)", marginTop: "16px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700 }}>
          {user?.username?.[0]?.toUpperCase() || "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.username || "User"}</div>
        </div>
      </div>
    </aside>
  );
}