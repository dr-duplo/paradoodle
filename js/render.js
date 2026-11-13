// Draws the page from the state: the summary line, the kit chips,
// and every bar with its grid of cells.

// ---------- rendering ----------
function countLabels() {
  const sub = S.sub,
    tail = sub === 4 ? ['e', '&', 'a'] : sub === 3 ? ['&', 'a'] : ['&'];
  const out = [];
  for (let b = 0; b < S.beats; b++) {
    out.push(String(b + 1));
    tail.forEach((t) => out.push(t));
  }
  return out;
}
let cols = []; // cols[bar][step] -> elements
function renderLegend() {
  const items = [];
  visibleRows().forEach((ins) =>
    ins.arts.forEach((a) => {
      const name = ins.arts.length > 1 ? `${ins.label} ${a.name.toLowerCase()}` : ins.label;
      items.push(
        `<span class="item ${ins.cym ? 'cym' : 'drm'}">${svg(a.g)}<span>${name}</span></span>`,
      );
    }),
  );
  $('legend').innerHTML = items.join('');
}
function renderBars() {
  const n = steps(),
    labels = countLabels(),
    root = $('bars');
  root.innerHTML = '';
  cols = [];
  S.bars.forEach((bar, b) => {
    const sec = document.createElement('section');
    sec._bar = bar;
    sec.className = 'bar' + (solo === b ? ' soloed' : solo !== null ? ' muted' : '');
    const nm = barName(bar, b);
    sec.innerHTML = `<div class="bar-head"><input class="barname" type="text" id="barname-${b}" maxlength="40" spellcheck="false" aria-label="Name of bar ${b + 1}" data-b="${b}">
      <span class="mv">
        <button class="btn ghost" type="button" data-act="up" data-b="${b}" aria-label="Move ${esc(nm)} up" ${b === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn ghost" type="button" data-act="down" data-b="${b}" aria-label="Move ${esc(nm)} down" ${b === S.bars.length - 1 ? 'disabled' : ''}>↓</button>
      </span>
      <button class="btn toggle solo" type="button" data-act="solo" data-b="${b}" aria-pressed="${solo === b}" aria-label="Play only ${esc(nm)}">Solo</button>
      <button class="btn ghost more" type="button" data-act="menu" data-b="${b}" aria-haspopup="true" aria-expanded="false" aria-label="More actions for ${esc(nm)}">⋯</button>
      <div class="barmenu" role="menu" hidden>
        <button class="btn ghost" type="button" role="menuitem" data-act="dup" data-b="${b}" ${S.bars.length >= 8 ? 'disabled' : ''}>Duplicate</button>
        <button class="btn ghost" type="button" role="menuitem" data-act="clear" data-b="${b}">Clear notes</button>
        ${S.bars.length > 1 ? `<button class="btn ghost danger" type="button" role="menuitem" data-act="del" data-b="${b}">Remove bar</button>` : ''}
      </div></div>`;
    sec.querySelector('.barname').value = nm;
    const sc = document.createElement('div');
    sc.className = 'scroller';
    const g = document.createElement('div');
    g.className = 'grid';
    g.style.setProperty('--n', n);
    const colEls = Array.from({ length: n }, () => []);
    g.appendChild(document.createElement('div'));
    labels.forEach((t, s) => {
      const c = document.createElement('div');
      c.className = 'count' + (s % S.sub === 0 ? ' beat' : '');
      c.textContent = t;
      g.appendChild(c);
      colEls[s].push(c);
    });
    const vis = visibleRows(),
      lastRow = vis[vis.length - 1];
    INSTR.forEach((ins, r) => {
      if (!vis.includes(ins)) return;
      const l = document.createElement('button');
      l.type = 'button';
      l.className = 'lbl' + (ins.cym ? ' cym' : '') + (ins === lastRow ? ' row-end' : '');
      l.dataset.id = ins.id;
      l.textContent = ins.label;
      g.appendChild(l);
      for (let s = 0; s < n; s++) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className =
          'cell' +
          (ins.cym ? ' cym' : '') +
          (s % S.sub === 0 ? ' beat' : '') +
          (s === 0 ? ' first' : '') +
          (s === n - 1 ? ' last' : '') +
          (Math.floor(s / S.sub) % 2 ? ' offbeat-bg' : '') +
          (ins === lastRow ? ' row-end' : '');
        c.dataset.b = b;
        c.dataset.i = r;
        c.dataset.s = s;
        paintCell(c, bar[ins.id][s], ins, labels[s], b);
        g.appendChild(c);
        colEls[s].push(c);
      }
    });
    sc.appendChild(g);
    sec.appendChild(sc);
    root.appendChild(sec);
    cols.push(colEls);
  });
  $('barsOut').textContent = S.bars.length;
  paintMutes();
  updateSummary();
  if (!playing) renderDots(-1);
  $('barsMinus').disabled = S.bars.length <= 1;
  $('barsPlus').disabled = $('addBar').disabled = S.bars.length >= 8;
}
function paintCell(c, v, ins, label, b) {
  c.innerHTML = v ? svg(ins.arts[v - 1].g) : '';
  c.setAttribute(
    'aria-label',
    `${ins.label}, ${barName(S.bars[b], b)}, ${label}: ${v ? ins.arts[v - 1].name : 'rest'}`,
  );
}
function renderAll() {
  $('name').value = S.name || '';
  fitName();
  syncTitle();
  updateSaveDot();
  $('beats').value = S.beats;
  $('sub').value = S.sub;
  $('tempo').value = S.tempo;
  $('bpm').textContent = S.tempo;
  $('exampleNote').hidden = !S.example;
  updateSwingUI();
  renderChips();
  renderLegend();
  renderBars();
  scheduleStaff();
}
const swingPct = () => Math.round((S.swing || 0.5) * 100);
function swingText(p) {
  return p <= 50 ? 'straight' : p >= 66 && p <= 67 ? `${p}% triplet` : `${p}%`;
}
function updateSwingUI() {
  const tri = S.sub === 3,
    p = swingPct();
  $('swing').value = p;
  $('swing').disabled = tri;
  $('swingField').classList.toggle('off', tri);
  $('swingOut').textContent = tri ? 'n/a' : swingText(p);
  if ($('sumText')) updateSummary();
}

// The summary line under the name, and the Settings and Key panels it opens.
function updateSummary() {
  const feel = { 2: '8ths', 3: 'triplets', 4: '16ths' }[S.sub];
  const sw = S.sub === 3 ? '' : swingPct() > 50 ? ` · swing ${swingPct()}%` : ' · straight';
  const hid = INSTR.length - visibleRows().length;
  $('sumText').textContent =
    `${S.beats}/4 · ${feel}${sw} · ${S.bars.length} bar${S.bars.length > 1 ? 's' : ''}${hid ? ` · ${hid} hidden from kit` : ''}`;
}
function setPanel(btn, panel, key, open) {
  $(panel).hidden = !open;
  $(btn).setAttribute('aria-expanded', open);
  store.set(key, open);
}
$('setupBtn').onclick = () => setPanel('setupBtn', 'setup', 'groove.setupOpen', $('setup').hidden);
$('keyBtn').onclick = () => setPanel('keyBtn', 'legend', 'groove.keyOpen', $('legend').hidden);
setPanel('setupBtn', 'setup', 'groove.setupOpen', !!store.get('groove.setupOpen'));
setPanel('keyBtn', 'legend', 'groove.keyOpen', !!store.get('groove.keyOpen'));
