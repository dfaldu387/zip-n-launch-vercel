// Opens a clean, print-ready window for a Load Sheet — Robert: "generate a
// load sheet... it tells us what we need to load and how many bags of each
// supply." Mirrors the window.open + autoPrint pattern in stallingChartPrint.js.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const plural = (qty) => (qty === 1 ? '' : 's');

function buildLoadSheetHtml({ showName = 'Show', bySupply, byBarn, orderCount = 0 }) {
    const generatedAt = new Date().toLocaleString();

    const supplyRows = [...bySupply.entries()]
        .map(([name, { qty, unit }]) => `<tr><td>${esc(name)}</td><td class="num">${qty} ${esc(unit)}${plural(qty)}</td></tr>`)
        .join('');

    const barnBlocks = [...byBarn.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([barnLabel, entry]) => {
            const totalsLine = [...entry.totals.entries()]
                .map(([name, { qty, unit }]) => `${qty} ${esc(unit)}${plural(qty)} ${esc(name)}`)
                .join(' &middot; ');
            const stallRows = [...entry.stalls.entries()]
                .map(([stallLabel, itemsMap]) => {
                    const parts = [...itemsMap.entries()]
                        .map(([name, { qty, unit }]) => `${qty} ${esc(unit)}${plural(qty)} ${esc(name)}`)
                        .join(', ');
                    return `<tr><td>${esc(stallLabel)}</td><td>${parts}</td></tr>`;
                })
                .join('');
            return `
                <div class="barn">
                    <h3>${esc(barnLabel)} <span class="totals">${totalsLine}</span></h3>
                    <table><tbody>${stallRows}</tbody></table>
                </div>
            `;
        })
        .join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>Load Sheet — ${esc(showName)}</title>
    <style>
        body{font-family:system-ui,-apple-system,Arial,sans-serif;padding:24px;color:#111;max-width:760px;margin:0 auto;}
        h1{font-size:20px;margin-bottom:2px;}
        .meta{color:#555;font-size:12px;margin-bottom:20px;}
        h2{font-size:15px;margin-top:26px;border-bottom:1px solid #ddd;padding-bottom:4px;}
        h3{font-size:14px;margin:16px 0 4px;}
        .totals{font-weight:normal;color:#444;font-size:12px;margin-left:8px;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        td{padding:3px 6px;border-bottom:1px solid #eee;vertical-align:top;}
        td.num{text-align:right;font-weight:600;}
        .barn{margin-bottom:10px;}
        @media print{ body{padding:0} }
    </style>
    </head><body>
        <h1>Load Sheet — ${esc(showName)}</h1>
        <p class="meta">Generated ${esc(generatedAt)} &middot; ${orderCount} order${plural(orderCount)} with supplies to load</p>

        <h2>Load Totals</h2>
        <table><tbody>${supplyRows || '<tr><td>Nothing left to load.</td></tr>'}</tbody></table>

        <h2>By Barn / Location</h2>
        ${barnBlocks || '<p class="meta">No barn/location on these orders.</p>'}

        <script>window.onload=function(){window.focus();window.print();}<\/script>
    </body></html>`;
}

export function printLoadSheet(data) {
    const html = buildLoadSheetHtml(data);
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(html);
    w.document.close();
    return true;
}
