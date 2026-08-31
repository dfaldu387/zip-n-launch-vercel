// RV & Camping fees — mirrors extraStallFees.js's model for barns (see that
// file's header for the full design rationale; Robert's "RV and Camping Fee
// Logic Updates" video asked for "the same exact logic" here). An RV-area fee
// is scoped to the areas it applies to: 'all' (every RV area) or a list of
// area ids. An area with its own named fee is priced from that fee alone —
// "All RV Areas" is the DEFAULT tier for areas with none, not an add-on (same
// exclusivity rule as barns; see barnHasOwnFee in extraStallFees.js).
//
// Deliberately reuses extraStallFees.js's core math instead of re-deriving
// it — feeScope/feeAppliesToBarn/barnHasOwnFee/nightlyRateForBarn/
// flatRateForBarn never actually reference "barn"; they only ever take a
// generic resource id + a fee list, so they work unchanged for RV areas.

import {
    feeScope, feeAppliesToBarn, barnHasOwnFee,
    nightlyRateForBarn, flatRateForBarn, nightlyCostForBarn, flatCostForBarn,
    ALL_BARNS, allocatePooledStalls,
} from './extraStallFees';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/** Scope value meaning "every RV area in the facility" — same sentinel as ALL_BARNS. */
export const ALL_RV_AREAS = ALL_BARNS;

/** Synthetic RV-area id for the "All RV Areas" pooled selection row. */
export const ALL_RV_GROUP_ID = '__all_rv_areas__';

export const rvFeeScope = feeScope;
export const feeAppliesToRvArea = feeAppliesToBarn;
export const rvAreaHasOwnFee = barnHasOwnFee;
export const nightlyRateForRvArea = nightlyRateForBarn;
export const flatRateForRvArea = flatRateForBarn;
export const nightlyCostForRvArea = nightlyCostForBarn;
export const flatCostForRvArea = flatCostForBarn;
export const allocatePooledRvSpots = allocatePooledStalls;

/** Plain-language scope label for an RV fee, for badges and summaries. */
export function scopeLabelForRvFee(fee, rvAreas = []) {
    const scope = rvFeeScope(fee);
    if (scope === ALL_RV_AREAS) return 'All RV areas';
    const names = scope.map(id => rvAreas.find(r => r.id === id)?.name).filter(Boolean);
    if (names.length === 0) return 'RV area removed';
    if (names.length <= 2) return names.join(' + ');
    return `${names.length} areas`;
}

/**
 * Build the per-RV-area line items for a booking selection — same formula as
 * buildBarnStallItems (Per-Night fees × nights, plus every Flat fee, both
 * stack): an area's real per-spot price for the stay.
 *
 * @param {object} args
 * @param {Array}  args.rvAreas       Inventory RV areas ({ id, name })
 * @param {object} args.rvsByArea     { [rvAreaId]: spotCount } being booked
 * @param {Array}  args.extraRvFees   Fees from stallingService.extraRvFees
 * @param {number} [args.nights]      Nights of the stay (min 1) — the default
 *                                    for any area not listed in `nightsByArea`
 * @param {object} [args.nightsByArea] { [rvAreaId]: nightCount } — per-area night picker
 * @returns {{items: Array, subtotal: number}}
 */
export function buildRvAreaItems({ rvAreas = [], rvsByArea = {}, extraRvFees = [], nights = 1, nightsByArea = {} }) {
    const items = [];
    let subtotal = 0;
    const fallbackNights = Math.max(1, Number(nights) || 1);

    for (const rv of rvAreas) {
        const qty = Number(rvsByArea[rv.id]) || 0;
        if (qty <= 0) continue;

        const n = nightsByArea[rv.id] != null ? Math.max(1, Number(nightsByArea[rv.id]) || 1) : fallbackNights;
        const nightlyRate = nightlyRateForRvArea(rv.id, extraRvFees);
        const flatRate = flatRateForRvArea(rv.id, extraRvFees);
        const perSpotUnit = nightlyRate * n + flatRate;
        const amount = qty * perSpotUnit;

        const parts = [];
        if (nightlyRate > 0) parts.push(`${money(nightlyRate)}/night × ${n} night${n !== 1 ? 's' : ''}`);
        if (flatRate > 0) parts.push(`${money(flatRate)} flat`);
        const detail = `${(parts.length > 0 ? parts.join(' + ') : money(0))} × ${qty}`;

        subtotal += amount;
        items.push({
            type: 'rv',
            refId: rv.id,
            name: `${rv.name} (RV) × ${qty}`,
            detail,
            qty,
            nights: n,
            unitPrice: nightlyRate,
            amount,
            flat: flatRate > 0,
        });
    }

    return { items, subtotal };
}

/**
 * Group RV areas for the exhibitor-facing selection UI — mirrors
 * groupBarnsForBooking: an area with its own named fee keeps its own row;
 * areas relying on the "All RV Areas" default combine into one pooled row
 * with their availability added together (Robert: "if we did all our
 * V-areas, this becomes 20").
 *
 * @param {Array} rvAreas      Inventory RV areas ({ id, name, total, taken })
 * @param {Array} extraRvFees  Fees from stallingService.extraRvFees
 * @returns {{ individual: Array, pooledGroup: object|null }}
 */
export function groupRvAreasForBooking(rvAreas = [], extraRvFees = []) {
    const hasPricedAllAreasFee = (extraRvFees || []).some(
        fee => rvFeeScope(fee) === ALL_RV_AREAS && (Number(fee.amount) || 0) > 0
    );

    const individual = [];
    const pooled = [];
    for (const rv of rvAreas) {
        (rvAreaHasOwnFee(rv.id, extraRvFees) ? individual : pooled).push(rv);
    }

    if (!hasPricedAllAreasFee || pooled.length === 0) {
        return { individual: [...individual, ...pooled], pooledGroup: null };
    }

    const totalSpots = pooled.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const taken = pooled.reduce((s, r) => s + (Number(r.taken) || 0), 0);
    const pooledGroup = {
        id: ALL_RV_GROUP_ID,
        name: 'All RV Areas',
        total: totalSpots,
        taken,
        pricePerNight: nightlyRateForRvArea(ALL_RV_GROUP_ID, extraRvFees),
        members: pooled,
    };

    return { individual, pooledGroup };
}

/** Spot counts per RV area from a booking selection ({ rvs: { rvAreaId: qty } }). */
export function rvsByAreaFromSelection(selection) {
    const out = {};
    for (const [rvAreaId, qty] of Object.entries(selection?.rvs || {})) {
        const q = Number(qty) || 0;
        if (q > 0) out[rvAreaId] = q;
    }
    return out;
}
