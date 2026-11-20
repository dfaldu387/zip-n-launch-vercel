// Horse health documents (Robert 2026-11-18): every horse can carry two papers,
// a Health Certificate (CVI) and a Coggins test. They live on the booking as
//
//   booking.horseDocs = [ { name?, certificate?: Doc, coggins?: Doc }, ... ]   // one entry per horse slot
//   Doc = { path, name, uploadedAt }       // path = file in the private 'horse-health-docs' bucket
//
// A horse slot exists as soon as the booking says "N horses" — the exhibitor does not
// have to type names yet. A name typed later is kept in horseDocs[i].name.

// Every paper a horse can carry. Which of them a show actually asks for is the show's
// "Required documents" setting (Fees tab), kept at stallingService.requiredDocs.
export const HORSE_DOC_KINDS = [
  { key: 'certificate', label: 'Health Certificate', short: 'Cert' },
  { key: 'coggins', label: 'Coggins', short: 'Coggins' },
  { key: 'registration', label: 'Registration Papers', short: 'Reg.' },
];

// A show that never set the option keeps today's behaviour: Certificate + Coggins.
export const DEFAULT_REQUIRED_DOCS = { certificate: true, coggins: true, registration: false };

/** The three on/off flags, with any missing one filled from the default. */
export const normalizeRequiredDocs = (r) => {
  const out = {};
  HORSE_DOC_KINDS.forEach((k) => { out[k.key] = typeof r?.[k.key] === 'boolean' ? r[k.key] : DEFAULT_REQUIRED_DOCS[k.key]; });
  return out;
};

/** The paper types this show asks for, in display order. */
export const getRequiredKinds = (r) => {
  const flags = normalizeRequiredDocs(r);
  return HORSE_DOC_KINDS.filter((k) => flags[k.key]);
};

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
    // A name saved on the horse's own entry wins (even an empty one): after an edit the
    // entries are the exact list, while `names` has blanks removed and can shift.
    name: (typeof docs[i]?.name === 'string' ? docs[i].name : names[i]) || '',
    certificate: isDoc(docs[i]?.certificate) ? docs[i].certificate : null,
    coggins: isDoc(docs[i]?.coggins) ? docs[i].coggins : null,
    registration: isDoc(docs[i]?.registration) ? docs[i].registration : null,
  }));
};

/**
 * Summary for the Health Documents column. Only the papers the show requires count
 * (`kinds`, from getRequiredKinds; default = Certificate + Coggins).
 *   none         no horses on the booking
 *   notrequired  the show asks for no papers
 *   missing      no required paper uploaded for any horse
 *   partial      some, but not all, required papers are in
 *   confirmed    every horse has every required paper
 */
export const healthStatus = (slots, kinds = getRequiredKinds()) => {
  const total = slots.length;
  if (total === 0) return { state: 'none', done: 0, total: 0, sort: -1 };
  if (kinds.length === 0) return { state: 'notrequired', done: total, total, sort: 0 };
  const done = slots.filter((s) => kinds.every((k) => s[k.key])).length;
  const anyDoc = slots.some((s) => kinds.some((k) => s[k.key]));
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

// ── Editing the horses of a booking (Robert 2026-11-19: rename / add / remove) ──────
// Horses are a positional list, so one edit has to keep three fields in step:
//   horseCount, horseNames (non-blank names, in order) and horseDocs (one entry per horse).
// The same rules run in SQL (_horse_doc_edit) for the exhibitor's link.

export const MAX_HORSES = 50;
export const MAX_HORSE_NAME = 60;

const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_HORSE_NAME);

/** The booking fields that hold the horses, rebuilt from `slots` ({ name, certificate?, coggins? }). */
export const buildHorsePatch = (slots) => {
  const list = slots.map((s) => {
    const entry = { name: cleanName(s.name) };
    HORSE_DOC_KINDS.forEach((k) => { if (s[k.key]) entry[k.key] = s[k.key]; });
    return entry;
  });
  return {
    horseCount: list.length,
    horseNames: list.map((e) => e.name).filter(Boolean),
    horseDocs: list,
  };
};

/** Rename horse `index`. Returns the new slot list (input is not changed). */
export const renameHorse = (slots, index, name) =>
  slots.map((s, i) => (i === index ? { ...s, name: cleanName(name) } : s));

/** Add a horse at the end. Returns null when the booking is already full. */
export const addHorse = (slots, name) =>
  (slots.length >= MAX_HORSES ? null : [...slots, { index: slots.length, name: cleanName(name), certificate: null, coggins: null }]);

/** Take horse `index` out, with its papers. Returns null when it is the only horse. */
export const removeHorse = (slots, index) =>
  (slots.length <= 1 ? null : slots.filter((_, i) => i !== index));

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
