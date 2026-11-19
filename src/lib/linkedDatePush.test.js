import { describe, it, expect } from 'vitest';
import { computeDatePush } from './linkedDatePush';

describe('computeDatePush', () => {
  const old = { startDate: '2026-10-01', endDate: '2026-10-03' };

  it('pushes a changed date when the other record still holds the old one', () => {
    const out = computeDatePush(old, { startDate: '2026-10-13', endDate: '2026-10-15' }, old);
    expect(out).toEqual({ startDate: '2026-10-13', endDate: '2026-10-15' });
  });

  it('never overwrites a date the other record changed on its own', () => {
    const out = computeDatePush(old, { startDate: '2026-10-13', endDate: '2026-10-03' }, { startDate: '2026-10-07', endDate: '2026-10-03' });
    expect(out).toEqual({});
  });

  it('fills an empty date', () => {
    expect(computeDatePush(old, { startDate: '2026-10-13', endDate: '2026-10-03' }, {})).toEqual({ startDate: '2026-10-13' });
  });

  it('does nothing when nothing changed', () => {
    expect(computeDatePush(old, old, old)).toEqual({});
  });
});
