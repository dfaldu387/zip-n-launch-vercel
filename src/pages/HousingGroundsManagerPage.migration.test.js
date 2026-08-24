import { describe, it, expect } from 'vitest';
import { migrateBarnPricesToFees } from './HousingGroundsManagerPage';
import { nightlyRateForBarn } from '@/lib/extraStallFees';

// Regression coverage for the barn-price → stall-fee migration that runs once
// when an old show is first opened under the new fee model. A prior version
// checked only "is some per-night fee scoped to this barn" and skipped adding
// anything once ANY fee covered it — so a barn that already had an all-barns
// per-night fee stacked on top of its own (higher) price lost that price
// entirely: the migration added nothing, and the barn silently dropped to the
// all-barns fee's amount. These tests pin the fix: top up the GAP between the
// barn's old price and what the existing fees already derive for it.
describe('migrateBarnPricesToFees', () => {
    it('adds nothing when a barn had no price', () => {
        const barns = [{ id: 'a', name: 'Barn A', pricePerNight: 0 }];
        expect(migrateBarnPricesToFees(barns, [])).toEqual([]);
    });

    it('creates a barn-scoped fee for the full price when nothing else covers the barn', () => {
        const barns = [{ id: 'a', name: 'Barn A', pricePerNight: 150 }];
        const fees = migrateBarnPricesToFees(barns, []);
        expect(fees).toHaveLength(1);
        expect(nightlyRateForBarn('a', fees)).toBe(150);
    });

    it('tops up the GAP when an all-barns per-night fee already covers part of the price — the bug case', () => {
        const barns = [
            { id: 'a', name: 'Barn A', pricePerNight: 150 },
            { id: 'b', name: 'Barn B', pricePerNight: 75 },
        ];
        const existing = [{ id: 'f1', name: 'Nightly Stall', appliesTo: 'all', amount: 75, unitType: 'per_night' }];
        const fees = migrateBarnPricesToFees(barns, existing);
        // Barn A: the existing $75 all-barns fee only covers half its old $150 —
        // a $75 top-up fee scoped to Barn A alone must make up the rest.
        expect(nightlyRateForBarn('a', fees)).toBe(150);
        // Barn B's old price ($75) exactly matches what the all-barns fee already
        // gives it — nothing extra should be added.
        expect(nightlyRateForBarn('b', fees)).toBe(75);
        expect(fees.filter(f => f.id !== 'f1')).toHaveLength(1); // only Barn A got a top-up
    });

    it('does not add a fee when existing coverage already exceeds the old price', () => {
        const barns = [{ id: 'a', name: 'Barn A', pricePerNight: 50 }];
        const existing = [{ id: 'f1', appliesTo: 'all', amount: 75, unitType: 'per_night' }];
        const fees = migrateBarnPricesToFees(barns, existing);
        expect(fees).toEqual(existing); // no top-up added; barn ends up at the higher $75
    });

    it('ignores non-per-night fees when computing existing coverage', () => {
        const barns = [{ id: 'a', name: 'Barn A', pricePerNight: 150 }];
        const existing = [{ id: 'f1', appliesTo: ['a'], amount: 300, unitType: 'flat' }];
        const fees = migrateBarnPricesToFees(barns, existing);
        expect(nightlyRateForBarn('a', fees)).toBe(150);
    });
});
