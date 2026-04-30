import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Player from "./Player";
import HomePage from "../pages/HomePage";
import SearchPage from "../pages/SearchPage";
import LibraryPage from "../pages/LibraryPage";
import LikedPage from "../pages/LikedPage";
import SettingsPage from "../pages/SettingsPage";
import { applyTheme } from "../utils/theme";

export default function AppLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Initialize and Sync Theme
  useEffect(() => {
    applyTheme();
    const handleThemeChange = () => applyTheme();
    window.addEventListener("themechange", handleThemeChange);
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (localStorage.getItem("theme") === "system") applyTheme();
    };
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => {
      window.removeEventListener("themechange", handleThemeChange);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-void)",
      color: "var(--text-primary)",
      fontFamily: "'Outfit', sans-serif"
    }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {!isMobile && <Sidebar />}
        <main style={{
          flex: 1,
          overflowY: "auto",
          /* Extra bottom padding to clear the floating mini player + bottom nav on mobile */
          paddingBottom: isMobile ? "200px" : "120px",
          position: "relative",
          zIndex: 1
        }}>
          <div className="fade-in" style={{ padding: isMobile ? "16px" : "32px", maxWidth: "1600px", margin: "0 auto" }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/liked" element={<LikedPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>
      <Player />
      {isMobile && <Sidebar />}
    </div>
  );
}