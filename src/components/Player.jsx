import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import LikeButton from "./LikeButton";

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Shuffle Icon ──────────────────────────────────────────────
function ShuffleIcon({ active }) {
  return active ? (
    // Cross lines = shuffle ON
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8"/>
      <line x1="4" y1="20" x2="21" y2="3"/>
      <polyline points="21 16 21 21 16 21"/>
      <line x1="15" y1="15" x2="21" y2="21"/>
    </svg>
  ) : (
    // Parallel lines = sequential
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="18" x2="20" y2="18"/>
    </svg>
  );
}

// ── Repeat Icon ───────────────────────────────────────────────
function RepeatIcon({ mode }) {
  if (mode === "one") return <span style={{ fontSize: "16px" }}>↺¹</span>;
  return <span style={{ fontSize: "16px" }}>↺</span>;
}

// ── Full Screen Player ────────────────────────────────────────
function FullScreenPlayer({ onClose, audioRef }) {
  const {
    currentSong, isPlaying, volume, progress, duration,
    shuffle, repeat, queue,
    setIsPlaying, setProgress, setVolume,
    nextSong, prevSong, toggleShuffle, toggleRepeat,
  } = usePlayerStore();

  const progressPct = duration ? (progress / duration) * 100 : 0;

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * duration;
    setProgress(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  const removeFromQueue = (index) => {
    const newQueue = queue.filter((_, i) => i !== index);
    usePlayerStore.setState({ queue: newQueue });
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const newQueue = [...queue];
    [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
    usePlayerStore.setState({ queue: newQueue });
  };

  const moveDown = (index) => {
    if (index === queue.length - 1) return;
    const newQueue = [...queue];
    [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
    usePlayerStore.setState({ queue: newQueue });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "var(--bg-primary)",
      display: "flex", flexDirection: "column",
      animation: "fadeIn 0.2s ease",
    }}>
      {/* Background blur art */}
      {currentSong?.thumbnail && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${currentSong.thumbnail})`,
          backgroundSize: "cover", backgroundPosition: "center",
          filter: "blur(60px) brightness(0.15)",
          transform: "scale(1.2)",
          zIndex: 0,
        }} />
      )}

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px" }}>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-secondary)", fontSize: "24px", padding: "4px",
          }}>✕</button>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.05em" }}>NOW PLAYING</span>
          <div style={{ width: "32px" }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
          {/* Album art */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
            <img src={currentSong?.thumbnail} alt=""
              style={{ width: "260px", height: "260px", borderRadius: "16px", objectFit: "cover", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
          </div>

          {/* Song info */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "22px", fontWeight: 800, fontFamily: "Syne", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentSong?.title}
              </div>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {currentSong?.artist}
              </div>
            </div>
            <LikeButton song={currentSong} size={22} />
          </div>

          {/* Progress bar */}
          <div onClick={seek} style={{
            height: "4px", background: "rgba(255,255,255,0.15)",
            borderRadius: "2px", cursor: "pointer", marginBottom: "8px",
          }}>
            <div style={{
              height: "100%", width: `${progressPct}%`,
              background: "var(--accent)", borderRadius: "2px",
              transition: "width 0.1s linear",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "28px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatTime(progress)}</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <button onClick={toggleShuffle} style={{
              background: "none", border: "none", cursor: "pointer", padding: "8px",
              color: shuffle ? "var(--accent)" : "var(--text-secondary)",
              transition: "color 0.15s",
            }}>
              <ShuffleIcon active={shuffle} />
            </button>

            <button onClick={prevSong} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontSize: "28px", padding: "8px" }}>⏮</button>

            <button onClick={() => setIsPlaying(!isPlaying)} style={{
              width: "64px", height: "64px", borderRadius: "50%",
              background: "var(--accent)", border: "none", cursor: "pointer",
              color: "#fff", fontSize: "24px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(255,77,77,0.4)",
            }}>
              {isPlaying ? "⏸" : "▶"}
            </button>

            <button onClick={nextSong} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontSize: "28px", padding: "8px" }}>⏭</button>

            <button onClick={toggleRepeat} style={{
              background: "none", border: "none", cursor: "pointer", padding: "8px",
              color: repeat !== "off" ? "var(--accent)" : "var(--text-secondary)",
            }}>
              <RepeatIcon mode={repeat} />
            </button>
          </div>

          {/* Volume */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "36px" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>🔈</span>
            <input type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>🔊</span>
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: "12px" }}>
                UP NEXT — {queue.length} songs
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {queue.map((song, i) => (
                  <div key={`${song.id}-${i}`} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 10px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.04)",
                  }}>
                    <img src={song.thumbnail} alt="" style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{song.artist}</div>
                    </div>
                    {/* Reorder */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <button onClick={() => moveUp(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "10px", padding: "2px", lineHeight: 1 }}>▲</button>
                      <button onClick={() => moveDown(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "10px", padding: "2px", lineHeight: 1 }}>▼</button>
                    </div>
                    {/* Remove */}
                    <button onClick={() => removeFromQueue(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", padding: "4px" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {queue.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
              <p style={{ fontSize: "13px" }}>Queue is empty — songs will auto-add as you listen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mini Player Bar ───────────────────────────────────────────
export default function Player() {
  const audioRef = useRef(null);
  const [fullScreen, setFullScreen] = useState(false);
  const {
    currentSong, streamUrl, isPlaying, volume, progress, duration,
    shuffle, repeat, loadingStream,
    setIsPlaying, setProgress, setDuration, setVolume,
    nextSong, prevSong, toggleShuffle, toggleRepeat,
  } = usePlayerStore();

useEffect(() => {
  if (!audioRef.current || !streamUrl) return;
  audioRef.current.src = streamUrl;
  audioRef.current.volume = volume;
  const p = audioRef.current.play();
  if (p) p.catch(err => { if (err.name !== "AbortError") console.error(err); });
}, [streamUrl]);

useEffect(() => {
  if (!audioRef.current || !streamUrl) return;
  if (isPlaying) {
    const p = audioRef.current.play();
    if (p) p.catch(err => { if (err.name !== "AbortError") console.error(err); });
  } else {
    audioRef.current.pause();
  }
}, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      artwork: [{ src: currentSong.thumbnail, sizes: "512x512", type: "image/jpeg" }],
    });
    navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler("nexttrack", nextSong);
    navigator.mediaSession.setActionHandler("previoustrack", prevSong);
  }, [currentSong]);

  if (!currentSong) return null;

  const progressPct = duration ? (progress / duration) * 100 : 0;

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onEnded={nextSong}
      />

      {fullScreen && <FullScreenPlayer onClose={() => setFullScreen(false)} audioRef={audioRef} />}

      <div style={{
        height: "var(--player-height)",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        padding: "0 24px", gap: "24px",
        position: window.innerWidth <= 768 ? "fixed" : "relative",
        bottom: window.innerWidth <= 768 ? "65px" : "auto",
        left: 0, right: 0,
        zIndex: 49,
        cursor: "pointer",
        }}>
        {/* Progress bar */}
        <div onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          const newTime = pct * duration;
          setProgress(newTime);
          if (audioRef.current) audioRef.current.currentTime = newTime;
        }} style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: "3px", background: "var(--border)", cursor: "pointer",
        }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--accent)", transition: "width 0.1s linear" }} />
        </div>

        {/* Song info — click to open full screen */}
        <div onClick={() => setFullScreen(true)} style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "200px", flex: 1 }}>
          <img src={currentSong.thumbnail} alt=""
            style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{currentSong.title}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{currentSong.artist}</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1, justifyContent: "center" }}>
          <button onClick={toggleShuffle} style={{
            background: "none", border: "none", cursor: "pointer", padding: "6px",
            color: shuffle ? "var(--accent)" : "var(--text-secondary)",
          }}>
            <ShuffleIcon active={shuffle} />
          </button>

          <CtrlBtn onClick={prevSong}>⏮</CtrlBtn>

          <button onClick={() => setIsPlaying(!isPlaying)} disabled={loadingStream} style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: "var(--accent)", border: "none", cursor: "pointer",
            color: "#fff", fontSize: "18px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {loadingStream ? <span className="spin" style={{ fontSize: "14px" }}>↻</span> : isPlaying ? "⏸" : "▶"}
          </button>

          <CtrlBtn onClick={nextSong}>⏭</CtrlBtn>

          <button onClick={toggleRepeat} style={{
            background: "none", border: "none", cursor: "pointer", padding: "6px",
            color: repeat !== "off" ? "var(--accent)" : "var(--text-secondary)",
          }}>
            <RepeatIcon mode={repeat} />
          </button>
        </div>

        {/* Time + Volume */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, justifyContent: "flex-end" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            {formatTime(progress)} / {formatTime(duration)}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "16px" }}>🔊</span>
          <input type="range" min="0" max="1" step="0.01" value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: "80px", accentColor: "var(--accent)", cursor: "pointer" }} />
        </div>
      </div>
    </>
  );
}

function CtrlBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer", padding: "6px",
      color: "var(--text-secondary)", fontSize: "18px", borderRadius: "6px",
    }}>{children}</button>
  );
}