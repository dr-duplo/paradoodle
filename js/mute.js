// Muting kit rows while listening: tap an instrument's name in any bar to mute or unmute it,
// double-tap to hear only that instrument (or everything again). Muting only affects playback;
// the loop itself, share links and exported sheets stay as they are.

const muted = new Set();
const isMuted = (id) => muted.has(id);
function paintMutes() {
  bars.querySelectorAll('.lbl').forEach((l) => {
    const off = isMuted(l.dataset.id);
    l.classList.toggle('off', off);
    l.setAttribute('aria-pressed', !off); // pressed = the instrument plays
  });
  bars.querySelectorAll('.cell').forEach((c) => {
    c.classList.toggle('rowoff', isMuted(INSTR[c.dataset.i].id));
  });
}
function toggleMute(id) {
  if (muted.has(id)) muted.delete(id);
  else muted.add(id);
}
// Hear only `id`; if that is already the case, unmute everything.
function soloRow(id) {
  const others = INSTR.map((ins) => ins.id).filter((x) => x !== id);
  const alone = !isMuted(id) && others.every(isMuted);
  muted.clear();
  if (!alone) others.forEach((x) => muted.add(x));
}
let lastTap = { id: null, t: 0 };
bars.addEventListener('click', (e) => {
  const l = e.target.closest('.lbl');
  if (!l) return;
  const id = l.dataset.id,
    now = performance.now();
  if (lastTap.id === id && now - lastTap.t < 350) {
    toggleMute(id); // take back the first tap of the double-tap
    soloRow(id);
    lastTap = { id: null, t: 0 };
  } else {
    toggleMute(id);
    lastTap = { id, t: now };
  }
  paintMutes();
});
