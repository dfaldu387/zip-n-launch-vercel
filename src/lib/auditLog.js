import { supabase } from '@/lib/supabaseClient';

// One place to record "who deleted what", read back by /audit-reports.
//
// Three admin pages wrote this insert by hand and the rest didn't, so deleting a
// division was recorded while deleting a discipline, an association, an event, a
// show or a pattern was not. A log with gaps is worse than no log: the report
// looks complete, so "nothing found" reads as "nobody deleted it" when it really
// means "we never wrote it down" — and that is exactly the question the page
// exists to answer.
//
// Never throws and never blocks. Failing to write the log must not stop, or
// appear to fail, the action the admin actually asked for; a console warning is
// enough. Callers do not need to await it.
export async function logAudit({ actorId, action, entityType, entityId, payload = {} }) {
  try {
    // The actor is whoever is signed in. Passing it in is optional — pages that
    // already hold the user can, the rest let this look it up.
    let actor = actorId;
    if (!actor) {
      const { data } = await supabase.auth.getUser();
      actor = data?.user?.id ?? null;
    }

    const { error } = await supabase.from('ep_audit_logs').insert({
      actor_id: actor,
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      payload,
    });

    if (error) {
      console.warn('Audit log not written:', action, entityType, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Audit log not written:', action, entityType, e?.message || e);
    return false;
  }
}

// Convenience for the common case.
export const logDelete = (entityType, entityId, payload, actorId) =>
  logAudit({ action: 'delete', entityType, entityId, payload, actorId });
