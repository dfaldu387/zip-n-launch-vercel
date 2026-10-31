// Opens a clean, print-ready window for a Load Sheet — Robert: "generate a
// load sheet... it tells us what we need to load and how many bags of each
// supply." Mirrors the window.open + autoPrint pattern in stallingChartPrint.js.
import QRCode from 'qrcode';
import { buildDeliveryUrl } from '@/lib/deliveryLink';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const plural = (qty) => (qty === 1 ? '' : 's');

function buildLoadSheetHtml({ showName = 'Show', bySupply, byBarn, orderCount = 0, lines = [], itemFilter = [] }) {
    const generatedAt = new Date().toLocaleString();
    const filterNote = itemFilter.length ? ` &middot; Only: ${itemFilter.map(esc).join(', ')}` : '';

    // One block per order — Robert: who it is delivered to, who they stable
    // with, which stalls, and what items, so the driver knows where it goes.
    const lineBlocks = lines
        .map(l => {
            const items = l.items
                .map(({ name, qty, unit }) => `${qty} ${esc(unit)}${plural(qty)} ${esc(name)}`)
                .join(', ');
            return `
                <div class="line">
                    <div class="info">
                        <div class="who"><strong>${esc(l.customer)}</strong>${l.stableWith ? ` <span class="sub">Stabling with/under: ${esc(l.stableWith)}</span>` : ''}</div>
                        <div class="where">${esc(l.barnName)}${l.stalls ? ` &middot; Stall ${esc(l.stalls)}` : ''}</div>
                        <div class="what">${items}</div>
                    </div>
                    ${l.qr ? `<div class="qr"><a href="${esc(l.qrUrl)}" target="_blank" rel="noopener"><img src="${l.qr}" alt="Scan to mark delivered" /></a><span>Scan when delivered</span></div>` : ''}
                </div>
            `;
        })
        .join('');

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
        .line{border-bottom:1px solid #ddd;padding:8px 0;font-size:13px;page-break-inside:avoid;display:flex;justify-content:space-between;align-items:center;gap:12px;}
        .line .info{min-width:0;flex:1;}
        .line .qr{text-align:center;flex-shrink:0;}
        .line .qr img{width:112px;height:112px;display:block;}
        .line .qr span{font-size:9px;color:#555;}
        .line .sub{color:#555;font-size:12px;margin-left:8px;}
        .line .where{color:#444;margin-top:2px;}
        .line .what{margin-top:2px;font-weight:600;}
        @media print{ body{padding:0} }
    </style>
    </head><body>
        <h1>Load Sheet — ${esc(showName)}</h1>
        <p class="meta">Generated ${esc(generatedAt)} &middot; ${orderCount} order${plural(orderCount)} with supplies to load${filterNote}</p>

        <h2>Load Totals</h2>
        <table><tbody>${supplyRows || '<tr><td>Nothing left to load.</td></tr>'}</tbody></table>

        <h2>By Barn / Location</h2>
        ${barnBlocks || '<p class="meta">No barn/location on these orders.</p>'}

        ${lineBlocks ? `<h2>Deliveries</h2>${lineBlocks}` : ''}

        <script>window.onload=function(){window.focus();window.print();}<\/script>
    </body></html>`;
}

// Adds a QR data-URL to every line that has a delivery secret + a show id.
// `data.showId` is the show the QR link points back to.
async function withQrCodes(data) {
    if (!data.showId || !data.lines?.length) return data;
    const origin = window.location.origin;
    const lines = await Promise.all(data.lines.map(async (l) => {
        if (!l.deliverySecret || !l.id) return l;
        const url = buildDeliveryUrl({
            origin, showId: data.showId, bookingId: l.id, secret: l.deliverySecret, itemRefIds: l.itemRefIds,
        });
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'L' });
        return { ...l, qr, qrUrl: url };
    }));
    return { ...data, lines };
}

// `win` lets the caller open the window first (inside the click) and print into
// it after async work — otherwise the browser's pop-up blocker eats the window.
export async function printLoadSheet(data, win = null) {
    const html = buildLoadSheetHtml(await withQrCodes(data));
    const w = win || window.open('', '_blank');
    if (!w) return false;
    // open() wipes the "Preparing Load Sheet…" placeholder the caller wrote.
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
}
