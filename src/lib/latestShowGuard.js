import { supabase } from '@/lib/supabaseClient';
import { isWizardReadOnly } from '@/lib/moduleStatusService';

/**
 * Decide whether a save may go ahead, from the freshly read show row.
 * Pure, so it can be tested without a database.
 *
 * @param {{ data: Object|null, error: Object|null }} read - result of the re-read
 * @param {string} moduleKey - e.g. 'employeeScheduling'
 * @returns {{ ok: true, latest: Object } | { ok: false, reason: 'read-failed'|'not-found'|'locked', message: string }}
 */
export function checkLatestForSave(read, moduleKey) {
  if (read?.error) {
    return { ok: false, reason: 'read-failed', message: 'Could not check the latest saved copy, so nothing was saved. Please try again.' };
  }
  const latest = read?.data?.project_data;
  if (!latest) {
    return { ok: false, reason: 'not-found', message: 'This show could not be found, so nothing was saved.' };
  }
  if (isWizardReadOnly(latest, moduleKey)) {
    return { ok: false, reason: 'locked', message: 'This section is locked. Unlock it to save changes.' };
  }
  return { ok: true, latest };
}

/** Re-read the newest saved copy of a show and check it is safe to save on top of. */
export async function readLatestForSave(showId, moduleKey) {
  const read = await supabase
    .from('projects')
    .select('project_data')
    .eq('id', showId)
    .maybeSingle();
  return checkLatestForSave(read, moduleKey);
}
