// Everything you do to a loop: tapping cells, naming and moving bars,
// solo, duplicate/clear/remove, tempo, time signature, feel, swing and the kit.

// ---------- editing ----------
let holdTimer = null,
  held = false;
const bars = $('bars');
bars.addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.cell');
  if (!c) return;
  held = false;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    held = true;
    const ins = INSTR[c.dataset.i],
      bar = S.bars[c.dataset.b];
    if (bar[ins.id][c.dataset.s]) {
      commit();
      bar[ins.id][c.dataset.s] = 0;
      paintCell(c, 0, ins, countLabels()[c.dataset.s], +c.dataset.b);
      changed();
      navigator.vibrate?.(12);
    }
  }, 450);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
  bars.addEventListener(ev, () => clearTimeout(holdTimer)),
);
let nameEditing = false;
bars.addEventListener('input', (e) => {
  const inp = e.target.closest('.barname');
  if (!inp) return;
  if (!nameEditing) {
    commit();
    nameEditing = true;
  }
  S.bars[+inp.dataset.b].name = inp.value;
  persist();
});
bars.addEventListener('focusout', (e) => {
  const inp = e.target.closest('.barname');
  if (!inp) return;
  const b = +inp.dataset.b,
    bar = S.bars[b];
  if (!bar) return;
  if (!inp.value.trim()) {
    const h = nameEditing && hist.length ? JSON.parse(hist[hist.length - 1]).bars[b] : null;
    bar.name = barName(h, b);
    inp.value = bar.name;
    persist();
  }
  if (nameEditing) {
    nameEditing = false;
    changed();
  }
});
bars.addEventListener('keydown', (e) => {
  const inp = e.target.closest('.barname');
  if (!inp) return;
  if (e.key === 'Enter' || e.key === 'Escape') inp.blur();
});
bars.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.cell')) e.preventDefault();
});
bars.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    barAction(act.dataset.act, +act.dataset.b, act);
    return;
  }
  const c = e.target.closest('.cell');
  if (!c) return;
  if (held) {
    held = false;
    return;
  }
  const ins = INSTR[c.dataset.i],
    b = +c.dataset.b,
    s = +c.dataset.s,
    bar = S.bars[b];
  commit();
  const v = (bar[ins.id][s] + 1) % (ins.arts.length + 1);
  bar[ins.id][s] = v;
  paintCell(c, v, ins, countLabels()[s], b);
  changed();
  if (v && !playing && ensureAudio())
    triggerSound(ins.id, ins.arts[v - 1], audio.currentTime + 0.01);
});
let solo = null;
function setSolo(b) {
  solo = b === null || solo === b ? null : b;
  renderBars();
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function snapshotBars() {
  const m = new Map();
  [...$('bars').children].forEach((sec) => {
    if (sec._bar) m.set(sec._bar, sec.getBoundingClientRect().top);
  });
  return m;
}
function animateBars(before) {
  if (reducedMotion()) return;
  [...$('bars').children].forEach((sec) => {
    const old = before.get(sec._bar);
    if (old === undefined) {
      sec.animate(
        [
          { opacity: 0, transform: 'translateY(-10px) scale(.98)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
      return;
    }
    const dy = old - sec.getBoundingClientRect().top;
    if (Math.abs(dy) > 1)
      sec.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration: 260,
        easing: 'cubic-bezier(.2,.7,.2,1)',
      });
  });
}
let removing = false;
// fades bar i out, then runs fn; ignores further removals until fn has run
function removeBarAnimated(i, fn) {
  if (removing) return;
  removing = true;
  const sec = $('bars').children[i];
  const finish = () => {
    try {
      fn();
    } finally {
      removing = false;
    }
  };
  if (!sec || reducedMotion()) {
    finish();
    return;
  }
  const done = sec
    .animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'scale(.97)' },
      ],
      { duration: 160, easing: 'ease-in', fill: 'forwards' },
    )
    .finished.catch(() => {});
  Promise.race([done, new Promise((r) => setTimeout(r, 260))]).then(finish);
}
function closeMenus(except) {
  document.querySelectorAll('.barmenu').forEach((m) => {
    if (m !== except) {
      m.hidden = true;
      m.previousElementSibling?.setAttribute('aria-expanded', 'false');
    }
  });
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.barmenu, [data-act="menu"]')) closeMenus();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenus();
});
function barAction(act, b, el) {
  if (act === 'menu') {
    const m = el.nextElementSibling;
    closeMenus(m);
    m.hidden = !m.hidden;
    el.setAttribute('aria-expanded', !m.hidden);
    if (!m.hidden) m.querySelector('button:not([disabled])')?.focus();
    return;
  }
  closeMenus();
  if (act === 'solo') {
    setSolo(b);
    return;
  }
  if (act === 'up' || act === 'down') {
    const to = act === 'up' ? b - 1 : b + 1;
    if (to < 0 || to >= S.bars.length) return;
    commit();
    [S.bars[b], S.bars[to]] = [S.bars[to], S.bars[b]];
    if (solo === b) solo = to;
    else if (solo === to) solo = b;
    const before = snapshotBars();
    changed();
    renderBars();
    animateBars(before);
    const sec = $('bars').children[to];
    sec?.scrollIntoView({
      block: 'nearest',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    sec?.querySelector(`[data-act="${act}"]:not([disabled])`)?.focus({ preventScroll: true });
    return;
  }
  if (act === 'del') {
    if (S.bars.length <= 1) return;
    const target = S.bars[b];
    removeBarAnimated(b, () => {
      const i = S.bars.indexOf(target);
      if (i < 0 || S.bars.length <= 1) return;
      if (solo !== null) {
        if (solo === i) solo = null;
        else if (solo > i) solo--;
      }
      commit();
      const before = snapshotBars();
      S.bars.splice(i, 1);
      changed();
      renderBars();
      animateBars(before);
    });
    return;
  }
  if (act === 'dup' && solo !== null && solo > b) solo++;
  commit();
  const beforeDup = snapshotBars();
  if (act === 'dup' && S.bars.length < 8) {
    const copy = JSON.parse(JSON.stringify(S.bars[b])),
      src = barName(S.bars[b], b);
    copy.name = DEFAULT_NAME.test(src) ? nextBarName() : `${src} (copy)`.slice(0, 40);
    S.bars.splice(b + 1, 0, copy);
  } else if (act === 'clear') INSTR.forEach((i) => S.bars[b][i.id].fill(0));
  else {
    hist.pop();
    syncHist();
    return;
  }
  changed();
  renderBars();
  animateBars(beforeDup);
}
function addBar() {
  if (S.bars.length >= 8) return;
  commit();
  const before = snapshotBars();
  S.bars.push(blankBar(steps(), nextBarName()));
  changed();
  renderBars();
  animateBars(before);
  const last = $('bars').lastElementChild;
  last?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}
$('addBar').onclick = addBar;
$('barsPlus').onclick = addBar;
$('barsMinus').onclick = () => {
  if (S.bars.length <= 1) return;
  removeBarAnimated(S.bars.length - 1, () => {
    if (S.bars.length <= 1) return;
    if (solo === S.bars.length - 1) solo = null;
    commit();
    S.bars.pop();
    changed();
    renderBars();
  });
};
function remap(beats, sub) {
  const n2 = beats * sub;
  S.bars = S.bars.map((bar) =>
    Object.fromEntries(
      INSTR.map((ins) => {
        const a = Array(n2).fill(0);
        bar[ins.id].forEach((v, i) => {
          if (!v) return;
          const j = (i / S.sub) * sub;
          const r = Math.round(j);
          if (Math.abs(j - r) < 1e-6 && r < n2) a[r] = v;
        });
        return [ins.id, a];
      }).concat([['name', bar.name]]),
    ),
  );
  S.beats = beats;
  S.sub = sub;
}
$('beats').onchange = (e) => {
  commit();
  remap(+e.target.value, S.sub);
  changed();
  renderBars();
};
$('sub').onchange = (e) => {
  commit();
  remap(S.beats, +e.target.value);
  changed();
  updateSwingUI();
  renderBars();
};
let swingCommitted = false;
$('swing').oninput = (e) => {
  if (!swingCommitted) {
    commit();
    swingCommitted = true;
  }
  S.swing = +e.target.value / 100;
  updateSwingUI();
  changed();
};
$('swing').onchange = () => {
  swingCommitted = false;
};
function fitName() {
  const el = $('name');
  if (!el) return;
  const cs = getComputedStyle(el),
    c = fitName.c || (fitName.c = document.createElement('canvas').getContext('2d'));
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  el.style.width =
    Math.ceil(
      c.measureText(el.value || 'Untitled groove').width +
        parseFloat(cs.paddingLeft) +
        parseFloat(cs.paddingRight) +
        6,
    ) + 'px';
}
function commitBurst(key) {
  if (burst === key) return;
  commit();
  burst = key;
}
$('name').oninput = (e) => {
  commitBurst('name');
  S.name = e.target.value;
  fitName();
  changed();
};
$('name').onchange = () => {
  burst = null;
};
addEventListener('resize', fitName);
try {
  document.fonts.ready.then(fitName);
} catch {}
$('tempo').oninput = (e) => {
  commitBurst('tempo');
  S.tempo = +e.target.value;
  $('bpm').textContent = S.tempo;
  changed();
};
$('tempo').onchange = () => {
  burst = null;
};
function stepHist(from, to) {
  if (!from.length) return;
  burst = null;
  const names = (st) => st.bars.map((b) => b.name).join('\n'),
    before = names(S);
  to.push(snap());
  if (to.length > 80) to.shift();
  S = JSON.parse(from.pop());
  // solo is a bar index: keep it if the bars are the same, else take the one saved with the step
  const saved = S._solo ?? null;
  delete S._solo;
  if (names(S) !== before) solo = saved;
  if (solo !== null && solo >= S.bars.length) solo = null;
  syncHist();
  persist();
  renderAll();
}
$('undo').onclick = () => stepHist(hist, fut);
$('redo').onclick = () => stepHist(fut, hist);
document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const t = e.target;
  if (
    t.closest?.('textarea, select, [contenteditable]') ||
    (t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type))
  )
    return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) {
    e.preventDefault();
    $('undo').click();
  } else if ((k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey)) {
    e.preventDefault();
    $('redo').click();
  }
});
$('startBlank').onclick = () => {
  commit();
  solo = null;
  S = { name: 'Untitled groove', tempo: S.tempo, beats: 4, sub: 4, bars: [blankBar(16, 'Bar 1')] };
  persist();
  renderAll();
};
