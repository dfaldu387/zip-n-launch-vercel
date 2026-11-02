// Print-ready "Supplies by Barn" report — Robert 11-01: "print and build reports
// and filter through reports specific to the barn, specific to the product."
// Same window.open + auto-print pattern as loadSheetPrint.js; the browser's print
// dialog also offers "Save as PDF".

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const money = (n) => `$${(Number(n) || 0).toLocaleString()}`;

export function printSupplyBarnReport({ showName = 'Show', rows = [], barnLabel = 'All Barns', itemLabel = 'All Items' }) {
    const oneUnit = new Set(rows.map(r => r.unit)).size <= 1;
    const totals = rows.reduce((t, r) => ({
        sold: t.sold + r.sold, delivered: t.delivered + r.delivered,
        toDeliver: t.toDeliver + r.toDeliver, revenue: t.revenue + r.revenue,
    }), { sold: 0, delivered: 0, toDeliver: 0, revenue: 0 });

    const body = rows.map(r => `
        <tr>
            <td>${esc(r.barn)}</td><td>${esc(r.name)}</td>
            <td class="num">${r.sold}</td><td class="num">${r.delivered}</td><td class="num">${r.toDeliver}</td>
            <td>${esc(r.unit)}</td><td class="num">${money(r.revenue)}</td>
        </tr>`).join('');

    const totalRow = rows.length > 1 ? `
        <tr class="total">
            <td colspan="2">Total</td>
            <td class="num">${oneUnit ? totals.sold : '—'}</td><td class="num">${oneUnit ? totals.delivered : '—'}</td><td class="num">${oneUnit ? totals.toDeliver : '—'}</td>
            <td>${oneUnit ? esc(rows[0].unit) : ''}</td><td class="num">${money(totals.revenue)}</td>
        </tr>` : '';

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Supplies by Barn — ${esc(showName)}</title>
    <style>
        body{font-family:system-ui,-apple-system,Arial,sans-serif;padding:24px;color:#111;max-width:900px;margin:0 auto;}
        h1{font-size:20px;margin-bottom:2px;}
        .meta{color:#555;font-size:12px;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        th{text-align:left;font-size:11px;text-transform:uppercase;color:#555;border-bottom:2px solid #ccc;padding:6px;}
        td{padding:6px;border-bottom:1px solid #eee;}
        th.num,td.num{text-align:right;}
        tr.total td{font-weight:700;border-top:2px solid #ccc;border-bottom:none;}
        @media print{ body{padding:0} }
    </style></head><body>
        <h1>Supplies by Barn — ${esc(showName)}</h1>
        <p class="meta">Generated ${esc(new Date().toLocaleString())} &middot; ${esc(barnLabel)} &middot; ${esc(itemLabel)}</p>
        <table>
            <thead><tr><th>Barn</th><th>Item</th><th class="num">Sold</th><th class="num">Delivered</th><th class="num">To Deliver</th><th>Unit</th><th class="num">Revenue</th></tr></thead>
            <tbody>${body || '<tr><td colspan="7">No supply orders match this filter.</td></tr>'}${totalRow}</tbody>
        </table>
        <script>window.onload=function(){window.focus();window.print();}<\/script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
}
