import { describe, it, expect } from 'vitest';
import { mergeBookingsForSave, createSerialQueue } from './showDataWrite';

// These pin down the "don't wipe other people's saves" rules for the Housing
// page: a customer booking or Stripe payment that lands while the office has the
// page open must survive the office's next save.

describe('mergeBookingsForSave', () => {
    it('keeps a booking the page has never seen (customer booked while tab was open)', () => {
        const saved = [{ id: 'a', exhibitorName: 'Ann' }, { id: 'new', exhibitorName: 'Online Customer' }];
        const local = [{ id: 'a', exhibitorName: 'Ann' }];
        const out = mergeBookingsForSave(saved, local);
        expect(out.map(b => b.id)).toEqual(['a', 'new']);
    });

    it('drops a booking that was deleted elsewhere', () => {
        const saved = [{ id: 'a' }];
        const local = [{ id: 'a' }, { id: 'gone' }];
        expect(mergeBookingsForSave(saved, local).map(b => b.id)).toEqual(['a']);
    });

    it('keeps the local edit for ordinary fields', () => {
        const saved = [{ id: 'a', notes: 'old', nights: 3 }];
        const local = [{ id: 'a', notes: 'edited', nights: 4 }];
        const [m] = mergeBookingsForSave(saved, local);
        expect(m.notes).toBe('edited');
        expect(m.nights).toBe(4);
    });

    it('takes payment and status from the saved copy (Stripe paid while page was open)', () => {
        const saved = [{ id: 'a', paymentStatus: 'paid', paidAmount: 300, paidAt: '2026-09-28T10:00:00Z', status: 'confirmed' }];
        const local = [{ id: 'a', paymentStatus: 'unpaid', paidAmount: 0, status: 'pending', notes: 'x' }];
        const [m] = mergeBookingsForSave(saved, local);
        expect(m.paymentStatus).toBe('paid');
        expect(m.paidAmount).toBe(300);
        expect(m.paidAt).toBe('2026-09-28T10:00:00Z');
        expect(m.status).toBe('confirmed');
        expect(m.notes).toBe('x');
    });

    it('keeps a local value when the saved copy has no such field at all', () => {
        const saved = [{ id: 'a' }];
        const local = [{ id: 'a', checkNumber: '1042' }];
        expect(mergeBookingsForSave(saved, local)[0].checkNumber).toBe('1042');
    });

    it('keeps the longer activity log', () => {
        const savedLog = [{ message: 'one' }, { message: 'two' }];
        const localLog = [{ message: 'one' }];
        expect(mergeBookingsForSave([{ id: 'a', activityLog: savedLog }], [{ id: 'a', activityLog: localLog }])[0].activityLog).toBe(savedLog);
        expect(mergeBookingsForSave([{ id: 'a', activityLog: localLog }], [{ id: 'a', activityLog: savedLog }])[0].activityLog).toBe(savedLog);
    });

    it('handles missing lists', () => {
        expect(mergeBookingsForSave(undefined, undefined)).toEqual([]);
        expect(mergeBookingsForSave([{ id: 'a' }], undefined)).toEqual([{ id: 'a' }]);
    });
});

describe('createSerialQueue', () => {
    it('runs jobs one at a time, in order', async () => {
        const enqueue = createSerialQueue();
        const log = [];
        const job = (name, ms) => () => new Promise(res => {
            log.push(`start ${name}`);
            setTimeout(() => { log.push(`end ${name}`); res(name); }, ms);
        });
        const results = await Promise.all([enqueue(job('a', 20)), enqueue(job('b', 1)), enqueue(job('c', 5))]);
        expect(results).toEqual(['a', 'b', 'c']);
        expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    });

    it('a failed job does not block the next one, and only its own caller sees the error', async () => {
        const enqueue = createSerialQueue();
        const bad = enqueue(async () => { throw new Error('boom'); });
        const good = enqueue(async () => 'ok');
        await expect(bad).rejects.toThrow('boom');
        await expect(good).resolves.toBe('ok');
    });
});
