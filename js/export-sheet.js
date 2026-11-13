// Draws the printable drum sheet on a canvas and saves it as PNG or PDF.

// ---------- sheet export ----------
const FD = '"Barlow Condensed","Arial Narrow",sans-serif',
  FB = 'Inter,system-ui,sans-serif',
  FM = '"JetBrains Mono",Menlo,monospace';
function drawGlyph(ctx, g, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  GLYPHS[g].forEach((p) => {
    const path = new Path2D(p.d);
    if (p.f) ctx.fill(path);
    else {
      ctx.lineWidth = 2.3 * p.s;
      ctx.stroke(path);
    }
  });
  ctx.restore();
}
// The groove's link as a QR code for the sheet's header, drawn from the same SVG as the share
// panel. Modules stay at least about 0.4 mm on A4 so the code scans from paper; without the QR
// library (offline before first use) the sheet goes without it.
async function sheetQr(url) {
  try {
    await loadLib('qrcode');
    const svg = qrSvg(url),
      modules = +svg.match(/viewBox="0 0 (\d+)/)[1];
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const size = Math.max(220, Math.ceil(modules * 3.4));
    // the code's dark modules end inside a 4-module white margin
    return { img, size, inset: (4 * size) / modules };
  } catch {
    return null;
  }
}
async function renderSheet(style) {
  try {
    await Promise.all(
      [
        `700 60px ${FD}`,
        `600 28px ${FD}`,
        `500 22px ${FB}`,
        `700 22px ${FM}`,
        `500 22px ${FM}`,
      ].map((f) => document.fonts.load(f)),
    );
  } catch {}
  let VF = null,
    note = '';
  if (style !== 'grid') {
    try {
      VF = await loadVF();
    } catch {
      style = 'grid';
      note = 'Staff notation could not load here, so this sheet shows the grid only.';
    }
  }
  const showStaff = style !== 'grid',
    showGrid = style !== 'staff';
  const W = 1654,
    M = 110,
    SC = 2,
    labelW = 150,
    n = steps(),
    labels = countLabels();
  const rowH = 66,
    countH = 44,
    headH = 40,
    gap = 54;
  const cw = (W - 2 * M - labelW) / n;
  const staffW = (W - 2 * M) / SC;
  const staffH = showStaff ? staffLayout(staffW).height * SC + 30 : 0;
  const ROWS = visibleRows();
  const barBlock = headH + countH + ROWS.length * rowH + gap;
  const gridH = showGrid ? S.bars.length * barBlock + (showStaff ? 50 : 0) : 0;
  const legendH = (showGrid ? 150 : 0) + (showStaff ? 300 : 0);
  const url = SHARE_BASE + loopHash(S),
    qr = await sheetQr(url);
  const footH = 60;
  // with a QR code, the header is as tall as the code, which sits on the left of the title
  const qrTop = M - 14,
    ruleY = qr ? Math.max(M + 126, qrTop + qr.size + 18) : M + 126,
    bodyY = ruleY + 44;
  const H = bodyY + staffH + gridH + legendH + footH + M * 0.6;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = Math.ceil(H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const INK = '#111',
    MUTED = '#666',
    LIGHT = '#D9D9D9',
    MID = '#8C8C8C';
  const sectionLabel = (t, y) => {
    ctx.textAlign = 'left';
    ctx.font = `600 22px ${FD}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(t, M, y);
  };
  ctx.textBaseline = 'alphabetic';
  // title and info line; with a QR code they sit to its right, on its bottom edge, shrunk if
  // needed to fit the width
  // the code's white margin hangs into the page margin, so its dark modules line up with the rule
  const qx = qr ? M - qr.inset : M,
    tx = qr ? qx + qr.size - qr.inset + 40 : M,
    infoY = qr ? qrTop + qr.size - qr.inset : M + 98, // on the code's last row of modules
    titlePx = qr ? 96 : 64,
    titleY = infoY - (qr ? 52 : 48),
    textW = W - M - tx;
  const fitText = (t, weight, px, family, x, yy) => {
    let size = px;
    ctx.font = `${weight} ${size}px ${family}`;
    while (size > 12 && ctx.measureText(t).width > textW)
      ctx.font = `${weight} ${--size}px ${family}`;
    ctx.fillText(t, x, yy);
  };
  ctx.fillStyle = INK;
  fitText(S.name || 'Untitled groove', 700, titlePx, FD, tx, titleY);
  ctx.fillStyle = MUTED;
  const feel = { 2: '8th notes', 3: '8th-note triplets', 4: '16th notes' }[S.sub];
  const swingTxt = S.sub !== 3 && swingPct() > 50 ? `   ·   swing ${swingPct()}%` : '';
  fitText(
    `♩ = ${S.tempo}   ·   ${S.beats}/4   ·   ${feel}${swingTxt}   ·   ${S.bars.length} bar${S.bars.length > 1 ? 's' : ''}`,
    500,
    24,
    FM,
    tx,
    infoY,
  );
  // the groove's QR code on the left; in the PDF, the code and the title link to the groove
  if (qr) {
    ctx.drawImage(qr.img, qx, qrTop, qr.size, qr.size);
    cv.link = { url, x: qx, y: qrTop, w: W - M - qx, h: qr.size };
  }
  ctx.fillStyle = INK;
  ctx.fillRect(M, ruleY, W - 2 * M, 3);
  let y = bodyY;
  if (showStaff) {
    ctx.save();
    ctx.translate(M, y);
    ctx.scale(SC, SC);
    drawStaff(VF, ctx, 0, 0, staffW);
    ctx.restore();
    y += staffH;
  }
  if (showGrid) {
    if (showStaff) {
      ctx.fillStyle = LIGHT;
      ctx.fillRect(M, y - 10, W - 2 * M, 1.5);
      sectionLabel('GRID', y + 28);
      y += 50;
    }
    const gx = M + labelW;
    S.bars.forEach((bar, b) => {
      ctx.font = `600 24px ${FD}`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'left';
      ctx.fillText(barName(bar, b).toUpperCase(), M, y + 26);
      y += headH;
      ctx.textAlign = 'center';
      labels.forEach((t, s) => {
        const beat = s % S.sub === 0;
        ctx.font = beat ? `700 24px ${FM}` : `500 19px ${FM}`;
        ctx.fillStyle = beat ? INK : MUTED;
        ctx.fillText(t, gx + cw * (s + 0.5), y + 30);
      });
      y += countH;
      const top = y,
        bottom = y + ROWS.length * rowH;
      for (let s = 0; s < n; s++)
        if (Math.floor(s / S.sub) % 2) {
          ctx.fillStyle = '#F6F6F6';
          ctx.fillRect(gx + cw * s, top, cw, bottom - top);
        }
      ROWS.forEach((ins, r) => {
        const ry = top + r * rowH;
        ctx.textAlign = 'left';
        ctx.font = `600 30px ${FD}`;
        ctx.fillStyle = INK;
        ctx.fillText(ins.label, M, ry + rowH / 2 + 10);
        bar[ins.id].forEach((v, s) => {
          if (v)
            drawGlyph(
              ctx,
              ins.arts[v - 1].g,
              gx + cw * (s + 0.5),
              ry + rowH / 2,
              Math.min(cw * 0.78, rowH * 0.62, 46),
              INK,
            );
        });
      });
      ctx.fillStyle = LIGHT;
      for (let r = 1; r < ROWS.length; r++) ctx.fillRect(gx, top + r * rowH, W - M - gx, 1.5);
      for (let s = 1; s < n; s++) {
        const beat = s % S.sub === 0;
        ctx.fillStyle = beat ? MID : LIGHT;
        ctx.fillRect(gx + cw * s - (beat ? 1 : 0.75), top, beat ? 2 : 1.5, bottom - top);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(gx, top, W - M - gx, bottom - top);
      y = bottom + gap;
    });
  }
  ctx.fillStyle = INK;
  ctx.fillRect(M, y - 10, W - 2 * M, 1.5);
  if (showStaff) {
    sectionLabel(showGrid ? 'NOTATION KEY' : 'KEY', y + 30);
    ctx.save();
    ctx.translate(M, y + 40);
    ctx.scale(SC, SC);
    drawStaffKey(VF, ctx, 0, 0, staffW);
    ctx.restore();
    y += 300;
  }
  if (showGrid) {
    sectionLabel(showStaff ? 'GRID KEY' : 'KEY', y + 30);
    let lx = M + (showStaff ? 150 : 70),
      ly = y + 30;
    ROWS.forEach((ins) =>
      ins.arts.forEach((a) => {
        const name = ins.arts.length > 1 ? `${ins.label} ${a.name.toLowerCase()}` : ins.label;
        ctx.font = `500 21px ${FB}`;
        const w = 34 + ctx.measureText(name).width + 34;
        if (lx + w > W - M) {
          lx = M + (showStaff ? 150 : 70);
          ly += 46;
        }
        drawGlyph(ctx, a.g, lx + 13, ly - 7, 28, INK);
        ctx.fillStyle = INK;
        ctx.textAlign = 'left';
        ctx.fillText(name, lx + 34, ly);
        lx += w;
      }),
    );
  }
  // footer: where the sheet came from
  const fy = cv.height - M * 0.6;
  ctx.fillStyle = LIGHT;
  ctx.fillRect(M, fy - 40, W - 2 * M, 1.5);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `500 20px ${FB}`;
  ctx.fillText('Made with', M, fy);
  const lead = ctx.measureText('Made with ').width;
  ctx.font = `700 22px ${FD}`;
  ctx.fillStyle = INK;
  ctx.fillText('PARADOODLE', M + lead, fy);
  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.font = `500 19px ${FM}`;
  ctx.fillText('dr-duplo.github.io/paradoodle', W - M, fy);
  cv.note = note;
  return cv;
}
const slug = () =>
  (S.name || 'drum-groove')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'drum-groove';
let sheetCanvas = null,
  downloads = null;
const browserDownloads = {
  native: true,
  async save({ filename, data }) {
    const blob =
      data instanceof Blob
        ? data
        : new Blob([data], {
            type: filename.endsWith('.json') ? 'application/json' : 'application/octet-stream',
          });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
};
const dlReady = Promise.resolve(browserDownloads).then((d) => {
  downloads = d;
});
function openOv(id) {
  $(id).hidden = false;
}
function closeOv(id) {
  $(id).hidden = true;
}
document.querySelectorAll('.overlay').forEach((ov) => {
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) ov.hidden = true;
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach((o) => (o.hidden = true));
});
let sheetStyle = store.get('groove.sheetStyle') || 'both';
$('sheetStyle').value = sheetStyle;
async function refreshPreview() {
  $('saveStatus').textContent = sheetStyle === 'grid' ? '' : 'Rendering notation…';
  $('savePng').disabled = $('savePdf').disabled = true;
  try {
    sheetCanvas = await renderSheet(sheetStyle);
  } catch (err) {
    console.error(err);
    try {
      sheetCanvas = await renderSheet('grid');
      sheetCanvas.note =
        'This pattern could not be drawn as notation, so the sheet shows the grid only.';
    } catch {
      $('saveStatus').textContent = "The sheet couldn't be drawn.";
      return;
    }
  }
  $('previewImg').src = sheetCanvas.toDataURL('image/png');
  $('saveStatus').textContent = sheetCanvas.note || '';
  $('savePng').disabled = $('savePdf').disabled = false;
}
$('sheetStyle').onchange = (e) => {
  sheetStyle = e.target.value;
  store.set('groove.sheetStyle', sheetStyle);
  refreshPreview();
};
$('exportBtn').onclick = async () => {
  closeMenus();
  $('saveStatus').textContent = '';
  openOv('exportOv');
  loadLib('jspdf').catch(() => {});
  await refreshPreview();
  await Promise.race([dlReady, new Promise((r) => setTimeout(r, 1500))]);
  $('saveRow').hidden = !downloads;
  $('noSaveHint').hidden = !!downloads;
};
const pngBlob = () => new Promise((r) => sheetCanvas.toBlob(r, 'image/png'));
function pdfBlob() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const ratio = sheetCanvas.height / sheetCanvas.width;
  let w = 210,
    h = w * ratio;
  if (h > 297) {
    h = 297;
    w = h / ratio;
  }
  const x0 = (210 - w) / 2;
  pdf.addImage(sheetCanvas.toDataURL('image/png'), 'PNG', x0, 0, w, h, undefined, 'FAST');
  // the QR code and its caption link to the groove
  const L = sheetCanvas.link;
  if (L) {
    const k = w / sheetCanvas.width;
    pdf.link(x0 + L.x * k, L.y * k, L.w * k, L.h * k, { url: L.url });
  }
  pdf.setProperties({
    title: S.name || 'Drum groove',
    subject: 'Drum sheet',
    creator: 'Paradoodle',
  });
  return pdf.output('blob');
}
async function save(kind) {
  if (!downloads || !sheetCanvas) return;
  const st = $('saveStatus');
  try {
    if (
      kind === 'pdf' &&
      !(await loadLib('jspdf').then(
        () => !!window.jspdf,
        () => false,
      ))
    ) {
      st.textContent = 'The PDF library did not load. Save as PNG instead.';
      return;
    }
    const data = kind === 'pdf' ? pdfBlob() : await pngBlob();
    if (!downloads.native) st.textContent = 'Confirm the save…';
    await downloads.save({ filename: `${slug()}.${kind}`, data });
    st.textContent = `Saved ${kind.toUpperCase()}.`;
  } catch (err) {
    const c = err?.code;
    st.textContent =
      c === 'declined'
        ? 'Save cancelled.'
        : c === 'rate_limited'
          ? 'A save prompt is already open.'
          : 'Could not save the file here.';
  }
}
$('savePng').onclick = () => save('png');
$('savePdf').onclick = () => save('pdf');
