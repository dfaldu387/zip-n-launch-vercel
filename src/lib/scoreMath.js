// Score math for the Scoring Portal. Pure functions, no screens, so every rule is
// tested in scoreMath.test.js.
//
// The rules come from Robert's video and his Excel sheet:
//   running score  = starting score + maneuver scores so far - penalties
//   raw score      = starting score + all maneuver scores
//   penalty total  = sum of all penalties
//   total score    = raw score - penalty total
//   ZERO penalty   = total becomes 0
//   DQ penalty     = shown as DISQUALIFICATION; it wins over ZERO
//   a maneuver score of 0 is a normal score (it is NOT a "zero" penalty)
//
// Excel check: start 70, penalty 10, maneuvers -1.5, 1, 1 -> raw 70.5, total 60.5.

// Open question for Robert (Q6): does "Raw Score" include the starting score?
// In his sheet it does (the running score starts from 70). If he says otherwise,
// change this one flag.
export const RAW_INCLUDES_STARTING_SCORE = true;

// Scores are in quarter/half steps, so rounding to 2 decimals removes float noise
// (0.1 + 0.2 style errors) without ever changing a real value.
const round2 = (n) => Math.round(n * 100) / 100;

const toNumberOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/**
 * @param {object} input
 * @param {number} input.startingScore
 * @param {Array<number|string|null>} input.maneuverScores  one entry per maneuver, blank = not scored yet
 * @param {Array<{kind?: 'normal'|'zero'|'dq', points?: number, count?: number}>} input.penalties
 * @returns {{ raw:number, penaltyTotal:number, total:number, status:'ok'|'zero'|'dq',
 *             running:Array<number|null>, scoredCount:number }}
 */
export function computeScore({ startingScore, maneuverScores = [], penalties = [] }) {
    const start = toNumberOrNull(startingScore) ?? 0;

    let penaltyTotal = 0;
    let hasZero = false;
    let hasDq = false;
    for (const p of penalties) {
        const kind = p?.kind || 'normal';
        if (kind === 'dq') hasDq = true;
        else if (kind === 'zero') hasZero = true;
        else {
            const points = toNumberOrNull(p?.points) ?? 0;
            const count = toNumberOrNull(p?.count) ?? 1;
            penaltyTotal += points * count;
        }
    }
    penaltyTotal = round2(penaltyTotal);

    // Running score: shown under each maneuver, penalties already taken off.
    let sum = 0;
    const running = maneuverScores.map((raw) => {
        const n = toNumberOrNull(raw);
        if (n === null) return null;
        sum += n;
        return round2(start + sum - penaltyTotal);
    });
    const scoredCount = running.filter(r => r !== null).length;

    const maneuverTotal = round2(sum);
    const rawScore = round2((RAW_INCLUDES_STARTING_SCORE ? start : 0) + maneuverTotal);

    let status = 'ok';
    let total = round2(rawScore - penaltyTotal);
    if (hasDq) { status = 'dq'; total = 0; }          // DQ wins over ZERO
    else if (hasZero) { status = 'zero'; total = 0; }

    return { raw: rawScore, penaltyTotal, total, status, running, scoredCount };
}

/**
 * Placings for one class. Highest total wins. Disqualified horses get no placing.
 *
 * Ties are an open question for Robert (Q3). For now tied horses SHARE a placing and
 * the next placing is skipped (1, 1, 3). This is the only place to change if he
 * wants a tie-breaker instead.
 *
 * @param {Array<{ key:string, total:number, status?:string }>} entries
 * @returns {Array<{ key:string, total:number, status:string, placing:number|null }>}
 */
export function rankEntries(entries) {
    const withStatus = entries.map(e => ({ ...e, status: e.status || 'ok' }));
    const ranked = withStatus.filter(e => e.status !== 'dq').sort((a, b) => b.total - a.total);

    const placingByKey = new Map();
    ranked.forEach((e, i) => {
        const prev = ranked[i - 1];
        placingByKey.set(e.key, prev && prev.total === e.total ? placingByKey.get(prev.key) : i + 1);
    });

    // Keep the ranked order first, disqualified horses last (no placing).
    const dq = withStatus.filter(e => e.status === 'dq');
    return [...ranked, ...dq].map(e => ({ ...e, placing: placingByKey.has(e.key) ? placingByKey.get(e.key) : null }));
}

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th". */
export function ordinal(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}
