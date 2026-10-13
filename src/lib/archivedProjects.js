// Archived shows and pattern books live on the Archive page, not in pickers or
// lists. Archive sets projects.mode = 'archived'; Restore clears it.

// PostgREST filter for a projects query: keep rows whose mode is empty or anything
// other than 'archived'. A plain .neq('mode', 'archived') would also drop every
// row where mode is NULL, which is almost all of them.
export const NOT_ARCHIVED_FILTER = 'mode.is.null,mode.neq.archived';

/**
 * For rows that come from an RPC (which may not return `mode`): drop the ones
 * that are archived, by looking the ids up directly. Returns the kept rows.
 */
export const withoutArchived = async (supabase, rows) => {
  const list = (rows || []).filter((r) => r.mode !== 'archived');
  if (list.length === 0) return list;
  const { data: archivedRows } = await supabase
    .from('projects')
    .select('id')
    .in('id', list.map((r) => r.id))
    .eq('mode', 'archived');
  const archivedIds = new Set((archivedRows || []).map((r) => r.id));
  return archivedIds.size > 0 ? list.filter((r) => !archivedIds.has(r.id)) : list;
};
