// Upcoming Travel Calendar: turns the Flights, Hotels, Rental Cars and Mileage cards into one list of
// dated events per person. Nothing new is typed anywhere; the cards stay the source, so a change on a
// Travel tab shows here straight away.

import { bookingBoard, TRAVEL_ITEMS } from '@/lib/travelBooking';
import { shiftDate } from '@/lib/travelDefaults';

export const EVENT_TYPES = {
  flight: { label: 'Flight', tab: 'flights' },
  hotel: { label: 'Hotel', tab: 'hotels' },
  rentalCar: { label: 'Rental Car', tab: 'rental-cars' },
  mileage: { label: 'Mileage', tab: 'mileage' },
};

export const STATUS_LABELS = { booked: 'Booked', budgeted: 'Budgeted', missing: 'Needs booking' };

/** Date part (YYYY-MM-DD) of a date or date-time field; '' when it holds anything else. */
export const dayOf = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '');

/** "7:30 AM" from a YYYY-MM-DDTHH:MM field; '' when the field has no time. */
export function timeOf(value) {
  const m = typeof value === 'string' && value.match(/T(\d{2}):(\d{2})/);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Whole days between two YYYY-MM-DD dates (b minus a). */
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

const money = (n) => (n > 0 ? n : 0);

function budgetOf(member, item, card) {
  const typed = parseFloat(card.cost) || 0;
  if (typed) return typed;
  const exp = member.reimbursable_expenses?.[item.expenseKey];
  return exp?.reimbursed ? money(parseFloat(exp.total) || parseFloat(exp.max_value) || 0) : 0;
}

/**
 * [{ key, memberId, name, role, type, tab, label, detail, start, end, startDay, endDay, startTime, endTime,
 *    status, cost }] sorted by start. Only items a person needs are listed. `status` is
 * booked (details typed), budgeted (a budget but not booked yet) or missing (neither).
 */
export function buildTravelEvents(personnel, travelData = {}) {
  const events = [];
  for (const { member, items, booked } of bookingBoard(personnel, travelData)) {
    const entry = travelData[member.id] || {};
    const isBooked = new Set(booked.map((b) => b.type));
    for (const item of TRAVEL_ITEMS) {
      if (!isBooked.has(item.type) && !items.some((i) => i.type === item.type)) continue;
      const card = entry[item.type] || {};
      const cost = budgetOf(member, item, card);
      const status = isBooked.has(item.type) ? 'booked' : cost > 0 ? 'budgeted' : 'missing';
      const base = { memberId: member.id, name: member.name || 'Unnamed', role: member.roleName || '', type: item.type, tab: item.tab, status, cost };
      const add = (suffix, start, end, label, detail, extra = {}) => {
        const startDay = dayOf(start);
        if (!startDay) return;
        const endDay = dayOf(end) || startDay;
        events.push({
          ...base, ...extra, key: `${member.id}-${item.type}${suffix}`, label, detail, start, end: end || start,
          startDay, endDay: endDay < startDay ? startDay : endDay, startTime: timeOf(start), endTime: timeOf(end),
        });
      };

      if (item.type === 'flight') {
        const route = [card.departureAirport, card.arrivalAirport].filter(Boolean).join(' → ');
        const who = [card.airline, card.flightNumber].filter(Boolean).join(' ');
        add('', card.departureTime, card.arrivalTime, 'Flight', [who, route].filter(Boolean).join(' · '));
        const back = [card.arrivalAirport, card.departureAirport].filter(Boolean).join(' → ');
        add('-return', card.returnDepartureTime, card.returnArrivalTime, 'Return flight', [who, back].filter(Boolean).join(' · '));
      } else if (item.type === 'hotel') {
        const nights = card.checkIn && card.checkOut ? daysBetween(dayOf(card.checkIn), dayOf(card.checkOut)) : 0;
        add('', card.checkIn, card.checkOut, 'Hotel', [card.hotelName, nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '));
      } else if (item.type === 'rentalCar') {
        add('', card.pickupTime, card.returnTime, 'Rental Car', [card.company, card.pickupLocation].filter(Boolean).join(' · '));
      } else {
        const miles = parseFloat(card.miles) || 0;
        add('', card.startDate, card.endDate, 'Mileage', [card.origin, miles ? `${miles} miles` : ''].filter(Boolean).join(' · '), { miles });
      }
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

/** Narrow the events by person, travel type and booking status ('all' keeps everything). */
export function filterEvents(events, { memberId = 'all', type = 'all', status = 'all' } = {}) {
  return events.filter((e) =>
    (memberId === 'all' || e.memberId === memberId) &&
    (type === 'all' || e.type === type) &&
    (status === 'all' || e.status === status)); // work days have no status, so a status filter hides them
}

/** Events that touch the days [fromDay, fromDay + days). */
export function eventsInWindow(events, fromDay, days) {
  const lastDay = shiftDate(fromDay, days - 1);
  return events.filter((e) => e.endDay >= fromDay && e.startDay <= lastDay);
}

/** Events grouped by their start day, in date order: [{ day, events }]. */
export function groupByDay(events) {
  const map = new Map();
  for (const e of events) {
    if (!map.has(e.startDay)) map.set(e.startDay, []);
    map.get(e.startDay).push(e);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, events: list }));
}

/** Every day from first to last (inclusive), for the calendar columns. */
export function dayRange(first, last) {
  const days = [];
  for (let d = first; d && d <= last && days.length < 400; d = shiftDate(d, 1)) days.push(d);
  return days;
}

/** The first and last day covered by the events, or null when there are none. */
export function eventSpan(events) {
  if (events.length === 0) return null;
  return {
    first: events.reduce((m, e) => (e.startDay < m ? e.startDay : m), events[0].startDay),
    last: events.reduce((m, e) => (e.endDay > m ? e.endDay : m), events[0].endDay),
  };
}

export function formatDay(day, opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts);
}

/** Per-person totals for the Timeline's right-hand column. */
export function personTotals(events) {
  const t = { flights: 0, nights: 0, rentalDays: 0, miles: 0 };
  for (const e of events) {
    if (e.type === 'flight') t.flights += 1;
    else if (e.type === 'hotel') t.nights += Math.max(daysBetween(e.startDay, e.endDay), 0);
    else if (e.type === 'rentalCar') t.rentalDays += Math.max(daysBetween(e.startDay, e.endDay), 1);
    else if (e.type === 'mileage') t.miles += e.miles || 0;
  }
  return t;
}

// ── Employee Scheduling link ──
// Work days come straight from the schedule (staffSchedule.assignments); a conflict is a travel
// booking that does not fit those days.

/** Light-blue "On Site" bars: one per person per run of consecutive work days. */
export function buildWorkEvents(personnel, assignments = []) {
  const names = new Map((personnel || []).map((m) => [m.id, m]));
  const byPerson = new Map();
  for (const a of assignments) {
    const day = dayOf(a.date);
    if (!day || !names.has(a.employeeId)) continue;
    if (!byPerson.has(a.employeeId)) byPerson.set(a.employeeId, new Set());
    byPerson.get(a.employeeId).add(day);
  }
  const out = [];
  for (const [id, set] of byPerson) {
    const days = [...set].sort();
    let runStart = days[0];
    days.forEach((d, i) => {
      if (days[i + 1] && daysBetween(d, days[i + 1]) === 1) return;
      const m = names.get(id);
      out.push({
        key: `${id}-work-${runStart}`, memberId: id, name: m.name || 'Unnamed', role: m.roleName || '', type: 'work',
        label: 'On Site', detail: '', startDay: runStart, endDay: d, startTime: '', endTime: '',
      });
      runStart = days[i + 1];
    });
  }
  return out;
}

const dayLabel = (day) => formatDay(day, { month: 'short', day: 'numeric' });

/**
 * [{ key, memberId, name, kind, tab, message }] for travel that does not fit the person's schedule:
 * late-arrival (flight lands after work starts), early-departure (return flight before the last
 * work day) and hotel-gap (hotel dates miss a work day).
 */
export function findConflicts(personnel, events, assignments = []) {
  const work = new Map(); // memberId -> Map(day -> earliest "HH:MM" or '')
  for (const a of assignments) {
    const day = dayOf(a.date);
    if (!day) continue;
    const time = a.reportTime || a.startTime || '';
    if (!work.has(a.employeeId)) work.set(a.employeeId, new Map());
    const days = work.get(a.employeeId);
    const prev = days.get(day);
    days.set(day, prev === undefined ? time : [prev, time].filter(Boolean).sort()[0] || '');
  }

  const out = [];
  for (const m of personnel || []) {
    const days = work.get(m.id);
    if (!days) continue;
    const sorted = [...days.keys()].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const mine = events.filter((e) => e.memberId === m.id);
    const add = (kind, tab, suffix, message) => out.push({ key: `${m.id}-${kind}-${suffix}`, memberId: m.id, name: m.name || 'Unnamed', kind, tab, message });

    for (const f of mine.filter((e) => e.type === 'flight' && !e.key.endsWith('-return'))) {
      const time = days.get(first);
      if (f.endDay > first) {
        add('late-arrival', 'flights', first, `Flight lands ${dayLabel(f.endDay)}${f.endTime ? ` ${f.endTime}` : ''}, after the first work day (${dayLabel(first)}).`);
      } else if (f.endDay === first && time && f.end.slice(11, 16) > time) {
        add('late-arrival', 'flights', first, `Flight lands ${f.endTime} on ${dayLabel(first)}, but work starts ${timeOf(`${first}T${time}`)}.`);
      }
    }
    for (const f of mine.filter((e) => e.type === 'flight' && e.key.endsWith('-return'))) {
      if (f.startDay < last) add('early-departure', 'flights', last, `Return flight leaves ${dayLabel(f.startDay)}, before the last work day (${dayLabel(last)}).`);
    }
    for (const h of mine.filter((e) => e.type === 'hotel')) {
      const missed = sorted.filter((d) => d < h.startDay || d > h.endDay);
      if (missed.length > 0) {
        const list = missed.slice(0, 3).map(dayLabel).join(', ') + (missed.length > 3 ? ` +${missed.length - 3} more` : '');
        add('hotel-gap', 'hotels', h.key, `Hotel ${dayLabel(h.startDay)} – ${dayLabel(h.endDay)} does not cover work on ${list}.`);
      }
    }
  }
  return out;
}

/**
 * Schedule assignments that fall inside the show dates. Older assignments left from earlier show
 * dates are ignored here (Employee Scheduling flags those itself), so they cannot cause false conflicts.
 */
export function assignmentsInShow(assignments = [], startDay, endDay) {
  if (!startDay || !endDay) return assignments || [];
  return (assignments || []).filter((a) => {
    const d = dayOf(a.date);
    return d && d >= startDay && d <= endDay;
  });
}
