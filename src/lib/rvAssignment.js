// Pure helpers for assigning RV / camping SPOTS — the RV parallel of
// stallAssignment.js. RV areas store a quantity (`spotCount`); to place campers
// on a chart we materialize that into individual spots (R1, R2, …), each able to
// carry a `bookingId`. Spot ids are DETERMINISTIC (`${areaId}::spot::${n}`) so an
// assignment survives a reload even before the spots array is persisted.
// All functions are non-mutating.

import { sequenceFrom } from '@/lib/numberSequence';

// Turn an RV area's grid into a spots[] array, preserving what is already
// pinned to a spot. Spots are matched by their stable id — the visible number can
// be typed over (`customNumber`, e.g. 1001), so it is not a safe key. A spot with
// nothing typed is named R1, R2, … by its position.
// The grid size is `layoutCells` once the area has one (Robert 11-03: the camping type
// counts must not resize the grid). Older areas have none yet, so they follow spotCount.
export function ensureRvSpots(area) {
    const hasGrid = area?.layoutCells !== undefined && area?.layoutCells !== null && area?.layoutCells !== '';
    const count = Math.max(0, Number(hasGrid ? area.layoutCells : area?.spotCount) || 0);
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
// Roadway / Empty / Blocked spots are skipped, so the real spots count up with no gaps.
export function fillRvSequence(area, start) {
    const labelAt = sequenceFrom(start);
    if (!labelAt) return null;
    const { spots } = ensureRvSpots(area);
    let k = 0;
    return ensureRvSpots({ ...area, spots: spots.map(s => (s.type ? s : { ...s, customNumber: labelAt(k++) })) }).spots;
}

// Forget every typed number.
export function clearRvCustomNumbers(area) {
    const { spots } = ensureRvSpots(area);
    return ensureRvSpots({ ...area, spots: spots.map(({ customNumber, ...rest }) => rest) }).spots;
}

// Mark a spot 'empty' or 'blocked' (or back to a normal spot with null). The
// stalling board already skips any unit whose type is not 'stall', so such a spot
// can never be given to a booking. A booked spot is refused (returns null) — move
// the exhibitor first. Same idea as the barn layout's Empty / Blocked boxes.
export function setRvSpotType(area, spotId, type) {
    const { spots } = ensureRvSpots(area);
    const spot = spots.find(s => s.id === spotId);
    if (!spot || spot.bookingId) return null;
    return spots.map(s => {
        if (s.id !== spotId) return s;
        const { type: _drop, ...rest } = s;
        // Empty / Blocked / Roadway spots are not sellable, so they leave their camping type —
        // and the 30A / 50A that the paint gave them (otherwise it shows on a spot with no type).
        if (type === 'empty' || type === 'blocked' || type === 'roadway') {
            const { campingTypeId: _ct, ...noType } = rest;
            if (!s.campingTypeId) return { ...noType, type };
            const { amps: _a, ...clean } = noType;
            return { ...clean, type };
        }
        return rest;
    });
}

// Power rating (amps) for one spot. Allowed even when booked - it describes the site, not the layout.
export function setRvSpotAmps(area, spotId, amps) {
    const { spots } = ensureRvSpots(area);
    if (!spots.some(s => s.id === spotId)) return null;
    return spots.map(s => {
        if (s.id !== spotId) return s;
        const { amps: _drop, ...rest } = s;
        return amps ? { ...rest, amps: String(amps) } : rest;
    });
}

// Copy the LAYOUT of one RV area onto another: spots per row, roadways, which spots are
// Empty / Blocked, and each spot's amps - matched by position (1st spot to 1st spot).
// Spot numbers and bookings on the target are left alone; a booked spot is never
// turned into Empty / Blocked.
export function copyRvLayout(source, target) {
    const from = ensureRvSpots(source).spots;
    const spots = ensureRvSpots(target).spots.map((spot, i) => {
        const src = from[i];
        const { type: _t, amps: _a, ...rest } = spot;
        const out = { ...rest };
        if (spot.bookingId) { if (spot.type) out.type = spot.type; }
        else if (src?.type) out.type = src.type;
        if (src?.amps) out.amps = src.amps;
        return out;
    });
    return {
        layoutPerRow: Number(source.layoutPerRow) > 0 ? Number(source.layoutPerRow) : undefined,
        layoutRoadsAfter: [...(source.layoutRoadsAfter || [])],
        spots,
    };
}

// Spots that can really be sold: every grid spot except Roadway, Empty and Blocked ones.
// This is the area's total (header badge, booking cap, public chart) — not the typed type counts.
export const sellableRvSpotCount = (spots = []) => spots.filter(s => !s.type).length;

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

// ── Grid growth (Robert 11-02: add rows / add columns, like the stalling chart) ──
// Both return { spots, perRow } for the caller to save. Spot ids are positional
// (`${areaId}::spot::${n}`), so after inserting we re-key every spot by its new
// position — each spot keeps its own booking, type, amps and custom number.
const rekey = (areaId, list) => list.map((s, i) => ({ ...s, id: `${areaId}::spot::${i + 1}` }));

// One more row of blank spots at the bottom (as wide as a row).
export function addRvRow(area) {
    const { spots } = ensureRvSpots(area);
    const perRow = Math.max(1, Number(area.layoutPerRow) || 10);
    const blanks = Array.from({ length: perRow }, () => ({ bookingId: null }));
    return { spots: rekey(area.id, [...spots, ...blanks]), perRow };
}

// One more spot at the end of every row. Rows are rebuilt from the current width.
export function addRvColumn(area) {
    const { spots } = ensureRvSpots(area);
    const perRow = Math.max(1, Number(area.layoutPerRow) || 10);
    const out = [];
    for (let i = 0; i < spots.length; i += perRow) {
        out.push(...spots.slice(i, i + perRow), { bookingId: null });
    }
    return { spots: rekey(area.id, out), perRow: Math.min(40, perRow + 1) };
}

// When an area's spot count goes DOWN, drop the extra spots from the saved list — the public
// stalling chart and the printed chart read the saved list as-is. A spot with an exhibitor on
// it is never dropped: the list is cut only after the last booked spot.
export function trimRvSpots(area, count) {
    const all = area?.spots || [];
    const target = Math.max(0, Number(count) || 0);
    if (all.length <= target) return all;
    let lastBooked = -1;
    all.forEach((s, i) => { if (s.bookingId) lastBooked = i; });
    const keep = Math.max(target, lastBooked + 1);
    return ensureRvSpots({ ...area, spotCount: keep, layoutCells: keep }).spots;
}

// Take the last row off the grid. Refused (null) when an exhibitor sits on one of its spots.
export function removeRvRow(area) {
    const { spots } = ensureRvSpots(area);
    const perRow = Math.max(1, Number(area.layoutPerRow) || 10);
    if (spots.length <= perRow) return null;
    const lastRow = spots.length % perRow || perRow;
    const kept = spots.slice(0, spots.length - lastRow);
    if (spots.slice(kept.length).some(s => s.bookingId)) return null;
    return { spots: rekey(area.id, kept), perRow };
}

// Take the last spot off every row. Refused (null) when an exhibitor sits on one of them.
export function removeRvColumn(area) {
    const { spots } = ensureRvSpots(area);
    const perRow = Math.max(1, Number(area.layoutPerRow) || 10);
    if (perRow <= 1) return null;
    const kept = [];
    for (let i = 0; i < spots.length; i += perRow) {
        const row = spots.slice(i, i + perRow);
        if (row.length === perRow && row[perRow - 1].bookingId) return null;
        kept.push(...(row.length === perRow ? row.slice(0, perRow - 1) : row));
    }
    return { spots: rekey(area.id, kept), perRow: perRow - 1 };
}
