import { describe, it, expect } from 'vitest';
import { groupShowRecords } from './showGrouping';

const row = (id, name, type, startDate, endDate, extra = {}) => ({
    id, project_name: name, project_type: type,
    project_data: { startDate, endDate, ...extra },
});

describe('groupShowRecords', () => {
    it('merges a show and its pattern books with the same name and dates', () => {
        const g = groupShowRecords([
            row('a', 'Larimer County Fair', 'pattern_book', '2026-07-23', '2026-07-28'),
            row('b', 'larimer county  fair', 'show', '2026-07-23', '2026-07-28'),
        ]);
        expect(g).toHaveLength(1);
        expect(g[0].primary.id).toBe('b');
        expect(g[0].members).toHaveLength(2);
    });

    it('keeps a same-name show with different dates separate', () => {
        const g = groupShowRecords([
            row('a', 'Larimer County Fair', 'show', '2026-07-23', '2026-07-28'),
            row('b', 'Larimer County Fair', 'show', '2026-09-17', '2026-09-19'),
        ]);
        expect(g).toHaveLength(2);
    });

    it('merges an explicit link only when the dates match', () => {
        const same = groupShowRecords([
            row('show', 'Fair', 'show', '2026-07-01', '2026-07-02'),
            row('book', 'Fair Patterns', 'pattern_book', '2026-07-01', '2026-07-02', { linkedProjectId: 'show' }),
        ]);
        expect(same).toHaveLength(1);

        const nextYear = groupShowRecords([
            row('show', 'Fair', 'show', '2026-07-01', '2026-07-02'),
            row('copy', 'Fair 2027', 'show', '2027-07-01', '2027-07-02', { linkedProjectId: 'show' }),
        ]);
        expect(nextYear).toHaveLength(2);
    });

    it('folds a dateless record into the one dated show with the same name', () => {
        const g = groupShowRecords([
            row('d', 'US Nationals 2026', 'show', '2026-10-22', '2026-10-26'),
            row('n', 'US Nationals 2026', 'show', null, null),
        ]);
        expect(g).toHaveLength(1);
        expect(g[0].primary.id).toBe('d');
    });

    it('does not fold a dateless record when two dated shows share the name', () => {
        const g = groupShowRecords([
            row('a', 'Larimer County Fair', 'show', '2026-07-23', '2026-07-28'),
            row('b', 'Larimer County Fair', 'show', '2026-09-17', '2026-09-19'),
            row('n', 'Larimer County Fair', 'show', null, null),
        ]);
        expect(g).toHaveLength(3);
    });

    it('keeps order and handles empty input', () => {
        expect(groupShowRecords()).toEqual([]);
        const g = groupShowRecords([row('x', 'A', 'show', null, null), row('y', 'B', 'show', null, null)]);
        expect(g.map(x => x.primary.id)).toEqual(['x', 'y']);
    });
});
