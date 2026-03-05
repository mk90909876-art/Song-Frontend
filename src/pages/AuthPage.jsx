import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuthStore();
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        navigate("/");
      } else {
        await signup(form.email, form.password, form.username);
        setSuccess("Account created! Please check your email to confirm, then log in.");
        setMode("login");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(circle, rgba(255,77,77,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="fade-in" style={{
        width: "100%", maxWidth: "400px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "40px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "48px", height: "48px",
            background: "var(--accent)",
            borderRadius: "12px",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            fontSize: "24px",
          }}>♪</div>
          <h1 style={{ fontFamily: "Syne", fontSize: "28px", fontWeight: 800 }}>Song</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Toggle */}
        <div style={{
          display: "flex", background: "var(--bg-elevated)",
          borderRadius: "10px", padding: "4px", marginBottom: "24px",
        }}>
          {["login", "signup"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
              style={{
                flex: 1, padding: "8px", border: "none", cursor: "pointer",
                borderRadius: "8px", fontSize: "14px", fontWeight: 500,
                background: mode === m ? "var(--bg-card)" : "transparent",
                color: mode === m ? "var(--text-primary)" : "var(--text-secondary)",
                transition: "all 0.2s",
              }}>
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handle} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "signup" && (
            <input
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              style={inputStyle}
            />
          )}
          <input
            type="email" placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required style={inputStyle}
          />
          <input
            type="password" placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required style={inputStyle}
          />

          {error && (
            <div style={{
              background: "rgba(255,77,77,0.1)", border: "1px solid rgba(255,77,77,0.3)",
              borderRadius: "8px", padding: "10px 14px",
              color: "var(--accent)", fontSize: "13px",
            }}>{error}</div>
          )}

          {success && (
            <div style={{
              background: "rgba(77,255,128,0.1)", border: "1px solid rgba(77,255,128,0.3)",
              borderRadius: "8px", padding: "10px 14px",
              color: "#4dff80", fontSize: "13px",
            }}>{success}</div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: "12px", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: "10px", fontSize: "15px",
            fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, transition: "all 0.2s",
            fontFamily: "Syne",
          }}>
            {loading ? "..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "12px 14px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  color: "var(--text-primary)",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  fontFamily: "DM Sans",
};