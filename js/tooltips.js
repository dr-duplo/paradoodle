// Hover tips that explain each button (mouse only).

// ---------- hover tips (mouse only) ----------
const TIPS = {
  titleSave: () =>
    $('titleSave').classList.contains('dirty')
      ? 'Save to Loops · you have unsaved changes'
      : 'Save to Loops',
  nameShare: 'Copy a share link or export the drum sheet',
  libBtn: 'Your saved loops and the example grooves',
  setupBtn: 'Time signature, feel, swing and kit',
  keyBtn: 'Show what each symbol means',
  barsMinus: 'Remove the last bar',
  barsPlus: 'Add a bar',
  hideEmpty: 'Hide kit rows that have no notes',
  startBlank: 'Clear the example and start from scratch',
  addBar: 'Add a bar at the end',
  play: () => (playing ? 'Stop' : 'Play the loop'),
  countBtn: 'Spoken count: says 1 2 3 4 on the beats',
  flashBtn: 'Flash the background on every beat',
  themeBtn: () => (isDark() ? 'Switch to the light theme' : 'Switch to the dark theme'),
  ghLink: 'Paradoodle on GitHub: source, issues and ideas',
  click: 'Metronome click on every beat',
  undo: 'Undo the last change',
  redo: 'Redo what you undid',
  libMore: 'Share the current loop or export all loops',
  newLoop: 'Start a new blank loop',
  copyShare: 'Copy the link',
};
const ACT_TIPS = {
  up: 'Move this bar up',
  down: 'Move this bar down',
  solo: 'Play only this bar; tap again to play all',
  menu: 'Duplicate, clear or remove this bar',
};
const tipEl = document.createElement('div');
tipEl.className = 'tip';
tipEl.setAttribute('aria-hidden', 'true');
document.body.appendChild(tipEl);
let tipT = 0,
  tipFor = null;
const hideTip = () => {
  clearTimeout(tipT);
  tipFor = null;
  tipEl.classList.remove('on');
};
function tipText(el) {
  if (el.classList.contains('lbl'))
    return `${isMuted(el.dataset.id) ? 'Unmute' : 'Mute'} ${el.textContent} · double-tap to hear only this`;
  const t = TIPS[el.id] ?? (el.closest('.bar-head') ? ACT_TIPS[el.dataset.act] : null);
  return typeof t === 'function' ? t() : t;
}
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const el = e.target.closest('button, a[id]');
  if (!el || el === tipFor) return;
  hideTip();
  if (!tipText(el)) return;
  tipFor = el;
  tipT = setTimeout(() => {
    if (tipFor !== el || !el.isConnected) return;
    tipEl.textContent = tipText(el);
    const r = el.getBoundingClientRect(),
      w = tipEl.offsetWidth,
      h = tipEl.offsetHeight;
    const below = r.bottom + 8 + h < innerHeight;
    tipEl.style.top = (below ? r.bottom + 8 : r.top - 8 - h) + 'px';
    tipEl.style.left =
      Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tipEl.classList.add('on');
  }, 350);
});
document.addEventListener('pointerout', (e) => {
  if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip();
});
['pointerdown', 'scroll', 'keydown'].forEach((ev) => addEventListener(ev, hideTip, true));
