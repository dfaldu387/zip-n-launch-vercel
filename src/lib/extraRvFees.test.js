import { describe, it, expect } from 'vitest';
import {
    buildRvAreaItems, groupRvAreasForBooking, allocatePooledRvSpots, rvsByAreaFromSelection,
    scopeLabelForRvFee, nightlyRateForRvArea, flatRateForRvArea, ALL_RV_GROUP_ID,
} from './extraRvFees';

describe('buildRvAreaItems', () => {
    const rvAreas = [
        { id: 'rv1', name: 'RV Area 1' },
        { id: 'rv2', name: 'RV Area 2' },
    ];

    it('prices a Per Night area from its own fee', () => {
        const fees = [{ id: 'f1', appliesTo: ['rv2'], amount: 45, unitType: 'per_night' }];
        const { items, subtotal } = buildRvAreaItems({
            rvAreas, rvsByArea: { rv2: 1 }, extraRvFees: fees, nights: 3,
        });
        expect(items).toHaveLength(1);
        expect(items[0].detail).toBe('$45.00/night × 3 nights × 1');
        expect(subtotal).toBe(135);
    });

    it('prices a Flat area ignoring nights', () => {
        const fees = [{ id: 'f1', appliesTo: ['rv1'], amount: 150, unitType: 'flat' }];
        const { subtotal } = buildRvAreaItems({
            rvAreas, rvsByArea: { rv1: 1 }, extraRvFees: fees, nights: 5,
        });
        expect(subtotal).toBe(150);
    });

    it('bills an area for its own picked nights, not the booking-wide nights', () => {
        const fees = [{ id: 'f1', appliesTo: ['rv2'], amount: 45, unitType: 'per_night' }];
        const { items, subtotal } = buildRvAreaItems({
            rvAreas, rvsByArea: { rv2: 1 }, extraRvFees: fees, nights: 3, nightsByArea: { rv2: 2 },
        });
        expect(items[0].nights).toBe(2);
        expect(subtotal).toBe(90); // 1 × 2 × $45, not 1 × 3 × $45
    });

    it('does not add an "All RV Areas" fee to an area that already has its own', () => {
        const fees = [
            { id: 'f1', appliesTo: 'all', amount: 30, unitType: 'flat' },
            { id: 'f2', appliesTo: ['rv2'], amount: 45, unitType: 'per_night' },
        ];
        expect(nightlyRateForRvArea('rv2', fees)).toBe(45);
        expect(flatRateForRvArea('rv2', fees)).toBe(0); // excluded — rv2 has its own fee
        expect(flatRateForRvArea('rv1', fees)).toBe(30); // rv1 has none, gets the default
    });
});

describe('groupRvAreasForBooking (RV pooling)', () => {
    const rv1 = { id: 'rv1', name: 'RV Area 1', total: 10, taken: 3 };
    const rv2 = { id: 'rv2', name: 'RV Area 2', total: 10, taken: 1 };

    it('pools RV areas with no fee of their own into "All RV Areas"', () => {
        const fees = [{ id: 'f1', appliesTo: 'all', amount: 30, unitType: 'flat' }];
        const { individual, pooledGroup } = groupRvAreasForBooking([rv1, rv2], fees);
        expect(individual).toEqual([]);
        expect(pooledGroup.id).toBe(ALL_RV_GROUP_ID);
        expect(pooledGroup.name).toBe('All RV Areas');
        // Robert: "if we did all our V-areas, this becomes 20"
        expect(pooledGroup.total).toBe(20);
        expect(pooledGroup.taken).toBe(4);
    });

    it('keeps an area with its own fee separate from the pool', () => {
        const fees = [
            { id: 'f1', appliesTo: 'all', amount: 30, unitType: 'flat' },
            { id: 'f2', appliesTo: ['rv1'], amount: 150, unitType: 'flat' },
        ];
        const { individual, pooledGroup } = groupRvAreasForBooking([rv1, rv2], fees);
        expect(individual).toEqual([rv1]);
        expect(pooledGroup.total).toBe(10); // only rv2 pools
    });

    it('returns no pooled group when there is no priced All-RV-Areas fee', () => {
        const { individual, pooledGroup } = groupRvAreasForBooking([rv1, rv2], []);
        expect(pooledGroup).toBeNull();
        expect(individual).toEqual([rv1, rv2]);
    });
});

describe('allocatePooledRvSpots', () => {
    it('fills each area in turn up to its own remaining capacity', () => {
        const members = [{ id: 'rv1', total: 10, taken: 8 }, { id: 'rv2', total: 10, taken: 0 }];
        expect(allocatePooledRvSpots(members, 5)).toEqual({ rv1: 2, rv2: 3 });
    });
});

describe('scopeLabelForRvFee', () => {
    const rvAreas = [{ id: 'rv1', name: 'RV Area 1' }, { id: 'rv2', name: 'RV Area 2' }];

    it('labels a facility-wide fee', () => {
        expect(scopeLabelForRvFee({ appliesTo: 'all' }, rvAreas)).toBe('All RV areas');
    });

    it('labels a named area', () => {
        expect(scopeLabelForRvFee({ appliesTo: ['rv1'] }, rvAreas)).toBe('RV Area 1');
    });
});

describe('rvsByAreaFromSelection', () => {
    it('keeps only areas with a positive quantity', () => {
        expect(rvsByAreaFromSelection({ rvs: { a: 2, b: 0, c: 1 } })).toEqual({ a: 2, c: 1 });
    });
});
