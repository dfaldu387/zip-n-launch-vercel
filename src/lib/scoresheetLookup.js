// Uploads can be PDFs or legacy images — decide how to render by file name / URL extension.
export const isPdfSource = (nameOrUrl) => /\.pdf(\?|#|$)/i.test(nameOrUrl || '');

// Score sheets and accessory documents (cheat sheets) share tbl_scoresheet, separated by doc_type.
export const SCORESHEET_DOC_TYPE = 'scoresheet';
export const ACCESSORY_DOC_TYPE = 'accessory';

// The table holds older duplicate rows for the same association + discipline that have no city_state.
// Prefer a row that has a city (e.g. Colorado 4-H), then the most recently uploaded one.
export const preferBestScoresheet = (query, docType = SCORESHEET_DOC_TYPE) =>
    query
        .eq('doc_type', docType)
        .order('city_state', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

// These get printed and sorted by hand at the show, so the file name has to say which class it is,
// e.g. "Ranch Riding - custom-Junior 8-13 Intro - Judge Smith.pdf" instead of a storage UUID.
export const buildScoresheetDownloadName = (scoresheet, sourceUrl) => {
    const isPdf = isPdfSource(scoresheet?.file_name)
        || isPdfSource(scoresheet?.storage_path)
        || isPdfSource(sourceUrl);
    const extension = isPdf ? 'pdf' : 'png';

    const parts = [scoresheet?.disciplineName, scoresheet?.divisionName, scoresheet?.judgeName].filter(Boolean);
    if (parts.length === 0) {
        return scoresheet?.file_name
            || scoresheet?.storage_path?.split('/').pop()
            || `scoresheet.${extension}`;
    }

    const base = parts.join(' - ').replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
    return `${base}.${extension}`;
};

// Keep one row per discipline after a query that can return duplicates.
export const dedupeByDiscipline = (rows) => {
    const best = new Map();
    for (const row of rows || []) {
        const key = (row.discipline || '').trim().toLowerCase();
        if (!best.has(key)) best.set(key, row);
    }
    return Array.from(best.values());
};
