// Per-day staff needs. A position keeps its base `qty` for every day; an optional
// `qtyByDate: { 'YYYY-MM-DD': n }` overrides single days. A day without an entry
// follows the base qty, so shows saved before this existed behave the same.

/** How many people this position needs on one date. */
export function qtyForDate(pos, date) {
  const override = pos?.qtyByDate?.[date];
  if (override !== undefined && override !== null && override !== '') {
    return Math.max(0, parseInt(override, 10) || 0);
  }
  // A position with no qty at all counts as 1; an explicit 0 means "not needed".
  return pos?.qty ?? 1;
}

/** Same as qtyForDate but a base qty of 0 stays 0 (for the setup screen's own counts). */
export function setupQtyForDate(pos, date) {
  const override = pos?.qtyByDate?.[date];
  if (override !== undefined && override !== null && override !== '') {
    return Math.max(0, parseInt(override, 10) || 0);
  }
  return pos?.qty || 0;
}

/** Position with one day's need changed. Matching the base qty clears the override. */
export function withQtyForDate(pos, date, qty) {
  const next = { ...(pos.qtyByDate || {}) };
  const value = Math.max(0, parseInt(qty, 10) || 0);
  if (value === (pos.qty || 0)) delete next[date];
  else next[date] = value;
  const out = { ...pos };
  if (Object.keys(next).length > 0) out.qtyByDate = next;
  else delete out.qtyByDate;
  return out;
}

/**
 * A brand-new position. With a date it is needed on that day only (base qty 0, 1 person that day),
 * without one it is needed every day (qty 1). Same shape the per-day editor already produces.
 */
export function newPosition(id, roleId, date = null) {
  if (date) return { id, roleId, qty: 0, required: false, qtyByDate: { [date]: 1 } };
  return { id, roleId, qty: 1, required: false };
}

/** True when at least one of the given dates differs from the base qty. */
export function hasDayOverrides(pos, dates) {
  return (dates || []).some((d) => pos?.qtyByDate?.[d] !== undefined && pos.qtyByDate[d] !== (pos.qty || 0));
}

/** Largest number needed on any one of the dates (the headcount to hire). */
export function peakQty(pos, dates) {
  if (!dates || dates.length === 0) return pos?.qty || 0;
  return Math.max(...dates.map((d) => setupQtyForDate(pos, d)));
}

// "Required" works the same way: the base `required` flag applies to every day, and an
// optional `requiredByDate: { 'YYYY-MM-DD': true|false }` overrides single days.

/** Is this position required on one date? */
export function requiredForDate(pos, date) {
  const override = pos?.requiredByDate?.[date];
  if (override !== undefined && override !== null) return !!override;
  return !!pos?.required;
}

/** Position with one day's Required flag changed. Matching the base flag clears the override. */
export function withRequiredForDate(pos, date, required) {
  const next = { ...(pos.requiredByDate || {}) };
  if (!!required === !!pos.required) delete next[date];
  else next[date] = !!required;
  const out = { ...pos };
  if (Object.keys(next).length > 0) out.requiredByDate = next;
  else delete out.requiredByDate;
  return out;
}

/** True when at least one of the given dates differs from the base Required flag. */
export function hasRequiredOverrides(pos, dates) {
  return (dates || []).some((d) => pos?.requiredByDate?.[d] !== undefined && !!pos.requiredByDate[d] !== !!pos.required);
}

/** The dates (from the list) on which the position is required. */
export function requiredDates(pos, dates) {
  return (dates || []).filter((d) => requiredForDate(pos, d));
}

/** Headcount that is required on the busiest required day. */
export function peakRequiredQty(pos, dates) {
  const days = requiredDates(pos, dates);
  if (days.length === 0) return 0;
  return Math.max(...days.map((d) => setupQtyForDate(pos, d)));
}

/**
 * What the schedule grid should offer on one date. Same as qtyForDate, except a position that is
 * required on some of the dates but not this one (e.g. Show Steward: Fri + Sun) is not needed here.
 */
export function scheduleQtyForDate(pos, dates, date) {
  if (requiredDates(pos, dates).length > 0 && !requiredForDate(pos, date)) return 0;
  return qtyForDate(pos, date);
}

/** Total slots a list of positions needs across the dates. */
export function totalSlots(positions, dates) {
  let n = 0;
  for (const pos of positions || []) {
    for (const d of dates) n += scheduleQtyForDate(pos, dates, d);
  }
  return n;
}

export const ORPHAN_REASONS = {
  arena: 'This arena was removed',
  position: 'This position was removed',
  day: 'Not needed on this day any more',
  extra: 'More people than the position needs',
};

/**
 * Saved assignments that no longer have a slot to sit in, because setup changed after the person
 * was assigned (arena or position removed, a day's need set to 0, or Qty lowered). The grid cannot
 * show them, yet they still count as "busy" that day. Returns [{ assignment, reason }], reason is a key
 * of ORPHAN_REASONS. Nothing is changed here; the page lists them so a person can decide.
 */
export function findOrphanedAssignments(arenas, sharedStaff, showDates, assignments) {
  const scopes = new Map();
  for (const a of arenas || []) {
    scopes.set(a.id, { positions: a.staffPositions || [], dates: (a.dates || []).length > 0 ? a.dates : showDates || [] });
  }
  scopes.set('__shared__', { positions: sharedStaff || [], dates: showDates || [] });

  const used = new Map();
  const orphans = [];
  for (const assignment of assignments || []) {
    const scope = scopes.get(assignment.arenaId);
    if (!scope) { orphans.push({ assignment, reason: 'arena' }); continue; }
    const pos = scope.positions.find((p) => p.id === assignment.positionId);
    if (!pos) { orphans.push({ assignment, reason: 'position' }); continue; }
    if (!scope.dates.includes(assignment.date)) { orphans.push({ assignment, reason: 'day' }); continue; }
    const need = scheduleQtyForDate(pos, scope.dates, assignment.date);
    const key = `${assignment.arenaId}|${assignment.date}|${assignment.positionId}`;
    const count = (used.get(key) || 0) + 1;
    used.set(key, count);
    if (count > need) orphans.push({ assignment, reason: need === 0 ? 'day' : 'extra' });
  }
  return orphans;
}

/** Assignments that sit inside a slot that still exists (a day's need may have shrunk). */
export function filledSlots(positions, arenaId, dates, assignments) {
  let n = 0;
  for (const pos of positions || []) {
    for (const d of dates) {
      const have = assignments.filter(
        (a) => a.arenaId === arenaId && a.date === d && a.positionId === pos.id
      ).length;
      n += Math.min(have, scheduleQtyForDate(pos, dates, d));
    }
  }
  return n;
}
