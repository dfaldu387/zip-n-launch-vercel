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

const PALETTE = [
    '#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed',
    '#0891b2', '#dc2626', '#4f46e5', '#059669', '#ca8a04',
    '#be123c', '#0d9488', '#9333ea', '#c2410c', '#1d4ed8',
];

const NO_GROUP = '__none__';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const rvCols = (area) => Math.min(Math.max(1, Number(area.spotCount) || 1), 10);

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
        if (sides.top) { p.push(`inset 0 3px 0 0 ${color}`); b.push(`border-top-color:${color}`); }
        if (sides.bottom) { p.push(`inset 0 -3px 0 0 ${color}`); b.push(`border-bottom-color:${color}`); }
        if (sides.left) { p.push(`inset 3px 0 0 0 ${color}`); b.push(`border-left-color:${color}`); }
        if (sides.right) { p.push(`inset -3px 0 0 0 ${color}`); b.push(`border-right-color:${color}`); }
        return p.length ? `box-shadow:${p.join(', ')};${b.join(';')};` : '';
    };

    // Build the HTML for one box (stall or RV spot). RV spots carry no `type` and no
    // layer, so they render as free/taken with their number.
    const cellHtml = (unit, { outline = '', tag = '', useLayer = false } = {}) => {
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
        // Boxes print white so names stay readable and ink stays cheap. Ownership is
        // carried by the coloured border and the bar along the bottom. Pre-bedded stalls
        // get an amber wash; a stall with nothing to say on this layer pales.
        const warm = info.tone === 'warm';
        const pale = info.tone === 'muted';
        const main = esc(info.text || unit.number);
        const sub = info.sub && info.sub !== info.text ? `<span class="num2">${esc(info.sub)}</span>` : '';
        const cls = `cell taken${warm ? ' warm' : ''}${pale ? ' pale' : ''}`;
        return `<div class="${cls}" style="border-color:${base};${outline}">
            ${tag}
            <span class="name">${main}</span>
            ${sub}
            <span class="owner" style="background:${base}"></span>
        </div>`;
    };

    const containerBlock = (name, cols, units, rowLabels = [], colLabels = [], useLayer = false) => {
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
                let outline = '', tag = '';
                if (gid) {
                    const sides = {
                        top: gOf(idx - cols) !== gid,
                        bottom: gOf(idx + cols) !== gid,
                        left: ci === 0 || gOf(idx - 1) !== gid,
                        right: ci === cols - 1 || gOf(idx + 1) !== gid,
                    };
                    outline = outlineStyle(sides, colorByGroup[gid]);
                    // The group's name, printed once at the top-left box of its block.
                    if (sides.top && sides.left) {
                        tag = `<span class="gtag" style="background:${colorByGroup[gid]}">${esc(groupLabel[gid])}</span>`;
                    }
                }
                cells += cellHtml(unit, { outline, tag, useLayer });
            }
        }
        return `<section class="barn">
            <h2>${esc(name)} <span class="meta">${assigned}/${total} assigned</span></h2>
            <div class="grid" style="grid-template-columns:26px repeat(${cols}, 1fr)">${cells}</div>
        </section>`;
    };

    const barnBlocks = (barns || [])
        .map(barn => containerBlock(barn.name, gridCols(barn), barn.stalls || [], barn.rowLabels || [], barn.colLabels || [], true))
        .join('');

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
        h1{font-size:20px;margin:0 0 2px}
        .sub{color:#555;font-size:12px;margin:0 0 4px}
        .layer{display:inline-block;font-size:11px;font-weight:700;color:#0f172a;background:#e2e8f0;border-radius:999px;padding:2px 9px;margin:4px 0}
        .note{color:#64748b;font-size:10px;margin:2px 0 0;max-width:70ch}
        .legend{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 18px;font-size:11px}
        .lg{display:inline-flex;align-items:center;gap:5px}
        .lg i{width:12px;height:12px;border-radius:3px;display:inline-block}
        .barn{margin:0 0 22px;break-inside:avoid}
        .barn h2{font-size:14px;margin:0 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
        .barn h2 .meta{font-weight:normal;color:#777;font-size:11px;margin-left:8px}
        .grid{display:grid;gap:4px;max-width:100%}
        .hcell{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#64748b;font-family:ui-monospace,monospace}
        .hcell.corner{background:transparent}
        .hcell.rlabel{min-height:46px}
        .hcell.rlabel.thin{min-height:0}
        .aisle{height:7px;align-self:center;background:#f1f5f9;border:1px dashed #e2e8f0;border-radius:3px}
        .cell{position:relative;min-height:46px;border:1px solid #cbd5e1;border-radius:5px;padding:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
        .cell .num{font-size:9px;font-family:ui-monospace,monospace;color:#64748b;font-weight:700}
        .cell .num2{font-size:8px;font-family:ui-monospace,monospace;color:#64748b;font-weight:700;margin-top:2px}
        .cell.taken{background:#fff;padding-bottom:6px}
        .cell.taken .name{font-size:10px;font-weight:700;text-align:center;line-height:1.15;word-break:break-word;color:#0f172a}
        .cell.taken.pale{background:#f8fafc}
        .cell.taken.pale .name{color:#94a3b8}
        .cell.taken.warm{background:#fef3c7}
        .cell .owner{position:absolute;left:0;right:0;bottom:0;height:3px}
        .cell.free{background:#f8fafc}
        .cell.room{background:#f1f5f9;color:#94a3b8;font-size:8px;justify-content:center;font-family:ui-monospace,monospace;text-transform:uppercase}
        .gtag{position:absolute;top:0;left:0;font-size:6px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#fff;padding:1px 3px;border-bottom-right-radius:4px;max-width:100%;overflow:hidden;white-space:nowrap}
        @media print{ body{padding:0} .barn{margin-bottom:16px} }
    </style></head><body>
        <h1>${esc(showName)} — Stalling Chart</h1>
        ${subtitle ? `<p class="sub">${subtitle}</p>` : ''}
        <div class="layer">Showing: ${esc(layerInfo.label)}</div>
        ${note ? `<p class="note">${esc(note)}</p>` : ''}
        ${legendItems ? `<div class="legend">${legendItems}</div>` : ''}
        ${barnBlocks}
        ${rvBlocks}
        ${!barnBlocks && !rvBlocks ? '<p>Nothing to show yet.</p>' : ''}
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
        const y = margin;

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
