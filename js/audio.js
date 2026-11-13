// The synthesised drum kit (Web Audio) and the spoken 1-2-3-4 count.

// ---------- audio ----------
let audio = null,
  master = null,
  noiseBuf = null,
  openHat = null;
function ensureAudio() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      appStatus("Sound isn't available in this browser.");
      return false;
    }
    try {
      audio = new AC();
    } catch {
      audio = null;
      appStatus("Sound couldn't start in this browser.");
      return false;
    }
    const comp = audio.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    master = audio.createGain();
    master.gain.value = 0.8;
    master.connect(comp).connect(audio.destination);
    noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return true;
}
function appStatus(t, kind) {
  const el = $('appStatus');
  if (!el) return;
  el.textContent = t;
  el.classList.toggle('info', kind === 'info');
}
const filt = (type, f, q) => {
  const b = audio.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  if (q) b.Q.value = q;
  return b;
};
function env(t, peak, dur) {
  const g = audio.createGain();
  g.gain.setValueAtTime(Math.max(peak, 0.0002), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master);
  return g;
}
function noise(t, dur, vel, filters) {
  const src = audio.createBufferSource();
  src.buffer = noiseBuf;
  let node = src;
  filters.forEach((f) => {
    node.connect(f);
    node = f;
  });
  const g = env(t, vel, dur);
  node.connect(g);
  src.start(t);
  src.stop(t + dur + 0.03);
  return g;
}
function tone(t, type, f0, f1, dur, vel, sweep = 0.6) {
  const o = audio.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * sweep);
  o.connect(env(t, vel, dur));
  o.start(t);
  o.stop(t + dur + 0.03);
}
function chokeHat(t) {
  if (!openHat) return;
  const p = openHat.gain;
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else p.cancelScheduledValues(t);
  p.setTargetAtTime(0.0001, t, 0.01);
  openHat = null;
}
function triggerSound(id, art, t) {
  const v = art.v;
  if (id === 'kick') {
    tone(t, 'sine', 150, 42, 0.42, v);
    noise(t, 0.015, v * 0.25, [filt('highpass', 2500)]);
  } else if (id === 'tom') {
    // high, mid and floor tom, a fourth and a fifth apart (about G3, D3 and G#2)
    const [f, dur] = { high: [196, 0.38], mid: [147, 0.48], floor: [104, 0.62] }[art.k];
    tone(t, 'sine', f * 1.45, f, dur, v * 0.95, 0.35);
    noise(t, 0.012, v * 0.22, [filt('highpass', 2200)]);
  } else if (id === 'snare') {
    if (art.k === 'rim') {
      noise(t, 0.09, v * 0.95, [filt('bandpass', 2600, 1.2)]);
      tone(t, 'triangle', 480, 420, 0.06, v * 0.55);
      noise(t, 0.16, v * 0.35, [filt('highpass', 1800)]);
    } else {
      noise(t, 0.19, v * 0.7, [filt('highpass', 1200)]);
      tone(t, 'triangle', 200, 165, 0.11, v * 0.5);
    }
  } else if (id === 'hh') {
    chokeHat(t);
    const open = art.k === 'open';
    const g = noise(t, open ? 0.42 : 0.05, v * 0.42, [
      filt('highpass', 7200),
      filt('peaking', 10000, 1),
    ]);
    if (open) openHat = g;
  } else if (id === 'hhf') {
    chokeHat(t);
    noise(t, 0.045, v * 0.38, [filt('bandpass', 5200, 1.4)]);
    noise(t, 0.02, v * 0.25, [filt('lowpass', 900)]);
  } else if (id === 'crash') {
    noise(t, 1.6, v * 0.5, [filt('highpass', 4500), filt('peaking', 8000, 0.7)]);
    noise(t, 0.5, v * 0.35, [filt('bandpass', 3000, 0.8)]);
    const g = env(t, v * 0.06, 1.4),
      hp = filt('highpass', 5000);
    hp.connect(g);
    [263, 400, 421, 474, 587, 845].forEach((f) => {
      const o = audio.createOscillator();
      o.type = 'square';
      o.frequency.value = f * 2.1;
      o.connect(hp);
      o.start(t);
      o.stop(t + 1.45);
    });
  } else if (id === 'ride') {
    const g = env(t, v * 0.16, 1.1),
      hp = filt('highpass', 3200),
      bp = filt('bandpass', 7000, 0.6);
    hp.connect(bp).connect(g);
    [263, 400, 421, 474, 587, 845].forEach((f) => {
      const o = audio.createOscillator();
      o.type = 'square';
      o.frequency.value = f * 1.4;
      o.connect(hp);
      o.start(t);
      o.stop(t + 1.15);
    });
    tone(t, 'sine', 2400, 2400, 0.5, v * 0.11);
  }
}
function metronome(t, accent) {
  tone(t, 'sine', accent ? 1600 : 1100, accent ? 1600 : 1100, 0.04, 0.35);
}

// spoken count: pre-rendered words, scheduled on the audio clock so they land on the grid
const NUMS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const countBufs = {};
let countLoading = null;
let countMode = store.get('groove.count') || 'off';
function loadCount() {
  if (countLoading) return countLoading;
  if (!window.__COUNT || !audio) return Promise.resolve();
  countLoading = Promise.all(
    Object.entries(window.__COUNT).map(async ([k, b64]) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      countBufs[k] = await audio.decodeAudioData(bin.buffer);
    }),
  ).catch(() => {
    countLoading = null;
  });
  return countLoading;
}
function sayWord(w, t, slot, vel) {
  const b = countBufs[w];
  if (!b) return;
  const src = audio.createBufferSource();
  src.buffer = b;
  const rate = Math.min(1.7, Math.max(1, b.duration / (slot * 0.92)));
  src.playbackRate.value = rate;
  const end = t + Math.min(b.duration / rate, slot * 0.95);
  const g = audio.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.setValueAtTime(vel, Math.max(t, end - 0.015));
  g.gain.linearRampToValueAtTime(0, end);
  src.connect(g).connect(master);
  src.start(t);
  src.stop(end + 0.01);
}
if (countMode !== 'off') countMode = 'beats';
$('countBtn').setAttribute('aria-pressed', countMode !== 'off');
$('countBtn').onclick = (e) => {
  countMode = countMode === 'off' ? 'beats' : 'off';
  e.currentTarget.setAttribute('aria-pressed', countMode !== 'off');
  store.set('groove.count', countMode);
  if (countMode !== 'off' && ensureAudio()) loadCount();
};
