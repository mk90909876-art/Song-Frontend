// ── iOS Audio Session Manager ─────────────────────────────────
// iOS Safari suspends all JS (including YouTube IFrame) when:
//   1. Screen turns off
//   2. User switches apps
//   3. Browser goes to background
//
// Fix: Play a silent audio loop via Web Audio API.
// iOS treats any active AudioContext as an "audio session" and
// keeps the tab alive in the background as long as audio is running.
// The silent buffer uses zero CPU and zero battery.

let audioCtx = null;
let silentSource = null;
let keepAliveInterval = null;

const createSilentBuffer = (ctx) => {
  // 2 seconds of silence at 22050 Hz
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(ctx.destination);
  return source;
};

export const initAudioSession = () => {
  if (audioCtx) return; // already initialized

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    setupStateListener(audioCtx);
    silentSource = createSilentBuffer(audioCtx);
    silentSource.start(0);
    console.log("Audio session initialized, state:", audioCtx.state);
  } catch (err) {
    console.warn("AudioContext init failed:", err);
  }
};

export const resumeAudioSession = async () => {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
      console.log("Audio session resumed");
    } catch (err) {
      console.warn("AudioContext resume failed:", err);
    }
  }
};

// Auto-resume if the OS suspends it (e.g. after a phone call or notification)
const setupStateListener = (ctx) => {
  ctx.onstatechange = () => {
    if (ctx.state === "suspended") {
       console.log("Audio session suspended by OS, attempting resume...");
       resumeAudioSession();
    }
  };
};

// Call once on first user tap — iOS requires a gesture to unlock AudioContext
export const unlockAudioSession = async () => {
  initAudioSession();
  await resumeAudioSession();
};

// Handle visibility change — when app comes back to foreground
// iOS sometimes suspends the AudioContext, this wakes it back up
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    resumeAudioSession();
    // Also nudge the YT players awake
    setTimeout(() => {
      if (window._ytPlayerA?.getPlayerState?.() === 2) { // PAUSED
        // Don't auto-resume, just make sure audio context is alive
      }
    }, 300);
  }
});

// iOS-specific: page show event fires when coming back from background
window.addEventListener("pageshow", () => {
  resumeAudioSession();
});