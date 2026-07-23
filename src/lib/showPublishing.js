/**
 * Is this show live to the public?
 *
 * Kept free of any Supabase import so it stays a pure, testable rule — it decides
 * whether an exhibitor at the arena can see a completed score sheet.
 *
 * Mirrors the predicates the public Event page already uses, plus the results
 * module status so results can be published on their own.
 */
export const isShowPublished = (project) => {
    if (!project) return false;
    const status = String(project.status || '').toLowerCase();
    if (['published', 'final', 'publication'].includes(status)) return true;
    return project.project_data?.moduleStatuses?.results === 'published';
};
