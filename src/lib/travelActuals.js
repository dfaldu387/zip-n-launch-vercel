// Budget vs Actual figures for the four travel types. The Flights, Hotels, Rental Cars and
// Mileage tabs and the Travel Overview all read these, so every screen shows the same numbers.
//
//   budget   = the number already on the card (kept in .cost), it never changes here
//   actual   = what was really spent, or null while nothing has been entered yet
//   variance = actual - budget (positive = over budget), null while actual is null

const num = (v) => parseFloat(v) || 0;
const hasValue = (v) => v !== undefined && v !== null && v !== '';
const cents = (n) => Math.round(n * 100) / 100;

const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d);
const dayMs = (d) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);

// Whole nights between two YYYY-MM-DD dates (check-out minus check-in); 0 if either is missing.
export const nightsBetween = (checkIn, checkOut) => {
  if (!isDay(checkIn) || !isDay(checkOut)) return 0;
  const days = Math.round((dayMs(checkOut) - dayMs(checkIn)) / 86400000);
  return days > 0 ? days : 0;
};

// Whole days between two YYYY-MM-DDTHH:MM values, by calendar date; a same-day return counts as 1.
export const rentalDays = (pickup, ret) => {
  if (!isDay(pickup) || !isDay(ret)) return 0;
  const a = dayMs(pickup);
  const b = dayMs(ret);
  if (b < a) return 0;
  return Math.max(1, Math.round((b - a) / 86400000));
};

const finish = (budget, actual, extra = {}) => ({
  budget,
  actual,
  variance: actual === null ? null : cents(actual - budget),
  ...extra,
});

// A typed total wins; otherwise rate x quantity once a rate is typed; otherwise nothing yet.
const actualFrom = (typedTotal, rate, quantity) => {
  const hasOverride = hasValue(typedTotal);
  if (hasOverride) return { hasOverride, actual: cents(num(typedTotal)) };
  const r = parseFloat(rate);
  return { hasOverride, actual: r > 0 && quantity > 0 ? cents(r * quantity) : null };
};

export const flightFigures = (flight = {}) =>
  finish(num(flight.cost), hasValue(flight.actualCost) ? cents(num(flight.actualCost)) : null);

export const hotelFigures = (hotel = {}) => {
  const nights = nightsBetween(hotel.checkIn, hotel.checkOut);
  const budget = num(hotel.cost);
  const { hasOverride, actual } = actualFrom(hotel.actualCost, hotel.actualRate, nights);
  return finish(budget, actual, { nights, hasOverride, budgetRate: nights > 0 ? budget / nights : null });
};

export const rentalFigures = (rental = {}) => {
  const days = rentalDays(rental.pickupTime, rental.returnTime);
  const budget = num(rental.cost);
  const { hasOverride, actual } = actualFrom(rental.actualCost, rental.actualRate, days);
  return finish(budget, actual, { days, hasOverride, budgetRate: days > 0 ? budget / days : null });
};

export const mileageFigures = (mileage = {}) => {
  const miles = num(mileage.miles);
  const budget = num(mileage.cost);
  const { hasOverride, actual } = actualFrom(mileage.actualCost, mileage.actualRate, miles);
  return finish(budget, actual, { hasOverride });
};

// Adds up lines for one row of the Overview. `lines` are { budget, actual } where actual may
// be null. Variance only compares lines that have an actual, each against its own budget, so a
// line with no actual yet is never counted as a saving.
export const summarizeLines = (lines) => {
  let budget = 0;
  let actual = 0;
  let variance = 0;
  let counted = 0;
  let total = 0;
  for (const line of lines) {
    if (!(line.budget > 0) && line.actual === null) continue; // nothing on this line at all
    total += 1;
    budget += line.budget;
    if (line.actual !== null) {
      counted += 1;
      actual += line.actual;
      variance += line.actual - line.budget;
    }
  }
  return {
    budget: cents(budget),
    actual: counted > 0 ? cents(actual) : null,
    variance: counted > 0 ? cents(variance) : null,
    counted,
    total,
  };
};

// First and last day of a person's trip, read from every date on their travel cards (flight out
// and back, hotel, rental car, mileage). null when no card has a date yet.
export const travelSpan = (entry = {}) => {
  const days = [
    entry.flight?.departureTime,
    entry.flight?.arrivalTime,
    entry.flight?.returnDepartureTime,
    entry.flight?.returnArrivalTime,
    entry.hotel?.checkIn,
    entry.hotel?.checkOut,
    entry.rentalCar?.pickupTime,
    entry.rentalCar?.returnTime,
    entry.mileage?.startDate,
    entry.mileage?.endDate,
  ]
    .filter(isDay)
    .map((d) => d.slice(0, 10))
    .sort();
  return days.length ? { start: days[0], end: days[days.length - 1] } : null;
};
