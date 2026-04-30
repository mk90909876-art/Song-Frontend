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
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    return (
      <nav id="bottom-nav" className="glass stitch-top" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "12px 0 24px", zIndex: 100,
        borderRadius: "20px 20px 0 0",
      }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === "/"}>
            {({ isActive }) => (
              <span style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                textDecoration: "none", padding: "4px 12px",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isActive ? "scale(1.1)" : "scale(1)",
              }}>
                <span style={{ fontSize: "20px", fontWeight: isActive ? 800 : 400 }}>{icon}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: isActive ? 1 : 0.6 }}>{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <aside className="stitch-right" style={{
      width: "var(--sidebar-width)",
      minWidth: "var(--sidebar-width)",
      background: "var(--bg-void)",
      display: "flex", flexDirection: "column",
      padding: "32px 16px", height: "100%",
      position: "relative",
      zIndex: 10
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "0 12px", marginBottom: "40px" }}>
        <div style={{ 
          width: "32px", height: "32px", 
          background: "var(--text-primary)", 
          color: "var(--bg-void)",
          borderRadius: "4px", 
          display: "flex", alignItems: "center", justifyContent: "center", 
          fontSize: "18px", fontWeight: 900 
        }}>S</div>
        <span className="font-syne" style={{ fontWeight: 800, fontSize: "22px", letterSpacing: "-0.02em" }}>Void</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {NAV.map(({ to, icon, label }, i) => (
          <div key={to}>
            <NavLink to={to} end={to === "/"} style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: "16px",
              padding: "12px 16px", borderRadius: "12px",
              textDecoration: "none",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
              fontSize: "14px", fontWeight: isActive ? 600 : 500,
              transition: "0.2s",
              border: isActive ? "1px solid var(--border-thin)" : "1px solid transparent",
            })}>
              <span style={{ fontSize: "18px", opacity: 0.8 }}>{icon}</span>
              {label}
            </NavLink>
            {i === 1 && <div className="stitch-top" style={{ margin: "16px 12px", opacity: 0.5 }} />}
          </div>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div className="glass" style={{ 
        display: "flex", alignItems: "center", gap: "12px", 
        padding: "12px", borderRadius: "16px",
        marginTop: "16px" 
      }}>
        <div style={{ 
          width: "32px", height: "32px", borderRadius: "8px", 
          background: "rgba(255,255,255,0.1)", 
          border: "1px solid var(--border-thin)",
          display: "flex", alignItems: "center", justifyContent: "center", 
          fontSize: "12px", fontWeight: 700 
        }}>
          {user?.username?.[0]?.toUpperCase() || "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.username || "User"}</div>
        </div>
      </div>
    </aside>
  );
}