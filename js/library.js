// Your saved loops (kept in localStorage) and the Loops panel.

// ---------- library ----------
function lib() {
  const raw = store.get('groove.library');
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 500).flatMap((x) => {
    let st = null;
    try {
      st = x && typeof x === 'object' ? cleanLoop(x.state, 'Untitled loop') : null;
    } catch {
      st = null;
    }
    return st
      ? [{ id: typeof x.id === 'string' ? x.id : newId(), state: st, at: Number(x.at) || 0 }]
      : [];
  });
}
(() => {
  // give older saved loops a stable id once, and drop unreadable entries
  const raw = store.get('groove.library');
  if (raw != null && (!Array.isArray(raw) || raw.some((x) => !x || typeof x.id !== 'string')))
    store.set('groove.library', lib());
})();
function renderLib() {
  const list = $('libList'),
    items = lib();
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML =
      '<li class="empty">No saved loops yet. Save the current one to keep it here.</li>';
    return;
  }
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    li.dataset.name = it.state.name || 'Untitled loop';
    li.dataset.id = it.id;
    const t = document.createElement('div');
    t.className = 't';
    const nm = document.createElement('b');
    nm.textContent = it.state.name || 'Untitled loop';
    const meta = document.createElement('small');
    meta.textContent = `${it.state.beats}/4 · ${it.state.tempo} BPM · ${it.state.bars.length} bar${it.state.bars.length > 1 ? 's' : ''}`;
    t.append(nm, meta);
    const open = document.createElement('button');
    open.className = 'btn';
    open.type = 'button';
    open.textContent = 'Open';
    open.onclick = () => {
      commit();
      loadGroove(JSON.parse(JSON.stringify(it.state)));
      S.libId = it.id;
      persist();
      closeOv('libOv');
    };
    const del = document.createElement('button');
    del.className = 'btn ghost del';
    del.type = 'button';
    del.textContent = 'Delete';
    del.setAttribute('role', 'menuitem');
    del.onclick = () => {
      if (!del.classList.contains('armed')) {
        del.classList.add('armed');
        del.textContent = 'Tap again to delete';
        setTimeout(() => {
          del.classList.remove('armed');
          del.textContent = 'Delete';
        }, 3000);
        return;
      }
      const l = lib(),
        j = l.findIndex((x) => x.id === it.id);
      if (j >= 0) l.splice(j, 1);
      if (!store.set('groove.library', l)) {
        libStatus("Couldn't delete: this browser's storage is blocked.");
        return;
      }
      if (S.libId === it.id) {
        delete S.libId;
        persist();
      }
      renderLib();
    };
    const exp = document.createElement('button');
    exp.className = 'btn ghost';
    exp.type = 'button';
    exp.textContent = 'Export';
    exp.setAttribute('aria-label', `Export ${it.state.name || 'Untitled loop'} as a file`);
    exp.onclick = () => exportOne(it.state);
    const dup = document.createElement('button');
    dup.className = 'btn ghost';
    dup.type = 'button';
    dup.textContent = 'Duplicate';
    dup.setAttribute('aria-label', `Duplicate ${it.state.name || 'Untitled loop'}`);
    dup.onclick = () => {
      const l = lib(),
        names = new Set(l.map((x) => x.state.name || 'Untitled loop'));
      const base = `${it.state.name || 'Untitled loop'} (copy`;
      let nm = base + ')',
        k = 2;
      while (names.has(nm)) nm = `${base} ${k++})`;
      const copy = JSON.parse(JSON.stringify(it.state));
      copy.name = nm;
      const j = l.findIndex((x) => x.id === it.id),
        id = newId();
      l.splice(j >= 0 ? j + 1 : 0, 0, { id, state: copy, at: Date.now() });
      if (!store.set('groove.library', l)) {
        libStatus(
          "Couldn't duplicate: this browser's storage is full or blocked. Export loops to keep them.",
        );
        return;
      }
      renderLib();
      flashItem(id);
      libStatus(`Added “${nm}”.`);
    };
    const more = document.createElement('button');
    more.className = 'btn ghost more';
    more.type = 'button';
    more.textContent = '⋯';
    more.dataset.act = 'menu';
    more.setAttribute('aria-haspopup', 'true');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-label', `More actions for ${it.state.name || 'Untitled loop'}`);
    const menu = document.createElement('div');
    menu.className = 'barmenu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    [exp, dup].forEach((b) => b.setAttribute('role', 'menuitem'));
    const shr = document.createElement('button');
    shr.className = 'btn ghost';
    shr.type = 'button';
    shr.textContent = 'Share link';
    shr.setAttribute('role', 'menuitem');
    shr.onclick = () => {
      closeMenus();
      shareLoop(it.state);
    };
    menu.append(shr, exp, dup, del);
    more.onclick = () => {
      closeMenus(menu);
      menu.hidden = !menu.hidden;
      more.setAttribute('aria-expanded', !menu.hidden);
      if (menu.hidden) return;
      menu.classList.remove('up');
      const box = menu.closest('.body').getBoundingClientRect(),
        r = menu.getBoundingClientRect();
      if (r.bottom > box.bottom && r.height < li.getBoundingClientRect().top - box.top)
        menu.classList.add('up');
      exp.focus();
    };
    const acts = document.createElement('div');
    acts.className = 'acts';
    acts.append(open, more, menu);
    li.append(t, acts);
    list.appendChild(li);
  });
}
$('libBtn').onclick = () => {
  renderLib();
  renderExamples();
  openOv('libOv');
};
$('titleSave').onclick = () => {
  const l = lib(),
    copy = JSON.parse(JSON.stringify(S));
  delete copy.example;
  delete copy.libId;
  const i = S.libId ? l.findIndex((x) => x.id === S.libId) : -1;
  let nm = S.name || 'Untitled loop',
    renamed = false,
    id = S.libId;
  if (i >= 0) l[i] = { id, state: copy, at: Date.now() };
  else {
    const names = new Set(l.map((x) => x.state.name || 'Untitled loop')),
      base = nm;
    let k = 2;
    while (names.has(nm)) nm = `${base} (${k++})`;
    renamed = nm !== base;
    copy.name = nm;
    id = newId();
    l.unshift({ id, state: copy, at: Date.now() });
  }
  if (!store.set('groove.library', l)) {
    appStatus(
      "Couldn't save: this browser's storage is full or blocked. Use Export in Loops to keep a copy.",
    );
    return;
  }
  S.libId = id;
  if (renamed) {
    S.name = nm;
    $('name').value = nm;
  }
  persist();
  renderLib();
  flashItem(id);
  const b = $('titleSave'),
    msg =
      i >= 0
        ? `Updated “${nm}” in Loops.`
        : renamed
          ? `Saved to Loops as “${nm}” so it doesn't replace another loop.`
          : `Saved “${nm}” to Loops.`;
  clearTimeout(b._t);
  b.innerHTML = ICON_OK;
  b.classList.add('ok');
  appStatus(msg, 'info');
  b._t = setTimeout(() => {
    b.innerHTML = ICON_SAVE;
    b.classList.remove('ok');
    if ($('appStatus').textContent === msg) appStatus('');
  }, 2500);
};
function flashItem(id) {
  const li = [...$('libList').children].find((x) => x.dataset.id === id);
  if (!li) return;
  li.scrollIntoView({
    block: 'nearest',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  li.classList.remove('flash');
  void li.offsetWidth;
  li.classList.add('flash');
}

// Loops panel: status line, the ⋯ menu and New.
const libStatus = (t) => {
  $('libStatus').textContent = t;
};
$('libMore').onclick = (e) => {
  const m = e.currentTarget.nextElementSibling;
  closeMenus(m);
  m.hidden = !m.hidden;
  e.currentTarget.setAttribute('aria-expanded', !m.hidden);
  if (!m.hidden) m.querySelector('button')?.focus();
};
function newBlank() {
  const prev = S.name || 'Untitled loop',
    had = S.bars.some((b) => INSTR.some((i) => b[i.id].some((v) => v)));
  commit();
  solo = null;
  S = { name: 'Untitled loop', tempo: S.tempo, beats: 4, sub: 4, bars: [blankBar(16, 'Bar 1')] };
  persist();
  renderAll();
  if (had) appStatus(`Started a new loop. Undo brings “${prev}” back.`, 'info');
}
$('newLoop').onclick = () => {
  newBlank();
  closeOv('libOv');
};
