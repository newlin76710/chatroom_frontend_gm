let audioContext = null;

function getAudioContext() {
  try {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      audioContext = new Ctor();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

function playTone({ type = "sine", start = 440, end = 220, gain = 0.12, duration = 0.2 }) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(start, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration);
  vol.gain.setValueAtTime(gain, now);
  vol.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(vol).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

export function unlockPusherAudio() {
  getAudioContext();
}

export function playCoinDropSound(big = false) {
  playTone({
    type: "triangle",
    start: big ? 1180 : 1750,
    end: big ? 420 : 820,
    gain: big ? 0.2 : 0.1,
    duration: big ? 0.48 : 0.16,
  });
  if (big) {
    setTimeout(() => playTone({ type: "sine", start: 880, end: 1760, gain: 0.08, duration: 0.22 }), 90);
  }
}

export function playLaunchSound() {
  playTone({ type: "square", start: 360, end: 720, gain: 0.045, duration: 0.08 });
}

export function playCollisionSound(intensity = 1) {
  if (intensity < 2.5) return;
  playTone({
    type: "triangle",
    start: 900 + Math.random() * 500,
    end: 500 + Math.random() * 300,
    gain: Math.min(0.06, 0.018 * intensity),
    duration: 0.055,
  });
}

export function closePusherAudio() {
  try {
    audioContext?.close();
  } catch {
    // no-op
  } finally {
    audioContext = null;
  }
}
