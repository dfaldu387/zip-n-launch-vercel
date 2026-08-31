import { describe, it, expect } from 'vitest';
import { computeBookingTotal, buildLineItems } from '@/lib/bookingPricing';

// These tests lock in the money math for stall bookings. The cases below are the
// real ones from the Larimer County Fair show, including the bug where bookings
// made BEFORE the stall fee was set stored $0 and looked fully paid, and the bug
// where a stall moved to a different barn than it was ordered in got billed twice.

// A booking as the public booking page saves it: one 'stall' line per barn,
// with unitPrice/amount frozen at booking time.
const bookingWithStalls = ({ nights = 4, qty = 17, unitPrice = 0, amount = 0 }) => ({
    id: 'bk-1',
    nights,
    items: [{ type: 'stall', refId: 'barn-west', name: 'West Pavilion', qty, unitPrice, amount }],
});

// Stalls assigned in the barn, carrying the barn's CURRENT price/night.
const stalls = (count, pricePerNight = 50, barnId = 'barn-west', barnName = barnId) =>
    Array.from({ length: count }, (_, i) => ({ barnId, barnName, number: `A${i + 1}`, pricePerNight }));

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
        // Booking asked for 17, but only 10 are assigned so far → bill for 10 at
        // the live rate, plus the still-unassigned 7 at the frozen $0 fallback.
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

    it('bills a stall at wherever it REALLY is, even if that is not the barn it was ordered in', () => {
        // Ordered 5 stalls in Barn West, but the organizer physically assigned
        // 2 to Barn West and 3 to Barn East. Bill each at ITS OWN barn's rate —
        // moving a stall changes what it costs, it does not stay frozen to the
        // barn it was originally ordered in.
        const booking = bookingWithStalls({ nights: 1, qty: 5 });
        const mixed = [...stalls(2, 50, 'barn-west'), ...stalls(3, 90, 'barn-east')];
        expect(computeBookingTotal(booking, mixed)).toBe(370); // 2×$50 + 3×$90
    });

    it('never bills for more stalls than were ordered, even if more got assigned', () => {
        const booking = bookingWithStalls({ nights: 1, qty: 2 });
        // 5 physically assigned, but only 2 were ordered — bill for 2.
        expect(computeBookingTotal(booking, stalls(5, 50))).toBe(100);
    });

    it('bills the real per-barn rate when an order spanning two barns gets moved into one', () => {
        // Ordered 1 stall in Barn A ($300) + 1 in Barn B ($350) = $650. The
        // organizer places BOTH physical stalls in Barn B. Billed at Barn B's
        // rate for both — $700, not frozen to the original $650 order total.
        const booking = {
            id: 'bk-4',
            nights: 1,
            items: [
                { type: 'stall', refId: 'barn-a', name: 'Barn A', qty: 1, unitPrice: 300 },
                { type: 'stall', refId: 'barn-b', name: 'Barn B', qty: 1, unitPrice: 350 },
            ],
        };
        const assigned = stalls(2, 350, 'barn-b'); // both physically in Barn B
        expect(computeBookingTotal(booking, assigned)).toBe(700);
    });

    it('splits a partly-assigned multi-barn order: real rate for what is placed, ordered rate for what is not', () => {
        // Ordered 1 stall in Barn A ($300) + 1 in Barn B ($350). Only the Barn B
        // stall has been placed so far (in Barn B, as ordered). The still-open
        // Barn A slot falls back to its own ordered price.
        const booking = {
            id: 'bk-5',
            nights: 1,
            items: [
                { type: 'stall', refId: 'barn-a', name: 'Barn A', qty: 1, unitPrice: 300 },
                { type: 'stall', refId: 'barn-b', name: 'Barn B', qty: 1, unitPrice: 350 },
            ],
        };
        const assigned = stalls(1, 350, 'barn-b');
        expect(computeBookingTotal(booking, assigned)).toBe(650); // 300 (fallback) + 350 (real)
    });

    it('returns 0 for an empty or missing booking instead of throwing', () => {
        expect(computeBookingTotal(null, [])).toBe(0);
        expect(computeBookingTotal({}, [])).toBe(0);
    });
});

describe('computeBookingTotal — Flat stall fees', () => {
    const FLAT_ALL = [{ id: 'f1', appliesTo: 'all', amount: 300, unitType: 'flat' }];

    it('bills a Flat-fee barn its flat rate per stall, ignoring nights, once assigned', () => {
        const booking = {
            id: 'bk-6',
            nights: 5,
            items: [{ type: 'stall', refId: 'barn-b', name: 'Barn B', qty: 2, unitPrice: 0 }],
        };
        const assigned = stalls(2, 0, 'barn-b'); // barn's own per-night rate is $0
        expect(computeBookingTotal(booking, assigned, FLAT_ALL)).toBe(600); // 2 × $300, not × 5 nights
    });

    it('uses the Flat rate for the not-yet-assigned fallback too', () => {
        const booking = {
            id: 'bk-7',
            nights: 5,
            items: [{ type: 'stall', refId: 'barn-b', name: 'Barn B', qty: 2, unitPrice: 0 }],
        };
        expect(computeBookingTotal(booking, [], FLAT_ALL)).toBe(600); // 2 × $300 flat, nothing assigned yet
    });
});

describe('computeBookingTotal — per-barn nights (task 4 night picker)', () => {
    it("bills each barn for its OWN picked nights, not the booking's overall nights", () => {
        // Exhibitor's overall stay is 3 nights, but Barn A was only booked for 2
        // of them (see buildBarnStallItems' nightsByBarn) — the item carries its
        // own `nights: 2`, stamped at booking time.
        const booking = {
            id: 'bk-8',
            nights: 3,
            items: [{ type: 'stall', refId: 'barn-a', name: 'Barn A', qty: 3, unitPrice: 75, nights: 2 }],
        };
        expect(computeBookingTotal(booking, stalls(3, 75, 'barn-a'))).toBe(450); // 3 × 2 × $75, not 3 × 3 × $75
    });

    it('falls back to the booking-level nights for an older item with no nights stamped', () => {
        const booking = {
            id: 'bk-9',
            nights: 3,
            items: [{ type: 'stall', refId: 'barn-a', name: 'Barn A', qty: 3, unitPrice: 75 }],
        };
        expect(computeBookingTotal(booking, stalls(3, 75, 'barn-a'))).toBe(675); // 3 × 3 × $75
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
