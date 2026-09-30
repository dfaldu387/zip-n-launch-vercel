import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { extractBarnLayout, countLayoutStalls, layoutKey } from './savedBarnLayouts';

const barn = {
    id: 'barn-1', name: 'Barn A', pricePerNight: 40, moveInDate: '2026-09-25', layoutCols: 3,
    numberingMode: 'custom', rowLabels: ['A', 'B'], colLabels: ['1', '', '3'], aisleRows: [1], aisleCols: [],
    showAisles: true, centerAisle: false,
    stalls: [
        { id: 's0', number: '1001', customNumber: '1001', bookingId: 'b1', type: 'stall' },
        { id: 's1', number: '1002', customNumber: '1002', bookingId: null, type: 'stall' },
        { id: 's2', number: '', bookingId: null, type: 'aisle' },
        { id: 's3', number: 'A4', bookingId: 'b2', type: 'stall' },
        { id: 's4', number: 'A5', bookingId: null, type: 'office' },
        { id: 's5', number: 'A6', bookingId: null },
    ],
};

describe('extractBarnLayout', () => {
    const layout = extractBarnLayout(barn);

    it('keeps the shape: size, numbering, labels, aisles', () => {
        expect(layout).toMatchObject({
            layoutRows: 2, layoutCols: 3, numberingMode: 'custom',
            rowLabels: ['A', 'B'], colLabels: ['1', '', '3'], aisleRows: [1], aisleCols: [], showAisles: true, centerAisle: false,
        });
        expect(layout.cells.map(c => c.type)).toEqual(['stall', 'stall', 'aisle', 'stall', 'office', 'stall']);
    });

    it('keeps typed stall numbers', () => {
        expect(layout.cells[0].customNumber).toBe('1001');
        expect(layout.cells[3].customNumber).toBeUndefined();
    });

    it('never carries bookings, ids, prices or dates', () => {
        const text = JSON.stringify(layout);
        for (const secret of ['b1', 'b2', 's0', 'barn-1', 'pricePerNight', '2026-09-25', 'bookingId']) {
            expect(text).not.toContain(secret);
        }
    });

    it('counts only real stalls', () => {
        expect(countLayoutStalls(layout)).toBe(4);
    });
});

describe('layoutKey', () => {
    it('trims and lower-cases like the database', () => {
        expect(layoutKey('  Larimer County Fairgrounds ')).toBe('larimer county fairgrounds');
        expect(layoutKey(null)).toBe('');
    });
});

import { isValidLayout, applyBarnLayout, barnHasAssignments, searchWords } from './savedBarnLayouts';

describe('isValidLayout', () => {
    it('accepts a normal layout and rejects broken ones', () => {
        expect(isValidLayout({ layoutCols: 2, cells: [{ type: 'stall' }] })).toBe(true);
        expect(isValidLayout(null)).toBe(false);
        expect(isValidLayout({ layoutCols: 2, cells: [] })).toBe(false);
        expect(isValidLayout({ layoutCols: 0, cells: [{}] })).toBe(false);
        expect(isValidLayout({ layoutCols: 2, cells: 'nope' })).toBe(false);
        expect(isValidLayout({ layoutCols: 500, cells: [{}] })).toBe(false);
        expect(isValidLayout({ layoutCols: 2, cells: [null] })).toBe(false);
    });
});

describe('applyBarnLayout', () => {
    const saved = extractBarnLayout(barn);
    let n = 0;
    const makeId = () => `new-${++n}`;
    const target = { id: 'barn-9', name: 'West Barn', pricePerNight: 55, stalls: [{ id: 'old', type: 'stall' }] };

    it('gives the barn the saved shape with fresh ids and no bookings', () => {
        const patch = applyBarnLayout(target, saved, makeId);
        expect(patch.layoutCols).toBe(3);
        expect(patch.layoutRows).toBe(2);
        expect(patch.stalls).toHaveLength(6);
        expect(patch.stalls.every(s => s.id.startsWith('new-') && s.bookingId === null)).toBe(true);
        expect(patch.stalls.map(s => s.type)).toEqual(['stall', 'stall', 'aisle', 'stall', 'office', 'stall']);
        expect(patch.numberingMode).toBe('custom');
        expect(patch.stallCount).toBe(4);
        expect(patch.rowLabels).toEqual(['A', 'B']);
        expect(patch.aisleRows).toEqual([1]);
    });

    it('brings typed stall numbers along', () => {
        const patch = applyBarnLayout(target, saved, makeId);
        expect(patch.stalls[0].number).toBe('1001');
        expect(patch.stalls[1].number).toBe('1002');
        expect(patch.stalls[2].number).toBe('');
    });

    it('does not touch the barn itself (name, prices)', () => {
        const patch = applyBarnLayout(target, saved, makeId);
        expect(patch).not.toHaveProperty('name');
        expect(patch).not.toHaveProperty('pricePerNight');
        expect(patch).not.toHaveProperty('id');
    });

    it('names by the saved mode when it is not custom', () => {
        const plain = { layoutCols: 2, numberingMode: 'continuous', cells: [{ type: 'stall' }, { type: 'stall' }] };
        expect(applyBarnLayout({ name: 'West Barn' }, plain, makeId).stalls.map(s => s.number)).toEqual(['W1', 'W2']);
    });

    it('treats an unknown box type as a stall and rejects an unusable layout', () => {
        const odd = { layoutCols: 1, cells: [{ type: 'hack' }] };
        expect(applyBarnLayout(target, odd, makeId).stalls[0].type).toBe('stall');
        expect(applyBarnLayout(target, { cells: [] }, makeId)).toBeNull();
    });
});

describe('barnHasAssignments', () => {
    it('is true only when a stall carries a booking', () => {
        expect(barnHasAssignments({ stalls: [{ bookingId: null }, { bookingId: 'b1' }] })).toBe(true);
        expect(barnHasAssignments({ stalls: [{ bookingId: null }] })).toBe(false);
        expect(barnHasAssignments({})).toBe(false);
    });
});

describe('searchWords', () => {
    it('splits into words and drops filter-breaking characters', () => {
        expect(searchWords('  Larimer  West ')).toEqual(['Larimer', 'West']);
        expect(searchWords('a%,b(c)*"d')).toEqual(['a', 'b', 'c', 'd']);
        expect(searchWords('')).toEqual([]);
        expect(searchWords(null)).toEqual([]);
    });
});
