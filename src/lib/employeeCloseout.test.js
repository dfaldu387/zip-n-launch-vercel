import { describe, it, expect } from 'vitest';
import { buildCloseoutCells, summarizeCloseout, summarizeTravel } from '@/lib/employeeCloseout';

// 2 days x $75 = $150 day pay; 3 overtime hours x $5 = $15; airfare $300 paid by the show,
// hotel $200 reimbursed, tolls $40 reimbursed (an "other" expense).
const member = {
  id: 'm1',
  name: 'Test Manager 2',
  employment_start_date: '2026-10-23',
  employment_end_date: '2026-10-24',
  day_fee: '75',
  overtime_hours: '3',
  overtime_rate_per_hour: '5',
  reimbursable_expenses: {
    airfare: { reimbursed: true, max_value: '300', expense_type: 'direct' },
    hotel: { reimbursed: true, total: 200 },
    tolls: { reimbursed: true, max_value: '40' },
  },
};

const cell = (cells, key) => cells.find((c) => c.key === key);

describe('buildCloseoutCells', () => {
  it('takes the budget from the staff budget, whoever pays', () => {
    const cells = buildCloseoutCells(member);
    expect(cell(cells, 'dayPay').budget).toBe(150);
    expect(cell(cells, 'overtime').budget).toBe(15);
    expect(cell(cells, 'flight').budget).toBe(300); // direct expense still counts
    expect(cell(cells, 'hotel').budget).toBe(200);
    expect(cell(cells, 'rentalCar').budget).toBe(0);
    expect(cell(cells, 'other').budget).toBe(40);
  });

  it('uses the budget typed on the Travel card, the same one Travel shows', () => {
    // rental car is not switched on in staff, but Travel has a budget for it
    const travel = { rentalCar: { cost: '79', actualCost: '85' }, flight: { cost: '400' } };
    const cells = buildCloseoutCells(member, travel);
    expect(cell(cells, 'rentalCar').budget).toBe(79);
    expect(cell(cells, 'flight').budget).toBe(400); // Travel's 400 wins over staff's 300
    expect(cell(cells, 'hotel').budget).toBe(200); // no Travel budget -> staff amount
  });

  it('has no actuals until something is entered', () => {
    const cells = buildCloseoutCells(member);
    expect(cells.every((c) => c.actual === null)).toBe(true);
  });

  it('pulls travel actuals from Travel and typed ones from the closeout entry', () => {
    const travel = { flight: { cost: '300', actualCost: '325' }, hotel: { cost: '200', actualCost: '180' } };
    const cells = buildCloseoutCells(member, travel, { dayPay: '150', overtime: '20' });
    expect(cell(cells, 'flight').actual).toBe(325);
    expect(cell(cells, 'hotel').actual).toBe(180);
    expect(cell(cells, 'dayPay').actual).toBe(150);
    expect(cell(cells, 'overtime').actual).toBe(20);
    expect(cell(cells, 'other').actual).toBeNull();
  });

  it('treats an empty typed box as not entered', () => {
    expect(cell(buildCloseoutCells(member, {}, { dayPay: '' }), 'dayPay').actual).toBeNull();
  });
});

describe('summarizeCloseout', () => {
  it('only compares cells that have an actual', () => {
    const travel = { m1: { flight: { cost: '300', actualCost: '325' } } };
    const { perPerson, total } = summarizeCloseout([member], travel, { m1: { overtime: '20' } });
    // budgets: 150 + 15 + 300 + 200 + 40 = 705
    expect(perPerson[0].total.budget).toBe(705);
    // actuals entered: flight 325 (+25) and overtime 20 (+5)
    expect(perPerson[0].total.actual).toBe(345);
    expect(perPerson[0].total.variance).toBe(30);
    expect(perPerson[0].total.counted).toBe(2);
    expect(total.variance).toBe(30);
  });

  it('adds up several people', () => {
    const other = { ...member, id: 'm2' };
    const { total } = summarizeCloseout([member, other], {}, { m1: { dayPay: '100' }, m2: { dayPay: '200' } });
    expect(total.actual).toBe(300);
    expect(total.variance).toBe(-50 + 50); // 100-150 and 200-150
  });
});

describe('summarizeTravel', () => {
  it('adds up travel budget and travel actuals only (no day pay or overtime)', () => {
    const t = summarizeTravel([member], { m1: { hotel: { cost: '200', actualCost: '180' } } });
    expect(t.actual).toBe(180);
    expect(t.budget).toBeGreaterThanOrEqual(200);
  });
  it('has no actual until something is typed on a Travel tab', () => {
    expect(summarizeTravel([member], {}).actual).toBeNull();
  });
});
