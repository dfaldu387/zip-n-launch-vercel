import { describe, it, expect } from 'vitest';
import {
  nightsBetween,
  rentalDays,
  flightFigures,
  hotelFigures,
  rentalFigures,
  mileageFigures,
  summarizeLines,
} from '@/lib/travelActuals';

describe('nights and days', () => {
  it('counts nights from check-in to check-out', () => {
    expect(nightsBetween('2026-10-14', '2026-10-17')).toBe(3);
    expect(nightsBetween('2026-10-23', '2026-10-24')).toBe(1);
    expect(nightsBetween('', '2026-10-24')).toBe(0);
    expect(nightsBetween('2026-10-24', '2026-10-23')).toBe(0);
  });
  it('counts rental days by calendar date, same day = 1', () => {
    expect(rentalDays('2026-10-14T09:00', '2026-10-17T13:00')).toBe(3);
    expect(rentalDays('2026-10-14T09:00', '2026-10-14T17:00')).toBe(1);
    expect(rentalDays('', '2026-10-14T17:00')).toBe(0);
  });
});

describe('flight', () => {
  it('has no actual or variance until one is typed', () => {
    expect(flightFigures({ cost: '400' })).toMatchObject({ budget: 400, actual: null, variance: null });
  });
  it('variance is actual minus budget', () => {
    expect(flightFigures({ cost: '400', actualCost: '375.32' }).variance).toBeCloseTo(-24.68, 2);
    expect(flightFigures({ cost: '400', actualCost: '450' }).variance).toBe(50);
  });
});

describe('hotel (Robert mockup: 3 nights, 250 budget rate)', () => {
  const base = { checkIn: '2026-10-14', checkOut: '2026-10-17', cost: '750' };
  it('budget rate = total / nights', () => {
    expect(hotelFigures(base).budgetRate).toBe(250);
  });
  it('actual = rate x nights', () => {
    const f = hotelFigures({ ...base, actualRate: '260.78' });
    expect(f.actual).toBeCloseTo(782.34, 2);
    expect(f.variance).toBeCloseTo(32.34, 2);
  });
  it('a typed total beats the rate', () => {
    const f = hotelFigures({ ...base, actualRate: '260.78', actualCost: '800' });
    expect(f.actual).toBe(800);
    expect(f.variance).toBe(50);
    expect(f.hasOverride).toBe(true);
  });
  it('no nights means no calculated actual', () => {
    expect(hotelFigures({ cost: '250', actualRate: '260' }).actual).toBeNull();
  });
});

describe('rental car', () => {
  it('actual = rate x days', () => {
    const f = rentalFigures({ pickupTime: '2026-10-14T09:00', returnTime: '2026-10-17T13:00', cost: '237', actualRate: '82.50' });
    expect(f.days).toBe(3);
    expect(f.actual).toBeCloseTo(247.5, 2);
    expect(f.variance).toBeCloseTo(10.5, 2);
  });
});

describe('mileage (Robert mockup: 172 miles)', () => {
  it('actual = miles x actual rate', () => {
    const f = mileageFigures({ miles: '172', cost: '115.24', actualRate: '0.70' });
    expect(f.actual).toBeCloseTo(120.4, 2);
    expect(f.variance).toBeCloseTo(5.16, 2);
  });
  it('under budget is negative', () => {
    expect(mileageFigures({ miles: '172', cost: '115.24', actualRate: '0.65' }).variance).toBeCloseTo(-3.44, 2);
  });
});

describe('summarizeLines', () => {
  it('does not count a line with no actual as a saving', () => {
    const s = summarizeLines([
      { budget: 250, actual: 260.78 },
      { budget: 258, actual: null },
    ]);
    expect(s.budget).toBe(508);
    expect(s.actual).toBeCloseTo(260.78, 2);
    expect(s.variance).toBeCloseTo(10.78, 2); // only the line that has an actual
    expect(s.counted).toBe(1);
    expect(s.total).toBe(2);
  });
  it('ignores empty lines and has no actual when none are typed', () => {
    const s = summarizeLines([{ budget: 0, actual: null }, { budget: 100, actual: null }]);
    expect(s).toMatchObject({ budget: 100, actual: null, variance: null, counted: 0, total: 1 });
  });
});
