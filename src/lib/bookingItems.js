// Shared booking line-item builder.
//
// Turns an inventory (barns / rvAreas / supplies) + a selection of quantities
// into the booking `items[]` array and a subtotal. Used by BOTH the public
// booking page and the organizer's manual "Add Booking" dialog so the two
// produce IDENTICAL booking shapes — same item.type / refId / qty / amount.
// Everything downstream (Manage Stalls quota, Smart Auto-Assign, Booked counts,
// occupancy, Projected Revenue) reads those fields, so they must match.
//
// Note: RV early/late-arrival fees are intentionally left to the public page
// (they depend on the exhibitor's arrival/departure vs the show window). A quick
// internal booking prices the base stall / RV / supply lines only.

import { buildExtraStallFeeItems, stallsByBarnFromSelection } from './extraStallFees';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export function buildBookingItems(inventory, selection, nights, { horseCount = 0 } = {}) {
    const items = [];
    let subtotal = 0;
    const n = Math.max(1, Number(nights) || 1);

    for (const barn of inventory?.barns || []) {
        const qty = selection?.stalls?.[barn.id] || 0;
        if (qty > 0) {
            const unitPrice = barn.pricePerNight || 0;
            const amount = qty * unitPrice * n;
            subtotal += amount;
            items.push({
                type: 'stall',
                refId: barn.id,
                name: `${barn.name} × ${qty}`,
                detail: `${money(unitPrice)}/night × ${n} night${n !== 1 ? 's' : ''} × ${qty}`,
                qty,
                nights: n,
                unitPrice,
                amount,
            });
        }
    }

    // Circuit / flat / late-entry fees that aren't tied to one barn. Added right
    // after the stall lines so they read together on the invoice.
    const extras = buildExtraStallFeeItems({
        extraStallFees: inventory?.extraStallFees || [],
        stallsByBarn: stallsByBarnFromSelection(selection),
        nights: n,
        horseCount,
    });
    items.push(...extras.items);
    subtotal += extras.subtotal;

    for (const rv of inventory?.rvAreas || []) {
        const qty = selection?.rvs?.[rv.id] || 0;
        if (qty > 0) {
            const pricingModel = rv.pricingModel || 'nightly';
            const isFlat = pricingModel === 'flat';
            const unitPrice = isFlat ? (rv.flatRate || 0) : (rv.pricePerNight || 0);
            const amount = isFlat ? qty * unitPrice : qty * unitPrice * n;
            subtotal += amount;
            items.push({
                type: 'rv',
                refId: rv.id,
                name: `${rv.name} (RV) × ${qty}`,
                detail: isFlat
                    ? `${money(unitPrice)} flat × ${qty}`
                    : `${money(unitPrice)}/night × ${n} night${n !== 1 ? 's' : ''} × ${qty}`,
                qty,
                nights: n,
                unitPrice,
                amount,
                pricingModel,
            });
        }
    }

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
