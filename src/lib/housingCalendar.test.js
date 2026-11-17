import { describe, it, expect } from 'vitest';
import { buildHousingCalendar, daysInRange, horseCountOf } from './housingCalendar';

const supplies = [
    { id: 's1', name: 'Shavings', preBedding: true },
    { id: 's2', name: 'Hay', preBedding: true },
    { id: 's3', name: 'Shavings (walk-up)', preBedding: false },
];

const booking = (over = {}) => ({
    id: 'b1',
    status: 'confirmed',
    arrivalDate: '2026-12-10',
    departureDate: '2026-12-12',
    horseCount: 2,
    items: [{ type: 'stall', feeType: 'flat', qty: 3 }],
    ...over,
});

describe('daysInRange', () => {
    it('includes both ends', () => {
        expect(daysInRange('2026-12-10', '2026-12-12')).toEqual(['2026-12-10', '2026-12-11', '2026-12-12']);
    });
    it('returns [] for bad input', () => {
        expect(daysInRange('', '2026-12-12')).toEqual([]);
        expect(daysInRange('2026-12-12', '2026-12-10')).toEqual([]);
    });
});

describe('horseCountOf', () => {
    it('prefers the saved count', () => expect(horseCountOf({ horseCount: 4, horseNames: ['a'] })).toBe(4));
    it('falls back to names', () => expect(horseCountOf({ horses: 'A, B, C' })).toBe(3));
    it('is 0 when unknown', () => expect(horseCountOf({})).toBe(0));
});

describe('buildHousingCalendar', () => {
    it('counts stalls, horses and bookings on every day of the stay', () => {
        const { rows } = buildHousingCalendar({ bookings: [booking()], supplies });
        expect(rows.map((r) => r.stalls)).toEqual([3, 3, 3]);
        expect(rows.map((r) => r.horses)).toEqual([2, 2, 2]);
        expect(rows.map((r) => r.bookings)).toEqual([1, 1, 1]);
    });

    it('counts a nightly line only on the nights picked', () => {
        const b = booking({
            items: [{ type: 'stall', feeType: 'per_night', qty: 2, nightDates: ['2026-12-11'] }],
        });
        const { rows } = buildHousingCalendar({ bookings: [b], supplies });
        expect(rows.map((r) => r.stalls)).toEqual([0, 2, 0]);
    });

    it('counts RV spots separately from stalls', () => {
        const b = booking({ items: [{ type: 'rv', feeType: 'flat', qty: 1 }] });
        const { rows } = buildHousingCalendar({ bookings: [b], supplies });
        expect(rows.map((r) => r.rvs)).toEqual([1, 1, 1]);
        expect(rows.map((r) => r.stalls)).toEqual([0, 0, 0]);
    });

    it('puts pre-delivered shavings and hay on the arrival day only', () => {
        const b = booking({
            items: [
                { type: 'supply', refId: 's1', qty: 10 },
                { type: 'supply', refId: 's2', qty: 4 },
                { type: 'supply', refId: 's3', qty: 99 }, // not pre-delivery
            ],
        });
        const { rows, totals } = buildHousingCalendar({ bookings: [b], supplies });
        expect(rows.map((r) => r.shavingsBags)).toEqual([10, 0, 0]);
        expect(rows.map((r) => r.hayBales)).toEqual([4, 0, 0]);
        expect(totals).toMatchObject({ shavingsBags: 10, hayBales: 4 });
    });

    it('skips cancelled bookings and at-show re-orders', () => {
        const { rows } = buildHousingCalendar({
            bookings: [booking({ status: 'cancelled' }), booking({ id: 'x', orderType: 'live-supply' })],
            supplies,
            startDate: '2026-12-10',
            endDate: '2026-12-12',
        });
        expect(rows.every((r) => r.stalls === 0 && r.horses === 0)).toBe(true);
    });

    it('widens the range to cover bookings outside the show window', () => {
        const { rows } = buildHousingCalendar({
            bookings: [booking({ arrivalDate: '2026-12-08' })],
            supplies,
            startDate: '2026-12-10',
            endDate: '2026-12-12',
        });
        expect(rows[0].date).toBe('2026-12-08');
    });

    it('adds up several bookings and reports peaks', () => {
        const { rows, peaks } = buildHousingCalendar({
            bookings: [booking(), booking({ id: 'b2', arrivalDate: '2026-12-11', horseCount: 5 })],
            supplies,
        });
        expect(rows.map((r) => r.horses)).toEqual([2, 7, 7]);
        expect(peaks.horses.value).toBe(7);
    });

    it('reports bookings with no horse count', () => {
        const { missingHorseCount } = buildHousingCalendar({ bookings: [booking({ horseCount: 0 })], supplies });
        expect(missingHorseCount).toBe(1);
    });
});

describe('location filters', () => {
    const barns = [
        { id: 'A', name: 'Barn A', stalls: [{ id: 'a1', bookingId: 'b1' }, { id: 'a2', bookingId: 'b1' }, { id: 'a3' }] },
        { id: 'B', name: 'Barn B', stalls: [{ id: 'b1s', bookingId: 'b2' }, { id: 'b2s' }] },
    ];
    const bookings = [
        booking({ id: 'b1', horseCount: 2, items: [{ type: 'stall', feeType: 'flat', qty: 2 }] }),
        booking({ id: 'b2', horseCount: 1, items: [{ type: 'stall', feeType: 'flat', qty: 1 }] }),
    ];
    const run = (extra) => buildHousingCalendar({ bookings, supplies, barns, startDate: '2026-12-10', endDate: '2026-12-12', ...extra });

    it('whole facility counts everything and reports capacity', () => {
        const { rows, capacity } = run({});
        expect(rows[0].stalls).toBe(3);
        expect(rows[0].horses).toBe(3);
        expect(capacity.stalls).toBe(5);
        expect(rows[0].byBarn).toEqual({ A: 2, B: 1 });
    });
    it('one barn picked counts only that barn', () => {
        const { rows, capacity } = run({ barnIds: ['A'] });
        expect(rows[0].stalls).toBe(2);
        expect(rows[0].horses).toBe(2);
        expect(capacity.stalls).toBe(3);
        expect(rows[0].byBarn).toEqual({ A: 2 });
    });
    it('a booking not placed in a barn yet is left out when a barn is picked', () => {
        const { rows } = run({ barnIds: ['B'], bookings: [...bookings, booking({ id: 'b3', items: [{ type: 'stall', feeType: 'flat', qty: 4 }] })] });
        expect(rows[0].stalls).toBe(1);
    });
    it('counts a delivery on the day it was delivered', () => {
        const order = booking({
            id: 'b1', createdAt: '2026-12-01',
            items: [{ type: 'supply', refId: 's1', name: 'Shavings', qty: 6 }],
            itemStatuses: { s1: { status: 'delivered', stageTimestamps: { delivered: '2026-12-11T09:00:00Z' } } },
        });
        const { rows, totals } = run({ bookings: [order] });
        expect(rows.find((r) => r.date === '2026-12-11').deliveredBags).toBe(6);
        expect(totals.deliveredBags).toBe(6);
        expect(totals.outstandingBags).toBe(0);
    });
});

describe('products and barn supplies', () => {
    const sup = [
        { id: 's1', name: 'Shavings', unit: 'bag', preBedding: true },
        { id: 's2', name: 'Hay (Alfalfa)', unit: 'bale', preBedding: true },
        { id: 's9', name: 'Stall Mat Rental', unit: 'per stall', preBedding: false },
    ];
    const barns = [
        { id: 'A', name: 'Barn A', stalls: [{ id: 'a1', bookingId: 'b1' }, { id: 'a2', bookingId: 'b1' }] },
        { id: 'B', name: 'Barn B', stalls: [{ id: 'b1s', bookingId: 'b1' }, { id: 'b2s', bookingId: 'b1' }] },
    ];
    const b1 = booking({
        id: 'b1', createdAt: '2026-12-01T10:00:00Z', items: [
            { type: 'stall', feeType: 'flat', qty: 4 },
            { type: 'supply', refId: 's1', name: 'Shavings', qty: 40 },
            { type: 'supply', refId: 's2', name: 'Hay (Alfalfa)', qty: 8 },
            { type: 'supply', refId: 's9', name: 'Stall Mat Rental', qty: 4 },
        ],
        itemStatuses: { s1: { status: 'delivered', stageTimestamps: { delivered: '2026-12-09T08:00:00Z' } } },
    });
    const run = (extra) => buildHousingCalendar({ bookings: [b1], supplies: sup, barns, startDate: '2026-12-10', endDate: '2026-12-12', ...extra });

    it('splits pre-delivery due by product', () => {
        const { rows } = run();
        const day = rows.find((r) => r.date === '2026-12-10');
        expect(day.products.Shavings.due).toBe(40);
        expect(day.products['Hay (Alfalfa)'].due).toBe(8);
        expect(day.products['Stall Mat Rental']).toBeUndefined(); // not a pre-delivery item
    });
    it('counts items ordered on the day the order was placed, all products', () => {
        const { rows, productTotals } = run();
        const day = rows.find((r) => r.date === '2026-12-01');
        expect(day.products.Shavings.ordered).toBe(40);
        expect(day.products['Stall Mat Rental'].ordered).toBe(4);
        expect(productTotals.Shavings.ordered).toBe(40);
    });
    it('counts a delivered product on its delivery day', () => {
        const { rows } = run();
        expect(rows.find((r) => r.date === '2026-12-09').products.Shavings.delivered).toBe(40);
    });
    it('shows each barn its own share of the supplies', () => {
        const { rows } = run();
        const day = rows.find((r) => r.date === '2026-12-10');
        expect(day.barnSupply.A.Shavings.due).toBe(20);
        expect(day.barnSupply.B.Shavings.due).toBe(20);
    });
    it('a barn pick keeps only that barn share', () => {
        const { rows } = run({ barnIds: ['A'] });
        const day = rows.find((r) => r.date === '2026-12-10');
        expect(day.products.Shavings.due).toBe(20);
        expect(day.barnSupply.B).toBeUndefined();
    });
});
