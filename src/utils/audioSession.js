// ── Audio Session Manager ─────────────────────────────────────
// Keeps the PWA alive in the background on iOS/Android.
//
// CRITICAL FIX: OS "audio ducking" recovery.
// When a notification sound plays (e.g. WhatsApp), the OS temporarily
// mutes web audio. The song keeps playing but with no sound.
// We run a periodic volume nudge every 3 seconds while playing to
// continuously force the OS audio mixer to keep our audio route active.

let audioCtx = null;
let silentSource = null;
let silentAudio = null;
let nudgeInterval = null;
const SILENT_DATA = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/";

const createSilentBuffer = (ctx) => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(ctx.destination);
  return source;
};

// ── Volume Nudge ──────────────────────────────────────────────
// Programmatically does what the user does manually (change volume)
// to force the OS audio mixer to re-route audio to the speaker.
export const nudgeVolume = () => {
  const el = window._audioEl;
  if (!el || el.paused) return;

  const v = el.volume;
  // Tiny imperceptible dip and restore
  el.volume = Math.max(0.001, v - 0.01);
  requestAnimationFrame(() => { el.volume = v; });
};

// ── Periodic Nudge During Playback ────────────────────────────
// This is the key: notifications can arrive at ANY time without
// triggering visibility/focus events. By nudging every 3 seconds
// while audio is playing, we ensure recovery happens automatically.
export const startNudgeHeartbeat = () => {
  stopNudgeHeartbeat(); // clear any existing
  nudgeInterval = setInterval(() => {
    const el = window._audioEl;
    if (el && !el.paused && el.currentTime > 0) {
      nudgeVolume();
    }
  }, 3000); // every 3 seconds
};

export const stopNudgeHeartbeat = () => {
  if (nudgeInterval) {
    clearInterval(nudgeInterval);
    nudgeInterval = null;
  }
};

export const initAudioSession = () => {
  if (audioCtx) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.onstatechange = () => {
      if (audioCtx.state === "suspended") {
        resumeAudioSession();
      }
    };
    silentSource = createSilentBuffer(audioCtx);
    silentSource.start(0);

    if (!silentAudio) {
      silentAudio = new Audio(SILENT_DATA);
      silentAudio.loop = true;
      silentAudio.volume = 0.001;
      silentAudio.play().catch(() => {});
    }
  } catch (err) {
    console.warn("AudioContext init failed:", err);
  }
};

export const resumeAudioSession = async () => {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
  if (silentAudio && silentAudio.paused) {
    silentAudio.play().catch(() => {});
  }
  nudgeVolume();
};

export const unlockAudioSession = async () => {
  initAudioSession();
  await resumeAudioSession();
};

// ── Visibility & Focus Recovery ───────────────────────────────
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