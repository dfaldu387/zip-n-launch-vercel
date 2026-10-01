import { describe, it, expect } from 'vitest';
import { estimatedProcessingFee, invoiceProcessingFeeLine } from './invoiceGenerator';

// Regression: the downloadable invoice PDF never showed the "Customer pays the
// fee" surcharge, even though the public booking page and the real emailed
// Stripe invoice both already included it — so the PDF understated what
// Stripe would actually charge. This pins down the shared formula (same
// STRIPE_PCT/STRIPE_FLAT_CENTS as PublicBookingPage.jsx and the two edge
// functions) the PDF now uses to match them.

describe('estimatedProcessingFee', () => {
    it('matches the real Stripe invoice example: $6.00 subtotal -> $0.49 fee', () => {
        // Confirmed live: Gmail showed "Card processing fee (estimated) $0.49"
        // on a $6.00 subtotal, $6.49 total.
        expect(estimatedProcessingFee(6)).toBe(0.49);
    });

    it('grosses up so Stripe\'s cut still leaves the full subtotal for the platform', () => {
        const subtotal = 100;
        const fee = estimatedProcessingFee(subtotal);
        const grossed = subtotal + fee;
        // After Stripe takes 2.9% + $0.30, what's left should cover the subtotal
        // (small rounding slack from the per-cent ceiling).
        const afterStripeCut = grossed * (1 - 0.029) - 0.30;
        expect(afterStripeCut).toBeGreaterThanOrEqual(subtotal - 0.01);
    });

    // Not tested here: "don't add a fee line on a $0 invoice" is the caller's
    // job (generateInvoicePdf only calls this when subtotal > 0) — this pure
    // formula still returns Stripe's flat 30¢ (grossed up) for a 0 subtotal,
    // same as the real STRIPE_FLAT_CENTS math would.
});

// Regression: a booking already Paid in full (Robert Dehn, $608.00 — caught
// live comparing the downloaded PDF against a real one) wrongly showed an
// $18.47 "Balance Due" once the fee line was added, because the first version
// computed the fee on the whole subtotal instead of the outstanding balance.
describe('invoiceProcessingFeeLine', () => {
    it('adds no fee and no balance due for a booking already paid in full', () => {
        const result = invoiceProcessingFeeLine(608, 608, 'customer');
        expect(result.feeAmount).toBe(0);
        expect(result.subtotal).toBe(608);
        expect(result.balanceDue).toBe(0);
    });

    it('computes the fee on the outstanding balance only, for a partial payment', () => {
        const result = invoiceProcessingFeeLine(608, 400, 'customer');
        const expectedFee = estimatedProcessingFee(608 - 400); // fee on the $208 still owed
        expect(result.feeAmount).toBe(expectedFee);
        expect(result.balanceDue).toBeCloseTo(208 + expectedFee, 2);
        // Subtotal is the items total plus the fee — matches the invoice table,
        // which lists the fee as its own row summed into Subtotal.
        expect(result.subtotal).toBeCloseTo(608 + expectedFee, 2);
    });

    it('adds the fee on the full amount for a brand new, unpaid invoice', () => {
        const result = invoiceProcessingFeeLine(6, 0, 'customer');
        expect(result.feeAmount).toBe(0.49); // matches the real Stripe invoice example
        expect(result.subtotal).toBe(6.49);
        expect(result.balanceDue).toBeNull(); // nothing paid yet — shown as "Total", not "Balance Due"
    });

    it('never adds a fee line when the show absorbs it', () => {
        const result = invoiceProcessingFeeLine(608, 0, 'show');
        expect(result.feeAmount).toBe(0);
        expect(result.subtotal).toBe(608);
    });
});
