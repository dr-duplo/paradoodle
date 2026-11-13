// Play and stop: a look-ahead scheduler, the moving playhead,
// the beat dots, metronome click and beat flash.

// ---------- transport ----------
let playing = false,
  head = { bar: null, i: 0, s: 0 }, // next step to play; the bar object survives deleting or moving bars
  nextT = 0,
  timer = null,
  queue = [],
  raf = 0,
  lit = [],
  wake = null,
  clickOn = false;
const ICON_PLAY =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>';
const ICON_STOP =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/></svg>';
function setPlayIcon() {
  $('play').innerHTML = playing ? ICON_STOP : ICON_PLAY;
  $('play').setAttribute('aria-label', playing ? 'Stop' : 'Play');
}
function tick() {
  const n = steps(),
    dur = 60 / S.tempo / S.sub;
  // swing: delay every second grid step; 0.5 = straight, 2/3 = triplet feel
  const sw = S.sub === 3 ? 0 : ((S.swing || 0.5) - 0.5) * 2 * dur;
  while (nextT < audio.currentTime + 0.12) {
    if (solo !== null && solo >= S.bars.length) solo = null;
    // keep the playhead in its bar when solo changes or bars are removed or moved
    let b = solo !== null ? solo : S.bars.indexOf(head.bar);
    if (b < 0) b = head.i % S.bars.length;
    const s = head.s % n,
      bar = S.bars[b];
    const late = s % 2 === 1,
      t = nextT + (late ? sw : 0);
    // after a stall the missed steps are skipped, not played in a burst
    if (t >= audio.currentTime) {
      INSTR.forEach((ins) => {
        const v = bar[ins.id][s];
        if (v && !isMuted(ins.id)) triggerSound(ins.id, ins.arts[v - 1], t);
      });
      if (clickOn && s % S.sub === 0) metronome(t, s === 0);
      if (countMode !== 'off' && s % S.sub === 0) sayWord(NUMS[s / S.sub], t, dur * S.sub, 1);
      queue.push({ t, b, s });
    }
    nextT += dur;
    const wrap = s + 1 >= n,
      nb = wrap && solo === null ? (b + 1) % S.bars.length : b;
    head = { bar: S.bars[nb], i: nb, s: wrap ? 0 : s + 1 };
  }
}
let shownBar = -1;
function followBar(b) {
  if (document.activeElement?.matches('input, select, textarea')) return;
  const sec = $('bars').children[b];
  if (!sec) return;
  document.documentElement.style.setProperty(
    '--transport-h',
    ($('transport')?.offsetHeight || 130) + 'px',
  );
  const r = sec.getBoundingClientRect(),
    bottom = innerHeight - ($('transport')?.offsetHeight || 0);
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  if (!followBar.watch) {
    // keep the lit step in view inside a wide, sideways-scrolling grid; hands off while the user touches it
    followBar.touched = 0;
    const touch = () => (followBar.touched = performance.now());
    ['pointerdown', 'wheel', 'touchmove'].forEach((t) =>
      $('bars').addEventListener(t, touch, { passive: true }),
    );
    followBar.watch = new MutationObserver((list) => {
      if (!playing || performance.now() - followBar.touched < 3000) return;
      const el = list.map((m) => m.target).find((n) => n.classList.contains('now'));
      const sc = el?.closest('.scroller');
      if (!sc || sc.scrollWidth <= sc.clientWidth) return;
      const c = el.getBoundingClientRect(),
        v = sc.getBoundingClientRect(),
        pad = Math.min(90, v.width / 3);
      if (c.left >= v.left + pad / 2 && c.right <= v.right - pad) return;
      sc.scrollTo({
        left: sc.scrollLeft + c.left - v.left - v.width / 4,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    followBar.watch.observe($('bars'), {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }
  if (r.top >= 0 && r.bottom <= bottom) return;
  sec.scrollIntoView({ block: 'nearest', behavior });
}
function light() {
  let q = null;
  while (queue.length && queue[0].t <= audio.currentTime) q = queue.shift();
  if (q) {
    lit.forEach((el) => el.classList.remove('now'));
    lit = cols[q.b]?.[q.s] || [];
    lit.forEach((el) => el.classList.add('now'));
    if (q.b !== shownBar) {
      shownBar = q.b;
      followBar(q.b);
    }
    if (q.s % S.sub === 0) {
      renderDots(q.s / S.sub);
      if (flashOn) flashBeat(q.s / S.sub);
    }
  }
  raf = requestAnimationFrame(light);
}
let starting = false,
  startGen = 0;
async function startPlayback() {
  if (starting || playing) return;
  starting = true;
  const gen = ++startGen;
  try {
    if (!ensureAudio()) return;
    shownBar = -1;
    if (countMode !== 'off') await loadCount();
    if (gen !== startGen) return; // Stop was pressed while the count was loading
    playing = true;
    head = { bar: S.bars[solo ?? 0], i: solo ?? 0, s: 0 };
    queue = [];
    openBus();
    nextT = audio.currentTime + 0.06;
    tick();
    timer = setInterval(tick, 25);
    raf = requestAnimationFrame(light);
    setPlayIcon();
  } finally {
    if (gen === startGen) starting = false;
  }
  requestWake();
}
async function requestWake() {
  if (!playing || wake) return;
  try {
    const w = await navigator.wakeLock?.request('screen');
    if (!w) return;
    // the browser drops the lock when the page is hidden
    w.addEventListener('release', () => {
      if (wake === w) wake = null;
    });
    if (playing && !wake) wake = w;
    else w.release();
  } catch {}
}
function stopPlayback() {
  startGen++;
  starting = false;
  playing = false;
  clearInterval(timer);
  cancelAnimationFrame(raf);
  clearTimeout(giveUp);
  closeBus();
  queue = [];
  lit.forEach((el) => el.classList.remove('now'));
  lit = [];
  setPlayIcon();
  renderDots(-1);
  try {
    wake?.release();
  } catch {}
  wake = null;
}
const togglePlayback = () => (playing || starting ? stopPlayback() : startPlayback());
// An interrupted or suspended audio clock (phone call, another app, backgrounding) must not leave
// a frozen playhead under a Stop button. We try to resume; if the clock stays dead while the page
// is in front, we stop and say so, so the next press of Play starts cleanly from the top. If it
// comes back, the scheduler skips the steps it missed instead of playing them as a burst.
let giveUp = 0;
function onAudioState() {
  clearTimeout(giveUp);
  if (!playing || audio.state === 'running') return;
  audio.resume().catch(() => {});
  giveUp = setTimeout(() => {
    if (playing && audio.state !== 'running' && document.visibilityState === 'visible') {
      stopPlayback();
      appStatus('Audio was interrupted. Press Play to start again.', 'info');
    }
  }, 1500);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !playing) return;
  if (audio.state !== 'running') audio.resume().catch(() => {});
  requestWake();
});
let flashOn = store.get('groove.flash') !== false; // on until someone turns it off
const dotsEl = $('beatdots');
function renderDots(active) {
  if (dotsEl.children.length !== S.beats) dotsEl.innerHTML = '<i></i>'.repeat(S.beats);
  [...dotsEl.children].forEach((d, i) => {
    d.classList.toggle('on', i === active);
    d.classList.toggle('down', i === 0);
  });
}
// The beat flash: the background lights up in the beat's colour with sine waves cut out of it
// in the page colour. The waves are drawn once, as eight frames in one SVG stretched over the
// window; each beat shows the next frame, so the pattern travels and repeats every eight beats.
const WAVES = [
  { y: 0.14, periods: 1.3, amp: 0.05, width: 20, speed: 0.9 },
  { y: 0.33, periods: 3.2, amp: 0.025, width: 9, speed: -1.4 },
  { y: 0.52, periods: 2.1, amp: 0.07, width: 30, speed: 0.6 },
  { y: 0.72, periods: 4.6, amp: 0.02, width: 7, speed: -2.1 },
  { y: 0.88, periods: 1.7, amp: 0.045, width: 16, speed: 1.2 },
];
const FLASH_FRAMES = 8;
function wavePath(wave, phase) {
  const steps = 120;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      y = 1000 * (wave.y + wave.amp * Math.sin(2 * Math.PI * wave.periods * t + phase));
    d += `${i ? 'L' : 'M'}${(1000 * t).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
const flashEl = document.createElement('div');
flashEl.className = 'beatflash';
flashEl.setAttribute('aria-hidden', 'true');
flashEl.innerHTML = `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none"><rect width="1000" height="1000"/>${Array.from(
  { length: FLASH_FRAMES },
  (_, f) =>
    `<g>${WAVES.map(
      (wave, k) =>
        `<path d="${wavePath(wave, f * wave.speed + k)}" stroke-width="${wave.width}" vector-effect="non-scaling-stroke"/>`,
    ).join('')}</g>`,
).join('')}</svg>`;
document.body.prepend(flashEl);
const flashFrames = [...flashEl.querySelectorAll('g')];
let flashCount = 0;
function flashBeat(beat) {
  const down = beat === 0;
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue('--paper').trim(),
    hue = cs.getPropertyValue(down ? '--brass' : '--accent').trim();
  flashEl.style.setProperty('--flash', `color-mix(in srgb, ${hue} ${down ? 75 : 45}%, ${paper})`);
  const f = flashCount++ % FLASH_FRAMES;
  flashFrames.forEach((g, i) => g.classList.toggle('on', i === f));
  flashEl.getAnimations().forEach((a) => a.cancel());
  flashEl.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: Math.min(240, (60000 / S.tempo) * 0.6),
    easing: 'ease-out',
  });
}
function setFlash(on) {
  flashOn = on;
  $('flashBtn').setAttribute('aria-pressed', on);
  store.set('groove.flash', on);
  renderDots(-1);
}
$('flashBtn').onclick = () => setFlash(!flashOn);
setFlash(flashOn);
$('play').onclick = togglePlayback;
$('click').onclick = (e) => {
  clickOn = !clickOn;
  e.currentTarget.setAttribute('aria-pressed', clickOn);
};
// Space starts and stops playback anywhere in the main view, except while typing in a text field
// (the groove or a bar name), in a menu, or with a panel open. It takes over from a focused cell,
// button, slider or select, so Space never toggles the cell you tapped last.
const TYPING =
  'textarea, [contenteditable], input:not([type]), input[type="text"], input[type="search"], ' +
  'input[type="number"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"]';
const spaceIsPlay = (e) =>
  e.code === 'Space' &&
  !e.metaKey &&
  !e.ctrlKey &&
  !e.altKey &&
  !e.target.closest?.(`${TYPING}, [role="menuitem"]`) &&
  !document.querySelector('.overlay:not([hidden])');
addEventListener(
  'keydown',
  (e) => {
    if (!spaceIsPlay(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) togglePlayback();
  },
  true,
);
// a button acts on Space when the key comes up, so the key-up is held back too
addEventListener(
  'keyup',
  (e) => {
    if (!spaceIsPlay(e)) return;
    e.preventDefault();
    e.stopPropagation();
  },
  true,
);
