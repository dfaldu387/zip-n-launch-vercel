import { describe, it, expect } from 'vitest';
import { computeScore, rankEntries, ordinal } from '@/lib/scoreMath';

describe('computeScore', () => {
    it("matches Robert's Excel example: start 70, penalty 10, maneuvers -1.5, 1, 1 -> total 60.5", () => {
        const r = computeScore({
            startingScore: 70,
            maneuverScores: [-1.5, 1, 1],
            penalties: [{ kind: 'normal', points: 10 }],
        });
        expect(r.raw).toBe(70.5);
        expect(r.penaltyTotal).toBe(10);
        expect(r.total).toBe(60.5);
        expect(r.status).toBe('ok');
    });

    it('running score shows start + maneuvers so far - penalties (58.5, 59.5, 60.5)', () => {
        const r = computeScore({
            startingScore: 70,
            maneuverScores: [-1.5, 1, 1],
            penalties: [{ kind: 'normal', points: 10 }],
        });
        expect(r.running).toEqual([58.5, 59.5, 60.5]);
    });

    it('adds up several penalties, and a penalty can count more than once', () => {
        const r = computeScore({
            startingScore: 70,
            maneuverScores: [0, 0],
            penalties: [{ points: 1 }, { points: 0.5, count: 3 }],
        });
        expect(r.penaltyTotal).toBe(2.5);
        expect(r.total).toBe(67.5);
    });

    it('a maneuver score of 0 is normal, not a zero penalty', () => {
        const r = computeScore({ startingScore: 70, maneuverScores: [0, 0, 0], penalties: [] });
        expect(r.total).toBe(70);
        expect(r.status).toBe('ok');
    });

    it('a ZERO penalty makes the total 0', () => {
        const r = computeScore({ startingScore: 70, maneuverScores: [1, 1], penalties: [{ kind: 'zero' }] });
        expect(r.total).toBe(0);
        expect(r.status).toBe('zero');
    });

    it('DQ wins over ZERO', () => {
        const r = computeScore({ startingScore: 70, maneuverScores: [1], penalties: [{ kind: 'zero' }, { kind: 'dq' }] });
        expect(r.status).toBe('dq');
        expect(r.total).toBe(0);
    });

    it('blank maneuvers are not scored yet and do not change the total', () => {
        const r = computeScore({ startingScore: 70, maneuverScores: [1, '', null, 0.5], penalties: [] });
        expect(r.running).toEqual([71, null, null, 71.5]);
        expect(r.scoredCount).toBe(2);
        expect(r.total).toBe(71.5);
    });

    it('does not drift on half and quarter points', () => {
        const r = computeScore({ startingScore: 70, maneuverScores: [0.25, 0.25, 0.25, 0.5, -0.75], penalties: [{ points: 0.1 }, { points: 0.2 }] });
        expect(r.penaltyTotal).toBe(0.3);
        expect(r.total).toBe(70.2);
    });

    it('handles no data at all', () => {
        const r = computeScore({ startingScore: 70 });
        expect(r.total).toBe(70);
        expect(r.running).toEqual([]);
    });
});

describe('rankEntries', () => {
    it('places the highest total first', () => {
        const r = rankEntries([
            { key: '1001', total: 60.5 },
            { key: '1002', total: 58 },
            { key: '1003', total: 59 },
            { key: '1004', total: 70 },
        ]);
        expect(r.map(e => [e.key, e.placing])).toEqual([['1004', 1], ['1001', 2], ['1003', 3], ['1002', 4]]);
    });

    it('tied horses share a placing and the next one is skipped (1, 1, 3)', () => {
        const r = rankEntries([
            { key: 'a', total: 70 },
            { key: 'b', total: 70 },
            { key: 'c', total: 68 },
        ]);
        expect(r.map(e => e.placing)).toEqual([1, 1, 3]);
    });

    it('disqualified horses get no placing and come last', () => {
        const r = rankEntries([
            { key: 'a', total: 0, status: 'dq' },
            { key: 'b', total: 65 },
            { key: 'c', total: 0, status: 'zero' },
        ]);
        expect(r.map(e => [e.key, e.placing])).toEqual([['b', 1], ['c', 2], ['a', null]]);
    });
});

describe('ordinal', () => {
    it('writes 1st 2nd 3rd 4th and the teens correctly', () => {
        expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
    });
});
