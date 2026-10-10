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

// ── Wake Lock ─────────────────────────────────────────────────
// Prevents Android from fully suspending the tab during playback.
// This is critical on Android 13+ where the OS aggressively kills
// background tabs that aren't holding a wake lock.
let wakeLock = null;

export const requestWakeLock = async () => {
  if (!("wakeLock" in navigator)) return;
  try {
    // Only request if we don't already hold one
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (err) {
    // Wake lock request can fail if tab is not visible — that's ok,
    // we'll re-request on visibilitychange
    console.warn("Wake lock request failed:", err.message);
  }
};

export const releaseWakeLock = async () => {
  if (wakeLock && !wakeLock.released) {
    try { await wakeLock.release(); } catch { }
    wakeLock = null;
  }
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
    try { await audioCtx.resume(); } catch { }
  }
  nudgeVolume();
};

export const unlockAudioSession = async () => {
  initAudioSession();
  await resumeAudioSession();
};

// ── Recovery Callback ─────────────────────────────────────────
// playerStore registers its nextSong function here once at init.
// This avoids a circular import: audioSession ← playerStore ← audioSession.
let _recoveryNextSong = null;
export const registerRecoveryCallback = (nextSongFn) => {
  _recoveryNextSong = nextSongFn;
};

// ── Recovery listeners ────────────────────────────────────────
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    resumeAudioSession();
    setTimeout(nudgeVolume, 300);

    // Re-acquire wake lock (it gets released when tab is hidden on some devices)
    const el = window._audioEl;
    if (el && !el.paused) {
      requestWakeLock();
    }

    // ── Auto-resume recovery ──────────────────────────────────
    // If playback stopped while backgrounded (Android killed the JS context),
    // call nextSong via the registered callback — no import needed.
    setTimeout(() => {
      try {
        const el = window._audioEl;
        if (
          _recoveryNextSong &&
          el && el.paused &&
          (el.ended || (el.duration > 0 && el.currentTime >= el.duration - 1))
        ) {
          console.log("Background recovery: auto-advancing to next song");
          _recoveryNextSong();
        }
      } catch { }
    }, 500);
  }
});
window.addEventListener("pageshow", () => resumeAudioSession());
window.addEventListener("focus", () => {
  resumeAudioSession();
  setTimeout(nudgeVolume, 200);
});