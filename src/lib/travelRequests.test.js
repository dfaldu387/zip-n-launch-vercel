import { describe, it, expect } from 'vitest';
import { applySubmissions, requestableItems, requestState } from '@/lib/travelRequests';

describe('applySubmissions', () => {
  const subs = {
    a: { flight: { submittedAt: '2026-10-23T10:00:00Z', values: { airline: 'Delta', departureTime: '2026-11-03T09:00' }, receipts: [{ id: 'r1', name: 'x.pdf', path: 'p' }] } },
  };

  it('fills the card and adds receipts', () => {
    const out = applySubmissions({ a: { flight: {} } }, subs);
    expect(out.a.flight.airline).toBe('Delta');
    expect(out.a.flight.receipts).toHaveLength(1);
  });

  it('applies an answer only once, so later manager edits stay', () => {
    const once = applySubmissions({ a: { flight: {} } }, subs);
    const edited = { a: { ...once.a, flight: { ...once.a.flight, airline: 'United' } } };
    expect(applySubmissions(edited, subs).a.flight.airline).toBe('United');
  });

  it('leaves date fields alone on a locked card', () => {
    const out = applySubmissions({ a: { flight: { datesLocked: true, departureTime: '2026-11-01T08:00' } } }, subs);
    expect(out.a.flight.departureTime).toBe('2026-11-01T08:00');
    expect(out.a.flight.airline).toBe('Delta');
  });

  it('ignores a person who is not in the travel data', () => {
    expect(applySubmissions({}, subs)).toEqual({});
  });
});

describe('requestableItems', () => {
  it('unticks items the show buys directly', () => {
    const member = { reimbursable_expenses: { hotel: { reimbursed: true, expense_type: 'direct' }, airfare: { reimbursed: true } } };
    const out = requestableItems(member, [{ type: 'flight', label: 'Flight' }, { type: 'hotel', label: 'Hotel' }]);
    expect(out.map((i) => i.checked)).toEqual([true, false]);
  });
});

describe('requestState', () => {
  it('is null before sending, sent after, submitted once answered', () => {
    const req = { sentAt: '2026-10-23T09:00:00Z' };
    expect(requestState(undefined, {})).toBeNull();
    expect(requestState(req, {})).toBe('sent');
    expect(requestState(req, { flight: { submittedAt: '2026-10-23T10:00:00Z' } })).toBe('submitted');
  });
});
