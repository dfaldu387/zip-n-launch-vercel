// Pure functions for the Smart Stall Assignment Engine.
// All functions are non-mutating — they return new objects.

const isStallItem = (it) => it && it.type === 'stall';

// How many stalls does a single booking item request?
const itemStallQty = (item) => (isStallItem(item) ? Number(item.qty) || 0 : 0);

// Total stalls a booking is asking for, summed across all stall items.
export function getRequestedStallCount(booking) {
    if (!booking?.items) {
        // Legacy single-stall booking: if it has a stallId, it asks for 1.
        return booking?.stallId ? 1 : 0;
    }
    return booking.items.reduce((sum, it) => sum + itemStallQty(it), 0);
}

// Look at the actual barn data and count stalls already pinned to this booking.
export function getAssignedStallsForBooking(booking, barns) {
    if (!booking?.id) return [];
    const result = [];
    for (const barn of barns || []) {
        for (const stall of barn.stalls || []) {
            if (stall.bookingId === booking.id) {
                result.push({ ...stall, barnId: barn.id, barnName: barn.name });
            }
        }
    }
    return result;
}

export function isFullyAssigned(booking, barns) {
    return getAssignedStallsForBooking(booking, barns).length >= getRequestedStallCount(booking);
}

// Build a quick map: barnId → array of available (unassigned) stall objects
function indexAvailableStalls(barns) {
    const map = {};
    for (const barn of barns || []) {
        // Only real, unbooked stalls are assignable — skip office/feed/wash/tack/
        // aisle/empty/blocked boxes from the barn layout.
        map[barn.id] = (barn.stalls || []).filter(s => !s.bookingId && (s.type || 'stall') === 'stall');
    }
    return map;
}

// Group bookings by trainer name (case-insensitive); solo bookings get their own group.
function groupBookingsByTrainer(bookings) {
    const groups = new Map();
    for (const b of bookings) {
        const key = (b.trainerName || '').trim().toLowerCase() || `__solo__${b.id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(b);
    }
    return [...groups.values()];
}

// Total stall qty for a group of bookings (used to sort big groups first)
function groupStallQty(bookings) {
    return bookings.reduce((s, b) => s + getRequestedStallCount(b), 0);
}

// Decide which bookings are eligible for auto-assignment in this run.
// Skip cancelled, fully-assigned, and bookings with no stall need.
function getAssignableBookings(bookings, barns) {
    return (bookings || []).filter(b => {
        if (!b) return false;
        if (b.status === 'cancelled') return false;
        if (getRequestedStallCount(b) === 0) return false;
        if (isFullyAssigned(b, barns)) return false;
        return true;
    });
}

/**
 * Plan auto-assignments WITHOUT mutating anything.
 * Returns:
 * {
 *   plan: [{ stallId, stallNumber, barnId, barnName, bookingId, bookingLabel }],
 *   skipped: [{ booking, reason, requestedQty, availableQty, barnId, barnName }],
 *   summary: { bookingsAssigned, stallsAssigned, bookingsSkipped, stallsShort }
 * }
 */
export function planAutoAssign(bookings, barns) {
    const plan = [];
    const skipped = [];
    const handledBookingIds = new Set();

    const available = indexAvailableStalls(barns);
    const barnById = Object.fromEntries((barns || []).map(b => [b.id, b]));
    const assignable = getAssignableBookings(bookings, barns);

    // Group by trainer, sort groups largest first, then bookings largest first inside each group.
    const groups = groupBookingsByTrainer(assignable)
        .sort((a, b) => groupStallQty(b) - groupStallQty(a));

    for (const group of groups) {
        const sorted = [...group].sort((a, b) => getRequestedStallCount(b) - getRequestedStallCount(a));
        for (const booking of sorted) {
            const bookingLabel = booking.exhibitorName || booking.email || booking.id?.slice(0, 8) || 'Unknown';
            const stallItems = (booking.items || []).filter(isStallItem);

            // Legacy single-stall booking with stallId already set: nothing to do.
            if (stallItems.length === 0 && booking.stallId) continue;

            // Already-assigned stalls count toward the booking's quota.
            const existing = getAssignedStallsForBooking(booking, barns).length;
            let stillNeeded = getRequestedStallCount(booking) - existing;
            if (stillNeeded <= 0) continue;

            let bookingHandled = false;

            for (const item of stallItems) {
                if (stillNeeded <= 0) break;
                const barn = barnById[item.refId];
                if (!barn) {
                    skipped.push({
                        booking,
                        bookingLabel,
                        reason: 'barn no longer exists',
                        requestedQty: itemStallQty(item),
                        availableQty: 0,
                        barnId: item.refId,
                        barnName: 'Unknown',
                    });
                    continue;
                }

                const pool = available[barn.id] || [];
                const want = Math.min(itemStallQty(item), stillNeeded);
                const take = pool.splice(0, want);

                for (const stall of take) {
                    plan.push({
                        stallId: stall.id,
                        stallNumber: stall.number,
                        barnId: barn.id,
                        barnName: barn.name,
                        bookingId: booking.id,
                        bookingLabel,
                    });
                    bookingHandled = true;
                }
                stillNeeded -= take.length;

                if (take.length < want) {
                    skipped.push({
                        booking,
                        bookingLabel,
                        reason: 'not enough free stalls in this barn',
                        requestedQty: want,
                        availableQty: take.length,
                        barnId: barn.id,
                        barnName: barn.name,
                    });
                }
            }

            if (bookingHandled) handledBookingIds.add(booking.id);
        }
    }

    const stallsShort = skipped.reduce((s, x) => s + (x.requestedQty - x.availableQty), 0);
    const skippedBookingIds = new Set(skipped.map(s => s.booking?.id).filter(Boolean));

    return {
        plan,
        skipped,
        summary: {
            bookingsAssigned: handledBookingIds.size,
            stallsAssigned: plan.length,
            bookingsSkipped: skippedBookingIds.size,
            stallsShort,
        },
    };
}

// Apply a plan to the barns array. Returns NEW barns.
export function applyPlanToBarns(barns, plan) {
    if (!plan?.length) return barns;
    const byStallId = new Map(plan.map(p => [p.stallId, p.bookingId]));
    return (barns || []).map(barn => ({
        ...barn,
        stalls: (barn.stalls || []).map(stall =>
            byStallId.has(stall.id)
                ? { ...stall, bookingId: byStallId.get(stall.id) }
                : stall
        ),
    }));
}

// Manual override helpers ────────────────────────────────────────────

// Assign a single specific stall to a booking (used by ManageStallsDialog).
export function assignStallToBooking(barns, stallId, bookingId) {
    return (barns || []).map(barn => ({
        ...barn,
        stalls: (barn.stalls || []).map(stall =>
            stall.id === stallId ? { ...stall, bookingId: bookingId || null } : stall
        ),
    }));
}

// Unassign a single stall (clear its bookingId).
export function unassignStall(barns, stallId) {
    return assignStallToBooking(barns, stallId, null);
}

// Unassign ALL stalls currently pinned to a booking.
export function unassignBookingStalls(barns, bookingId) {
    return (barns || []).map(barn => ({
        ...barn,
        stalls: (barn.stalls || []).map(stall =>
            stall.bookingId === bookingId ? { ...stall, bookingId: null } : stall
        ),
    }));
}
