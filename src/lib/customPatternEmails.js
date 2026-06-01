import { supabase } from '@/lib/supabaseClient';

/**
 * Formats a start/end date pair (YYYY-MM-DD strings) into a readable range,
 * e.g. "Jun 18 – Jun 20, 2026". Returns '' when dates are missing.
 */
function formatDateRange(startDate, endDate) {
  if (!startDate) return '';
  // Parse as local dates (avoid UTC off-by-one) by splitting the ISO string
  const toLocal = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };
  const start = toLocal(startDate);
  if (!start) return '';
  const opts = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const end = endDate ? toLocal(endDate) : null;
  if (!end || end.getTime() === start.getTime()) {
    return `${startStr}, ${start.getFullYear()}`;
  }
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

/**
 * Collects custom pattern requests from patternSelections and sends notification
 * emails via the send-custom-pattern-request edge function.
 *
 * @param {object} formData - the builder form data
 * @param {object} [options]
 * @param {string} [options.disciplineId] - when set, only this discipline's
 *        requests are sent (used by the per-request "Send Request" button).
 *
 * Returns { patternSelections, sent, failed, skipped } where patternSelections
 * is an updated copy with requestStatus set to "email_sent" for each success.
 *
 * Never throws — email failures are logged and surfaced via the `failed` count.
 */
export async function sendCustomPatternRequests(formData, options = {}) {
  const { patternSelections, disciplines, showName, venueName, venueAddress, startDate, endDate } = formData;
  const { disciplineId: onlyDisciplineId } = options;

  if (!patternSelections) {
    return { patternSelections, sent: 0, failed: 0, skipped: 0 };
  }

  // Build a human-readable show date range (e.g. "Jun 18 – Jun 20, 2026")
  const showDates = formatDateRange(startDate, endDate);

  // Build a discipline id → name map
  const disciplineMap = {};
  (disciplines || []).forEach(d => {
    disciplineMap[d.id] = d.name || d.id;
  });

  // Collect requests to send
  const requests = [];
  let skipped = 0;
  for (const [disciplineId, groups] of Object.entries(patternSelections)) {
    if (onlyDisciplineId && disciplineId !== onlyDisciplineId) continue;
    if (!groups || typeof groups !== 'object') continue;
    for (const [groupId, selection] of Object.entries(groups)) {
      if (selection?.type !== 'customRequest' || !selection.customPatternRequested) continue;
      if (selection.requestStatus === 'email_sent') continue;

      // A request that is missing name/email is incomplete — count it so the
      // caller can warn the user instead of silently doing nothing.
      if (!selection.requestedFromEmail?.trim() || !selection.requestedFromName?.trim()) {
        skipped += 1;
        continue;
      }

      // Resolve group name from the discipline's patternGroups
      const discipline = (disciplines || []).find(d => d.id === disciplineId);
      const group = (discipline?.patternGroups || []).find(g => g.id === groupId);
      const groupName = group?.name || `Group ${groupId}`;

      requests.push({
        disciplineId,
        groupId,
        payload: {
          recipientEmail: selection.requestedFromEmail.trim(),
          recipientName: selection.requestedFromName.trim(),
          showName: showName || 'Untitled Show',
          discipline: disciplineMap[disciplineId] || disciplineId,
          groupName,
          notes: selection.requestNotes || '',
          showDates: showDates || '',
          venue: venueName || '',
          location: venueAddress || '',
          judge: selection.judgeName || '',
          uploadLink: '', // placeholder — upload link will be implemented later
        },
      });
    }
  }

  if (requests.length === 0) {
    return { patternSelections, sent: 0, failed: 0, skipped };
  }

  // Clone selections so we can mark statuses
  const updatedSelections = JSON.parse(JSON.stringify(patternSelections));

  // Send emails concurrently (errors logged, never thrown)
  const results = await Promise.allSettled(
    requests.map(async ({ disciplineId, groupId, payload }) => {
      const { data, error } = await supabase.functions.invoke(
        'send-custom-pattern-request',
        { body: JSON.stringify(payload) },
      );

      if (error || data?.error) {
        console.error(
          `Failed to send custom pattern email for ${payload.discipline} / ${payload.groupName}:`,
          error?.message || data?.error,
        );
        return { disciplineId, groupId, success: false };
      }

      return { disciplineId, groupId, success: true };
    }),
  );

  // Update statuses for successful sends
  let sent = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      sent += 1;
      const { disciplineId, groupId } = result.value;
      if (updatedSelections[disciplineId]?.[groupId]) {
        updatedSelections[disciplineId][groupId].requestStatus = 'email_sent';
        updatedSelections[disciplineId][groupId].requestSentAt = new Date().toISOString();
      }
    } else {
      failed += 1;
    }
  }

  return { patternSelections: updatedSelections, sent, failed, skipped };
}
