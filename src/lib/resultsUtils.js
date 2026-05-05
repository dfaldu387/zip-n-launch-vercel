import { v4 as uuidv4 } from 'uuid';
import { parseDivisionId, getAllClassItems } from '@/lib/showBillUtils';

const norm = (s) => String(s || '').trim().toLowerCase();
const stripCustomPrefix = (s) => (s || '').startsWith('custom-') ? s.substring(7) : (s || '');

/**
 * Resolve the schedule classBox itemId that covers a given (discipline, division).
 * Used at QR-generation time so the printed QR can later look up results from
 * projects.project_data.results.classResults[itemId].
 *
 * Returns null if the project has no schedule, or if no classBox in the
 * schedule covers the discipline+division pair.
 */
export function findClassItemId(projectData, disciplineName, divisionName) {
  if (!projectData || !disciplineName || !divisionName) return null;
  const scheduled = getScheduledClasses(projectData);
  if (scheduled.length === 0) return null;

  const targetDisc = norm(disciplineName);
  const targetDiv = norm(divisionName);

  const matchingDivisionIds = new Set();
  for (const ci of getAllClassItems(projectData)) {
    if (norm(ci.disciplineName) !== targetDisc) continue;
    const rawDivName = parseDivisionId(ci.divisionId).divisionName;
    if (norm(stripCustomPrefix(rawDivName)) === targetDiv) {
      matchingDivisionIds.add(ci.divisionId);
    }
  }
  if (matchingDivisionIds.size === 0) return null;

  for (const sc of scheduled) {
    if (sc.classes?.some(divId => matchingDivisionIds.has(divId))) {
      return sc.itemId;
    }
  }
  return null;
}

/**
 * Extract all scheduled classes from the showBill with day/arena context.
 * Returns one entry per classBox item in the schedule.
 */
export function getScheduledClasses(formData) {
  const showBill = formData?.showBill;
  if (!showBill?.days) return [];

  const allClassItems = getAllClassItems(formData);
  const classItemMap = {};
  for (const ci of allClassItems) {
    classItemMap[ci.divisionId] = ci;
  }

  const scheduled = [];

  for (const day of showBill.days) {
    for (const arena of day.arenas || []) {
      for (const item of arena.items || []) {
        if (item.type !== 'classBox') continue;

        // Resolve display name from classes
        let className = item.title || '';
        if (!className && item.classes?.length > 0) {
          const names = item.classes.map(divId => {
            const ci = classItemMap[divId];
            return ci?.name || parseDivisionId(divId).divisionName;
          });
          className = names.join(', ');
        }
        if (!className) className = `Class #${item.number}`;

        scheduled.push({
          itemId: item.id,
          classNumber: item.number,
          className,
          dayId: day.id,
          dayLabel: day.label,
          arenaId: arena.id,
          arenaName: arena.name,
          isSecondGo: item.isSecondGo || false,
          classes: item.classes || [],
        });
      }
    }
  }

  return scheduled;
}

/**
 * Create empty result entries for all scheduled classes.
 */
export function initializeResults(formData, settings = {}) {
  const defaultPlacings = settings.defaultPlacings || 6;
  const scheduledClasses = getScheduledClasses(formData);
  const classResults = {};

  for (const sc of scheduledClasses) {
    classResults[sc.itemId] = {
      classNumber: sc.classNumber,
      className: sc.className,
      status: 'pending',
      scoringType: 'placed',
      entries: Array.from({ length: defaultPlacings }, (_, i) => ({
        id: uuidv4(),
        placing: i + 1,
        riderName: '',
        horseName: '',
        score: null,
        time: null,
        backNumber: '',
        notes: '',
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    classResults,
    settings: {
      defaultPlacings,
      defaultScoringType: 'placed',
    },
  };
}

/**
 * Compute stats from classResults.
 */
export function getResultsStats(classResults) {
  const entries = Object.values(classResults || {});
  const total = entries.length;
  const withData = entries.filter(e =>
    e.entries?.some(r => r.riderName?.trim() || r.horseName?.trim())
  ).length;
  const finalized = entries.filter(e => e.status === 'final').length;

  return { total, withData, finalized, percentComplete: total > 0 ? Math.round((finalized / total) * 100) : 0 };
}

/**
 * Transform finalized results into a map for the Awards module.
 * Returns { classId: [{ placing, riderName, horseName }] }
 */
export function getResultsForAwards(classResults) {
  const map = {};
  for (const [classId, result] of Object.entries(classResults || {})) {
    if (result.status !== 'final') continue;
    map[classId] = (result.entries || [])
      .filter(e => e.riderName?.trim())
      .map(e => ({
        placing: e.placing,
        riderName: e.riderName,
        horseName: e.horseName,
        score: e.score,
        time: e.time,
      }));
  }
  return map;
}
