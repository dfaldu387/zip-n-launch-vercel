import { describe, it, expect } from 'vitest';
import { buildScoringClasses } from './scoringClasses';

const show = (over = {}) => ({
    startDate: '2026-11-05',
    associations: { AQHA: true },
    associationJudges: { AQHA: { judges: [{ name: 'Sara Simons' }] } },
    patternSelections: { 'd1': { g1: { patternId: 1 } } },
    disciplines: [{
        id: 'd1',
        name: 'Horsemanship',
        association_id: 'AQHA',
        divisionDates: { amateur: '2026-11-07' },
        patternGroups: [{ divisions: [{ id: 'amateur', name: 'Amateur' }] }],
    }],
    ...over,
});

describe('buildScoringClasses', () => {
    it('makes one row for one class and one judge', () => {
        const rows = buildScoringClasses(show());
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            disciplineName: 'Horsemanship',
            divisionName: 'Amateur',
            judgeName: 'Sara Simons',
            associationId: 'AQHA',
            date: '2026-11-07',
        });
    });

    it('makes one row per judge', () => {
        const rows = buildScoringClasses(show({
            associationJudges: { AQHA: { judges: [{ name: 'Sara Simons' }, { name: 'Mo Holmes' }] } },
        }));
        expect(rows.map((r) => r.judgeName).sort()).toEqual(['Mo Holmes', 'Sara Simons']);
        expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    });

    it('makes separate rows for Go 1 and Go 2', () => {
        const rows = buildScoringClasses(show({
            disciplines: [{
                id: 'd1', name: 'Horsemanship', association_id: 'AQHA',
                divisionGos: { amateur: { go1Date: '2026-11-05', go2Date: '2026-11-07' } },
                patternGroups: [
                    { divisions: [{ id: 'amateur-go1', baseId: 'amateur', name: 'Amateur', goNumber: 1 }] },
                    { divisions: [{ id: 'amateur-go2', baseId: 'amateur', name: 'Amateur', goNumber: 2 }] },
                ],
            }],
        }));
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => [r.goNumber, r.date])).toEqual([[1, '2026-11-05'], [2, '2026-11-07']]);
    });

    it('skips a discipline with no pattern and no score sheet', () => {
        expect(buildScoringClasses(show({ patternSelections: {} }))).toHaveLength(0);
    });

    it('uses the show start date when a division has no date', () => {
        const rows = buildScoringClasses(show({
            disciplines: [{
                id: 'd1', name: 'Horsemanship', association_id: 'AQHA',
                patternGroups: [{ divisions: [{ id: 'amateur', name: 'Amateur' }] }],
            }],
        }));
        expect(rows[0].date).toBe('2026-11-05');
    });

    it('keeps an AQHA-only division out of the APHA rows of a dual show', () => {
        const rows = buildScoringClasses(show({
            associations: { AQHA: true, APHA: true },
            associationJudges: {
                AQHA: { judges: [{ name: 'Sara Simons' }] },
                APHA: { judges: [{ name: 'Mo Holmes' }] },
            },
            disciplines: [{
                id: 'd1', name: 'Horsemanship',
                patternGroups: [{ divisions: [{ id: 'a', name: 'Amateur' }] }],
            }],
        }));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ associationId: 'AQHA', judgeName: 'Sara Simons' });
    });

    it('returns an empty list for an empty show', () => {
        expect(buildScoringClasses({})).toEqual([]);
        expect(buildScoringClasses(null)).toEqual([]);
    });
});
