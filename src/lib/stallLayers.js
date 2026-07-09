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
// flag (set in the Fees tab), not from its name.
const BEDDING_RE = /shaving|bedding|straw/i;

export const STALL_LAYERS = [
    { id: 'number', label: 'Stall #', hint: 'The stall number only — the classic chart.' },
    { id: 'name', label: 'Exhibitor', hint: 'The exhibitor who holds each stall.' },
    { id: 'trainer', label: 'Trainer / Group', hint: 'Which trainer, ranch or group the stall belongs to.' },
    { id: 'horses', label: 'Horses', hint: 'How many horses the exhibitor is bringing.' },
    { id: 'shavings', label: 'Shavings', hint: 'Bags of shavings bought, spread evenly over that exhibitor\'s stalls.' },
    { id: 'prebed', label: 'Pre-bedded', hint: 'Stalls bedded before the show, and how many bags each got.' },
];

export const layerById = (id) => STALL_LAYERS.find(l => l.id === id) || STALL_LAYERS[0];

const norm = (s) => String(s || '').trim().toLowerCase();

// Marker a booking carries when the organizer pulled it out of every group by hand.
const NO_GROUP = '__none__';

// The group a booking belongs to — the same rule the Assign board and the printer
// use. A manual group wins; otherwise the trainer / ranch they booked under; and
// NO_GROUP means "keep this one on their own".
const groupNameOf = (b) => {
    const manual = (b.stallGroup || '').trim();
    if (manual === NO_GROUP) return '';
    if (manual) return manual;
    return (b.trainerName || '').trim();
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
 * Build the lookup every layer reads: stallId → { bags, preBedBags, … } plus
 * bookingId → { exhibitor, trainer, horses }.
 *
 * At-show "live-supply" re-orders carry no stalls of their own, so their bags are
 * folded into the stall booking of the same exhibitor name — that is who the
 * facility actually walks the bags out to.
 */
export function buildLayerIndex({ bookings = [], barns = [], supplies = [] } = {}) {
    const supplyMeta = {};
    for (const s of supplies) {
        const meta = { name: s.name || '', preBedding: !!s.preBedding };
        if (s.id) supplyMeta[s.id] = meta;
        if (s.name) supplyMeta[s.name] = meta;
    }

    const active = bookings.filter(b => b && b.status !== 'cancelled');
    const stallBookings = active.filter(b => b.orderType !== 'live-supply');
    const liveOrders = active.filter(b => b.orderType === 'live-supply');

    // exhibitor name → the stall booking that live re-orders belong to
    const bookingByExhibitor = {};
    for (const b of stallBookings) {
        const key = norm(b.exhibitorName);
        if (key && !bookingByExhibitor[key]) bookingByExhibitor[key] = b.id;
    }

    // Count the supply lines on one booking.
    const tally = (booking) => {
        let bags = 0, preBed = 0;
        for (const item of booking.items || []) {
            if (item.type !== 'supply') continue;
            const meta = supplyMeta[item.refId] || { name: item.name || '', preBedding: false };
            const qty = Number(item.qty) || 0;
            if (meta.preBedding) preBed += qty;
            else if (BEDDING_RE.test(meta.name) || BEDDING_RE.test(item.name || '')) bags += qty;
        }
        return { bags, preBed };
    };

    const byBooking = {};
    for (const b of stallBookings) {
        const { bags, preBed } = tally(b);
        byBooking[b.id] = {
            exhibitor: b.exhibitorName || '',
            trainer: groupNameOf(b),
            horses: Number(b.horseCount) || (Array.isArray(b.horseNames) ? b.horseNames.length : 0),
            horseNames: Array.isArray(b.horseNames) ? b.horseNames : String(b.horseNames || '').split(',').map(s => s.trim()).filter(Boolean),
            bags,
            preBed,
        };
    }
    // Fold at-show re-orders into their exhibitor's stall booking.
    for (const o of liveOrders) {
        const target = bookingByExhibitor[norm(o.exhibitorName)];
        if (!target || !byBooking[target]) continue;
        const { bags, preBed } = tally(o);
        byBooking[target].bags += bags;
        byBooking[target].preBed += preBed;
    }

    // Spread each booking's bags across the stalls it actually holds.
    const byStall = {};
    for (const [bookingId, info] of Object.entries(byBooking)) {
        const ids = stallsOfBooking(barns, bookingId);
        if (!ids.length) continue;
        const bagSpread = spread(info.bags, ids.length);
        const preSpread = spread(info.preBed, ids.length);
        ids.forEach((stallId, i) => {
            byStall[stallId] = { bags: bagSpread[i] || 0, preBed: preSpread[i] || 0 };
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

/**
 * What one stall box says under the chosen layer.
 * Returns { text, sub, tone } — `tone` lets the box tint itself:
 *   'booked'  normal owner colour   'warm' pre-bedded   'muted' nothing to show
 */
export function layerCell(layerId, { unit, index }) {
    const num = unit.number || '';
    if (!index || !unit.bookingId) return { text: num, sub: '', tone: unit.bookingId ? 'booked' : 'muted' };

    const b = index.byBooking[unit.bookingId];
    const s = index.byStall[unit.id];
    if (!b) return { text: num, sub: '', tone: 'booked' };

    switch (layerId) {
        case 'name':
            return { text: shortName(b.exhibitor) || num, sub: num, tone: 'booked' };
        case 'trainer':
            return { text: b.trainer || '—', sub: num, tone: b.trainer ? 'booked' : 'muted' };
        case 'horses':
            return { text: b.horses ? `${b.horses}🐴` : '—', sub: num, tone: b.horses ? 'booked' : 'muted' };
        case 'shavings': {
            const bags = s?.bags || 0;
            return { text: bags ? `${bags} bag${bags > 1 ? 's' : ''}` : '—', sub: num, tone: bags ? 'booked' : 'muted' };
        }
        case 'prebed': {
            const bags = s?.preBed || 0;
            return { text: bags ? `✓ ${bags}` : '—', sub: num, tone: bags ? 'warm' : 'muted' };
        }
        case 'number':
        default:
            return { text: num, sub: '', tone: 'booked' };
    }
}

// One-line explanation shown under the chart so nobody has to guess how a number
// was produced (especially the evenly-spread bag counts).
export const layerLegend = (layerId) => {
    switch (layerId) {
        case 'shavings': return 'Bags bought by each exhibitor, spread evenly across the stalls they hold. At-show re-orders are included.';
        case 'prebed': return 'Stalls bedded before the show. The number is how many pre-bedding units that stall received.';
        case 'horses': return 'Horses the exhibitor told us they are bringing (not the same as stalls booked).';
        case 'trainer': return 'The trainer / ranch / group each stall belongs to.';
        case 'name': return 'The exhibitor holding each stall. The stall number stays in the corner.';
        default: return '';
    }
};
