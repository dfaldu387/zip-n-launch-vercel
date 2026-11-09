import { describe, it, expect } from 'vitest';
import {
    paintEmptyCell, setCellLabel, clearEmptyLook, cellAppearance, isWalkway,
    insertRowAt, insertColAt, resizeGrid, deleteRowAt, deleteColAt, gridCols,
} from '@/lib/barnGrid';
import { extractBarnLayout, applyBarnLayout } from '@/lib/savedBarnLayouts';
import {
    ensureRvSpots, addRvRow, addRvColumn, removeRvRow, removeRvColumn,
    paintRvEmpty, setRvSpotLabel, setRvSpotType,
} from '@/lib/rvAssignment';

const barn = (types, cols) => ({
    name: 'Barn A', layoutCols: cols,
    stalls: types.map((t, i) => ({ id: `s${i}`, type: t, bookingId: null })),
});

describe('colour-coded Empty boxes (barn)', () => {
    it('paints a colour, keeps it through resize and insert, and forgets it when repainted', () => {
        let b = barn(['stall', 'stall', 'stall', 'stall'], 2);
        b = { ...b, stalls: paintEmptyCell(b.stalls, 's0', 'green') };
        b = { ...b, stalls: setCellLabel(b.stalls, 's0', ' Arena ') };
        expect(b.stalls[0]).toMatchObject({ type: 'empty', color: 'green', label: 'Arena' });
        const grown = resizeGrid(b, 3, 3);
        expect(grown.stalls[0]).toMatchObject({ id: 's0', type: 'empty', color: 'green', label: 'Arena' });
        const top = insertRowAt(b, 0);
        expect(top.stalls[2]).toMatchObject({ id: 's0', label: 'Arena' });
        expect(top.stalls[0]).toMatchObject({ type: 'empty', color: 'green' }); // new box beside it keeps the colour…
        expect(top.stalls[0].label).toBeUndefined();                              // …but not the word
        expect(clearEmptyLook(b.stalls[0]).color).toBeUndefined();
    });
    it('only Empty boxes take a label and empty boxes get no stall number or count', () => {
        const b = barn(['stall', 'empty'], 2);
        expect(setCellLabel(b.stalls, 's0', 'Nope')[0].label).toBeUndefined();
        const painted = paintEmptyCell(b.stalls, 's0', 'blue');
        const grown = resizeGrid({ ...b, stalls: painted }, 1, 2);
        expect(grown.stallCount).toBe(0);
        expect(grown.stalls[0].number).toBe('');
    });
    it('a coloured Empty row is not a walkway, a plain one is', () => {
        expect(isWalkway({ type: 'empty' })).toBe(true);
        expect(isWalkway({ type: 'empty', color: 'gray' })).toBe(false);
        expect(isWalkway({ type: 'empty', label: 'Arena' })).toBe(false);
        expect(isWalkway({ type: 'aisle' })).toBe(true);
    });
    it('old Office / Feed boxes still draw with a colour and word', () => {
        expect(cellAppearance({ type: 'office' })).toMatchObject({ label: 'Office' });
        expect(cellAppearance({ type: 'stall' })).toBeNull();
    });
    it('add and remove on the top and left keep every box and booking', () => {
        let b = barn(['stall', 'stall', 'stall', 'stall'], 2);
        b.stalls[3].bookingId = 'bk1';
        const left = insertColAt(b, 0);
        expect(gridCols({ ...b, ...left })).toBe(3);
        expect(left.stalls.find(s => s.id === 's3').bookingId).toBe('bk1');
        const back = deleteColAt({ ...b, ...left }, 0);
        expect(back.stalls.map(s => s.id)).toEqual(['s0', 's1', 's2', 's3']);
        const top = insertRowAt(b, 0);
        expect(top.layoutRows).toBe(3);
        expect(deleteRowAt({ ...b, ...top }, 0).stalls.map(s => s.id)).toEqual(['s0', 's1', 's2', 's3']);
    });
    it('saved layouts carry the colour and word', () => {
        let b = barn(['stall', 'stall'], 2);
        b = { ...b, stalls: setCellLabel(paintEmptyCell(b.stalls, 's0', 'teal'), 's0', 'Vet Clinic') };
        const layout = extractBarnLayout(b);
        const patch = applyBarnLayout(barn(['stall'], 1), layout, (() => { let n = 0; return () => `n${n++}`; })());
        expect(patch.stalls[0]).toMatchObject({ type: 'empty', color: 'teal', label: 'Vet Clinic' });
    });
});

describe('RV grid: four sides and colour-coded Empty spots', () => {
    const area = (n, perRow, extra = {}) => ({ id: 'a', spotCount: n, layoutCells: n, layoutPerRow: perRow, ...extra });
    it('adds a row on top and moves roadways down with the rows', () => {
        const a = area(4, 2, { layoutRoadsAfter: [0] });
        const spots = ensureRvSpots(a).spots.map((s, i) => (i === 0 ? { ...s, bookingId: 'x', customNumber: '1001' } : s));
        const out = addRvRow({ ...a, spots }, 'top');
        expect(out.spots).toHaveLength(6);
        expect(out.roadsAfter).toEqual([1]);
        expect(out.spots[2]).toMatchObject({ bookingId: 'x', customNumber: '1001', id: 'a::spot::3' });
    });
    it('adds and removes on the left', () => {
        const a = area(4, 2);
        const grown = addRvColumn(a, 'left');
        expect(grown.perRow).toBe(3);
        expect(grown.spots[0].bookingId).toBeNull();
        const shrunk = removeRvColumn({ ...a, layoutCells: 6, layoutPerRow: 3, spotCount: 6, spots: grown.spots }, 'left');
        expect(shrunk.perRow).toBe(2);
        expect(shrunk.spots).toHaveLength(4);
    });
    it('refuses to remove a top row or left column that holds an exhibitor', () => {
        const a = area(4, 2);
        const spots = ensureRvSpots(a).spots.map((s, i) => (i === 0 ? { ...s, bookingId: 'x' } : s));
        expect(removeRvRow({ ...a, spots }, 'top')).toBeNull();
        expect(removeRvColumn({ ...a, spots }, 'left')).toBeNull();
        expect(removeRvRow({ ...a, spots }, 'bottom')).not.toBeNull();
    });
    it('paints an Empty spot with a colour and word, and clears them when made normal', () => {
        const a = area(2, 2);
        let spots = paintRvEmpty(a, 'a::spot::1', 'orange');
        spots = setRvSpotLabel({ ...a, spots }, 'a::spot::1', 'Restroom');
        expect(spots[0]).toMatchObject({ type: 'empty', color: 'orange', label: 'Restroom' });
        const normal = setRvSpotType({ ...a, spots }, 'a::spot::1', null);
        expect(normal[0].color).toBeUndefined();
        expect(normal[0].label).toBeUndefined();
        const blocked = setRvSpotType({ ...a, spots }, 'a::spot::1', 'blocked');
        expect(blocked[0].label).toBeUndefined();
    });
});
