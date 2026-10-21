import { describe, it, expect } from 'vitest';
import { newPosition, qtyForDate, setupQtyForDate, peakQty, requiredDates, findOrphanedAssignments } from '@/lib/staffQty';

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

describe('findOrphanedAssignments', () => {
  const pos = { id: 'p1', roleId: 'JUDGE', qty: 1 };
  const arena = { id: 'a1', name: 'main', staffPositions: [pos] };
  const as = (over = {}) => ({ id: 'x1', employeeId: 'e1', arenaId: 'a1', positionId: 'p1', date: '2026-06-19', ...over });

  it('finds nothing when every assignment still has a slot', () => {
    expect(findOrphanedAssignments([arena], [], days, [as()])).toEqual([]);
  });

  it('flags an assignment whose position was removed', () => {
    const out = findOrphanedAssignments([{ ...arena, staffPositions: [] }], [], days, [as()]);
    expect(out.map((o) => o.reason)).toEqual(['position']);
  });

  it('flags an assignment whose arena was removed', () => {
    expect(findOrphanedAssignments([], [], days, [as()]).map((o) => o.reason)).toEqual(['arena']);
  });

  it('flags an assignment on a day that is now set to 0', () => {
    const oneDay = { ...pos, qty: 0, qtyByDate: { '2026-06-20': 1 } };
    const out = findOrphanedAssignments([{ ...arena, staffPositions: [oneDay] }], [], days, [as()]);
    expect(out.map((o) => o.reason)).toEqual(['day']);
  });

  it('flags an assignment on a day the arena no longer runs', () => {
    const out = findOrphanedAssignments([{ ...arena, dates: ['2026-06-20'] }], [], days, [as()]);
    expect(out.map((o) => o.reason)).toEqual(['day']);
  });

  it('flags only the extra person when Qty is lowered', () => {
    const out = findOrphanedAssignments([arena], [], days, [as({ id: 'x1' }), as({ id: 'x2', employeeId: 'e2' })]);
    expect(out.map((o) => o.assignment.id)).toEqual(['x2']);
    expect(out[0].reason).toBe('extra');
  });

  it('works for shared staff', () => {
    expect(findOrphanedAssignments([], [pos], days, [as({ arenaId: '__shared__' })])).toEqual([]);
    expect(findOrphanedAssignments([], [], days, [as({ arenaId: '__shared__' })]).map((o) => o.reason)).toEqual(['position']);
  });
});
