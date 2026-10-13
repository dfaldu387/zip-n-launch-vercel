import { describe, it, expect } from 'vitest';
import { mergeLatestShowData } from './mergeLatestShowData';

describe('mergeLatestShowData', () => {
    it('keeps a booking made while the page was open', () => {
        const latest = { stallingService: { bookings: [{ id: 'b1' }] }, fees: [] };
        const mine = { stallingService: { bookings: [] }, fees: [{ id: 'f1', name: 'Entry', amount: 50 }] };
        const out = mergeLatestShowData(latest, mine);
        expect(out.stallingService.bookings).toEqual([{ id: 'b1' }]);
        expect(out.fees).toEqual([{ id: 'f1', name: 'Entry', amount: 50 }]);
    });

    it('keeps the wizard edits to its own fields', () => {
        const out = mergeLatestShowData(
            { startDate: '2026-07-01', venueName: 'Old' },
            { startDate: '2026-08-01', venueName: 'New' },
        );
        expect(out.startDate).toBe('2026-08-01');
        expect(out.venueName).toBe('New');
    });

    it('takes results, awards and staff schedule from the newest copy', () => {
        const out = mergeLatestShowData(
            { results: { a: 1 }, awardsManagement: { b: 2 }, staffSchedule: { c: 3 } },
            { results: {}, awardsManagement: {}, staffSchedule: {} },
        );
        expect(out.results).toEqual({ a: 1 });
        expect(out.awardsManagement).toEqual({ b: 2 });
        expect(out.staffSchedule).toEqual({ c: 3 });
    });

    it('adds keys that appeared after the page loaded', () => {
        const out = mergeLatestShowData({ brandNew: { x: 1 } }, { startDate: '2026-08-01' });
        expect(out.brandNew).toEqual({ x: 1 });
    });

    it('applies only the module status this save changed', () => {
        const out = mergeLatestShowData(
            { moduleStatuses: { editWizard: 'draft', housing: 'published' } },
            { moduleStatuses: { editWizard: 'in_progress', housing: 'draft' } },
            { snapshotModuleStatuses: { editWizard: 'draft', housing: 'draft' } },
        );
        expect(out.moduleStatuses).toEqual({ editWizard: 'in_progress', housing: 'published' });
    });

    it('does not undo a lock set elsewhere, but allows a deliberate unlock', () => {
        const latest = { isShowLocked: true };
        expect(mergeLatestShowData(latest, { isShowLocked: false }).isShowLocked).toBe(true);
        expect(mergeLatestShowData(latest, { isShowLocked: false }, { isUnlock: true }).isShowLocked).toBe(false);
    });

    it('keeps the wizard fee list and adds new housing fees only', () => {
        const out = mergeLatestShowData(
            { fees: [{ id: 'h1', source: 'housing' }, { id: 'h2', source: 'housing' }, { id: 'm9', name: 'x' }] },
            { fees: [{ id: 'h1', source: 'housing', amount: 99 }, { id: 'm1', name: 'Entry' }] },
        );
        expect(out.fees.map((f) => f.id)).toEqual(['h1', 'm1', 'h2']);
        expect(out.fees[0].amount).toBe(99);
    });

    it('returns the wizard data untouched when there is no latest copy', () => {
        const mine = { a: 1 };
        expect(mergeLatestShowData(null, mine)).toBe(mine);
    });
});
