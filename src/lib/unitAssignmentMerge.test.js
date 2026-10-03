import { describe, it, expect } from 'vitest';
import { diffUnitAssignments, applyUnitChanges, overlayAssignments } from './unitAssignmentMerge';

const barns = (...holders) => [{
    id: 'b1', name: 'Barn A',
    stalls: holders.map((h, i) => ({ id: `s${i + 1}`, number: String(i + 1), type: 'stall', bookingId: h, assignedAt: h ? 't0' : null })),
}];

describe('diffUnitAssignments', () => {
    it('lists only the stalls whose holder changed', () => {
        const prev = barns(null, 'X', null);
        const next = barns('Y', 'X', null);
        const d = diffUnitAssignments(prev, next, 'stalls');
        expect(d.assignmentOnly).toBe(true);
        expect(d.changes).toEqual([{ id: 's1', from: null, to: 'Y', hasAssignedAt: true, assignedAt: 't0' }]);
    });

    it('treats a renamed barn as structural', () => {
        const prev = barns(null);
        const next = [{ ...prev[0], name: 'Barn Z' }];
        expect(diffUnitAssignments(prev, next, 'stalls').assignmentOnly).toBe(false);
    });

    it('treats an added stall as structural', () => {
        const prev = barns(null);
        const next = barns(null, null);
        expect(diffUnitAssignments(prev, next, 'stalls').assignmentOnly).toBe(false);
    });

    it('treats a renamed stall number as structural', () => {
        const prev = barns(null);
        const next = [{ ...prev[0], stalls: [{ ...prev[0].stalls[0], number: '99' }] }];
        expect(diffUnitAssignments(prev, next, 'stalls').assignmentOnly).toBe(false);
    });

    it('works for RV spots', () => {
        const prev = [{ id: 'a', spots: [{ id: 'r1', number: 'R1', bookingId: null }] }];
        const next = [{ id: 'a', spots: [{ id: 'r1', number: 'R1', bookingId: 'X' }] }];
        const d = diffUnitAssignments(prev, next, 'spots');
        expect(d.assignmentOnly).toBe(true);
        expect(d.changes[0]).toMatchObject({ id: 'r1', from: null, to: 'X' });
    });
});

describe('applyUnitChanges', () => {
    it('applies a change on top of the newest saved copy, keeping other tabs\' work', () => {
        // Tab B loaded with everything free, but tab A has since put X on s2.
        const latest = barns(null, 'X', null);
        const changes = [{ id: 's1', from: null, to: 'Y', hasAssignedAt: true, assignedAt: 't1' }];
        const r = applyUnitChanges(latest, changes, 'stalls');
        expect(r.conflicts).toEqual([]);
        expect(r.groups[0].stalls.map(s => s.bookingId)).toEqual(['Y', 'X', null]);
        expect(r.groups[0].stalls[0].assignedAt).toBe('t1');
    });

    it('refuses when someone else already took the stall', () => {
        const latest = barns('Smith', null);
        const changes = [{ id: 's1', from: null, to: 'Jones', hasAssignedAt: true, assignedAt: 't1' }];
        const r = applyUnitChanges(latest, changes, 'stalls');
        expect(r.conflicts).toEqual([{ id: 's1', reason: 'changed', current: 'Smith' }]);
        expect(r.groups).toBe(latest);
    });

    it('is all-or-nothing: one conflict blocks the whole batch', () => {
        const latest = barns('Smith', null);
        const changes = [
            { id: 's1', from: null, to: 'Jones' },
            { id: 's2', from: null, to: 'Jones' },
        ];
        const r = applyUnitChanges(latest, changes, 'stalls');
        expect(r.conflicts).toHaveLength(1);
        expect(r.groups[0].stalls[1].bookingId).toBe(null);
    });

    it('allows a deliberate take-over when the holder is still who this tab saw', () => {
        const latest = barns('Smith');
        const r = applyUnitChanges(latest, [{ id: 's1', from: 'Smith', to: 'Jones' }], 'stalls');
        expect(r.conflicts).toEqual([]);
        expect(r.groups[0].stalls[0].bookingId).toBe('Jones');
    });

    it('treats an already-saved identical change as done', () => {
        const latest = barns('Jones');
        const r = applyUnitChanges(latest, [{ id: 's1', from: null, to: 'Jones' }], 'stalls');
        expect(r.conflicts).toEqual([]);
    });

    it('reports a stall that no longer exists', () => {
        const r = applyUnitChanges(barns(null), [{ id: 'gone', from: null, to: 'X' }], 'stalls');
        expect(r.conflicts).toEqual([{ id: 'gone', reason: 'missing' }]);
    });
});

describe('overlayAssignments', () => {
    it('keeps this tab\'s own layout but shows who holds what from the saved copy', () => {
        const local = [{ id: 'b1', name: 'Renamed locally', stalls: [
            { id: 's1', number: '1', bookingId: 'Y' },
            { id: 's2', number: '2', bookingId: null },
        ] }];
        const merged = barns('Y', 'X');
        const out = overlayAssignments(local, merged, 'stalls');
        expect(out[0].name).toBe('Renamed locally');
        expect(out[0].stalls.map(s => s.bookingId)).toEqual(['Y', 'X']);
    });
});
