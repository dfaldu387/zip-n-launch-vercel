import { describe, it, expect } from 'vitest';
import {
    getCampingTypes, areaFieldsFromTypes, campingTypeTotal, updateCampingType,
    duplicateCampingType, removeCampingType, newCampingType, assignedCountByType,
} from '@/lib/rvCampingTypes';

const oldArea = { id: 'a1', spotCount: 40, hookupType: 'full', powerType: '50amp', notes: 'dump station' };

describe('camping types', () => {
    it('reads an old area as ONE default type with the same numbers', () => {
        const types = getCampingTypes(oldArea);
        expect(types).toHaveLength(1);
        expect(types[0]).toMatchObject({ count: 40, hookupType: 'full', powerType: '50amp', notes: 'dump station' });
        // stable id so it survives a reload before saving
        expect(getCampingTypes(oldArea)[0].id).toBe(types[0].id);
    });

    it('uses the saved list when there is one', () => {
        const types = [newCampingType('a1', 0, { count: 30 }), newCampingType('a1', 1, { count: 20 })];
        expect(getCampingTypes({ ...oldArea, campingTypes: types })).toBe(types);
    });

    it('area total is the sum and legacy fields follow the first type', () => {
        const types = [
            newCampingType('a1', 0, { count: 30, hookupType: 'partial', powerType: '30amp' }),
            newCampingType('a1', 1, { count: 20, hookupType: 'full', powerType: '50amp' }),
        ];
        const f = areaFieldsFromTypes(types);
        expect(f.spotCount).toBe(50);
        expect(f.hookupType).toBe('partial');
        expect(f.powerType).toBe('30amp');
        expect(campingTypeTotal(types)).toBe(50);
    });

    it('updates, duplicates and removes types', () => {
        let types = getCampingTypes(oldArea);
        types = duplicateCampingType('a1', types, types[0].id);
        expect(types).toHaveLength(2);
        expect(types[1].id).not.toBe(types[0].id);
        expect(types[1].count).toBe(40);
        types = updateCampingType(types, types[1].id, { count: 5 });
        expect(campingTypeTotal(types)).toBe(45);
        types = removeCampingType(types, types[1].id);
        expect(types).toHaveLength(1);
        // the last type cannot be removed
        expect(removeCampingType(types, types[0].id)).toHaveLength(1);
    });

    it('counts painted spots per type', () => {
        expect(assignedCountByType([{ campingTypeId: 'x' }, { campingTypeId: 'x' }, {}, { campingTypeId: 'y' }]))
            .toEqual({ x: 2, y: 1 });
    });
});

import { paintCampingType } from '@/lib/rvCampingTypes';
describe('paintCampingType', () => {
    const t = { id: 't1', powerType: '30amp' };
    it('paints, sets amps, and clears on second click', () => {
        const spots = [{ id: 's1' }, { id: 's2' }];
        const on = paintCampingType(spots, 's1', t);
        expect(on[0]).toMatchObject({ campingTypeId: 't1', amps: '30' });
        expect(on[1]).toEqual({ id: 's2' });
        expect(paintCampingType(on, 's1', t)[0]).toEqual({ id: 's1' });
    });
});

import { addRvRow, addRvColumn, setRvSpotType, ensureRvSpots } from '@/lib/rvAssignment';
describe('grid growth', () => {
    const area = { id: 'a', spotCount: 6, layoutPerRow: 3, spots: [] };
    const booked = (a, n, id) => ({ ...a, spots: ensureRvSpots(a).spots.map((s, i) => (i === n ? { ...s, bookingId: id } : s)) });
    it('adds a row of blanks', () => {
        const r = addRvRow(area);
        expect(r.spots).toHaveLength(9);
        expect(r.spots[8].id).toBe('a::spot::9');
    });
    it('adds a column and keeps each booking on its own spot', () => {
        const r = addRvColumn(booked(area, 3, 'bk')); // spot 4 = row 2, col 1
        expect(r.perRow).toBe(4);
        expect(r.spots).toHaveLength(8);
        expect(r.spots[4].bookingId).toBe('bk'); // row 2 now starts at index 4
        expect(r.spots[4].id).toBe('a::spot::5');
    });
    it('marks a roadway spot', () => {
        const out = setRvSpotType(area, 'a::spot::2', 'roadway');
        expect(out[1].type).toBe('roadway');
    });
});

import { extractRvLayout, applyRvLayout, isValidRvLayout } from '@/lib/savedRvLayouts';
describe('saved RV layouts', () => {
    const area = {
        id: 'a', spotCount: 4, layoutPerRow: 2, layoutRoadsAfter: [0],
        campingTypes: [{ id: 'x', label: 'Full', count: 3, hookupType: 'full', powerType: '50amp', notes: '', color: 'sky' }],
        spots: [
            { id: 'a::spot::1', campingTypeId: 'x', amps: '50', bookingId: 'bk' },
            { id: 'a::spot::2', campingTypeId: 'x', customNumber: '1002' },
            { id: 'a::spot::3', type: 'roadway' },
            { id: 'a::spot::4', campingTypeId: 'x' },
        ],
    };
    it('saves only the shape, never bookings', () => {
        const l = extractRvLayout(area);
        expect(JSON.stringify(l)).not.toContain('bk');
        expect(l.cells[0]).toEqual({ typeIndex: 0, amps: '50' });
        expect(l.cells[2]).toEqual({ type: 'roadway' });
        expect(isValidRvLayout(l)).toBe(true);
    });
    it('applies onto another area with fresh type ids and matching totals', () => {
        const target = { id: 'b', name: 'Keep me', spotCount: 1 };
        const out = applyRvLayout(target, extractRvLayout(area), (i) => `b::type::${i}`);
        expect(out.spotCount).toBe(4);
        expect(out.campingTypes[0].id).toBe('b::type::0');
        expect(out.spots[0]).toMatchObject({ id: 'b::spot::1', campingTypeId: 'b::type::0', bookingId: null });
        expect(out.spots[1].number).toBe('1002');
        expect(out.spots[2].type).toBe('roadway');
        expect(out.campingTypes.reduce((n, x) => n + x.count, 0)).toBe(4);
        expect(out.layoutRoadsAfter).toEqual([0]);
    });
    it('rejects junk', () => {
        expect(applyRvLayout({ id: 'b' }, { cells: [] }, () => 'x')).toBeNull();
    });
});
