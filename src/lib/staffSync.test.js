import { describe, it, expect } from 'vitest';
import { syncOfficialsFromShow } from '@/lib/contractUtils';
import { qtyForDate, withQtyForDate, peakQty } from '@/lib/staffQty';

const show = (members) => ({ showDetails: { officials: { AHA: { SHOW_MANAGER: members } } } });

describe('syncOfficialsFromShow', () => {
  it('copies fee, dates and expense toggles from the show onto the contract person', () => {
    const contract = { AHA: { SHOW_MANAGER: [{ id: 'c1', name: 'Anna', day_fee: null, reimbursable_expenses: {}, notes: 'keep' }] } };
    const out = syncOfficialsFromShow(contract, show([
      { id: 's1', name: 'Anna', day_fee: '75', employment_start_date: '2026-10-23',
        reimbursable_expenses: { airfare: { reimbursed: true, max_value: '300' } } },
    ]));
    const p = out.AHA.SHOW_MANAGER[0];
    expect(p.id).toBe('c1');
    expect(p.source_id).toBe('s1');
    expect(p.day_fee).toBe('75');
    expect(p.reimbursable_expenses.airfare.reimbursed).toBe(true);
    expect(p.notes).toBe('keep');
  });

  it('adds people who are new on the show and keeps contract-only people', () => {
    const contract = { AHA: { SHOW_MANAGER: [{ id: 'c9', name: 'Only Contract' }] } };
    const out = syncOfficialsFromShow(contract, show([{ id: 's2', name: 'New Person', day_fee: '10' }]));
    expect(out.AHA.SHOW_MANAGER.map((m) => m.name)).toEqual(['Only Contract', 'New Person']);
  });

  it('carries the lock and lets an unlock overwrite it', () => {
    const locked = syncOfficialsFromShow({ AHA: { SHOW_MANAGER: [{ id: 'c1', name: 'Anna' }] } }, show([{ id: 's1', name: 'Anna', locked: true }]));
    expect(locked.AHA.SHOW_MANAGER[0].locked).toBe(true);
    const unlocked = syncOfficialsFromShow(locked, show([{ id: 's1', name: 'Anna', locked: false }]));
    expect(unlocked.AHA.SHOW_MANAGER[0].locked).toBe(false);
  });

  it('leaves the contract alone when the show has no staff', () => {
    const contract = { AHA: { SHOW_MANAGER: [{ id: 'c1', name: 'Anna', day_fee: '5' }] } };
    expect(syncOfficialsFromShow(contract, {})).toEqual(contract);
  });
});

describe('per-day staff quantity', () => {
  const pos = { id: 'p', qty: 2 };
  it('uses the base qty unless a day is overridden', () => {
    const next = withQtyForDate(pos, '2026-06-20', 1);
    expect(qtyForDate(next, '2026-06-19')).toBe(2);
    expect(qtyForDate(next, '2026-06-20')).toBe(1);
  });
  it('treats an explicit 0 as no slot and a missing qty as 1', () => {
    expect(qtyForDate({ qty: 0 }, 'd')).toBe(0);
    expect(qtyForDate({}, 'd')).toBe(1);
  });
  it('clears an override that matches the base qty', () => {
    const next = withQtyForDate(withQtyForDate(pos, 'd', 1), 'd', 2);
    expect(next.qtyByDate).toBeUndefined();
  });
  it('reports the busiest day as the peak', () => {
    const next = withQtyForDate(pos, 'b', 5);
    expect(peakQty(next, ['a', 'b'])).toBe(5);
  });
});
