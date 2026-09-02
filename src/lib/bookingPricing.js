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
//
// A stall is billed at wherever it REALLY is right now, not at whichever line
// originally ordered it. Nothing stops an organizer from assigning a stall to a
// different barn than it was booked in (stallAssignment.js has no per-barn
// quota check) — when that happens, the exhibitor is billed for the barn the
// stall actually sits in today, same as any other "live" price on this page.
// It's still capped at the TOTAL number of stalls ordered, so an organizer's
// over-assignment mistake never bills for more stalls than were bought. Any
// part of the order that isn't physically assigned yet falls back to each
// line's own originally-ordered barn/price, same as before.

import { flatRateForBarn, barnPerStallTotal } from './extraStallFees';

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// Stall rows, grouped by each stall's REAL current barn (capped at the total
// stalls ordered), plus a fallback row per line for whatever part of the
// order isn't physically assigned yet.
function buildStallRows(stallItems, assignedStalls, extraStallFees, nights) {
    const rows = [];
    const orderedTotal = stallItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const used = (assignedStalls || []).slice(0, orderedTotal);

    // Nights actually billed per barn at booking time — an exhibitor can pick
    // fewer nights than the full stay for a barn priced Per Night (task 4's
    // night picker), so a stall isn't always billed for the booking's overall
    // `nights`. Falls back to `nights` for bookings made before that existed,
    // or a stall reassigned to a barn absent from the original order.
    const nightsByBarn = new Map();
    for (const it of stallItems) {
        if (it.refId != null && it.nights != null) nightsByBarn.set(it.refId, Number(it.nights) || nights);
    }
    const nightsFor = (barnId) => nightsByBarn.get(barnId) ?? nights;

    // Which fee option was actually purchased for a barn, when the order was
    // built by the Flat Fee / Nightly Fee split selector (see
    // buildBarnStallOptionItems) — 'flat' | 'per_night'. Older bookings never
    // stored this, so a barn absent here falls back to the pre-split "mixed"
    // behavior below exactly as before.
    const feeTypeByBarn = new Map();
    for (const it of stallItems) {
        if (it.refId != null && it.feeType) feeTypeByBarn.set(it.refId, it.feeType);
    }

    const byBarn = new Map();
    for (const s of used) {
        if (!byBarn.has(s.barnId)) byBarn.set(s.barnId, []);
        byBarn.get(s.barnId).push(s);
    }

    for (const [barnId, group] of byBarn) {
        const count = group.length;
        const barnNights = nightsFor(barnId);
        const nightlyRate = group[0]?.pricePerNight ?? 0;
        const flatRate = flatRateForBarn(barnId, extraStallFees);
        const feeType = feeTypeByBarn.get(barnId);
        // Mixed = a barn with BOTH a per-night rate and a flat add-on (e.g. an
        // "all barns" installation fee sitting on top of a per-night stall
        // rate). That can't be expressed as a single night-based unit price,
        // so it's billed as one combined per-stall figure instead — same as
        // a pure-flat barn, just with both parts folded in. Only applies to
        // legacy items with no recorded feeType; a split-selector item is
        // billed at exactly the option it was bought under.
        const isMixed = !feeType && nightlyRate > 0 && flatRate > 0;
        const billFlat = feeType === 'flat' || (!feeType && !isMixed && flatRate > 0);
        const perStallUnit = feeType === 'per_night' ? nightlyRate * barnNights
            : feeType === 'flat' ? flatRate
                : nightlyRate * barnNights + flatRate;
        const total = count * perStallUnit;
        const barnName = group[0]?.barnName || group[0]?.name || barnId;
        const numbers = group.map(s => s.number || s.stallNumber).filter(Boolean);

        const parts = [];
        if (feeType === 'flat') {
            parts.push(`${fmtMoney(flatRate)} flat`);
        } else if (feeType === 'per_night') {
            parts.push(`${fmtMoney(nightlyRate)}/night × ${barnNights} night${barnNights !== 1 ? 's' : ''}`);
        } else {
            if (nightlyRate > 0) parts.push(`${fmtMoney(nightlyRate)}/night × ${barnNights} night${barnNights !== 1 ? 's' : ''}`);
            if (flatRate > 0) parts.push(`${fmtMoney(flatRate)} flat`);
        }

        let description = `${barnName} × ${count}`;
        if (numbers.length > 0) description += `\nAssigned: ${numbers.join(', ')}`;
        description += `\n${(parts.length > 0 ? parts.join(' + ') : fmtMoney(0))} × ${count}`;

        rows.push({
            description,
            qty: (billFlat || isMixed) ? count : count * barnNights,
            unitPrice: isMixed ? perStallUnit : (billFlat ? flatRate : nightlyRate),
            total,
        });
    }

    // Whatever isn't physically assigned yet, priced from each line's own
    // originally-ordered barn — current flat rate if it has one, else the
    // unitPrice frozen at booking time (we have no live per-night rate to
    // fall back to here, same as before this file tracked real placement).
    let deficit = Math.max(0, orderedTotal - used.length);
    for (const it of stallItems) {
        if (deficit <= 0) break;
        const take = Math.min(Number(it.qty) || 0, deficit);
        if (take <= 0) continue;
        deficit -= take;

        const barnNights = nightsFor(it.refId);
        const nightlyRate = Number(it.unitPrice) || 0;
        const flatRate = flatRateForBarn(it.refId, extraStallFees);
        const feeType = it.feeType;
        const isMixed = !feeType && nightlyRate > 0 && flatRate > 0;
        const billFlat = feeType === 'flat' || (!feeType && !isMixed && flatRate > 0);
        const perStallUnit = feeType === 'per_night' ? nightlyRate * barnNights
            : feeType === 'flat' ? flatRate
                : nightlyRate * barnNights + flatRate;
        const total = take * perStallUnit;

        const parts = [];
        if (feeType === 'flat') {
            parts.push(`${fmtMoney(flatRate)} flat`);
        } else if (feeType === 'per_night') {
            parts.push(`${fmtMoney(nightlyRate)}/night × ${barnNights} night${barnNights !== 1 ? 's' : ''}`);
        } else {
            if (nightlyRate > 0) parts.push(`${fmtMoney(nightlyRate)}/night × ${barnNights} night${barnNights !== 1 ? 's' : ''}`);
            if (flatRate > 0) parts.push(`${fmtMoney(flatRate)} flat`);
        }

        let description = it.name || 'Stalls';
        description += `\n${take} stall${take !== 1 ? 's' : ''} not yet assigned`;
        description += ` — ${(parts.length > 0 ? parts.join(' + ') : fmtMoney(0))} × ${take}`;

        rows.push({
            description,
            qty: (billFlat || isMixed) ? take : take * barnNights,
            unitPrice: isMixed ? perStallUnit : (billFlat ? flatRate : nightlyRate),
            total,
        });
    }

    return rows;
}

/**
 * Build invoice line-item rows for a booking.
 *
 * @param {object} booking             Booking object (items[], nights, amount, …)
 * @param {Array}  [assignedStalls]    Stalls currently assigned to this booking (any
 *                                     barn), each carrying { barnId, barnName, pricePerNight, number }
 * @param {Array}  [extraStallFees]    Show's stall fees, for Flat-fee-priced barns
 * @returns {Array<{description: string, qty: number, unitPrice: number, total: number}>}
 */
export function buildLineItems(booking, assignedStalls = [], extraStallFees = []) {
    const rows = [];

    if (Array.isArray(booking.items) && booking.items.length > 0) {
        const nights = booking.nights || 1;
        const stallItems = booking.items.filter(it => it.type === 'stall');
        const otherItems = booking.items.filter(it => it.type !== 'stall');

        if (stallItems.length > 0) {
            rows.push(...buildStallRows(stallItems, assignedStalls, extraStallFees, nights));
        }

        for (const it of otherItems) {
            let description = it.name || it.type;
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
 * The live amount a booking currently owes: stalls priced at wherever they
 * really are today, plus any non-stall items. Ignores the stored
 * booking.totalAmount (which freezes at booking time and goes stale when the
 * fee is set/changed afterward) so the figure always matches the invoice PDF.
 *
 * @param {object} booking          Booking object (with items[], nights, etc.)
 * @param {Array}  [assignedStalls] Assigned stall objects carrying { barnId, barnName, pricePerNight }
 * @param {Array}  [extraStallFees] Show's stall fees, for Flat-fee-priced barns
 * @returns {number} total owed
 */
export function computeBookingTotal(booking, assignedStalls = [], extraStallFees = []) {
    return buildLineItems(booking || {}, assignedStalls, extraStallFees)
        .reduce((sum, r) => sum + (Number(r.total) || 0), 0);
}
