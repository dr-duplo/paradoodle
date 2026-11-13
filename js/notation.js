// Staff notation with VexFlow, loaded the first time it is needed.

// ---------- staff notation (VexFlow, loaded on first use) ----------
let vfPromise = null;
const vfLib = () =>
  window.Vex && (window.Vex.Flow || window.Vex.default?.Flow || window.Vex.default || window.Vex);
function loadVF() {
  if (vfLib()?.Stave) return Promise.resolve(vfLib());
  if (!vfPromise)
    vfPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.3/build/cjs/vexflow.js';
      s.onload = () => (vfLib()?.Stave ? res(vfLib()) : rej(new Error('VexFlow missing')));
      s.onerror = () => {
        vfPromise = null;
        rej(new Error('VexFlow failed to load'));
      };
      document.head.appendChild(s);
    });
  return vfPromise;
}
// percussion staff positions: bass F4, snare C5, ride F5, hi-hat G5, crash A5 (ledger line)
const STAFF_KEY = {
  crash: { hit: 'a/5/x2' },
  ride: { hit: 'f/5/x2', ghost: 'f/5/x2' },
  hh: { closed: 'g/5/x2', open: 'g/5/x2', ghost: 'g/5/x2' },
  snare: { hit: 'c/5', rim: 'c/5/cx', ghost: 'c/5' },
  kick: { hit: 'f/4' },
  hhf: { hit: 'd/4/x2' },
};
const KEY_RANK = { 'd/4': -1, 'f/4': 0, 'c/5': 1, 'f/5': 2, 'g/5': 3, 'a/5': 4 };
const HANDS = ['crash', 'ride', 'hh', 'snare'],
  FEET = ['kick', 'hhf'];
const INSTR_BY = Object.fromEntries(INSTR.map((i) => [i.id, i]));
const STAFF_ROW = 118,
  STAFF_CLEF = 62,
  STAFF_TIME = 26;

function staffLayout(width) {
  const n = steps();
  const minBar = n <= 8 ? 170 : n <= 16 ? 270 : n <= 24 ? 370 : 460;
  const perLine = Math.max(
    1,
    Math.min(4, S.bars.length, Math.floor((width - STAFF_CLEF) / minBar)),
  );
  const lines = Math.ceil(S.bars.length / perLine);
  return { perLine, lines, height: lines * STAFF_ROW + 14 };
}
function staffDur(sub, len) {
  return sub === 4
    ? { 1: '16', 2: '8', 3: '8d', 4: 'q' }[len]
    : sub === 2
      ? { 1: '8', 2: 'q' }[len]
      : { 1: '8', 2: 'q', 3: 'q' }[len];
}
function buildStaffVoice(VF, bar, ids, dir) {
  const n = steps(),
    sub = S.sub,
    notes = [],
    tuplets = [];
  const events = (s) =>
    ids.flatMap((id) => {
      const v = bar[id][s];
      return v ? [{ id, art: INSTR_BY[id].arts[v - 1].k }] : [];
    });
  const ev = Array.from({ length: n }, (_, s) => events(s));
  if (!ev.some((e) => e.length)) {
    for (let b = 0; b < S.beats; b++) notes.push(new VF.GhostNote({ duration: 'q' }));
    return { notes, tuplets, beams: [] };
  }
  const restKey = dir === 1 ? 'e/5' : 'e/4';
  for (let b = 0; b < S.beats; b++) {
    const on = [];
    for (let p = 0; p < sub; p++) if (ev[b * sub + p].length) on.push(p);
    const segs = [];
    if (!on.length) segs.push({ len: sub, e: null });
    else {
      if (on[0] > 0) segs.push({ len: on[0], e: null });
      on.forEach((p, i) =>
        segs.push({ len: (i + 1 < on.length ? on[i + 1] : sub) - p, e: ev[b * sub + p] }),
      );
    }
    const beatNotes = segs.map((sg) => {
      const d = staffDur(sub, sg.len);
      let note;
      if (!sg.e)
        note = new VF.StaveNote({ keys: [restKey], duration: d + 'r', stem_direction: dir });
      else {
        const e = sg.e
          .slice()
          .sort(
            (a, b) =>
              KEY_RANK[STAFF_KEY[a.id][a.art].slice(0, 3)] -
              KEY_RANK[STAFF_KEY[b.id][b.art].slice(0, 3)],
          );
        note = new VF.StaveNote({
          keys: e.map((x) => STAFF_KEY[x.id][x.art]),
          duration: d,
          stem_direction: dir,
          auto_stem: false,
        });
        e.forEach((x, i) => {
          if (x.art === 'ghost') {
            note.addModifier(new VF.Parenthesis(VF.ModifierPosition.LEFT), i);
            note.addModifier(new VF.Parenthesis(VF.ModifierPosition.RIGHT), i);
          }
        });
        if (e.some((x) => x.id === 'hh' && x.art === 'open'))
          note.addModifier(new VF.Articulation('ah').setPosition(VF.ModifierPosition.ABOVE), 0);
      }
      if (d.endsWith('d')) VF.Dot.buildAndAttach([note], { all: true });
      return note;
    });
    if (sub === 3 && segs.length > 1)
      tuplets.push(new VF.Tuplet(beatNotes, { num_notes: 3, notes_occupied: 2 }));
    notes.push(...beatNotes);
  }
  const beams = VF.Beam.generateBeams(notes, {
    groups: [new VF.Fraction(1, 4)],
    stem_direction: dir,
    maintain_stem_directions: false,
  });
  return { notes, tuplets, beams };
}
// draws all bars as staff systems; (x, y) top-left, width in drawing units; returns height used
function drawStaff(VF, ctx2d, x0, y0, width) {
  const vctx = new VF.CanvasContext(ctx2d);
  vctx.setFillStyle('#111');
  vctx.setStrokeStyle('#111');
  const lay = staffLayout(width);
  S.bars.forEach((bar, idx) => {
    const L = Math.floor(idx / lay.perLine),
      k = idx % lay.perLine;
    const lead = STAFF_CLEF + (L === 0 ? STAFF_TIME : 0);
    const bw = (width - lead) / lay.perLine;
    const x = x0 + (k === 0 ? 0 : lead + k * bw),
      w = k === 0 ? lead + bw : bw;
    const st = new VF.Stave(x, y0 + L * STAFF_ROW, w);
    if (k === 0) {
      st.addClef('percussion');
      if (L === 0) st.addTimeSignature(`${S.beats}/4`);
    }
    if (idx === 0) st.setBegBarType(VF.BarlineType.REPEAT_BEGIN);
    if (idx === S.bars.length - 1) st.setEndBarType(VF.BarlineType.REPEAT_END);
    st.setContext(vctx).draw();
    const hands = buildStaffVoice(VF, bar, HANDS, 1),
      feet = buildStaffVoice(VF, bar, FEET, -1);
    const v1 = new VF.Voice({ num_beats: S.beats, beat_value: 4 }).addTickables(hands.notes);
    const v2 = new VF.Voice({ num_beats: S.beats, beat_value: 4 }).addTickables(feet.notes);
    new VF.Formatter().joinVoices([v1, v2]).formatToStave([v1, v2], st);
    v1.draw(vctx, st);
    v2.draw(vctx, st);
    [...hands.beams, ...feet.beams].forEach((b) => b.setContext(vctx).draw());
    [...hands.tuplets, ...feet.tuplets].forEach((t) => t.setContext(vctx).draw());
  });
  return lay.height;
}
const STAFF_KEY_ITEMS = [
  ['a/5/x2', 'Crash'],
  ['f/5/x2', 'Ride'],
  ['g/5/x2', 'Hi-hat'],
  ['g/5/x2', 'Open', 'open'],
  ['c/5', 'Snare'],
  ['c/5/cx', 'Rim'],
  ['c/5', 'Ghost', 'ghost'],
  ['f/4', 'Bass', null, -1],
  ['d/4/x2', 'HH foot', null, -1],
];
function drawStaffKey(VF, ctx2d, x, y, width) {
  const vctx = new VF.CanvasContext(ctx2d);
  vctx.setFillStyle('#111');
  vctx.setStrokeStyle('#111');
  const st = new VF.Stave(x, y, width);
  st.addClef('percussion');
  st.setContext(vctx).draw();
  const notes = STAFF_KEY_ITEMS.map(([key, label, mod, dir]) => {
    const n = new VF.StaveNote({
      keys: [key],
      duration: 'q',
      stem_direction: dir || 1,
      auto_stem: false,
    });
    if (mod === 'ghost') {
      n.addModifier(new VF.Parenthesis(VF.ModifierPosition.LEFT), 0);
      n.addModifier(new VF.Parenthesis(VF.ModifierPosition.RIGHT), 0);
    }
    if (mod === 'open')
      n.addModifier(new VF.Articulation('ah').setPosition(VF.ModifierPosition.ABOVE), 0);
    const a = new VF.Annotation(label).setVerticalJustification(
      VF.AnnotationVerticalJustify.BOTTOM,
    );
    a.setFont('Inter, Arial, sans-serif', 9, 'normal');
    n.addModifier(a, 0);
    return n;
  });
  VF.Formatter.FormatAndDraw(vctx, st, notes);
  return 110;
}

function scheduleStaff() {}
