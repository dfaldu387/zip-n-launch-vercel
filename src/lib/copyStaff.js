// Copy the Officials & Staff list from another show into this one.
//
// Kept: who the person is (name, email, phone, cards), their role, their rates, and which
// expenses are switched on with their type (Reimbursement / Direct) and amounts.
// Cleared: everything tied to the OLD show's dates (employment dates, days / hours / overtime worked,
// expense dates and the day counts and totals worked out from them), so last year's dates never
// leak into the new show. Per-day costs keep their Cost/Day so the new dates fill the total in.
//
// Nothing is deleted from the target: people already in the list (same email, or same name when
// there is no email) are skipped, and people from an association the target show does not use are
// skipped and counted so the user can be told.

const keyOf = (m) => ((m.email || '').trim().toLowerCase() || (m.name || '').trim().toLowerCase());

function cleanExpenses(expenses = {}) {
  const out = {};
  for (const [id, exp] of Object.entries(expenses || {})) {
    const next = { ...exp };
    delete next.start_date;
    delete next.end_date;
    if ('cost_per_day' in next) {
      next.days = 0;
      next.total = 0;
    }
    out[id] = next;
  }
  return out;
}

/** A copy of one person for a new show: new id, old-show dates and worked totals removed. */
export function cloneStaffMember(member, newId) {
  return {
    ...member,
    id: newId,
    employment_start_date: null,
    employment_end_date: null,
    days_worked: null,
    hours_worked: null,
    overtime_hours: null,
    reimbursable_expenses: cleanExpenses(member.reimbursable_expenses),
  };
}

/**
 * Returns { officials, added, skippedDuplicate, skippedAssociation } where `officials` is the target's
 * list with the copied people added. `allowedAssociations` is the list of association ids the target show
 * uses; people from other associations are not copied (they would not be visible there).
 */
export function copyOfficials(sourceOfficials, targetOfficials, allowedAssociations, makeId) {
  const officials = JSON.parse(JSON.stringify(targetOfficials || {}));
  const allowed = new Set(allowedAssociations || []);
  let added = 0;
  let skippedDuplicate = 0;
  let skippedAssociation = 0;

  for (const [assocId, roles] of Object.entries(sourceOfficials || {})) {
    for (const [roleId, members] of Object.entries(roles || {})) {
      for (const member of members || []) {
        if (!allowed.has(assocId)) { skippedAssociation += 1; continue; }
        const key = keyOf(member);
        const existing = officials[assocId]?.[roleId] || [];
        if (key && existing.some((m) => keyOf(m) === key)) { skippedDuplicate += 1; continue; }
        if (!officials[assocId]) officials[assocId] = {};
        if (!officials[assocId][roleId]) officials[assocId][roleId] = [];
        officials[assocId][roleId].push(cloneStaffMember(member, makeId()));
        added += 1;
      }
    }
  }
  return { officials, added, skippedDuplicate, skippedAssociation };
}

/** How many people a show's Officials & Staff list holds. */
export function countStaff(officials) {
  return Object.values(officials || {}).reduce(
    (sum, roles) => sum + Object.values(roles || {}).reduce((s, list) => s + (list || []).length, 0),
    0
  );
}
