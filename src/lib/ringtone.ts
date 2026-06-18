/**
 * Tiny WebAudio sound helper for the phone center — a looping ringtone for
 * incoming calls and a short beep for new SMS. No audio assets to bundle.
 *
 * Browsers gate AudioContext behind a user gesture; since the superadmin has
 * already interacted with the app (login/navigation) it normally resumes fine,
 * and silently no-ops if the browser still blocks it.
 */
let ctx: AudioContext | null = null;
let ringTimer: number | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, durationMs: number, gainVal = 0.14): void {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(c.destination);
  const now = c.currentTime;
  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

/** Start a repeating two-tone ring until stopRingtone() is called. */
export function startRingtone(): void {
  stopRingtone();
  const ring = () => {
    tone(440, 400);
    window.setTimeout(() => tone(480, 400), 450);
  };
  ring();
  ringTimer = window.setInterval(ring, 2200);
}

export function stopRingtone(): void {
  if (ringTimer != null) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }
}

/** Short rising double-beep for a new inbound message. */
export function beep(): void {
  tone(880, 140, 0.12);
  window.setTimeout(() => tone(1040, 160, 0.12), 150);
}
