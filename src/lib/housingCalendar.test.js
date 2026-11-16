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
        expect(totals).toEqual({ shavingsBags: 10, hayBales: 4 });
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
