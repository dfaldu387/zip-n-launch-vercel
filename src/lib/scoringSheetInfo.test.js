import { describe, it, expect } from 'vitest';
import { padScores, setManeuverScore, addPenalty, removePenaltyOnce, penaltyLabel, formatScore } from './scoringSheetInfo';
import { computeScore } from './scoreMath';

describe('padScores / setManeuverScore', () => {
    it('always returns one entry per maneuver, blanks are null', () => {
        expect(padScores([1, '', undefined], 4)).toEqual([1, null, null, null]);
        expect(padScores(null, 2)).toEqual([null, null]);
    });
    it('sets and clears one maneuver without touching the others', () => {
        expect(setManeuverScore([1, null, 0.5], 1, '-1.5', 3)).toEqual([1, -1.5, 0.5]);
        expect(setManeuverScore([1, -1.5, 0.5], 0, '', 3)).toEqual([null, -1.5, 0.5]);
    });
    it('keeps a score of 0 (it is a real score, not blank)', () => {
        expect(setManeuverScore([null], 0, '0', 1)).toEqual([0]);
    });
});

describe('penalties', () => {
    const gait = { id: 'p1', name: 'Break of gait', points: 1, kind: 'normal' };
    const zero = { id: 'p2', name: 'ZERO', points: 0, kind: 'zero' };
    it('adds several different penalties', () => {
        let p = addPenalty([], gait);
        p = addPenalty(p, zero);
        expect(p.map((x) => x.name)).toEqual(['Break of gait', 'ZERO']);
    });
    it('raises the count when the same normal penalty is added again', () => {
        const p = addPenalty(addPenalty([], gait), gait);
        expect(p).toHaveLength(1);
        expect(p[0].count).toBe(2);
    });
    it('does not repeat ZERO', () => {
        expect(addPenalty(addPenalty([], zero), zero)).toHaveLength(1);
    });
    it('removes one at a time and deletes at zero', () => {
        const two = addPenalty(addPenalty([], gait), gait);
        const one = removePenaltyOnce(two, 0);
        expect(one[0].count).toBe(1);
        expect(removePenaltyOnce(one, 0)).toEqual([]);
    });
    it('does not change the list it was given', () => {
        const base = addPenalty([], gait);
        addPenalty(base, gait);
        expect(base[0].count).toBe(1);
    });
    it('labels read well', () => {
        expect(penaltyLabel({ name: 'Break of gait', kind: 'normal', points: 1, count: 2 })).toBe('Break of gait -1 ×2');
        expect(penaltyLabel({ name: 'ZERO', kind: 'zero' })).toBe('ZERO (score 0)');
    });
});

describe('with computeScore (Robert Excel example)', () => {
    it('start 70, -10 penalty, maneuvers -1.5, 1, 1 -> total 60.5', () => {
        const penalties = addPenalty([], { id: 'x', name: 'Penalty', points: 10, kind: 'normal' });
        const r = computeScore({ startingScore: 70, maneuverScores: padScores([-1.5, 1, 1], 8), penalties });
        expect(r.total).toBe(60.5);
        expect(r.penaltyTotal).toBe(10);
        expect(formatScore(r.total)).toBe('60½');
    });
    it('two breaks of gait take 2 points', () => {
        const penalties = addPenalty(addPenalty([], { id: 'g', name: 'Gait', points: 1, kind: 'normal' }), { id: 'g', name: 'Gait', points: 1, kind: 'normal' });
        expect(computeScore({ startingScore: 70, maneuverScores: [], penalties }).total).toBe(68);
    });
});

import { buildPlacings } from './scoringSheetInfo';

const horse = (id, back, scores, penalties = []) => ({ id, back_number: back, work_order: Number(id), maneuver_scores: scores, penalties });

describe('buildPlacings', () => {
    it('ranks by total score, highest first (Robert example: 70, 60.5, 59, 58)', () => {
        const p = buildPlacings([
            horse('1', '1002', [-12]),
            horse('2', '1004', [0]),
            horse('3', '1003', [-11]),
            horse('4', '1001', [-9.5]),
        ], 70, 1);
        expect(p.ranked.map((x) => [x.backNumber, x.placing])).toEqual([['1004', 1], ['1001', 2], ['1003', 3], ['1002', 4]]);
    });
    it('leaves out horses that have not been scored yet', () => {
        const p = buildPlacings([horse('1', '1001', [1]), horse('2', '1002', [null])], 70, 1);
        expect(p.ranked).toHaveLength(1);
        expect(p.waiting).toBe(1);
    });
    it('a disqualified horse is listed last with no placing', () => {
        const p = buildPlacings([
            horse('1', '1001', [5], [{ kind: 'dq', name: 'DQ' }]),
            horse('2', '1002', [0]),
        ], 70, 1);
        expect(p.ranked.map((x) => [x.backNumber, x.placing])).toEqual([['1002', 1], ['1001', null]]);
    });
    it('a ZERO horse is placed last, below real scores', () => {
        const p = buildPlacings([
            horse('1', '1001', [1], [{ kind: 'zero', name: 'ZERO' }]),
            horse('2', '1002', [-5]),
        ], 70, 1);
        expect(p.ranked.map((x) => x.backNumber)).toEqual(['1002', '1001']);
        expect(p.ranked[1].total).toBe(0);
    });
    it('tied horses share a placing and the next one is skipped', () => {
        const p = buildPlacings([horse('1', 'A', [1]), horse('2', 'B', [1]), horse('3', 'C', [0])], 70, 1);
        expect(p.ranked.map((x) => x.placing)).toEqual([1, 1, 3]);
    });
    it('a horse with only a penalty counts as scored', () => {
        const p = buildPlacings([horse('1', 'A', [], [{ kind: 'normal', name: 'x', points: 2, count: 1 }])], 70, 2);
        expect(p.ranked[0].total).toBe(68);
    });
});
