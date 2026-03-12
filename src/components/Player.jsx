import { useEffect, useRef, useState, useCallback } from "react";
import { usePlayerStore } from "../store/playerStore";

const formatTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};
const truncate = (str, n = 35) => str?.length > n ? str.slice(0, n).trimEnd() + "…" : str;

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

// ── YT API loader ─────────────────────────────────────────────
let ytApiReady = false;
let ytApiCallbacks = [];
const loadYTApi = () => {
  if (ytApiReady) return Promise.resolve();
  return new Promise(resolve => {
    ytApiCallbacks.push(resolve);
    if (!window._ytApiLoading) {
      window._ytApiLoading = true;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => {
        ytApiReady = true;
        ytApiCallbacks.forEach(cb => cb());
        ytApiCallbacks = [];
      };
    }
  });
};

// ── Draggable Queue ───────────────────────────────────────────
const DraggableQueue = ({ queue, removeFromQueue, moveQueueItem, playFromQueue }) => {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const rowRefs = useRef([]);
  const drag = useRef({ active: false, index: null, startY: 0, scrollEl: null });
  const containerRef = useRef(null);

  // Stable touch handlers via useCallback to avoid re-attaching
  const attachTouch = useCallback((el, i) => {
    if (!el || el._touchBound) return;
    el._touchBound = true;

    const onStart = (e) => {
      drag.current = {
        active: false,
        index: i,
        startY: e.touches[0].clientY,
        scrollEl: containerRef.current,
      };
    };

    const onMove = (e) => {
      const { index, startY, scrollEl } = drag.current;
      if (index === null) return;
      const dy = e.touches[0].clientY - startY;
      if (!drag.current.active && Math.abs(dy) > 8) {
        drag.current.active = true;
      }
      if (!drag.current.active) return;
      e.preventDefault();
      e.stopPropagation();

      setDraggingIdx(index);
      const touchY = e.touches[0].clientY;
      for (let j = 0; j < rowRefs.current.length; j++) {
        const rect = rowRefs.current[j]?.getBoundingClientRect();
        if (rect && touchY >= rect.top && touchY <= rect.bottom) {
          setOverIdx(j);
          break;
        }
      }
    };

    const onEnd = () => {
      const { active, index } = drag.current;
      const over = overIdx;
      if (active && index !== null && over !== null && index !== over) {
        moveQueueItem(index, over);
      }
      drag.current = { active: false, index: null, startY: 0, scrollEl: null };
      setDraggingIdx(null);
      setOverIdx(null);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
  }, [overIdx, moveQueueItem]);

  if (queue.length === 0) return (
    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>Queue is empty</div>
  );

  return (
    <div ref={containerRef} style={{ overflowY: "auto", height: "100%", WebkitOverflowScrolling: "touch" }}>
      {queue.map((song, i) => (
        <div
          key={`${song.id}-${i}`}
          ref={el => { rowRefs.current[i] = el; }}
          draggable
          onDragStart={() => setDraggingIdx(i)}
          onDragOver={e => { e.preventDefault(); setOverIdx(i); }}
          onDrop={() => { if (draggingIdx !== null && draggingIdx !== i) moveQueueItem(draggingIdx, i); setDraggingIdx(null); setOverIdx(null); }}
          onDragEnd={() => { setDraggingIdx(null); setOverIdx(null); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px", borderRadius: "10px", marginBottom: "4px",
            background: overIdx === i ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
            opacity: draggingIdx === i ? 0.4 : 1,
            transition: "background 0.1s", userSelect: "none",
          }}>
          {/* Touch drag handle */}
          <div
            ref={el => attachTouch(el, i)}
            style={{ width: "20px", height: "20px", color: "rgba(255,255,255,0.3)", flexShrink: 0, cursor: "grab", touchAction: "none" }}>
            <Icons.DragHandle />
          </div>
          {/* Song info */}
          <div onClick={() => playFromQueue(i)} style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, cursor: "pointer" }}>
            <img src={song.thumbnail} alt="" style={{ width: "38px", height: "38px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{truncate(song.title, 30)}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{truncate(song.artist, 26)}</div>
            </div>
          </div>
          <button onClick={() => removeFromQueue(i)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.7)", cursor: "pointer", width: "26px", height: "26px", padding: "4px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icons.Remove />
          </button>
        </div>
      ))}
    </div>
  );
};

// ── Progress Bar ──────────────────────────────────────────────
const ProgressBar = ({ progress, duration, onSeekStart, onSeekChange, onSeekEnd, seekValue, seeking }) => {
  const pct = duration ? ((seeking ? seekValue : progress) / duration) * 100 : 0;
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.15)", borderRadius: "2px" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: "2px", transition: seeking ? "none" : "width 0.1s" }} />
      </div>
      <input type="range" min="0" max={duration || 100} value={seeking ? seekValue : progress}
        onMouseDown={onSeekStart} onTouchStart={onSeekStart}
        onChange={onSeekChange} onMouseUp={onSeekEnd} onTouchEnd={onSeekEnd}
        style={{ position: "absolute", top: "-8px", left: 0, width: "100%", opacity: 0, cursor: "pointer", height: "20px", margin: 0 }} />
    </div>
  );
};

// ── Main Player ───────────────────────────────────────────────
export default function Player() {
  const {
    currentSong, isPlaying, queue, shuffle, repeat, volume,
    progress, duration, savedProgress,
    setDuration, setProgress, setIsPlaying,
    togglePlay, toggleShuffle, toggleRepeat, setVolume,
    nextSong, prevSong, removeFromQueue, moveQueueItem, playFromQueue,
    preloadNext,
  } = usePlayerStore();

  const intervalRef = useRef(null);
  const [navHeight, setNavHeight] = useState(65);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const restoredRef = useRef(false);

  useEffect(() => {
    const measure = () => { const nav = document.getElementById("bottom-nav"); if (nav) setNavHeight(nav.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const handle = () => { setIsMobile(window.innerWidth <= 768); setIsLandscape(window.innerWidth > window.innerHeight); };
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", () => setTimeout(handle, 150));
    return () => window.removeEventListener("resize", handle);
  }, []);

  // ── Init two YT players ─────────────────────────────────────
  useEffect(() => {
    // Create two hidden divs
    ["yt-player-a", "yt-player-b"].forEach(id => {
      if (!document.getElementById(id)) {
        const div = document.createElement("div");
        div.id = id;
        div.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;";
        document.body.appendChild(div);
      }
    });

    const makeStateHandler = (playerId) => (e) => {
      // Only handle events from the active player
      if (window._activePlayer !== playerId) return;
      const S = window.YT.PlayerState;
      const player = playerId === "primary" ? window._ytPlayerA : window._ytPlayerB;

      if (e.data === S.PLAYING) {
        usePlayerStore.getState().setIsPlaying(true);
        usePlayerStore.getState().setDuration(player.getDuration());
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          if (player?.getCurrentTime) setProgress(player.getCurrentTime());
        }, 500);

        // Restore progress once after session reload
        if (!restoredRef.current && usePlayerStore.getState().savedProgress > 3) {
          restoredRef.current = true;
          player.seekTo(usePlayerStore.getState().savedProgress, true);
        }

        // Preload next into other player
        setTimeout(() => preloadNext(), 2000);

        const song = usePlayerStore.getState().currentSong;
        if ("mediaSession" in navigator && song) {
          navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, artwork: [{ src: song.thumbnail, sizes: "480x360", type: "image/jpeg" }] });
          navigator.mediaSession.playbackState = "playing";
          navigator.mediaSession.setActionHandler("play", () => { player?.playVideo(); usePlayerStore.getState().setIsPlaying(true); });
          navigator.mediaSession.setActionHandler("pause", () => { player?.pauseVideo(); usePlayerStore.getState().setIsPlaying(false); });
          navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().nextSong());
          navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().prevSong());
        }
      } else if (e.data === S.PAUSED) {
        usePlayerStore.getState().setIsPlaying(false);
        clearInterval(intervalRef.current);
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
      } else if (e.data === S.ENDED) {
        clearInterval(intervalRef.current);
        usePlayerStore.getState().nextSong();
      }
    };

    loadYTApi().then(() => {
      window._activePlayer = "primary";

      window._ytPlayerA = new window.YT.Player("yt-player-a", {
        width: "1", height: "1",
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            window._ytPlayerA = e.target;
            e.target.setVolume(usePlayerStore.getState().volume * 100);
            const song = usePlayerStore.getState().currentSong;
            if (song) e.target.loadVideoById(song.id);
          },
          onStateChange: makeStateHandler("primary"),
        },
      });

      window._ytPlayerB = new window.YT.Player("yt-player-b", {
        width: "1", height: "1",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            window._ytPlayerB = e.target;
            e.target.setVolume(0); // keep silent until active
          },
          onStateChange: makeStateHandler("secondary"),
        },
      });
    });

    return () => clearInterval(intervalRef.current);
  }, []);

  // When active player switches to secondary, set volumes correctly
  useEffect(() => {
    if (!window._ytPlayerA || !window._ytPlayerB) return;
    const vol = usePlayerStore.getState().volume * 100;
    if (window._activePlayer === "primary") {
      window._ytPlayerA?.setVolume?.(vol);
      window._ytPlayerB?.setVolume?.(0);
    } else {
      window._ytPlayerB?.setVolume?.(vol);
      window._ytPlayerA?.setVolume?.(0);
    }
  }, [isPlaying]);

  if (!currentSong) return null;

  const activePlayer = () => window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;

  const handleSeekStart = () => { setSeeking(true); setSeekValue(progress); };
  const handleSeekChange = (e) => setSeekValue(parseFloat(e.target.value));
  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    setSeeking(false);
    activePlayer()?.seekTo?.(val, true);
    setProgress(val);
  };

  const btn = (color = "rgba(255,255,255,0.7)") => ({
    background: "none", border: "none", color, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%",
  });

  const isWide = !isMobile || isLandscape;

  const FullScreenPlayer = () => (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${currentSong.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) brightness(0.25) saturate(1.5)", transform: "scale(1.2)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))" }} />

      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px", flexShrink: 0 }}>
          <button onClick={() => setShowFullScreen(false)} style={{ ...btn("white"), width: "36px", height: "36px" }}><Icons.ChevronDown /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px" }}>Now Playing</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: 600, marginTop: "2px" }}>{truncate(currentSong.artist, 30)}</div>
          </div>
          <div style={{ width: "36px" }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", flexDirection: isWide ? "row" : "column", gap: isWide ? "24px" : 0, padding: isWide ? "8px 28px 20px" : "0 24px 16px", overflow: "hidden", minHeight: 0 }}>

          {/* Left: Controls */}
          <div style={{ flex: isWide ? "0 0 calc(50% - 12px)" : "none", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0, overflow: isWide ? "visible" : "auto" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <img src={currentSong.thumbnail} alt="" style={{ width: isWide ? "min(200px, 28vw)" : "min(220px, 58vw)", height: isWide ? "min(200px, 28vw)" : "min(220px, 58vw)", borderRadius: "16px", objectFit: "cover", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isWide ? "16px" : "18px", fontWeight: 700, color: "white", marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentSong.title}</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentSong.artist}</div>
              </div>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <ProgressBar progress={progress} duration={duration} seeking={seeking} seekValue={seekValue} onSeekStart={handleSeekStart} onSeekChange={handleSeekChange} onSeekEnd={handleSeekEnd} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{formatTime(seeking ? seekValue : progress)}</span>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{formatTime(duration)}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "12px" }}>
              <button onClick={prevSong} style={{ ...btn("white"), width: "40px", height: "40px" }}><Icons.Prev /></button>
              <button onClick={togglePlay} style={{ background: "white", border: "none", color: "black", borderRadius: "50%", width: "60px", height: "60px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "17px", boxShadow: "0 8px 24px rgba(255,255,255,0.2)" }}>
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>
              <button onClick={nextSong} style={{ ...btn("white"), width: "40px", height: "40px" }}><Icons.Next /></button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <button onClick={toggleShuffle} style={{ ...btn(shuffle ? "var(--accent)" : "rgba(255,255,255,0.5)"), width: "34px", height: "34px" }}><Icons.Shuffle /></button>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, margin: "0 10px" }}>
                <div style={{ width: "18px", height: "18px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}><Icons.Volume level={volume} /></div>
                <div style={{ flex: 1, position: "relative" }}>
                  <div style={{ height: "3px", background: "rgba(255,255,255,0.15)", borderRadius: "2px" }}>
                    <div style={{ height: "100%", width: `${volume * 100}%`, background: "rgba(255,255,255,0.7)", borderRadius: "2px" }} />
                  </div>
                  <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))}
                    style={{ position: "absolute", top: "-8px", left: 0, width: "100%", opacity: 0, cursor: "pointer", height: "20px", margin: 0 }} />
                </div>
              </div>
              <button onClick={toggleRepeat} style={{ ...btn(repeat !== "none" ? "var(--accent)" : "rgba(255,255,255,0.5)"), width: "34px", height: "34px" }}><Icons.Repeat mode={repeat} /></button>
            </div>

            {!isWide && (
              <button onClick={() => setShowQueue(!showQueue)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "rgba(255,255,255,0.1)", border: "none", color: "white", borderRadius: "20px", padding: "8px 20px", cursor: "pointer", fontSize: "13px", fontWeight: 600, width: "100%" }}>
                <div style={{ width: "16px", height: "16px" }}><Icons.Queue /></div>
                Up Next {queue.length > 0 && `(${queue.length})`}
                <div style={{ width: "14px", height: "14px" }}>{showQueue ? <Icons.ChevronDown /> : <Icons.ChevronUp />}</div>
              </button>
            )}
          </div>

          {/* Right: Queue */}
          {(isWide || showQueue) && (
            <div style={{ flex: isWide ? "0 0 calc(50% - 12px)" : "none", borderLeft: isWide ? "1px solid rgba(255,255,255,0.1)" : "none", paddingLeft: isWide ? "24px" : "0", paddingTop: !isWide ? "12px" : "0", display: "flex", flexDirection: "column", minHeight: 0, maxHeight: isWide ? "100%" : "260px", overflow: "hidden" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", flexShrink: 0 }}>
                Up Next ({queue.length})
              </div>
              <DraggableQueue queue={queue} removeFromQueue={removeFromQueue} moveQueueItem={moveQueueItem} playFromQueue={playFromQueue} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mini player */}
      <div style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", position: isMobile ? "fixed" : "relative", bottom: isMobile ? `${navHeight}px` : "auto", left: 0, right: 0, zIndex: 49, boxSizing: "border-box", width: "100%" }}>
        {/* Progress line */}
        <div style={{ height: "3px", background: "var(--border)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${duration ? (progress / duration) * 100 : 0}%`, background: "var(--accent)", transition: "width 0.5s linear" }} />
          <input type="range" min="0" max={duration || 100} value={seeking ? seekValue : progress}
            onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
            onChange={handleSeekChange} onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd}
            style={{ position: "absolute", top: "-8px", left: 0, width: "100%", opacity: 0, cursor: "pointer", height: "20px", margin: 0 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px" }}>
          <div onClick={() => setShowFullScreen(true)} style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0, cursor: "pointer" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img src={currentSong.thumbnail} alt="" style={{ width: "42px", height: "42px", borderRadius: "8px", objectFit: "cover", display: "block" }} />
              {isPlaying && (
                <div style={{ position: "absolute", bottom: "3px", right: "3px", display: "flex", gap: "2px", alignItems: "flex-end" }}>
                  {[1, 0.6, 0.8].map((h, i) => (
                    <div key={i} style={{ width: "3px", height: `${h * 10}px`, background: "var(--accent)", borderRadius: "1px", animation: `songbounce ${0.6 + i * 0.15}s ease-in-out infinite alternate` }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{truncate(currentSong.title, 38)}</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{truncate(currentSong.artist, 32)}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {!isMobile && <button onClick={prevSong} style={{ ...btn("var(--text-secondary)"), width: "36px", height: "36px" }}><Icons.Prev /></button>}
            <button onClick={togglePlay} style={{ background: "var(--accent)", border: "none", color: "white", borderRadius: "50%", width: "38px", height: "38px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", flexShrink: 0 }}>
              {isPlaying ? <Icons.Pause /> : <Icons.Play />}
            </button>
            <button onClick={nextSong} style={{ ...btn("var(--text-secondary)"), width: "36px", height: "36px" }}><Icons.Next /></button>
          </div>

          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <div style={{ width: "16px", height: "16px", color: "var(--text-secondary)" }}><Icons.Volume level={volume} /></div>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))}
                style={{ width: "80px", accentColor: "var(--accent)", cursor: "pointer" }} />
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatTime(progress)} / {formatTime(duration)}</span>
            </div>
          )}
        </div>
      </div>

      {showFullScreen && <FullScreenPlayer />}
      <style>{`@keyframes songbounce { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }`}</style>
    </>
  );
}