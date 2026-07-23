import { describe, it, expect } from 'vitest';
import { buildOrdinalPrefix, buildScoresheetDownloadName } from '@/lib/scoresheetLookup';

// A 225-sheet download only stays in the on-screen sort order if the file names
// sort that way after unzipping — that is what the numeric prefix is for.

describe('buildOrdinalPrefix', () => {
    it('pads to the width of the batch so 10 never sorts before 9', () => {
        expect(buildOrdinalPrefix(9, 225)).toBe('009 - ');
        expect(buildOrdinalPrefix(10, 225)).toBe('010 - ');
        expect(buildOrdinalPrefix(225, 225)).toBe('225 - ');
    });

    it('keeps at least 3 digits for small batches', () => {
        expect(buildOrdinalPrefix(2, 5)).toBe('002 - ');
    });

    it('grows past 999 without breaking the order', () => {
        expect(buildOrdinalPrefix(999, 1200)).toBe('0999 - ');
        expect(buildOrdinalPrefix(1000, 1200)).toBe('1000 - ');
    });

    it('returns nothing for a single-file download', () => {
        expect(buildOrdinalPrefix(null, null)).toBe('');
        expect(buildOrdinalPrefix(0, 10)).toBe('');
    });
});

describe('buildScoresheetDownloadName', () => {
    const sheet = {
        disciplineName: 'Ranch Riding',
        divisionName: 'custom-Junior 8-13 Intro',
        judgeName: 'Mo Holmes',
        file_name: 'upload.pdf',
    };

    it('names a single download by class, with no number', () => {
        expect(buildScoresheetDownloadName(sheet, 'https://x/y.pdf'))
            .toBe('Ranch Riding - custom-Junior 8-13 Intro - Mo Holmes.pdf');
    });

    it('numbers a bulk download by its position in the sorted list', () => {
        expect(buildScoresheetDownloadName(sheet, 'https://x/y.pdf', 7, 225))
            .toBe('007 - Ranch Riding - custom-Junior 8-13 Intro - Mo Holmes.pdf');
    });

    it('still numbers a sheet that has no class details', () => {
        expect(buildScoresheetDownloadName({ file_name: 'scan.png' }, 'https://x/y.png', 3, 12))
            .toBe('003 - scan.png');
    });

    it('uses .png for image templates', () => {
        expect(buildScoresheetDownloadName({ ...sheet, file_name: 'template.png' }, 'https://x/y.png'))
            .toBe('Ranch Riding - custom-Junior 8-13 Intro - Mo Holmes.png');
    });
});
