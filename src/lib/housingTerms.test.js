import { describe, it, expect } from 'vitest';
import { needsHousingTerms, HOUSING_TERMS_VERSION } from './housingTerms';

describe('needsHousingTerms', () => {
    it('asks when never accepted', () => {
        expect(needsHousingTerms(null)).toBe(true);
        expect(needsHousingTerms({})).toBe(true);
    });
    it('does not ask again after accepting the current version', () => {
        expect(needsHousingTerms({ housing_terms_accepted_at: '2026-09-30', housing_terms_version: HOUSING_TERMS_VERSION })).toBe(false);
    });
    it('asks again when the terms version changed', () => {
        expect(needsHousingTerms({ housing_terms_accepted_at: '2026-09-30', housing_terms_version: 'old' })).toBe(true);
    });
});
