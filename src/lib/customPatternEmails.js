import { supabase } from '@/lib/supabaseClient';

/**
 * Collects all custom pattern requests from patternSelections and sends
 * notification emails via the send-custom-pattern-request edge function.
 *
 * Returns an updated patternSelections object with requestStatus set to
 * "email_sent" for each successfully emailed request.
 *
 * Never throws — email failures are logged but do not block the caller.
 */
export async function sendCustomPatternRequestEmails(formData) {
  const { patternSelections, disciplines, showName } = formData;
  if (!patternSelections) return patternSelections;

  // Build a discipline id → name map
  const disciplineMap = {};
  (disciplines || []).forEach(d => {
    disciplineMap[d.id] = d.name || d.id;
  });

  // Collect requests to send
  const requests = [];
  for (const [disciplineId, groups] of Object.entries(patternSelections)) {
    if (!groups || typeof groups !== 'object') continue;
    for (const [groupId, selection] of Object.entries(groups)) {
      if (
        selection?.type === 'customRequest' &&
        selection.customPatternRequested &&
        selection.requestedFromEmail?.trim() &&
        selection.requestedFromName?.trim() &&
        selection.requestStatus !== 'email_sent'
      ) {
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
            uploadLink: '', // placeholder — upload link will be implemented later
          },
        });
      }
    }
  }

  if (requests.length === 0) return patternSelections;

  // Clone selections so we can mark statuses
  const updatedSelections = JSON.parse(JSON.stringify(patternSelections));

  // Send emails concurrently (fire-and-forget per request, errors logged)
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
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      const { disciplineId, groupId } = result.value;
      if (updatedSelections[disciplineId]?.[groupId]) {
        updatedSelections[disciplineId][groupId].requestStatus = 'email_sent';
      }
    }
  }

  return updatedSelections;
}
