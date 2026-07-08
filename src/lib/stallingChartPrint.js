// Phase 4: Stalling / camping chart printer.
//
// Opens a clean, print-ready window showing each barn as a grid of stalls with
// the exhibitor NAME written in every assigned box (Robert's "put my name on
// those stalls"). The manager prints it or saves as PDF to share with exhibitors
// or post on the barn wall. Colors match the on-screen Assign board loosely
// (light tints so they print cheaply and stay readable).

import { ensureAllRvSpots } from '@/lib/rvAssignment';

const PALETTE = [
    '#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed',
    '#0891b2', '#dc2626', '#4f46e5', '#059669', '#ca8a04',
    '#be123c', '#0d9488', '#9333ea', '#c2410c', '#1d4ed8',
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const barnCols = (barn) => barn.layoutCols ?? (barn.stallCount ? Math.min(barn.stallCount, 10) : 10);
const rvCols = (area) => Math.min(Math.max(1, Number(area.spotCount) || 1), 10);

// Default grid labels (match the Assign board): rows A,B,…,Z,AA…; columns 1,2,3…
const defaultRowLabel = (i) => {
    let n = i, s = '';
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
};
// Smart defaults matching the Assign board: letter only stall rows / number only
// stall columns (aisle-only lines get a blank default).
const computeGridLabels = (units, cols) => {
    const c = Math.max(1, cols);
    const rowCount = Math.ceil(units.length / c);
    const isStall = (u) => u && (u.type || 'stall') === 'stall';
    let rc = 0;
    const rowLabels = Array.from({ length: rowCount }, (_, r) =>
        units.slice(r * c, r * c + c).some(isStall) ? defaultRowLabel(rc++) : '');
    let cc = 0;
    const colLabels = Array.from({ length: c }, (_, col) => {
        for (let r = 0; r < rowCount; r++) if (isStall(units[r * c + col])) return String(++cc);
        return '';
    });
    return { rowLabels, colLabels };
};
const labelValue = (custom, defaults, i) =>
    (custom && custom[i] != null && custom[i] !== '') ? custom[i] : (defaults[i] ?? '');

// Room labels shown in non-stall boxes; aisle/empty print blank for a clean chart.
const ROOM_LABELS = { office: 'Office', feed: 'Feed', wash: 'Wash', tack: 'Tack' };

export function printStallingChart({ barns = [], rvAreas = [], bookings = [], showName = 'Show', facility = '', dateRange = '' }) {
    // Stable color per booking that owns stalls (same order the board uses).
    const stallBookings = (bookings || []).filter(b => b && b.status !== 'cancelled');
    const colorByBooking = {};
    stallBookings.forEach((b, i) => { colorByBooking[b.id] = PALETTE[i % PALETTE.length]; });
    const bookingById = Object.fromEntries((bookings || []).map(b => [b.id, b]));

    // Trainer groups → one colour each, and a bookingId → groupId map, so the printed
    // chart can outline each trainer's block the same way the Assign board does.
    const trainerKey = (b) => (b.trainerName || '').trim().toLowerCase();
    const groupIds = [...new Set(stallBookings.map(trainerKey).filter(Boolean))];
    const colorByGroup = {};
    groupIds.forEach((k, i) => { colorByGroup[k] = PALETTE[i % PALETTE.length]; });
    const groupIdByBooking = {};
    stallBookings.forEach(b => { const k = trainerKey(b); if (k) groupIdByBooking[b.id] = k; });

    // Inset box-shadow drawing a bold dark group outline only on boundary sides — a
    // near-black edge stays visible on any booking fill colour.
    const GROUP_OUTLINE = '#0f172a';
    const outlineStyle = (sides) => {
        if (!sides) return '';
        const p = [];
        if (sides.top) p.push(`inset 0 3px 0 0 ${GROUP_OUTLINE}`);
        if (sides.bottom) p.push(`inset 0 -3px 0 0 ${GROUP_OUTLINE}`);
        if (sides.left) p.push(`inset 3px 0 0 0 ${GROUP_OUTLINE}`);
        if (sides.right) p.push(`inset -3px 0 0 0 ${GROUP_OUTLINE}`);
        return p.length ? `box-shadow:${p.join(', ')};` : '';
    };

    // Build the HTML for one box (stall or RV spot). RV spots carry no `type`,
    // so they render as free/taken just like stalls. `outline` is the group boundary.
    const cellHtml = (unit, outline = '') => {
        const type = unit.type || 'stall';
        if (type !== 'stall') {
            // Blocked shows its number; office/feed/wash/tack show their name; aisle &
            // empty print blank so walkways don't clutter the chart.
            const label = type === 'blocked' ? esc(unit.number) : esc(ROOM_LABELS[type] || '');
            return `<div class="cell room">${label}</div>`;
        }
        const owner = unit.bookingId ? bookingById[unit.bookingId] : null;
        if (owner) {
            const color = colorByBooking[owner.id] || '#2563eb';
            return `<div class="cell taken" style="border-color:${color};${outline}">
                <span class="num" style="background:${color}">${esc(unit.number)}</span>
                <span class="name">${esc(owner.exhibitorName || 'Booked')}</span>
            </div>`;
        }
        return `<div class="cell free" style="${outline}"><span class="num">${esc(unit.number)}</span></div>`;
    };

    const containerBlock = (name, cols, units, rowLabels = [], colLabels = []) => {
        const total = units.filter(u => (u.type || 'stall') === 'stall').length;
        const assigned = units.filter(u => (u.type || 'stall') === 'stall' && u.bookingId).length;
        const rowCount = Math.ceil(units.length / cols);
        const { rowLabels: defRows, colLabels: defCols } = computeGridLabels(units, cols);
        // Header row: a blank corner then one column label per column.
        let cells = `<div class="hcell corner"></div>`;
        for (let ci = 0; ci < cols; ci++) cells += `<div class="hcell">${esc(labelValue(colLabels, defCols, ci))}</div>`;
        // Each row: its row label then that row's boxes (with group outline where the
        // neighbouring box belongs to a different trainer group).
        const gOf = (j) => (j >= 0 && j < units.length && units[j]?.bookingId) ? groupIdByBooking[units[j].bookingId] : null;
        for (let ri = 0; ri < rowCount; ri++) {
            cells += `<div class="hcell rlabel">${esc(labelValue(rowLabels, defRows, ri))}</div>`;
            for (let ci = 0; ci < cols; ci++) {
                const idx = ri * cols + ci;
                const unit = units[idx];
                if (!unit) { cells += `<div class="cell free"></div>`; continue; }
                const gid = unit.bookingId ? groupIdByBooking[unit.bookingId] : null;
                let outline = '';
                if (gid) {
                    outline = outlineStyle({
                        top: gOf(idx - cols) !== gid,
                        bottom: gOf(idx + cols) !== gid,
                        left: ci === 0 || gOf(idx - 1) !== gid,
                        right: ci === cols - 1 || gOf(idx + 1) !== gid,
                    });
                }
                cells += cellHtml(unit, outline);
            }
        }
        return `<section class="barn">
            <h2>${esc(name)} <span class="meta">${assigned}/${total} assigned</span></h2>
            <div class="grid" style="grid-template-columns:26px repeat(${cols}, 1fr)">${cells}</div>
        </section>`;
    };

    const barnBlocks = (barns || [])
        .map(barn => containerBlock(barn.name, Math.max(1, barnCols(barn)), barn.stalls || [], barn.rowLabels || [], barn.colLabels || []))
        .join('');

    const rvMat = ensureAllRvSpots(rvAreas);
    const rvBlocks = rvMat
        .filter(a => (a.spots || []).length > 0)
        .map(a => containerBlock(`${a.name} (RV / camping)`, rvCols(a), a.spots, a.rowLabels || [], a.colLabels || []))
        .join('');

    // A simple legend of who owns a stall or an RV spot (name → color).
    const ownsStall = (b) => (barns || []).some(barn => (barn.stalls || []).some(s => s.bookingId === b.id));
    const ownsRv = (b) => rvMat.some(a => (a.spots || []).some(s => s.bookingId === b.id));
    const legendItems = stallBookings
        .filter(b => ownsStall(b) || ownsRv(b))
        .map(b => `<span class="lg"><i style="background:${colorByBooking[b.id]}"></i>${esc(b.exhibitorName || '—')}</span>`)
        .join('');

    const subtitle = [facility, dateRange].filter(Boolean).map(esc).join(' · ');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(showName)} — Stalling Chart</title>
    <style>
        *{box-sizing:border-box}
        body{font-family:system-ui,Arial,sans-serif;color:#111;padding:24px;margin:0}
        h1{font-size:20px;margin:0 0 2px}
        .sub{color:#555;font-size:12px;margin:0 0 4px}
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
        .cell{min-height:46px;border:1px solid #cbd5e1;border-radius:5px;padding:3px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:hidden}
        .cell .num{font-size:9px;font-family:ui-monospace,monospace;color:#64748b;font-weight:700}
        .cell.taken .num{color:#fff;padding:1px 5px;border-radius:4px}
        .cell.taken .name{font-size:10px;font-weight:600;text-align:center;line-height:1.1;margin-top:3px;word-break:break-word}
        .cell.free{background:#f8fafc}
        .cell.room{background:#f1f5f9;color:#94a3b8;font-size:8px;justify-content:center;font-family:ui-monospace,monospace;text-transform:uppercase}
        @media print{ body{padding:0} .barn{margin-bottom:16px} }
    </style></head><body>
        <h1>${esc(showName)} — Stalling Chart</h1>
        ${subtitle ? `<p class="sub">${subtitle}</p>` : ''}
        ${legendItems ? `<div class="legend">${legendItems}</div>` : ''}
        ${barnBlocks}
        ${rvBlocks}
        ${!barnBlocks && !rvBlocks ? '<p>Nothing to show yet.</p>' : ''}
        <script>window.onload=function(){window.focus();window.print();}<\/script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    return true;
}
