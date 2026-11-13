// Play and stop: a look-ahead scheduler, the moving playhead,
// the beat dots, metronome click and beat flash.

// ---------- transport ----------
let playing = false,
  cur = 0,
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
    total = n * S.bars.length,
    dur = 60 / S.tempo / S.sub;
  // swing: delay every second grid step; 0.5 = straight, 2/3 = triplet feel
  const sw = S.sub === 3 ? 0 : ((S.swing || 0.5) - 0.5) * 2 * dur;
  while (nextT < audio.currentTime + 0.12) {
    if (solo !== null && solo >= S.bars.length) solo = null;
    const span = solo !== null ? n : total;
    cur %= span;
    const b = solo !== null ? solo : Math.floor(cur / n),
      s = cur % n,
      bar = S.bars[b];
    const late = s % 2 === 1,
      t = nextT + (late ? sw : 0);
    INSTR.forEach((ins) => {
      const v = bar[ins.id][s];
      if (v && !isMuted(ins.id)) triggerSound(ins.id, ins.arts[v - 1], t);
    });
    if (clickOn && s % S.sub === 0) metronome(t, s === 0);
    if (countMode !== 'off' && s % S.sub === 0) sayWord(NUMS[s / S.sub], t, dur * S.sub, 1);
    queue.push({ t, b, s });
    nextT += dur;
    cur++;
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
  if (r.top >= 0 && r.bottom <= bottom) return;
  sec.scrollIntoView({
    block: 'nearest',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
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
let starting = false;
async function startPlayback() {
  if (starting || playing) return;
  starting = true;
  try {
    if (!ensureAudio()) return;
    shownBar = -1;
    if (countMode !== 'off') await loadCount();
    playing = true;
    cur = 0;
    queue = [];
    nextT = audio.currentTime + 0.06;
    tick();
    timer = setInterval(tick, 25);
    raf = requestAnimationFrame(light);
    setPlayIcon();
  } finally {
    starting = false;
  }
  try {
    const w = await navigator.wakeLock?.request('screen');
    if (playing) wake = w;
    else w?.release();
  } catch {}
}
function stopPlayback() {
  playing = false;
  clearInterval(timer);
  cancelAnimationFrame(raf);
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
let flashOn = !!store.get('groove.flash');
const dotsEl = $('beatdots'),
  bgEls = [document.documentElement, document.body];
function renderDots(active) {
  if (dotsEl.children.length !== S.beats) dotsEl.innerHTML = '<i></i>'.repeat(S.beats);
  [...dotsEl.children].forEach((d, i) => {
    d.classList.toggle('on', i === active);
    d.classList.toggle('down', i === 0);
  });
}
function flashBeat(beat) {
  const down = beat === 0;
  const cs = getComputedStyle(document.documentElement);
  const paper = cs.getPropertyValue('--paper').trim(),
    hue = cs.getPropertyValue(down ? '--brass' : '--accent').trim();
  const from = `color-mix(in srgb, ${hue} ${down ? 75 : 45}%, ${paper})`;
  const dur = Math.min(240, (60000 / S.tempo) * 0.6);
  bgEls.forEach((el) => {
    el.getAnimations().forEach((a) => a.cancel());
    el.animate([{ backgroundColor: from }, { backgroundColor: paper }], {
      duration: dur,
      easing: 'ease-out',
    });
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
$('play').onclick = () => (playing ? stopPlayback() : startPlayback());
$('click').onclick = (e) => {
  clickOn = !clickOn;
  e.currentTarget.setAttribute('aria-pressed', clickOn);
};
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.target.closest('input,select,textarea,button')) {
    e.preventDefault();
    playing ? stopPlayback() : startPlayback();
  }
});
