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
export const stageIndexOf = (order) => {
    const raw = order?.fulfillmentStatus === 'fulfilled' ? 'delivered' : order?.fulfillmentStatus;
    const i = SUPPLY_STAGES.findIndex(s => s.key === raw);
    return i === -1 ? 0 : i;
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
