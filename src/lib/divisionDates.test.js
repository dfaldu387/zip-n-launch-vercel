import { describe, it, expect } from 'vitest';
import {
    resolveDivisionDate,
    resolveDivisionDates,
    resolveGroupDate,
    collectScheduledDates,
} from './divisionDates';

// A two-go class: divisionDates is keyed by the BASE id and only holds Go 1.
// The grouped division entries carry the `-go1` / `-go2` suffixed ids.
const twoGoDiscipline = {
    name: 'Ranch Riding',
    divisionDates: { 'div-a': '2026-06-29' },
    divisionGos: { 'div-a': { go1Date: '2026-06-29', go2Date: '2026-07-01' } },
    patternGroups: [
        { id: 'g1', divisions: [{ id: 'div-a-go1', baseId: 'div-a', goNumber: 1, name: 'Amateur' }] },
        { id: 'g2', divisions: [{ id: 'div-a-go2', baseId: 'div-a', goNumber: 2, name: 'Amateur' }] },
    ],
};

const singleGoDiscipline = {
    name: 'Trail',
    divisionDates: { 'div-b': '2026-06-30' },
    patternGroups: [{ id: 'g1', divisions: [{ id: 'div-b', name: 'Youth' }] }],
};

describe('resolveDivisionDate', () => {
    it('returns the Go 2 date for a Go 2 division', () => {
        const go2Div = twoGoDiscipline.patternGroups[1].divisions[0];
        expect(resolveDivisionDate(twoGoDiscipline, go2Div)).toBe('2026-07-01');
    });

    it('returns the Go 1 date for a Go 1 division', () => {
        const go1Div = twoGoDiscipline.patternGroups[0].divisions[0];
        expect(resolveDivisionDate(twoGoDiscipline, go1Div)).toBe('2026-06-29');
    });

    it('falls back to divisionDates for a single-go division', () => {
        const div = singleGoDiscipline.patternGroups[0].divisions[0];
        expect(resolveDivisionDate(singleGoDiscipline, div)).toBe('2026-06-30');
    });

    it('handles legacy string division entries', () => {
        expect(resolveDivisionDate(singleGoDiscipline, 'div-b')).toBe('2026-06-30');
    });

    it('returns null when the division has no scheduled date', () => {
        expect(resolveDivisionDate(singleGoDiscipline, { id: 'unknown' })).toBeNull();
        expect(resolveDivisionDate(undefined, { id: 'div-b' })).toBeNull();
    });
});

describe('resolveDivisionDates', () => {
    it('returns only that go for a grouped go entry', () => {
        const go2Div = twoGoDiscipline.patternGroups[1].divisions[0];
        expect(resolveDivisionDates(twoGoDiscipline, go2Div)).toEqual(['2026-07-01']);
    });

    it('returns both go dates for an ungrouped two-go division', () => {
        expect(resolveDivisionDates(twoGoDiscipline, { id: 'div-a', name: 'Amateur' }))
            .toEqual(['2026-06-29', '2026-07-01']);
    });

    it('returns a single date for a single-go division', () => {
        expect(resolveDivisionDates(singleGoDiscipline, { id: 'div-b' })).toEqual(['2026-06-30']);
    });
});

describe('resolveGroupDate', () => {
    it('uses the first division with a date', () => {
        const group = { divisions: [{ id: 'nope' }, { id: 'div-b' }] };
        expect(resolveGroupDate(singleGoDiscipline, group)).toBe('2026-06-30');
    });

    it('returns null for a group with no dated divisions', () => {
        expect(resolveGroupDate(singleGoDiscipline, { divisions: [{ id: 'nope' }] })).toBeNull();
    });
});

describe('collectScheduledDates', () => {
    it('includes Go 2 dates and does not pad the show range', () => {
        const dates = collectScheduledDates({
            startDate: '2026-06-28',
            endDate: '2026-07-05',
            disciplines: [twoGoDiscipline],
        });
        expect(dates).toEqual(['2026-06-29', '2026-07-01']);
    });

    it('adds the start date only when a group would fall back to it', () => {
        const dates = collectScheduledDates({
            startDate: '2026-06-28',
            endDate: '2026-07-05',
            disciplines: [
                twoGoDiscipline,
                { name: 'Halter', patternGroups: [{ id: 'h1', divisions: [{ id: 'undated' }] }] },
            ],
        });
        expect(dates).toContain('2026-06-28');
    });

    it('includes group due dates', () => {
        const dates = collectScheduledDates({
            disciplines: [singleGoDiscipline],
            groupDueDates: { 0: { 0: '2026-07-04' } },
        });
        expect(dates).toContain('2026-07-04');
    });

    it('returns an empty list when nothing is scheduled', () => {
        expect(collectScheduledDates({ disciplines: [] })).toEqual([]);
    });
});
