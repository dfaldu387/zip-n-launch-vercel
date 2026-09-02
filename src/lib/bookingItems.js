// Shared booking line-item builder.
//
// Turns an inventory (barns / rvAreas / supplies) + a selection of quantities
// into the booking `items[]` array and a subtotal. Used by the organizer's
// manual "Add Booking" dialog so it produces the SAME booking shape as an
// online booking — same item.type / refId / qty / amount / feeType.
// Everything downstream (Manage Stalls quota, Smart Auto-Assign, Booked counts,
// occupancy, Projected Revenue) reads those fields, so they must match.
//
// Flat Fee and Nightly Fee are two separate purchase options, never combined
// (see buildBarnStallOptionItems) — `selection.stalls[barnId]` /
// `selection.rvs[rvAreaId]` are `{ flat: qty, night: qty }`, same shape the
// public booking page's split selector writes.
//
// Note: RV early/late-arrival fees are intentionally left to the public page
// (they depend on the exhibitor's arrival/departure vs the show window). A quick
// internal booking prices the base stall / RV / supply lines only.

import { buildExtraStallFeeItems, buildBarnStallOptionItems, stallsByBarnFromSelection } from './extraStallFees';
import { buildRvAreaOptionItems, rvsByAreaFromSelection } from './extraRvFees';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export function buildBookingItems(inventory, selection, nights, { horseCount = 0 } = {}) {
    const items = [];
    let subtotal = 0;
    const n = Math.max(1, Number(nights) || 1);
    const stallsByBarn = stallsByBarnFromSelection(selection);

    const barnStalls = buildBarnStallOptionItems({
        barns: inventory?.barns || [],
        stallSelection: selection?.stalls || {},
        extraStallFees: inventory?.extraStallFees || [],
        nights: n,
    });
    items.push(...barnStalls.items);
    subtotal += barnStalls.subtotal;

    // Circuit / late-entry / other facility-wide fees that aren't tied to one
    // barn. Added right after the stall lines so they read together on the
    // invoice. Per-Night fees are excluded — they're already folded into the
    // barn's nightly rate above (see nightlyRateForBarn); Flat fees are
    // excluded too — a barn with one is charged its flat rate directly in the
    // stall line above (see buildBarnStallOptionItems), so charging either
    // again here would double-bill.
    const extras = buildExtraStallFeeItems({
        extraStallFees: inventory?.extraStallFees || [],
        stallsByBarn,
        nights: n,
        horseCount,
        excludeUnitTypes: ['per_night', 'flat'],
    });
    items.push(...extras.items);
    subtotal += extras.subtotal;

    const rvAreas = buildRvAreaOptionItems({
        rvAreas: inventory?.rvAreas || [],
        rvSelection: selection?.rvs || {},
        extraRvFees: inventory?.extraRvFees || [],
        nights: n,
    });
    items.push(...rvAreas.items);
    subtotal += rvAreas.subtotal;

    for (const supply of inventory?.supplies || []) {
        const key = supply.id || supply.name;
        const qty = selection?.supplies?.[key] || 0;
        if (qty > 0) {
            const unitPrice = supply.price || 0;
            const amount = qty * unitPrice;
            subtotal += amount;
            items.push({
                type: 'supply',
                refId: key,
                name: `${supply.name} × ${qty}`,
                detail: `${money(supply.price)} per ${supply.unit || 'unit'} × ${qty}`,
                qty,
                unitPrice,
                amount,
            });
        }
    }

    return { items, subtotal };
}

/**
 * The inverse of buildBookingItems — turns a booking's stored items[] back
 * into the selection shape the Add/Edit Booking dialogs edit ({ stalls, rvs,
 * supplies }), so editing an existing booking can pre-fill its Flat Fee /
 * Nightly Fee choices instead of starting blank. A legacy 'stall'/'rv' item
 * with no recorded feeType (booked before the split selector existed) is
 * treated as Nightly — the same default the rest of the split system falls
 * back to for items that predate feeType.
 */
export function selectionFromBookingItems(items = []) {
    const stalls = {};
    const rvs = {};
    const supplies = {};
    for (const it of items || []) {
        const qty = Number(it.qty) || 0;
        if (qty <= 0 || !it.refId) continue;
        if (it.type === 'stall' || it.type === 'rv') {
            const bucket = it.type === 'stall' ? stalls : rvs;
            const kind = it.feeType === 'flat' ? 'flat' : 'night';
            bucket[it.refId] = { ...(bucket[it.refId] || {}), [kind]: (bucket[it.refId]?.[kind] || 0) + qty };
        } else if (it.type === 'supply') {
            supplies[it.refId] = (supplies[it.refId] || 0) + qty;
        }
    }
    return { stalls, rvs, supplies };
}
