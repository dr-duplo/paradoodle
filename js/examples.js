// Built-in example grooves and the Examples list in the Loops panel.

// ---------- example grooves ----------
// one string per row, one character per grid step:
// crash x · ride x hit, g ghost · hi-hat x closed, o open, g ghost · snare o hit, r rim, g ghost · bass o
const CH = {
  crash: { x: 1 },
  ride: { x: 1, g: 2 },
  hh: { x: 1, o: 2, g: 3 },
  snare: { o: 1, r: 2, g: 3 },
  kick: { o: 1 },
  hhf: { x: 1 },
};
function groove(name, tempo, beats, sub, bars, extra) {
  const n = beats * sub;
  return Object.assign(
    {
      name,
      tempo,
      beats,
      sub,
      bars: bars.map((b) =>
        Object.fromEntries(
          INSTR.map((i) => [
            i.id,
            Array.from({ length: n }, (_, k) => CH[i.id][(b[i.id] || '')[k]] || 0),
          ]),
        ),
      ),
    },
    extra || {},
  );
}
// curated example grooves go here: {about, make: () => groove(name, tempo, beats, sub, bars, extra)}
const EXAMPLES = [{ about: '2-bar break with ghost notes on hi-hat and snare', make: kraut }];
$('exGroup').open = !!store.get('groove.examplesOpen');
$('exGroup').addEventListener('toggle', () => store.set('groove.examplesOpen', $('exGroup').open));
function renderExamples() {
  const list = $('exList');
  list.innerHTML = '';
  $('exCount').textContent = EXAMPLES.length;
  $('exGroup').hidden = !EXAMPLES.length;
  EXAMPLES.forEach((ex) => {
    const st = ex.make();
    const li = document.createElement('li');
    const t = document.createElement('div');
    t.className = 't';
    const nm = document.createElement('b');
    nm.textContent = st.name;
    const meta = document.createElement('small');
    meta.textContent = `${st.beats}/4 · ${st.tempo} BPM · ${st.bars.length} bar${st.bars.length > 1 ? 's' : ''} · ${ex.about}`;
    t.append(nm, meta);
    const open = document.createElement('button');
    open.className = 'btn';
    open.type = 'button';
    open.textContent = 'Open';
    open.onclick = () => {
      commit();
      loadGroove(ex.make());
      closeOv('libOv');
    };
    const acts = document.createElement('div');
    acts.className = 'acts';
    const pad = document.createElement('span');
    pad.className = 'morepad';
    pad.setAttribute('aria-hidden', 'true');
    acts.append(open, pad);
    li.append(t, acts);
    list.appendChild(li);
  });
}
