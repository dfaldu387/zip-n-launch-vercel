import { describe, it, expect } from 'vitest';
import { nightsInRange } from './stallNights';

describe('nightsInRange', () => {
    it('lists every night before departure, not including move-out day', () => {
        expect(nightsInRange('2026-09-03', '2026-09-06')).toEqual([
            '2026-09-03', '2026-09-04', '2026-09-05',
        ]);
    });

    it('returns one night for a single-night stay', () => {
        expect(nightsInRange('2026-09-03', '2026-09-04')).toEqual(['2026-09-03']);
    });

    it('returns an empty list for a same-day or backwards range', () => {
        expect(nightsInRange('2026-09-03', '2026-09-03')).toEqual([]);
        expect(nightsInRange('2026-09-06', '2026-09-03')).toEqual([]);
    });

    it('returns an empty list when either date is missing', () => {
        expect(nightsInRange('', '2026-09-06')).toEqual([]);
        expect(nightsInRange('2026-09-03', '')).toEqual([]);
    });
});
