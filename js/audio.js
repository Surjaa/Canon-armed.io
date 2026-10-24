// Audio engine.
// - Music and the impact sound are the original Canon Armed files (assets/).
// - All other effects are synthesized with the Web Audio API, so they need no extra files.

const MUTE_KEY = 'canonArmed.muted';
const MUSIC_VOLUME = 0.28;
const MASTER_VOLUME = 0.9;

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
function writeMuted(value) {
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch { /* storage blocked: ignore */ }
}

const music = new Audio('assets/background_sound.mp3');
music.loop = true;
music.volume = MUSIC_VOLUME;
music.preload = 'auto';

let ctx = null;
let master = null;
let noiseBuffer = null;
let hitBuffer = null;
let muted = readMuted();
music.muted = muted;

function makeNoiseBuffer(audioCtx) {
  const length = audioCtx.sampleRate; // 1 second of white noise
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Oscillator blip with an optional pitch sweep (f -> f2) and optional low-pass.
function tone({ type = 'sine', f = 440, f2 = null, dur = 0.2, vol = 0.25, when = 0, lp = null }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  let out = gain;
  if (lp) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lp;
    gain.connect(filter);
    out = filter;
  }
  out.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Filtered noise burst with an optional filter sweep (f -> f2).
function noise({ dur = 0.2, vol = 0.3, when = 0, type = 'bandpass', f = 1200, f2 = null, q = 1 }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f, t0);
  if (f2) filter.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

export const sfx = {
  get muted() { return muted; },

  // Must be called from a user gesture (click / key press) the first time.
  async init() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_VOLUME;
      master.connect(ctx.destination);
      noiseBuffer = makeNoiseBuffer(ctx);
      try {
        const res = await fetch('assets/hit-sound.mp3');
        hitBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        console.warn('Hit sound could not be loaded:', err);
      }
    }
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  },

  toggleMute() {
    muted = !muted;
    writeMuted(muted);
    music.muted = muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02);
    return muted;
  },

  playMusic() {
    music.play().catch(() => { /* autoplay blocked until a gesture: harmless */ });
  },
  pauseMusic() { music.pause(); },
  stopMusic() { music.pause(); music.currentTime = 0; },

  shoot(spread = false) {
    tone({ type: 'square', f: spread ? 760 : 1000, f2: 180, dur: 0.16, vol: 0.06, lp: 2600 });
    noise({ dur: 0.06, vol: 0.12, type: 'highpass', f: 2500, q: 0.7 });
  },

  // Enemy takes a hit: the original hit-sound.mp3 with slight pitch variation, plus a click.
  hit() {
    if (ctx && hitBuffer && !muted) {
      const src = ctx.createBufferSource();
      src.buffer = hitBuffer;
      src.playbackRate.value = 0.9 + Math.random() * 0.25;
      const gain = ctx.createGain();
      gain.gain.value = 0.55;
      src.connect(gain);
      gain.connect(master);
      src.start();
    }
    noise({ dur: 0.05, vol: 0.1, type: 'bandpass', f: 1800, q: 2 });
  },

  explode(size = 1) {
    noise({ dur: 0.5 + size * 0.3, vol: 0.55, type: 'lowpass', f: 2200, f2: 90, q: 0.7 });
    tone({ type: 'sawtooth', f: 110, f2: 32, dur: 0.55, vol: 0.2, lp: 500 });
  },

  shieldHit() {
    tone({ type: 'triangle', f: 1500, f2: 700, dur: 0.28, vol: 0.22 });
    tone({ type: 'sine', f: 2250, f2: 1600, dur: 0.4, vol: 0.1, when: 0.03 });
  },

  playerHit() {
    tone({ type: 'sawtooth', f: 220, f2: 45, dur: 0.7, vol: 0.4, lp: 1100 });
    noise({ dur: 0.5, vol: 0.45, type: 'lowpass', f: 900, f2: 60 });
  },

  pickup() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.18, vol: 0.22, when: i * 0.055 }));
  },

  // Pitch rises with the score multiplier.
  combo(mult) {
    tone({ type: 'triangle', f: 520 + mult * 110, f2: 700 + mult * 120, dur: 0.12, vol: 0.16 });
  },

  wave() {
    [262, 330, 392].forEach((f, i) => tone({ type: 'square', f, dur: 0.16, vol: 0.08, when: i * 0.09, lp: 2000 }));
  },

  gameOver() {
    [392, 330, 262, 175].forEach((f, i) =>
      tone({ type: 'sawtooth', f, f2: f * 0.92, dur: 0.38, vol: 0.2, when: i * 0.26, lp: 1400 }));
  },

  best() {
    [659, 784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.22, vol: 0.2, when: i * 0.08 }));
  },

  click() {
    tone({ type: 'square', f: 1250, f2: 1500, dur: 0.05, vol: 0.07 });
  },
};
