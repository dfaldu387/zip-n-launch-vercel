import { describe, it, expect } from 'vitest';
import {
    buildExtraStallFeeItems, buildBarnStallItems, stallsByBarnFromSelection,
    feeScope, feeAppliesToBarn, nightlyRateForBarn, flatRateForBarn, scopeLabelForFee, ALL_BARNS,
    groupBarnsForBooking, allocatePooledStalls, ALL_BARNS_GROUP_ID,
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

    it('ignores zero-amount fees and adds several fees together, across barns', () => {
        const { items, subtotal } = buildExtraStallFeeItems({
            extraStallFees: [CIRCUIT, OFFICE, { id: 'f3', appliesTo: 'all', amount: 0 }],
            stallsByBarn: { barnA: 4, barnB: 3 },
        });
        // barnA has its own named fee (OFFICE), so the 'all' Circuit Fee only
        // counts barnB's stalls — see the "exclusive All Barns fee" rule.
        expect(items).toHaveLength(2);
        expect(subtotal).toBe(760); // barnB: 3 × $200 (circuit) + barnA: 4 × $40 (office)
    });

    it('returns nothing when the show has no extra fees', () => {
        expect(buildExtraStallFeeItems({ stallsByBarn: { barnA: 4 } }).items).toEqual([]);
    });

    it("excludes stalls in a barn with its own named fee from an 'All Barns' fee's count", () => {
        const barnAOwn = { id: 'f9', appliesTo: 'barnA', amount: 25, unitType: 'per_night' };
        const { items, subtotal } = buildExtraStallFeeItems({
            extraStallFees: [CIRCUIT, barnAOwn],
            stallsByBarn: { barnA: 4, barnB: 2 },
            excludeUnitTypes: ['per_night'],
        });
        // Circuit Fee ('all', per_stall) only counts barnB's 2 stalls — barnA has
        // its own named fee, so it's excluded from the "All Barns" default tier.
        expect(items).toHaveLength(1);
        expect(items[0].qty).toBe(2);
        expect(subtotal).toBe(400); // 2 stalls × $200
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

    it('adds a Flat fee on top of a barn\'s per-night rate instead of replacing it', () => {
        const allBarnsFlat = { id: 'f1', appliesTo: 'all', amount: 300, unitType: 'flat' };
        const { items, subtotal } = buildBarnStallItems({
            barns: [barnA, barnB],
            stallsByBarn: { barnA: 1, barnB: 2 },
            extraStallFees: [allBarnsFlat],
            nights: 5,
        });
        // Barn A: $75/night × 5 nights + $300 flat = $675/stall. Barn B has no
        // per-night rate, so the flat fee is its only price: $300/stall.
        expect(subtotal).toBe(675 + 600); // 1×$675 + 2×$300
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

    it("bills a barn for its own picked nights, not the booking's overall nights (task 4)", () => {
        // Robert: 3 stalls needed for only 1 of a 3-night stay should bill 3
        // stall-nights, not 9. Barn A here is picked for 2 of 3 nights.
        const { items, subtotal } = buildBarnStallItems({
            barns: [barnA],
            stallsByBarn: { barnA: 3 },
            extraStallFees: [],
            nights: 3,
            nightsByBarn: { barnA: 2 },
        });
        expect(items[0].nights).toBe(2);
        expect(subtotal).toBe(450); // 3 stalls × 2 nights × $75
    });

    it('falls back to the flat `nights` for a barn not listed in nightsByBarn', () => {
        const { items } = buildBarnStallItems({
            barns: [barnA, barnB],
            stallsByBarn: { barnA: 1, barnB: 1 },
            extraStallFees: [],
            nights: 4,
            nightsByBarn: { barnA: 2 }, // barnB untouched, uses the flat 4
        });
        expect(items.find(i => i.refId === 'barnA').nights).toBe(2);
        expect(items.find(i => i.refId === 'barnB').nights).toBe(4);
    });
});

describe('nightlyRateForBarn', () => {
    it('sums every per-night fee scoped to the barn, ignoring other unit types', () => {
        const fees = [
            { id: 'f2', appliesTo: ['barnA'], amount: 25, unitType: 'per_night' },
            { id: 'f5', appliesTo: ['barnA'], amount: 10, unitType: 'per_night' },
            { id: 'f3', appliesTo: ['barnA'], amount: 300, unitType: 'flat' },
            { id: 'f4', appliesTo: ['barnB'], amount: 50, unitType: 'per_night' },
        ];
        expect(nightlyRateForBarn('barnA', fees)).toBe(35);
        expect(nightlyRateForBarn('barnB', fees)).toBe(50);
    });

    it("does not add an 'All Barns' per-night fee to a barn that already has its own named fee", () => {
        // Robert's case: Barn A has its own $75/night fee; a separate $300 "All
        // Barns" flat fee exists too. Barn A must be priced from its own fee
        // alone — the All-Barns fee is the default for barns with none.
        const fees = [
            { id: 'f1', appliesTo: 'all', amount: 300, unitType: 'flat' },
            { id: 'f2', appliesTo: ['barnA'], amount: 75, unitType: 'per_night' },
        ];
        expect(nightlyRateForBarn('barnA', fees)).toBe(75);
        expect(flatRateForBarn('barnA', fees)).toBe(0);
        // Barn B has no fee of its own, so it falls back to the All-Barns flat.
        expect(nightlyRateForBarn('barnB', fees)).toBe(0);
        expect(flatRateForBarn('barnB', fees)).toBe(300);
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

describe('groupBarnsForBooking (Task 2: pooled "All Barns")', () => {
    const barnA = { id: 'barnA', name: 'Barn A', total: 60, taken: 7, stallSize: '10x10' };
    const barnB = { id: 'barnB', name: 'Barn B', total: 40, taken: 6, stallSize: '10x10' };
    const fees = [
        { id: 'f1', appliesTo: 'all', amount: 300, unitType: 'flat' },
        { id: 'f2', appliesTo: ['barnA'], amount: 75, unitType: 'per_night' },
    ];

    it("pools a barn with no fee of its own into one combined 'All Barns' row", () => {
        const { individual, pooledGroup } = groupBarnsForBooking([barnA, barnB], fees);
        expect(individual).toEqual([barnA]);
        expect(pooledGroup.id).toBe(ALL_BARNS_GROUP_ID);
        expect(pooledGroup.name).toBe('All Barns');
        // Only Barn B pools here — Barn A has its own fee and stays individual —
        // so the combined total is Barn B's own 40, not 100.
        expect(pooledGroup.total).toBe(40);
        expect(pooledGroup.taken).toBe(6);
        expect(pooledGroup.pricePerNight).toBe(0); // the all-barns fee here is Flat, not per-night
    });

    it("adds two pooled barns' availability together — Robert: \"these are not 40 anymore, it becomes 100\"", () => {
        const barnC = { id: 'barnC', name: 'Barn C', total: 60, taken: 0, stallSize: '10x10' };
        const allBarnsOnly = [fees[0]]; // no barn has its own fee — both barnA and barnC pool
        const { individual, pooledGroup } = groupBarnsForBooking([barnA, barnC], allBarnsOnly);
        expect(individual).toEqual([]);
        expect(pooledGroup.total).toBe(120); // 60 + 60
        expect(pooledGroup.taken).toBe(7);
    });

    it('keeps barns separate (no pooled group) when there is no priced All-Barns fee', () => {
        const { individual, pooledGroup } = groupBarnsForBooking([barnA, barnB], [fees[1]]); // only Barn A's own fee
        expect(pooledGroup).toBeNull();
        expect(individual).toEqual([barnA, barnB]);
    });

    it('keeps barns separate when every barn already has its own fee', () => {
        const bothOwn = [fees[1], { id: 'f3', appliesTo: ['barnB'], amount: 200, unitType: 'flat' }];
        const { individual, pooledGroup } = groupBarnsForBooking([barnA, barnB], bothOwn);
        expect(pooledGroup).toBeNull();
        expect(individual).toEqual([barnA, barnB]);
    });
});

describe('allocatePooledStalls', () => {
    const members = [
        { id: 'barnB', total: 40, taken: 6 }, // 34 available
        { id: 'barnC', total: 10, taken: 10 }, // 0 available
    ];

    it('fills each member barn in turn up to its own remaining capacity', () => {
        expect(allocatePooledStalls(members, 5)).toEqual({ barnB: 5 });
    });

    it('spills into the next member once the first is full', () => {
        const full = [{ id: 'barnB', total: 2, taken: 0 }, { id: 'barnC', total: 10, taken: 0 }];
        expect(allocatePooledStalls(full, 5)).toEqual({ barnB: 2, barnC: 3 });
    });

    it('returns an empty allocation for zero or negative quantity', () => {
        expect(allocatePooledStalls(members, 0)).toEqual({});
        expect(allocatePooledStalls(members, -3)).toEqual({});
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
