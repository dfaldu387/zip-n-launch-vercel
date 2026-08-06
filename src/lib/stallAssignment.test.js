import { describe, it, expect } from 'vitest';
import {
  getLiveBookingIds,
  isStallAvailable,
  isStallHeld,
  getRequestedStallCount,
  getAssignedStallsForBooking,
  isFullyAssigned,
  planAutoAssign,
  applyPlanToBarns,
  unassignBookingStalls,
} from './stallAssignment';

const stall = (id, extra = {}) => ({ id, number: id, type: 'stall', ...extra });

const barn = (id, stalls, extra = {}) => ({ id, name: id, stalls, ...extra });

const booking = (id, qty, barnId, extra = {}) => ({
  id,
  status: 'confirmed',
  exhibitorName: id,
  items: [{ type: 'stall', refId: barnId, qty }],
  ...extra,
});

describe('getLiveBookingIds', () => {
  it('includes every booking that is not cancelled', () => {
    const ids = getLiveBookingIds([
      { id: 'a', status: 'confirmed' },
      { id: 'b', status: 'pending' },
      { id: 'c', status: 'checked_in' },
      { id: 'd', status: 'cancelled' },
    ]);
    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });

  it('copes with missing input', () => {
    expect(getLiveBookingIds(undefined).size).toBe(0);
    expect(getLiveBookingIds([null]).size).toBe(0);
  });
});

describe('isStallAvailable', () => {
  const live = new Set(['live-booking']);

  it('is available when nothing holds it', () => {
    expect(isStallAvailable(stall('A1'), live)).toBe(true);
  });

  it('is not available when a live booking holds it', () => {
    expect(isStallAvailable(stall('A1', { bookingId: 'live-booking' }), live)).toBe(false);
  });

  // The bug this guards: cancelling only changed the status, so the stall stayed
  // pinned to the cancelled booking and could never be sold again.
  it('is available again once the booking holding it is cancelled', () => {
    expect(isStallAvailable(stall('A1', { bookingId: 'cancelled-booking' }), live)).toBe(true);
  });

  it('never offers office, wash or aisle boxes', () => {
    expect(isStallAvailable(stall('A1', { type: 'office' }), live)).toBe(false);
    expect(isStallAvailable(stall('A1', { type: 'aisle' }), live)).toBe(false);
    expect(isStallAvailable(stall('A1', { type: 'blocked' }), live)).toBe(false);
  });
});

describe('isStallHeld', () => {
  const live = new Set(['live-booking']);
  it('mirrors availability for real stalls', () => {
    expect(isStallHeld(stall('A1'), live)).toBe(false);
    expect(isStallHeld(stall('A1', { bookingId: 'live-booking' }), live)).toBe(true);
    expect(isStallHeld(stall('A1', { bookingId: 'cancelled-booking' }), live)).toBe(false);
  });
});

describe('getRequestedStallCount', () => {
  it('adds up every stall line item', () => {
    expect(getRequestedStallCount(booking('b1', 4, 'barn-a'))).toBe(4);
    expect(getRequestedStallCount({
      items: [
        { type: 'stall', refId: 'barn-a', qty: 2 },
        { type: 'stall', refId: 'barn-b', qty: 3 },
        { type: 'rv', refId: 'rv-1', qty: 5 },
      ],
    })).toBe(5);
  });

  it('treats a legacy single-stall booking as one', () => {
    expect(getRequestedStallCount({ stallId: 'A1' })).toBe(1);
    expect(getRequestedStallCount({})).toBe(0);
  });
});

describe('planAutoAssign', () => {
  it('fills a booking from its own barn and never double-books a stall', () => {
    const barns = [barn('barn-a', [stall('A1'), stall('A2'), stall('A3')])];
    const bookings = [booking('b1', 2, 'barn-a'), booking('b2', 1, 'barn-a')];

    const { plan, summary } = planAutoAssign(bookings, barns);

    expect(summary.stallsAssigned).toBe(3);
    expect(new Set(plan.map(p => p.stallId)).size).toBe(3);
  });

  it('reports a shortfall instead of over-assigning', () => {
    const barns = [barn('barn-a', [stall('A1')])];
    const { plan, skipped, summary } = planAutoAssign([booking('b1', 3, 'barn-a')], barns);

    expect(plan).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(summary.stallsShort).toBe(2);
  });

  it('leaves cancelled bookings alone', () => {
    const barns = [barn('barn-a', [stall('A1'), stall('A2')])];
    const { plan } = planAutoAssign(
      [booking('b1', 2, 'barn-a', { status: 'cancelled' })],
      barns
    );
    expect(plan).toHaveLength(0);
  });

  // A show cancelled before stalls were released on cancel keeps stalls pinned to
  // the cancelled booking. Those must come back into use on their own.
  it('re-uses stalls still pinned to a cancelled booking', () => {
    const barns = [barn('barn-a', [
      stall('A1', { bookingId: 'gone' }),
      stall('A2', { bookingId: 'gone' }),
    ])];
    const bookings = [
      { id: 'gone', status: 'cancelled', items: [{ type: 'stall', refId: 'barn-a', qty: 2 }] },
      booking('b2', 2, 'barn-a'),
    ];

    const { plan, summary } = planAutoAssign(bookings, barns);

    expect(summary.stallsAssigned).toBe(2);
    expect(plan.every(p => p.bookingId === 'b2')).toBe(true);
  });

  it('counts stalls a booking already holds toward its quota', () => {
    const barns = [barn('barn-a', [
      stall('A1', { bookingId: 'b1' }),
      stall('A2'),
      stall('A3'),
    ])];
    const { plan } = planAutoAssign([booking('b1', 2, 'barn-a')], barns);

    // Needs 2, already holds 1 → exactly 1 more.
    expect(plan).toHaveLength(1);
  });

  it('skips office and aisle boxes', () => {
    const barns = [barn('barn-a', [
      stall('A1', { type: 'office' }),
      stall('A2', { type: 'aisle' }),
      stall('A3'),
    ])];
    const { plan } = planAutoAssign([booking('b1', 3, 'barn-a')], barns);

    expect(plan).toHaveLength(1);
    expect(plan[0].stallId).toBe('A3');
  });
});

describe('applyPlanToBarns / unassignBookingStalls', () => {
  it('applies a plan without touching anything else', () => {
    const barns = [barn('barn-a', [stall('A1'), stall('A2')])];
    const next = applyPlanToBarns(barns, [{ stallId: 'A1', bookingId: 'b1' }]);

    expect(next[0].stalls[0].bookingId).toBe('b1');
    expect(next[0].stalls[1].bookingId).toBeUndefined();
    // Original untouched.
    expect(barns[0].stalls[0].bookingId).toBeUndefined();
  });

  it('releases every stall a booking holds', () => {
    const barns = [barn('barn-a', [
      stall('A1', { bookingId: 'b1' }),
      stall('A2', { bookingId: 'b1' }),
      stall('A3', { bookingId: 'b2' }),
    ])];

    const next = unassignBookingStalls(barns, 'b1');

    expect(next[0].stalls.map(s => s.bookingId)).toEqual([null, null, 'b2']);
  });
});

describe('isFullyAssigned / getAssignedStallsForBooking', () => {
  it('knows when a booking still needs stalls', () => {
    const barns = [barn('barn-a', [stall('A1', { bookingId: 'b1' }), stall('A2')])];
    const b = booking('b1', 2, 'barn-a');

    expect(getAssignedStallsForBooking(b, barns)).toHaveLength(1);
    expect(isFullyAssigned(b, barns)).toBe(false);

    const full = applyPlanToBarns(barns, [{ stallId: 'A2', bookingId: 'b1' }]);
    expect(isFullyAssigned(b, full)).toBe(true);
  });
});
