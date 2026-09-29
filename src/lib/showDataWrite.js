// Helpers for saving a show's project_data without wiping what other people
// (customers booking online, Stripe payments, a second admin) wrote after this
// page loaded.
//
// The Housing page used to write "the copy I loaded earlier + my one change",
// so anything saved by someone else in between was silently overwritten. Now
// every write goes through a queue and starts from the LATEST saved copy.

// Booking fields that are saved straight to the database (status / check-in,
// the hay & shavings delivery pipeline, and payments — by check on the page or
// by Stripe on the server). When the page saves a whole booking list, these
// come from the saved copy, never from a possibly-older local one.
export const SERVER_OWNED_BOOKING_FIELDS = [
    'status', 'checkedInAt', 'checkedOutAt',
    'fulfillmentStatus', 'stageTimestamps', 'fulfilledAt', 'itemStatuses',
    'paymentStatus', 'paidAmount', 'paidAt',
    'checkNumber', 'checkAmount', 'checkRecordedAt',
];

// Merge this page's local bookings into the latest saved list.
//   • saved bookings the page has never seen (a customer booked online while the
//     tab was open) are KEPT, not deleted;
//   • bookings only the page has are dropped — they were deleted elsewhere;
//   • for a booking in both, the local edit wins, except SERVER_OWNED fields
//     (see above) which come from the saved copy, and the longer activity log.
export function mergeBookingsForSave(saved, local) {
    const localById = new Map((local || []).map(b => [b.id, b]));
    return (saved || []).map(s => {
        const l = localById.get(s.id);
        if (!l) return s;
        const merged = { ...l };
        for (const key of SERVER_OWNED_BOOKING_FIELDS) {
            if (key in s) merged[key] = s[key];
        }
        const savedLog = s.activityLog || [];
        const localLog = l.activityLog || [];
        if (savedLog.length > localLog.length) merged.activityLog = savedLog;
        return merged;
    });
}

// For admin-only fields (barns, fees, RV areas, supplies — never written by a
// customer or the server) that go out on every save: only send a field's real
// value when THIS tab actually changed it since it last knew the value
// (`baseline`, normally what the tab loaded on mount). Otherwise return
// undefined, so the caller's `field ?? latest.field` fallback keeps whatever
// is currently saved instead of overwriting it with a stale local copy — the
// bug where a tab left open (never touched Fees) silently wiped a fee another
// tab had just added, the moment anything else on the show changed.
export function fieldOrUnset(local, baseline) {
    return JSON.stringify(local) === JSON.stringify(baseline) ? undefined : local;
}

// Runs async jobs strictly one after another. A failed job never blocks the next
// one — its error goes only to the caller that queued it.
export function createSerialQueue() {
    let tail = Promise.resolve();
    return function enqueue(job) {
        const result = tail.then(job, job);
        tail = result.then(() => undefined, () => undefined);
        return result;
    };
}
