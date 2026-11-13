// Share links: packs a whole loop into a short #paradoodle-... code,
// unpacks it again, keeps the page address in step with every edit,
// and opens a loop from any pasted text that contains such a code.

// ---------- share links ----------
// The viewer passes only a plain #name (letters, digits, hyphens) from the link to the page,
// so a loop is bit-packed and written in base32 (0-9a-v). Keep INSTR order and arts stable:
// old links decode against it.
const SHARE_BASE = location.href.split('#')[0];
// Every code starts with this tag, so a loop can be found inside any text or URL.
const LINK_TAG = 'paradoodle-';
const LINK_IN_TEXT = /paradoodle-([0-9a-v]+)/;
const loopHash = (st) => '#' + LINK_TAG + packLoop(st);
const WHO_CAN_OPEN = 'Anyone with the link can open it.';
const B32 = '0123456789abcdefghijklmnopqrstuv';
const artBits = (ins) => Math.ceil(Math.log2(ins.arts.length + 1));
function packLoop(st) {
  const bits = [];
  const put = (v, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1);
  };
  const enc = new TextEncoder();
  const putStr = (t) => {
    let b = enc.encode(t);
    while (b.length > 255) {
      t = t.slice(0, -1);
      b = enc.encode(t);
    }
    put(b.length, 8);
    b.forEach((x) => put(x, 8));
  };
  put(2, 4);
  put(st.beats - 2, 3);
  put({ 2: 0, 3: 1, 4: 2 }[st.sub], 2);
  put(st.tempo - 40, 8);
  put(Math.max(0, Math.min(25, Math.round(((st.swing || 0.5) - 0.5) * 100))), 5);
  put(
    INSTR.reduce((m, ins, i) => m | ((st.hidden || []).includes(ins.id) ? 1 << i : 0), 0),
    INSTR.length,
  );
  put(st.bars.length - 1, 3);
  putStr(st.name || '');
  const n = st.beats * st.sub;
  st.bars.forEach((bar, i) => {
    const def = bar.name === `Bar ${i + 1}`;
    put(def ? 1 : 0, 1);
    if (!def) putStr(bar.name || '');
    const used = INSTR.filter((ins) => bar[ins.id].some((v) => v));
    put(
      INSTR.reduce((m, ins, r) => m | (used.includes(ins) ? 1 << r : 0), 0),
      INSTR.length,
    );
    used.forEach((ins) => {
      const w = artBits(ins);
      for (let k = 0; k < n; k++) put(bar[ins.id][k] || 0, w);
    });
  });
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    let v = 0;
    for (let j = 0; j < 5; j++) v = (v << 1) | (bits[i + j] || 0);
    out += B32[v];
  }
  return out;
}
function unpackLoop(code) {
  if (!/^[0-9a-v]{8,8000}$/.test(code)) return null;
  const bits = [];
  for (const ch of code) {
    const v = B32.indexOf(ch);
    for (let j = 4; j >= 0; j--) bits.push((v >> j) & 1);
  }
  let p = 0;
  const get = (n) => {
    if (p + n > bits.length) throw new Error('short');
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | bits[p++];
    return v;
  };
  const dec = new TextDecoder();
  const getStr = () => {
    const len = get(8),
      b = new Uint8Array(len);
    for (let i = 0; i < len; i++) b[i] = get(8);
    return dec.decode(b);
  };
  const ver = get(4);
  if (ver !== 1 && ver !== 2) return null;
  const beats = get(3) + 2,
    sub = [2, 3, 4][get(2)],
    tempo = get(8) + 40,
    swing = 0.5 + get(5) / 100;
  const hmask = get(INSTR.length),
    nb = get(3) + 1,
    name = getStr();
  if (!sub || beats > 7) return null;
  const n = beats * sub,
    bars = [];
  for (let i = 0; i < nb; i++) {
    const bar = { name: get(1) ? `Bar ${i + 1}` : getStr() };
    const umask = ver === 1 ? (1 << INSTR.length) - 1 : get(INSTR.length);
    INSTR.forEach((ins, r) => {
      const w = artBits(ins);
      bar[ins.id] = Array.from({ length: n }, () => (umask & (1 << r) ? get(w) : 0));
    });
    bars.push(bar);
  }
  return cleanLoop(
    {
      name,
      tempo,
      beats,
      sub,
      swing: swing > 0.5 ? swing : undefined,
      hidden: INSTR.filter((_, i) => hmask & (1 << i)).map((i) => i.id),
      bars,
    },
    'Shared loop',
  );
}
function shareLoop(st) {
  const hash = loopHash(st),
    url = SHARE_BASE + hash;
  const box = $('shareBox'),
    inp = $('shareUrl');
  inp.value = url;
  box.hidden = false;
  try {
    history.replaceState(null, '', hash);
  } catch {}
  const nm = st.name || 'Untitled loop';
  const done = (ok) =>
    libStatus(
      ok
        ? `Link to “${nm}” copied. ${WHO_CAN_OPEN}`
        : `Copy the link to “${nm}” below. ${WHO_CAN_OPEN}`,
    );
  try {
    navigator.clipboard.writeText(url).then(
      () => done(true),
      () => {
        done(false);
        inp.select();
      },
    );
  } catch {
    done(false);
    inp.select();
  }
}
$('shareCurrent').onclick = () => {
  closeMenus();
  shareLoop(S);
};
let nameShareT = 0;
$('nameShare').onclick = (e) => {
  const m = e.currentTarget.nextElementSibling;
  closeMenus(m);
  m.hidden = !m.hidden;
  e.currentTarget.setAttribute('aria-expanded', !m.hidden);
  if (!m.hidden) m.querySelector('button')?.focus();
};
$('shareCopy').onclick = () => {
  closeMenus();
  const btn = $('nameShare'),
    hash = loopHash(S),
    url = SHARE_BASE + hash,
    nm = S.name || 'Untitled loop';
  try {
    history.replaceState(null, '', hash);
  } catch {}
  const fallback = () => {
    $('libBtn').click();
    shareLoop(S);
  };
  const ok = () => {
    btn.innerHTML = ICON_OK;
    btn.classList.add('ok');
    const msg = `Link to “${nm}” copied. ${WHO_CAN_OPEN}`;
    appStatus(msg, 'info');
    clearTimeout(nameShareT);
    nameShareT = setTimeout(() => {
      btn.innerHTML = ICON_LINK;
      btn.classList.remove('ok');
      if ($('appStatus').textContent === msg) appStatus('');
    }, 2500);
  };
  try {
    navigator.clipboard.writeText(url).then(ok, fallback);
  } catch {
    fallback();
  }
};
$('copyShare').onclick = () => {
  const inp = $('shareUrl');
  try {
    navigator.clipboard.writeText(inp.value).then(
      () => libStatus('Link copied.'),
      () => {
        inp.select();
        libStatus('Press and hold the link to copy it.');
      },
    );
  } catch {
    inp.select();
  }
};
$('shareUrl').addEventListener('focus', (e) => e.target.select());
function openFromLink() {
  if (!location.hash.startsWith('#' + LINK_TAG)) return;
  const code = location.hash.slice(1 + LINK_TAG.length);
  let st;
  try {
    st = unpackLoop(code);
  } catch {
    st = null;
  }
  if (!st) {
    appStatus("This share link is damaged or incomplete, so the loop couldn't be opened.");
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {}
    return;
  }
  let same = false;
  try {
    same = packLoop(S) === code;
  } catch {}
  if (same) return;
  commit();
  loadGroove(st);
  appStatus(
    `Opened the shared loop “${st.name}”. Undo goes back to your previous draft; Save keeps it.`,
    'info',
  );
}
addEventListener('hashchange', openFromLink);
// Pasting a link (or a chat message that contains one) anywhere outside a text field opens the loop.
document.addEventListener('paste', (e) => {
  const t = e.target;
  if (t.closest?.('input, textarea, [contenteditable]')) return;
  const m = LINK_IN_TEXT.exec(e.clipboardData?.getData('text') || '');
  if (!m) return;
  e.preventDefault();
  location.hash = LINK_TAG + m[1];
});
