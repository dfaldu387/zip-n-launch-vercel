// Live date push between a horse show and its linked pattern book.
//
// One real show is two records (type 'show' and type 'pattern_book'), each with its own
// startDate / endDate. The background sync only runs when someone opens the Show
// Workspace, so a date changed in either builder stayed old on the other record (and on
// the Events pages). This pushes a changed date to the other record right after the save.
//
// Safety rule (same as showBookSync): the other record is only updated when it still holds
// the date this record had BEFORE the change, or is empty. A date someone set there on
// purpose is never overwritten.

const DATE_KEYS = ['startDate', 'endDate'];

/** Which of startDate / endDate changed, with the other record's expected old value. Pure. */
export const computeDatePush = (oldDates = {}, newDates = {}, targetData = {}) => {
  const patch = {};
  DATE_KEYS.forEach((key) => {
    const was = oldDates[key] || '';
    const now = newDates[key] || '';
    if (!now || now === was) return; // nothing new to push
    const there = targetData[key] || '';
    if (there === now) return; // already the same
    if (there === '' || there === was) patch[key] = now;
  });
  return patch;
};

const FROZEN_BOOK = ['final', 'publication', 'published', 'locked', 'lock & approve mode'];

/**
 * Push changed dates from the record that was just saved to its linked record.
 * `type` is the saved record's type: 'show' or 'pattern_book'.
 * Never throws: a failed push must not break the save.
 */
export const pushDatesToLinked = async (supabase, { id, type, linkedId, oldDates, newDates }) => {
  try {
    if (!id || !newDates) return;
    const changed = DATE_KEYS.some((k) => (newDates[k] || '') && (newDates[k] || '') !== ((oldDates || {})[k] || ''));
    if (!changed) return;

    let targets = [];
    if (type === 'pattern_book') {
      if (!linkedId) return;
      const { data } = await supabase.from('projects').select('id, status, project_data').eq('id', linkedId).maybeSingle();
      if (data) targets = [data];
    } else if (type === 'show') {
      const { data } = await supabase
        .from('projects')
        .select('id, status, project_data')
        .eq('project_type', 'pattern_book')
        .eq('project_data->>linkedProjectId', id);
      targets = data || [];
    }

    for (const t of targets) {
      const pd = t.project_data || {};
      if (type === 'show' && FROZEN_BOOK.includes(String(t.status || '').toLowerCase())) continue;
      if (type === 'pattern_book' && pd.isShowLocked === true) continue;
      const patch = computeDatePush(oldDates || {}, newDates, pd);
      if (Object.keys(patch).length === 0) continue;
      await supabase.from('projects').update({ project_data: { ...pd, ...patch } }).eq('id', t.id);
    }
  } catch (e) {
    console.warn('Could not push dates to the linked record', e);
  }
};
