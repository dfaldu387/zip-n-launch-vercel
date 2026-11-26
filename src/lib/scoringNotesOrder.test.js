import { describe, it, expect } from 'vitest';
import { sortByPlaceOrder, reorderPlaces } from './scoringNotesOrder';

const e = (id, work_order, place_order) => ({ id, work_order, place_order });

describe('sortByPlaceOrder', () => {
  it('sorts by place, then puts unplaced horses last in the order they were added', () => {
    const out = sortByPlaceOrder([e('c', 3, null), e('b', 2, 1), e('a', 1, 2), e('d', 4, null)]);
    expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c', 'd']);
  });
  it('handles an empty list', () => {
    expect(sortByPlaceOrder(null)).toEqual([]);
  });
});

describe('reorderPlaces', () => {
  it('numbers 1..n and reports only the rows that changed', () => {
    const { next, changes } = reorderPlaces([e('b', 2, 2), e('a', 1, 1), e('c', 3, 3)]);
    expect(next.map((x) => x.place_order)).toEqual([1, 2, 3]);
    expect(changes).toEqual([{ id: 'b', place_order: 1 }, { id: 'a', place_order: 2 }]);
  });
  it('gives places to horses that had none', () => {
    const { changes } = reorderPlaces([e('a', 1, 1), e('b', 2, null)]);
    expect(changes).toEqual([{ id: 'b', place_order: 2 }]);
  });
});
