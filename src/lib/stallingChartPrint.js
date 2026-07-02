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

export function printStallingChart({ barns = [], rvAreas = [], bookings = [], showName = 'Show', facility = '', dateRange = '' }) {
    // Stable color per booking that owns stalls (same order the board uses).
    const stallBookings = (bookings || []).filter(b => b && b.status !== 'cancelled');
    const colorByBooking = {};
    stallBookings.forEach((b, i) => { colorByBooking[b.id] = PALETTE[i % PALETTE.length]; });
    const bookingById = Object.fromEntries((bookings || []).map(b => [b.id, b]));

    // Build the HTML for one box (stall or RV spot). RV spots carry no `type`,
    // so they render as free/taken just like stalls.
    const cellHtml = (unit) => {
        const type = unit.type || 'stall';
        if (type !== 'stall') {
            const label = type === 'blocked' ? esc(unit.number) : esc(type.slice(0, 4));
            return `<div class="cell room">${label}</div>`;
        }
        const owner = unit.bookingId ? bookingById[unit.bookingId] : null;
        if (owner) {
            const color = colorByBooking[owner.id] || '#2563eb';
            return `<div class="cell taken" style="border-color:${color}">
                <span class="num" style="background:${color}">${esc(unit.number)}</span>
                <span class="name">${esc(owner.exhibitorName || 'Booked')}</span>
            </div>`;
        }
        return `<div class="cell free"><span class="num">${esc(unit.number)}</span></div>`;
    };

    const containerBlock = (name, cols, units) => {
        const total = units.filter(u => (u.type || 'stall') === 'stall').length;
        const assigned = units.filter(u => (u.type || 'stall') === 'stall' && u.bookingId).length;
        const cells = units.map(cellHtml).join('');
        return `<section class="barn">
            <h2>${esc(name)} <span class="meta">${assigned}/${total} assigned</span></h2>
            <div class="grid" style="grid-template-columns:repeat(${cols}, 1fr)">${cells}</div>
        </section>`;
    };

    const barnBlocks = (barns || [])
        .map(barn => containerBlock(barn.name, Math.max(1, barnCols(barn)), barn.stalls || []))
        .join('');

    const rvMat = ensureAllRvSpots(rvAreas);
    const rvBlocks = rvMat
        .filter(a => (a.spots || []).length > 0)
        .map(a => containerBlock(`${a.name} (RV / camping)`, rvCols(a), a.spots))
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
