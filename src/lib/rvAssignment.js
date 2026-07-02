// Pure helpers for assigning RV / camping SPOTS — the RV parallel of
// stallAssignment.js. RV areas store a quantity (`spotCount`); to place campers
// on a chart we materialize that into individual spots (R1, R2, …), each able to
// carry a `bookingId`. Spot ids are DETERMINISTIC (`${areaId}::spot::${n}`) so an
// assignment survives a reload even before the spots array is persisted.
// All functions are non-mutating.

// Turn an RV area's spotCount into a spots[] array, preserving any bookingId
// already pinned to a spot (matched by its stable number).
export function ensureRvSpots(area) {
    const count = Math.max(0, Number(area?.spotCount) || 0);
    const prior = new Map((area?.spots || []).map(s => [s.number, s.bookingId || null]));
    const spots = Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const number = `R${n}`;
        return { id: `${area.id}::spot::${n}`, number, bookingId: prior.get(number) || null };
    });
    return { ...area, spots };
}

// Materialize spots for every RV area.
export const ensureAllRvSpots = (rvAreas) => (rvAreas || []).map(ensureRvSpots);

// How many RV spots a booking asked for (across all rv line items).
export function getRequestedRvCount(booking) {
    if (!booking?.items) return 0;
    return booking.items.reduce((sum, it) => sum + (it.type === 'rv' ? (Number(it.qty) || 0) : 0), 0);
}

// Spots currently pinned to this booking (expects materialized areas with spots).
export function getAssignedRvSpotsForBooking(booking, rvAreas) {
    if (!booking?.id) return [];
    const result = [];
    for (const area of rvAreas || []) {
        for (const spot of area.spots || []) {
            if (spot.bookingId === booking.id) {
                result.push({ ...spot, areaId: area.id, areaName: area.name });
            }
        }
    }
    return result;
}

// Pin one spot to a booking (or clear with null). Returns NEW rvAreas.
export function assignRvSpotToBooking(rvAreas, spotId, bookingId) {
    return (rvAreas || []).map(area => ({
        ...area,
        spots: (area.spots || []).map(spot =>
            spot.id === spotId ? { ...spot, bookingId: bookingId || null } : spot
        ),
    }));
}

// Clear a single spot.
export const unassignRvSpot = (rvAreas, spotId) => assignRvSpotToBooking(rvAreas, spotId, null);
