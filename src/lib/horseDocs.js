// Horse health documents (Robert 2026-11-18): every horse can carry two papers,
// a Health Certificate (CVI) and a Coggins test. They live on the booking as
//
//   booking.horseDocs = [ { name?, certificate?: Doc, coggins?: Doc }, ... ]   // one entry per horse slot
//   Doc = { path, name, uploadedAt }       // path = file in the private 'horse-health-docs' bucket
//
// A horse slot exists as soon as the booking says "N horses" — the exhibitor does not
// have to type names yet. A name typed later is kept in horseDocs[i].name.

export const HORSE_DOC_KINDS = [
  { key: 'certificate', label: 'Health Certificate' },
  { key: 'coggins', label: 'Coggins' },
];

export const HORSE_DOCS_BUCKET = 'horse-health-docs';

const isDoc = (d) => !!(d && typeof d === 'object' && (d.path || d.file));

/**
 * Where a paper sits in the bucket. A file the manager uploaded keeps its full `path`.
 * A file the exhibitor uploaded through their link keeps only `file`: the folder holds
 * the link's secret, which must never be copied onto the booking, so the path is
 * rebuilt here from the show's secrets map.
 */
export const docStoragePath = (doc, showId, bookingId, secret) => {
  if (!doc) return null;
  if (doc.path) return doc.path;
  if (doc.file && secret) return `${showId}/${bookingId}/${secret}/${doc.file}`;
  return null;
};

/** One entry per horse: { index, name, certificate, coggins }. `count` and `names` come from the booking. */
export const getHorseSlots = (booking, count = 0, names = []) => {
  const docs = Array.isArray(booking?.horseDocs) ? booking.horseDocs : [];
  const total = Math.max(Number(count) || 0, names.length, docs.length);
  return Array.from({ length: total }, (_, i) => ({
    index: i,
    name: names[i] || docs[i]?.name || '',
    certificate: isDoc(docs[i]?.certificate) ? docs[i].certificate : null,
    coggins: isDoc(docs[i]?.coggins) ? docs[i].coggins : null,
  }));
};

/**
 * Summary for the Health Documents column.
 *   none      no horses on the booking
 *   missing   no document uploaded for any horse
 *   partial   some, but not all, papers are in
 *   confirmed every horse has both papers
 */
export const healthStatus = (slots) => {
  const total = slots.length;
  if (total === 0) return { state: 'none', done: 0, total: 0, sort: -1 };
  const done = slots.filter((s) => s.certificate && s.coggins).length;
  const anyDoc = slots.some((s) => s.certificate || s.coggins);
  if (done === total) return { state: 'confirmed', done, total, sort: 3 };
  if (!anyDoc) return { state: 'missing', done, total, sort: 1 };
  return { state: 'partial', done, total, sort: 2 };
};

/** New horseDocs array with one document set (doc = null removes it). Never mutates. */
export const withHorseDoc = (horseDocs, index, kind, doc, slotCount = 0) => {
  const list = Array.isArray(horseDocs) ? horseDocs.map((d) => ({ ...(d || {}) })) : [];
  while (list.length < Math.max(slotCount, index + 1)) list.push({});
  const next = { ...list[index] };
  if (doc) next[kind] = doc; else delete next[kind];
  list[index] = next;
  return list;
};

/** New horseDocs array with a horse's name set. */
export const withHorseName = (horseDocs, index, name, slotCount = 0) => {
  const list = Array.isArray(horseDocs) ? horseDocs.map((d) => ({ ...(d || {}) })) : [];
  while (list.length < Math.max(slotCount, index + 1)) list.push({});
  list[index] = { ...list[index], name: String(name || '').trim() };
  return list;
};

const SKIP_REASONS = {
  no_email: 'no email on file',
  complete: 'already complete',
  cancelled: 'cancelled',
  no_horses: 'no horses listed',
  no_link: 'link not ready',
  send_failed: 'the email could not be sent',
  not_found: 'booking not found',
};

/** One plain sentence for the result of "Request health docs". */
export const describeRequestResult = ({ sent = [], skipped = [] } = {}) => {
  const head = sent.length === 0
    ? 'No emails were sent.'
    : `Email sent to ${sent.length} ${sent.length === 1 ? 'exhibitor' : 'exhibitors'}.`;
  if (skipped.length === 0) return head;
  const counts = {};
  skipped.forEach((s) => { counts[s.reason] = (counts[s.reason] || 0) + 1; });
  const why = Object.entries(counts).map(([r, n]) => `${n} ${SKIP_REASONS[r] || r}`).join(', ');
  return `${head} Skipped: ${why}.`;
};

/** Bookings that still need papers and can be emailed: have an email, are not cancelled, have horses, are not complete. */
export const isRequestable = (row) =>
  !!row.email && row.status !== 'cancelled' && (row.health.state === 'missing' || row.health.state === 'partial');

const SAFE_EXT = /^(pdf|jpe?g|png|webp|heic)$/i;

/** Storage path for a new upload: <show>/<booking>/<uuid>.<ext>. Returns null for a file type we do not accept. */
export const horseDocPath = (showId, bookingId, fileName, uuid) => {
  const ext = String(fileName || '').split('.').pop();
  if (!SAFE_EXT.test(ext)) return null;
  return `${showId}/${bookingId}/${uuid}.${ext.toLowerCase()}`;
};
