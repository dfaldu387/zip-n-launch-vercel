import { describe, it, expect } from 'vitest';
import { buildActivity } from './travelActivity';

const nameOf = (id) => ({ a: 'Anna', b: 'Bob' }[id]);

describe('buildActivity', () => {
  it('lists emails and answers newest first', () => {
    const out = buildActivity({
      requests: { a: { sentAt: '2026-10-01T10:00:00Z', items: ['hotel'], email: 'a@x.com' } },
      submissions: { a: { hotel: { submittedAt: '2026-10-02T09:00:00Z', receipts: [{ id: 1 }] } } },
      nameOf,
    });
    expect(out.map((e) => e.kind)).toEqual(['details_submitted', 'email_sent']);
    expect(out[0].detail).toBe('Hotel, 1 receipt');
    expect(out[1].detail).toBe('Hotel to a@x.com');
    expect(out[1].name).toBe('Anna');
  });

  it('words a Traveler Profile answer with its license photo and staff card fill', () => {
    const at = '2026-10-02T09:00:00Z';
    const out = buildActivity({
      log: [{ type: 'details_submitted', at, memberId: 'a', name: 'Anna', item: 'Traveler Profile', receipts: 1, addedToStaffCard: ['phone'] }],
      submissions: { a: { profile: { submittedAt: at, receipts: [{ id: 1 }] } } },
      nameOf,
    });
    expect(out).toHaveLength(1);
    expect(out[0].detail).toBe('Traveler Profile, 1 license photo, added phone to staff card');
  });

  it('names a Traveler Profile answer that only exists in the submissions', () => {
    const out = buildActivity({ submissions: { a: { profile: { submittedAt: '2026-10-02T09:00:00Z' } } }, nameOf });
    expect(out[0].detail).toBe('Traveler Profile');
  });

  it('lets a log entry replace the same event and adds who sent it', () => {
    const at = '2026-10-01T10:00:00Z';
    const out = buildActivity({
      log: [{ type: 'email_sent', at, memberId: 'a', name: 'Anna', email: 'a@x.com', items: ['Hotel'], by: 'boss@x.com' }],
      requests: { a: { sentAt: at, items: ['hotel'], email: 'a@x.com' } },
      nameOf,
    });
    expect(out).toHaveLength(1);
    expect(out[0].by).toBe('boss@x.com');
  });

  it('keeps earlier sends that a later send replaced in travelRequests', () => {
    const out = buildActivity({
      log: [
        { type: 'email_sent', at: '2026-10-01T10:00:00Z', memberId: 'b', name: 'Bob', items: ['Flight'] },
        { type: 'email_sent', at: '2026-10-03T10:00:00Z', memberId: 'b', name: 'Bob', items: ['Flight'] },
      ],
      requests: { b: { sentAt: '2026-10-03T10:00:00Z', items: ['flight'] } },
      nameOf,
    });
    expect(out).toHaveLength(2);
  });

  it('is empty with no data', () => {
    expect(buildActivity({})).toEqual([]);
  });
});
