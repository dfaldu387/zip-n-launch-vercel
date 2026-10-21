// Travel Management defaults: what a person's travel entry starts with, and how it follows the
// Officials & Staff page. Kept out of the page so the rules can be tested.

/** Staff dates are saved as full timestamps; date fields need the local day, YYYY-MM-DD. */
export function toDayString(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shift a date by N days. Pure calendar math, so a clock change (daylight saving) can never move it by a day. */
export function shiftDate(dateStr, days) {
  const day = toDayString(dateStr);
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Copy of the project data with one person's expense_type changed; null if that person/expense is not found. */
export function applyExpenseType(projectData, memberId, expenseKey, value) {
  const officials = projectData?.showDetails?.officials;
  if (!officials) return null;
  let found = false;
  const nextOfficials = {};
  for (const [assocId, roles] of Object.entries(officials)) {
    nextOfficials[assocId] = {};
    for (const [roleId, members] of Object.entries(roles || {})) {
      nextOfficials[assocId][roleId] = (members || []).map((m) => {
        if (m.id !== memberId || !m.reimbursable_expenses?.[expenseKey]) return m;
        found = true;
        return {
          ...m,
          reimbursable_expenses: {
            ...m.reimbursable_expenses,
            [expenseKey]: { ...m.reimbursable_expenses[expenseKey], expense_type: value },
          },
        };
      });
    }
  }
  return found ? { ...projectData, showDetails: { ...projectData.showDetails, officials: nextOfficials } } : null;
}

// A date field holds YYYY-MM-DD (or YYYY-MM-DDTHH:MM for date/time fields); anything else is empty.
const isClean = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(x);

/**
 * Fills the date fields of one travel card (flight, hotel, ...) from the Staff dates.
 *  - empty or unreadable field        -> filled
 *  - field still holding what we filled last time (nobody edited it) -> follows a new Staff date,
 *    unless the card's dates are locked
 *  - field someone edited             -> never touched
 * autoPrev / autoNext remember which fields still hold a value we filled ("group.field").
 */
function syncDates(card, wanted, group, autoPrev, autoNext) {
  const out = { ...(card || {}) };
  for (const [field, value] of Object.entries(wanted)) {
    const key = `${group}.${field}`;
    const current = out[field];
    const untouched = isClean(current) && current === autoPrev[key];
    if (!isClean(current) && value) {
      out[field] = value;
      autoNext[key] = value;
    } else if (untouched && value && value !== current && !out.datesLocked) {
      out[field] = value;
      autoNext[key] = value;
    } else if (untouched) {
      autoNext[key] = current;
    }
  }
  return out;
}

/**
 * True when someone typed real details into one travel card (flight, hotel, ...).
 * Dates (filled in by the page or old saved ones), empty lists, an unlocked lock and zero costs do not
 * count, so a person with nothing booked and no budget for that need stays off its tab.
 */
const DATE_FIELDS = new Set([
  'departureTime', 'arrivalTime', 'returnDepartureTime', 'returnArrivalTime',
  'checkIn', 'checkOut', 'pickupTime', 'returnTime', 'startDate', 'endDate',
]);

export function hasEnteredTravel(entry, travelKey) {
  const card = entry?.[travelKey];
  if (!card) return false;
  const auto = entry.autoDates || {};
  return Object.entries(card).some(([field, v]) => {
    if (DATE_FIELDS.has(field)) return false; // dates alone never put someone on a tab
    if (v === '' || v == null || v === 0 || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (auto[`${travelKey}.${field}`] === v) return false;
    return true;
  });
}

/**
 * What Officials & Staff says this person's expense costs: the same number the Travel card is filled
 * from when it first opens. 0 when the item is switched off for them or has no amount.
 * `expenseKey` is the key on reimbursable_expenses (airfare, hotel, rentalCar, mileage).
 */
export function staffBudgetFor(member, expenseKey) {
  const expense = member?.reimbursable_expenses?.[expenseKey];
  if (!expense?.reimbursed) return 0;
  const num = (v) => parseFloat(v) || 0;
  if (expenseKey === 'airfare') return num(expense.max_value);
  if (expenseKey === 'mileage') return num(expense.total);
  return num(expense.total) || num(expense.max_value);
}

/**
 * One travel card (flight, hotel, ...) with everything typed on it removed. When the budget is frozen
 * (locked from the contract) the Budget box is kept so the contract number is never lost.
 */
export function clearTravelCard(card, keepBudget = false) {
  const cost = card?.cost;
  return keepBudget && cost !== undefined && cost !== '' && cost !== null ? { cost } : {};
}

/**
 * Start from the saved travel data and add a default entry for anyone new. Costs a person
 * already has as reimbursable expenses are copied in when the travel entry has none yet, and
 * the dates come over from Officials & Staff. Same rules for a contract project and for a
 * show's staff list.
 */
export function mergeTravelDefaults(flatPersonnel, saved, eventStart, eventEnd) {
  const merged = { ...saved };

  for (const member of flatPersonnel) {
    const expenses = member.reimbursable_expenses || {};
    const airfareExp = expenses.airfare;
    const hotelExp = expenses.hotel;
    const rentalCarExp = expenses.rentalCar;
    const mileageExp = expenses.mileage;

    // Work on a copy so the saved data is never changed in place.
    const entry = { ...(merged[member.id] || {}) };
    if (!merged[member.id]) {
      // New member: dates from the person, else from the event
      const start = airfareExp?.start_date || member.employment_start_date || eventStart;
      const end = airfareExp?.end_date || member.employment_end_date || eventEnd;
      entry.travelStart = start ? shiftDate(start, -1) : '';
      entry.travelEnd = end ? shiftDate(end, 1) : '';
    }

    // Sync expense costs into the travel entry if not already set
    if (!entry.flight?.cost && airfareExp?.reimbursed) {
      entry.flight = { ...entry.flight, cost: parseFloat(airfareExp.max_value) || 0 };
    }
    if (!entry.hotel?.cost && hotelExp?.reimbursed) {
      entry.hotel = { ...entry.hotel, cost: parseFloat(hotelExp.total) || parseFloat(hotelExp.max_value) || 0 };
    }
    if (!entry.rentalCar?.cost && rentalCarExp?.reimbursed) {
      entry.rentalCar = { ...entry.rentalCar, cost: parseFloat(rentalCarExp.total) || parseFloat(rentalCarExp.max_value) || 0 };
    }
    if (!entry.mileage?.cost && mileageExp?.reimbursed) {
      entry.mileage = { ...entry.mileage, cost: parseFloat(mileageExp.total) || 0 };
    }

    // Each expense block on the Staff page has its own dates; use them first, then the person's,
    // then the show's. The budget dates are never changed from here.
    const personStart = member.employment_start_date || eventStart;
    const personEnd = member.employment_end_date || eventEnd;
    const startOf = (exp) => toDayString(exp?.start_date || personStart);
    const endOf = (exp) => toDayString(exp?.end_date || personEnd);
    const at = (d, time = '12:00') => (d ? `${d}T${time}` : '');

    const autoPrev = entry.autoDates || {};
    const autoNext = {};
    const flightStart = startOf(airfareExp);
    entry.flight = syncDates(entry.flight, {
      departureTime: at(flightStart ? shiftDate(flightStart, -1) : ''),
      arrivalTime: at(flightStart),
      returnDepartureTime: at(endOf(airfareExp)),
    }, 'flight', autoPrev, autoNext);
    entry.hotel = syncDates(entry.hotel, { checkIn: startOf(hotelExp), checkOut: endOf(hotelExp) }, 'hotel', autoPrev, autoNext);
    entry.rentalCar = syncDates(entry.rentalCar, {
      pickupTime: at(startOf(rentalCarExp)),
      returnTime: at(endOf(rentalCarExp)),
    }, 'rentalCar', autoPrev, autoNext);
    entry.mileage = syncDates(entry.mileage, { startDate: startOf(mileageExp), endDate: endOf(mileageExp) }, 'mileage', autoPrev, autoNext);
    entry.autoDates = autoNext;

    merged[member.id] = entry;
  }

  return merged;
}
