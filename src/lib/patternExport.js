import { jsPDF } from 'jspdf';
import { fetchImageAsBase64 } from './pdfHelpers';

/**
 * Rider-facing pattern export helpers for the public Event page.
 *
 * Every exported pattern (JPEG, print, or book) is rendered onto a branded
 * canvas that carries the show name + divisions + date across the TOP and the
 * "EquiPatterns.com" mark across the BOTTOM — so the file markets us wherever
 * it's shared, matching the Pattern Book Builder house style.
 */

const sanitizeFilename = (name) =>
  (name || 'Pattern')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .trim()
    .substring(0, 100);

const divisionLabel = (div) =>
  typeof div === 'object' ? (div.division || div.name || div.id || '') : div;

/** Join a pattern's divisions into a single readable line. */
const divisionsLine = (divisions) =>
  (divisions || []).map(divisionLabel).filter(Boolean).join('  •  ');

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/**
 * Render one pattern onto a white canvas with a branded header + footer.
 * Returns { dataUrl, width, height } or null if the image can't be loaded.
 *
 * meta: { showName, divisions, date, patternName }
 */
export const buildBrandedPatternCanvas = async (imageUrl, meta = {}) => {
  const base64 = await fetchImageAsBase64(imageUrl);
  if (!base64) return null;
  const img = await loadImage(base64);
  if (!img) return null;

  // Normalise the pattern image to a comfortable print width.
  const targetWidth = 1000;
  const scale = targetWidth / (img.width || targetWidth);
  const imgW = Math.round((img.width || targetWidth) * scale);
  const imgH = Math.round((img.height || targetWidth) * scale);

  const pad = 32;
  const canvasW = imgW + pad * 2;
  const maxTextW = canvasW - pad * 2;

  // Word-wrap a string to fit maxW at the given font (offscreen measurement).
  const meas = document.createElement('canvas').getContext('2d');
  const wrapLines = (text, font) => {
    if (!text) return [];
    meas.font = font;
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (meas.measureText(test).width > maxTextW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const titleFont = 'bold 30px Helvetica, Arial, sans-serif';
  const subFont = '18px Helvetica, Arial, sans-serif';
  const subText = [divisionsLine(meta.divisions), meta.date].filter(Boolean).join('   —   ');
  const titleLines = wrapLines(meta.showName, titleFont);
  const subLines = wrapLines(subText, subFont);

  const hasHeader = titleLines.length > 0 || subLines.length > 0;
  const topPad = 24;
  const titleLH = 36;
  const subLH = 24;
  const gap = subLines.length ? 10 : 0;
  const dividerPad = 16;
  const headerH = hasHeader
    ? topPad + titleLines.length * titleLH + gap + subLines.length * subLH + dividerPad
    : 0;
  const footerH = 48;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = headerH + imgH + footerH + pad;
  const ctx = canvas.getContext('2d');

  // White background so JPEGs (no transparency) look clean.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- Header: show name (wrapped), then divisions • date (wrapped) ---
  if (hasHeader) {
    ctx.textAlign = 'center';
    const cx = canvas.width / 2;
    let y = topPad + 26;
    ctx.fillStyle = '#111827';
    ctx.font = titleFont;
    titleLines.forEach((line) => { ctx.fillText(line, cx, y); y += titleLH; });
    y += gap;
    ctx.fillStyle = '#4b5563';
    ctx.font = subFont;
    subLines.forEach((line) => { ctx.fillText(line, cx, y); y += subLH; });
    // Divider line under the header.
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, headerH - 8);
    ctx.lineTo(canvas.width - pad, headerH - 8);
    ctx.stroke();
  }

  // --- Pattern image ---
  ctx.drawImage(img, pad, headerH, imgW, imgH);

  // --- Footer: EquiPatterns branding ---
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
  ctx.fillText('EquiPatterns.com', canvas.width / 2, headerH + imgH + 34);

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: canvas.width, height: canvas.height };
};

/** Save a single pattern to the device as a branded JPEG (great for phones). */
export const downloadPatternJpeg = async (imageUrl, meta = {}) => {
  const rendered = await buildBrandedPatternCanvas(imageUrl, meta);
  if (!rendered) return false;
  const link = document.createElement('a');
  link.href = rendered.dataUrl;
  link.download = `${sanitizeFilename(meta.patternName)}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
};

/**
 * Open a print dialog for one or more patterns. Each pattern prints on its own
 * page (page-break) so this doubles as the "print the whole book" action.
 * The browser's "Save as PDF" option in the same dialog lets riders keep a copy.
 */
export const printPatterns = async (items) => {
  const list = Array.isArray(items) ? items : [items];
  const rendered = [];
  for (const it of list) {
    const r = await buildBrandedPatternCanvas(it.imageUrl, it.meta || it);
    if (r) rendered.push(r.dataUrl);
  }
  if (rendered.length === 0) return false;

  const win = window.open('', '_blank');
  if (!win) return false;
  const imgs = rendered
    .map((src) => `<div class="page"><img src="${src}" /></div>`)
    .join('');
  win.document.write(`<!doctype html><html><head><title>EquiPatterns</title>
    <style>
      @page { size: letter portrait; margin: 0.4in; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: 100%; }
      /* Each pattern fills exactly one printed page and never splits across pages. */
      .page {
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .page:last-child { page-break-after: auto; break-after: auto; }
      img { max-width: 100%; max-height: 100%; object-fit: contain; }
    </style></head><body>${imgs}
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
    </body></html>`);
  win.document.close();
  return true;
};

/**
 * Download a branded pattern book as a single PDF — one pattern per page,
 * each with the show/division/date header and EquiPatterns footer baked in.
 * `patterns` is the (already filtered) list from the Event page.
 */
export const downloadPatternBookPdf = async (patterns, meta = {}) => {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 24;

  let added = 0;
  for (const p of patterns) {
    if (!p.imageUrl) continue;
    const rendered = await buildBrandedPatternCanvas(p.imageUrl, {
      showName: meta.showName,
      divisions: p.divisions,
      date: p.dateLabel || p.date,
      patternName: p.patternName,
    });
    if (!rendered) continue;

    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / rendered.width, maxH / rendered.height);
    const w = rendered.width * scale;
    const h = rendered.height * scale;
    const x = (pageW - w) / 2;
    const y = margin;

    if (added > 0) doc.addPage();
    doc.addImage(rendered.dataUrl, 'JPEG', x, y, w, h);
    added += 1;
  }

  if (added === 0) return false;
  doc.save(`${sanitizeFilename(meta.showName || 'Pattern')}_Pattern_Book.pdf`);
  return true;
};
