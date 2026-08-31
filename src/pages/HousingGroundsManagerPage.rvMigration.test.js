import { describe, it, expect } from 'vitest';
import { migrateRvPricesToFees } from './HousingGroundsManagerPage';
import { nightlyRateForRvArea, flatRateForRvArea } from '@/lib/extraRvFees';

// Regression coverage for migrateRvPricesToFees — mirrors
// HousingGroundsManagerPage.migration.test.js (barns). Robert's RV fee system
// (task 1 of "RV and Camping Fee Logic Updates") moves RV pricing from fields
// typed directly on the area (pricingModel/pricePerNight/flatRate) into the
// same "Applies to" fee model stalls already use. This migration must not
// silently drop or shrink an area's already-configured price.
describe('migrateRvPricesToFees', () => {
    it('adds nothing when an area had no price', () => {
        const areas = [{ id: 'r1', name: 'RV Area 1', pricingModel: 'nightly', pricePerNight: 0 }];
        expect(migrateRvPricesToFees(areas, [])).toEqual([]);
    });

    it('creates a Per Night fee for an area priced nightly', () => {
        const areas = [{ id: 'r1', name: 'RV Area 1', pricingModel: 'nightly', pricePerNight: 45 }];
        const fees = migrateRvPricesToFees(areas, []);
        expect(fees).toHaveLength(1);
        expect(nightlyRateForRvArea('r1', fees)).toBe(45);
    });

    it('creates a Flat fee for an area priced flat, not a per-night one', () => {
        const areas = [{ id: 'r1', name: 'RV Area 1', pricingModel: 'flat', flatRate: 150 }];
        const fees = migrateRvPricesToFees(areas, []);
        expect(fees).toHaveLength(1);
        expect(flatRateForRvArea('r1', fees)).toBe(150);
        expect(nightlyRateForRvArea('r1', fees)).toBe(0);
    });

    it('does not add a fee when an All-RV-Areas default already reaches the old price', () => {
        const areas = [{ id: 'r1', name: 'RV Area 1', pricingModel: 'nightly', pricePerNight: 30 }];
        const existing = [{ id: 'f1', appliesTo: 'all', amount: 30, unitType: 'per_night' }];
        const fees = migrateRvPricesToFees(areas, existing);
        expect(fees).toEqual(existing);
    });

    it('migrates each area independently by its own pricing model', () => {
        const areas = [
            { id: 'r1', name: 'RV Area 1', pricingModel: 'flat', flatRate: 150 },
            { id: 'r2', name: 'RV Area 2', pricingModel: 'nightly', pricePerNight: 45 },
        ];
        const fees = migrateRvPricesToFees(areas, []);
        expect(fees).toHaveLength(2);
        expect(flatRateForRvArea('r1', fees)).toBe(150);
        expect(nightlyRateForRvArea('r2', fees)).toBe(45);
    });
});
