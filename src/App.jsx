import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useLibraryStore } from "./store/libraryStore";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";

export default function App() {
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (token) {
      useLibraryStore.getState().loadLibrary();
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*" element={token ? <AppLayout /> : <AuthPage />} />
      </Routes>
    </BrowserRouter>
  );
}