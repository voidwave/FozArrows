// Tiny WebAudio synth: no audio files needed.
let ctx = null;
let master = null;
export const audio = { enabled: true };

function ensure() {
  if (!audio.enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

function tone(freq, { type = 'sine', dur = 0.15, vol = 0.3, at = 0, slide = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, from = 800, to = 4000, q = 1.2, at = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + at;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export const sfx = {
  free(combo) {
    const n = SCALE[Math.min(combo, SCALE.length - 1)];
    tone(523.25 * Math.pow(2, n / 12), { type: 'triangle', dur: 0.18, vol: 0.28 });
    tone(1046.5 * Math.pow(2, n / 12), { type: 'sine', dur: 0.12, vol: 0.08, at: 0.02 });
    noise({ dur: 0.22, vol: 0.12, from: 600, to: 5000 });
  },
  block() {
    tone(160, { type: 'sine', dur: 0.22, vol: 0.45, slide: 0.45 });
    tone(90, { type: 'square', dur: 0.12, vol: 0.06 });
    noise({ dur: 0.1, vol: 0.15, from: 400, to: 200, q: 0.8 });
  },
  hint() {
    tone(880, { dur: 0.3, vol: 0.15 });
    tone(1318.5, { dur: 0.4, vol: 0.1, at: 0.08 });
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone(f, { type: 'triangle', dur: 0.35, vol: 0.22, at: i * 0.09 }));
    noise({ dur: 0.6, vol: 0.08, from: 2000, to: 8000, at: 0.3 });
  },
  lose() {
    [392, 349.23, 293.66, 220].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.3, vol: 0.2, at: i * 0.12 }));
  },
  click() {
    tone(660, { type: 'sine', dur: 0.06, vol: 0.12 });
  },
  boom() {
    tone(110, { type: 'sine', dur: 0.5, vol: 0.55, slide: 0.3 });
    tone(55, { type: 'triangle', dur: 0.4, vol: 0.3, slide: 0.5 });
    noise({ dur: 0.55, vol: 0.4, from: 1200, to: 120, q: 0.5 });
  },
  crack() {
    noise({ dur: 0.09, vol: 0.3, from: 6000, to: 3000, q: 2 });
    tone(2400, { type: 'square', dur: 0.05, vol: 0.05 });
    tone(1800, { type: 'triangle', dur: 0.12, vol: 0.1, at: 0.03 });
  },
  gold() {
    tone(1567.98, { type: 'triangle', dur: 0.25, vol: 0.14, at: 0.04 });
    tone(2093, { type: 'sine', dur: 0.35, vol: 0.1, at: 0.1 });
  },
  fever() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) =>
      tone(f, { type: 'square', dur: 0.12, vol: 0.07, at: i * 0.05 }));
    noise({ dur: 0.5, vol: 0.12, from: 500, to: 6000, at: 0.1 });
  },
  star(i) {
    tone(783.99 * Math.pow(2, (i * 4) / 12), { type: 'triangle', dur: 0.25, vol: 0.2 });
  },
};
