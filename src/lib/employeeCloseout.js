// Employee Closeout: one person's Budget row next to their Actual row.
//
//   Budget = the show's staff budget (Officials & Staff), never changed here.
//   Actual = travel actuals pulled from Travel Management, plus Day Pay, Overtime and Other
//            typed in at closeout. A cell stays empty (null) until a real number exists.

import { calculateStaffCost } from '@/lib/contractUtils';
import { flightFigures, hotelFigures, rentalFigures, mileageFigures, summarizeLines } from '@/lib/travelActuals';

const TRAVEL_KEYS = ['airfare', 'hotel', 'rentalCar', 'mileage'];

const typedNumber = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

// What the budget says for one expense, whether the show or the staff member pays it.
const budgetFor = (fin, key) => (fin.expenseBreakdown[key] || 0) + (fin.directBreakdown[key] || 0);

// A travel budget is the Budget box on the Travel card (the same number the Travel Overview
// shows). When that card has none, it falls back to the Officials & Staff expense amount.
const travelBudget = (entry, fin, key) => parseFloat(entry?.cost) || budgetFor(fin, key);

/**
 * The columns of one person's closeout.
 * `typed` is that person's saved closeout entry: { dayPay, overtime, other } (strings or numbers).
 * `travel` is that person's entry from the show's travelData.
 * Each cell is { key, label, budget, actual, typedField }. typedField is set for the cells
 * the user types into; the others come from Travel.
 */
export const buildCloseoutCells = (member, travel = {}, typed = {}) => {
  const fin = calculateStaffCost(member);
  const otherBudget = [...new Set([...Object.keys(fin.expenseBreakdown), ...Object.keys(fin.directBreakdown)])]
    .filter((k) => !TRAVEL_KEYS.includes(k))
    .reduce((sum, k) => sum + budgetFor(fin, k), 0);

  return [
    { key: 'dayPay', label: 'Day Pay', budget: fin.dayPay + fin.hourlyPay, actual: typedNumber(typed.dayPay), typedField: 'dayPay' },
    { key: 'overtime', label: 'Overtime', budget: fin.overtimePay, actual: typedNumber(typed.overtime), typedField: 'overtime' },
    { key: 'flight', label: 'Flight', budget: travelBudget(travel.flight, fin, 'airfare'), actual: flightFigures(travel.flight).actual },
    { key: 'hotel', label: 'Hotel', budget: travelBudget(travel.hotel, fin, 'hotel'), actual: hotelFigures(travel.hotel).actual },
    { key: 'rentalCar', label: 'Rental Car', budget: travelBudget(travel.rentalCar, fin, 'rentalCar'), actual: rentalFigures(travel.rentalCar).actual },
    { key: 'mileage', label: 'Mileage', budget: travelBudget(travel.mileage, fin, 'mileage'), actual: mileageFigures(travel.mileage).actual },
    { key: 'other', label: 'Other', budget: otherBudget, actual: typedNumber(typed.other), typedField: 'other' },
  ];
};

// Per-person and whole-show totals, using the same "only lines with an actual" rule as Travel.
export const summarizeCloseout = (people, travelData = {}, closeout = {}) => {
  const perPerson = people.map((member) => {
    const cells = buildCloseoutCells(member, travelData[member.id] || {}, closeout[member.id] || {});
    return { member, cells, total: summarizeLines(cells) };
  });
  const total = summarizeLines(perPerson.flatMap((p) => p.cells));
  return { perPerson, total };
};
