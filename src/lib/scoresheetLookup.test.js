import { describe, it, expect } from 'vitest';
import { buildOrdinalPrefix, buildScoresheetDownloadName, buildMergedPdfName } from '@/lib/scoresheetLookup';

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

    // A two-go class prints two otherwise identical sheets; the go keeps them apart.
    it('names the go when the class runs twice', () => {
        expect(buildScoresheetDownloadName({ ...sheet, goNumber: 2 }, 'https://x/y.pdf'))
            .toBe('Ranch Riding - custom-Junior 8-13 Intro (Go 2) - Mo Holmes.pdf');
    });

    it('leaves single-go classes unchanged', () => {
        expect(buildScoresheetDownloadName({ ...sheet, goNumber: null }, 'https://x/y.pdf'))
            .toBe('Ranch Riding - custom-Junior 8-13 Intro - Mo Holmes.pdf');
    });
});

// The merged packet is printed and stacked on a table, so its file name has to say which
// show it came from as well as which pile it is — bundles from several shows sit side by
// side, and "Mo Holmes - Score Sheets.pdf" three times over is useless.
describe('buildMergedPdfName', () => {
    const judges = new Set(['Mo Holmes']);
    const disciplines = new Set(['English Equitation']);

    it('leads with the show name, then narrows by a single-value filter', () => {
        expect(buildMergedPdfName([judges], 'Fall Classic'))
            .toBe('Fall Classic - Mo Holmes - Score Sheets.pdf');
    });

    it('chains several single-value filters after the show name, in the order given', () => {
        expect(buildMergedPdfName([judges, disciplines], 'Fall Classic'))
            .toBe('Fall Classic - Mo Holmes - English Equitation - Score Sheets.pdf');
    });

    it('ignores a filter with several values, since "2 Selected" names nothing', () => {
        expect(buildMergedPdfName([new Set(['Mo Holmes', 'Lanae McDonald'])], 'Fall Classic'))
            .toBe('Fall Classic - Score Sheets.pdf');
    });

    it('is just the show name when nothing is filtered', () => {
        expect(buildMergedPdfName([new Set(), undefined], 'Fall Classic'))
            .toBe('Fall Classic - Score Sheets.pdf');
    });

    it('still names the packet when the show has no name', () => {
        expect(buildMergedPdfName([judges], '')).toBe('Mo Holmes - Score Sheets.pdf');
        expect(buildMergedPdfName([], '')).toBe('Score Sheets.pdf');
    });

    it('takes a suffix so the Patterns tab does not label its packet "Score Sheets"', () => {
        expect(buildMergedPdfName([disciplines], 'Fall Classic', 'Patterns'))
            .toBe('Fall Classic - English Equitation - Patterns.pdf');
        expect(buildMergedPdfName([], '', 'Patterns')).toBe('Patterns.pdf');
    });

    it('strips characters that are illegal in a file name', () => {
        expect(buildMergedPdfName([new Set(['Level I/II: Go 1'])], 'Show'))
            .toBe('Show - Level I-II- Go 1 - Score Sheets.pdf');
    });
});
