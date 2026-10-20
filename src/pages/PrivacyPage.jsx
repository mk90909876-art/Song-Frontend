import { Link } from "react-router-dom";

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-void, #0a0a0a)",
        color: "#e5e5e5",
        overflowY: "auto",
        padding: "40px 20px 80px",
        fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        {/* Back link */}
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#888",
            fontSize: "14px",
            textDecoration: "none",
            marginBottom: "32px",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.color = "#fff")}
          onMouseLeave={(e) => (e.target.style.color = "#888")}
        >
          ← Back to Song
        </Link>

        <h1
          style={{
            fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: "8px",
            fontFamily: "Syne, sans-serif",
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ fontSize: "13px", color: "#666", marginBottom: "48px" }}>
          Last updated: October 2026 &nbsp;|&nbsp; Effective: October 2026
        </p>

        <Section title="1. Who We Are">
          <p>
            Song is a private music player application. We are committed to protecting your
            privacy and handling your personal data transparently.
          </p>
        </Section>

        <Section title="2. Data We Collect">
          <p>We collect only the minimum data necessary to provide the service:</p>
          <ul>
            <li>
              <strong style={{ color: "#fff" }}>Account information</strong>: Email address and
              username (used for authentication via Supabase).
            </li>
            <li>
              <strong style={{ color: "#fff" }}>Library data</strong>: Your playlists, liked
              songs, and listening preferences stored in our database.
            </li>
            <li>
              <strong style={{ color: "#fff" }}>Session tokens</strong>: Short-lived
              authentication tokens stored in your browser's memory — never in third-party
              advertising cookies.
            </li>
          </ul>
        </Section>

        <Section title="3. Data We Do NOT Collect">
          <ul>
            <li>We do NOT use Google Analytics, Facebook Pixel, or advertising trackers.</li>
            <li>We do NOT sell, rent, or share your data with advertisers.</li>
            <li>We do NOT track your listening habits for advertising profiling.</li>
            <li>We do NOT access your camera, microphone, or location.</li>
          </ul>
        </Section>

        <Section title="4. Audio Streaming">
          <p>
            Song fetches audio stream URLs on-demand from JioSaavn's public CDN (
            <code style={{ color: "#aaa", fontSize: "13px" }}>*.saavncdn.com</code>). These
            requests are proxied through our backend API. No audio content is stored on our
            servers. Your IP address may be visible to CDN nodes during playback, as with any
            web-based audio player.
          </p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>We use the following third-party services:</p>
          <ul>
            <li>
              <strong style={{ color: "#fff" }}>Supabase</strong>: Authentication and database
              storage.
            </li>
            <li>
              <strong style={{ color: "#fff" }}>Google Fonts</strong>: Font delivery via
              stylesheet.
            </li>
            <li>
              <strong style={{ color: "#fff" }}>Render.com</strong>: Backend API hosting.
            </li>
            <li>
              <strong style={{ color: "#fff" }}>Cloudflare Pages</strong>: Frontend hosting and
              CDN.
            </li>
          </ul>
        </Section>

        <Section title="6. Data Security">
          <p>
            All communications are encrypted via TLS (HTTPS). We enforce HTTP security headers
            (Content-Security-Policy, HSTS, X-Frame-Options) and use short-lived session tokens
            to protect your account.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <ul>
            <li>Access, correct, or delete your personal data.</li>
            <li>Withdraw consent at any time by deleting your account.</li>
            <li>Lodge a complaint with a data protection authority.</li>
          </ul>
        </Section>

        <Section title="8. Cookies">
          <p>
            Song does not use advertising or tracking cookies. Only functional session tokens
            required for authentication are stored. No third-party cookies are placed on your
            device.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be
            communicated through the app. The "Last updated" date above will reflect the most
            recent revision.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            For any privacy-related questions, contact us through the Settings page in the app.
          </p>
        </Section>

        <p
          style={{
            marginTop: "64px",
            fontSize: "12px",
            color: "#444",
            textAlign: "center",
          }}
        >
          &copy; {new Date().getFullYear()} Song. All rights reserved.
        </p>
      </div>
    </div>
  );
}

/* ── Section helper ──────────────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <section style={{ marginBottom: "36px" }}>
      <h2
        style={{
          fontSize: "1.05rem",
          fontWeight: 700,
          color: "#ff4d4d",
          marginBottom: "12px",
          fontFamily: "Syne, sans-serif",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: "15px",
          color: "#bbb",
          lineHeight: "1.75",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {children}
      </div>
    </section>
  );
}
