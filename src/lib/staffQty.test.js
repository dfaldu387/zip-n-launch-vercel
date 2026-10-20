import { describe, it, expect } from 'vitest';
import { newPosition, qtyForDate, setupQtyForDate, peakQty, requiredDates } from '@/lib/staffQty';

const days = ['2026-06-19', '2026-06-20', '2026-07-01'];

describe('newPosition', () => {
  it('without a day, needs 1 person every day', () => {
    const p = newPosition('a', 'ASSISTANT_SHOW_MANAGER');
    expect(days.map((d) => qtyForDate(p, d))).toEqual([1, 1, 1]);
    expect(p.qtyByDate).toBeUndefined();
  });

  it('with a day, needs 1 person that day and nobody on the others', () => {
    const p = newPosition('a', 'ASSISTANT_SHOW_MANAGER', '2026-06-19');
    expect(days.map((d) => qtyForDate(p, d))).toEqual([1, 0, 0]);
    expect(days.map((d) => setupQtyForDate(p, d))).toEqual([1, 0, 0]);
  });

  it('counts as 1 person to hire and is not required by default', () => {
    const p = newPosition('a', 'ASSISTANT_SHOW_MANAGER', '2026-06-20');
    expect(peakQty(p, days)).toBe(1);
    expect(requiredDates(p, days)).toEqual([]);
  });
});
