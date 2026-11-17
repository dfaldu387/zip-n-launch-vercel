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
import { getAssignedStallsForBooking } from './stallAssignment';
import { getAssignedRvSpotsForBooking, sellableRvSpotCount } from './rvAssignment';
import { getItemStatus, isItemDelivered } from './supplyStatus';

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

// Share of a booking that sits in the picked locations (0..1).
// With nothing picked everything counts (share 1), so the old totals do not change.
const shareOf = (assigned, idKey, picked) => {
    if (!picked.length) return 1;
    if (assigned.length === 0) return 0; // not placed yet, so it cannot be said to be in a picked barn
    return assigned.filter((x) => picked.includes(x[idKey])).length / assigned.length;
};

// Split `n` across places in proportion to how many spots each holds.
const splitAcross = (n, assigned, idKey) => {
    const out = {};
    if (n <= 0) return out;
    if (assigned.length === 0) { out.unassigned = n; return out; }
    const per = {};
    assigned.forEach((x) => { per[x[idKey]] = (per[x[idKey]] || 0) + 1; });
    Object.entries(per).forEach(([id, c]) => { out[id] = Math.round((n * c) / assigned.length); });
    return out;
};

const addTo = (map, id, n) => { if (n > 0) map[id] = (map[id] || 0) + n; };

// Filters (Robert 2026-11-16): barnIds / rvIds = the locations picked. Nothing picked =
// whole facility. Once something is picked, only those locations are counted.
export function buildHousingCalendar({
    bookings = [], supplies = [], startDate, endDate,
    barns = [], rvAreas = [], barnIds = [], rvIds = [],
} = {}) {
    const locFilter = barnIds.length > 0 || rvIds.length > 0;
    const pickedBarnNames = (barns || []).filter((b) => barnIds.includes(b.id)).map((b) => b.name);
    const allLive = (bookings || []).filter((b) => b && b.status !== 'cancelled');
    const stayBookings = allLive.filter((b) => b.orderType !== 'live-supply');

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
    // Work out the deliveries first, so a delivery made before move-in (or after
    // move-out) still gets a day of its own instead of silently disappearing.
    const deliveries = [];
    for (const o of allLive) {
        let orderShare = 1;
        if (o.orderType === 'live-supply') {
            if (barnIds.length) orderShare = pickedBarnNames.includes(o.barnName) ? 1 : 0;
            else if (locFilter) orderShare = 0;
        } else if (barnIds.length) {
            orderShare = shareOf(getAssignedStallsForBooking(o, barns), 'barnId', barnIds);
        } else if (locFilter) {
            orderShare = 0;
        }
        if (orderShare <= 0) continue;
        for (const it of beddingItemsOf(o, supplies)) {
            const { status, stageTimestamps } = getItemStatus(o, it.refId);
            if (status !== 'delivered') continue;
            // Older orders were marked Delivered without saving the time: use the
            // latest time that was saved so they still land on a day.
            const st = stageTimestamps || {};
            const day = isoDay(st.delivered || st.out_for_delivery || st.received || st.new || o.createdAt);
            const qty = Math.round((Number(it.qty) || 0) * orderShare);
            if (!day || qty <= 0) continue;
            deliveries.push({ day, key: it.isHay ? 'deliveredBales' : 'deliveredBags', qty });
            if (!first || day < first) first = day;
            if (!last || day > last) last = day;
        }
    }
    const days = daysInRange(first, last);

    const byDay = {};
    for (const day of days) {
        byDay[day] = {
            date: day, stalls: 0, rvs: 0, horses: 0, bookings: 0, shavingsBags: 0, hayBales: 0,
            deliveredBags: 0, deliveredBales: 0, outstandingBags: 0, outstandingBales: 0,
            byBarn: {}, byRv: {},
        };
    }
    const add = (day, key, n) => { if (byDay[day]) byDay[day][key] += n; };

    for (const b of stayBookings) {
        const stay = daysInRange(b.arrivalDate, b.departureDate);
        if (stay.length === 0) continue;

        const assignedStalls = getAssignedStallsForBooking(b, barns);
        const assignedRv = getAssignedRvSpotsForBooking(b, rvAreas);
        const stallShare = barnIds.length ? shareOf(assignedStalls, 'barnId', barnIds) : (locFilter ? 0 : 1);
        const rvShare = rvIds.length ? shareOf(assignedRv, 'areaId', rvIds) : (locFilter ? 0 : 1);
        const horseShare = barnIds.length ? stallShare : (rvIds.length ? rvShare : 1);

        // Stalls / RV counted on each day (nightly-fee lines only on the nights picked).
        const stallDay = {};
        const rvDay = {};
        for (const it of b.items || []) {
            if (it.type !== 'stall' && it.type !== 'rv') continue;
            const qty = Number(it.qty) || 0;
            if (qty <= 0) continue;
            const picked = Array.isArray(it.nightDates) ? it.nightDates.map(isoDay).filter(Boolean) : [];
            const when = it.feeType === 'per_night' && picked.length > 0 ? picked : stay;
            const target = it.type === 'rv' ? rvDay : stallDay;
            when.forEach((day) => { target[day] = (target[day] || 0) + qty; });
        }

        if (horseShare > 0) stay.forEach((day) => add(day, 'bookings', 1));
        const horses = Math.round(horseCountOf(b) * horseShare);
        stay.forEach((day) => add(day, 'horses', horses));

        const stallsInPicked = barnIds.length ? assignedStalls.filter((x) => barnIds.includes(x.barnId)) : assignedStalls;
        for (const [day, n] of Object.entries(stallDay)) {
            const eff = Math.round(n * stallShare);
            add(day, 'stalls', eff);
            if (byDay[day]) Object.entries(splitAcross(eff, stallsInPicked, 'barnId')).forEach(([id, c]) => addTo(byDay[day].byBarn, id, c));
        }
        const rvInPicked = rvIds.length ? assignedRv.filter((x) => rvIds.includes(x.areaId)) : assignedRv;
        for (const [day, n] of Object.entries(rvDay)) {
            const eff = Math.round(n * rvShare);
            add(day, 'rvs', eff);
            if (byDay[day]) Object.entries(splitAcross(eff, rvInPicked, 'areaId')).forEach(([id, c]) => addTo(byDay[day].byRv, id, c));
        }

        // Pre-Show Delivery hay / shavings are due on the arrival day.
        const arrival = isoDay(b.arrivalDate);
        for (const it of beddingItemsOf(b, supplies)) {
            if (!it.preBedding) continue;
            const qty = Math.round((Number(it.qty) || 0) * stallShare);
            if (qty <= 0) continue;
            add(arrival, it.isHay ? 'hayBales' : 'shavingsBags', qty);
            if (!isItemDelivered(b, it.refId)) add(arrival, it.isHay ? 'outstandingBales' : 'outstandingBags', qty);
        }
    }

    // Actual deliveries land on the day they were delivered.
    deliveries.forEach((d) => add(d.day, d.key, d.qty));

    const rows = days.map((d) => byDay[d]);
    const peak = (key) => rows.reduce((m, r) => (r[key] > m.value ? { value: r[key], date: r.date } : m), { value: 0, date: '' });
    const sum = (key) => rows.reduce((s, r) => s + r[key], 0);

    const stallCount = (br) => (br.stalls || []).filter((s) => (s.type || 'stall') === 'stall').length;
    const shownBarns = (barns || []).filter((b) => !barnIds.length || barnIds.includes(b.id));
    const shownRv = (rvAreas || []).filter((a) => !rvIds.length || rvIds.includes(a.id));
    const capacity = {
        stalls: barnIds.length || !rvIds.length ? shownBarns.reduce((s, b) => s + stallCount(b), 0) : 0,
        rvs: rvIds.length || !barnIds.length ? shownRv.reduce((s, a) => s + sellableRvSpotCount(a.spots || []), 0) : 0,
    };

    return {
        rows,
        totals: {
            shavingsBags: sum('shavingsBags'),
            hayBales: sum('hayBales'),
            deliveredBags: sum('deliveredBags'),
            deliveredBales: sum('deliveredBales'),
            outstandingBags: sum('outstandingBags'),
            outstandingBales: sum('outstandingBales'),
        },
        peaks: { stalls: peak('stalls'), rvs: peak('rvs'), horses: peak('horses') },
        capacity,
        locations: {
            barns: (barns || []).map((b) => ({ id: b.id, name: b.name || 'Barn', stalls: stallCount(b) })),
            rvAreas: (rvAreas || []).map((a) => ({ id: a.id, name: a.name || 'RV lot', spots: sellableRvSpotCount(a.spots || []) })),
        },
        // Bookings that have no horse count at all, shown as a gentle reminder.
        missingHorseCount: stayBookings.filter((b) => horseCountOf(b) === 0).length,
    };
}
