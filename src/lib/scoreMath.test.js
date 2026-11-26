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

describe('rankEntries with a penalties tiebreaker', () => {
    const tied = () => [
        { key: 'a', total: 60, penaltyTotal: 9 },
        { key: 'b', total: 60, penaltyTotal: 7 },
        { key: 'c', total: 55, penaltyTotal: 0 },
    ];
    it('without a tiebreaker, equal totals share a placing', () => {
        const r = rankEntries(tied());
        expect(r.filter(x => x.placing === 1)).toHaveLength(2);
    });
    it('fewer penalties wins the tie', () => {
        const r = rankEntries(tied(), [{ type: 'penalties' }]);
        expect(r.map(x => [x.key, x.placing])).toEqual([['b', 1], ['a', 2], ['c', 3]]);
    });
    it('still tied after the tiebreaker shares the placing', () => {
        const r = rankEntries([{ key: 'a', total: 60, penaltyTotal: 4 }, { key: 'b', total: 60, penaltyTotal: 4 }], [{ type: 'penalties' }]);
        expect(r.map(x => x.placing)).toEqual([1, 1]);
    });
    it('does not change a higher total', () => {
        const r = rankEntries([{ key: 'a', total: 61, penaltyTotal: 20 }, { key: 'b', total: 60, penaltyTotal: 0 }], [{ type: 'penalties' }]);
        expect(r[0].key).toBe('a');
    });
});

describe('rankEntries with a maneuver tiebreaker', () => {
    const a = { key: 'a', total: 68.5, penaltyTotal: 0, scores: [1, 0, 0, 2, 0, 0, -1] };
    const b = { key: 'b', total: 68.5, penaltyTotal: 5, scores: [0, 1, 0, 1, 0, 0, 1] };
    it('higher score on the first chosen maneuver wins', () => {
        expect(rankEntries([b, a], [{ type: 'maneuvers', order: [0] }])[0].key).toBe('a');
        expect(rankEntries([a, b], [{ type: 'maneuvers', order: [1] }])[0].key).toBe('b');
    });
    it('moves on to the next maneuver when the first is equal', () => {
        expect(rankEntries([b, a], [{ type: 'maneuvers', order: [2, 3] }])[0].key).toBe('a');
        expect(rankEntries([a, b], [{ type: 'maneuvers', order: [2, 6] }])[0].key).toBe('b');
    });
    it('ignores penalties and an empty order', () => {
        expect(rankEntries([a, b], [{ type: 'maneuvers', order: [2] }]).map(x => x.placing)).toEqual([1, 1]);
        expect(rankEntries([a, b], [{ type: 'maneuvers', order: [] }]).map(x => x.placing)).toEqual([1, 1]);
    });
});

describe('rankEntries with two tiebreakers in order', () => {
    const a = { key: 'a', total: 60, penaltyTotal: 7, scores: [0, 2] };
    const b = { key: 'b', total: 60, penaltyTotal: 7, scores: [1, 0] };
    const c = { key: 'c', total: 60, penaltyTotal: 3, scores: [-1, -1] };
    it('penalties first, then maneuvers', () => {
        const r = rankEntries([a, b, c], [{ type: 'penalties' }, { type: 'maneuvers', order: [0] }]);
        expect(r.map(x => [x.key, x.placing])).toEqual([['c', 1], ['b', 2], ['a', 3]]);
    });
    it('maneuvers first, then penalties', () => {
        const r = rankEntries([a, b, c], [{ type: 'maneuvers', order: [1] }, { type: 'penalties' }]);
        expect(r.map(x => x.key)).toEqual(['a', 'b', 'c']);
        const r2 = rankEntries([b, c], [{ type: 'maneuvers', order: [1] }, { type: 'penalties' }]);
        expect(r2.map(x => x.key)).toEqual(['b', 'c']);
    });
    it('second tiebreaker only used when the first is equal', () => {
        const r = rankEntries([a, b], [{ type: 'penalties' }, { type: 'maneuvers', order: [1] }]);
        expect(r[0].key).toBe('a');
    });
});
