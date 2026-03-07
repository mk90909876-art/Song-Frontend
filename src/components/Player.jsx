import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";

const formatTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const ShuffleIcon = ({ on }) => on ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 3 21 3 21 8"/><polyline points="16 21 21 21 21 16"/>
    <line x1="4" y1="20" x2="21" y2="3"/><line x1="4" y1="4" x2="21" y2="21"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const RepeatIcon = ({ mode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    {mode === "one" && <text x="10" y="14" fontSize="7" fill="currentColor" stroke="none">1</text>}
  </svg>
);

// Load YouTube IFrame API once globally
let ytApiLoaded = false;
let ytApiCallbacks = [];
const loadYTApi = () => {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    ytApiCallbacks.push(resolve);
    if (!ytApiLoaded) {
      ytApiLoaded = true;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => {
        ytApiCallbacks.forEach(cb => cb());
        ytApiCallbacks = [];
      };
    }
  });
};

export default function Player() {
  const {
    currentSong, isPlaying, queue, shuffle, repeat, volume,
    progress, duration, setDuration, setProgress, setIsPlaying,
    togglePlay, toggleShuffle, toggleRepeat, setVolume,
    nextSong, prevSong, removeFromQueue, moveQueueItem,
  } = usePlayerStore();

  const ytPlayerRef = useRef(null);
  const intervalRef = useRef(null);
  const lastSongIdRef = useRef(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize YT player once
  useEffect(() => {
    if (document.getElementById("yt-player")) return;
    const div = document.createElement("div");
    div.id = "yt-player";
    div.style.cssText = "position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;";
    document.body.appendChild(div);

    loadYTApi().then(() => {
      ytPlayerRef.current = new window.YT.Player("yt-player", {
        width: "1", height: "1",
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume * 100);
          },
          onStateChange: (e) => {
            const YT = window.YT.PlayerState;
            if (e.data === YT.PLAYING) {
              setIsPlaying(true);
              setDuration(e.target.getDuration());
              clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                if (!seeking && ytPlayerRef.current?.getCurrentTime) {
                  setProgress(ytPlayerRef.current.getCurrentTime());
                }
              }, 500);
            } else if (e.data === YT.PAUSED) {
              setIsPlaying(false);
              clearInterval(intervalRef.current);
            } else if (e.data === YT.ENDED) {
              clearInterval(intervalRef.current);
              nextSong();
            }
          },
        },
      });
    });
    return () => clearInterval(intervalRef.current);
  }, []);

  // Auto-play when song changes
  useEffect(() => {
    if (!currentSong) return;
    if (lastSongIdRef.current === currentSong.id) return;
    lastSongIdRef.current = currentSong.id;

    const tryLoad = () => {
      if (ytPlayerRef.current?.loadVideoById) {
        ytPlayerRef.current.loadVideoById(currentSong.id);
        setProgress(0);
      } else {
        setTimeout(tryLoad, 300);
      }
    };
    tryLoad();
  }, [currentSong?.id]);

  // Sync play/pause
  useEffect(() => {
    if (!ytPlayerRef.current) return;
    if (isPlaying) {
      ytPlayerRef.current.playVideo?.();
    } else {
      ytPlayerRef.current.pauseVideo?.();
    }
  }, [isPlaying]);

  // Sync volume
  useEffect(() => {
    ytPlayerRef.current?.setVolume?.(volume * 100);
  }, [volume]);

  if (!currentSong) return null;

  const currentTime = seeking ? seekValue : progress;

  const handleSeekStart = () => { setSeeking(true); setSeekValue(progress); };
  const handleSeekChange = (e) => setSeekValue(parseFloat(e.target.value));
  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    setSeeking(false);
    ytPlayerRef.current?.seekTo?.(val, true);
    setProgress(val);
  };

  // ── Mini Player ───────────────────────────────────────────
  return (
    <>
      <div style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        padding: "8px 12px",
        position: isMobile ? "fixed" : "relative",
        bottom: isMobile ? "60px" : "auto",
        left: 0, right: 0,
        zIndex: 49,
        boxSizing: "border-box",
      }}>
        {/* Progress bar at top */}
        <input type="range" min="0" max={duration || 100}
          value={currentTime}
          onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
          onChange={handleSeekChange}
          onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd}
          style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer", margin: "0 0 6px 0", height: "3px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Song info */}
          <div onClick={() => setShowFullScreen(true)}
            style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0, cursor: "pointer" }}>
            <img src={currentSong.thumbnail} alt=""
              style={{ width: "38px", height: "38px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {currentSong.title}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {currentSong.artist}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <button onClick={prevSong} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "18px" }}>⏮</button>
            <button onClick={togglePlay}
              style={{ background: "var(--accent)", border: "none", color: "white", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={nextSong} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "18px" }}>⏭</button>
          </div>

          {/* Time + Volume (desktop only) */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "16px" }}>🔊</span>
              <input type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ width: "80px", accentColor: "var(--accent)", cursor: "pointer" }} />
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Player */}
      {showFullScreen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "var(--bg-primary)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${currentSong.thumbnail})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(40px) brightness(0.3)",
            transform: "scale(1.1)",
          }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "20px", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <button onClick={() => setShowFullScreen(false)}
                style={{ background: "none", border: "none", color: "white", fontSize: "28px", cursor: "pointer", lineHeight: 1 }}>⌄</button>
              <span style={{ color: "white", fontWeight: 600, fontSize: "14px" }}>Now Playing</span>
              <div style={{ width: "28px" }} />
            </div>

            {/* Album art */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <img src={currentSong.thumbnail} alt=""
                style={{ width: "min(280px, 70vw)", height: "min(280px, 70vw)", borderRadius: "16px", objectFit: "cover", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
            </div>

            {/* Song info */}
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "white", marginBottom: "4px" }}>{currentSong.title}</div>
              <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>{currentSong.artist}</div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: "16px" }}>
              <input type="range" min="0" max={duration || 100}
                value={currentTime}
                onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd}
                style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{formatTime(currentTime)}</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <button onClick={toggleShuffle}
                style={{ background: "none", border: "none", color: shuffle ? "var(--accent)" : "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                <ShuffleIcon on={shuffle} />
              </button>
              <button onClick={prevSong}
                style={{ background: "none", border: "none", color: "white", fontSize: "28px", cursor: "pointer" }}>⏮</button>
              <button onClick={togglePlay}
                style={{ background: "var(--accent)", border: "none", color: "white", borderRadius: "50%", width: "60px", height: "60px", fontSize: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button onClick={nextSong}
                style={{ background: "none", border: "none", color: "white", fontSize: "28px", cursor: "pointer" }}>⏭</button>
              <button onClick={toggleRepeat}
                style={{ background: "none", border: "none", color: repeat !== "none" ? "var(--accent)" : "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                <RepeatIcon mode={repeat} />
              </button>
            </div>

            {/* Volume */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>🔈</span>
              <input type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer" }} />
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>🔊</span>
            </div>

            {/* Queue */}
            {queue.length > 0 && (
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>Up Next</div>
                {queue.slice(0, 10).map((song, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <img src={song.thumbnail} alt="" style={{ width: "36px", height: "36px", borderRadius: "4px", objectFit: "cover" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{song.artist}</div>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {i > 0 && <button onClick={() => moveQueueItem(i, i - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "12px" }}>▲</button>}
                      {i < queue.length - 1 && <button onClick={() => moveQueueItem(i, i + 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "12px" }}>▼</button>}
                      <button onClick={() => removeFromQueue(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "14px" }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}