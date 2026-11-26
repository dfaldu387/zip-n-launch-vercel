import { describe, it, expect } from 'vitest';
import { parseTime, formatTime, rankByTime } from './scoringTime';

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
