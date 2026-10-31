import { describe, it, expect } from 'vitest';
import { computeItemStageUpdates, stageIndexOf, isDelivered, buildLoadSheet } from './supplyStatus';

// Regression tests for the bulk Load Sheet "Mark as Out for Delivery" bug: an
// order with one item already Delivered and a sibling item still behind still
// counts as "undelivered" overall (stageIndexOf takes the slowest item), so it
// gets swept into a bulk action — which used to knock the Delivered item back.

const mixedOrder = {
    id: 'order-1',
    items: [
        { type: 'supply', refId: 'hay', name: 'Hay' },
        { type: 'supply', refId: 'shavings', name: 'Shavings' },
    ],
    itemStatuses: {
        hay: { status: 'received', stageTimestamps: { new: '2026-09-01T00:00:00Z', received: '2026-09-02T00:00:00Z' } },
        shavings: { status: 'delivered', stageTimestamps: { new: '2026-09-01T00:00:00Z', delivered: '2026-09-03T00:00:00Z' } },
    },
};

describe('stageIndexOf / isDelivered — mixed-stage order', () => {
    it('reads as NOT delivered overall when one item is still behind, even though another is Delivered', () => {
        // This is why a mixed order gets swept into "All Undelivered Orders".
        expect(isDelivered(mixedOrder)).toBe(false);
    });
});

describe('computeItemStageUpdates — bulk sweep (allowBackward: false)', () => {
    it('never moves an already-Delivered item backward, even though the order itself is swept up', () => {
        const result = computeItemStageUpdates(mixedOrder, 'out_for_delivery', { allowBackward: false });
        expect(result.nextItemStatuses.hay.status).toBe('out_for_delivery'); // the behind item advances
        expect(result.nextItemStatuses.shavings.status).toBe('delivered'); // the Delivered item is left untouched
        expect(result.skippedBackward).toBe(1);
        expect(result.anyChanged).toBe(true);
    });

    it('reports skippedBackward with anyChanged:false when EVERY item is already ahead of the target', () => {
        const allDelivered = {
            id: 'order-2',
            items: [{ type: 'supply', refId: 'hay', name: 'Hay' }],
            itemStatuses: { hay: { status: 'delivered', stageTimestamps: {} } },
        };
        const result = computeItemStageUpdates(allDelivered, 'out_for_delivery', { allowBackward: false });
        expect(result.anyChanged).toBe(false);
        expect(result.skippedBackward).toBe(1);
    });

    it('leaves an item exactly at the target stage alone either way', () => {
        const order = {
            id: 'order-3',
            items: [{ type: 'supply', refId: 'hay', name: 'Hay' }],
            itemStatuses: { hay: { status: 'out_for_delivery', stageTimestamps: {} } },
        };
        expect(computeItemStageUpdates(order, 'out_for_delivery', { allowBackward: false }).anyChanged).toBe(false);
        expect(computeItemStageUpdates(order, 'out_for_delivery', { allowBackward: true }).anyChanged).toBe(false);
    });
});

describe('computeItemStageUpdates — manual per-card action (allowBackward: true, the default)', () => {
    it('still allows a deliberate backward correction on a single order', () => {
        // The default — correcting "oops, marked Delivered too early" must keep working
        // for the per-card "All items" dropdown, which IS a human looking at one order.
        const result = computeItemStageUpdates(mixedOrder, 'received');
        expect(result.nextItemStatuses.shavings.status).toBe('received'); // moved backward, on purpose
        expect(result.nextItemStatuses.hay.status).toBe('received'); // already at 'received', untouched
        expect(result.skippedBackward).toBe(0);
    });

    it('marks delivered and flags anyAdvancedToDelivered only for items that actually advanced to it', () => {
        const order = {
            id: 'order-4',
            items: [
                { type: 'supply', refId: 'hay', name: 'Hay' },
                { type: 'supply', refId: 'shavings', name: 'Shavings' },
            ],
            itemStatuses: {
                hay: { status: 'out_for_delivery', stageTimestamps: {} },
                shavings: { status: 'delivered', stageTimestamps: {} }, // already delivered
            },
        };
        const result = computeItemStageUpdates(order, 'delivered');
        expect(result.anyAdvancedToDelivered).toBe(true); // hay newly reached delivered
        expect(result.nextItemStatuses.hay.status).toBe('delivered');
        expect(result.nextItemStatuses.shavings.status).toBe('delivered'); // already there, untouched
    });
});

describe('buildLoadSheet — item filter', () => {
    const order = {
        id: 'o1', exhibitorName: 'Weston', trainerName: 'Hilary', barnName: 'Moncreif', stallNumber: '5162, 5163',
        items: [
            { type: 'supply', refId: 'a', name: 'Hay (Alfalfa) × 2', qty: 2 },
            { type: 'supply', refId: 's', name: 'Shavings × 4', qty: 4 },
        ],
    };

    it('counts every supply when no filter is set', () => {
        const { bySupply, lines } = buildLoadSheet([order], []);
        expect([...bySupply.keys()]).toEqual(['Hay (Alfalfa)', 'Shavings']);
        expect(lines[0].items).toHaveLength(2);
    });

    it('counts only the picked supplies and carries stall + stabling-with on the line', () => {
        const { bySupply, byBarn, lines, orderCount } = buildLoadSheet([order], [], ['Hay (Alfalfa)']);
        expect([...bySupply.keys()]).toEqual(['Hay (Alfalfa)']);
        expect([...byBarn.get('Moncreif').totals.keys()]).toEqual(['Hay (Alfalfa)']);
        expect(orderCount).toBe(1);
        expect(lines[0]).toMatchObject({ customer: 'Weston', stableWith: 'Hilary', stalls: '5162, 5163' });
    });

    it('skips an order that has none of the picked supplies', () => {
        expect(buildLoadSheet([order], [], ['Hay (Grass)']).orderCount).toBe(0);
    });

    it('filtered bulk sweep touches only the picked items', () => {
        const { nextItemStatuses } = computeItemStageUpdates(order, 'out_for_delivery', { onlyItemNames: ['Hay (Alfalfa)'] });
        expect(nextItemStatuses.a.status).toBe('out_for_delivery');
        expect(nextItemStatuses.s).toBeUndefined();
    });
});
