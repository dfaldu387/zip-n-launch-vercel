// "Live Scoring with Scores/Penalties": pure helpers for the live scoring screen.
// Scores are kept in scoring_entries.maneuver_scores (one number per maneuver, null = not scored yet),
// the same place the General score sheet uses, so the math in scoreMath.js is shared.
import { padScores, buildPlacings } from '@/lib/scoringSheetInfo';
import { computeScore } from '@/lib/scoreMath';

export const TILES_PER_GROUP = 6;

// Temporary maneuver list for this screen (same shape as the mockup) until pattern maneuvers come in.
export const LIVE_SAMPLE_MANEUVERS = [
  'Left Walk', 'Left Jog', 'Left Lope', 'Left Ext Jog',
  'Right Walk', 'Right Jog', 'Right Lope', 'Right Ext Jog',
  'Back',
];

/** "Left Jog" -> { side: 'Left', short: 'Jog' }. Names without Left/Right have side = null. */
export const splitManeuver = (name) => {
  const m = /^(Left|Right) (.+)$/.exec(String(name || ''));
  return m ? { side: m[1], short: m[2] } : { side: null, short: String(name || '') };
};

/** "Left Jog" -> "Left · Jog" (used in headings). */
export const maneuverLabel = (name) => {
  const { side, short } = splitManeuver(name);
  return side ? `${side} · ${short}` : short;
};

/** How many horses have a score for each maneuver: [3, 0, 18, ...]. */
export const maneuverProgress = (entries, maneuverCount) => {
  const counts = Array.from({ length: maneuverCount }, () => 0);
  (entries || []).forEach((e) => {
    padScores(e.maneuver_scores, maneuverCount).forEach((v, i) => { if (v !== null) counts[i] += 1; });
  });
  return counts;
};

/** A maneuver is complete when every horse in the class has a score for it. */
export const completedManeuvers = (entries, maneuverCount) => {
  const total = (entries || []).length;
  if (total === 0) return 0;
  return maneuverProgress(entries, maneuverCount).filter((c) => c >= total).length;
};

/** Number of maneuvers this horse has a score for. Penalties do not count. */
export const scoredCountOf = (entry, maneuverCount) =>
  padScores(entry?.maneuver_scores, maneuverCount).filter((v) => v !== null).length;

/**
 * Tiles in display order: horses that have started are ranked by total (best first),
 * horses that have not started follow in work order. Disqualified horses come last.
 * Each tile gets { entry, total, placing, scored, selectedScore }.
 */
export const orderTiles = (entries, startingScore, maneuverCount, selectedManeuver, tiebreakSteps = []) => {
  const { ranked, resultById } = buildPlacings(entries, startingScore, maneuverCount, tiebreakSteps);
  const byId = new Map((entries || []).map((e) => [e.id, e]));
  const rankedIds = new Set(ranked.map((r) => r.id));
  const waiting = (entries || [])
    .filter((e) => !rankedIds.has(e.id))
    .sort((a, b) => (Number(a.work_order) || 0) - (Number(b.work_order) || 0));
  const toTile = (entry, placing) => {
    const result = resultById.get(entry.id);
    const scores = padScores(entry.maneuver_scores, maneuverCount);
    return {
      entry,
      placing: placing ?? null,
      total: result?.total ?? startingScore,
      status: result?.status || 'ok',
      scored: scoredCountOf(entry, maneuverCount),
      selectedScore: selectedManeuver !== null && selectedManeuver !== undefined ? scores[selectedManeuver] : null,
    };
  };
  return [...ranked.map((r) => toTile(byId.get(r.id), r.placing)), ...waiting.map((e) => toTile(e, null))];
};

/** Splits tiles into groups of 6 with a label: "Places 1–6", "Places 7–12". */
export const groupTiles = (tiles, size = TILES_PER_GROUP, prefix = 'Places') => {
  const groups = [];
  for (let i = 0; i < tiles.length; i += size) {
    const part = tiles.slice(i, i + size);
    groups.push({ label: `${prefix} ${i + 1}–${i + part.length}`, tiles: part });
  }
  return groups;
};

/** Same tiles, in the order the horses go (work order). Used when live ranking is off. */
export const byWorkOrder = (tiles) =>
  [...tiles].sort((a, b) => (Number(a.entry.work_order) || 0) - (Number(b.entry.work_order) || 0));

/** Score card numbers for one horse: per-maneuver penalty points + running score + totals. */
export const scorecardOf = (entry, startingScore, maneuverCount) => {
  const scores = padScores(entry?.maneuver_scores, maneuverCount);
  const result = computeScore({ startingScore, maneuverScores: scores, penalties: entry?.penalties || [] });
  const penaltyByManeuver = Array.from({ length: maneuverCount }, () => 0);
  (entry?.penalties || []).forEach((p) => {
    if (p.kind && p.kind !== 'normal') return;
    if (p.maneuver !== null && p.maneuver !== undefined && p.maneuver < maneuverCount) {
      penaltyByManeuver[p.maneuver] += (Number(p.points) || 0) * (Number(p.count) || 1);
    }
  });
  const flags = (entry?.penalties || []).filter((p) => p.kind === 'zero' || p.kind === 'dq').map((p) => p.kind);
  return { scores, penaltyByManeuver, flags, ...result };
};
