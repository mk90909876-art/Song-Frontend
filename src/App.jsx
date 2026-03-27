import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";
import { unlockAudioSession } from "./utils/audioSession";

export default function App() {
  const { token, loading, fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Global Audio Session Unlocker (runs once on first interaction)
  useEffect(() => {
    const unlock = () => {
      unlockAudioSession();
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("mousedown", unlock);
    };
    window.addEventListener("touchstart", unlock);
    window.addEventListener("mousedown", unlock);
    return () => {
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("mousedown", unlock);
    };
  }, []);

  if (loading) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*" element={token ? <AppLayout /> : <AuthPage />} />
      </Routes>
    </BrowserRouter>
  );
}