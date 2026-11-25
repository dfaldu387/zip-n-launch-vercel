import { computeScore, rankEntries } from '@/lib/scoreMath';
// Small helpers for the Scoring Portal sheet screen.

export const formatSheetDate = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

// Quarter and half points show as fractions, the way judges write them (1½, -¼).
export const formatScore = (n) => {
    if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
    const v = Number(n);
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    const whole = Math.trunc(abs);
    const frac = Math.round((abs - whole) * 100) / 100;
    const sym = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[frac];
    if (frac === 0) return `${sign}${whole}`;
    if (!sym) return `${sign}${abs}`;
    return `${sign}${whole === 0 ? '' : whole}${sym}`;
};

// TEMPORARY until Robert's pattern video (Task D): the maneuvers will come from the
// selected pattern. Until then every sheet shows this sample list.
export const SAMPLE_MANEUVERS = [
    'Walk to center', 'Extended trot', 'Left lead lope', 'Lead change',
    'Right lead lope', 'Stop', 'Back up', 'Finish',
];

// Used only when the admin has not filled in Scoring Manager for a discipline.
export const DEFAULT_RULES = {
    starting_score: 70,
    penalties: [],
    maneuver_scores: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
};

// Work order: 1 -> "WO-001". New horses go to the end of the list.
export const workOrderLabel = (n) => `WO-${String(n).padStart(3, '0')}`;
export const nextWorkOrder = (entries) =>
    (entries || []).reduce((max, e) => Math.max(max, Number(e.work_order) || 0), 0) + 1;

// Back numbers are kept as text (they can be "1001" or "A12"); just trim stray spaces.
export const cleanBackNumber = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

// ---- Score entry (step 3c) -------------------------------------------------
// Pure helpers so every rule is tested in scoringSheetInfo.test.js.

const penaltyKey = (p) => String(p?.id ?? p?.name ?? '');

/** One score per maneuver; blank = not scored yet (null). Always `length` entries. */
export const padScores = (scores, length) =>
    Array.from({ length }, (_, i) => {
        const v = scores?.[i];
        return v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v);
    });

/** Set (or clear, with '') the score of maneuver `index`. */
export const setManeuverScore = (scores, index, value, length) => {
    const next = padScores(scores, length);
    next[index] = value === '' || value === null || value === undefined ? null : Number(value);
    return next;
};

/**
 * Add a penalty chosen from the rules. The same normal penalty twice raises its count
 * (two breaks of gait = x2). ZERO and DQ only make sense once.
 */
export const addPenalty = (penalties, rule, maneuver = null) => {
    const list = (penalties || []).map((p) => ({ ...p }));
    const key = penaltyKey(rule);
    const kind = rule.kind || 'normal';
    // A normal penalty counts up per maneuver column; ZERO / DQ are kept once for the whole horse.
    const existing = list.find((p) => penaltyKey(p) === key && (kind !== 'normal' || (p.maneuver ?? null) === (maneuver ?? null)));
    if (existing) {
        if (kind === 'normal') existing.count = (Number(existing.count) || 1) + 1;
        return list;
    }
    const entry = { id: rule.id ?? null, name: rule.name, kind, points: Number(rule.points) || 0, count: 1 };
    if (maneuver !== null && maneuver !== undefined) entry.maneuver = maneuver;
    list.push(entry);
    return list;
};

/** Menu order for the penalty list: small deductions first (-3, -5, -10), then ZERO, then DQ. */
export const sortPenaltyRules = (rules) => {
    const rank = (r) => (r.kind === 'dq' ? 2 : r.kind === 'zero' ? 1 : 0);
    return [...(rules || [])].sort((a, b) => rank(a) - rank(b) || (Number(a.points) || 0) - (Number(b.points) || 0));
};

/** Menu text with the number first: "-3  Break of gait", "DQ  Illegal equipment". */
export const penaltyMenuLabel = (r) => {
    if (r.kind === 'dq') return `DQ  ${r.name}`;
    if (r.kind === 'zero') return `ZERO  ${r.name}`;
    return `-${formatScore(r.points)}  ${r.name}`;
};

/** Short text for a chip inside a maneuver column: "-3", "DQ", "ZERO". */
export const penaltyChipText = (p) => (p.kind === 'dq' ? 'DQ' : p.kind === 'zero' ? 'ZERO' : `-${formatScore(p.points)}`);

/** Take one off a penalty; at zero it disappears. */
export const removePenaltyOnce = (penalties, index) => {
    const list = (penalties || []).map((p) => ({ ...p }));
    const p = list[index];
    if (!p) return list;
    const count = Number(p.count) || 1;
    if (count > 1) p.count = count - 1;
    else list.splice(index, 1);
    return list;
};

/** Short text for a penalty chip: "Break of gait -1 ×2", "ZERO", "DQ". */
export const penaltyLabel = (p) => {
    if (p.kind === 'dq') return `${p.name} (disqualified)`;
    if (p.kind === 'zero') return `${p.name} (score 0)`;
    const count = Number(p.count) || 1;
    return `${p.name} -${formatScore(p.points)}${count > 1 ? ` ×${count}` : ''}`;
};

// ---- Placings (step 4) -----------------------------------------------------

/**
 * Score every horse and rank the ones that have been scored. A horse with no maneuver
 * scores and no penalty has not run yet, so it is left out until the judge starts it.
 * Disqualified horses are listed last with no placing. Tied horses share a placing.
 *
 * @returns {{ ranked: Array<{ id, backNumber, workOrder, total, status, placing }>,
 *             resultById: Map<string, object>, waiting: number }}
 */
export const buildPlacings = (entries, startingScore, maneuverCount) => {
    const resultById = new Map();
    const scored = [];
    let waiting = 0;
    (entries || []).forEach((e) => {
        const r = computeScore({
            startingScore,
            maneuverScores: padScores(e.maneuver_scores, maneuverCount),
            penalties: e.penalties || [],
        });
        resultById.set(e.id, r);
        if (r.scoredCount > 0 || (e.penalties || []).length > 0) {
            scored.push({ key: e.id, total: r.total, status: r.status, backNumber: e.back_number, workOrder: e.work_order });
        } else {
            waiting += 1;
        }
    });
    const ranked = rankEntries(scored).map((x) => ({ ...x, id: x.key }));
    return { ranked, resultById, waiting };
};
