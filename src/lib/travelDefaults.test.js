import { describe, it, expect } from 'vitest';
import { mergeTravelDefaults, shiftDate, toDayString, applyExpenseType } from '@/lib/travelDefaults';

// The Staff page saves dates as full timestamps.
const person = (over = {}) => ({
  id: 'p1',
  name: 'Test Manager 2',
  employment_start_date: '2026-10-23',
  employment_end_date: '2026-10-24',
  reimbursable_expenses: {
    airfare: { reimbursed: true, max_value: '300', start_date: '2026-10-22', end_date: '2026-10-25' },
    hotel: { reimbursed: true, total: 250 },
  },
  ...over,
});

describe('date helpers', () => {
  it('turns a timestamp into the local day', () => {
    const local = new Date(2026, 9, 22); // 22 Oct, local midnight
    expect(toDayString(local.toISOString())).toBe('2026-10-22');
    expect(toDayString('2026-10-22')).toBe('2026-10-22');
    expect(toDayString('')).toBe('');
    expect(toDayString('garbage')).toBe('');
  });
  it('shifts by whole calendar days, also across the November clock change', () => {
    expect(shiftDate('2026-10-22', -1)).toBe('2026-10-21');
    expect(shiftDate('2026-11-02', -1)).toBe('2026-11-01');
    expect(shiftDate('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDate('2026-03-08', -1)).toBe('2026-03-07');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('mergeTravelDefaults: first fill', () => {
  const merged = mergeTravelDefaults([person()], {}, '2026-10-21', '2026-10-22');
  const t = merged.p1;
  it('flight uses the airfare dates, departing the day before', () => {
    expect(t.flight.departureTime).toBe('2026-10-21T12:00');
    expect(t.flight.arrivalTime).toBe('2026-10-22T12:00');
    expect(t.flight.returnDepartureTime).toBe('2026-10-25T12:00');
    expect(t.flight.returnArrivalTime).toBeUndefined();
  });
  it('a block that has no dates of its own uses the person dates', () => {
    expect(t.hotel.checkIn).toBe('2026-10-23');
    expect(t.hotel.checkOut).toBe('2026-10-24');
    expect(t.mileage.startDate).toBe('2026-10-23');
    expect(t.rentalCar.pickupTime).toBe('2026-10-23T12:00');
  });
  it('copies the budget cost once', () => {
    expect(t.flight.cost).toBe(300);
    expect(t.hotel.cost).toBe(250);
  });
  it('falls back to the show dates when a person has none', () => {
    const bare = mergeTravelDefaults([{ id: 'p2', reimbursable_expenses: {} }], {}, '2026-10-21', '2026-10-22').p2;
    expect(bare.hotel.checkIn).toBe('2026-10-21');
    expect(bare.hotel.checkOut).toBe('2026-10-22');
  });
  it('reads a full-timestamp Staff date', () => {
    const stamp = new Date(2026, 9, 23).toISOString();
    const m = mergeTravelDefaults([person({ employment_start_date: stamp, reimbursable_expenses: {} })], {}, '', '').p1;
    expect(m.hotel.checkIn).toBe('2026-10-23');
  });
});

describe('mergeTravelDefaults: later opens', () => {
  const first = mergeTravelDefaults([person()], {}, '', '');

  it('keeps a date someone edited', () => {
    const edited = { p1: { ...first.p1, hotel: { ...first.p1.hotel, checkIn: '2026-10-20' } } };
    const again = mergeTravelDefaults([person({ employment_start_date: '2026-10-28' })], edited, '', '');
    expect(again.p1.hotel.checkIn).toBe('2026-10-20');
  });

  it('follows a changed Staff date when nobody edited the field', () => {
    const again = mergeTravelDefaults([person({ employment_start_date: '2026-10-28', employment_end_date: '2026-10-30' })], first, '', '');
    expect(again.p1.hotel.checkIn).toBe('2026-10-28');
    expect(again.p1.hotel.checkOut).toBe('2026-10-30');
    // and keeps following the next change too
    const third = mergeTravelDefaults([person({ employment_start_date: '2026-11-04', employment_end_date: '2026-11-05' })], again, '', '');
    expect(third.p1.hotel.checkIn).toBe('2026-11-04');
  });

  it('does not move dates on a card whose dates are locked', () => {
    const locked = { p1: { ...first.p1, hotel: { ...first.p1.hotel, datesLocked: true } } };
    const again = mergeTravelDefaults([person({ employment_start_date: '2026-10-28' })], locked, '', '');
    expect(again.p1.hotel.checkIn).toBe('2026-10-23');
  });

  it('keeps following after a lock is removed', () => {
    const locked = { p1: { ...first.p1, hotel: { ...first.p1.hotel, datesLocked: true } } };
    const stillLocked = mergeTravelDefaults([person({ employment_start_date: '2026-10-28' })], locked, '', '');
    const unlocked = { p1: { ...stillLocked.p1, hotel: { ...stillLocked.p1.hotel, datesLocked: false } } };
    expect(mergeTravelDefaults([person({ employment_start_date: '2026-10-28' })], unlocked, '', '').p1.hotel.checkIn).toBe('2026-10-28');
  });

  it('replaces a broken saved date', () => {
    const broken = { p1: { ...first.p1, flight: { ...first.p1.flight, arrivalTime: '2026-10-22T18:30:00.000ZT12:00' } } };
    expect(mergeTravelDefaults([person()], broken, '', '').p1.flight.arrivalTime).toBe('2026-10-22T12:00');
  });

  it('treats older saved data (no memory of what was filled) as edited', () => {
    const old = { p1: { flight: { arrivalTime: '2026-10-19T09:00' }, hotel: { checkIn: '2026-10-19' } } };
    const m = mergeTravelDefaults([person()], old, '', '').p1;
    expect(m.flight.arrivalTime).toBe('2026-10-19T09:00');
    expect(m.hotel.checkIn).toBe('2026-10-19');
  });

  it('does not change the saved data in place', () => {
    const saved = { p1: { flight: {}, hotel: {} } };
    const snapshot = JSON.stringify(saved);
    mergeTravelDefaults([person()], saved, '', '');
    expect(JSON.stringify(saved)).toBe(snapshot);
  });
});

describe('applyExpenseType', () => {
  const project = {
    showDetails: { officials: { AHA: { JUDGE: [{ id: 'p1', reimbursable_expenses: { airfare: { reimbursed: true } } }] } } },
    other: 1,
  };
  it('sets the type on that person and expense only', () => {
    const next = applyExpenseType(project, 'p1', 'airfare', 'direct');
    expect(next.showDetails.officials.AHA.JUDGE[0].reimbursable_expenses.airfare).toEqual({ reimbursed: true, expense_type: 'direct' });
    expect(next.other).toBe(1);
    expect(project.showDetails.officials.AHA.JUDGE[0].reimbursable_expenses.airfare.expense_type).toBeUndefined();
  });
  it('returns null when the person or the expense is missing', () => {
    expect(applyExpenseType(project, 'nobody', 'airfare', 'direct')).toBeNull();
    expect(applyExpenseType(project, 'p1', 'hotel', 'direct')).toBeNull();
    expect(applyExpenseType({}, 'p1', 'airfare', 'direct')).toBeNull();
  });
});
