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
    ALL_BARNS, allocatePooledStalls, buildBarnStallOptionItems,
} from './extraStallFees';

import { getCampingTypes, campingTypeLabel } from './rvCampingTypes';

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

/**
 * Camping types as priceable units (Robert 11-02: different prices per camping type).
 * An area with ONE camping type is returned unchanged — it behaves exactly as before.
 * An area with 2+ types becomes one unit per type: id = the type's id, spotCount = its
 * count, areaId/typeLabel point back to the area. Nothing is saved; this is derived.
 */
export function rvPriceUnits(rvAreas = []) {
    return rvAreas.flatMap(area => {
        const types = getCampingTypes(area);
        if (types.length < 2) return [area];
        return types.map((t, i) => ({
            ...area,
            id: t.id,
            areaId: area.id,
            typeLabel: campingTypeLabel(t, i),
            name: `${area.name} · ${campingTypeLabel(t, i)}`,
            spotCount: Number(t.count) || 0,
            hookupType: t.hookupType,
            powerType: t.powerType,
            isCampingType: true,
        }));
    });
}

/**
 * Fees ready to price camping-type units: a fee scoped to an area also lists that
 * area's type ids (so it covers every type); a fee scoped to a type already lists
 * the type id. "All RV areas" fees stay "all". Fees for single-type areas are untouched.
 */
export function expandRvFeesForTypes(rvAreas = [], fees = []) {
    const typeIdsByArea = new Map();
    for (const area of rvAreas) {
        const types = getCampingTypes(area);
        if (types.length >= 2) typeIdsByArea.set(area.id, types.map(t => t.id));
    }
    if (typeIdsByArea.size === 0) return fees;
    return (fees || []).map(fee => {
        const scope = rvFeeScope(fee);
        if (scope === ALL_RV_AREAS) return fee;
        const extra = scope.flatMap(id => typeIdsByArea.get(id) || []);
        return extra.length ? { ...fee, appliesTo: [...scope, ...extra] } : fee;
    });
}

/**
 * Robert 11-03: every camping type (or area) gets its OWN fee line. When a fee's
 * "Applies to" is set to 2+ targets, split it into one fee per target: the first keeps the
 * original id, the others are copies (same name, amount, cost, unit, dates) with fresh ids.
 * "All RV areas" and a single target stay one fee. Returns the fees that replace `fee`.
 */
export function splitRvFeeByScope(fee, newScope, makeId) {
    const scope = rvFeeScope({ appliesTo: newScope });
    if (scope === ALL_RV_AREAS || scope.length < 2) return [{ ...fee, appliesTo: newScope }];
    return scope.map((id, i) => ({ ...fee, id: i === 0 ? fee.id : makeId(), appliesTo: [id] }));
}

/** Plain-language scope label for an RV fee, for badges and summaries. */
export function scopeLabelForRvFee(fee, rvAreas = []) {
    const scope = rvFeeScope(fee);
    if (scope === ALL_RV_AREAS) return 'All RV areas';
    const units = rvPriceUnits(rvAreas);
    const names = scope.map(id => rvAreas.find(r => r.id === id)?.name || units.find(u => u.id === id)?.name).filter(Boolean);
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

/**
 * Spot counts per RV area from a booking selection ({ rvs: { rvAreaId: qty } }).
 * Also sums the split Flat/Nightly option shape ({ flat: qty, night: qty } —
 * see buildRvAreaOptionItems) — mirrors stallsByBarnFromSelection.
 */
export function rvsByAreaFromSelection(selection) {
    const out = {};
    for (const [rvAreaId, val] of Object.entries(selection?.rvs || {})) {
        const q = typeof val === 'object' && val !== null
            ? (Number(val.flat) || 0) + (Number(val.night) || 0)
            : (Number(val) || 0);
        if (q > 0) out[rvAreaId] = q;
    }
    return out;
}

/**
 * RV-area equivalent of buildBarnStallOptionItems — up to TWO purchasable
 * line items per area (Flat Fee, Nightly Fee), never combined into one
 * charge. Same split rule as barns ("the same exact logic applies" per
 * Robert's RV video).
 *
 * @param {object} args
 * @param {Array}  args.rvAreas      Inventory RV areas ({ id, name, pricePerNight })
 * @param {object} args.rvSelection  { [rvAreaId]: { flat: qty, night: qty } }
 * @param {Array}  args.extraRvFees  Fees from stallingService.extraRvFees
 * @param {number} [args.nights]     Nights of the stay (min 1)
 * @param {object} [args.nightsByArea] { [rvAreaId]: nightCount }
 * @returns {{items: Array, subtotal: number}}
 */
export function buildRvAreaOptionItems({ rvAreas = [], rvSelection = {}, extraRvFees = [], nights = 1, nightsByArea = {} }) {
    return buildBarnStallOptionItems({
        barns: rvAreas,
        stallSelection: rvSelection,
        extraStallFees: extraRvFees,
        nights,
        nightsByBarn: nightsByArea,
        itemType: 'rv',
    });
}

/**
 * Store each camping type's price on the type itself (pricePerNight + flatRate), the
 * same way an area keeps a synced pricePerNight. The server prices a booking from
 * these saved numbers, so they must follow the fees. Only areas with 2+ camping
 * types are touched. Returns the SAME array when nothing changed.
 */
export function syncCampingTypePrices(rvAreas = [], fees = []) {
    let changed = false;
    const next = rvAreas.map(area => {
        const types = getCampingTypes(area);
        if (types.length < 2) return area;
        const eff = expandRvFeesForTypes([area], fees);
        let areaChanged = false;
        const newTypes = types.map(t => {
            const pricePerNight = nightlyRateForRvArea(t.id, eff);
            const flatRate = flatRateForRvArea(t.id, eff);
            if (t.pricePerNight === pricePerNight && t.flatRate === flatRate) return t;
            areaChanged = true;
            return { ...t, pricePerNight, flatRate };
        });
        if (!areaChanged) return area;
        changed = true;
        return { ...area, campingTypes: newTypes };
    });
    return changed ? next : rvAreas;
}

/**
 * Public booking page: turn areas with 2+ camping types into one bookable row per
 * type (id = the type's id), and give the fee list the same treatment so prices
 * resolve per type. Single-type areas and old payloads (no campingTypes) pass
 * through untouched. `areas` come from get_public_show(): each camping type
 * carries its own count and `taken`.
 */
export function expandPublicRvInventory(rvAreas = [], extraRvFees = []) {
    const multi = (a) => Array.isArray(a.campingTypes) && a.campingTypes.length >= 2;
    if (!rvAreas.some(multi)) return { rvAreas, extraRvFees };
    const units = rvAreas.flatMap(a => {
        if (!multi(a)) return [a];
        return a.campingTypes.map((t, i) => ({
            ...a,
            id: t.id,
            areaId: a.id,
            name: `${a.name} · ${campingTypeLabel(t, i)}`,
            hookupType: t.hookupType || a.hookupType,
            powerType: t.powerType || a.powerType,
            pricePerNight: Number(t.pricePerNight) || 0,
            total: Number(t.count) || 0,
            taken: Number(t.taken) || 0,
            campingTypes: undefined,
        }));
    });
    const typeIdsByArea = new Map(rvAreas.filter(multi).map(a => [a.id, a.campingTypes.map(t => t.id)]));
    const fees = (extraRvFees || []).map(fee => {
        const scope = rvFeeScope(fee);
        if (scope === ALL_RV_AREAS) return fee;
        const extra = scope.flatMap(id => typeIdsByArea.get(id) || []);
        return extra.length ? { ...fee, appliesTo: [...scope, ...extra] } : fee;
    });
    return { rvAreas: units, extraRvFees: fees };
}

/**
 * The manager's own "add / edit booking" form: one row per camping type (for areas with
 * 2+ types), each priced from the fees that apply to it. Single-type areas pass through.
 */
export function rvBookingFormInventory(rvAreas = [], extraRvFees = []) {
    const fees = expandRvFeesForTypes(rvAreas, extraRvFees);
    const units = rvPriceUnits(rvAreas).map(u =>
        u.isCampingType ? { ...u, pricePerNight: nightlyRateForRvArea(u.id, fees) } : u);
    return { rvAreas: units, extraRvFees: fees };
}
