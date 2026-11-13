// Exporting and importing loops as JSON files.

// ---------- loop files ----------
const FILE_TAG = 'groove-sketchpad-loops';

const fileSlug = (name) =>
  (name || 'drum-groove')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'drum-groove';
async function exportLoopFile(loops, filename) {
  const text = JSON.stringify(
    { app: FILE_TAG, version: 1, exported: new Date().toISOString(), loops },
    null,
    1,
  );
  const what =
    loops.length === 1 ? `“${loops[0].name || 'Untitled groove'}”` : `${loops.length} grooves`;
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
  exportLoopFile(items, 'paradoodle-grooves.json');
};
$('importFile').onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 2e6) {
    libStatus(`${file.name} is too large to be a groove file (limit 2 MB).`);
    return;
  }
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    libStatus(`${file.name} isn't a groove file. Choose a .json file exported from Paradoodle.`);
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
    libStatus(`No grooves found in ${file.name}.`);
    return;
  }
  const l = lib(),
    names = new Set(l.map((x) => x.state.name || 'Untitled groove'));
  loops.forEach((st) => {
    const nm = freeName(st.name || 'Untitled groove', names);
    st.name = nm;
    names.add(nm);
    l.unshift({ id: newId(), state: st, at: Date.now() });
  });
  if (!store.set('groove.library', l)) {
    libStatus("Couldn't import: this browser's storage is full or blocked.");
    return;
  }
  renderLib();
  const unreadable = raw.length - loops.length,
    overLimit = all.length - raw.length,
    skipped = [
      unreadable && `${unreadable} that couldn't be read`,
      overLimit && `${overLimit} over the limit of 200 per file`,
    ].filter(Boolean);
  libStatus(
    `Imported ${loops.length} groove${loops.length > 1 ? 's' : ''}${skipped.length ? `, skipped ${skipped.join(' and ')}` : ''}. Tap Open to load one.`,
  );
};
