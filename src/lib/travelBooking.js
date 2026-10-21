// "Who still needs booking?": for each person, the travel items they need (the item is switched on in
// Officials & Staff, or details were already typed) that are not booked yet. The "needs it" rule is the
// same one that decides who is listed on each Travel tab, and "booked" is the same one the tabs use
// for their Booked / Not set filter, so this list always agrees with them.

import { hasEnteredTravel } from '@/lib/travelDefaults';
import { flightFigures, hotelFigures, rentalFigures, mileageFigures } from '@/lib/travelActuals';

export const TRAVEL_ITEMS = [
  { type: 'flight', label: 'Flight', tab: 'flights', expenseKey: 'airfare', booked: (e) => e.airline || e.flightNumber },
  { type: 'hotel', label: 'Hotel', tab: 'hotels', expenseKey: 'hotel', booked: (e) => e.hotelName || e.confirmation },
  { type: 'rentalCar', label: 'Rental Car', tab: 'rental-cars', expenseKey: 'rentalCar', booked: (e) => e.company || e.confirmation },
  { type: 'mileage', label: 'Mileage', tab: 'mileage', expenseKey: 'mileage', booked: (e) => e.miles || e.origin },
];

/** [{ member, items: [{ type, label, tab }] }] for people with at least one item still to book. */
export function stillToBook(personnel, travelData = {}) {
  const out = [];
  for (const member of personnel || []) {
    const entry = travelData[member.id] || {};
    const items = [];
    for (const item of TRAVEL_ITEMS) {
      const needed = !!member.reimbursable_expenses?.[item.expenseKey]?.reimbursed || hasEnteredTravel(entry, item.type);
      if (needed && !item.booked(entry[item.type] || {})) items.push({ type: item.type, label: item.label, tab: item.tab });
    }
    if (items.length > 0) out.push({ member, items });
  }
  return out;
}

// ── Receipt checklist ──
// An item has an actual amount typed but no receipt attached. Uses the same actual figures as the
// Travel tabs and the Overview, so a line with no actual yet never shows up here.

const ACTUAL_OF = {
  flight: flightFigures,
  hotel: hotelFigures,
  rentalCar: rentalFigures,
  mileage: mileageFigures,
};

/** [{ member, items: [{ type, label, tab, actual }] }] for people with an actual but no receipt. */
export function missingReceipts(personnel, travelData = {}) {
  const out = [];
  for (const member of personnel || []) {
    const entry = travelData[member.id] || {};
    const items = [];
    for (const item of TRAVEL_ITEMS) {
      const card = entry[item.type] || {};
      const actual = ACTUAL_OF[item.type](card).actual;
      const hasReceipt = Array.isArray(card.receipts) && card.receipts.length > 0;
      if (actual !== null && actual > 0 && !hasReceipt) items.push({ type: item.type, label: item.label, tab: item.tab, actual });
    }
    if (items.length > 0) out.push({ member, items });
  }
  return out;
}
