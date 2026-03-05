import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Player from "./Player";
import HomePage from "../pages/HomePage";
import SearchPage from "../pages/SearchPage";
import LibraryPage from "../pages/LibraryPage";
import LikedPage from "../pages/LikedPage";
import SettingsPage, { applyTheme } from "../pages/SettingsPage";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

export default function AppLayout() {
  const isMobile = useIsMobile();

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    applyTheme(saved);

    // Listen for theme changes from SettingsPage
    const handler = () => applyTheme(localStorage.getItem("theme") || "dark");
    window.addEventListener("themechange", handler);
    return () => window.removeEventListener("themechange", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {!isMobile && <Sidebar />}
        <main style={{ flex: 1, overflowY: "auto", paddingBottom: isMobile ? "150px" : "0" }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/liked" element={<LikedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <Player />
      {isMobile && <Sidebar />}
    </div>
  );
}