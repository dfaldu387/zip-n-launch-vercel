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
