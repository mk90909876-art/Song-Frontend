import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { BottomSheet } from "./SongCard";
import { unlockAudioSession, resumeAudioSession } from "../utils/audioSession";

const formatTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

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
      window.onYouTubeIframeAPIReady = () => { ytApiReady = true; ytApiCallbacks.forEach(cb => cb()); ytApiCallbacks = []; };
    }
  });
};

// ── Draggable Queue ───────────────────────────────────────────
const DraggableQueue = ({ queue, removeFromQueue, moveQueueItem, playFromQueue }) => {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [liftedIdx, setLiftedIdx] = useState(null);
  const rowRefs = useRef([]);
  const containerRef = useRef(null);
  const state = useRef({ active: false, index: null, startY: 0, holdTimer: null, overIdx: null });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e) => {
      if (!state.current.active) {
        const dy = Math.abs(e.touches[0].clientY - state.current.startY);
        if (dy > 8) { clearTimeout(state.current.holdTimer); state.current.index = null; }
        return;
      }
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      for (let j = 0; j < rowRefs.current.length; j++) {
        const rect = rowRefs.current[j]?.getBoundingClientRect();
        if (rect && touchY >= rect.top && touchY <= rect.bottom) {
          state.current.overIdx = j;
          setOverIdx(j);
          break;
        }
      }
    };
    container.addEventListener("touchmove", onMove, { passive: false });
    return () => container.removeEventListener("touchmove", onMove);
  }, [queue.length]);

  const removeTappedRef = useRef(false);

  const onTouchStart = (e, i) => {
    removeTappedRef.current = false;
    state.current = { active: false, index: i, startY: e.touches[0].clientY, holdTimer: null, overIdx: null };
    state.current.holdTimer = setTimeout(() => {
      state.current.active = true;
      setDraggingIdx(i);
      setLiftedIdx(i);
    }, 400);
  };

  const onTouchEnd = () => {
    clearTimeout(state.current.holdTimer);
    if (removeTappedRef.current) {
      state.current = { active: false, index: null, startY: 0, holdTimer: null, overIdx: null };
      setDraggingIdx(null); setOverIdx(null); setLiftedIdx(null);
      removeTappedRef.current = false;
      return;
    }
    const { active, index, overIdx: over } = state.current;
    if (!active) { if (index !== null) playFromQueue(index); }
    else if (index !== null && over !== null && index !== over) moveQueueItem(index, over);
    state.current = { active: false, index: null, startY: 0, holdTimer: null, overIdx: null };
    setDraggingIdx(null); setOverIdx(null); setLiftedIdx(null);
  };

  const onDragStart = (i) => setDraggingIdx(i);
  const onDragOver = (e, i) => { e.preventDefault(); setOverIdx(i); };
  const onDrop = (i) => { if (draggingIdx !== null && draggingIdx !== i) moveQueueItem(draggingIdx, i); setDraggingIdx(null); setOverIdx(null); };

  if (queue.length === 0) return (
    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>Queue is empty</div>
  );

  return (
    <div ref={containerRef} style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
      {queue.map((song, i) => {
        const isLifted = liftedIdx === i;
        const isOver = overIdx === i && draggingIdx !== i;
        return (
          <div key={`${song.id}-${i}`} ref={el => { rowRefs.current[i] = el; }}
            draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)}
            onDrop={() => onDrop(i)} onDragEnd={() => { setDraggingIdx(null); setOverIdx(null); }}
            onTouchStart={e => onTouchStart(e, i)} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
            style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "8px",
              borderRadius: "10px", marginBottom: "4px",
              background: isOver ? "rgba(255,255,255,0.2)" : isLifted ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
              opacity: draggingIdx === i && !isLifted ? 0.3 : 1,
              transform: isLifted ? "scale(1.02)" : "scale(1)",
              boxShadow: isLifted ? "0 8px 24px rgba(0,0,0,0.5)" : "none",
              transition: "background 0.1s, transform 0.15s, box-shadow 0.15s",
              userSelect: "none",
            }}>
            <div style={{ width: "20px", height: "20px", flexShrink: 0, color: isLifted ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)", transition: "color 0.2s" }}>
              <Icons.DragHandle />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, overflow: "hidden" }}>
              <img src={song.thumbnail} alt="" style={{ width: "38px", height: "38px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                <ScrollingText text={song.title} style={{ fontSize: "13px", fontWeight: 600, color: "white" }} />
                <ScrollingText text={song.artist} style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }} />
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); removeFromQueue(i); }}
              onTouchStart={e => { e.stopPropagation(); removeTappedRef.current = true; }}
              onTouchEnd={e => { e.stopPropagation(); clearTimeout(state.current.holdTimer); removeFromQueue(i); }}
              style={{ background: "none", border: "none", color: "rgba(255,100,100,0.7)", cursor: "pointer", width: "36px", height: "36px", padding: "4px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icons.Remove />
            </button>
          </div>
        );
      })}
    </div>
  );
};

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
  const [showMenu, setShowMenu] = useState(false);
  const restoredRef = useRef(false);
  const silentAudioRef = useRef(null);

  useEffect(() => {
    const measure = () => { const nav = document.getElementById("bottom-nav"); if (nav) setNavHeight(nav.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // iOS requires a user gesture to start audio — resume pending Saavn audio on any tap
  useEffect(() => {
    const unlock = () => {
      if (window._saavnPending && window._audioEl?.src) {
        window._audioEl.play().then(() => {
          window._saavnPending = false;
          console.log("Saavn audio unlocked by gesture");
        }).catch(() => {});
      }
    };
    document.addEventListener("touchstart", unlock, { once: false, passive: true });
    document.addEventListener("click", unlock, { once: false });
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  useEffect(() => {
    const handle = () => { setIsMobile(window.innerWidth <= 768); setIsLandscape(window.innerWidth > window.innerHeight); };
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", () => setTimeout(handle, 150));
    return () => { window.removeEventListener("resize", handle); };
  }, []);

  useEffect(() => {
    ["yt-player-a", "yt-player-b"].forEach(id => {
      if (!document.getElementById(id)) {
        const div = document.createElement("div");
        div.id = id;
        div.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;";
        document.body.appendChild(div);
      }
    });

    const makeStateHandler = (playerId) => (e) => {
      if (window._activePlayer !== playerId) return;
      const S = window.YT.PlayerState;
      const player = playerId === "primary" ? window._ytPlayerA : window._ytPlayerB;

      if (e.data === S.PLAYING) {
        resumeAudioSession(); // keep iOS audio session alive
        usePlayerStore.getState().setIsPlaying(true);
        usePlayerStore.getState().setDuration(player.getDuration());
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          if (player?.getCurrentTime) usePlayerStore.getState().setProgress(player.getCurrentTime());
        }, 500);
        if (!restoredRef.current && usePlayerStore.getState().savedProgress > 3) {
          restoredRef.current = true;
          player.seekTo(usePlayerStore.getState().savedProgress, true);
        }
        setTimeout(() => preloadNext(), 2000);
        const song = usePlayerStore.getState().currentSong;
        if ("mediaSession" in navigator && song) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            artwork: [{ src: song.thumbnail, sizes: "480x360", type: "image/jpeg" }],
          });
          navigator.mediaSession.playbackState = "playing";
          navigator.mediaSession.setActionHandler("play", () => {
            if (window._saavnActive && window._audioEl?.src) window._audioEl.play();
            else player?.playVideo?.();
            usePlayerStore.getState().setIsPlaying(true);
          });
          navigator.mediaSession.setActionHandler("pause", () => {
            if (window._saavnActive && window._audioEl?.src) window._audioEl.pause();
            else player?.pauseVideo?.();
            usePlayerStore.getState().setIsPlaying(false);
          });
          navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().nextSong());
          navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().prevSong());
          navigator.mediaSession.setActionHandler("seekto", (e) => {
            if (window._saavnActive && window._audioEl?.src) window._audioEl.currentTime = e.seekTime;
            else player?.seekTo?.(e.seekTime, true);
            usePlayerStore.getState().setProgress(e.seekTime);
          });
        }
      } else if (e.data === S.PAUSED) {
        usePlayerStore.getState().setIsPlaying(false);
        clearInterval(intervalRef.current);
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
          onReady: (e) => { window._ytPlayerB = e.target; e.target.setVolume(0); },
          onStateChange: makeStateHandler("secondary"),
        },
      });
    });
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Background playback: silent audio keeps Chrome audio session alive ──
  useEffect(() => {
    // Create a tiny silent WAV as a Blob
    const sampleRate = 8000;
    const numSamples = sampleRate; // 1 second
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + numSamples * 2, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeStr(36, 'data'); view.setUint32(40, numSamples * 2, true);
    // samples are already 0 (silent)
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.01; // near-silent
    silentAudioRef.current = audio;

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, []);

  // Start/stop silent audio with playback state
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;
    if (isPlaying && currentSong) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

  // Re-trigger YouTube playback when page becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && usePlayerStore.getState().isPlaying) {
        const player = window._activePlayer === 'primary' ? window._ytPlayerA : window._ytPlayerB;
        // YouTube may have paused — try to resume
        setTimeout(() => {
          if (player?.getPlayerState && player.getPlayerState() !== 1) {
            player.playVideo?.();
          }
        }, 300);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!currentSong) return null;

  const activePlayer = () => window._activePlayer === "primary" ? window._ytPlayerA : window._ytPlayerB;
  const handleSeekStart = () => { setSeeking(true); setSeekValue(progress); };
  const handleSeekChange = (e) => setSeekValue(parseFloat(e.target.value));
  const handleSeekEnd = (e) => {
    const val = parseFloat(e.target.value);
    setSeeking(false);
    if (window._saavnActive && window._audioEl?.src) {
      window._audioEl.currentTime = val;
    } else {
      activePlayer()?.seekTo?.(val, true);
    }
    setProgress(val);
  };

  const btn = (color = "rgba(255,255,255,0.7)") => ({
    background: "none", border: "none", color, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%",
  });

  // Wide = desktop OR landscape phone
  const isWide = !isMobile || isLandscape;

  return (
    <>
      {/* ── Mini Player ── */}
      <div data-mini-player="true" style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", position: isMobile ? "fixed" : "relative", bottom: isMobile ? `${navHeight}px` : "auto", left: 0, right: 0, zIndex: 49, boxSizing: "border-box", width: "100%" }}>
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <ScrollingText text={currentSong.title} style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }} />
              <ScrollingText text={currentSong.artist} style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {!isMobile && <button onClick={prevSong} style={{ ...btn("var(--text-secondary)"), width: "36px", height: "36px" }}><Icons.Prev /></button>}
            <button onClick={() => { unlockAudioSession(); togglePlay(); }} style={{ background: "var(--accent)", border: "none", color: "white", borderRadius: "50%", width: "38px", height: "38px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", flexShrink: 0 }}>
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

      {/* ── Full Screen Player ── */}
      {showFullScreen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden" }}>
          {/* Blurred background */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${currentSong.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) brightness(0.25) saturate(1.5)", transform: "scale(1.2)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))" }} />

          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px", flexShrink: 0 }}>
              <button onClick={(e) => { e.stopPropagation(); setShowFullScreen(false); }} style={{ ...btn("white"), width: "44px", height: "44px", touchAction: "manipulation", padding: "10px" }}><Icons.ChevronDown /></button>
              <div style={{ textAlign: "center", minWidth: 0, flex: 1, margin: "0 12px" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px" }}>Now Playing</div>
                <ScrollingText text={currentSong.artist} style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: 600, marginTop: "2px" }} />
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(true); }} style={{ ...btn("white"), width: "44px", height: "44px", touchAction: "manipulation", padding: "10px", fontSize: "20px", letterSpacing: "2px" }}>⋮</button>
            </div>

            {/* Body — side by side on wide, stacked on mobile portrait */}
            <div style={{
              flex: 1, minHeight: 0,
              width: "100%",
              display: "flex",
              flexDirection: isWide ? "row" : "column",
              overflow: "hidden",
            }}>
              {/* ── Left: Player controls ── */}
              <div style={{
                width: isWide ? "50%" : "100%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "12px 36px",
                overflow: isWide ? "visible" : "auto",
                boxSizing: "border-box",
              }}>
                {/* Album art */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                  <img src={currentSong.thumbnail} alt=""
                    style={{
                      width: isWide ? "min(280px, 34vw)" : "min(240px, 60vw)",
                      height: isWide ? "min(280px, 34vw)" : "min(240px, 60vw)",
                      borderRadius: "16px", objectFit: "cover",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                    }} />
                </div>

                {/* Title / artist */}
                <div style={{ marginBottom: "12px" }}>
                  <ScrollingText text={currentSong.title} style={{ fontSize: isWide ? "17px" : "19px", fontWeight: 700, color: "white", marginBottom: "4px" }} />
                  <ScrollingText text={currentSong.artist} style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }} />
                </div>

                {/* Progress */}
                <div style={{ marginBottom: "10px" }}>
                  <ProgressBar progress={progress} duration={duration} seeking={seeking} seekValue={seekValue} onSeekStart={handleSeekStart} onSeekChange={handleSeekChange} onSeekEnd={handleSeekEnd} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{formatTime(seeking ? seekValue : progress)}</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "14px" }}>
                  <button onClick={prevSong} style={{ ...btn("white"), width: "40px", height: "40px" }}><Icons.Prev /></button>
                  <button onClick={() => { unlockAudioSession(); togglePlay(); }} style={{ background: "white", border: "none", color: "black", borderRadius: "50%", width: "62px", height: "62px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "17px", boxShadow: "0 8px 24px rgba(255,255,255,0.2)" }}>
                    {isPlaying ? <Icons.Pause /> : <Icons.Play />}
                  </button>
                  <button onClick={nextSong} style={{ ...btn("white"), width: "40px", height: "40px" }}><Icons.Next /></button>
                </div>

                {/* Shuffle / Volume / Repeat */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <button onClick={toggleShuffle} style={{ ...btn(shuffle ? "var(--accent)" : "rgba(255,255,255,0.4)"), width: "32px", height: "32px" }}><Icons.Shuffle /></button>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, margin: "0 12px" }}>
                    <div style={{ width: "16px", height: "16px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}><Icons.Volume level={volume} /></div>
                    <div style={{ flex: 1, position: "relative" }}>
                      <div style={{ height: "3px", background: "rgba(255,255,255,0.15)", borderRadius: "2px" }}>
                        <div style={{ height: "100%", width: `${volume * 100}%`, background: "rgba(255,255,255,0.7)", borderRadius: "2px" }} />
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))}
                        style={{ position: "absolute", top: "-8px", left: 0, width: "100%", opacity: 0, cursor: "pointer", height: "20px", margin: 0 }} />
                    </div>
                  </div>
                  <button onClick={toggleRepeat} style={{ ...btn(repeat !== "none" ? "var(--accent)" : "rgba(255,255,255,0.4)"), width: "32px", height: "32px" }}><Icons.Repeat mode={repeat} /></button>
                </div>

                {/* Up Next button (mobile portrait only) */}
                {!isWide && (
                  <button onClick={() => setShowQueue(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "rgba(255,255,255,0.1)", border: "none", color: "white", borderRadius: "20px", padding: "8px 20px", cursor: "pointer", fontSize: "13px", fontWeight: 600, width: "100%" }}>
                    <div style={{ width: "16px", height: "16px" }}><Icons.Queue /></div>
                    Up Next {queue.length > 0 && `(${queue.length})`}
                    <div style={{ width: "14px", height: "14px" }}><Icons.ChevronUp /></div>
                  </button>
                )}
              </div>

              {/* ── Right: Queue (desktop wide) ── */}
              {isWide && (
                <div style={{
                  width: "50%", flexShrink: 0,
                  borderLeft: "1px solid rgba(255,255,255,0.1)",
                  display: "flex", flexDirection: "column",
                  minHeight: 0, padding: "16px 24px",
                  boxSizing: "border-box", overflow: "hidden",
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", flexShrink: 0 }}>
                    Up Next ({queue.length})
                  </div>
                  <DraggableQueue queue={queue} removeFromQueue={removeFromQueue} moveQueueItem={moveQueueItem} playFromQueue={playFromQueue} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Portrait Queue Full-Screen Overlay ── */}
      {!isWide && showQueue && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
          justifyContent: "flex-end",
          animation: "fadeIn 0.2s ease",
        }} onClick={() => setShowQueue(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#1a1a1a",
              borderRadius: "20px 20px 0 0",
              display: "flex", flexDirection: "column",
              height: "82vh",
              overflow: "hidden", // clips to border-radius
              animation: "slideUp 0.3s cubic-bezier(0.32,0.72,0,1)",
            }}>
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px", flexShrink: 0 }}>
              <div style={{ width: "36px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px" }} />
            </div>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 12px", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>Up Next</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{queue.length} songs</div>
              </div>
              <button
                onClick={() => setShowQueue(false)}
                style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icons.ChevronDown />
              </button>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

            {/* Queue list — overflow auto here so DraggableQueue can scroll */}
            <div style={{ flex: 1, minHeight: 0, padding: "8px 16px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
              <DraggableQueue queue={queue} removeFromQueue={removeFromQueue} moveQueueItem={moveQueueItem} playFromQueue={(i) => { playFromQueue(i); setShowQueue(false); }} />
            </div>
          </div>
        </div>
      )}

      {/* 3-dot menu bottom sheet */}
      {showMenu && currentSong && <BottomSheet song={currentSong} onClose={() => setShowMenu(false)} />}

      <style>{`
        @keyframes songbounce { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(var(--marquee-shift, -200px)); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}