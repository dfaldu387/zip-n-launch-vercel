import { describe, it, expect } from 'vitest';
import { netAfterFees, estimateBookingCount, estimateNetAfterFees, moneyNum } from './netRevenue';

// Numbers come straight from Robert's 2026-10-07 video and the follow-up table.

describe('netAfterFees', () => {
    it('customer pays: only the 5% platform fee comes off ($200 -> $190)', () => {
        const r = netAfterFees(200, 40, 'customer');
        expect(r.net).toBe(190);
        expect(r.stripeFee).toBe(0);
    });

    it('show absorbs, 1 stall at $2: $0.10 + $0.36 -> keeps $1.54', () => {
        expect(netAfterFees(2, 1, 'show').net).toBe(1.54);
    });

    it('show absorbs, 5 stalls in one booking ($10): keeps $8.91', () => {
        const r = netAfterFees(10, 1, 'show');
        expect(r.platformFee).toBe(0.5);
        expect(r.stripeFee).toBe(0.59);
        expect(r.net).toBe(8.91);
    });

    it('show absorbs, one $100 booking: keeps $91.80', () => {
        expect(netAfterFees(100, 1, 'show').net).toBe(91.8);
    });

    it('the $0.30 is per booking: same $200 split into 40 bookings costs more', () => {
        const one = netAfterFees(200, 1, 'show').net;
        const forty = netAfterFees(200, 40, 'show').net;
        expect(one).toBeGreaterThan(forty);
        expect(forty).toBe(172.2); // 200 - 10 - 5.80 - 12
    });

    it('includeFlat=false skips the $0.30 (supplies bought with the stalls)', () => {
        const r = netAfterFees(10, 1, 'show', false);
        expect(r.stripeFee).toBe(0.29);
        expect(r.net).toBe(9.21);
    });

    it('unknown mode behaves like show absorbs', () => {
        expect(netAfterFees(10, 1, undefined).net).toBe(8.91);
    });

    it('nothing collected means no fee and no negative numbers', () => {
        expect(netAfterFees(0, 3, 'show')).toEqual({ gross: 0, platformFee: 0, stripeFee: 0, totalFees: 0, net: 0 });
        expect(netAfterFees(-5, 1, 'show').net).toBe(0);
    });

    it('bookings below 1 still count as one payment when money was taken', () => {
        expect(netAfterFees(10, 0, 'show').net).toBe(8.91);
    });
});

describe('moneyNum', () => {
    it('keeps cents instead of rounding $1.75 up to "2"', () => {
        expect(moneyNum(1.75)).toBe('1.75');
        expect(moneyNum(2)).toBe('2');
        expect(moneyNum(0.5)).toBe('0.50');
        expect(moneyNum(undefined)).toBe('0');
    });
});

describe('estimateBookingCount', () => {
    it('rounds up and never returns less than 1 when something sold', () => {
        expect(estimateBookingCount(11, 5)).toBe(3);
        expect(estimateBookingCount(1, 5)).toBe(1);
        expect(estimateBookingCount(100, 5)).toBe(20);
    });

    it('zero sold means zero bookings', () => {
        expect(estimateBookingCount(0, 5)).toBe(0);
    });

    it('bad per-booking value falls back safely', () => {
        expect(estimateBookingCount(10, 0)).toBe(10);
    });
});

describe('estimateNetAfterFees', () => {
    it('customer pays: 5% off', () => {
        expect(estimateNetAfterFees(200, 'customer').net).toBe(190);
    });
    it('show absorbs: about 8% off, any size', () => {
        expect(estimateNetAfterFees(262, 'show').net).toBe(241.04);
        expect(estimateNetAfterFees(1, 'show').totalFees).toBe(0.08);
    });
    it('nothing sold means nothing off', () => {
        expect(estimateNetAfterFees(0, 'show').net).toBe(0);
    });
});
