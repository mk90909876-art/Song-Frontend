// ── Audio Session Manager ─────────────────────────────────────
// Keeps the PWA alive in the background via Web Audio API.
//
// IMPORTANT: We ONLY use AudioContext (not a second <audio> element)
// because a second Audio element would STEAL the MediaSession from
// the real music player, breaking notification controls.

let audioCtx = null;
let silentSource = null;

const createSilentBuffer = (ctx) => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(ctx.destination);
  return source;
};

// ── Volume Nudge (anti-duck) ──────────────────────────────────
export const nudgeVolume = () => {
  const el = window._audioEl;
  if (!el || el.paused) return;
  const v = el.volume;
  el.volume = Math.max(0.001, v - 0.01);
  setTimeout(() => { el.volume = v; }, 50);
};

// ── Periodic Nudge During Playback ────────────────────────────
let nudgeInterval = null;
export const startNudgeHeartbeat = () => {
  stopNudgeHeartbeat();
  nudgeInterval = setInterval(() => {
    const el = window._audioEl;
    if (el && !el.paused && el.currentTime > 0) nudgeVolume();
  }, 3000);
};
export const stopNudgeHeartbeat = () => {
  if (nudgeInterval) { clearInterval(nudgeInterval); nudgeInterval = null; }
};

export const initAudioSession = () => {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.onstatechange = () => {
      if (audioCtx.state === "suspended") resumeAudioSession();
    };
    silentSource = createSilentBuffer(audioCtx);
    silentSource.start(0);
  } catch (err) {
    console.warn("AudioContext init failed:", err);
  }
};

export const resumeAudioSession = async () => {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
  nudgeVolume();
};

export const unlockAudioSession = async () => {
  initAudioSession();
  await resumeAudioSession();
};

// ── Recovery listeners ────────────────────────────────────────
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    resumeAudioSession();
    setTimeout(nudgeVolume, 300);
  }
});
window.addEventListener("pageshow", () => resumeAudioSession());
window.addEventListener("focus", () => {
  resumeAudioSession();
  setTimeout(nudgeVolume, 200);
});