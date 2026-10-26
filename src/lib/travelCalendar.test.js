import { describe, it, expect } from 'vitest';
import { buildTravelEvents, filterEvents, eventsInWindow, groupByDay, dayRange, timeOf, personTotals, buildWorkEvents, findConflicts, assignmentsInShow } from './travelCalendar';

const judge = { id: 'j1', name: 'Test Judge', roleName: 'Judge', reimbursable_expenses: { airfare: { reimbursed: true, max_value: 400 }, hotel: { reimbursed: true } } };
const data = {
  j1: {
    flight: { airline: 'United', flightNumber: 'UA1', departureAirport: 'DEN', arrivalAirport: 'DFW', departureTime: '2026-11-03T07:30', arrivalTime: '2026-11-03T09:00', returnDepartureTime: '2026-11-09T15:45' },
    hotel: { checkIn: '2026-11-03', checkOut: '2026-11-09' },
  },
};

describe('buildTravelEvents', () => {
  const events = buildTravelEvents([judge], data);

  it('lists a booked flight and its return', () => {
    const flights = events.filter((e) => e.type === 'flight');
    expect(flights).toHaveLength(2);
    expect(flights[0]).toMatchObject({ status: 'booked', startDay: '2026-11-03', startTime: '7:30 AM', detail: 'United UA1 · DEN → DFW' });
  });

  it('marks an unbooked hotel with no budget as missing', () => {
    const hotel = events.find((e) => e.type === 'hotel');
    expect(hotel.status).toBe('missing');
    expect(hotel.detail).toBe('6 nights');
  });

  it('marks an unbooked item with a budget as budgeted', () => {
    const rich = { ...judge, reimbursable_expenses: { hotel: { reimbursed: true, max_value: 500 } } };
    expect(buildTravelEvents([rich], data).find((e) => e.type === 'hotel').status).toBe('budgeted');
  });

  it('skips items nobody needs and items without a date', () => {
    expect(events.some((e) => e.type === 'rentalCar')).toBe(false);
    expect(buildTravelEvents([judge], { j1: { flight: { airline: 'X' } } })).toHaveLength(0);
  });
});

describe('helpers', () => {
  const events = buildTravelEvents([judge], data);
  it('filters by type and status', () => {
    expect(filterEvents(events, { type: 'hotel' })).toHaveLength(1);
    expect(filterEvents(events, { status: 'booked' })).toHaveLength(2);
    expect(filterEvents(events, { memberId: 'nobody' })).toHaveLength(0);
  });
  it('keeps events that overlap the window', () => {
    expect(eventsInWindow(events, '2026-11-05', 2).map((e) => e.type)).toEqual(['hotel']);
  });
  it('groups by start day', () => {
    expect(groupByDay(events).map((g) => g.day)).toEqual(['2026-11-03', '2026-11-09']);
  });
  it('builds a day range and formats times', () => {
    expect(dayRange('2026-11-03', '2026-11-05')).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(timeOf('2026-11-03T00:05')).toBe('12:05 AM');
    expect(timeOf('2026-11-03')).toBe('');
  });
  it('totals flights, nights, rental days and miles per person', () => {
    const car = { ...judge, reimbursable_expenses: { hotel: { reimbursed: true }, rentalCar: { reimbursed: true }, mileage: { reimbursed: true } } };
    const travel = {
      j1: {
        ...data.j1,
        rentalCar: { company: 'Hertz', pickupTime: '2026-11-03T09:00', returnTime: '2026-11-09T09:00' },
        mileage: { origin: 'A', miles: '120', startDate: '2026-11-03', endDate: '2026-11-04' },
      },
    };
    expect(personTotals(buildTravelEvents([car], travel))).toEqual({ flights: 2, nights: 6, rentalDays: 6, miles: 120 });
  });
});

describe('Employee Scheduling link', () => {
  const events = buildTravelEvents([judge], data);
  const work = (date, reportTime = '') => ({ employeeId: 'j1', date, reportTime });

  it('joins consecutive work days into one bar', () => {
    const bars = buildWorkEvents([judge], [work('2026-11-05'), work('2026-11-04'), work('2026-11-08')]);
    expect(bars.map((b) => [b.startDay, b.endDay])).toEqual([['2026-11-04', '2026-11-05'], ['2026-11-08', '2026-11-08']]);
  });

  it('flags a flight that lands after work starts', () => {
    const c = findConflicts([judge], events, [work('2026-11-03', '08:00')]);
    expect(c.find((x) => x.kind === 'late-arrival').message).toContain('9:00 AM');
  });

  it('is quiet when the flight lands before work starts', () => {
    expect(findConflicts([judge], events, [work('2026-11-03', '10:00')]).some((x) => x.kind === 'late-arrival')).toBe(false);
  });

  it('flags a flight that lands after the first work day', () => {
    expect(findConflicts([judge], events, [work('2026-11-02')]).some((x) => x.kind === 'late-arrival')).toBe(true);
  });

  it('flags a return flight before the last work day and a hotel that misses a work day', () => {
    const kinds = findConflicts([judge], events, [work('2026-11-03'), work('2026-11-10')]).map((x) => x.kind);
    expect(kinds).toContain('early-departure');
    expect(kinds).toContain('hotel-gap');
  });

  it('has no conflicts when everything fits', () => {
    expect(findConflicts([judge], events, [work('2026-11-04'), work('2026-11-05')])).toEqual([]);
  });

  it('ignores assignments outside the show dates', () => {
    const list = [work('2026-06-19'), work('2026-10-21')];
    expect(assignmentsInShow(list, '2026-10-21', '2026-10-22')).toHaveLength(1);
    expect(assignmentsInShow(list, '', '')).toHaveLength(2);
  });
});
