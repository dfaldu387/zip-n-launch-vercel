import { describe, it, expect } from 'vitest';
import { copyOfficials, cloneStaffMember, countStaff } from '@/lib/copyStaff';

let n = 0;
const makeId = () => `new-${++n}`;

const anna = {
  id: 'old-1',
  name: 'Anna',
  email: 'Anna@Example.com',
  day_fee: '300',
  employment_start_date: '2025-06-19T00:00:00.000Z',
  employment_end_date: '2025-06-22T00:00:00.000Z',
  days_worked: '4',
  hours_worked: '8',
  overtime_hours: '2',
  reimbursable_expenses: {
    hotel: { reimbursed: true, expense_type: 'direct', cost_per_day: '150', days: 4, total: 600, start_date: '2025-06-18', end_date: '2025-06-23' },
    airfare: { reimbursed: true, max_value: '400', start_date: '2025-06-18' },
  },
};

describe('cloneStaffMember', () => {
  it('keeps who they are and their rates, with a new id', () => {
    const c = cloneStaffMember(anna, 'x');
    expect(c).toMatchObject({ id: 'x', name: 'Anna', email: 'Anna@Example.com', day_fee: '300' });
  });

  it('clears the old show\'s dates and worked totals', () => {
    const c = cloneStaffMember(anna, 'x');
    expect(c.employment_start_date).toBeNull();
    expect(c.employment_end_date).toBeNull();
    expect(c.days_worked).toBeNull();
    expect(c.hours_worked).toBeNull();
    expect(c.overtime_hours).toBeNull();
  });

  it('keeps expense switches, type and amounts, but drops dates and per-day totals', () => {
    const h = cloneStaffMember(anna, 'x').reimbursable_expenses;
    expect(h.hotel).toMatchObject({ reimbursed: true, expense_type: 'direct', cost_per_day: '150', days: 0, total: 0 });
    expect(h.hotel.start_date).toBeUndefined();
    expect(h.airfare).toMatchObject({ reimbursed: true, max_value: '400' });
    expect(h.airfare.start_date).toBeUndefined();
  });

  it('does not change the source person', () => {
    cloneStaffMember(anna, 'x');
    expect(anna.employment_start_date).toBe('2025-06-19T00:00:00.000Z');
    expect(anna.reimbursable_expenses.hotel.total).toBe(600);
  });
});

describe('copyOfficials', () => {
  const source = { AQHA: { JUDGE: [anna, { id: 'o2', name: 'Bob', email: '' }] }, NRHA: { JUDGE: [{ id: 'o3', name: 'Cy' }] } };

  it('adds people under the same association and role', () => {
    const r = copyOfficials(source, {}, ['AQHA'], makeId);
    expect(r.added).toBe(2);
    expect(r.officials.AQHA.JUDGE.map((m) => m.name)).toEqual(['Anna', 'Bob']);
  });

  it('skips people from an association the target show does not use, and counts them', () => {
    const r = copyOfficials(source, {}, ['AQHA'], makeId);
    expect(r.skippedAssociation).toBe(1);
    expect(r.officials.NRHA).toBeUndefined();
  });

  it('skips people already in the list (same email, any case) and counts them', () => {
    const target = { AQHA: { JUDGE: [{ id: 't1', name: 'Someone', email: 'anna@example.com' }] } };
    const r = copyOfficials(source, target, ['AQHA'], makeId);
    expect(r.skippedDuplicate).toBe(1);
    expect(r.added).toBe(1);
    expect(r.officials.AQHA.JUDGE.map((m) => m.name)).toEqual(['Someone', 'Bob']);
  });

  it('matches by name when there is no email', () => {
    const target = { AQHA: { JUDGE: [{ id: 't1', name: 'bob', email: '' }] } };
    expect(copyOfficials(source, target, ['AQHA'], makeId).skippedDuplicate).toBe(1);
  });

  it('never changes the target it was given', () => {
    const target = { AQHA: { JUDGE: [] } };
    copyOfficials(source, target, ['AQHA'], makeId);
    expect(target.AQHA.JUDGE).toEqual([]);
  });

  it('counts people', () => {
    expect(countStaff(source)).toBe(3);
    expect(countStaff({})).toBe(0);
  });
});
