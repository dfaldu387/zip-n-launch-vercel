// Stall-chart display layers.
//
// Robert's ask: "maybe we want one that shows all the names in each stall, or one
// that shows how many bags of shavings were purchased, or which stalls were
// pre-bedded — so we can share these in different forms."
//
// A layer only changes what is WRITTEN inside each stall box. It never changes the
// layout, the assignment, or any stored data. The same index feeds the on-screen
// board and the printed chart, so what you see is what you print.

// Bedding-ish supply names. Pre-bedding is detected from the supply's `preBedding`
// flag (set in the Fees tab), not from its name — this regex only separates
// SHAVINGS from HAY once we already know something is a bedding-type supply.
const SHAVINGS_RE = /shaving|bedding|straw/i;
const HAY_RE = /\bhay\b|alfalfa/i;

export const STALL_LAYERS = [
    { id: 'number', label: 'Stall #', hint: 'The stall number only — the classic chart.' },
    { id: 'name', label: 'Exhibitor', hint: 'The exhibitor who holds each stall.' },
    { id: 'trainer', label: 'Trainer / Group', hint: 'Which trainer, ranch or group the stall belongs to.' },
    { id: 'horses', label: 'Horses', hint: 'How many horses the exhibitor is bringing.' },
    { id: 'shavings', label: 'Shavings', hint: 'Bags of shavings ordered ahead of the show, spread evenly over that exhibitor\'s stalls.' },
    { id: 'atShowShavings', label: 'Shavings (at-show)', hint: 'Bags reordered during the show — kept separate from what was pre-bedded.' },
    { id: 'prebedHay', label: 'Pre-Bed Hay', hint: 'Stalls bedded with hay before the show, and how many bales each got.' },
    { id: 'prebedShavings', label: 'Pre-Bed Shavings', hint: 'Stalls bedded with shavings before the show, and how many bags each got.' },
];

export const layerById = (id) => STALL_LAYERS.find(l => l.id === id) || STALL_LAYERS[0];

// Layers safe to show on the public Event page — no counts, no logistics, just
// who is in which stall. Horses / shavings / pre-bedded stay admin-only.
export const PUBLIC_LAYER_IDS = ['number', 'name', 'trainer'];

const norm = (s) => String(s || '').trim().toLowerCase();

// Marker a booking carries when the organizer pulled it out of every group by hand.
const NO_GROUP = '__none__';

// The group a booking belongs to — the same rule the Assign board and the printer
// use. A manual group wins; otherwise the trainer / ranch they booked under; and
// if there's no trainer either, the exhibitor's own name (so a solo booking is
// never nameless — it just reads as a group of one). NO_GROUP means "keep this
// one on their own" and stays blank even then.
const groupNameOf = (b) => {
    const manual = (b.stallGroup || '').trim();
    if (manual === NO_GROUP) return '';
    if (manual) return manual;
    const trainer = (b.trainerName || '').trim();
    if (trainer) return trainer;
    return (b.exhibitorName || '').trim();
};

// Spread a total evenly across n stalls; the remainder lands on the earliest stalls.
// 7 bags over 3 stalls → [3, 2, 2]. Deterministic, and it always sums back to the total.
const spread = (total, n) => {
    if (n <= 0 || total <= 0) return [];
    const base = Math.floor(total / n);
    const rem = total % n;
    return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
};

// Every stall a booking holds, in chart order (barn order, then box order) — so the
// "first stalls" that receive the remainder are the ones at the top-left of the chart.
const stallsOfBooking = (barns, bookingId) => {
    const out = [];
    for (const barn of barns || []) {
        for (const s of barn.stalls || []) {
            if (s.bookingId === bookingId && (s.type || 'stall') === 'stall') out.push(s.id);
        }
    }
    return out;
};

/**
 * Build the lookup every layer reads: stallId → { bags, preBedHay, preBedShavings,
 * atShowBags } plus bookingId → { exhibitor, trainer, horses }.
 *
 * At-show "live-supply" re-orders carry no stalls of their own, so their bags are
 * folded into the stall booking of the same exhibitor name — that is who the
 * facility actually walks the bags out to. They're kept in their OWN bucket
 * (atShowBags), never merged into the pre-show or pre-bedding numbers — Robert:
 * "if shavings are ordered at the show, that's a separate category."
 */
// Supply id/name → { name, preBedding }, so a line item can be looked up by
// either its refId or (for older data with no refId) its own name.
const supplyMetaOf = (supplies) => {
    const meta = {};
    for (const s of supplies || []) {
        const m = { name: s.name || '', preBedding: !!s.preBedding };
        if (s.id) meta[s.id] = m;
        if (s.name) meta[s.name] = m;
    }
    return meta;
};

// The hay/shavings line items on a booking — the physical things a barn crew
// delivers to a stall, as opposed to stall rent, RV or other fees. Used by the
// chart layers above and by the delivery checklist (HousingGroundsManagerPage).
// A plain (non-pre-bedded) order still needs delivering, so preBedding is
// reported per item rather than filtered out.
export function beddingItemsOf(booking, supplies) {
    const meta = supplyMetaOf(supplies);
    return (booking?.items || [])
        .filter(it => it.type === 'supply')
        .map(it => {
            const m = meta[it.refId] || { name: it.name || '', preBedding: false };
            const name = m.name || it.name || '';
            const isHay = HAY_RE.test(name);
            const isShavings = !isHay && SHAVINGS_RE.test(name);
            return { ...it, name, isHay, isShavings, preBedding: m.preBedding };
        })
        .filter(it => it.isHay || it.isShavings);
}

export function buildLayerIndex({ bookings = [], barns = [], supplies = [] } = {}) {
    const supplyMeta = supplyMetaOf(supplies);

    const active = bookings.filter(b => b && b.status !== 'cancelled');
    const stallBookings = active.filter(b => b.orderType !== 'live-supply');
    const liveOrders = active.filter(b => b.orderType === 'live-supply');

    // exhibitor name → the stall booking that live re-orders belong to
    const bookingByExhibitor = {};
    for (const b of stallBookings) {
        const key = norm(b.exhibitorName);
        if (key && !bookingByExhibitor[key]) bookingByExhibitor[key] = b.id;
    }

    // Count the supply lines ordered ahead of the show (the original booking):
    // plain shavings, pre-bedded hay, and pre-bedded shavings, kept apart —
    // Robert: "the pre-bedded... has the shavings and the hay grouped together."
    const tallyAhead = (booking) => {
        let bags = 0, preBedHay = 0, preBedShavings = 0;
        for (const item of booking.items || []) {
            if (item.type !== 'supply') continue;
            const meta = supplyMeta[item.refId] || { name: item.name || '', preBedding: false };
            const name = meta.name || item.name || '';
            const qty = Number(item.qty) || 0;
            const isHay = HAY_RE.test(name);
            const isShavings = !isHay && SHAVINGS_RE.test(name);
            if (meta.preBedding) {
                if (isHay) preBedHay += qty;
                else if (isShavings) preBedShavings += qty;
            } else if (isShavings) {
                bags += qty;
            }
        }
        return { bags, preBedHay, preBedShavings };
    };

    // Count the shavings lines on an at-show re-order — its own bucket, never
    // merged with the pre-show numbers above.
    const tallyAtShow = (order) => {
        let atShowBags = 0;
        for (const item of order.items || []) {
            if (item.type !== 'supply') continue;
            const meta = supplyMeta[item.refId] || { name: item.name || '', preBedding: false };
            const name = meta.name || item.name || '';
            if (!HAY_RE.test(name) && SHAVINGS_RE.test(name)) atShowBags += Number(item.qty) || 0;
        }
        return atShowBags;
    };

    const byBooking = {};
    for (const b of stallBookings) {
        const { bags, preBedHay, preBedShavings } = tallyAhead(b);
        byBooking[b.id] = {
            exhibitor: b.exhibitorName || '',
            trainer: groupNameOf(b),
            horses: Number(b.horseCount) || (Array.isArray(b.horseNames) ? b.horseNames.length : 0),
            horseNames: Array.isArray(b.horseNames) ? b.horseNames : String(b.horseNames || '').split(',').map(s => s.trim()).filter(Boolean),
            bags,
            preBedHay,
            preBedShavings,
            atShowBags: 0,
        };
    }
    // Fold at-show re-orders into their exhibitor's stall booking, in their own bucket.
    for (const o of liveOrders) {
        const target = bookingByExhibitor[norm(o.exhibitorName)];
        if (!target || !byBooking[target]) continue;
        byBooking[target].atShowBags += tallyAtShow(o);
    }

    // Spread each booking's counts across the stalls it actually holds.
    const byStall = {};
    for (const [bookingId, info] of Object.entries(byBooking)) {
        const ids = stallsOfBooking(barns, bookingId);
        if (!ids.length) continue;
        const bagSpread = spread(info.bags, ids.length);
        const preHaySpread = spread(info.preBedHay, ids.length);
        const preShavSpread = spread(info.preBedShavings, ids.length);
        const atShowSpread = spread(info.atShowBags, ids.length);
        ids.forEach((stallId, i) => {
            byStall[stallId] = {
                bags: bagSpread[i] || 0,
                preBedHay: preHaySpread[i] || 0,
                preBedShavings: preShavSpread[i] || 0,
                atShowBags: atShowSpread[i] || 0,
            };
        });
    }

    return { byBooking, byStall };
}

// Trim a name so it fits a stall box without turning into a wall of text.
const shortName = (full) => {
    const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return parts[0] || '';
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

// One line of content for a single layer, or null when that layer has nothing
// to say for this stall (e.g. "Shavings" checked but none were bought).
function singleLayerLine(layerId, { unit, index }) {
    const b = index.byBooking[unit.bookingId];
    const s = index.byStall[unit.id];
    switch (layerId) {
        case 'name':
            return b.exhibitor ? { text: shortName(b.exhibitor), tone: 'booked' } : null;
        case 'trainer': {
            // Hierarchy: group/trainer name on top, then (when it's a real group, not
            // just the exhibitor's own name standing in for one) the exhibitor below.
            const trainer = b.trainer || '';
            if (!trainer) return null;
            const isRealGroup = norm(trainer) !== norm(b.exhibitor);
            // Solo booking: the trainer line IS the exhibitor's name (just unshortened),
            // so a separately-checked "Exhibitor" field must not repeat it below.
            return { text: trainer, subExhibitor: isRealGroup ? shortName(b.exhibitor) : '', isExhibitorStandIn: !isRealGroup, tone: 'booked' };
        }
        case 'horses':
            return b.horses ? { text: `${b.horses}🐴`, tone: 'booked' } : null;
        case 'shavings': {
            const bags = s?.bags || 0;
            return bags ? { text: `${bags} bag${bags > 1 ? 's' : ''}`, tone: 'booked' } : null;
        }
        case 'atShowShavings': {
            const bags = s?.atShowBags || 0;
            return bags ? { text: `+${bags} bag${bags > 1 ? 's' : ''}`, tone: 'booked' } : null;
        }
        case 'prebedHay': {
            const bales = s?.preBedHay || 0;
            return bales ? { text: `✓ ${bales} bale${bales > 1 ? 's' : ''}`, tone: 'warm' } : null;
        }
        case 'prebedShavings': {
            const bags = s?.preBedShavings || 0;
            return bags ? { text: `✓ ${bags} bag${bags > 1 ? 's' : ''}`, tone: 'warm' } : null;
        }
        default:
            return null;
    }
}

// Fixed, readable stacking order regardless of the order the boxes were checked.
const LAYER_STACK_ORDER = ['trainer', 'name', 'horses', 'shavings', 'atShowShavings', 'prebedHay', 'prebedShavings'];

/**
 * What one stall box shows for a set of checked layers (Robert's ask: several
 * fields stacked in the same box, e.g. Trainer + Exhibitor + Stall #).
 * `layerIds` accepts a single id (legacy) or an array of ids.
 *
 * Returns { lines: [{ text, subExhibitor?, tone }], num, tone } — `tone` lets
 * the box tint itself: 'booked' normal owner colour, 'warm' pre-bedded,
 * 'muted' nothing to show. The stall number is always available as `num`;
 * callers decide whether to print it (e.g. as a corner label) once, rather
 * than repeating it per line.
 */
export function layerCell(layerIds, { unit, index }) {
    const ids = Array.isArray(layerIds) ? layerIds : [layerIds];
    const num = unit.number || '';
    const showNum = ids.includes('number');
    const wanted = ids.filter(id => id !== 'number');

    if (!index || !unit.bookingId) return { lines: [], num: showNum ? num : '', tone: unit.bookingId ? 'booked' : 'muted' };
    const b = index.byBooking[unit.bookingId];
    if (!b || !wanted.length) return { lines: [], num: showNum ? num : '', tone: 'booked' };

    const lines = [];
    const seen = new Set();
    let tone = null;
    let usedExhibitorAsSub = false; // Trainer already prints the exhibitor as its sub-line
    for (const id of LAYER_STACK_ORDER) {
        if (!wanted.includes(id)) continue;
        if (id === 'name' && usedExhibitorAsSub) continue;
        const line = singleLayerLine(id, { unit, index });
        if (!line || seen.has(line.text)) continue;
        seen.add(line.text);
        lines.push(line);
        if (line.subExhibitor || line.isExhibitorStandIn) usedExhibitorAsSub = true;
        if (line.tone === 'warm') tone = 'warm';
    }
    if (!lines.length) return { lines: [{ text: showNum ? num : '—' }], num: '', tone: 'muted' };
    return { lines, num: showNum ? num : '', tone: tone || 'booked' };
}

// One-line explanation shown under the chart so nobody has to guess how a number
// was produced (especially the evenly-spread bag counts).
const legendFor = (layerId) => {
    switch (layerId) {
        case 'shavings': return 'Bags ordered ahead of the show, spread evenly across the stalls held.';
        case 'atShowShavings': return 'Bags reordered during the show — kept separate from what was pre-bedded.';
        case 'prebedHay': return 'Stalls bedded with hay before the show. The number is bales.';
        case 'prebedShavings': return 'Stalls bedded with shavings before the show. The number is bags.';
        case 'horses': return 'Horses the exhibitor told us they are bringing (not the same as stalls booked).';
        case 'trainer': return 'The trainer / ranch / group each stall belongs to.';
        case 'name': return 'The exhibitor holding each stall. The stall number stays in the corner.';
        default: return '';
    }
};

// Accepts a single layer id (legacy) or an array — one explanation per checked
// field, so a multi-field chart still tells the reader how each number works.
export const layerLegend = (layerIds) => {
    const ids = Array.isArray(layerIds) ? layerIds : [layerIds];
    return ids.map(legendFor).filter(Boolean).join('  ·  ');
};
