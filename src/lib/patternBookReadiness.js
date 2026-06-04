/**
 * Determines whether a pattern book is ready to be Published (status -> 'Final').
 *
 * Rule (confirmed with the client): a book may only be published once EVERY
 * pattern group has a pattern assigned. A group counts as assigned when it has:
 *   - a standard pattern (selection.patternId), OR
 *   - "Judge Picks Pattern" (type === 'judgeAssigned'), OR
 *   - a custom pattern that has actually been UPLOADED
 *     (type === 'customRequest' && requestStatus === 'uploaded').
 *
 * A custom request that was only *sent* (email_sent / requested) but not yet
 * uploaded does NOT count — you can't publish empty custom slots.
 *
 * Scoresheet-only disciplines need no pattern, so their groups are skipped.
 *
 * Mirrors the per-group logic used in Step6_PatternAndLayout.jsx.
 *
 * @returns {{ ready: boolean, missing: Array<{discipline: string, group: string, reason: string}> }}
 */
export function getPublishReadiness(formData) {
  const disciplines = formData?.disciplines || [];
  const patternSelections = formData?.patternSelections || {};
  const getSelection = (disciplineId, groupId) => patternSelections[disciplineId]?.[groupId];

  const missing = [];

  disciplines.forEach((discipline) => {
    const isScoresheetOnly =
      discipline.pattern_type === 'scoresheet_only' ||
      (!discipline.pattern && discipline.scoresheet);
    if (isScoresheetOnly) return; // no pattern required

    // Only groups that actually have divisions are real, assignable groups.
    const groups = (discipline.patternGroups || []).filter(
      (g) => g.divisions && g.divisions.length > 0
    );

    groups.forEach((group) => {
      const sel = getSelection(discipline.id, group.id);
      const hasStandard = !!sel?.patternId;
      const isJudgeAssigned = sel?.type === 'judgeAssigned';
      const isCustomUploaded =
        sel?.type === 'customRequest' && sel?.requestStatus === 'uploaded';

      if (!hasStandard && !isJudgeAssigned && !isCustomUploaded) {
        missing.push({
          discipline: (discipline.name || discipline.id || 'Discipline').replace(' at Halter', ''),
          group: group.name || `Group ${group.id}`,
          reason:
            sel?.type === 'customRequest'
              ? 'awaiting custom upload'
              : 'no pattern assigned',
        });
      }
    });
  });

  return { ready: missing.length === 0, missing };
}
