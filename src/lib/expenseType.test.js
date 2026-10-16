import { describe, it, expect } from 'vitest';
import { calculateStaffCost, calculateMemberFinancials, isDirectExpense } from '@/lib/contractUtils';

const member = (expenses) => ({
  employment_start_date: '2026-10-23',
  employment_end_date: '2026-10-24',
  day_fee: '75',
  reimbursable_expenses: expenses,
});

describe('isDirectExpense', () => {
  it('is true only for expense_type "direct"', () => {
    expect(isDirectExpense({ expense_type: 'direct' })).toBe(true);
    expect(isDirectExpense({ expense_type: 'reimbursement' })).toBe(false);
    expect(isDirectExpense({ reimbursed: true })).toBe(false); // old data with no type
    expect(isDirectExpense(undefined)).toBe(false);
  });
});

describe('expense type split', () => {
  const m = member({
    airfare: { reimbursed: true, max_value: '300', expense_type: 'direct' },
    tolls: { reimbursed: true, max_value: '50' },
    hotel: { reimbursed: true, total: 200, expense_type: 'direct' },
    baggage: { reimbursed: false, max_value: '40' },
  });

  it('calculateStaffCost keeps direct expenses out of what the person receives', () => {
    const fin = calculateStaffCost(m);
    expect(fin.totalPay).toBe(150);
    expect(fin.totalExpenses).toBe(50);
    expect(fin.directExpenses).toBe(500);
    expect(fin.totalCompensation).toBe(200);
    expect(fin.totalShowCost).toBe(700);
    expect(fin.directBreakdown).toEqual({ airfare: 300, hotel: 200 });
    expect(fin.expenseBreakdown).toEqual({ tolls: 50 });
  });

  it('calculateMemberFinancials leaves direct expenses out of the contract total', () => {
    const fin = calculateMemberFinancials(m);
    expect(fin.totalExpenses).toBe(50);
    expect(fin.directExpenses).toBe(500);
    expect(fin.totalCompensation).toBe(200);
  });

  it('treats expenses with no type as reimbursements', () => {
    const fin = calculateStaffCost(member({ airfare: { reimbursed: true, max_value: '300' } }));
    expect(fin.totalExpenses).toBe(300);
    expect(fin.directExpenses).toBe(0);
    expect(fin.totalShowCost).toBe(fin.totalCompensation);
  });
});
