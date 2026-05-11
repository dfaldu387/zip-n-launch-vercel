// Pure conflict & capacity detection for housing data.
// Inputs are READ-ONLY; output is an array of conflict objects:
//   { id, severity: 'error'|'warning'|'info', type, title, description,
//     relatedIds: { bookingId?, barnId?, stallId?, rvAreaId? }, fix? }

import { getRequestedStallCount, getAssignedStallsForBooking } from './stallAssignment';

const CRITICAL_STATUSES = new Set(['pending', 'confirmed', 'checked_in']);

const isStallItem = (it) => it && it.type === 'stall';
const isRvItem    = (it) => it && it.type === 'rv';

const labelOf = (b) => b.exhibitorName || b.email || (b.id ? `#${String(b.id).slice(0, 8)}` : 'Unknown');

// 1. Stall double-assigned to multiple bookings (data corruption — shouldn't happen)
function checkDoubleAssignedStalls(bookings, barns) {
    const out = [];
    const bookingIds = new Set((bookings || []).map(b => b.id));
    for (const barn of barns || []) {
        const seenBookingId = new Map(); // bookingId → stallId (first time seen)
        for (const stall of barn.stalls || []) {
            if (!stall.bookingId) continue;
            // Sanity: if booking referenced no longer exists
            if (!bookingIds.has(stall.bookingId)) {
                out.push({
                    id: `orphan-stall-${stall.id}`,
                    severity: 'error',
                    type: 'orphan_stall',
                    title: 'Orphan stall assignment',
                    description: `Stall ${barn.name}·${stall.number} is assigned to a booking that no longer exists.`,
                    relatedIds: { stallId: stall.id, barnId: barn.id },
                    fix: 'Use Manage Stalls on any booking, or unassign the stall manually.',
                });
            }
        }
    }
    return out;
}

// 2. Cancelled booking still holding stalls (should be released)
function checkCancelledHoldingStalls(bookings, barns) {
    const out = [];
    for (const b of bookings || []) {
        if (b.status !== 'cancelled') continue;
        const held = getAssignedStallsForBooking(b, barns);
        if (held.length > 0) {
            out.push({
                id: `cancelled-holds-${b.id}`,
                severity: 'error',
                type: 'cancelled_holds_stalls',
                title: 'Cancelled booking still holds stalls',
                description: `${labelOf(b)} is cancelled but still has ${held.length} stall${held.length !== 1 ? 's' : ''} assigned (${held.map(s => s.number).join(', ')}).`,
                relatedIds: { bookingId: b.id },
                fix: 'Open Manage Stalls and click each green stall to unassign.',
            });
        }
    }
    return out;
}

// 3. Booking under-assigned (got fewer stalls than requested)
function checkUnderAssigned(bookings, barns) {
    const out = [];
    for (const b of bookings || []) {
        if (!CRITICAL_STATUSES.has(b.status)) continue;
        const requested = getRequestedStallCount(b);
        if (requested === 0) continue;
        const assigned = getAssignedStallsForBooking(b, barns).length;
        if (assigned < requested) {
            out.push({
                id: `under-${b.id}`,
                severity: 'warning',
                type: 'under_assigned',
                title: 'Booking missing stalls',
                description: `${labelOf(b)} requested ${requested} stall${requested !== 1 ? 's' : ''} but only ${assigned} assigned.`,
                relatedIds: { bookingId: b.id },
                fix: 'Click Smart Auto-Assign, or use Manage Stalls on this booking.',
            });
        }
    }
    return out;
}

// 4. Booking over-assigned (got more stalls than requested)
function checkOverAssigned(bookings, barns) {
    const out = [];
    for (const b of bookings || []) {
        if (b.status === 'cancelled') continue; // separate check handles this
        const requested = getRequestedStallCount(b);
        const assigned = getAssignedStallsForBooking(b, barns).length;
        if (assigned > requested && requested > 0) {
            out.push({
                id: `over-${b.id}`,
                severity: 'warning',
                type: 'over_assigned',
                title: 'Booking over-assigned',
                description: `${labelOf(b)} requested ${requested} stall${requested !== 1 ? 's' : ''} but has ${assigned} assigned.`,
                relatedIds: { bookingId: b.id },
                fix: 'Use Manage Stalls to remove the extra stalls.',
            });
        }
    }
    return out;
}

// 5. Trainer's bookings split across multiple barns (group separated)
function checkGroupSeparation(bookings, barns) {
    const out = [];
    const trainerBarns = new Map(); // trainerName → Set of barnIds
    for (const b of bookings || []) {
        if (!CRITICAL_STATUSES.has(b.status)) continue;
        const trainer = (b.trainerName || '').trim();
        if (!trainer) continue;
        const barnIds = new Set(getAssignedStallsForBooking(b, barns).map(s => s.barnId));
        if (!trainerBarns.has(trainer)) trainerBarns.set(trainer, new Set());
        for (const id of barnIds) trainerBarns.get(trainer).add(id);
    }
    for (const [trainer, barnIds] of trainerBarns.entries()) {
        if (barnIds.size > 1) {
            const barnNames = (barns || [])
                .filter(b => barnIds.has(b.id))
                .map(b => b.name)
                .join(', ');
            out.push({
                id: `split-${trainer}`,
                severity: 'warning',
                type: 'group_separated',
                title: 'Trainer group split across barns',
                description: `"${trainer}" has stalls in ${barnIds.size} barns (${barnNames}). Group may prefer to stay together.`,
                relatedIds: {},
                fix: 'Re-run Smart Auto-Assign after freeing up adjacent stalls in one barn.',
            });
        }
    }
    return out;
}

// 6. Total stall demand exceeds capacity
function checkStallCapacity(bookings, barns) {
    const out = [];
    const totalCapacity = (barns || []).reduce((s, b) => s + ((b.stalls || []).length || b.stallCount || 0), 0);
    if (totalCapacity === 0) return out;
    let totalDemand = 0;
    for (const b of bookings || []) {
        if (b.status === 'cancelled') continue;
        totalDemand += getRequestedStallCount(b);
    }
    if (totalDemand > totalCapacity) {
        out.push({
            id: 'overbooked-stalls',
            severity: 'warning',
            type: 'overbooked_stalls',
            title: 'Stall demand exceeds capacity',
            description: `Active bookings request ${totalDemand} stalls but you only have ${totalCapacity}. Short by ${totalDemand - totalCapacity}.`,
            relatedIds: {},
            fix: 'Add more stalls in Inventory tab, or cancel some bookings.',
        });
    }
    return out;
}

// 7. Total RV demand exceeds RV spot capacity
function checkRvCapacity(bookings, rvAreas) {
    const out = [];
    const totalSpots = (rvAreas || []).reduce((s, a) => s + (a.spotCount || 0), 0);
    if (totalSpots === 0) return out;
    let totalDemand = 0;
    for (const b of bookings || []) {
        if (b.status === 'cancelled') continue;
        for (const it of b.items || []) {
            if (isRvItem(it)) totalDemand += Number(it.qty) || 0;
        }
    }
    if (totalDemand > totalSpots) {
        out.push({
            id: 'overbooked-rv',
            severity: 'warning',
            type: 'overbooked_rv',
            title: 'RV demand exceeds spots',
            description: `Active bookings request ${totalDemand} RV spots but you only have ${totalSpots}. Short by ${totalDemand - totalSpots}.`,
            relatedIds: {},
            fix: 'Add more RV spots, set up an overflow lot, or cancel some bookings.',
        });
    }
    return out;
}

// 8. Duplicate contact info (same email or phone) — informational
function checkDuplicateContacts(bookings) {
    const out = [];
    const byEmail = new Map();
    const byPhone = new Map();
    for (const b of bookings || []) {
        if (b.status === 'cancelled') continue;
        const email = (b.email || '').trim().toLowerCase();
        const phone = (b.phone || '').replace(/\D/g, '');
        if (email) {
            if (!byEmail.has(email)) byEmail.set(email, []);
            byEmail.get(email).push(b);
        }
        if (phone) {
            if (!byPhone.has(phone)) byPhone.set(phone, []);
            byPhone.get(phone).push(b);
        }
    }
    for (const [email, bs] of byEmail.entries()) {
        if (bs.length > 1) {
            out.push({
                id: `dup-email-${email}`,
                severity: 'info',
                type: 'duplicate_email',
                title: 'Duplicate email',
                description: `${bs.length} active bookings share email "${email}" — may be intentional (same person, different horses) or a duplicate signup.`,
                relatedIds: {},
            });
        }
    }
    for (const [phone, bs] of byPhone.entries()) {
        if (bs.length > 1 && phone.length >= 7) {
            // Skip if it's already covered by a same-email duplicate
            const sameEmailGroup = bs.every(b => bs[0].email && b.email === bs[0].email);
            if (sameEmailGroup) continue;
            out.push({
                id: `dup-phone-${phone}`,
                severity: 'info',
                type: 'duplicate_phone',
                title: 'Duplicate phone',
                description: `${bs.length} active bookings share phone "${phone}".`,
                relatedIds: {},
            });
        }
    }
    return out;
}

// 9. Missing critical contact info
function checkMissingContact(bookings) {
    const out = [];
    for (const b of bookings || []) {
        if (b.status === 'cancelled') continue;
        const noEmail = !(b.email || '').trim();
        const noPhone = !(b.phone || '').trim();
        if (noEmail && noPhone) {
            out.push({
                id: `nocontact-${b.id}`,
                severity: 'warning',
                type: 'missing_contact',
                title: 'No contact info',
                description: `${labelOf(b)} has no email or phone — you can't reach them on show day.`,
                relatedIds: { bookingId: b.id },
                fix: 'Edit the booking to add email or phone.',
            });
        }
    }
    return out;
}

// 10. Booking dates outside show window
function checkDateWindow(bookings, showInfo) {
    const out = [];
    const start = showInfo?.startDate;
    const end = showInfo?.endDate;
    if (!start || !end) return out;
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return out;

    for (const b of bookings || []) {
        if (b.status === 'cancelled') continue;
        if (!b.arrivalDate || !b.departureDate) continue;
        const arrMs = Date.parse(b.arrivalDate);
        const depMs = Date.parse(b.departureDate);
        if (!Number.isFinite(arrMs) || !Number.isFinite(depMs)) continue;
        // Allow up to 1 day before/after the show window for early arrival / late departure
        const slack = 86400 * 1000;
        if (arrMs < startMs - slack || depMs > endMs + slack) {
            out.push({
                id: `daterange-${b.id}`,
                severity: 'info',
                type: 'date_outside_window',
                title: 'Dates outside show window',
                description: `${labelOf(b)} stays ${b.arrivalDate} – ${b.departureDate}, but the show runs ${start.slice(0,10)} – ${end.slice(0,10)}.`,
                relatedIds: { bookingId: b.id },
                fix: 'May warrant an early-arrival or late-departure fee.',
            });
        }
    }
    return out;
}

// 11. RV length exceeds area's max length
function checkRvLengthViolations(bookings, rvAreas) {
    const out = [];
    const byId = new Map((rvAreas || []).map(a => [a.id, a]));
    for (const b of bookings || []) {
        if (b.status === 'cancelled') continue;
        const rvOpts = b.rvOptions || {};
        for (const it of b.items || []) {
            if (it.type !== 'rv') continue;
            const area = byId.get(it.refId);
            if (!area || !area.maxLength) continue;
            const len = Number((rvOpts[it.refId]?.length) ?? it.options?.length ?? 0);
            if (len > 0 && len > area.maxLength) {
                out.push({
                    id: `rvlen-${b.id}-${it.refId}`,
                    severity: 'warning',
                    type: 'rv_length_violation',
                    title: 'RV exceeds area length limit',
                    description: `${labelOf(b)}'s ${len}ft RV is parked in "${area.name}" (limit ${area.maxLength}ft).`,
                    relatedIds: { bookingId: b.id, rvAreaId: area.id },
                    fix: 'Move the booking to a larger RV area, or note the exception manually.',
                });
            }
        }
    }
    return out;
}

// Top-level entry: aggregate all checks and sort by severity.
export function detectConflicts({ bookings, barns, rvAreas, showInfo } = {}) {
    const all = [
        ...checkDoubleAssignedStalls(bookings, barns),
        ...checkCancelledHoldingStalls(bookings, barns),
        ...checkUnderAssigned(bookings, barns),
        ...checkOverAssigned(bookings, barns),
        ...checkGroupSeparation(bookings, barns),
        ...checkStallCapacity(bookings, barns),
        ...checkRvCapacity(bookings, rvAreas),
        ...checkDuplicateContacts(bookings),
        ...checkMissingContact(bookings),
        ...checkDateWindow(bookings, showInfo),
        ...checkRvLengthViolations(bookings, rvAreas),
    ];
    const order = { error: 0, warning: 1, info: 2 };
    return all.sort((a, b) => (order[a.severity] - order[b.severity]) || a.title.localeCompare(b.title));
}

export function summarizeConflicts(conflicts) {
    const counts = { error: 0, warning: 0, info: 0, total: conflicts.length };
    for (const c of conflicts) counts[c.severity] = (counts[c.severity] || 0) + 1;
    return counts;
}
