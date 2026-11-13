// Share links: packs a whole loop into a short #paradoodle-... code,
// unpacks it again, keeps the page address in step with every edit,
// and opens a loop from any pasted text that contains such a code.

// ---------- share links ----------
// The viewer passes only a plain #name (letters, digits, hyphens) from the link to the page,
// so a loop is bit-packed and written in base32 (0-9a-v). Keep INSTR order and arts stable:
// links already shared decode against it.
const SHARE_BASE = location.href.split('#')[0];
// Every code starts with this tag, so a loop can be found inside any text or URL.
const LINK_TAG = 'paradoodle-';
const LINK_IN_TEXT = /paradoodle-([0-9a-v]+)/;
const loopHash = (st) => '#' + LINK_TAG + packLoop(st);
const WHO_CAN_OPEN = 'Anyone with the link can open it.';
const B32 = '0123456789abcdefghijklmnopqrstuv';
const artBits = (ins) => Math.ceil(Math.log2(ins.arts.length + 1));
// The rows a link of each format holds, in bit order. Format 3 came before the toms.
const LINK_ROWS = {
  3: ['crash', 'ride', 'hh', 'snare', 'kick', 'hhf'].map((id) => INSTR.find((i) => i.id === id)),
  4: INSTR,
};
// CRC-10 (polynomial 0x233) over the code's characters, written as two more characters.
// It catches any damage within two neighbouring characters (a typo, two swapped characters)
// and all but about 1 in 1000 other changes, such as a link that was cut off.
function crc10(code) {
  let reg = 0;
  for (const ch of code) {
    const v = B32.indexOf(ch);
    for (let j = 4; j >= 0; j--) {
      const top = ((reg >> 9) & 1) ^ ((v >> j) & 1);
      reg = (reg << 1) & 0x3ff;
      if (top) reg ^= 0x233;
    }
  }
  return B32[reg >> 5] + B32[reg & 31];
}
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
  put(4, 4);
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
  return out + crc10(out);
}
function unpackLoop(code) {
  if (!/^[0-9a-v]{8,8000}$/.test(code)) return null;
  // every code ends in its checksum; a code that fails it was mistyped or cut off
  const body = code.slice(0, -2);
  if (crc10(body) !== code.slice(-2)) return null;
  code = body;
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
  const ver = get(4),
    rows = LINK_ROWS[ver];
  if (!rows) return null;
  const beats = get(3) + 2,
    sub = [2, 3, 4][get(2)],
    tempo = get(8) + 40,
    swing = 0.5 + get(5) / 100;
  const hmask = get(rows.length),
    nb = get(3) + 1,
    name = getStr();
  if (!sub || beats > 7) return null;
  const n = beats * sub,
    bars = [];
  for (let i = 0; i < nb; i++) {
    const bar = { name: get(1) ? `Bar ${i + 1}` : getStr() };
    const umask = get(rows.length);
    rows.forEach((ins, r) => {
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
      hidden: rows.filter((_, i) => hmask & (1 << i)).map((i) => i.id),
      bars,
    },
    'Shared groove',
  );
}
// Copies the groove's link. The link itself shows up only when the browser won't let us copy,
// so it can be copied by hand.
function shareLoop(st) {
  const hash = loopHash(st),
    url = SHARE_BASE + hash;
  const box = $('shareBox'),
    inp = $('shareUrl');
  inp.value = url;
  box.hidden = true;
  try {
    history.replaceState(null, '', hash);
  } catch {}
  const nm = st.name || 'Untitled groove';
  const copied = () => libStatus(`Link to “${nm}” copied. ${WHO_CAN_OPEN}`);
  const byHand = () => {
    box.hidden = false;
    libStatus(`Copy the link to “${nm}” below. ${WHO_CAN_OPEN}`);
    inp.select();
  };
  try {
    navigator.clipboard.writeText(url).then(copied, byHand);
  } catch {
    byHand();
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
// The tick on the share button and the status line after a link was copied.
function showLinkCopied(nm) {
  const btn = $('nameShare'),
    msg = `Link to “${nm}” copied. ${WHO_CAN_OPEN}`;
  btn.innerHTML = ICON_OK;
  btn.classList.add('ok');
  appStatus(msg, 'info');
  clearTimeout(nameShareT);
  nameShareT = setTimeout(() => {
    btn.innerHTML = ICON_LINK;
    btn.classList.remove('ok');
    if ($('appStatus').textContent === msg) appStatus('');
  }, 2500);
}
$('shareCopy').onclick = () => {
  closeMenus();
  const hash = loopHash(S),
    url = SHARE_BASE + hash,
    nm = S.name || 'Untitled groove';
  try {
    history.replaceState(null, '', hash);
  } catch {}
  const fallback = () => {
    $('libBtn').click();
    shareLoop(S);
  };
  try {
    navigator.clipboard.writeText(url).then(() => showLinkCopied(nm), fallback);
  } catch {
    fallback();
  }
};
// Copying (⌘C / Ctrl+C) with nothing selected and outside a text field copies the groove's link,
// just like Copy link in the share menu. Selected text still copies as usual.
document.addEventListener('copy', (e) => {
  if (!e.clipboardData || e.target.closest?.('input, textarea, [contenteditable]')) return;
  if (String(getSelection() || '')) return;
  const hash = loopHash(S);
  e.clipboardData.setData('text/plain', SHARE_BASE + hash);
  e.preventDefault();
  try {
    history.replaceState(null, '', hash);
  } catch {}
  showLinkCopied(S.name || 'Untitled groove');
});
// The QR code: the groove's link drawn as a QR code, big enough to scan from another phone.
// Black on white with a four-module margin in both themes, as scanners expect. The logo in the
// middle hides some modules, which the highest error correction (H, about 30 %) makes up for; a
// groove too long for H gets a plain code with medium correction instead.
// The logo is the same drawing as icons/icon.svg.
const QR_LOGO =
  '<rect width="512" height="512" rx="96" fill="#1a2029"/>' +
  '<circle cx="256" cy="256" r="168" fill="#222a35" stroke="#e7ebf0" stroke-width="30"/>' +
  '<g fill="#1a2029"><circle cx="411.2" cy="320.3" r="7"/><circle cx="320.3" cy="411.2" r="7"/>' +
  '<circle cx="191.7" cy="411.2" r="7"/><circle cx="100.8" cy="320.3" r="7"/>' +
  '<circle cx="100.8" cy="191.7" r="7"/><circle cx="191.7" cy="100.8" r="7"/>' +
  '<circle cx="320.3" cy="100.8" r="7"/><circle cx="411.2" cy="191.7" r="7"/></g>' +
  '<path d="M140 293.4C169 215.2 221.2 209.3 215.4 261.6C209.6 316.6 154.5 310.9 180.6 261.6' +
  'C206.7 212.2 264.7 203.6 273.4 258.6C282.1 313.8 227 316.6 250.2 264.4' +
  'C273.4 212.2 337.2 209.3 345.9 261.6C351.7 299.2 328.5 316.6 372 270.2" fill="none" ' +
  'stroke="#e2a93f" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>';
function qrMake(text, level) {
  const qr = window.qrcode(0, level);
  qr.addData(text, 'Byte');
  qr.make();
  return qr;
}
function qrSvg(text) {
  let qr,
    logo = true;
  try {
    qr = qrMake(text, 'H');
  } catch {
    qr = qrMake(text, 'M');
    logo = false;
  }
  const n = qr.getModuleCount(),
    pad = 4,
    size = n + 2 * pad;
  let d = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + pad} ${y + pad}h1v1h-1z`;
  let mark = '';
  if (logo) {
    // about a fifth of the width, on a white patch one module wider all round
    const w = Math.round(n * 0.2) | 1,
      at = pad + (n - w) / 2;
    mark =
      `<rect x="${at - 1}" y="${at - 1}" width="${w + 2}" height="${w + 2}" rx="1.2" fill="#fff"/>` +
      `<svg x="${at}" y="${at}" width="${w}" height="${w}" viewBox="0 0 512 512" shape-rendering="auto">${QR_LOGO}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/>${mark}</svg>`;
}
$('shareQr').onclick = () => {
  closeMenus();
  const hash = loopHash(S),
    url = SHARE_BASE + hash,
    box = $('qrBox');
  try {
    history.replaceState(null, '', hash);
  } catch {}
  $('qrName').textContent = S.name || 'Untitled groove';
  $('qrHint').textContent = WHO_CAN_OPEN;
  box.textContent = 'Making the QR code…';
  openOv('qrOv');
  loadLib('qrcode').then(
    () => {
      try {
        box.innerHTML = qrSvg(url);
      } catch {
        box.textContent = 'This groove is too long for a QR code. Copy the link instead.';
      }
    },
    () => {
      box.textContent = "The QR code couldn't be made without a connection. Copy the link instead.";
    },
  );
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
    appStatus("This share link is damaged or incomplete, so the groove couldn't be opened.");
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
    `Opened the shared groove “${st.name}”. Undo goes back to your previous draft; Save keeps it.`,
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
