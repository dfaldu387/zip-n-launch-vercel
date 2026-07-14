// Stalling / camping chart printer.
//
// Opens a clean, print-ready window showing each barn as a grid of stalls. What is
// written inside each box follows the LAYER the organizer picked on the Assign board
// — names, trainer/group, horses, shavings bags or pre-bedding — so the same screen
// can be shared as several different sheets ("one that shows all the names, one that
// shows how many bags of shavings, one that shows which stalls were pre-bedded").
//
// Each trainer / group block is outlined in that group's own colour and tagged with
// its name, matching the on-screen board.

import { ensureAllRvSpots } from '@/lib/rvAssignment';
import { gridCols, computeGridLabels, labelValue } from '@/lib/barnGrid';
import { buildLayerIndex, layerCell, layerById, layerLegend } from '@/lib/stallLayers';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Ordered so the first 12 colours are all clearly distinct (no two greens / teals /
// reds) — spread across the wheel and varied in lightness. MUST stay identical to the
// PALETTE in components/housing/AssignBoard.jsx so a person reads the same colour on the
// board, the RV view and the printout.
const PALETTE = [
    '#2563eb', '#e11d48', '#16a34a', '#f59e0b', '#7c3aed',
    '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569',
    '#0d9488', '#a21caf', '#ca8a04', '#4f46e5', '#92400e',
];

const NO_GROUP = '__none__';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const rvCols = (area) => Math.min(Math.max(1, Number(area.spotCount) || 1), 10);

// Hex + 2-digit alpha, so a faded (muted) stall still hints at its owner's colour —
// same rule the on-screen board uses.
const withAlpha = (hex, aa) => `${hex}${aa}`;

// Same rule the board uses: a manual group wins, else the trainer / ranch name.
const groupNameOf = (b) => {
    const manual = (b.stallGroup || '').trim();
    if (manual === NO_GROUP) return '';
    if (manual) return manual;
    return (b.trainerName || '').trim();
};

// Room labels shown in non-stall boxes; aisle/empty print blank for a clean chart.
const ROOM_LABELS = { office: 'Office', feed: 'Feed', wash: 'Wash', tack: 'Tack' };

function buildStallingChartHtml({
    barns = [], rvAreas = [], bookings = [], supplies = [],
    layer = 'number', showName = 'Show', facility = '', dateRange = '',
}, autoPrint = false) {
    // Stable color per booking that owns stalls (same order the board uses).
    const active = (bookings || []).filter(b => b && b.status !== 'cancelled');
    const stallBookings = active.filter(b => b.orderType !== 'live-supply');
    const colorByBooking = {};
    active.forEach((b, i) => { colorByBooking[b.id] = PALETTE[i % PALETTE.length]; });
    const bookingById = Object.fromEntries((bookings || []).map(b => [b.id, b]));

    // Groups → one colour and one name each, plus bookingId → groupId, so the printed
    // chart outlines and tags each block exactly like the Assign board.
    const groupKeys = [];
    const groupLabel = {};
    for (const b of stallBookings) {
        const name = groupNameOf(b);
        if (!name) continue;
        const k = name.toLowerCase();
        if (!groupKeys.includes(k)) { groupKeys.push(k); groupLabel[k] = name; }
    }
    const colorByGroup = {};
    groupKeys.forEach((k, i) => { colorByGroup[k] = PALETTE[i % PALETTE.length]; });
    const groupIdByBooking = {};
    stallBookings.forEach(b => { const n = groupNameOf(b); if (n) groupIdByBooking[b.id] = n.toLowerCase(); });

    // The numbers/names a layer writes inside each box.
    const index = buildLayerIndex({ bookings, barns, supplies });
    const layerInfo = layerById(layer);

    // Inset box-shadow drawing the group outline only on the boundary sides, in the
    // group's own colour so two touching blocks never look like one. The 1px border
    // sits outside that shadow, so recolour the boundary sides too — otherwise the
    // block is ringed in the exhibitor's colour and reads as the wrong group.
    const outlineStyle = (sides, color) => {
        if (!sides) return '';
        const p = [];
        const b = [];
        // A white inner line beside the group colour so the outline still reads on top
        // of a dark, solid-filled box (identical to the board's outlineShadow).
        if (sides.top) { p.push(`inset 0 3px 0 0 ${color}`, `inset 0 4px 0 0 rgba(255,255,255,0.75)`); b.push(`border-top-color:${color}`); }
        if (sides.bottom) { p.push(`inset 0 -3px 0 0 ${color}`, `inset 0 -4px 0 0 rgba(255,255,255,0.75)`); b.push(`border-bottom-color:${color}`); }
        if (sides.left) { p.push(`inset 3px 0 0 0 ${color}`, `inset 4px 0 0 0 rgba(255,255,255,0.75)`); b.push(`border-left-color:${color}`); }
        if (sides.right) { p.push(`inset -3px 0 0 0 ${color}`, `inset -4px 0 0 0 rgba(255,255,255,0.75)`); b.push(`border-right-color:${color}`); }
        return p.length ? `box-shadow:${p.join(', ')};${b.join(';')};` : '';
    };

    // Build the HTML for one box (stall or RV spot). RV spots carry no `type` and no
    // layer, so they render as free/taken with their number.
    const cellHtml = (unit, { outline = '', useLayer = false } = {}) => {
        const type = unit.type || 'stall';
        if (type !== 'stall') {
            // Blocked shows its number; office/feed/wash/tack show their name; aisle &
            // empty print blank so walkways don't clutter the chart.
            const label = type === 'blocked' ? esc(unit.number) : esc(ROOM_LABELS[type] || '');
            return `<div class="cell room">${label}</div>`;
        }
        const owner = unit.bookingId ? bookingById[unit.bookingId] : null;
        if (!owner) return `<div class="cell free"><span class="num">${esc(unit.number)}</span></div>`;

        const base = colorByBooking[owner.id] || '#2563eb';
        const info = useLayer ? layerCell(layer, { unit, index }) : { text: unit.number, sub: '', tone: 'booked' };
        // Match the on-screen board: fill the box with the owner's colour and print the
        // name in white so the chart reads the same everywhere. Pre-bedded stalls are
        // amber; a stall with nothing to show on this layer fades to a light wash of the
        // owner's colour with dark text.
        const warm = info.tone === 'warm';
        const pale = info.tone === 'muted';
        const fill = warm ? '#f59e0b' : pale ? withAlpha(base, '55') : base;
        const main = esc(info.text || unit.number);
        const sub = info.sub && info.sub !== info.text ? `<span class="num2">${esc(info.sub)}</span>` : '';
        const cls = `cell taken${pale ? ' pale' : ''}`;
        return `<div class="${cls}" style="background:${fill};border-color:${fill};${outline}">
            <span class="name">${main}</span>
            ${sub}
        </div>`;
    };

    const containerBlock = (name, cols, units, rowLabels = [], colLabels = [], useLayer = false, hideName = false) => {
        const total = units.filter(u => (u.type || 'stall') === 'stall').length;
        const assigned = units.filter(u => (u.type || 'stall') === 'stall' && u.bookingId).length;
        const rowCount = Math.ceil(units.length / cols);
        const { rowLabels: defRows, colLabels: defCols } = computeGridLabels(units, cols);
        // Header row: a blank corner then one column label per column.
        let cells = `<div class="hcell corner"></div>`;
        for (let ci = 0; ci < cols; ci++) cells += `<div class="hcell">${esc(labelValue(colLabels, defCols, ci))}</div>`;
        const gOf = (j) => (j >= 0 && j < units.length && units[j]?.bookingId) ? groupIdByBooking[units[j].bookingId] : null;
        // A row of nothing but aisle / empty boxes prints as one thin walkway strip,
        // the same as on screen — a band of tall blank boxes just wastes the page.
        const isWalkwayRow = (ri) => {
            const row = units.slice(ri * cols, ri * cols + cols);
            return row.length > 0 && row.every(u => {
                const t = u?.type || 'stall';
                return t === 'aisle' || t === 'empty';
            });
        };
        for (let ri = 0; ri < rowCount; ri++) {
            if (useLayer && isWalkwayRow(ri)) {
                cells += `<div class="hcell rlabel thin">${esc(labelValue(rowLabels, defRows, ri))}</div>`;
                cells += `<div class="aisle" style="grid-column:span ${cols}"></div>`;
                continue;
            }
            cells += `<div class="hcell rlabel">${esc(labelValue(rowLabels, defRows, ri))}</div>`;
            for (let ci = 0; ci < cols; ci++) {
                const idx = ri * cols + ci;
                const unit = units[idx];
                if (!unit) { cells += `<div class="cell free"></div>`; continue; }
                const gid = unit.bookingId ? groupIdByBooking[unit.bookingId] : null;
                let outline = '';
                if (gid) {
                    const sides = {
                        top: gOf(idx - cols) !== gid,
                        bottom: gOf(idx + cols) !== gid,
                        left: ci === 0 || gOf(idx - 1) !== gid,
                        right: ci === cols - 1 || gOf(idx + 1) !== gid,
                    };
                    // Group identity is carried by the coloured block + the top legend
                    // (Robert's pick — a long name never fit inside one narrow box), so we
                    // draw only the group outline here, no on-box name tag.
                    outline = outlineStyle(sides, colorByGroup[gid]);
                }
                cells += cellHtml(unit, { outline, useLayer });
            }
        }
        return `<section class="barn">
            ${hideName ? '' : `<h2>${esc(name)} <span class="meta">${assigned}/${total} assigned</span></h2>`}
            <div class="grid" style="grid-template-columns:26px repeat(${cols}, 1fr)">${cells}</div>
        </section>`;
    };

    // A single-barn chart (the common case) shows the barn name big at the top-right
    // of the page instead of above the grid — Robert: "move West Pavilion up to the
    // top right". Multi-barn charts keep the name above each grid so they stay labelled.
    const barnList = barns || [];
    const singleBarn = barnList.length === 1;
    const barnBlocks = barnList
        .map(barn => containerBlock(barn.name, gridCols(barn), barn.stalls || [], barn.rowLabels || [], barn.colLabels || [], true, singleBarn))
        .join('');

    let venueLabel = '';
    if (singleBarn && barnList[0]) {
        const st = (barnList[0].stalls || []).filter(u => (u.type || 'stall') === 'stall');
        const t = st.length;
        const a = st.filter(u => u.bookingId).length;
        venueLabel = `<div class="venue"><span class="venue-name">${esc(barnList[0].name)}</span><span class="venue-meta">${a}/${t} assigned</span></div>`;
    }

    const rvMat = ensureAllRvSpots(rvAreas);
    const rvBlocks = rvMat
        .filter(a => (a.spots || []).length > 0)
        .map(a => containerBlock(`${a.name} (RV / camping)`, rvCols(a), a.spots, a.rowLabels || [], a.colLabels || [], false))
        .join('');

    // A simple legend of who owns a stall or an RV spot (name → color).
    const ownsStall = (b) => (barns || []).some(barn => (barn.stalls || []).some(s => s.bookingId === b.id));
    const ownsRv = (b) => rvMat.some(a => (a.spots || []).some(s => s.bookingId === b.id));
    const legendItems = active
        .filter(b => ownsStall(b) || ownsRv(b))
        .map(b => `<span class="lg"><i style="background:${colorByBooking[b.id]}"></i>${esc(b.exhibitorName || '—')}</span>`)
        .join('');

    const subtitle = [facility, dateRange].filter(Boolean).map(esc).join(' · ');
    const note = layerLegend(layer);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(showName)} — Stalling Chart (${esc(layerInfo.label)})</title>
    <style>
        *{box-sizing:border-box}
        body{font-family:system-ui,Arial,sans-serif;color:#111;padding:24px;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
        .venue{text-align:right;flex-shrink:0}
        .venue-name{display:block;font-size:28px;font-weight:800;line-height:1.1;color:#0f172a}
        .venue-meta{display:block;font-size:13px;color:#777;margin-top:3px}
        h1{font-size:30px;margin:0 0 3px}
        .sub{color:#555;font-size:15px;margin:0 0 5px}
        .layer{display:inline-block;font-size:14px;font-weight:700;color:#0f172a;background:#e2e8f0;border-radius:999px;padding:3px 12px;margin:5px 0}
        .note{color:#64748b;font-size:13px;margin:3px 0 0;max-width:80ch}
        .legend{display:flex;flex-wrap:wrap;gap:16px;margin:14px 0 22px;font-size:15px}
        .lg{display:inline-flex;align-items:center;gap:7px}
        .lg i{width:16px;height:16px;border-radius:3px;display:inline-block}
        .barn{margin:0 0 26px;break-inside:avoid}
        .barn h2{font-size:26px;font-weight:800;text-align:right;margin:0 0 10px;border-bottom:2px solid #ddd;padding-bottom:6px}
        .barn h2 .meta{font-weight:normal;color:#777;font-size:14px;margin-left:8px}
        .grid{display:grid;gap:6px;max-width:100%}
        .hcell{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#475569;font-family:ui-monospace,monospace}
        .hcell.corner{background:transparent}
        .hcell.rlabel{min-height:58px}
        .hcell.rlabel.thin{min-height:0}
        .aisle{height:16px;align-self:center;background:#e2e8f0;border:1px dashed #cbd5e1;border-radius:3px}
        .cell{position:relative;min-height:58px;border:1px solid #cbd5e1;border-radius:5px;padding:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
        .cell .num{font-size:13px;font-family:ui-monospace,monospace;color:#475569;font-weight:700}
        .cell .num2{font-size:11px;font-family:ui-monospace,monospace;color:#64748b;font-weight:700;margin-top:2px}
        .cell.taken{padding-bottom:6px}
        .cell.taken .name{font-size:14px;font-weight:700;text-align:center;line-height:1.15;word-break:break-word;color:#fff}
        .cell.taken .num2{color:rgba(255,255,255,0.85)}
        .cell.taken.pale .name{color:#0f172a}
        .cell.taken.pale .num2{color:#475569}
        .cell.free{background:#f8fafc}
        .cell.room{background:#f1f5f9;color:#94a3b8;font-size:11px;justify-content:center;font-family:ui-monospace,monospace;text-transform:uppercase}
        .footer{text-align:center;margin-top:26px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#64748b}
        @media print{ body{padding:0} .barn{margin-bottom:16px} }
    </style></head><body>
        <div class="head">
            <div class="head-left">
                <h1>${esc(showName)} — Stalling Chart</h1>
                ${subtitle ? `<p class="sub">${subtitle}</p>` : ''}
                <div class="layer">Showing: ${esc(layerInfo.label)}</div>
                ${note ? `<p class="note">${esc(note)}</p>` : ''}
            </div>
            ${venueLabel}
        </div>
        ${legendItems ? `<div class="legend">${legendItems}</div>` : ''}
        ${barnBlocks}
        ${rvBlocks}
        ${!barnBlocks && !rvBlocks ? '<p>Nothing to show yet.</p>' : ''}
        <div class="footer">Stalling Managed Through EquiPatterns.com</div>
        ${autoPrint ? '<script>window.onload=function(){window.focus();window.print();}<\/script>' : ''}
    </body></html>`;

    return html;
}

// Open a clean print window (browser print / Save-as-PDF).
export function printStallingChart(opts) {
    const html = buildStallingChartHtml(opts, true);
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    return true;
}

// Download the chart as a PDF scaled to fit ONE page. Renders the same clean chart
// HTML off-screen (in an isolated iframe so its styles don't touch the app), snapshots
// it with html2canvas, then places that image on a single letter page — landscape or
// portrait, whichever fits the chart better.
export async function downloadStallingChartPdf(opts) {
    const html = buildStallingChartHtml(opts, false);

    // Off-screen iframe → style isolation + full-content layout.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1100px';   // fixed render width → predictable, readable layout
    iframe.style.height = '100px';
    iframe.style.border = '0';
    iframe.style.background = '#ffffff';
    document.body.appendChild(iframe);

    try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();

        // Let the browser lay out (and load web fonts) before snapshotting.
        await new Promise((r) => setTimeout(r, 350));

        const body = doc.body;
        const fullW = Math.max(body.scrollWidth, 1100);
        const fullH = body.scrollHeight;
        iframe.style.height = fullH + 'px';

        const canvas = await html2canvas(body, {
            scale: 2,
            backgroundColor: '#ffffff',
            width: fullW,
            height: fullH,
            windowWidth: fullW,
            windowHeight: fullH,
        });

        const imgW = canvas.width;
        const imgH = canvas.height;
        // Orientation that best fits the chart's shape.
        const orientation = imgW >= imgH ? 'l' : 'p';
        const pdf = new jsPDF(orientation, 'pt', 'letter');
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 18;
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        // Single-page fit: shrink (never enlarge) so the whole chart lands on one page.
        const scale = Math.min(availW / imgW, availH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const x = (pageW - drawW) / 2;
        // Center vertically too so a short chart doesn't float at the top with a
        // big white band below it (Robert: "center stall chart … for max visibility").
        const y = Math.max(margin, (pageH - drawH) / 2);

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, drawW, drawH);
        const safeName = (opts.showName || 'Show').replace(/[^\w\- ]+/g, '').trim() || 'Show';
        pdf.save(`${safeName} - Stalling Chart.pdf`);
        return true;
    } catch (e) {
        console.error('Failed to build stalling chart PDF:', e);
        return false;
    } finally {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
}
