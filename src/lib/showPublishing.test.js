import { describe, it, expect } from 'vitest';
import { isShowPublished } from '@/lib/showPublishing';

// This gate decides whether an exhibitor at the arena can see a completed score
// sheet. Getting it wrong either leaks unfinished results or hides finished ones.

describe('isShowPublished', () => {
    it('publishes on the statuses the public Event page already treats as live', () => {
        expect(isShowPublished({ status: 'Published' })).toBe(true);
        expect(isShowPublished({ status: 'Final' })).toBe(true);
        expect(isShowPublished({ status: 'Publication' })).toBe(true);
        expect(isShowPublished({ status: 'published' })).toBe(true);
    });

    it('publishes when the results module alone is published', () => {
        expect(isShowPublished({
            status: 'Draft',
            project_data: { moduleStatuses: { results: 'published' } },
        })).toBe(true);
    });

    it('stays private for a draft show', () => {
        expect(isShowPublished({ status: 'Draft' })).toBe(false);
        expect(isShowPublished({ status: 'Apprvd & Paid' })).toBe(false);
        expect(isShowPublished({
            status: 'Draft',
            project_data: { moduleStatuses: { results: 'locked', patternBook: 'published' } },
        })).toBe(false);
    });

    it('stays private when the show could not be loaded', () => {
        expect(isShowPublished(null)).toBe(false);
        expect(isShowPublished(undefined)).toBe(false);
        expect(isShowPublished({})).toBe(false);
    });
});
