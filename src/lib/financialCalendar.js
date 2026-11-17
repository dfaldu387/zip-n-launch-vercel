// Day-by-day orders and money for the "Orders & Financial" calendar
// (Robert 2026-11-16). Pure functions, no React, so they are easy to test.
//
// Rules (shown to the user on the page):
//  • A sale belongs to the day the order was PLACED (booking.createdAt); an order with
//    no saved date falls back to its arrival day.
//  • Amounts are recomputed live (stalls x nights x current price + RV + supplies), never
//    the stored totalAmount, so they match the invoice and Stripe.
//  • Collected = what is recorded as paid (paidAmount, or the whole total when marked
//    paid). Outstanding = total - collected. Cancelled orders are left out.
//  • At-show orders (orderType 'live-supply') are their own order kind.
//  • With barns / RV lots picked, only the part of an order that sits in them is counted.

import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { computeBookingTotal } from './bookingPricing';
import { getAssignedStallsForBooking } from './stallAssignment';
import { getAssignedRvSpotsForBooking } from './rvAssignment';

export const ORDER_KINDS = [
    { id: 'stall', label: 'Stall orders' },
    { id: 'rv', label: 'RV orders' },
    { id: 'supply', label: 'Supply orders' },
    { id: 'atshow', label: 'At-show orders' },
];

const isoDay = (d) => (d ? String(d).slice(0, 10) : '');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const shareOf = (assigned, idKey, picked) => {
    if (!picked.length) return 1;
    if (assigned.length === 0) return 0;
    return assigned.filter((x) => picked.includes(x[idKey])).length / assigned.length;
};

// Split one booking into { stall, rv, supply, other } dollars. The non-stall lines
// carry their own amount; whatever is left of the live total is the stalls.
export function splitBookingMoney(booking, total) {
    const parts = { stall: 0, rv: 0, supply: 0, other: 0 };
    const items = Array.isArray(booking?.items) ? booking.items : [];
    if (items.length === 0) { parts.stall = total; return parts; }
    let nonStall = 0;
    for (const it of items) {
        if (it.type === 'stall') continue;
        const amt = Number(it.amount) || 0;
        nonStall += amt;
        if (it.type === 'rv') parts.rv += amt;
        else if (it.type === 'supply') parts.supply += amt;
        else parts.other += amt;
    }
    parts.stall = Math.max(total - nonStall, 0);
    return parts;
}

export function buildFinancialCalendar({
    bookings = [], barns = [], rvAreas = [], extraStallFees = [],
    barnIds = [], rvIds = [], kind = 'all', pay = 'all',
    startDate, endDate,
} = {}) {
    const locFilter = barnIds.length > 0 || rvIds.length > 0;
    const live = (bookings || []).filter((b) => b && b.status !== 'cancelled');

    const orders = [];
    for (const b of live) {
        const atShow = b.orderType === 'live-supply';
        const priced = getAssignedStallsForBooking(b, barns).map((s) => {
            const barn = barns.find((x) => x.id === s.barnId);
            return { ...s, pricePerNight: barn?.pricePerNight || 0, barnName: barn?.name };
        });
        const total = computeBookingTotal(b, priced, extraStallFees);
        const parts = splitBookingMoney(b, total);

        // Part of the order that sits inside the picked locations.
        const stallShare = barnIds.length ? shareOf(priced, 'barnId', barnIds) : (locFilter ? 0 : 1);
        const rvShare = rvIds.length ? shareOf(getAssignedRvSpotsForBooking(b, rvAreas), 'areaId', rvIds) : (locFilter ? 0 : 1);
        const money = atShow
            ? { atshow: parts.supply + parts.other + parts.stall }
            : { stall: parts.stall * stallShare, rv: parts.rv * rvShare, supply: parts.supply * stallShare };
        if (atShow && locFilter) {
            const picked = (barns || []).filter((x) => barnIds.includes(x.id)).map((x) => x.name);
            if (!barnIds.length || !picked.includes(b.barnName)) money.atshow = 0;
        }

        const kinds = Object.entries(money).filter(([, v]) => v > 0).map(([k]) => k);
        if (kinds.length === 0) continue;
        if (kind !== 'all' && !kinds.includes(kind)) continue;

        const counted = kind === 'all' ? Object.values(money).reduce((s, v) => s + v, 0) : money[kind];
        const ratio = total > 0 ? Math.min(counted / total, 1) : 0;
        const paidRaw = Number(b.paidAmount ?? (b.paymentStatus === 'paid' ? total : 0)) || 0;
        const paid = Math.min(paidRaw, total) * ratio;
        const outstanding = Math.max(counted - paid, 0);

        if (pay === 'paid' && outstanding > 0.005) continue;
        if (pay === 'unpaid' && outstanding <= 0.005) continue;

        orders.push({
            id: b.id,
            ref: b.bookingRef || b.id,
            name: b.exhibitorName || b.name || 'Order',
            date: isoDay(b.createdAt) || isoDay(b.arrivalDate),
            // With an order-type filter on, only that type is shown for the order.
            kinds: kind === 'all' ? kinds : [kind],
            money,
            sales: counted,
            paid,
            outstanding,
        });
    }

    // Day range: show window, widened to include every order date.
    let first = isoDay(startDate);
    let last = isoDay(endDate);
    for (const o of orders) {
        if (o.date && (!first || o.date < first)) first = o.date;
        if (o.date && (!last || o.date > last)) last = o.date;
    }
    const days = [];
    if (first && last) {
        const n = differenceInCalendarDays(parseISO(last), parseISO(first));
        for (let i = 0; i <= n && i < 800; i++) days.push(format(addDays(parseISO(first), i), 'yyyy-MM-dd'));
    }
    const byDay = {};
    for (const d of days) {
        byDay[d] = { date: d, orders: 0, sales: 0, paid: 0, outstanding: 0, byKind: {}, list: [] };
    }
    for (const o of orders) {
        const row = byDay[o.date];
        if (!row) continue;
        row.orders += 1;
        row.sales += o.sales;
        row.paid += o.paid;
        row.outstanding += o.outstanding;
        for (const [k, v] of Object.entries(o.money)) {
            if (v <= 0) continue;
            if (kind !== 'all' && k !== kind) continue;
            const cur = row.byKind[k] || { orders: 0, sales: 0 };
            cur.orders += 1;
            cur.sales += v;
            row.byKind[k] = cur;
        }
        row.list.push(o);
    }
    const rows = days.map((d) => {
        const r = byDay[d];
        r.sales = round2(r.sales); r.paid = round2(r.paid); r.outstanding = round2(r.outstanding);
        Object.values(r.byKind).forEach((x) => { x.sales = round2(x.sales); });
        return r;
    });

    const totals = rows.reduce((t, r) => {
        t.orders += r.orders; t.sales += r.sales; t.paid += r.paid; t.outstanding += r.outstanding;
        for (const [k, v] of Object.entries(r.byKind)) {
            const cur = t.byKind[k] || { orders: 0, sales: 0 };
            cur.orders += v.orders; cur.sales += v.sales;
            t.byKind[k] = cur;
        }
        return t;
    }, { orders: 0, sales: 0, paid: 0, outstanding: 0, byKind: {} });
    totals.sales = round2(totals.sales); totals.paid = round2(totals.paid); totals.outstanding = round2(totals.outstanding);
    Object.values(totals.byKind).forEach((x) => { x.sales = round2(x.sales); });

    return {
        rows,
        totals,
        locations: {
            barns: (barns || []).map((b) => ({ id: b.id, name: b.name || 'Barn' })),
            rvAreas: (rvAreas || []).map((a) => ({ id: a.id, name: a.name || 'RV lot' })),
        },
    };
}
