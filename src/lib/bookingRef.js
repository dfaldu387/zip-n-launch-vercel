// A booking's staff-facing reference number is its record id, shortened and
// uppercased — the same convention already used for the customer-facing
// confirmation on BookingStatusPage, CheckInPage and order receipt emails.
// Centralized here so every new display (Booking list, Master List, Hay &
// Shavings cards) stays in sync with what the customer was actually shown.
export const getBookingRef = (booking) => String(booking?.id || '').slice(0, 8).toUpperCase();

// Distinguishes a stall/RV booking from a separate at-show hay & shavings
// reorder placed under the same exhibitor name — so two records that share a
// name are still tellable apart by what they actually are.
export const getBookingKind = (booking) =>
    booking?.orderType === 'live-supply' ? 'Hay & Shavings Order' : 'Stall/RV Booking';
