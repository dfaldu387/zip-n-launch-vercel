// Pure helpers for assigning RV / camping SPOTS — the RV parallel of
// stallAssignment.js. RV areas store a quantity (`spotCount`); to place campers
// on a chart we materialize that into individual spots (R1, R2, …), each able to
// carry a `bookingId`. Spot ids are DETERMINISTIC (`${areaId}::spot::${n}`) so an
// assignment survives a reload even before the spots array is persisted.
// All functions are non-mutating.

import { sequenceFrom } from '@/lib/numberSequence';

// Turn an RV area's spotCount into a spots[] array, preserving what is already
// pinned to a spot. Spots are matched by their stable id — the visible number can
// be typed over (`customNumber`, e.g. 1001), so it is not a safe key. A spot with
// nothing typed is named R1, R2, … by its position.
export function ensureRvSpots(area) {
    const count = Math.max(0, Number(area?.spotCount) || 0);
    const priorList = area?.spots || [];
    const byId = new Map(priorList.map(s => [s.id, s]));
    // Older saves may not carry the deterministic id; fall back to the default name.
    const byDefaultName = new Map(priorList.filter(s => !s.customNumber).map(s => [s.number, s]));
    const spots = Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const id = `${area.id}::spot::${n}`;
        const prior = byId.get(id) || byDefaultName.get(`R${n}`) || null;
        const typed = String(prior?.customNumber ?? '').trim();
        return {
            ...(prior || {}),
            id,
            number: typed || `R${n}`,
            bookingId: prior?.bookingId || null,
        };
    });
    return { ...area, spots };
}

// ── Custom spot numbers (a facility that labels its own sites, e.g. 1001, 1002) ──
// Each returns a NEW spots[] for the area, ready for onUpdate('spots', …).

// Type one spot's number. Empty text clears it (back to R1, R2…).
export function setRvCustomNumber(area, spotId, value) {
    const typed = String(value ?? '').trim();
    const { spots } = ensureRvSpots(area);
    if (!spots.some(s => s.id === spotId)) return null;
    return ensureRvSpots({
        ...area,
        spots: spots.map(s => {
            if (s.id !== spotId) return s;
            const { customNumber, ...rest } = s;
            return typed ? { ...rest, customNumber: typed } : rest;
        }),
    }).spots;
}

// Number every spot from a start value: "1001" → 1001, 1002…  "A101" → A101, A102…
export function fillRvSequence(area, start) {
    const labelAt = sequenceFrom(start);
    if (!labelAt) return null;
    const { spots } = ensureRvSpots(area);
    return ensureRvSpots({ ...area, spots: spots.map((s, k) => ({ ...s, customNumber: labelAt(k) })) }).spots;
}

// Forget every typed number.
export function clearRvCustomNumbers(area) {
    const { spots } = ensureRvSpots(area);
    return ensureRvSpots({ ...area, spots: spots.map(({ customNumber, ...rest }) => rest) }).spots;
}

// Numbers used by more than one spot (ignoring case).
export function duplicateRvNumbers(spots = []) {
    const seen = new Map();
    for (const s of spots) {
        if (!s.number) continue;
        const key = String(s.number).toLowerCase();
        seen.set(key, (seen.get(key) || 0) + 1);
    }
    return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
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
// Stamps assignedAt (mirrors assignStallToBooking) so the exhibitor's
// reservation page can show when their camp spot was placed; reassigning
// resets the stamp to reflect the current spot, not history.
export function assignRvSpotToBooking(rvAreas, spotId, bookingId) {
    return (rvAreas || []).map(area => ({
        ...area,
        spots: (area.spots || []).map(spot =>
            spot.id === spotId
                ? { ...spot, bookingId: bookingId || null, assignedAt: bookingId ? new Date().toISOString() : null }
                : spot
        ),
    }));
}

// Clear a single spot.
export const unassignRvSpot = (rvAreas, spotId) => assignRvSpotToBooking(rvAreas, spotId, null);

// Batch-apply a set of {spotId, bookingId} placements in one pass — mirrors
// applyPlanToBarns in stallAssignment.js. Used to relocate a whole booking's
// (or group's) RV spots in a single save instead of one assign call per spot.
export function applyPlanToRvAreas(rvAreas, plan) {
    if (!plan?.length) return rvAreas;
    const bySpotId = new Map(plan.map(p => [p.spotId, p.bookingId]));
    const now = new Date().toISOString();
    return (rvAreas || []).map(area => ({
        ...area,
        spots: (area.spots || []).map(spot =>
            bySpotId.has(spot.id)
                ? { ...spot, bookingId: bySpotId.get(spot.id), assignedAt: now }
                : spot
        ),
    }));
}

// Clear EVERY spot pinned to a booking (mirrors unassignBookingStalls in
// stallAssignment.js) — used when a booking is cancelled or deleted, so its
// RV spots go back to available instead of staying stuck "taken" forever.
export function unassignBookingRvSpots(rvAreas, bookingId) {
    return (rvAreas || []).map(area => ({
        ...area,
        spots: (area.spots || []).map(spot =>
            spot.bookingId === bookingId ? { ...spot, bookingId: null, assignedAt: null } : spot
        ),
    }));
}
