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
