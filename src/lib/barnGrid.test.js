import { describe, it, expect } from 'vitest';
import {
    renumberStalls, seedCustomNumbers, setCustomNumber, fillCustomSequence, clearCustomNumbers,
    duplicateStallNumbers, insertRowAt, deleteColAt, resizeGrid, NUMBERING_CUSTOM, NUMBERING_CONTINUOUS,
} from './barnGrid';

// 2 rows × 3 cols of stalls, with a booking on the second stall.
const makeBarn = (extra = {}) => {
    const stalls = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, bookingId: i === 1 ? 'b1' : null, type: 'stall' }));
    const barn = { name: 'Barn A', layoutCols: 3, layoutRows: 2, ...extra };
    return { ...barn, stalls: renumberStalls(stalls, barn, 3) };
};
const numbers = (barn) => barn.stalls.map(s => s.number);

describe('custom numbering', () => {
    it('falls back to continuous names before anything is typed', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        expect(numbers(barn)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
    });

    it('seeds from the numbers the barn already shows and never overwrites typed ones', () => {
        const barn = makeBarn();
        const seeded = seedCustomNumbers(barn.stalls);
        expect(seeded.map(s => s.customNumber)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
        const typed = seeded.map((s, i) => (i === 0 ? { ...s, customNumber: '1001' } : s));
        expect(seedCustomNumbers(typed)[0].customNumber).toBe('1001');
    });

    it('sets one stall number and keeps its id and booking', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        const patch = setCustomNumber(barn, 's1', ' 1002 ');
        expect(patch.stalls[1]).toMatchObject({ id: 's1', bookingId: 'b1', number: '1002', customNumber: '1002' });
        expect(patch.stalls[0].number).toBe('A1');
    });

    it('clearing one number goes back to the continuous name', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        const typed = { ...barn, stalls: setCustomNumber(barn, 's1', '1002').stalls };
        const cleared = setCustomNumber(typed, 's1', '');
        expect(cleared.stalls[1].number).toBe('A2');
        expect(cleared.stalls[1].customNumber).toBeUndefined();
    });

    it('returns null for an unknown stall', () => {
        expect(setCustomNumber(makeBarn({ numberingMode: NUMBERING_CUSTOM }), 'nope', '5')).toBeNull();
    });

    it('fills a numeric sequence in grid order', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        expect(numbers({ stalls: fillCustomSequence(barn, '1001').stalls })).toEqual(['1001', '1002', '1003', '1004', '1005', '1006']);
    });

    it('fills right → left, top → bottom', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        expect(numbers({ stalls: fillCustomSequence(barn, '1001', 'rtl').stalls })).toEqual(['1003', '1002', '1001', '1006', '1005', '1004']);
    });

    it('right → left skips aisles and keeps ids and bookings', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        const withAisle = { ...barn, stalls: barn.stalls.map((s, i) => (i === 2 ? { ...s, type: 'aisle' } : s)) };
        const filled = fillCustomSequence(withAisle, '1', 'rtl').stalls;
        expect(filled.map(s => s.number)).toEqual(['2', '1', '', '5', '4', '3']);
        expect(filled[1]).toMatchObject({ id: 's1', bookingId: 'b1' });
    });

    it('zigzag fill runs row 1 left → right, row 2 right → left', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        expect(numbers({ stalls: fillCustomSequence(barn, '1001', 'zigzag').stalls })).toEqual(['1001', '1002', '1003', '1006', '1005', '1004']);
    });

    it('fills with a prefix and keeps leading zeros', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        expect(fillCustomSequence(barn, 'W101').stalls.map(s => s.number).slice(0, 2)).toEqual(['W101', 'W102']);
        expect(fillCustomSequence(barn, '007').stalls.map(s => s.number).slice(0, 3)).toEqual(['007', '008', '009']);
    });

    it('rejects a start with no number at the end', () => {
        expect(fillCustomSequence(makeBarn({ numberingMode: NUMBERING_CUSTOM }), 'abc')).toBeNull();
    });

    it('skips aisles when filling', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        const withAisle = { ...barn, stalls: barn.stalls.map((s, i) => (i === 2 ? { ...s, type: 'aisle' } : s)) };
        const filled = fillCustomSequence(withAisle, '1').stalls;
        expect(filled.map(s => s.number)).toEqual(['1', '2', '', '3', '4', '5']);
    });

    it('typed numbers survive inserting a row, deleting a column and resizing', () => {
        let barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        barn = { ...barn, ...fillCustomSequence(barn, '1001') };
        const idOf = (b, num) => b.stalls.find(s => s.number === num).id;

        const inserted = { ...barn, ...insertRowAt(barn, 0) };
        expect(inserted.stalls.filter(s => s.customNumber).length).toBe(6);
        expect(idOf(inserted, '1002')).toBe('s1');
        expect(inserted.stalls.find(s => s.id === 's1').bookingId).toBe('b1');

        const noCol = { ...barn, ...deleteColAt(barn, 0) };
        expect(noCol.stalls.map(s => s.number)).toEqual(['1002', '1003', '1005', '1006']);

        const bigger = { ...barn, ...resizeGrid(barn, 3, 3) };
        expect(bigger.stalls.slice(0, 6).map(s => s.number)).toEqual(['1001', '1002', '1003', '1004', '1005', '1006']);
    });

    it('a stall painted away and back keeps its typed number', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        const typed = { ...barn, stalls: setCustomNumber(barn, 's0', '1001').stalls };
        const aisle = renumberStalls(typed.stalls.map(s => (s.id === 's0' ? { ...s, type: 'aisle' } : s)), typed, 3);
        expect(aisle[0].number).toBe('');
        const back = renumberStalls(aisle.map(s => (s.id === 's0' ? { ...s, type: 'stall' } : s)), typed, 3);
        expect(back[0].number).toBe('1001');
    });

    it('switching to another mode renames by that mode, and back restores typed numbers', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        const typed = { ...barn, stalls: fillCustomSequence(barn, '1001').stalls };
        const cont = renumberStalls(typed.stalls, { ...typed, numberingMode: NUMBERING_CONTINUOUS }, 3);
        expect(cont.map(s => s.number)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
        const again = renumberStalls(cont, { ...typed, numberingMode: NUMBERING_CUSTOM }, 3);
        expect(again[0].number).toBe('1001');
    });

    it('clearCustomNumbers drops typed numbers', () => {
        const barn = makeBarn({ numberingMode: NUMBERING_CUSTOM });
        const typed = { ...barn, stalls: fillCustomSequence(barn, '1001').stalls };
        expect(numbers(clearCustomNumbers(typed))).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
    });

    it('finds duplicate numbers ignoring case, and ignores aisles', () => {
        const stalls = [
            { id: 'a', type: 'stall', number: 'A1' },
            { id: 'b', type: 'stall', number: 'a1' },
            { id: 'c', type: 'stall', number: 'B2' },
            { id: 'd', type: 'aisle', number: '' },
            { id: 'e', type: 'aisle', number: '' },
        ];
        expect([...duplicateStallNumbers(stalls)]).toEqual(['a1']);
    });
});
