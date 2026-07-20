// Booking pricing — the single source of truth for what a stall booking costs.
//
// Kept separate from invoiceGenerator.js (which pulls in jsPDF) so this stays a
// small, dependency-free module: the UI, the invoice PDF, and the unit tests all
// import the same math instead of each re-deriving it.
//
// Key rule: prices are computed LIVE from the stalls currently assigned and the
// barn's CURRENT price/night. We never trust booking.totalAmount / item.amount —
// those freeze at booking time, so a booking made before the stall fee was set
// stores $0 and would wrongly look fully paid.

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/**
 * Build invoice line-item rows for a booking.
 *
 * @param {object} booking          Booking object (items[], nights, amount, …)
 * @param {Array}  [assignedStalls] Stalls assigned to this booking, each carrying
 *                                  { barnId, pricePerNight, number }
 * @returns {Array<{description: string, qty: number, unitPrice: number, total: number}>}
 */
export function buildLineItems(booking, assignedStalls = []) {
    const rows = [];

    if (Array.isArray(booking.items) && booking.items.length > 0) {
        const nights = booking.nights || 1;
        for (const it of booking.items) {
            let description = it.name || it.type;

            // Stalls: price computed live = stalls × price/night × nights, so editing
            // the nights on a booking updates the invoice instead of using a stale amount.
            if (it.type === 'stall') {
                const stallsInThisBarn = assignedStalls.filter(s => s.barnId === it.refId);
                const count = stallsInThisBarn.length || it.qty || 0;
                const price = stallsInThisBarn[0]?.pricePerNight ?? it.unitPrice ?? 0;
                if (stallsInThisBarn.length > 0) {
                    description += `\nAssigned: ${stallsInThisBarn.map(s => s.number || s.stallNumber).join(', ')}`;
                }
                description += `\n${count} stall${count !== 1 ? 's' : ''} × ${nights} night${nights !== 1 ? 's' : ''}`;
                // Detail is rebuilt from the live price so it can't go stale against
                // the Unit Price column (a booking made before the fee was set stored
                // "$0.00/night" in it.detail — recompute instead of trusting it).
                description += `\n${fmtMoney(price)}/night × ${nights} night${nights !== 1 ? 's' : ''} × ${count}`;
                rows.push({
                    description,
                    qty: count * nights,
                    unitPrice: price,
                    total: count * nights * price,
                });
                continue;
            }

            if (it.detail) description += `\n${it.detail}`;
            rows.push({
                description,
                qty: it.qty || 1,
                unitPrice: it.unitPrice || 0,
                total: it.amount || 0,
            });
        }
    } else {
        // Legacy single-stall booking
        const qty = booking.nights || 1;
        const unitPrice = (booking.amount || 0) / Math.max(qty, 1);
        rows.push({
            description: `Stall reservation${booking.stallId ? '' : ' (unassigned)'}`,
            qty,
            unitPrice,
            total: booking.amount || 0,
        });
    }

    return rows;
}

/**
 * The live amount a booking currently owes: assigned stalls × nights × current
 * price/night, plus any non-stall items. Ignores the stored booking.totalAmount
 * (which freezes at booking time and goes stale when the fee is set/changed
 * afterward) so the figure always matches the invoice PDF.
 *
 * @param {object} booking          Booking object (with items[], nights, etc.)
 * @param {Array}  [assignedStalls] Assigned stall objects carrying { barnId, pricePerNight }
 * @returns {number} total owed
 */
export function computeBookingTotal(booking, assignedStalls = []) {
    return buildLineItems(booking || {}, assignedStalls)
        .reduce((sum, r) => sum + (Number(r.total) || 0), 0);
}
