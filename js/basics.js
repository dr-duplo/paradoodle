// The drum kit (rows and their sounds), the note symbols drawn in the grid,
// and a few small helpers used everywhere: $() for elements, esc() for HTML,
// and store for localStorage that never throws.

const INSTR = [
  { id: 'crash', label: 'Crash', cym: true, arts: [{ k: 'hit', name: 'Crash', g: 'star', v: 1 }] },
  {
    id: 'ride',
    label: 'Ride',
    cym: true,
    arts: [
      { k: 'hit', name: 'Hit', g: 'x', v: 0.9 },
      { k: 'ghost', name: 'Ghost', g: 'gx', v: 0.3 },
    ],
  },
  {
    id: 'hh',
    label: 'Hi-hat',
    cym: true,
    arts: [
      { k: 'closed', name: 'Closed', g: 'x', v: 0.9 },
      { k: 'open', name: 'Open', g: 'o', v: 0.9 },
      { k: 'ghost', name: 'Ghost', g: 'gx', v: 0.3 },
    ],
  },
  {
    id: 'snare',
    label: 'Snare',
    arts: [
      { k: 'hit', name: 'Hit', g: 'dot', v: 1 },
      { k: 'rim', name: 'Rim', g: 'rim', v: 1 },
      { k: 'ghost', name: 'Ghost', g: 'gdot', v: 0.22 },
    ],
  },
  {
    id: 'tom',
    label: 'Toms',
    arts: [
      { k: 'high', name: 'High', g: 'tomhi', v: 0.95 },
      { k: 'mid', name: 'Mid', g: 'tommid', v: 0.95 },
      { k: 'floor', name: 'Floor', g: 'tomlo', v: 1 },
    ],
  },
  { id: 'kick', label: 'Bass', arts: [{ k: 'hit', name: 'Hit', g: 'dot', v: 1 }] },
  { id: 'hhf', label: 'HH foot', cym: true, arts: [{ k: 'hit', name: 'HH foot', g: 'x', v: 0.8 }] },
];
const PAREN = 'M7.2 3.5Q2.4 12 7.2 20.5M16.8 3.5Q21.6 12 16.8 20.5';
const GLYPHS = {
  x: [{ d: 'M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5', s: 1 }],
  star: [{ d: 'M12 4.5V19.5M5.5 8.25L18.5 15.75M18.5 8.25L5.5 15.75', s: 1.05 }],
  o: [{ d: 'M5.6 12a6.4 6.4 0 1 0 12.8 0a6.4 6.4 0 1 0 -12.8 0', s: 1 }],
  gx: [
    { d: PAREN, s: 0.7 },
    { d: 'M9.6 9.6L14.4 14.4M14.4 9.6L9.6 14.4', s: 1 },
  ],
  dot: [{ d: 'M5.6 12a6.4 6.4 0 1 0 12.8 0a6.4 6.4 0 1 0 -12.8 0', f: 1 }],
  // toms: a smaller dot high, in the middle or low in the cell, as on the staff
  tomhi: [{ d: 'M7.4 7.4a4.6 4.6 0 1 0 9.2 0a4.6 4.6 0 1 0 -9.2 0', f: 1 }],
  tommid: [{ d: 'M7.4 12a4.6 4.6 0 1 0 9.2 0a4.6 4.6 0 1 0 -9.2 0', f: 1 }],
  tomlo: [{ d: 'M7.4 16.6a4.6 4.6 0 1 0 9.2 0a4.6 4.6 0 1 0 -9.2 0', f: 1 }],
  rim: [
    { d: 'M4.4 12a7.6 7.6 0 1 0 15.2 0a7.6 7.6 0 1 0 -15.2 0', s: 1 },
    { d: 'M8.7 8.7L15.3 15.3M15.3 8.7L8.7 15.3', s: 1 },
  ],
  gdot: [
    { d: PAREN, s: 0.7 },
    { d: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', f: 1 },
  ],
};
const svg = (g) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  GLYPHS[g]
    .map((p) =>
      p.f
        ? `<path d="${p.d}" fill="currentColor"/>`
        : `<path d="${p.d}" fill="none" stroke="currentColor" stroke-width="${2.3 * p.s}" stroke-linecap="round"/>`,
    )
    .join('') +
  '</svg>';

const $ = (id) => document.getElementById(id);
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

// Icons of the Save and Share buttons, plus the check mark they show after a tap.
// Libraries loaded from CDNs on first use. The browser checks each file against its hash and
// refuses it if it changed; scripts/build.mjs also allows exactly these URLs in the page's CSP.
const LIBS = {
  vexflow: {
    src: 'https://cdn.jsdelivr.net/npm/vexflow@4.2.3/build/cjs/vexflow.js',
    integrity: 'sha384-HcSKHU8C+2rx18IlCMSlVWuygC4W9XRY8ebpaoE3Tg1iJO0g64QCxO2vO5HXIokW',
  },
  jspdf: {
    src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js',
    integrity: 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3',
  },
};
const libLoads = {};
function loadLib(name) {
  const { src, integrity } = LIBS[name];
  libLoads[name] ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = 'anonymous';
    s.onload = res;
    s.onerror = () => {
      delete libLoads[name];
      rej(new Error(`${name} failed to load`));
    };
    document.head.appendChild(s);
  });
  return libLoads[name];
}
const ICON_SAVE = $('titleSave').innerHTML,
  ICON_LINK = $('nameShare').innerHTML,
  ICON_OK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
