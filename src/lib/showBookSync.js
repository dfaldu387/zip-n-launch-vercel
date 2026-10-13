// Fill-empty sync between a horse show and its linked pattern book.
//
// Robert's rule: the two should "start naturally filling" each other, in both
// directions, without anyone typing the same thing twice. The one safety rule is
// that a field the user already filled is NEVER overwritten — only empty fields
// are filled. When both sides have a value and they differ, both are kept.

// Show -> book. Pattern picks, groups and layout are the book's own and are
// deliberately not listed here.
export const BOOK_FILL_KEYS = [
  'showName', 'showNumber',
  'associations', 'customAssociations', 'primaryAffiliates',
  'subAssociationSelections', 'selected4HCity', 'targetAudience',
  'disciplines',
  'startDate', 'endDate', 'venueName', 'venueAddress',
  'officials', 'associationJudges', 'showDetails', 'staff', 'schedule',
];

// Book -> show. Kept to the basics: the show's schedule/arena structure is
// owned by Schedule & Arena Setup, so it is never filled from the book.
export const SHOW_FILL_KEYS = [
  'showName', 'showNumber',
  'associations', 'customAssociations', 'primaryAffiliates',
  'disciplines',
  'startDate', 'endDate', 'venueName', 'venueAddress',
];

/** True for undefined, null, '', [], {} — and for objects whose values are all empty. */
export const isEmptyValue = (v) => {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0 || v.every(isEmptyValue);
  if (typeof v === 'object') {
    const values = Object.values(v);
    return values.length === 0 || values.every(isEmptyValue);
  }
  return false; // numbers and booleans are real values
};

// Fields that are only ever filled when empty, never replaced afterwards. A book's
// disciplines carry its own pattern groups, so a later show change is not pushed
// over them.
export const FILL_ONLY_KEYS = ['disciplines'];

// Short stable fingerprint of a value (djb2 over its JSON). Stored per synced field
// so a later run can tell "the other side still holds exactly what I copied" from
// "someone edited it since".
export const hashValue = (v) => {
  const s = JSON.stringify(v === undefined ? null : v);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
};

/**
 * Three-way sync of one direction (source -> target) with a remembered baseline.
 *
 *   target empty                          -> fill it
 *   both the same                         -> nothing to copy; remember it as synced
 *   target still holds what was last
 *     copied (hash matches baseline)      -> the source changed, so update the target
 *   target was edited since               -> keep the target's value
 *
 * `baseline` is { key: hash } from the previous run. Returns the patch for the target
 * and the next baseline. Keys in `fillOnlyKeys` only ever fill empties.
 */
export const computeSyncPatch = (source, target, keys, baseline = {}, fillOnlyKeys = FILL_ONLY_KEYS) => {
  const src = source || {};
  const tgt = target || {};
  const patch = {};
  const nextBaseline = { ...baseline };
  keys.forEach((key) => {
    const s = src[key];
    const t = tgt[key];
    if (isEmptyValue(s)) return;
    if (isEmptyValue(t)) {
      patch[key] = s;
      nextBaseline[key] = hashValue(s);
    } else if (hashValue(s) === hashValue(t)) {
      nextBaseline[key] = hashValue(s);
    } else if (!fillOnlyKeys.includes(key) && baseline[key] && hashValue(t) === baseline[key]) {
      patch[key] = s;
      nextBaseline[key] = hashValue(s);
    }
  });
  return { patch, baseline: nextBaseline };
};

const divisionIdOf = (d) => (typeof d === 'string' ? d : (d?.id ?? d?.division ?? null));

/**
 * Class (division) days, show -> book. The days live inside each discipline as
 * `divisionDates` and `divisionGos` (Go 1 / Go 2 dates), next to the book's own
 * pattern groups. Only those two maps are touched, entry by entry, matched on the
 * discipline and the class. Same three-way rule as computeSyncPatch: empty or
 * still-as-copied book entries follow the show; an entry the book changed is kept.
 * `baseline` is { 'disciplineKey|classId': hash }. Returns { disciplines, baseline }
 * where `disciplines` is the updated list, or null when nothing changed.
 */
export const computeClassDatePatch = (showDisciplines, bookDisciplines, baseline = {}) => {
  if (!Array.isArray(showDisciplines) || !Array.isArray(bookDisciplines)) {
    return { disciplines: null, baseline };
  }
  const nextBaseline = { ...baseline };
  let changed = false;

  const nextDisciplines = bookDisciplines.map((book) => {
    const discKey = book?.id ?? book?.name;
    const show = showDisciplines.find((s) => (s?.id ?? s?.name) === discKey);
    if (!book || !show || discKey === undefined || discKey === null) return book;

    const known = new Set([
      ...(book.divisionOrder || []).map(divisionIdOf),
      ...Object.keys(book.divisionGos || {}),
      ...Object.keys(book.divisionDates || {}),
    ]);
    const showClassIds = new Set([
      ...Object.keys(show.divisionGos || {}),
      ...Object.keys(show.divisionDates || {}),
    ]);

    let divisionGos = book.divisionGos;
    let divisionDates = book.divisionDates;
    let discChanged = false;

    showClassIds.forEach((classId) => {
      if (!known.has(classId)) return;
      const s = { go: show.divisionGos?.[classId] ?? null, date: show.divisionDates?.[classId] ?? null };
      if (s.go === null && s.date === null) return;
      const b = { go: book.divisionGos?.[classId] ?? null, date: book.divisionDates?.[classId] ?? null };
      const bookEmpty = b.go === null && b.date === null;
      const mapKey = `${discKey}|${classId}`;
      const sHash = hashValue(s);
      const bHash = hashValue(b);
      if (sHash === bHash) {
        nextBaseline[mapKey] = sHash;
        return;
      }
      if (bookEmpty || (baseline[mapKey] && bHash === baseline[mapKey])) {
        if (s.go !== null) divisionGos = { ...(divisionGos || {}), [classId]: s.go };
        if (s.date !== null) divisionDates = { ...(divisionDates || {}), [classId]: s.date };
        nextBaseline[mapKey] = sHash;
        discChanged = true;
      }
    });

    if (!discChanged) return book;
    changed = true;
    return { ...book, divisionGos, divisionDates };
  });

  return { disciplines: changed ? nextDisciplines : null, baseline: nextBaseline };
};

/** A locked or published book is frozen: sync does not touch it. */
export const isBookFrozen = (status) =>
  ['final', 'publication', 'published', 'locked', 'lock & approve mode'].includes((status || '').toLowerCase());

/**
 * Sync a show and its linked pattern book, both directions, and save what changed.
 * Skips a frozen book and a locked show; only the show's owner writes the show row.
 * A failed write is not fatal. Returns the (possibly updated) { show, book } rows.
 *
 * `supabase` is passed in so this file stays free of app imports.
 */
export const syncShowAndBook = async (supabase, show, book, userId) => {
  let nextShow = show;
  let nextBook = book;
  const showPd = show.project_data || {};
  const bookPd = book.project_data || {};
  const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Both directions are computed from the rows as loaded, so one run cannot
  // bounce a value back and forth.
  const toBook = computeSyncPatch(showPd, bookPd, BOOK_FILL_KEYS, (bookPd.syncBaseline || {}).fromShow || {});
  const toShow = computeSyncPatch(bookPd, showPd, SHOW_FILL_KEYS, (showPd.syncBaseline || {}).fromBook || {});

  if (!isBookFrozen(book.status)) {
    // Class days: only when the disciplines were not just filled wholesale above.
    const classDates = toBook.patch.disciplines
      ? { disciplines: null, baseline: (bookPd.syncBaseline || {}).classDates || {} }
      : computeClassDatePatch(showPd.disciplines, bookPd.disciplines, (bookPd.syncBaseline || {}).classDates || {});
    const baselineChanged =
      !sameJson(toBook.baseline, (bookPd.syncBaseline || {}).fromShow || {})
      || !sameJson(classDates.baseline, (bookPd.syncBaseline || {}).classDates || {});
    if (Object.keys(toBook.patch).length > 0 || classDates.disciplines || baselineChanged) {
      const merged = {
        ...bookPd,
        ...toBook.patch,
        ...(classDates.disciplines ? { disciplines: classDates.disciplines } : {}),
        syncBaseline: {
          ...(bookPd.syncBaseline || {}),
          fromShow: toBook.baseline,
          classDates: classDates.baseline,
        },
      };
      const { error } = await supabase.from('projects').update({ project_data: merged }).eq('id', book.id);
      if (!error) nextBook = { ...book, project_data: merged };
    }
  }

  if (show.user_id === userId && showPd.isShowLocked !== true) {
    const baselineChanged = !sameJson(toShow.baseline, (showPd.syncBaseline || {}).fromBook || {});
    if (Object.keys(toShow.patch).length > 0 || baselineChanged) {
      const merged = {
        ...showPd,
        ...toShow.patch,
        syncBaseline: { ...(showPd.syncBaseline || {}), fromBook: toShow.baseline },
      };
      const { error } = await supabase.from('projects').update({ project_data: merged }).eq('id', show.id);
      if (!error) nextShow = { ...show, project_data: merged };
    }
  }

  return { show: nextShow, book: nextBook };
};

/**
 * The fields of `source` that should be copied into `target`: present (not empty)
 * on the source and empty on the target. Returns a plain object — empty when
 * there is nothing to fill.
 */
export const computeFillPatch = (source, target, keys) => {
  const src = source || {};
  const tgt = target || {};
  const patch = {};
  keys.forEach((key) => {
    if (!isEmptyValue(src[key]) && isEmptyValue(tgt[key])) {
      patch[key] = src[key];
    }
  });
  return patch;
};
