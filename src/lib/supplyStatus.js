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
