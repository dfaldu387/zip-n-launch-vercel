// The show wizard pages (Schedule & Arena Setup, Fee Structure, Show Structure) load
// the show's whole project_data once and later save that whole copy back. Anything
// another module or a public booking wrote in between was erased by that save.
//
// mergeLatestShowData() is applied right before the wizard writes: it keeps what the
// wizard edited and takes the NEWEST value for everything another module owns.
// (Housing & Grounds does the same thing by re-reading before every write.)

// Keys the wizard pages never edit; other modules own them. Always taken from the
// newest saved copy.
export const FOREIGN_KEYS = [
  'stallingService',   // Housing & Grounds: stalls, RV, bookings, payments
  'results',           // Results Entry
  'awardsManagement',  // Awards Management
  'staffSchedule',     // Employee / Arena Scheduling
  'sharedStaff',       // Venue & Arena Setup
  'coverImageUrl',     // Housing public page
  'publicPage',        // Housing public page
];

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @param {object} latest  project_data as it is saved right now
 * @param {object} mine    project_data the wizard is about to save
 * @param {object} opts
 *   snapshotModuleStatuses - moduleStatuses the wizard loaded (to see what it changed)
 *   isUnlock               - this save is a deliberate Unlock
 * @returns {object} project_data to write
 */
export const mergeLatestShowData = (latest, mine, { snapshotModuleStatuses = {}, isUnlock = false } = {}) => {
  if (!latest || typeof latest !== 'object') return mine;
  const merged = { ...mine };

  // 1. Keys owned by other modules: newest copy wins.
  FOREIGN_KEYS.forEach((key) => {
    if (latest[key] !== undefined) merged[key] = latest[key];
  });

  // 2. Any key that appeared after this page loaded (a module wrote something new).
  Object.keys(latest).forEach((key) => {
    if (merged[key] === undefined) merged[key] = latest[key];
  });

  // 3. Module statuses: start from the newest, apply only what this save changed.
  const mineStatuses = mine.moduleStatuses || {};
  const nextStatuses = { ...(latest.moduleStatuses || {}) };
  Object.keys(mineStatuses).forEach((key) => {
    if (!sameJson(mineStatuses[key], snapshotModuleStatuses[key])) {
      nextStatuses[key] = mineStatuses[key];
    }
  });
  merged.moduleStatuses = nextStatuses;

  // 4. Lock: a lock set elsewhere is not undone by an old copy. An Unlock is deliberate.
  if (!isUnlock && latest.isShowLocked === true) merged.isShowLocked = true;

  // 5. Fees: the wizard owns manual fees; Housing owns fees with source 'housing'.
  //    Keep the wizard's list (it may have edited a housing fee) and only ADD housing
  //    fees that were created after this page loaded.
  if (Array.isArray(latest.fees) && Array.isArray(mine.fees)) {
    const haveIds = new Set(mine.fees.map((f) => f && f.id).filter(Boolean));
    const added = latest.fees.filter((f) => f && f.source === 'housing' && f.id && !haveIds.has(f.id));
    if (added.length > 0) merged.fees = [...mine.fees, ...added];
  }

  return merged;
};
