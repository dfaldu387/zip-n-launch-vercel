import { describe, it, expect } from 'vitest';
import { buildLayerIndex, layerCell, layerLegend, PUBLIC_LAYER_IDS, STALL_LAYERS, beddingItemsOf } from './stallLayers';

// Robert's ask: checkboxes that stack ("exhibitor's name, stall number, and the
// trainer's barn... maybe multiple") instead of the old single-select dropdown,
// plus splitting shavings ordered ahead of the show from shavings reordered
// AT the show, and splitting pre-bedded hay from pre-bedded shavings (both were
// previously lumped into one "pre-bedded" number). These pin down layerCell's
// multi-select contract so a future refactor can't quietly break the Publish
// Chart / public-safe field split, or re-merge the supply categories.

const barns = [{
    id: 'barn-1',
    stalls: [
        { id: 's1', number: 'A1', type: 'stall', bookingId: 'bk-group' },
        { id: 's2', number: 'A2', type: 'stall', bookingId: 'bk-solo' },
        { id: 's3', number: 'A3', type: 'stall', bookingId: 'bk-empty' },
        { id: 's4', number: 'A4', type: 'stall', bookingId: null },
    ],
}];

const bookings = [
    {
        id: 'bk-group', exhibitorName: 'Jane Smith', trainerName: 'Circle R Ranch', horseCount: 2,
        // Ordered ahead of the show: 2 bags of plain shavings + 1 bale of pre-bed hay.
        items: [
            { type: 'supply', refId: 'sup-shavings', qty: 2 },
            { type: 'supply', refId: 'sup-prebed-hay', qty: 1 },
        ],
    },
    { id: 'bk-solo', exhibitorName: 'John Doe', trainerName: '', horseCount: 1, items: [] },
    { id: 'bk-empty', exhibitorName: 'No Data Guy', trainerName: '' }, // no horses/shavings/prebed
    // At-show reorder: 3 more bags of shavings for Jane Smith — must stay in its
    // own bucket, never merged into the "ordered ahead" number above.
    {
        id: 'bk-live', exhibitorName: 'Jane Smith', orderType: 'live-supply',
        items: [{ type: 'supply', refId: 'sup-shavings', qty: 3 }],
    },
];

const supplies = [
    { id: 'sup-shavings', name: 'Shavings', preBedding: false },
    { id: 'sup-prebed-hay', name: 'Pre-Bed Hay (Grass)', preBedding: true },
    { id: 'sup-prebed-shavings', name: 'Pre-Bed Shavings', preBedding: true },
];

const index = buildLayerIndex({ bookings, barns, supplies });
const unit = (id) => barns[0].stalls.find(s => s.id === id);

describe('layerCell', () => {
    it('shows just the stall number when only "number" is checked', () => {
        const cell = layerCell(['number'], { unit: unit('s1'), index });
        expect(cell.lines).toEqual([]);
        expect(cell.num).toBe('A1');
        expect(cell.tone).toBe('booked');
    });

    it('hides the stall number when "number" is unchecked', () => {
        const cell = layerCell(['name'], { unit: unit('s1'), index });
        expect(cell.lines[0].text).toBe('Jane S.');
        expect(cell.num).toBe(''); // not checked, so never shown
    });

    it('stacks Name + Stall # together when both are checked', () => {
        const cell = layerCell(['number', 'name'], { unit: unit('s1'), index });
        expect(cell.lines).toHaveLength(1);
        expect(cell.lines[0].text).toBe('Jane S.');
        expect(cell.num).toBe('A1');
    });

    it('Trainer shows the exhibitor as a sub-line for a real group, and skips a redundant Name line', () => {
        const cell = layerCell(['trainer', 'name'], { unit: unit('s1'), index });
        expect(cell.lines).toHaveLength(1); // "name" line suppressed — trainer already carries it
        expect(cell.lines[0].text).toBe('Circle R Ranch');
        expect(cell.lines[0].subExhibitor).toBe('Jane S.');
    });

    it('Trainer falls back to the exhibitor for a solo booking with no subExhibitor', () => {
        const cell = layerCell(['trainer'], { unit: unit('s2'), index });
        expect(cell.lines[0].text).toBe('John Doe');
        expect(cell.lines[0].subExhibitor).toBe('');
    });

    it('Trainer + Exhibitor together does not repeat a solo exhibitor\'s name twice', () => {
        // s2 (John Doe) has no separate trainer, so "trainer" already reads as
        // their own name — checking "Exhibitor" too must not add a second,
        // just-shortened copy of the same name underneath.
        const cell = layerCell(['trainer', 'name'], { unit: unit('s2'), index });
        expect(cell.lines).toHaveLength(1);
        expect(cell.lines[0].text).toBe('John Doe');
    });

    it('shows a muted dash when the checked field has nothing to say', () => {
        const cell = layerCell(['shavings'], { unit: unit('s2'), index }); // John Doe bought none
        expect(cell.lines).toEqual([{ text: '—' }]);
        expect(cell.tone).toBe('muted');
    });

    it('"Shavings" only counts what was ordered ahead of the show (2 bags), not the at-show reorder', () => {
        const cell = layerCell(['shavings'], { unit: unit('s1'), index });
        expect(cell.lines[0].text).toBe('2 bags');
    });

    it('"Shavings (at-show)" is its own separate number (3 bags), not merged into the ahead-of-show count', () => {
        const cell = layerCell(['atShowShavings'], { unit: unit('s1'), index });
        expect(cell.lines[0].text).toBe('+3 bags');
    });

    it('splits Pre-Bed Hay from Pre-Bed Shavings instead of one combined "pre-bedded" number', () => {
        const hayCell = layerCell(['prebedHay'], { unit: unit('s1'), index });
        expect(hayCell.tone).toBe('warm');
        expect(hayCell.lines[0].text).toBe('✓ 1 bale');

        // Jane's booking has no pre-bed SHAVINGS line (only pre-bed hay), so it
        // must read as muted/blank here, not accidentally pick up the hay count.
        const shavCell = layerCell(['prebedShavings'], { unit: unit('s1'), index });
        expect(shavCell.tone).toBe('muted');
    });

    it('an empty stall is muted regardless of which fields are checked', () => {
        const cell = layerCell(['name', 'trainer', 'horses'], { unit: unit('s4'), index });
        expect(cell.tone).toBe('muted');
    });
});

describe('layerLegend', () => {
    it('accepts a single id (legacy call sites)', () => {
        expect(layerLegend('name')).toContain('exhibitor');
    });

    it('joins the legend for every checked field', () => {
        const text = layerLegend(['name', 'trainer']);
        expect(text).toContain('exhibitor');
        expect(text).toContain('trainer');
        expect(text).toContain('·');
    });
});

describe('beddingItemsOf', () => {
    // Task 7 (delivery checklist) reads this to decide which stall bookings
    // need a hay/shavings delivery row — must ignore stall/RV/fee line items,
    // and must NOT drop a plain (non-pre-bedded) shavings order.
    it('returns only hay/shavings items, tagged with category and pre-bedding', () => {
        const booking = {
            items: [
                { type: 'stall', refId: 'barn-1', qty: 2, amount: 200 },
                { type: 'supply', refId: 'sup-shavings', qty: 2, amount: 30 },
                { type: 'supply', refId: 'sup-prebed-hay', qty: 1, amount: 15 },
            ],
        };
        const items = beddingItemsOf(booking, [
            { id: 'sup-shavings', name: 'Shavings', preBedding: false },
            { id: 'sup-prebed-hay', name: 'Pre-Bed Hay (Grass)', preBedding: true },
        ]);
        expect(items).toHaveLength(2); // the stall line item is excluded
        expect(items.find(i => i.refId === 'sup-shavings')).toMatchObject({ isShavings: true, isHay: false, preBedding: false });
        expect(items.find(i => i.refId === 'sup-prebed-hay')).toMatchObject({ isHay: true, isShavings: false, preBedding: true });
    });

    it('returns an empty list for a booking with no hay/shavings', () => {
        expect(beddingItemsOf({ items: [{ type: 'stall', refId: 'barn-1', qty: 1 }] }, [])).toEqual([]);
    });
});

describe('PUBLIC_LAYER_IDS', () => {
    it('only allows the fields safe to publish (no horses/shavings/pre-bedding)', () => {
        expect(PUBLIC_LAYER_IDS).toEqual(['number', 'name', 'trainer']);
        const adminOnly = STALL_LAYERS.map(l => l.id).filter(id => !PUBLIC_LAYER_IDS.includes(id));
        expect(adminOnly).toEqual(['horses', 'shavings', 'atShowShavings', 'prebedHay', 'prebedShavings']);
    });
});
