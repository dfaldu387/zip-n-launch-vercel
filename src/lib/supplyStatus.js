import { ClipboardList, Package, Truck, CheckCircle2 } from 'lucide-react';

// Delivery pipeline, in order — the single source of truth for what a hay/
// shavings order's fulfillmentStatus means, shared by the Hay & Shavings tab,
// the Booking row, and the Master List so all three read one status the same
// way.
export const SUPPLY_STAGES = [
    { key: 'new', label: 'Ordered', icon: ClipboardList, color: 'bg-amber-600' },
    { key: 'received', label: 'Received', icon: Package, color: 'bg-blue-600', advanceLabel: 'Mark Received' },
    { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck, color: 'bg-violet-600', advanceLabel: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'bg-emerald-600', advanceLabel: 'Mark Delivered' },
];

// Orders placed before the pipeline existed only knew 'new' | 'fulfilled'.
// Treat the old 'fulfilled' as the final 'delivered' stage.
const legacyStatusOf = (order) => (order?.fulfillmentStatus === 'fulfilled' ? 'delivered' : (order?.fulfillmentStatus || 'new'));
const legacyStamps = (order) => ({ new: order?.createdAt, ...(order?.stageTimestamps || {}) });

// A single line item (Shavings, Hay-Grass, Hay-Alfalfa...) can now be moved
// through the pipeline on its own — Robert: "we might go out and deliver the
// Shavings, but not get to the Hay yet." Per-item status/timestamps live in
// order.itemStatuses, keyed by the item's refId. An item with no entry there
// (an order placed before per-item tracking existed, or one nobody has
// touched individually yet) falls back to the order's own legacy status, so
// nothing that predates this reads as blank or wrong.
export const getItemStatus = (order, refId) => {
    const own = order?.itemStatuses?.[refId];
    if (own) return { status: own.status || 'new', stageTimestamps: { new: order?.createdAt, ...(own.stageTimestamps || {}) } };
    return { status: legacyStatusOf(order), stageTimestamps: legacyStamps(order) };
};

export const itemStageIndexOf = (order, refId) => {
    const i = SUPPLY_STAGES.findIndex(s => s.key === getItemStatus(order, refId).status);
    return i === -1 ? 0 : i;
};

export const getItemStage = (order, refId) => SUPPLY_STAGES[itemStageIndexOf(order, refId)];

export const isItemDelivered = (order, refId) => itemStageIndexOf(order, refId) === SUPPLY_STAGES.length - 1;

// Order-level stage — everything outside the Hay & Shavings tab (Master List,
// Booking row, the pending/delivered split) still reads one status per order.
// An order is only as far along as its slowest item, so this is the MINIMUM
// stage across its supply line items. Orders with no supply items (or items
// with no refId, from very old data) fall back to the order's own status.
export const stageIndexOf = (order) => {
    const supplyItems = (order?.items || []).filter(it => it?.type === 'supply' && it.refId);
    if (supplyItems.length === 0) {
        const i = SUPPLY_STAGES.findIndex(s => s.key === legacyStatusOf(order));
        return i === -1 ? 0 : i;
    }
    return Math.min(...supplyItems.map(it => itemStageIndexOf(order, it.refId)));
};

export const isDelivered = (order) => stageIndexOf(order) === SUPPLY_STAGES.length - 1;

export const getSupplyStage = (order) => SUPPLY_STAGES[stageIndexOf(order)];

// Most recent stage timestamp across every supply item on the order — for
// Robert: "in our master list, give us the ability to look... when these
// changes happen." Used where the Master List can only show one status per
// order (the row is scoped per booking, not per item) but still wants to
// show how fresh that status is.
export const getSupplyLastUpdate = (order) => {
    const supplyItems = (order?.items || []).filter(it => it?.type === 'supply' && it.refId);
    let latest = null;
    for (const it of supplyItems) {
        const { stageTimestamps } = getItemStatus(order, it.refId);
        for (const iso of Object.values(stageTimestamps || {})) {
            if (iso && (!latest || new Date(iso) > new Date(latest))) latest = iso;
        }
    }
    return latest || order?.createdAt || null;
};

// Pre-ordered supplies (shavings / hay / feed) on a booking — one entry per
// supply line item. item.name already reads like "Shavings × 3"; strip the
// trailing "× n" so it can be re-rendered consistently as "Shavings ×3" with
// qty exposed on its own.
export const getSupplyLineItems = (booking) =>
    (booking?.items || [])
        .filter(it => it?.type === 'supply')
        .map(it => {
            const qty = Number(it.qty) || 0;
            const base = String(it.name || '').replace(/\s*×\s*\d+\s*$/, '').trim();
            return { name: base || it.name || 'Item', qty };
        });

// A supply's unit ("bag", "bale"...), looked up by refId (id or name, since
// older orders only ever stored the name) — shared by the Load Sheet and the
// per-item status row, so both show the same "N bags" wording.
export const unitLookup = (supplies) => {
    const unitOf = new Map();
    for (const s of supplies || []) {
        if (s.id) unitOf.set(s.id, s.unit || 'unit');
        if (s.name) unitOf.set(s.name, s.unit || 'unit');
    }
    return unitOf;
};

// Robert: "if we have to load the trailer to go deliver these... it tells us
// what we need to load and how many bags of each supply." Given a set of
// orders (checked by the facility for one delivery run), sums how much of
// each supply is still owed — skipping items already delivered — both as one
// flat total and grouped by barn/stall so a crew knows what goes where.
// order.barnName/stallNumber are set on pre-show orders (real stall
// assignment); at-show reorders have no barn, so they fall under "Unassigned".
export const buildLoadSheet = (orders, supplies) => {
    const unitOf = unitLookup(supplies);

    const bySupply = new Map(); // name -> { qty, unit }
    const byBarn = new Map();   // barnLabel -> { totals: Map(name -> {qty,unit}), stalls: Map(stallLabel -> Map(name -> {qty,unit})) }
    let orderCount = 0;

    for (const order of orders || []) {
        const items = (order.items || []).filter(it => it?.type === 'supply');
        let orderHasQty = false;
        for (const item of items) {
            const { status } = getItemStatus(order, item.refId);
            if (status === 'delivered') continue;
            const qty = Number(item.qty) || 0;
            if (!qty) continue;
            orderHasQty = true;

            const name = String(item.name || '').replace(/\s*×\s*\d+\s*$/, '').trim() || 'Item';
            const unit = unitOf.get(item.refId) || unitOf.get(name) || 'unit';

            const prevSupply = bySupply.get(name) || { qty: 0, unit };
            bySupply.set(name, { qty: prevSupply.qty + qty, unit });

            const barnLabel = order.barnName || 'Unassigned';
            const stallLabel = order.stallNumber ? `Stall ${order.stallNumber}` : (order.exhibitorName || 'Unknown');

            if (!byBarn.has(barnLabel)) byBarn.set(barnLabel, { totals: new Map(), stalls: new Map() });
            const barnEntry = byBarn.get(barnLabel);
            const prevTotal = barnEntry.totals.get(name) || { qty: 0, unit };
            barnEntry.totals.set(name, { qty: prevTotal.qty + qty, unit });

            if (!barnEntry.stalls.has(stallLabel)) barnEntry.stalls.set(stallLabel, new Map());
            const stallMap = barnEntry.stalls.get(stallLabel);
            const prevStall = stallMap.get(name) || { qty: 0, unit };
            stallMap.set(name, { qty: prevStall.qty + qty, unit });
        }
        if (orderHasQty) orderCount += 1;
    }

    return { bySupply, byBarn, orderCount };
};
