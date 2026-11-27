import { describe, it, expect } from 'vitest';
import { parseTime, formatTime, rankByTime, penaltySeconds, finalTime } from './scoringTime';

const e = (id, work_order, time_seconds, no_time = false) => ({ id, work_order, time_seconds, no_time });

describe('parseTime / formatTime', () => {
  it('reads decimals and commas, rejects empty, text and zero', () => {
    expect(parseTime('17.342')).toBe(17.342);
    expect(parseTime('17,5')).toBe(17.5);
    expect(parseTime('')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('0')).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
  it('shows three decimals', () => {
    expect(formatTime(17.3)).toBe('17.300');
    expect(formatTime(null)).toBe('');
  });
});

describe('time penalties', () => {
  const rules = { starting_score: 0, penalties: [{ id: 'p1', name: 'Barrel', points: 5, kind: 'normal' }, { id: 'p2', name: 'X', points: 0, kind: 'dq' }] };
  it('adds seconds for each penalty, ignores special kinds', () => {
    expect(penaltySeconds({ time_penalties: { p1: 2, p2: 1 } }, rules)).toBe(10);
    expect(finalTime({ time_seconds: '17.1', time_penalties: { p1: 1 } }, rules)).toBe(22.1);
    expect(finalTime({ time_seconds: '' }, rules)).toBeNull();
  });
  it('penalties change the placings', () => {
    const { ranked } = rankByTime([
      { id: 'a', work_order: 1, time_seconds: '17', time_penalties: { p1: 1 } },
      { id: 'b', work_order: 2, time_seconds: '20' },
    ], rules);
    expect(ranked.map((x) => [x.id, x.placing])).toEqual([['b', 1], ['a', 2]]);
  });
});

describe('rankByTime', () => {
  it('fastest time is 1st', () => {
    const { ranked } = rankByTime([e('a', 1, '18.2'), e('b', 2, '17.1'), e('c', 3, '19.9')]);
    expect(ranked.map((x) => [x.id, x.placing])).toEqual([['b', 1], ['a', 2], ['c', 3]]);
  });
  it('equal times share a placing and the next is skipped', () => {
    const { ranked } = rankByTime([e('a', 1, 17), e('b', 2, 17), e('c', 3, 18)]);
    expect(ranked.map((x) => x.placing)).toEqual([1, 1, 3]);
  });
  it('horses with no time yet, then No time horses, go last without a placing', () => {
    const { ranked, waiting, noTime } = rankByTime([e('a', 1, null), e('b', 2, '16'), e('c', 3, '20', true)]);
    expect(ranked.map((x) => [x.id, x.placing])).toEqual([['b', 1], ['a', null], ['c', null]]);
    expect(waiting).toBe(1);
    expect(noTime).toBe(1);
  });
});
