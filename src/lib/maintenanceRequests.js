// Grounds maintenance requests (Robert 2026-11-19). The office keeps the list in the
// `maintenance_requests` table (see supabase/migrations/20261120160000_maintenance_requests.sql).
//
// Status path:  new -> acknowledged -> done      (cancelled can be set from any step)
// A request is private until the office switches "Show on Event page" on.

export const MAINTENANCE_STATUSES = [
  { key: 'new', label: 'New' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const statusLabel = (key) => MAINTENANCE_STATUSES.find((s) => s.key === key)?.label || key;

/** The one-click button each status offers (null when there is nothing next). */
export const nextAction = (status) => {
  if (status === 'new') return { to: 'acknowledged', label: 'Acknowledge' };
  if (status === 'acknowledged') return { to: 'done', label: 'Mark done' };
  return null;
};

/** The columns a status change must write (timestamps follow the status). */
export const statusPatch = (status, now = new Date().toISOString()) => {
  const patch = { status };
  if (status === 'acknowledged') patch.acknowledged_at = now;
  if (status === 'done') patch.done_at = now;
  if (status === 'new') { patch.acknowledged_at = null; patch.done_at = null; }
  return patch;
};

// Open work first (urgent before normal, oldest first), finished and cancelled last.
const RANK = { new: 0, acknowledged: 1, done: 2, cancelled: 3 };
export const sortRequests = (list) =>
  [...list].sort((a, b) =>
    (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9)
    || (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1)
    || String(a.created_at).localeCompare(String(b.created_at)) * (a.status === 'done' || a.status === 'cancelled' ? -1 : 1));

/** Counts for the filter chips: { all, open, new, acknowledged, done, cancelled }. */
export const countByStatus = (list) => {
  const c = { all: list.length, open: 0, new: 0, acknowledged: 0, done: 0, cancelled: 0 };
  list.forEach((r) => { if (c[r.status] !== undefined) c[r.status] += 1; });
  c.open = c.new + c.acknowledged;
  return c;
};

/** Trim and limit the typed fields the same way the table does. Returns null when the issue is empty. */
export const cleanRequestInput = (input) => {
  const title = String(input?.title ?? '').trim().slice(0, 160);
  if (!title) return null;
  return {
    title,
    location: String(input?.location ?? '').trim().slice(0, 120),
    details: String(input?.details ?? '').trim().slice(0, 2000),
    reported_by: String(input?.reported_by ?? '').trim().slice(0, 120),
    contact: String(input?.contact ?? '').trim().slice(0, 120),
    priority: input?.priority === 'urgent' ? 'urgent' : 'normal',
  };
};
