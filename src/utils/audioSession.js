// ── Audio Session Manager ─────────────────────────────────────
// Keeps the PWA alive in the background on iOS/Android by
// maintaining an active AudioContext + a silent audio heartbeat.
//
// Also handles OS "audio ducking" recovery:
// When a notification sound plays, the OS temporarily mutes web audio.
// We detect this and automatically "nudge" the volume to force recovery.

let audioCtx = null;
let silentSource = null;
let silentAudio = null;
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
// This is the critical fix for the "notification kills sound" bug.
// By briefly changing the audio element's volume, we force the OS
// audio mixer to re-route audio output back to the speaker.
export const nudgeVolume = () => {
  const el = window._audioEl;
  if (!el || el.paused) return;

  const originalVolume = el.volume;
  // Briefly dip/bump the volume by a tiny amount
  const nudged = originalVolume > 0.01 ? originalVolume - 0.01 : originalVolume + 0.01;
  el.volume = nudged;
  // Restore original volume after a tick
  setTimeout(() => { el.volume = originalVolume; }, 50);
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

    // Silent Audio Element Heartbeat
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
  // Always nudge volume when resuming — this is the key fix
  nudgeVolume();
};

export const unlockAudioSession = async () => {
  initAudioSession();
  await resumeAudioSession();
};

// ── Visibility & Focus Recovery ───────────────────────────────
// When the app returns to foreground after a notification or app switch,
// resume the audio session AND nudge volume to recover from ducking.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    resumeAudioSession();
    // Extra nudge after a short delay (some phones delay audio recovery)
    setTimeout(nudgeVolume, 300);
    setTimeout(nudgeVolume, 1000);
  }
});

window.addEventListener("pageshow", () => {
  resumeAudioSession();
});

// Focus event — fires when returning from notification shade pull-down
window.addEventListener("focus", () => {
  resumeAudioSession();
  setTimeout(nudgeVolume, 200);
});