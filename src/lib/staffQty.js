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

/** True when at least one of the given dates differs from the base qty. */
export function hasDayOverrides(pos, dates) {
  return (dates || []).some((d) => pos?.qtyByDate?.[d] !== undefined && pos.qtyByDate[d] !== (pos.qty || 0));
}

/** Largest number needed on any one of the dates (the headcount to hire). */
export function peakQty(pos, dates) {
  if (!dates || dates.length === 0) return pos?.qty || 0;
  return Math.max(...dates.map((d) => setupQtyForDate(pos, d)));
}

/** Total slots a list of positions needs across the dates. */
export function totalSlots(positions, dates) {
  let n = 0;
  for (const pos of positions || []) {
    for (const d of dates) n += qtyForDate(pos, d);
  }
  return n;
}

/** Assignments that sit inside a slot that still exists (a day's need may have shrunk). */
export function filledSlots(positions, arenaId, dates, assignments) {
  let n = 0;
  for (const pos of positions || []) {
    for (const d of dates) {
      const have = assignments.filter(
        (a) => a.arenaId === arenaId && a.date === d && a.positionId === pos.id
      ).length;
      n += Math.min(have, qtyForDate(pos, d));
    }
  }
  return n;
}
