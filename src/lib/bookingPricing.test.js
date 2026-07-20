import { describe, it, expect } from 'vitest';
import { computeBookingTotal, buildLineItems } from '@/lib/bookingPricing';

// These tests lock in the money math for stall bookings. The cases below are the
// real ones from the Larimer County Fair show, including the bug where bookings
// made BEFORE the stall fee was set stored $0 and looked fully paid.

// A booking as the public booking page saves it: one 'stall' line per barn,
// with unitPrice/amount frozen at booking time.
const bookingWithStalls = ({ nights = 4, qty = 17, unitPrice = 0, amount = 0 }) => ({
    id: 'bk-1',
    nights,
    items: [{ type: 'stall', refId: 'barn-west', name: 'West Pavilion', qty, unitPrice, amount }],
});

// Stalls assigned in the barn, carrying the barn's CURRENT price/night.
const stalls = (count, pricePerNight = 50, barnId = 'barn-west') =>
    Array.from({ length: count }, (_, i) => ({ barnId, number: `A${i + 1}`, pricePerNight }));

describe('computeBookingTotal', () => {
    it('prices a pre-fee booking from the CURRENT rate, not the stored $0', () => {
        // The regression test for the live bug: the booking stored unitPrice/amount
        // of 0 because the $50 fee did not exist yet. The total must still be right.
        const booking = bookingWithStalls({ nights: 4, qty: 17, unitPrice: 0, amount: 0 });
        expect(computeBookingTotal(booking, stalls(17, 50))).toBe(3400); // 17 × 4 × $50
    });

    it('matches the Wind Dancer invoice: 24 stalls × 4 nights × $50 = $4,800', () => {
        const booking = bookingWithStalls({ nights: 4, qty: 24, unitPrice: 0, amount: 0 });
        expect(computeBookingTotal(booking, stalls(24, 50))).toBe(4800);
    });

    it('uses the number of stalls ACTUALLY assigned, not the requested qty', () => {
        // Booking asked for 17, but only 10 are assigned so far → bill for 10.
        const booking = bookingWithStalls({ nights: 4, qty: 17 });
        expect(computeBookingTotal(booking, stalls(10, 50))).toBe(2000); // 10 × 4 × $50
    });

    it('follows the current rate when the barn price changes', () => {
        const booking = bookingWithStalls({ nights: 4, qty: 2, unitPrice: 50 });
        expect(computeBookingTotal(booking, stalls(2, 75))).toBe(600); // 2 × 4 × $75
    });

    it('falls back to the requested qty when no stalls are assigned yet', () => {
        const booking = bookingWithStalls({ nights: 4, qty: 3, unitPrice: 50 });
        expect(computeBookingTotal(booking, [])).toBe(600); // 3 × 4 × $50
    });

    it('adds non-stall items (supplies, RV) to the total', () => {
        const booking = {
            id: 'bk-2',
            nights: 4,
            items: [
                { type: 'stall', refId: 'barn-west', name: 'West Pavilion', qty: 2, unitPrice: 0 },
                { type: 'supply', name: 'Shavings ×10', qty: 10, unitPrice: 9, amount: 90 },
            ],
        };
        // stalls 2 × 4 × $50 = 400, plus $90 supplies
        expect(computeBookingTotal(booking, stalls(2, 50))).toBe(490);
    });

    it('handles a legacy booking that has no items[]', () => {
        const booking = { id: 'bk-3', nights: 2, amount: 250 };
        expect(computeBookingTotal(booking, [])).toBe(250);
    });

    it('only counts stalls belonging to that line item\'s barn', () => {
        const booking = bookingWithStalls({ nights: 1, qty: 5 });
        const mixed = [...stalls(2, 50, 'barn-west'), ...stalls(3, 90, 'barn-east')];
        expect(computeBookingTotal(booking, mixed)).toBe(100); // only the 2 west stalls × 1 × $50
    });

    it('returns 0 for an empty or missing booking instead of throwing', () => {
        expect(computeBookingTotal(null, [])).toBe(0);
        expect(computeBookingTotal({}, [])).toBe(0);
    });
});

describe('buildLineItems', () => {
    it('shows the live price in the detail text, never a stale $0.00/night', () => {
        // The invoice PDF used to print "$0.00/night" next to a $50 unit price.
        const booking = bookingWithStalls({ nights: 4, qty: 24, unitPrice: 0 });
        const [row] = buildLineItems(booking, stalls(24, 50));

        expect(row.unitPrice).toBe(50);
        expect(row.total).toBe(4800);
        expect(row.description).toContain('$50.00/night');
        expect(row.description).not.toContain('$0.00/night');
    });

    it('lists the assigned stall numbers on the line', () => {
        const booking = bookingWithStalls({ nights: 1, qty: 2 });
        const [row] = buildLineItems(booking, stalls(2, 50));
        expect(row.description).toContain('A1, A2');
    });
});
