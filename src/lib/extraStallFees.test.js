import { describe, it, expect } from 'vitest';
import {
    buildExtraStallFeeItems, buildBarnStallItems, stallsByBarnFromSelection,
    feeScope, feeAppliesToBarn, nightlyRateForBarn, scopeLabelForFee, ALL_BARNS,
} from './extraStallFees';

const CIRCUIT = { id: 'f1', name: 'Circuit Fee', appliesTo: 'all', amount: 200, unitType: 'per_stall' };
const OFFICE = { id: 'f2', name: 'Office Fee', appliesTo: 'barnA', amount: 40, unitType: 'flat' };

describe('buildExtraStallFeeItems', () => {
    it('charges a facility-wide fee per stall across every barn', () => {
        const { items, subtotal } = buildExtraStallFeeItems({
            extraStallFees: [CIRCUIT],
            stallsByBarn: { barnA: 4, barnB: 2 },
            nights: 2,
        });
        expect(items).toHaveLength(1);
        expect(items[0].qty).toBe(6);
        expect(subtotal).toBe(1200);
    });

    it('charges a barn-specific fee only for that barn', () => {
        const { subtotal } = buildExtraStallFeeItems({
            extraStallFees: [{ ...CIRCUIT, appliesTo: 'barnB' }],
            stallsByBarn: { barnA: 4, barnB: 2 },
        });
        expect(subtotal).toBe(400);
    });

    it('skips a fee when no stalls in its scope are booked', () => {
        const { items } = buildExtraStallFeeItems({
            extraStallFees: [OFFICE],
            stallsByBarn: { barnB: 3 },
        });
        expect(items).toEqual([]);
    });

    it('charges a flat fee per stall, ignoring nights', () => {
        const { subtotal } = buildExtraStallFeeItems({
            extraStallFees: [OFFICE],
            stallsByBarn: { barnA: 9 },
            nights: 5,
        });
        expect(subtotal).toBe(360); // 9 stalls × $40, same regardless of the 5 nights
    });

    it('charges a per_booking fee once, whatever the stall count', () => {
        const { subtotal } = buildExtraStallFeeItems({
            extraStallFees: [{ ...OFFICE, unitType: 'per_booking' }],
            stallsByBarn: { barnA: 9 },
            nights: 5,
        });
        expect(subtotal).toBe(40);
    });

    it('multiplies a per-night fee by stalls and nights', () => {
        const { subtotal } = buildExtraStallFeeItems({
            extraStallFees: [{ ...CIRCUIT, unitType: 'per_night', amount: 30 }],
            stallsByBarn: { barnA: 4 },
            nights: 2,
        });
        expect(subtotal).toBe(240);
    });

    it('uses the horse count for a per-horse fee, falling back to stalls', () => {
        const fee = { ...CIRCUIT, unitType: 'per_horse', amount: 25 };
        expect(buildExtraStallFeeItems({
            extraStallFees: [fee], stallsByBarn: { barnA: 4 }, horseCount: 3,
        }).subtotal).toBe(75);
        expect(buildExtraStallFeeItems({
            extraStallFees: [fee], stallsByBarn: { barnA: 4 },
        }).subtotal).toBe(100);
    });

    it('ignores zero-amount fees and adds several fees together', () => {
        const { items, subtotal } = buildExtraStallFeeItems({
            extraStallFees: [CIRCUIT, OFFICE, { id: 'f3', appliesTo: 'all', amount: 0 }],
            stallsByBarn: { barnA: 4 },
        });
        expect(items).toHaveLength(2);
        expect(subtotal).toBe(960); // 4 × 200 + 4 × 40
    });

    it('returns nothing when the show has no extra fees', () => {
        expect(buildExtraStallFeeItems({ stallsByBarn: { barnA: 4 } }).items).toEqual([]);
    });
});

describe('multi-barn scope', () => {
    const MULTI = { id: 'f4', name: 'Circuit Fee', appliesTo: ['barnA', 'barnC'], amount: 200, unitType: 'flat' };

    it('charges a flat fee scoped to several barns per stall across them', () => {
        const { items, subtotal } = buildExtraStallFeeItems({
            extraStallFees: [MULTI],
            stallsByBarn: { barnA: 2, barnB: 5, barnC: 1 },
        });
        expect(items).toHaveLength(1);
        expect(subtotal).toBe(600); // barnB isn't in scope; 3 stalls across barnA+barnC × $200
    });

    it('skips a multi-barn fee when none of its barns are booked', () => {
        const { items } = buildExtraStallFeeItems({
            extraStallFees: [MULTI],
            stallsByBarn: { barnB: 5 },
        });
        expect(items).toEqual([]);
    });

    it('reads a legacy single-string appliesTo the same as a one-item array', () => {
        expect(feeScope({ appliesTo: 'barnA' })).toEqual(['barnA']);
        expect(feeAppliesToBarn({ appliesTo: 'barnA' }, 'barnA')).toBe(true);
        expect(feeAppliesToBarn({ appliesTo: 'barnA' }, 'barnB')).toBe(false);
    });

    it('treats "all", missing, and an empty array as facility-wide', () => {
        expect(feeScope({ appliesTo: 'all' })).toBe(ALL_BARNS);
        expect(feeScope({})).toBe(ALL_BARNS);
        expect(feeScope({ appliesTo: [] })).toBe(ALL_BARNS);
        expect(feeAppliesToBarn({}, 'anyBarn')).toBe(true);
    });

    it('excludes chosen unit types, e.g. per-night fees already priced into the barn rate', () => {
        const { items } = buildExtraStallFeeItems({
            extraStallFees: [{ id: 'f5', appliesTo: 'all', amount: 75, unitType: 'per_night' }, MULTI],
            stallsByBarn: { barnA: 2 },
            excludeUnitTypes: ['per_night'],
        });
        expect(items).toHaveLength(1);
        expect(items[0].refId).toBe('f4');
    });
});

describe('buildBarnStallItems', () => {
    const barnA = { id: 'barnA', name: 'Barn A', pricePerNight: 75 };
    const barnB = { id: 'barnB', name: 'Barn B', pricePerNight: 0 };

    it('prices a barn with no flat fee per night as before', () => {
        const { items, subtotal } = buildBarnStallItems({
            barns: [barnA],
            stallsByBarn: { barnA: 1 },
            extraStallFees: [],
            nights: 5,
        });
        expect(subtotal).toBe(375); // 1 stall × $75/night × 5 nights
        expect(items[0].flat).toBe(false);
    });

    it('charges a barn covered by a Flat fee its flat rate per stall, ignoring nights', () => {
        const allBarnsFlat = { id: 'f1', appliesTo: 'all', amount: 300, unitType: 'flat' };
        const { items, subtotal } = buildBarnStallItems({
            barns: [barnA, barnB],
            stallsByBarn: { barnA: 1, barnB: 2 },
            extraStallFees: [allBarnsFlat],
            nights: 5,
        });
        // Barn A: flat wins over its $75/night rate. Barn B: flat is its only price.
        expect(subtotal).toBe(300 + 600); // 1×$300 + 2×$300
        expect(items.find(i => i.refId === 'barnA').flat).toBe(true);
        expect(items.find(i => i.refId === 'barnB').flat).toBe(true);
    });

    it('skips barns with zero stalls booked', () => {
        const { items } = buildBarnStallItems({
            barns: [barnA, barnB],
            stallsByBarn: { barnA: 0 },
            extraStallFees: [],
        });
        expect(items).toEqual([]);
    });
});

describe('nightlyRateForBarn', () => {
    it('sums every per-night fee scoped to the barn, ignoring other unit types', () => {
        const fees = [
            { id: 'f1', appliesTo: 'all', amount: 75, unitType: 'per_night' },
            { id: 'f2', appliesTo: ['barnA'], amount: 25, unitType: 'per_night' },
            { id: 'f3', appliesTo: ['barnA'], amount: 300, unitType: 'flat' },
            { id: 'f4', appliesTo: ['barnB'], amount: 50, unitType: 'per_night' },
        ];
        expect(nightlyRateForBarn('barnA', fees)).toBe(100);
        expect(nightlyRateForBarn('barnB', fees)).toBe(125);
    });
});

describe('scopeLabelForFee', () => {
    const barns = [{ id: 'a', name: 'Barn A' }, { id: 'b', name: 'Barn B' }, { id: 'c', name: 'Barn C' }];

    it('labels a facility-wide fee', () => {
        expect(scopeLabelForFee({ appliesTo: 'all' }, barns)).toBe('All barns');
    });

    it('labels one or two named barns', () => {
        expect(scopeLabelForFee({ appliesTo: ['a'] }, barns)).toBe('Barn A');
        expect(scopeLabelForFee({ appliesTo: ['a', 'b'] }, barns)).toBe('Barn A + Barn B');
    });

    it('collapses three or more to a count', () => {
        expect(scopeLabelForFee({ appliesTo: ['a', 'b', 'c', 'd'] }, [...barns, { id: 'd', name: 'Barn D' }])).toBe('4 barns');
    });

    it('does NOT relabel an explicit list as "All barns" just because it currently covers every barn', () => {
        // A fee scoped to every barn that exists today is not the same as the ALL_BARNS
        // sentinel — it won't automatically cover a barn added later. The label must not
        // imply otherwise, or an organizer would wrongly assume a new barn is already covered.
        expect(scopeLabelForFee({ appliesTo: ['a', 'b', 'c'] }, barns)).toBe('3 barns');
    });
});

describe('stallsByBarnFromSelection', () => {
    it('keeps only barns with a positive quantity', () => {
        expect(stallsByBarnFromSelection({ stalls: { a: 2, b: 0, c: 3 } })).toEqual({ a: 2, c: 3 });
    });

    it('handles a missing selection', () => {
        expect(stallsByBarnFromSelection(undefined)).toEqual({});
    });
});
