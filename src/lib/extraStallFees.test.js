import { describe, it, expect } from 'vitest';
import { buildExtraStallFeeItems, stallsByBarnFromSelection } from './extraStallFees';

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

    it('charges a flat fee once, whatever the stall count', () => {
        const { subtotal } = buildExtraStallFeeItems({
            extraStallFees: [OFFICE],
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
        expect(subtotal).toBe(840); // 4 × 200 + 40
    });

    it('returns nothing when the show has no extra fees', () => {
        expect(buildExtraStallFeeItems({ stallsByBarn: { barnA: 4 } }).items).toEqual([]);
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
