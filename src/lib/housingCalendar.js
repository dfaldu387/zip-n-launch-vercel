// Day-by-day totals for the Housing & Grounds Calendar view (Robert 2026-11-15):
// stalls used, RV spots used, horses on the grounds, and hay / shavings
// pre-delivered — one row per day.
//
// Pure functions only (no React, no network) so they are easy to test.
//
// Counting rules (kept simple on purpose, shown to the user on the page):
//  • A booking is "on the grounds" from its arrival date THROUGH its departure
//    date, both included — a horse leaving on the 14th is still there that day.
//  • A Nightly-Fee stall/RV line that saved the exact nights picked counts only
//    on those nights; every other line counts for the whole stay.
//  • Pre-Show Delivery hay/shavings are counted on the booking's arrival date
//    (that is when they must be in the stalls). At-show orders are not included.
//  • Cancelled bookings and at-show re-orders (orderType 'live-supply') are skipped.

import { parseISO, addDays, differenceInCalendarDays, format } from 'date-fns';
import { beddingItemsOf } from './stallLayers';

const isoDay = (d) => {
    if (!d) return '';
    // Handles 'yyyy-MM-dd' and full ISO timestamps alike.
    const s = String(d);
    return s.length >= 10 ? s.slice(0, 10) : s;
};

// Every day from start to end, both included, as 'yyyy-MM-dd'.
export function daysInRange(start, end) {
    const a = isoDay(start);
    const b = isoDay(end);
    if (!a || !b) return [];
    try {
        const startD = parseISO(a);
        const total = differenceInCalendarDays(parseISO(b), startD);
        if (Number.isNaN(total) || total < 0) return [];
        return Array.from({ length: total + 1 }, (_, i) => format(addDays(startD, i), 'yyyy-MM-dd'));
    } catch {
        return [];
    }
}

// How many horses a booking brings. Prefers the saved count; falls back to the
// number of names typed (older bookings / manager-added bookings).
export function horseCountOf(booking) {
    const saved = Number(booking?.horseCount);
    if (Number.isFinite(saved) && saved > 0) return saved;
    const names = booking?.horseNames ?? booking?.horses;
    if (Array.isArray(names)) return names.map((s) => String(s || '').trim()).filter(Boolean).length;
    if (typeof names === 'string') return names.split(',').map((s) => s.trim()).filter(Boolean).length;
    return 0;
}

export function buildHousingCalendar({ bookings = [], supplies = [], startDate, endDate } = {}) {
    const stayBookings = (bookings || []).filter(
        (b) => b && b.status !== 'cancelled' && b.orderType !== 'live-supply',
    );

    // Calendar range: the show's move-in/out window, widened to include any
    // booking that falls outside it so no booking silently disappears.
    let first = isoDay(startDate);
    let last = isoDay(endDate);
    for (const b of stayBookings) {
        const a = isoDay(b.arrivalDate);
        const d = isoDay(b.departureDate);
        if (a && (!first || a < first)) first = a;
        if (d && (!last || d > last)) last = d;
    }
    const days = daysInRange(first, last);

    const byDay = {};
    for (const day of days) {
        byDay[day] = { date: day, stalls: 0, rvs: 0, horses: 0, bookings: 0, shavingsBags: 0, hayBales: 0 };
    }
    const add = (day, key, n) => { if (byDay[day]) byDay[day][key] += n; };

    for (const b of stayBookings) {
        const stay = daysInRange(b.arrivalDate, b.departureDate);
        if (stay.length === 0) continue;

        stay.forEach((day) => add(day, 'bookings', 1));

        const horses = horseCountOf(b);
        stay.forEach((day) => add(day, 'horses', horses));

        for (const it of b.items || []) {
            if (it.type !== 'stall' && it.type !== 'rv') continue;
            const qty = Number(it.qty) || 0;
            if (qty <= 0) continue;
            const key = it.type === 'rv' ? 'rvs' : 'stalls';
            const picked = Array.isArray(it.nightDates) ? it.nightDates.map(isoDay).filter(Boolean) : [];
            const when = it.feeType === 'per_night' && picked.length > 0 ? picked : stay;
            when.forEach((day) => add(day, key, qty));
        }

        // Pre-Show Delivery hay / shavings → the arrival day.
        const arrival = isoDay(b.arrivalDate);
        for (const it of beddingItemsOf(b, supplies)) {
            if (!it.preBedding) continue;
            const qty = Number(it.qty) || 0;
            if (qty <= 0) continue;
            add(arrival, it.isHay ? 'hayBales' : 'shavingsBags', qty);
        }
    }

    const rows = days.map((d) => byDay[d]);
    const peak = (key) => rows.reduce((m, r) => (r[key] > m.value ? { value: r[key], date: r.date } : m), { value: 0, date: '' });
    return {
        rows,
        totals: {
            shavingsBags: rows.reduce((s, r) => s + r.shavingsBags, 0),
            hayBales: rows.reduce((s, r) => s + r.hayBales, 0),
        },
        peaks: { stalls: peak('stalls'), rvs: peak('rvs'), horses: peak('horses') },
        // Bookings that have no horse count at all — shown as a gentle reminder.
        missingHorseCount: stayBookings.filter((b) => horseCountOf(b) === 0).length,
    };
}
