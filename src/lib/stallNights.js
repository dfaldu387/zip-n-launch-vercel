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
/**
 * Human text for a list of night dates: ['2026-11-06','2026-11-07'] → "Nov 6 & 7",
 * 3+ in a row → "Nov 6–8", gaps → "Nov 6, Nov 9". Returns '' for no dates.
 * (The email function keeps its own copy of this — no shared imports there.)
 */
export function formatNightDates(dates) {
    const list = [...new Set(Array.isArray(dates) ? dates : [])].filter(Boolean).sort();
    if (list.length === 0) return '';
    const parsed = list.map((d) => parseISO(d));
    const runs = [];
    for (const d of parsed) {
        const last = runs[runs.length - 1];
        if (last && differenceInCalendarDays(d, last[last.length - 1]) === 1) last.push(d);
        else runs.push([d]);
    }
    const fmtRun = (run) => {
        const first = run[0];
        const end = run[run.length - 1];
        if (run.length === 1) return format(first, 'MMM d');
        const endText = first.getMonth() === end.getMonth() ? format(end, 'd') : format(end, 'MMM d');
        return `${format(first, 'MMM d')}${run.length === 2 ? ' & ' : '–'}${endText}`;
    };
    return runs.map(fmtRun).join(', ');
}

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
