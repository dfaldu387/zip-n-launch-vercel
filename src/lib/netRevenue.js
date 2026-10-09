// What the show actually keeps from an online payment, after fees.
// Pure math, shared by the Housing manager's calculator, summary and analytics
// so every screen shows the same number.
//
//   Customer pays the fee -> only EquiPatterns' 5% comes off (the customer
//                            carries Stripe's cut on top at checkout).
//   Show absorbs the fee  -> 5% + Stripe's 2.9% + $0.30 per transaction.
//
// The $0.30 is charged once per BOOKING (one card payment), not once per stall,
// so small bookings lose a bigger share than big ones.

export const PLATFORM_PCT = 0.05;
export const STRIPE_PCT = 0.029;
export const STRIPE_FLAT = 0.30;

// A price for a label, without the "$": whole dollars stay clean ("2"), anything
// with cents keeps both digits ("1.75") — never rounded to a different price.
export function moneyNum(n) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

const round2 =(n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {number} gross    Listed total of the payment(s), before any fee
 * @param {number} bookings How many separate card payments make up `gross`
 * @param {string} mode     'customer' or 'show' (anything else = 'show')
 * @param {boolean} includeFlat false = skip the $0.30 (for items that ride on a
 *                          payment already counted, e.g. hay bought with the stalls)
 * @returns {{ gross, platformFee, stripeFee, totalFees, net }}
 */
export function netAfterFees(gross, bookings = 1, mode = 'show', includeFlat = true) {
    const g = Math.max(Number(gross) || 0, 0);
    if (g === 0) return { gross: 0, platformFee: 0, stripeFee: 0, totalFees: 0, net: 0 };

    const platformFee = round2(g * PLATFORM_PCT);
    const stripeFee = mode === 'customer'
        ? 0
        : round2(g * STRIPE_PCT + (includeFlat ? STRIPE_FLAT * Math.max(Number(bookings) || 0, 1) : 0));
    const totalFees = round2(platformFee + stripeFee);
    return { gross: round2(g), platformFee, stripeFee, totalFees, net: round2(g - totalFees) };
}

// Planning estimate (calculator, Max Revenue/Profit): a simple flat rate, not the
// per-booking math above. Customer pays -> 5%. Show absorbs -> about 8%
// (5% + Stripe's ~2.9% + the $0.30 spread out), nearly the same at any booking size.
// Real bookings still use netAfterFees for exact, to-the-penny numbers.
export const ESTIMATE_CUSTOMER_PCT = 0.05;
export const ESTIMATE_SHOW_PCT = 0.08;

export function estimateNetAfterFees(gross, mode = 'show') {
    const g = Math.max(Number(gross) || 0, 0);
    const pct = mode === 'customer' ? ESTIMATE_CUSTOMER_PCT : ESTIMATE_SHOW_PCT;
    const totalFees = round2(g * pct);
    return { gross: round2(g), totalFees, net: round2(g - totalFees) };
}

/**
 * What-If helper: how many card payments does "units sold" turn into?
 * Rounds up (11 stalls at 5 per booking = 3 payments); never below 1 if any sold.
 */
export function estimateBookingCount(unitsSold, unitsPerBooking = 5) {
    const sold = Math.max(Number(unitsSold) || 0, 0);
    if (sold === 0) return 0;
    return Math.max(Math.ceil(sold / Math.max(Number(unitsPerBooking) || 1, 1)), 1);
}
