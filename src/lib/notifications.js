import { supabase } from '@/lib/supabaseClient';

/**
 * In-app notifications reuse the existing `judge_notifications` table — its
 * schema is generic enough (email + project_id + message + type), and the
 * existing JudgeNotificationPanel bell in Navigation already polls it for the
 * logged-in user's email. By writing here keyed by the submitter's email,
 * pattern approve/reject/publish events surface in the same bell without a
 * second table or a second component.
 *
 * Failures are swallowed and logged so the calling flow (approve/reject) is
 * never blocked by an RLS or table issue.
 *
 * @param {Object} args
 * @param {string} args.email          - recipient's email (matches judge_email column)
 * @param {string} [args.name]         - optional display name for the recipient
 * @param {string} args.type           - 'pattern_approved' | 'pattern_rejected' | 'pattern_published'
 * @param {string} args.message        - human-readable text shown in the bell list
 * @param {string} [args.setName]      - pattern set name, stored as project_name
 * @param {string} [args.setKey]       - any string identifying the set, stored as project_id
 * @param {string} [args.createdBy]    - actor user id (admin) as string
 */
export async function createNotification({ email, name, type, message, setName, setKey, createdBy }) {
  if (!email || !type || !message) {
    console.warn('createNotification: missing required fields', { email, type, message });
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('judge_notifications')
      .insert({
        judge_email: email.toLowerCase(),
        judge_name: name || null,
        // project_id is TEXT in the existing schema so we can stuff any
        // identifier here. Use the set key (or set name as a fallback) so
        // there's something to group on later.
        project_id: setKey || setName || 'pattern',
        project_name: setName || 'Pattern Set',
        notification_type: type,
        message,
        created_by: createdBy ? String(createdBy) : null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return null;
      console.warn('createNotification failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('createNotification threw:', err);
    return null;
  }
}

/**
 * Contract sent -> the show appears in that person's Staff Portal (matched by
 * email, no account needed up front). The Staff Portal already lists every
 * project that has a judge_notifications row for the logged-in email, so one
 * row per (email, show) is all it takes.
 */
export async function notifyContractSent({ email, name, showId, showName, createdBy }) {
  if (!email || !showId) return null;
  try {
    // No .select() on purpose: the row belongs to another person's email, so
    // the read-back would be blocked by RLS and fail the whole insert. The
    // sender can't see the recipient's rows, so a duplicate check isn't
    // possible here — the Staff Portal dedupes by show id.
    const { error } = await supabase
      .from('judge_notifications')
      .insert({
        judge_email: email.toLowerCase(),
        judge_name: name || null,
        project_id: String(showId),
        project_name: showName || 'Horse Show',
        notification_type: 'contract_sent',
        message: `You have a contract for "${showName || 'a show'}". Open the Staff Portal to see it.`,
        created_by: createdBy ? String(createdBy) : null,
      });
    if (error) {
      console.warn('notifyContractSent failed:', error.message);
      return null;
    }
    return true;
  } catch (err) {
    console.warn('notifyContractSent threw:', err);
    return null;
  }
}

const STATUS_TEXT = {
  sent: 'was sent',
  signed: 'was marked as signed',
  approved: 'was approved',
  declined: 'was declined',
};

/**
 * Manager changed a person's contract status: keep the copy the Staff Portal reads
 * (staff_contract_status) up to date and, for the states staff care about, drop an
 * alert in their bell. Never blocks the manager's action; failures are only logged.
 * No .select() anywhere — the rows belong to someone else (see notifyContractSent).
 */
export async function syncStaffContractStatus({ email, name, showId, showName, status, createdBy }) {
  if (!email || !showId || !status) return null;
  const lower = email.toLowerCase();
  try {
    const { error } = await supabase
      .from('staff_contract_status')
      .upsert(
        { show_id: String(showId), member_email: lower, status, updated_at: new Date().toISOString() },
        { onConflict: 'show_id,member_email' },
      );
    if (error) console.warn('syncStaffContractStatus failed:', error.message);

    // 'sent' already has its own alert (notifyContractSent)
    if (STATUS_TEXT[status] && status !== 'sent') {
      const { error: nError } = await supabase.from('judge_notifications').insert({
        judge_email: lower,
        judge_name: name || null,
        project_id: String(showId),
        project_name: showName || 'Horse Show',
        notification_type: `contract_${status}`,
        message: `Your contract for "${showName || 'a show'}" ${STATUS_TEXT[status]}.`,
        created_by: createdBy ? String(createdBy) : null,
      });
      if (nError) console.warn('contract status alert failed:', nError.message);
    }
    return true;
  } catch (err) {
    console.warn('syncStaffContractStatus threw:', err);
    return null;
  }
}

/** Staff -> show owner alert ("Anna uploaded a W-9 ..."). Runs through a database function. */
export async function notifyShowOwner({ showId, message }) {
  if (!showId || !message) return null;
  try {
    const { error } = await supabase.rpc('notify_show_owner', { p_show_id: String(showId), p_message: message });
    if (error) {
      console.warn('notifyShowOwner failed:', error.message);
      return null;
    }
    return true;
  } catch (err) {
    console.warn('notifyShowOwner threw:', err);
    return null;
  }
}

/**
 * Convenience helpers for the pattern review flow.
 */
export const notifyPatternApproved = ({ email, name, setName, patternCount, createdBy }) =>
  createNotification({
    email,
    name,
    type: 'pattern_approved',
    message: patternCount
      ? `Your pattern set "${setName}" was approved — ${patternCount} pattern${patternCount === 1 ? '' : 's'} ready for publishing.`
      : `Your pattern set "${setName}" was approved.`,
    setName,
    createdBy,
  });

export const notifyPatternRejected = ({ email, name, setName, reason, createdBy }) =>
  createNotification({
    email,
    name,
    type: 'pattern_rejected',
    message: reason
      ? `Your pattern set "${setName}" needs changes: ${reason}`
      : `Your pattern set "${setName}" needs changes — see admin feedback in your Contributor Portal.`,
    setName,
    createdBy,
  });

export const notifyPatternPublished = ({ email, name, setName, patternCount, createdBy }) =>
  createNotification({
    email,
    name,
    type: 'pattern_published',
    message: patternCount
      ? `Your pattern set "${setName}" is now live — ${patternCount} pattern${patternCount === 1 ? '' : 's'} searchable in the Pattern Hub.`
      : `Your pattern set "${setName}" is now live in the Pattern Hub.`,
    setName,
    createdBy,
  });
