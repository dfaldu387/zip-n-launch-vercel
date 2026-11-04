import { describe, it, expect } from 'vitest';
import {
    rvPriceUnits, expandRvFeesForTypes, nightlyRateForRvArea, flatRateForRvArea, scopeLabelForRvFee, splitRvFeeByScope,
} from '@/lib/extraRvFees';

// Prices per camping type (Robert 11-02). A single-type area must behave exactly as before.

const typed = {
    id: 'a1', name: 'RV Area 1', spotCount: 50,
    campingTypes: [
        { id: 't1', label: 'Partial 30A', count: 30, hookupType: 'partial', powerType: '30amp', color: 'sky' },
        { id: 't2', label: 'Full 50A', count: 20, hookupType: 'full', powerType: '50amp', color: 'orange' },
    ],
};
const single = { id: 'a2', name: 'RV Area 2', spotCount: 10, hookupType: 'full', powerType: '50amp' };
const fee = (o) => ({ unitType: 'per_night', amount: 0, ...o });

describe('rvPriceUnits', () => {
    it('leaves a single-type area alone', () => {
        expect(rvPriceUnits([single])).toEqual([single]);
    });
    it('splits a multi-type area into one unit per type', () => {
        const u = rvPriceUnits([typed]);
        expect(u.map(x => [x.id, x.spotCount, x.areaId])).toEqual([['t1', 30, 'a1'], ['t2', 20, 'a1']]);
        expect(u[1].name).toBe('RV Area 1 · Full 50A');
    });
});

describe('expandRvFeesForTypes', () => {
    it('an area-level fee covers every type; a type fee covers only that type', () => {
        const fees = expandRvFeesForTypes([typed], [
            fee({ amount: 20, appliesTo: ['a1'] }),
            fee({ amount: 15, appliesTo: ['t2'] }),
        ]);
        expect(nightlyRateForRvArea('t1', fees)).toBe(20);
        expect(nightlyRateForRvArea('t2', fees)).toBe(35);
    });
    it('"All RV areas" fees stay "all" and still price a type as the default', () => {
        const fees = expandRvFeesForTypes([typed], [fee({ amount: 10, appliesTo: 'all' })]);
        expect(nightlyRateForRvArea('t1', fees)).toBe(10);
        expect(nightlyRateForRvArea('t2', fees)).toBe(10);
    });
    it('flat fees follow the same rule', () => {
        const fees = expandRvFeesForTypes([typed], [fee({ unitType: 'flat', amount: 50, appliesTo: ['t1'] })]);
        expect(flatRateForRvArea('t1', fees)).toBe(50);
        expect(flatRateForRvArea('t2', fees)).toBe(0);
    });
    it('returns the fees untouched when no area has several types', () => {
        const list = [fee({ amount: 5, appliesTo: ['a2'] })];
        expect(expandRvFeesForTypes([single], list)).toBe(list);
    });
});

describe('scopeLabelForRvFee with camping types', () => {
    it('names a type scope', () => {
        expect(scopeLabelForRvFee({ appliesTo: ['t2'] }, [typed])).toBe('RV Area 1 · Full 50A');
    });
});

import { syncCampingTypePrices, expandPublicRvInventory, buildRvAreaOptionItems, groupRvAreasForBooking } from '@/lib/extraRvFees';

describe('syncCampingTypePrices', () => {
    it('saves each type\'s price on the type and returns the same array when nothing changes', () => {
        const fees = [fee({ amount: 45, appliesTo: ['a1'] }), fee({ amount: 15, appliesTo: ['t2'] }), fee({ unitType: 'flat', amount: 20, appliesTo: ['t1'] })];
        const out = syncCampingTypePrices([typed, single], fees);
        expect(out[0].campingTypes.map(t => [t.pricePerNight, t.flatRate])).toEqual([[45, 20], [60, 0]]);
        expect(out[1]).toBe(single);
        expect(syncCampingTypePrices(out, fees)).toBe(out);
    });
    it('leaves single-type areas alone', () => {
        const a = [single];
        expect(syncCampingTypePrices(a, [fee({ amount: 9, appliesTo: ['a2'] })])).toBe(a);
    });
});

describe('expandPublicRvInventory (booking page)', () => {
    const pub = {
        id: 'a1', name: 'RV Area 1', total: 50, taken: 15, pricePerNight: 45,
        campingTypes: [
            { id: 't1', label: 'Partial 30A', count: 30, taken: 12, pricePerNight: 45 },
            { id: 't2', label: 'Full 50A', count: 20, taken: 3, pricePerNight: 60 },
        ],
    };
    const pubSingle = { id: 'a2', name: 'RV Area 2', total: 10, taken: 2, pricePerNight: 45 };
    const fees = [fee({ amount: 45, appliesTo: ['a1'] }), fee({ amount: 15, appliesTo: ['t2'] })];

    it('is a no-op for old payloads and single-type areas', () => {
        const r = expandPublicRvInventory([pubSingle], fees);
        expect(r.rvAreas).toEqual([pubSingle]);
        expect(r.extraRvFees).toBe(fees);
    });
    it('sells each type as its own row with its own spots left', () => {
        const r = expandPublicRvInventory([pub, pubSingle], fees);
        expect(r.rvAreas.map(a => [a.id, a.name, a.total, a.taken])).toEqual([
            ['t1', 'RV Area 1 · Partial 30A', 30, 12],
            ['t2', 'RV Area 1 · Full 50A', 20, 3],
            ['a2', 'RV Area 2', 10, 2],
        ]);
    });
    it('prices a booking per type and saves the type id on the line', () => {
        const r = expandPublicRvInventory([pub], fees);
        const { items, subtotal } = buildRvAreaOptionItems({
            rvAreas: r.rvAreas, rvSelection: { t2: { night: 2 } }, extraRvFees: r.extraRvFees, nights: 3,
        });
        expect(items[0].refId).toBe('t2');
        expect(subtotal).toBe(2 * 3 * 60);
        expect(groupRvAreasForBooking(r.rvAreas, r.extraRvFees).individual.map(a => a.id)).toEqual(['t1', 't2']);
    });
});

import { rvBookingFormInventory } from '@/lib/extraRvFees';
describe('rvBookingFormInventory (manager booking form)', () => {
    it('gives each camping type its own row and price; single-type areas pass through', () => {
        const fees = [fee({ amount: 45, appliesTo: ['a1'] }), fee({ amount: 15, appliesTo: ['t2'] })];
        const r = rvBookingFormInventory([typed, single], fees);
        expect(r.rvAreas.map(a => [a.id, a.pricePerNight ?? 0, a.spotCount])).toEqual([['t1', 45, 30], ['t2', 60, 20], ['a2', 0, 10]]);
    });
});

describe('splitRvFeeByScope', () => {
    let n = 0;
    const makeId = () => `new${++n}`;
    const base = { id: 'f1', name: 'Hookup', amount: 40, cost: 5, unitType: 'per_night', appliesTo: ['t1'] };
    it('gives each ticked camping type its own fee line, keeping the price', () => {
        const out = splitRvFeeByScope(base, ['t1', 't2'], makeId);
        expect(out.map(f => [f.id, f.appliesTo, f.amount, f.cost])).toEqual([['f1', ['t1'], 40, 5], ['new1', ['t2'], 40, 5]]);
    });
    it('keeps one fee for a single target or for All RV areas', () => {
        expect(splitRvFeeByScope(base, ['t2'], makeId)).toHaveLength(1);
        expect(splitRvFeeByScope(base, 'all', makeId)).toEqual([{ ...base, appliesTo: 'all' }]);
    });
});
