import { describe, it, expect } from 'vitest';
import { buildFinancialCalendar, splitBookingMoney } from './financialCalendar';

const barns = [
    { id: 'A', name: 'Barn A', pricePerNight: 20, stalls: [{ id: 'a1', bookingId: 'b1' }, { id: 'a2' }] },
    { id: 'B', name: 'Barn B', pricePerNight: 30, stalls: [{ id: 'b1s', bookingId: 'b2' }] },
];
const mk = (over = {}) => ({
    id: 'b1', status: 'confirmed', createdAt: '2026-11-01T10:00:00Z',
    arrivalDate: '2026-11-05', departureDate: '2026-11-07', nights: 2,
    items: [
        { type: 'stall', feeType: 'per_night', qty: 1 },
        { type: 'supply', refId: 's1', name: 'Shavings', qty: 2, amount: 20 },
        { type: 'rv', qty: 1, amount: 100 },
    ],
    ...over,
});
const run = (extra) => buildFinancialCalendar({
    bookings: [mk(), mk({ id: 'b2', createdAt: '2026-11-02T10:00:00Z', paymentStatus: 'paid', items: [{ type: 'stall', feeType: 'per_night', qty: 1 }] })],
    barns, startDate: '2026-11-01', endDate: '2026-11-03', ...extra,
});

describe('splitBookingMoney', () => {
    it('stall part is the live total minus the other lines', () => {
        expect(splitBookingMoney(mk(), 200)).toEqual({ stall: 80, rv: 100, supply: 20, other: 0 });
    });
});

describe('buildFinancialCalendar', () => {
    it('puts each order on the day it was placed and adds up sales', () => {
        const { rows, totals } = run();
        expect(rows[0].orders).toBe(1);
        expect(rows[1].orders).toBe(1);
        expect(totals.orders).toBe(2);
        expect(totals.sales).toBeGreaterThan(0);
        expect(totals.paid + totals.outstanding).toBeCloseTo(totals.sales, 1);
    });
    it('a booking marked paid has nothing outstanding', () => {
        const { rows } = run();
        expect(rows[1].outstanding).toBe(0);
        expect(rows[1].paid).toBeGreaterThan(0);
    });
    it('unpaid filter keeps only orders with a balance', () => {
        const { totals } = run({ pay: 'unpaid' });
        expect(totals.orders).toBe(1);
    });
    it('kind filter counts only that kind of money', () => {
        const all = run().totals.sales;
        const rv = run({ kind: 'rv' }).totals;
        expect(rv.orders).toBe(1);
        expect(rv.sales).toBe(100);
        expect(rv.sales).toBeLessThan(all);
    });
    it('cancelled orders are left out', () => {
        const { totals } = buildFinancialCalendar({ bookings: [mk({ status: 'cancelled' })], barns });
        expect(totals.orders).toBe(0);
    });
    it('barn pick keeps only orders placed in that barn', () => {
        const { totals } = run({ barnIds: ['B'] });
        expect(totals.orders).toBe(1);
    });
    it('widens the day range to include an order outside the show dates', () => {
        const { rows } = buildFinancialCalendar({ bookings: [mk({ createdAt: '2026-10-20T00:00:00Z' })], barns, startDate: '2026-11-01', endDate: '2026-11-03' });
        expect(rows[0].date).toBe('2026-10-20');
    });
});
