// Travel activity log: emails sent to staff and details they sent back, newest first.
// New events are written by supabase/functions/travel-info-request into project_data.travelActivity.
// Requests and answers from before the log existed still carry their own timestamps
// (travelRequests[].sentAt, travelSubmissions[][].submittedAt), so they are listed too.

const TYPE_LABELS = { flight: 'Flight', hotel: 'Hotel', rentalCar: 'Rental Car', mileage: 'Mileage', profile: 'Traveler Profile' };

/** "2 receipts" for travel items; the attachment on a Traveler Profile is the driver license photo. */
const filesText = (label, n) => {
  if (n <= 0) return '';
  const noun = label === TYPE_LABELS.profile ? 'license photo' : 'receipt';
  return `, ${n} ${noun}${n === 1 ? '' : 's'}`;
};

/** ", added phone to staff card" for a profile whose email / phone filled empty fields on the staff card. */
const staffCardText = (fields) => (fields?.length > 0 ? `, added ${fields.join(' and ')} to staff card` : '');

/**
 * Returns [{ key, kind: 'email_sent' | 'details_submitted', at, name, detail, by }], newest first.
 * An entry in the log wins over the same event rebuilt from requests/submissions (same person, kind and time).
 */
export function buildActivity({ log, requests, submissions, nameOf }) {
  const events = new Map();
  const nameFor = (memberId) => nameOf?.(memberId) || 'Unnamed';

  for (const [memberId, req] of Object.entries(requests || {})) {
    if (!req?.sentAt) continue;
    const items = (req.items || []).map((t) => TYPE_LABELS[t] || t);
    events.set(`email_sent|${memberId}|${req.sentAt}`, {
      kind: 'email_sent', at: req.sentAt, name: nameFor(memberId),
      detail: `${items.join(', ')}${req.email ? ` to ${req.email}` : ''}`, by: '',
    });
  }
  for (const [memberId, byType] of Object.entries(submissions || {})) {
    for (const [type, sub] of Object.entries(byType || {})) {
      if (!sub?.submittedAt) continue;
      const n = (sub.receipts || []).length;
      events.set(`details_submitted|${memberId}|${sub.submittedAt}`, {
        kind: 'details_submitted', at: sub.submittedAt, name: nameFor(memberId),
        detail: `${TYPE_LABELS[type] || type}${filesText(TYPE_LABELS[type], n)}`, by: '',
      });
    }
  }
  for (const e of log || []) {
    if (!e?.at) continue;
    const isEmail = e.type === 'email_sent';
    const n = e.receipts || 0;
    events.set(`${e.type}|${e.memberId}|${e.at}`, {
      kind: e.type,
      at: e.at,
      name: e.name || nameFor(e.memberId),
      detail: isEmail
        ? `${(e.items || []).join(', ')}${e.email ? ` to ${e.email}` : ''}`
        : `${e.item || ''}${filesText(e.item, n)}${staffCardText(e.addedToStaffCard)}`,
      by: e.by || '',
    });
  }

  return [...events.entries()]
    .map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** "Oct 24, 2026, 3:43 PM" in the viewer's time zone. */
export function formatActivityTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
