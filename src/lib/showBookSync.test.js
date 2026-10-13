import { describe, it, expect } from 'vitest';
import { isEmptyValue, computeFillPatch, computeSyncPatch, computeClassDatePatch, hashValue, BOOK_FILL_KEYS, SHOW_FILL_KEYS } from './showBookSync';

describe('computeClassDatePatch', () => {
    const show = (go1, go2 = null) => [{
        id: 'reining', divisionOrder: ['open'],
        divisionDates: { open: go1 },
        divisionGos: { open: { hasGo2: !!go2, go1Date: go1, go2Date: go2 } },
    }];
    const book = (go1, go2 = null, extra = {}) => [{
        id: 'reining', divisionOrder: ['open'],
        divisionDates: { open: go1 },
        divisionGos: { open: { hasGo2: !!go2, go1Date: go1, go2Date: go2 } },
        patternGroups: [{ id: 'g1', divisions: ['open'] }],
        ...extra,
    }];

    it('moves a class day in the book when the book still holds the copied day', () => {
        const first = computeClassDatePatch(show('2026-07-03'), book('2026-07-03'), {});
        expect(first.disciplines).toBeNull();
        const next = computeClassDatePatch(show('2026-07-04'), book('2026-07-03'), first.baseline);
        expect(next.disciplines[0].divisionGos.open.go1Date).toBe('2026-07-04');
        expect(next.disciplines[0].divisionDates.open).toBe('2026-07-04');
    });

    it('keeps pattern groups untouched', () => {
        const first = computeClassDatePatch(show('2026-07-03'), book('2026-07-03'), {});
        const next = computeClassDatePatch(show('2026-07-04'), book('2026-07-03'), first.baseline);
        expect(next.disciplines[0].patternGroups).toEqual([{ id: 'g1', divisions: ['open'] }]);
    });

    it('keeps a day the book was edited to', () => {
        const first = computeClassDatePatch(show('2026-07-03'), book('2026-07-03'), {});
        const next = computeClassDatePatch(show('2026-07-04'), book('2026-07-09'), first.baseline);
        expect(next.disciplines).toBeNull();
    });

    it('does not replace a different day when there is no history', () => {
        const next = computeClassDatePatch(show('2026-07-04'), book('2026-07-03'), {});
        expect(next.disciplines).toBeNull();
    });

    it('follows a Go 2 day too', () => {
        const first = computeClassDatePatch(show('2026-07-03', '2026-07-05'), book('2026-07-03', '2026-07-05'), {});
        const next = computeClassDatePatch(show('2026-07-03', '2026-07-06'), book('2026-07-03', '2026-07-05'), first.baseline);
        expect(next.disciplines[0].divisionGos.open.go2Date).toBe('2026-07-06');
    });

    it('fills the days of a class the book has no day for', () => {
        const bare = [{ id: 'reining', divisionOrder: ['open'], patternGroups: [] }];
        const next = computeClassDatePatch(show('2026-07-03'), bare, {});
        expect(next.disciplines[0].divisionDates.open).toBe('2026-07-03');
    });

    it('ignores a class the book does not have', () => {
        const other = [{ id: 'reining', divisionOrder: ['youth'], divisionDates: {}, divisionGos: {} }];
        expect(computeClassDatePatch(show('2026-07-03'), other, {}).disciplines).toBeNull();
    });
});

describe('computeSyncPatch', () => {
    const keys = ['startDate', 'venueName', 'disciplines'];

    it('fills an empty target and remembers it', () => {
        const r = computeSyncPatch({ startDate: '2026-07-01' }, {}, keys, {});
        expect(r.patch).toEqual({ startDate: '2026-07-01' });
        expect(r.baseline.startDate).toBe(hashValue('2026-07-01'));
    });

    it('pushes a later show change to a book that still holds the copied value', () => {
        const baseline = { startDate: hashValue('2026-07-01') };
        const r = computeSyncPatch({ startDate: '2026-08-15' }, { startDate: '2026-07-01' }, keys, baseline);
        expect(r.patch).toEqual({ startDate: '2026-08-15' });
    });

    it('keeps a value the book was edited to', () => {
        const baseline = { startDate: hashValue('2026-07-01') };
        const r = computeSyncPatch({ startDate: '2026-08-15' }, { startDate: '2026-07-04' }, keys, baseline);
        expect(r.patch).toEqual({});
    });

    it('never replaces a filled value when there is no baseline', () => {
        const r = computeSyncPatch({ startDate: '2026-08-15' }, { startDate: '2026-07-01' }, keys, {});
        expect(r.patch).toEqual({});
    });

    it('only fills disciplines, never replaces them', () => {
        const baseline = { disciplines: hashValue([{ name: 'A' }]) };
        const r = computeSyncPatch({ disciplines: [{ name: 'A' }, { name: 'B' }] }, [{ name: 'A' }].length ? { disciplines: [{ name: 'A' }] } : {}, keys, baseline);
        expect(r.patch).toEqual({});
    });

    it('records equal values so a later change can flow', () => {
        const r1 = computeSyncPatch({ venueName: 'Arena' }, { venueName: 'Arena' }, keys, {});
        expect(r1.patch).toEqual({});
        const r2 = computeSyncPatch({ venueName: 'Arena 2' }, { venueName: 'Arena' }, keys, r1.baseline);
        expect(r2.patch).toEqual({ venueName: 'Arena 2' });
    });

    it('does not copy empty source values over a filled target', () => {
        const r = computeSyncPatch({ venueName: '' }, { venueName: 'Arena' }, keys, {});
        expect(r.patch).toEqual({});
    });
});

describe('isEmptyValue', () => {
    it('treats blank values as empty', () => {
        [undefined, null, '', '  ', [], {}, { a: '' }, { a: { b: [] } }, ['']].forEach((v) => {
            expect(isEmptyValue(v)).toBe(true);
        });
    });

    it('treats real values as filled', () => {
        ['x', ['a'], { a: 1 }, 0, false, { a: { b: 'c' } }].forEach((v) => {
            expect(isEmptyValue(v)).toBe(false);
        });
    });
});

describe('computeFillPatch', () => {
    it('fills empty target fields from the source', () => {
        const patch = computeFillPatch(
            { startDate: '2026-07-01', venueName: 'Arena', disciplines: { a: {} } },
            { startDate: '', venueName: null },
            BOOK_FILL_KEYS,
        );
        expect(patch).toEqual({ startDate: '2026-07-01', venueName: 'Arena' });
    });

    it('never overwrites a field the target already has', () => {
        const patch = computeFillPatch(
            { startDate: '2026-07-01', endDate: '2026-07-05' },
            { startDate: '2026-06-24' },
            BOOK_FILL_KEYS,
        );
        expect(patch).toEqual({ endDate: '2026-07-05' });
    });

    it('returns nothing when both sides differ and are filled', () => {
        const patch = computeFillPatch({ venueName: 'A' }, { venueName: 'B' }, BOOK_FILL_KEYS);
        expect(patch).toEqual({});
    });

    it('ignores keys outside the list', () => {
        const patch = computeFillPatch(
            { patternSelections: { x: 1 }, startDate: '2026-07-01' },
            {},
            SHOW_FILL_KEYS,
        );
        expect(patch).toEqual({ startDate: '2026-07-01' });
    });

    it('does not copy empty source values', () => {
        expect(computeFillPatch({ startDate: '', disciplines: {} }, {}, BOOK_FILL_KEYS)).toEqual({});
    });

    it('survives missing objects', () => {
        expect(computeFillPatch(null, undefined, BOOK_FILL_KEYS)).toEqual({});
    });
});
