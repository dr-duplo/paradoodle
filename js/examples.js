// Built-in example grooves and the Examples list in the Grooves panel.

// ---------- example grooves ----------
// one string per row, one character per grid step:
// crash x · ride x hit, g ghost · hi-hat x closed, o open, g ghost · snare o hit, r rim, g ghost
// · toms h high, m mid, f floor · bass o · hi-hat foot x
const CH = {
  crash: { x: 1 },
  ride: { x: 1, g: 2 },
  hh: { x: 1, o: 2, g: 3 },
  snare: { o: 1, r: 2, g: 3 },
  tom: { h: 1, m: 2, f: 3 },
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
// Curated examples, shown in groups: {group, about, make: () => groove(name, tempo, beats, sub, bars, extra)}.
// The famous breaks are simplified to fit the kit (no toms).
const AMEN_A = { ride: 'x-x-x-x-x-x-x-x-', snare: '----o--o-o--o--o', kick: 'o-o-------oo----' };
const EXAMPLES = [
  { group: 'Paradoodle', about: '2-bar break with ghost notes on hi-hat and snare', make: kraut },
  {
    group: 'Paradoodle',
    about: 'the rudiment RLRR LRLL, right hand on the hi-hat, left on the snare',
    make: () =>
      groove('Paradiddle groove', 96, 4, 4, [
        { hh: 'x-xx-x--x-xx-x--', snare: '-g--o-gg-g--o-gg', kick: 'o-------o-o-----' },
      ]),
  },
  {
    group: 'Styles',
    about: 'straight 8ths, the first groove most drummers learn',
    make: () =>
      groove('Rock beat', 100, 4, 2, [
        { hh: 'xxxxxxxx', snare: '--o---o-', kick: 'o---o---' },
        { hh: 'xxxxxxxx', snare: '--o---o-', kick: 'o---oo--' },
      ]),
  },
  {
    group: 'Styles',
    about: 'disco and house, bass drum on every beat, open hi-hat on the offbeats',
    make: () =>
      groove('Four on the floor', 122, 4, 4, [
        { hh: 'x-o-x-o-x-o-x-o-', snare: '----o-------o---', kick: 'o---o---o---o---' },
      ]),
  },
  {
    group: 'Styles',
    about: 'laid-back 90s hip-hop with 16th swing',
    make: () =>
      groove(
        'Boom bap',
        90,
        4,
        4,
        [
          { hh: 'x-x-x-x-x-x-x-x-', snare: '----o-------o--g', kick: 'o------o--o-----' },
          { hh: 'x-x-x-x-x-x-x-o-', snare: '----o--g----o---', kick: 'o-o----o--o---o-' },
        ],
        { swing: 0.58 },
      ),
  },
  {
    group: 'Styles',
    about: 'rim-click clave over two bars, hi-hat foot on 2 and 4',
    make: () =>
      groove('Bossa nova', 140, 4, 2, [
        { ride: 'xxxxxxxx', snare: 'r--r--r-', kick: 'o--oo--o', hhf: '--x---x-' },
        { ride: 'xxxxxxxx', snare: '--r--r--', kick: 'o--oo--o', hhf: '--x---x-' },
      ]),
  },
  {
    group: 'Styles',
    about: 'the ride’s spang-a-lang in triplets, hi-hat foot on 2 and 4',
    make: () =>
      groove('Jazz swing', 150, 4, 3, [
        { ride: 'x--x-xx--x-x', hhf: '---x-----x--' },
        { ride: 'x--x-xx--x-x', hhf: '---x-----x--', snare: '--------g--g' },
      ]),
  },
  {
    group: 'Famous breaks',
    about: 'The Winstons, 1969 · the most sampled break, simplified',
    make: () =>
      groove('Amen Break', 136, 4, 4, [
        AMEN_A,
        AMEN_A,
        { ride: 'x-x-x-x-x-x-x-x-', snare: '----o--o-o----o-', kick: 'o-o-------oo----' },
        {
          ride: 'x-x-x-x-x---x-x-',
          crash: '----------x-----',
          snare: '-o--o--o-o----o-',
          kick: '--oo------o-----',
        },
      ]),
  },
  {
    group: 'Famous breaks',
    about: 'Clyde Stubblefield, 1970 · main groove, simplified',
    make: () =>
      groove('Funky Drummer', 100, 4, 4, [
        { hh: 'xgxgxgxoxgxgxoxg', snare: '----o--g-g-go--g', kick: 'o-o-------o--o--' },
      ]),
  },
  {
    group: 'Famous breaks',
    about: 'Bernard Purdie · triplet shuffle with ghost notes, simplified',
    make: () =>
      groove('Purdie Shuffle', 92, 4, 3, [
        { hh: 'x-xx-xx-xx-x', snare: '-g-og--g-og-', kick: 'o----oo-----' },
        { hh: 'x-xx-xx-xx-x', snare: '-g-og--g-og-', kick: 'o----oo----o' },
      ]),
  },
];
$('exGroup').open = !!store.get('groove.examplesOpen');
$('exGroup').addEventListener('toggle', () => store.set('groove.examplesOpen', $('exGroup').open));
function renderExamples() {
  const list = $('exList');
  list.innerHTML = '';
  $('exCount').textContent = EXAMPLES.length;
  $('exGroup').hidden = !EXAMPLES.length;
  let group = null;
  EXAMPLES.forEach((ex) => {
    if (ex.group !== group) {
      group = ex.group;
      const h = document.createElement('li');
      h.className = 'exhead';
      h.setAttribute('role', 'presentation');
      h.textContent = group;
      list.appendChild(h);
    }
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
