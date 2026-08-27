// Stall fees — every charge that attaches to a stall booking.
//
// A fee is scoped to the barns it applies to: 'all' (the whole facility) or a
// list of barn ids. Robert's model: one fee row can cover several barns at once
// ("Circuit Fee — $200 flat, Barns A/B/C/D"), and a barn can carry as many fees
// as the organizer likes ("Luxury Barn — $300 flat" on top of it). Fees add up.
//
// Barns themselves are inventory, not fees. A barn's nightly rate is DERIVED
// from the Per-Night fees ticked for it (see nightlyRateForBarn) — the organizer
// never types a price on the barn itself.
//
// These are turned into booking line items at BOOKING TIME and stored on the
// booking. That is deliberate: a booking taken before the organizer added the fee
// keeps its original price and its already-sent invoice, and only new bookings
// pick the fee up. (Per-night stall lines are the opposite — they are always
// recomputed live from the barn's current rate; see bookingPricing.js.)
//
// The fee's own Unit Type decides the maths, so the organizer never has to say
// "per stall or once" twice.

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/** Scope value meaning "every barn in the facility". */
export const ALL_BARNS = 'all';

/**
 * A fee's scope, normalized to either ALL_BARNS or an array of barn ids.
 *
 * Fees saved before multi-select stored a single string ('all' or one barn id),
 * so both shapes are read here and nothing has to be migrated in the database.
 */
export function feeScope(fee) {
    const raw = fee?.appliesTo;
    if (Array.isArray(raw)) {
        if (raw.length === 0 || raw.includes(ALL_BARNS)) return ALL_BARNS;
        return raw;
    }
    if (!raw || raw === ALL_BARNS) return ALL_BARNS;
    return [raw];
}

/** Does this fee charge a booking that takes a stall in `barnId`? */
export function feeAppliesToBarn(fee, barnId) {
    const scope = feeScope(fee);
    return scope === ALL_BARNS || scope.includes(barnId);
}

/**
 * The one barn a fee belongs to, or null when it spans several / the facility.
 * Used by analytics to decide whether the money lands on a barn row or in the
 * facility-wide bucket.
 */
export function soleBarnForFee(fee) {
    const scope = feeScope(fee);
    return scope !== ALL_BARNS && scope.length === 1 ? scope[0] : null;
}

/**
 * A barn's nightly rate = every Per-Night stall fee ticked for it, added up.
 * This is what replaces the hand-typed price that used to live on the barn.
 */
export function nightlyRateForBarn(barnId, stallFees = []) {
    return (stallFees || []).reduce((sum, fee) => {
        if ((fee.unitType || 'per_stall') !== 'per_night') return sum;
        if (!feeAppliesToBarn(fee, barnId)) return sum;
        return sum + (Number(fee.amount) || 0);
    }, 0);
}

/**
 * A barn's nightly COST (what it costs the facility, not what it charges) —
 * the same Per-Night fees as nightlyRateForBarn, summing each fee's `cost`
 * field instead of its `amount`. Used to show Max Profit alongside Max Revenue.
 */
export function nightlyCostForBarn(barnId, stallFees = []) {
    return (stallFees || []).reduce((sum, fee) => {
        if ((fee.unitType || 'per_stall') !== 'per_night') return sum;
        if (!feeAppliesToBarn(fee, barnId)) return sum;
        return sum + (Number(fee.cost) || 0);
    }, 0);
}

/**
 * A barn's flat-rate total = every Flat stall fee scoped to it, added up.
 * Most real shows sell stalls at one flat price for the whole stay, with a
 * per-night rate being the rare exception — so when a barn carries a flat
 * fee, that flat total IS the barn's price (see barnIsFlat / barnUnitPrice
 * in HousingGroundsManagerPage.jsx), not an extra charge bolted on top of a
 * separate per-night number.
 */
export function flatRateForBarn(barnId, stallFees = []) {
    return (stallFees || []).reduce((sum, fee) => {
        if ((fee.unitType || 'per_stall') !== 'flat') return sum;
        if (!feeAppliesToBarn(fee, barnId)) return sum;
        return sum + (Number(fee.amount) || 0);
    }, 0);
}

/** Same as flatRateForBarn, summing each fee's `cost` instead of `amount`. */
export function flatCostForBarn(barnId, stallFees = []) {
    return (stallFees || []).reduce((sum, fee) => {
        if ((fee.unitType || 'per_stall') !== 'flat') return sum;
        if (!feeAppliesToBarn(fee, barnId)) return sum;
        return sum + (Number(fee.cost) || 0);
    }, 0);
}

/** Plain-language scope label for badges, summaries and invoices. */
export function scopeLabelForFee(fee, barns = []) {
    const scope = feeScope(fee);
    if (scope === ALL_BARNS) return 'All barns';
    const names = scope.map(id => barns.find(b => b.id === id)?.name).filter(Boolean);
    if (names.length === 0) return 'Barn removed';
    // Deliberately NOT collapsed to "All barns" just because it happens to list
    // every barn that exists right now — a fee picked by ticking each barn stays
    // pinned to those barns and won't cover one added later, unlike a real
    // ALL_BARNS fee. Saying "All barns" here would promise coverage it doesn't give.
    if (names.length <= 2) return names.join(' + ');
    return `${names.length} barns`;
}

/**
 * Build the stall-fee line items for one booking.
 *
 * Callers that already price Per-Night fees elsewhere (a booking's `stall`
 * lines are priced from the barn's nightly rate, which already sums those
 * fees — see nightlyRateForBarn) should pass `excludeUnitTypes: ['per_night']`
 * so the exhibitor isn't billed twice for the same night.
 *
 * @param {object}  args
 * @param {Array}   args.extraStallFees  Fees from stallingService.extraStallFees
 * @param {object}  args.stallsByBarn    { [barnId]: stallCount } being booked
 * @param {number}  [args.nights]        Nights of the stay (min 1)
 * @param {number}  [args.horseCount]    Horses on the booking (for Per Horse)
 * @param {Array}   [args.excludeUnitTypes] Unit types priced elsewhere
 * @returns {{items: Array, subtotal: number}}
 */
export function buildExtraStallFeeItems({
    extraStallFees = [],
    stallsByBarn = {},
    nights = 1,
    horseCount = 0,
    excludeUnitTypes = [],
}) {
    const items = [];
    let subtotal = 0;
    const n = Math.max(1, Number(nights) || 1);
    const skip = new Set(excludeUnitTypes || []);
    const totalStalls = Object.values(stallsByBarn).reduce((s, q) => s + (Number(q) || 0), 0);

    for (const fee of extraStallFees) {
        const unitType = fee.unitType || 'per_stall';
        if (skip.has(unitType)) continue;

        // "All barns" counts every stall on the booking; a scoped fee only counts
        // the stalls booked in the barns it covers. No stalls in scope → no charge.
        const scope = feeScope(fee);
        const inScope = scope === ALL_BARNS
            ? totalStalls
            : scope.reduce((s, barnId) => s + (Number(stallsByBarn[barnId]) || 0), 0);
        if (inScope <= 0) continue;

        const rate = Number(fee.amount) || 0;
        if (rate <= 0) continue;

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
            appliesTo: scope,
            // Kept so analytics can put the money on a barn row without re-deriving
            // the scope from a fee that may have been edited since.
            barnId: soleBarnForFee(fee),
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
