import { describe, it, expect } from 'vitest';
import { nightsInRange, formatNightDates } from './stallNights';

describe('formatNightDates', () => {
    it('formats pairs, runs, gaps and month changes', () => {
        expect(formatNightDates(['2026-11-07', '2026-11-06'])).toBe('Nov 6 & 7');
        expect(formatNightDates(['2026-11-06', '2026-11-07', '2026-11-08'])).toBe('Nov 6–8');
        expect(formatNightDates(['2026-11-06', '2026-11-09'])).toBe('Nov 6, Nov 9');
        expect(formatNightDates(['2026-11-30', '2026-12-01'])).toBe('Nov 30 & Dec 1');
        expect(formatNightDates(['2026-11-06'])).toBe('Nov 6');
        expect(formatNightDates(undefined)).toBe('');
    });
});

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
