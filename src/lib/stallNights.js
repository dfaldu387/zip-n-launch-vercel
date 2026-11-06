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

/**
 * Which assigned stalls are NIGHTLY (priced per night), and for which nights.
 * Stalls only remember their booking, not which booking line they came from, so
 * for each booking we hand out its flat stalls first and then its nightly lines,
 * in the order the stalls sit in the barns. Flat stalls are not returned.
 * Returns { [stallId]: { dates, text, partial } }. `text` is the nights ("Nov 6 & 7")
 * or just "Nightly" when the booking saved no dates (older bookings).
 */
export function nightlyStallInfo(bookings, barns) {
    const byId = Object.fromEntries((bookings || []).map((b) => [b.id, b]));
    const stallsOf = {};
    for (const barn of barns || []) {
        for (const s of barn.stalls || []) {
            if ((s.type || 'stall') !== 'stall' || !s.bookingId) continue;
            (stallsOf[s.bookingId] ||= []).push(s.id);
        }
    }
    const out = {};
    for (const [bid, ids] of Object.entries(stallsOf)) {
        const b = byId[bid];
        if (!b) continue;
        const full = nightsInRange(b.arrivalDate, b.departureDate).length;
        const items = (Array.isArray(b.items) ? b.items : []).filter((it) => it.type === 'stall' && (Number(it.qty) || 0) > 0);
        const slots = [];
        for (const it of items.filter((i) => i.feeType === 'flat')) {
            for (let i = 0; i < Number(it.qty); i++) slots.push(null);
        }
        for (const it of items.filter((i) => i.feeType !== 'flat')) {
            const dates = Array.isArray(it.nightDates) ? it.nightDates : [];
            const partial = full > 0 && dates.length > 0 && dates.length < full;
            const info = { dates, partial, text: dates.length > 0 ? formatNightDates(dates) : 'Nightly' };
            for (let i = 0; i < Number(it.qty); i++) slots.push(info);
        }
        ids.forEach((id, i) => { if (slots[i]) out[id] = slots[i]; });
    }
    return out;
}
