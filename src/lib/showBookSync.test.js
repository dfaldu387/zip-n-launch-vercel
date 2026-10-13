import { describe, it, expect } from 'vitest';
import { isEmptyValue, computeFillPatch, BOOK_FILL_KEYS, SHOW_FILL_KEYS } from './showBookSync';

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
