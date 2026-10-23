// Travel info requests: emailing staff for their flight / hotel / rental car / mileage details.
// Answers arrive in project_data.travelSubmissions (see supabase/functions/travel-info-request) and are
// folded into travelData here, once each, when the Travel page loads.

import { isDirectExpense } from '@/lib/contractUtils';
import { TRAVEL_ITEMS } from '@/lib/travelBooking';

/**
 * Items worth asking this person for: the missing ones, ticked by default when the person buys it
 * themselves (reimbursed). Items the show buys directly are listed but unticked, since the show
 * already knows those details.
 * Returns [{ type, label, checked }].
 */
export function requestableItems(member, items) {
  const keyOf = Object.fromEntries(TRAVEL_ITEMS.map((i) => [i.type, i.expenseKey]));
  return (items || []).map((item) => ({
    type: item.type,
    label: item.label,
    checked: !isDirectExpense(member?.reimbursable_expenses?.[keyOf[item.type]]),
  }));
}

/** Request state for one person: 'submitted' (answered since it was sent), 'sent', or null. */
export function requestState(request, submissions) {
  if (!request?.sentAt) return null;
  const answered = Object.values(submissions || {}).some((s) => s?.submittedAt && s.submittedAt > request.sentAt);
  return answered ? 'submitted' : 'sent';
}

/**
 * Copies submitted answers into travelData. Each answer is applied once (the stamp in
 * appliedSubmissions), so later edits by the manager are never overwritten. Date fields on a card whose
 * dates are locked are left alone. Returns a new object; the input is not changed.
 */
export function applySubmissions(travelData, submissions) {
  if (!submissions) return travelData;
  const out = { ...travelData };
  for (const [memberId, byType] of Object.entries(submissions)) {
    if (!out[memberId]) continue;
    let entry = out[memberId];
    for (const [type, sub] of Object.entries(byType || {})) {
      if (!sub?.submittedAt || entry.appliedSubmissions?.[type] === sub.submittedAt) continue;
      const card = { ...(entry[type] || {}) };
      for (const [field, value] of Object.entries(sub.values || {})) {
        const isDate = /Time$|^checkIn$|^checkOut$|^startDate$|^endDate$/.test(field);
        if (isDate && card.datesLocked) continue;
        card[field] = value;
      }
      const have = new Set((card.receipts || []).map((r) => r.id));
      const added = (sub.receipts || []).filter((r) => !have.has(r.id));
      if (added.length > 0) card.receipts = [...(card.receipts || []), ...added];
      entry = { ...entry, [type]: card, appliedSubmissions: { ...(entry.appliedSubmissions || {}), [type]: sub.submittedAt } };
    }
    out[memberId] = entry;
  }
  return out;
}
