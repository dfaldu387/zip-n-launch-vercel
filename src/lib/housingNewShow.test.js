import { describe, it, expect } from 'vitest';
import { nextShowNumber, validateShowDetails, buildNewShowRow } from './housingNewShow';

describe('nextShowNumber', () => {
    it('starts at 1', () => expect(nextShowNumber([])).toBe(1));
    it('goes one past the highest numeric and ignores free text', () => {
        const rows = [
            { project_data: { showNumber: 3 } },
            { project_data: { showNumber: '7' } },
            { project_data: { showNumber: '2024-001' } },
            { project_data: {} },
        ];
        expect(nextShowNumber(rows)).toBe(8);
    });
});

describe('validateShowDetails', () => {
    it('requires name and both dates', () => {
        expect(Object.keys(validateShowDetails({}))).toEqual(['showName', 'startDate', 'endDate']);
    });
    it('rejects end before start', () => {
        const e = validateShowDetails({ showName: 'A', startDate: '2026-09-20', endDate: '2026-09-18' });
        expect(e.endDate).toMatch(/before/);
    });
    it('passes with valid details; venue optional', () => {
        expect(validateShowDetails({ showName: 'A', startDate: '2026-09-18', endDate: '2026-09-20' })).toEqual({});
    });
});

describe('buildNewShowRow', () => {
    it('builds a draft show row', () => {
        const r = buildNewShowRow({
            details: { showName: ' Fair ', startDate: '2026-09-18', endDate: '2026-09-20', venueName: ' Ranch ', venueAddress: '' },
            userId: 'u1', showNumber: 4, id: 'x',
        });
        expect(r).toMatchObject({ id: 'x', project_name: 'Fair', project_type: 'show', status: 'draft', user_id: 'u1' });
        expect(r.project_data).toMatchObject({ showName: 'Fair', showNumber: 4, venueName: 'Ranch', venueAddress: '' });
    });
});
