// The loop being edited (S), how it is checked and repaired when loaded,
// the first-run loop, undo history, and the unsaved-changes dot on Save.

// ---------- state ----------
const blankBar = (n, name) =>
  Object.assign(
    Object.fromEntries(INSTR.map((i) => [i.id, Array(n).fill(0)])),
    name ? { name } : {},
  );
const barName = (bar, i) =>
  bar && typeof bar.name === 'string' && bar.name.trim() ? bar.name : `Bar ${i + 1}`;
const DEFAULT_NAME = /^Bar (\d+)$/;
function nextBarName() {
  const used = S.bars.map((b) => +(DEFAULT_NAME.exec(b.name || '') || [])[1] || 0);
  return `Bar ${Math.max(S.bars.length, ...used) + 1}`;
}
// the Kraut Break: first-run loop and the one curated example
const KRAUT_BARS = [
  {
    crash: 'x---------------',
    hh: '--g-x-g-x-g-x-g-',
    snare: '-g--o--g-g-g--o-',
    kick: 'o---------o-----',
  },
  { hh: 'x-g-x-g-x-g-x-g-', snare: '-g--o--g-g--o--g', kick: '--o-----o-o-----' },
];
function kraut() {
  const map = { x: 1, o: 1, g: 3 },
    bars = KRAUT_BARS.map((rows, i) => {
      const b = blankBar(16, `Bar ${i + 1}`);
      Object.entries(rows).forEach(([id, str]) => {
        [...str].forEach((ch, k) => {
          b[id][k] = map[ch] || 0;
        });
      });
      return b;
    });
  return { name: 'Kraut Break', tempo: 136, beats: 4, sub: 4, hidden: ['ride', 'hhf'], bars };
}
function example() {
  return Object.assign(kraut(), { example: true });
}
function valid(s) {
  return s && Array.isArray(s.bars) && s.bars.length && s.beats && s.sub;
}
// fill in rows added after a loop was saved (e.g. crash) and clamp unknown articulations
function normalize(st) {
  const n = st.beats * st.sub;
  st.bars = st.bars.map((bar, i) => {
    const src = bar && typeof bar === 'object' ? bar : {};
    const out = { name: barName(src, i).slice(0, 40) };
    INSTR.forEach((ins) => {
      const old = Array.isArray(src[ins.id]) ? src[ins.id] : [];
      out[ins.id] = Array.from({ length: n }, (_, k) => {
        const v = Number(old[k]);
        return Number.isInteger(v) && v >= 0 && v <= ins.arts.length ? v : 0;
      });
    });
    return out;
  });
  return st;
}
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const isHidden = (id) => Array.isArray(S.hidden) && S.hidden.includes(id);
function visibleRows() {
  const v = INSTR.filter((i) => !isHidden(i.id));
  return v.length ? v : INSTR.slice();
}
const rowCount = (id) => S.bars.reduce((n, bar) => n + bar[id].filter(Boolean).length, 0);
function renderChips() {
  const box = $('rowChips');
  box.innerHTML = '';
  INSTR.forEach((ins) => {
    const on = !isHidden(ins.id),
      c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip' + (ins.cym ? ' cym' : '');
    c.setAttribute('aria-pressed', on);
    const t = document.createElement('span');
    t.textContent = ins.label;
    c.appendChild(t);
    const n = rowCount(ins.id);
    if (!on && n) {
      const b = document.createElement('span');
      b.className = 'n';
      b.textContent = n;
      b.title = `${n} note${n > 1 ? 's' : ''} still play`;
      c.appendChild(b);
    }
    c.setAttribute(
      'aria-label',
      `${ins.label} ${on ? 'shown' : 'hidden'} in kit${!on && n ? `, ${n} notes still play` : ''}`,
    );
    c.onclick = () => {
      const h = new Set(S.hidden || []);
      if (on) {
        if (INSTR.length - h.size <= 1) return;
        h.add(ins.id);
      } else h.delete(ins.id);
      S.hidden = [...h];
      rowsChanged();
    };
    box.appendChild(c);
  });
}
function rowsChanged() {
  persist();
  renderChips();
  renderLegend();
  renderBars();
}
// opening a groove: hide rows that have no notes, keep rows the loop already hid
function loadGroove(st) {
  solo = null;
  S = normalize(st);
  S.example = false;
  const empty = INSTR.filter((i) => !rowCount(i.id)).map((i) => i.id);
  if (empty.length < INSTR.length) S.hidden = [...new Set([...(S.hidden || []), ...empty])];
  persist();
  renderAll();
}
$('hideEmpty').onclick = () => {
  const empty = INSTR.filter((i) => !rowCount(i.id)).map((i) => i.id);
  if (empty.length >= INSTR.length) return;
  S.hidden = [...new Set([...(S.hidden || []), ...empty])];
  rowsChanged();
};
let S = null;
try {
  const raw = store.get('groove.current');
  S = cleanLoop(raw, 'Untitled loop');
  if (S && raw.example === true) S.example = true;
  if (S && typeof raw.libId === 'string') S.libId = raw.libId;
} catch {
  S = null;
}
if (!S) S = normalize(example());
const steps = () => S.beats * S.sub;
const hist = [];
const fut = [];
function syncHist() {
  $('undo').disabled = !hist.length;
  $('redo').disabled = !fut.length;
}
function commit() {
  hist.push(JSON.stringify(S));
  if (hist.length > 80) hist.shift();
  fut.length = 0;
  syncHist();
}
function persist() {
  store.set('groove.current', S);
  updateSaveDot();
  syncUrl();
}
let urlT = 0;
function syncUrl() {
  clearTimeout(urlT);
  urlT = setTimeout(() => {
    try {
      const h = '#loop-' + packLoop(S);
      if (location.hash !== h) history.replaceState(null, '', h);
    } catch {}
  }, 400);
}
const canonLoop = (st) => {
  try {
    const c = cleanLoop(JSON.parse(JSON.stringify(st)), 'Untitled loop');
    if (!c) return '';
    delete c.example;
    delete c.libId;
    return JSON.stringify(c);
  } catch {
    return '';
  }
};
function isDirty() {
  try {
    const it = S.libId ? lib().find((x) => x.id === S.libId) : null;
    if (it) return canonLoop(it.state) !== canonLoop(S);
    return !S.example && S.bars.some((b) => INSTR.some((i) => b[i.id].some((v) => v)));
  } catch {
    return false;
  }
}
function updateSaveDot() {
  const b = document.getElementById('titleSave');
  if (!b) return;
  const d = isDirty();
  b.classList.toggle('dirty', d);
  b.setAttribute('aria-label', d ? 'Save loop (unsaved changes)' : 'Save loop');
}
function changed() {
  if (S.example) {
    S.example = false;
    $('exampleNote').hidden = true;
  }
  persist();
  scheduleStaff();
  if ($('appStatus')?.classList.contains('info')) appStatus('');
}

// Check a loop from storage, a file or a link, and repair what can be repaired.
function cleanLoop(x, fallbackName = 'Imported loop') {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const beats = Number(x.beats),
    sub = Number(x.sub);
  if (
    !Number.isInteger(beats) ||
    beats < 2 ||
    beats > 7 ||
    ![2, 3, 4].includes(sub) ||
    !Array.isArray(x.bars) ||
    !x.bars.length
  )
    return null;
  const tempo = Number(x.tempo);
  const st = {
    name: (typeof x.name === 'string' && x.name.trim() ? x.name : fallbackName).slice(0, 60),
    tempo: Number.isFinite(tempo) ? Math.min(220, Math.max(40, Math.round(tempo))) : 96,
    beats,
    sub,
    bars: x.bars.slice(0, 8).map((b) => (b && typeof b === 'object' ? b : {})),
  };
  if (+x.swing >= 0.5 && +x.swing <= 0.75) st.swing = +x.swing;
  if (Array.isArray(x.hidden))
    st.hidden = x.hidden.filter((id) => INSTR.some((i) => i.id === id)).slice(0, INSTR.length - 1);
  return normalize(st);
}
