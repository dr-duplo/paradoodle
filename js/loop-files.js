// Exporting and importing loops as JSON files.

// ---------- loop files ----------
const FILE_TAG = 'groove-sketchpad-loops';

const fileSlug = (name) =>
  (name || 'drum-loop')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'drum-loop';
async function exportLoopFile(loops, filename) {
  const text = JSON.stringify(
    { app: FILE_TAG, version: 1, exported: new Date().toISOString(), loops },
    null,
    1,
  );
  const what =
    loops.length === 1 ? `“${loops[0].name || 'Untitled loop'}”` : `${loops.length} loops`;
  await Promise.race([dlReady, new Promise((r) => setTimeout(r, 1500))]);
  if (downloads) {
    try {
      if (!downloads.native) libStatus('Confirm the save…');
      await downloads.save({ filename, data: text });
      libStatus(`Exported ${what}.`);
    } catch (err) {
      libStatus(err?.code === 'declined' ? 'Export cancelled.' : 'Could not save the file here.');
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    libStatus(`Saving files isn't available here, so ${what} was copied to the clipboard as text.`);
  } catch {
    libStatus("Saving files isn't available in this browser.");
  }
}
const exportOne = (st) => {
  const c = JSON.parse(JSON.stringify(st));
  delete c.example;
  delete c.libId;
  return exportLoopFile([c], `${fileSlug(c.name)}.json`);
};

$('exportLoops').onclick = () => {
  closeMenus();
  const items = lib().map((it) => it.state);
  if (!items.length) {
    exportOne(S);
    return;
  }
  exportLoopFile(items, 'groove-loops.json');
};
$('importFile').onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 2e6) {
    libStatus(`${file.name} is too large to be a loop file (limit 2 MB).`);
    return;
  }
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    libStatus(`${file.name} isn't a loop file. Choose a .json file exported from Paradoodle.`);
    return;
  }
  const all = Array.isArray(data) ? data : Array.isArray(data?.loops) ? data.loops : [data];
  const raw = all.slice(0, 200);
  const loops = raw
    .map((x) => {
      try {
        return cleanLoop(x);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!loops.length) {
    libStatus(`No loops found in ${file.name}.`);
    return;
  }
  const l = lib(),
    names = new Set(l.map((x) => x.state.name || 'Untitled loop'));
  loops.forEach((st) => {
    const base = st.name || 'Untitled loop';
    let nm = base,
      k = 2;
    while (names.has(nm)) nm = `${base} (${k++})`;
    st.name = nm;
    names.add(nm);
    l.unshift({ id: newId(), state: st, at: Date.now() });
  });
  if (!store.set('groove.library', l)) {
    libStatus("Couldn't import: this browser's storage is full or blocked.");
    return;
  }
  renderLib();
  const skipped = all.length - loops.length;
  libStatus(
    `Imported ${loops.length} loop${loops.length > 1 ? 's' : ''}${skipped ? `, skipped ${skipped} that couldn't be read` : ''}. Tap Open to load one.`,
  );
};
