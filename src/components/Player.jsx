import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";

// ── Helpers ───────────────────────────────────────────────────
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

const RepeatIcon = ({ mode }) => {
  if (mode === "one") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      <text x="10" y="14" fontSize="7" fill="currentColor" stroke="none">1</text>
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
};

// ── YouTube IFrame Player ─────────────────────────────────────
const loadYTScript = () => {
  if (window.YT) return Promise.resolve();
  return new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = resolve;
  });
};

// ── Main Player Component ─────────────────────────────────────
export default function Player() {
  const {
    currentSong, isPlaying, queue, shuffle, repeat, volume,
    progress, duration, setDuration, setProgress, setIsPlaying,
    togglePlay, toggleShuffle, toggleRepeat, setVolume, seekTo,
    nextSong, prevSong, removeFromQueue, moveQueueItem,
  } = usePlayerStore();

  const ytPlayerRef = useRef(null);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);
  const isMobile = window.innerWidth <= 768;
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // Load YouTube IFrame API once
  useEffect(() => {
    loadYTScript();
  }, []);

  // Create/load YouTube player when song changes
  useEffect(() => {
    if (!currentSong) return;

    const initPlayer = async () => {
      await loadYTScript();

      if (ytPlayerRef.current) {
        // Player already exists — just load new video
        ytPlayerRef.current.loadVideoById(currentSong.id);
        return;
      }

      // Create container div if not exists
      if (!document.getElementById("yt-player")) {
        const div = document.createElement("div");
        div.id = "yt-player";
        document.body.appendChild(div);
      }

      ytPlayerRef.current = new window.YT.Player("yt-player", {
        width: "1",
        height: "1",
        videoId: currentSong.id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume * 100);
            e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(e.target.getDuration());
              // Start progress interval
              clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                if (ytPlayerRef.current && !seeking) {
                  setProgress(ytPlayerRef.current.getCurrentTime());
                }
              }, 500);
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              clearInterval(intervalRef.current);
            } else if (e.data === window.YT.PlayerState.ENDED) {
              clearInterval(intervalRef.current);
              nextSong();
            } else if (e.data === window.YT.PlayerState.BUFFERING) {
              setDuration(e.target.getDuration());
            }
          },
        },
      });
    };

    initPlayer();
    return () => clearInterval(intervalRef.current);
  }, [currentSong?.id]);

  // Sync play/pause
  useEffect(() => {
    if (!ytPlayerRef.current?.playVideo) return;
    if (isPlaying) {
      ytPlayerRef.current.playVideo();
    } else {
      ytPlayerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  // Sync volume
  useEffect(() => {
    if (!ytPlayerRef.current?.setVolume) return;
    ytPlayerRef.current.setVolume(volume * 100);
  }, [volume]);

  // Seek when progress changes externally
  useEffect(() => {
    if (!ytPlayerRef.current?.seekTo || seeking) return;
    const current = ytPlayerRef.current.getCurrentTime?.() || 0;
    if (Math.abs(current - progress) > 2) {
      ytPlayerRef.current.seekTo(progress, true);
    }
  }, [progress]);

  if (!currentSong) return null;

  const progressPct = duration ? (progress / duration) * 100 : 0;

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setSeekValue(val);
  };

  const handleSeekStart = () => {
    setSeeking(true);
    setSeekValue(progress);
  };

  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    setSeeking(false);
    if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(val, true);
      setProgress(val);
    }
  };

  // ── Mini Player ───────────────────────────────────────────
  return (
    <>
      {/* Mini Player Bar */}
      <div style={{
        height: "64px",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        padding: "0 12px", gap: "8px",
        position: isMobile ? "fixed" : "relative",
        bottom: isMobile ? "65px" : "auto",
        left: 0, right: 0,
        zIndex: 49,
        boxSizing: "border-box",
        overflow: "hidden",
      }}>
        {/* Song info — click to open fullscreen */}
        <div onClick={() => setShowFullScreen(true)}
          style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0, cursor: "pointer" }}>
          <img src={currentSong.thumbnail} alt=""
            style={{ width: "42px", height: "42px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
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

        {/* Progress bar */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          {!isMobile && <span style={{ fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0 }}>{formatTime(seeking ? seekValue : progress)}</span>}
          <input type="range" min="0" max={duration || 100}
            value={seeking ? seekValue : progress}
            onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd}
            style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer", minWidth: 0 }} />
          {!isMobile && <span style={{ fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0 }}>{formatTime(duration)}</span>}
        </div>

        {/* Volume — desktop only */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "16px" }}>🔊</span>
            <input type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{ width: "80px", accentColor: "var(--accent)", cursor: "pointer" }} />
          </div>
        )}
      </div>

      {/* Full Screen Player */}
      {showFullScreen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "var(--bg-primary)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Blurred background */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${currentSong.thumbnail})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(40px) brightness(0.3)",
            transform: "scale(1.1)",
          }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <button onClick={() => setShowFullScreen(false)}
                style={{ background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" }}>⌄</button>
              <span style={{ color: "white", fontWeight: 600, fontSize: "14px" }}>Now Playing</span>
              <div style={{ width: "24px" }} />
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
                value={seeking ? seekValue : progress}
                onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd}
                style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{formatTime(seeking ? seekValue : progress)}</span>
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
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>Up Next</div>
                <div style={{ overflowY: "auto", flex: 1 }}>
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
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}