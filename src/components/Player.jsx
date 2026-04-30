import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { BottomSheet } from "./SongCard";

const formatTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// ── Scrolling text for long titles ───────────────────────────
const ScrollingText = ({ text, style = {} }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [dur, setDur] = useState(8);

  useEffect(() => {
    const timer = setTimeout(() => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container || !textEl) return;
      const overflowing = textEl.offsetWidth > container.offsetWidth;
      setShouldScroll(overflowing);
      if (overflowing) {
        const shift = textEl.offsetWidth + 60;
        setDur(Math.max(4, shift / 55));
        container.style.setProperty("--marquee-shift", `-${shift}px`);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div ref={containerRef} style={{ overflow: "hidden", whiteSpace: "nowrap", ...style }}>
      <span style={{ display: "inline-block", whiteSpace: "nowrap", animation: shouldScroll ? `marquee ${dur}s linear infinite` : "none" }}>
        <span ref={textRef}>{text}</span>
        {shouldScroll && <span style={{ paddingLeft: "60px" }}>{text}</span>}
      </span>
    </div>
  );
};

const Icons = {
  Play: () => (<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><polygon points="5,3 19,12 5,21"/></svg>),
  Pause: () => (<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>),
  Next: () => (<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><polygon points="5,3 15,12 5,21"/><rect x="17" y="3" width="3" height="18" rx="1"/></svg>),
  Prev: () => (<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><polygon points="19,3 9,12 19,21"/><rect x="4" y="3" width="3" height="18" rx="1"/></svg>),
  Shuffle: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>),
  Repeat: ({ mode }) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>{mode === "one" && <text x="9" y="15" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">1</text>}</svg>),
  ChevronDown: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="100%" height="100%"><polyline points="6 9 12 15 18 9"/></svg>),
  ChevronUp: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="100%" height="100%"><polyline points="6 15 12 9 18 15"/></svg>),
  Volume: ({ level }) => (<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>{level > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"/>}{level > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"/>}</svg>),
  Remove: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="100%" height="100%"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  DragHandle: () => (<svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%"><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>),
  Queue: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="100%" height="100%"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/></svg>),
};

export default function Player() {
  const {
    currentSong, isPlaying, queue, shuffle, repeat, volume,
    progress, duration, saavnUnavailable,
    setProgress, setIsPlaying,
    togglePlay, toggleShuffle, toggleRepeat, setVolume,
    nextSong, prevSong, removeFromQueue, moveQueueItem, playFromQueue,
  } = usePlayerStore();

  const [navHeight, setNavHeight] = useState(65);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isWide, setIsWide] = useState(window.innerWidth >= 1024);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [showMenu, setShowMenu] = useState(false);

  // Measure nav height
  useEffect(() => {
    const measure = () => { const nav = document.getElementById("bottom-nav"); if (nav) setNavHeight(nav.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Responsive
  useEffect(() => {
    const handle = () => { 
      setIsMobile(window.innerWidth <= 768); 
      setIsWide(window.innerWidth >= 1024);
      setIsLandscape(window.innerWidth > window.innerHeight); 
    };
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", () => setTimeout(handle, 150));
    return () => window.removeEventListener("resize", handle);
  }, []);

  if (!currentSong) return null;

  const btn = (color = "var(--text-primary)") => ({
    background: "none", border: "none", color, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%",
    transition: "0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  });

  const handleSeekStart = () => { setSeeking(true); setSeekValue(progress); };
  const handleSeekChange = (e) => setSeekValue(parseFloat(e.target.value));
  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    setSeeking(false);
    if (window._audioEl) window._audioEl.currentTime = val;
    setProgress(val);
  };

  return (
    <>
      {/* ── Mini Player ── */}
      <div data-mini-player="true" className="glass" style={{ 
        position: "fixed", 
        bottom: isMobile ? "calc(env(safe-area-inset-bottom) + 90px)" : "24px", 
        left: isMobile ? "12px" : "auto", 
        right: isMobile ? "12px" : "24px", 
        width: isMobile ? "calc(100% - 24px)" : "420px",
        zIndex: 100, 
        borderRadius: "16px",
        padding: "8px 12px",
        border: "1px solid var(--border-thin)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "var(--bg-surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div onClick={() => setShowFullScreen(true)} style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0, cursor: "pointer" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img src={currentSong.thumbnail} alt="" style={{ width: "44px", height: "44px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border-thin)" }} />
              {isPlaying && (
                <div style={{ position: "absolute", bottom: "4px", right: "4px", display: "flex", gap: "2px", alignItems: "flex-end" }}>
                  {[1, 0.6, 0.8].map((h, i) => (
                    <div key={i} style={{ width: "2px", height: `${h * 8}px`, background: "white", borderRadius: "1px", animation: `songbounce ${0.6 + i * 0.15}s ease-in-out infinite alternate` }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <ScrollingText text={currentSong.title} style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }} />
              <ScrollingText text={currentSong.artist} style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "1px", textTransform: "uppercase", letterSpacing: "0.02em" }} />
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <button onClick={togglePlay} disabled={saavnUnavailable}
              style={{ background: "white", border: "none", color: "black", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", opacity: saavnUnavailable ? 0.3 : 1 }}>
              {isPlaying ? <Icons.Pause /> : <Icons.Play />}
            </button>
            <button onClick={nextSong} style={{ ...btn("var(--text-secondary)"), width: "32px", height: "32px" }}><Icons.Next /></button>
          </div>
        </div>
        
        {/* Progress bar integrated at bottom of mini player */}
        <div style={{ height: "2px", background: "rgba(255,255,255,0.1)", marginTop: "8px", borderRadius: "1px", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${duration ? (progress / duration) * 100 : 0}%`, background: "white", transition: "width 0.4s cubic-bezier(0.23, 1, 0.32, 1)" }} />
        </div>
      </div>

      {/* ── Full Screen Player ── */}
      {showFullScreen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--bg-void)", overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ position: "fixed", inset: 0, backgroundImage: `url(${currentSong.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(80px) brightness(0.2) saturate(0)", transform: "scale(1.2)", zIndex: 0 }} />
          
          <div style={{ position: "relative", zIndex: 1, minHeight: "100%", display: "flex", flexDirection: "column", padding: isMobile ? "24px 16px 32px" : "32px", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? "12px" : "32px" }}>
              <button onClick={() => setShowFullScreen(false)} style={{ ...btn(), width: "48px", height: "48px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-thin)" }}><Icons.ChevronDown /></button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "2px", color: "var(--text-muted)" }}>Current Playback</div>
              </div>
              <button onClick={() => setShowMenu(true)} style={{ ...btn(), width: "48px", height: "48px", fontSize: "20px" }}>⋮</button>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: isWide ? "row" : "column", gap: isMobile ? "16px" : "48px", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
              {/* Art + Info */}
              <div style={{ width: isWide ? "45%" : "100%", textAlign: isWide ? "left" : "center", display: "flex", flexDirection: "column", alignItems: isWide ? "flex-start" : "center", justifyContent: "center" }}>
                <div style={{ position: "relative", marginBottom: isMobile ? "16px" : "40px" }}>
                  <img src={currentSong.thumbnail} alt="" style={{ width: isWide ? "400px" : "min(70vw, 35vh)", height: isWide ? "400px" : "min(70vw, 35vh)", maxWidth: "450px", maxHeight: "450px", borderRadius: isMobile ? "16px" : "24px", objectFit: "cover", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", border: "1px solid var(--border-thin)" }} />
                </div>
                <div style={{ width: "100%", minWidth: 0 }}>
                  <h2 className="font-syne" style={{ fontSize: isWide ? "36px" : "22px", fontWeight: 800, marginBottom: "4px", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentSong.title}</h2>
                  <p style={{ fontSize: isMobile ? "12px" : "16px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentSong.artist}</p>
                </div>
              </div>

              {/* Controls + Queue */}
              <div style={{ width: isWide ? "45%" : "100%", display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "32px" }}>
                <div className="glass" style={{ padding: isMobile ? "16px" : "32px", borderRadius: "24px" }}>
                  <ProgressBar progress={progress} duration={duration} seeking={seeking} seekValue={seekValue} onSeekStart={handleSeekStart} onSeekChange={handleSeekChange} onSeekEnd={handleSeekEnd} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{formatTime(seeking ? seekValue : progress)}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{formatTime(duration)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? "24px" : "32px", margin: isMobile ? "20px 0" : "32px 0" }}>
                    <button onClick={prevSong} style={{ ...btn(), width: "48px", height: "48px" }}><Icons.Prev /></button>
                    <button onClick={togglePlay} disabled={saavnUnavailable}
                      style={{ background: "white", color: "black", borderRadius: "50%", width: isMobile ? "64px" : "80px", height: isMobile ? "64px" : "80px", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxShadow: "0 0 40px rgba(255,255,255,0.2)" }}>
                      {isPlaying ? <Icons.Pause /> : <Icons.Play />}
                    </button>
                    <button onClick={nextSong} style={{ ...btn(), width: "48px", height: "48px" }}><Icons.Next /></button>
                  </div>

                  <div className="stitch-top" style={{ paddingTop: isMobile ? "16px" : "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button onClick={toggleShuffle} style={{ ...btn(shuffle ? "white" : "var(--text-muted)"), width: "40px", height: "40px" }}><Icons.Shuffle /></button>
                    <div style={{ flex: 1, margin: "0 24px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "16px", height: "16px", color: "var(--text-muted)" }}><Icons.Volume level={volume} /></div>
                      <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} style={{ flex: 1 }} />
                    </div>
                    <button onClick={toggleRepeat} style={{ ...btn(repeat !== "none" ? "white" : "var(--text-muted)"), width: "40px", height: "40px" }}><Icons.Repeat mode={repeat} /></button>
                  </div>
                </div>

                {isWide && (
                  <div className="glass" style={{ flex: 1, padding: "24px", borderRadius: "24px", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "300px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "2px", color: "var(--text-muted)", marginBottom: "16px" }}>Up Next</div>
                    <DraggableQueue queue={queue} removeFromQueue={removeFromQueue} moveQueueItem={moveQueueItem} playFromQueue={playFromQueue} />
                  </div>
                )}
                
                {!isWide && (
                  <button onClick={() => setShowQueue(true)} className="glass" style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "1px solid var(--border-thin)", color: "white", fontWeight: 700, fontSize: "14px" }}>
                    View Queue ({queue.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Portrait Queue Sheet ── */}
      {!isWide && showQueue && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setShowQueue(false)}>
          <div onClick={e => e.stopPropagation()} className="glass" style={{ height: "80vh", borderRadius: "32px 32px 0 0", display: "flex", flexDirection: "column", padding: "24px", background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px" }} />
            </div>
            <h3 className="font-syne" style={{ fontSize: "24px", fontWeight: 800, marginBottom: "24px" }}>Up Next</h3>
            <div className="stitch-top" style={{ flex: 1, overflowY: "auto", paddingTop: "16px" }}>
              <DraggableQueue queue={queue} removeFromQueue={removeFromQueue} moveQueueItem={moveQueueItem} playFromQueue={(i) => { playFromQueue(i); setShowQueue(false); }} />
            </div>
          </div>
        </div>
      )}

      {showMenu && currentSong && <BottomSheet song={currentSong} onClose={() => setShowMenu(false)} />}

      <style>{`
        @keyframes songbounce { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(var(--marquee-shift, -200px)); } }
      `}</style>
    </>
  );
}

const ProgressBar = ({ progress, duration, onSeekStart, onSeekChange, onSeekEnd, seekValue, seeking }) => {
  const pct = duration ? ((seeking ? seekValue : progress) / duration) * 100 : 0;
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "white", borderRadius: "2px", boxShadow: "0 0 10px rgba(255,255,255,0.5)" }} />
      </div>
      <input type="range" min="0" max={duration || 100} value={seeking ? seekValue : progress}
        onMouseDown={onSeekStart} onTouchStart={onSeekStart}
        onChange={onSeekChange} onMouseUp={onSeekEnd} onTouchEnd={onSeekEnd}
        style={{ position: "absolute", top: "-8px", left: 0, width: "100%", opacity: 0, cursor: "pointer", height: "20px", margin: 0 }} />
    </div>
  );
};

const DraggableQueue = ({ queue, removeFromQueue, moveQueueItem, playFromQueue }) => {
  if (queue.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>Queue is empty</div>;
  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {queue.map((song, i) => (
        <div key={`${song.id}-${i}`} className="stitch-bottom" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", cursor: "pointer" }} onClick={() => playFromQueue(i)}>
          <img src={song.thumbnail} alt="" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.artist}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", padding: "8px" }}>✕</button>
        </div>
      ))}
    </div>
  );
};