// Extra stall fees — stall fees that are NOT one-per-barn: a circuit fee across
// the whole facility, or a second fee on a barn that already has a nightly price.
//
// These are turned into booking line items at BOOKING TIME and stored on the
// booking. That is deliberate: a booking taken before the organizer added the fee
// keeps its original price and its already-sent invoice, and only new bookings
// pick the fee up. (Stall lines are the opposite — they are always recomputed
// live from the barn's current price; see bookingPricing.js.)
//
// The fee's own Unit Type decides the maths, so the organizer never has to say
// "per stall or once" twice.

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/**
 * Build the extra-stall-fee line items for one booking.
 *
 * @param {object}  args
 * @param {Array}   args.extraStallFees  Fees from stallingService.extraStallFees
 * @param {object}  args.stallsByBarn    { [barnId]: stallCount } being booked
 * @param {number}  [args.nights]        Nights of the stay (min 1)
 * @param {number}  [args.horseCount]    Horses on the booking (for Per Horse)
 * @returns {{items: Array, subtotal: number}}
 */
export function buildExtraStallFeeItems({ extraStallFees = [], stallsByBarn = {}, nights = 1, horseCount = 0 }) {
    const items = [];
    let subtotal = 0;
    const n = Math.max(1, Number(nights) || 1);
    const totalStalls = Object.values(stallsByBarn).reduce((s, q) => s + (Number(q) || 0), 0);

    for (const fee of extraStallFees) {
        // "All barns" counts every stall on the booking; a barn-specific fee only
        // counts the stalls booked in THAT barn. No stalls in scope → no charge.
        const inScope = fee.appliesTo === 'all'
            ? totalStalls
            : (Number(stallsByBarn[fee.appliesTo]) || 0);
        if (inScope <= 0) continue;

        const rate = Number(fee.amount) || 0;
        if (rate <= 0) continue;

        const unitType = fee.unitType || 'per_stall';
        let qty;
        let detail;
        if (unitType === 'per_stall') {
            qty = inScope;
            detail = `${money(rate)} per stall × ${inScope}`;
        } else if (unitType === 'per_night') {
            qty = inScope * n;
            detail = `${money(rate)}/night × ${n} night${n !== 1 ? 's' : ''} × ${inScope}`;
        } else if (unitType === 'per_horse') {
            // Fall back to the stall count when the booking carries no horse list.
            qty = Number(horseCount) > 0 ? Number(horseCount) : inScope;
            detail = `${money(rate)} per horse × ${qty}`;
        } else {
            // flat / custom — charged once per booking.
            qty = 1;
            detail = `${money(rate)} flat`;
        }

        const amount = qty * rate;
        subtotal += amount;
        items.push({
            type: 'stall_fee',
            refId: fee.id,
            appliesTo: fee.appliesTo || 'all',
            name: fee.name || 'Stall Fee',
            detail,
            qty,
            unitPrice: rate,
            amount,
        });
    }

    return { items, subtotal };
}

/** Stall counts per barn from a booking selection ({ stalls: { barnId: qty } }). */
export function stallsByBarnFromSelection(selection) {
    const out = {};
    for (const [barnId, qty] of Object.entries(selection?.stalls || {})) {
        const q = Number(qty) || 0;
        if (q > 0) out[barnId] = q;
    }
    return out;
}
