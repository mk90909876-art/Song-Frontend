import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";

export default function App() {
  const { token, loading, fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

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