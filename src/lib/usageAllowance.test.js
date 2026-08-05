import { describe, it, expect } from 'vitest';
import { computeUsageAllowance, freeLimitFor } from './usageAllowance';

const FREE_LIMIT = 2;
const allowance = (overrides) =>
  computeUsageAllowance({
    isSubscribed: false,
    isAdmin: false,
    count: 0,
    freeLimit: FREE_LIMIT,
    ...overrides,
  });

describe('freeLimitFor', () => {
  it('knows the limit for each project type', () => {
    expect(freeLimitFor('show')).toBe(2);
    expect(freeLimitFor('pattern_book')).toBe(2);
  });

  it('falls back to 2 for an unknown type', () => {
    expect(freeLimitFor('something_else')).toBe(2);
    expect(freeLimitFor(undefined)).toBe(2);
  });
});

describe('computeUsageAllowance', () => {
  describe('free account', () => {
    it('allows creating up to the free limit', () => {
      expect(allowance({ count: 0 }).canCreate).toBe(true);
      expect(allowance({ count: 1 }).canCreate).toBe(true);
    });

    it('blocks once the limit is reached', () => {
      expect(allowance({ count: 2 }).canCreate).toBe(false);
      expect(allowance({ count: 5 }).canCreate).toBe(false);
    });

    it('counts down the remaining free projects', () => {
      expect(allowance({ count: 0 }).remainingFree).toBe(2);
      expect(allowance({ count: 1 }).remainingFree).toBe(1);
      expect(allowance({ count: 2 }).remainingFree).toBe(0);
      // Never negative, even if the stored count somehow exceeds the limit.
      expect(allowance({ count: 9 }).remainingFree).toBe(0);
    });
  });

  // The bug this guards: a Founding Insider with an active subscription and two
  // locked pattern books was shown "Free Limit Reached — upgrade to a membership
  // plan" on the tool their membership already paid for.
  describe('paying member', () => {
    it('is never blocked, however many projects exist', () => {
      expect(allowance({ isSubscribed: true, count: 2 }).canCreate).toBe(true);
      expect(allowance({ isSubscribed: true, count: 50 }).canCreate).toBe(true);
    });

    it('is marked unlimited', () => {
      expect(allowance({ isSubscribed: true, count: 2 }).isUnlimited).toBe(true);
      expect(allowance({ isSubscribed: true }).remainingFree).toBe(Infinity);
    });
  });

  describe('admin', () => {
    it('is never blocked', () => {
      expect(allowance({ isAdmin: true, count: 99 }).canCreate).toBe(true);
      expect(allowance({ isAdmin: true, count: 99 }).isUnlimited).toBe(true);
    });
  });

  it('treats a missing subscription flag as a free account', () => {
    expect(allowance({ isSubscribed: undefined, count: 2 }).canCreate).toBe(false);
    expect(allowance({ isSubscribed: null, count: 2 }).isUnlimited).toBe(false);
  });
});
