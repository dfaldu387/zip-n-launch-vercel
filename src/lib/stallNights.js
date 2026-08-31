// Per-stall night selection — lets an exhibitor pick fewer nights than the
// full stay for a barn priced Per Night (Robert: "if you got three stalls for
// one night... it would be six [stall-]nights", not three stalls billed for
// the whole stay regardless).

import { parseISO, addDays, differenceInCalendarDays, format } from 'date-fns';

/**
 * Every night of a stay, as 'yyyy-MM-dd' strings. The last night is the day
 * BEFORE departure — an exhibitor moving out on the 6th slept the 3rd/4th/5th,
 * matching calcNights in PublicBookingPage.jsx. Used to build the "which
 * nights do you need this stall" checkbox list.
 */
export function nightsInRange(start, end) {
    if (!start || !end) return [];
    try {
        const startD = parseISO(start);
        const total = differenceInCalendarDays(parseISO(end), startD);
        if (total <= 0) return [];
        return Array.from({ length: total }, (_, i) => format(addDays(startD, i), 'yyyy-MM-dd'));
    } catch {
        return [];
    }
}
