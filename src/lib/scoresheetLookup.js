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

// A bulk download has to come out of the ZIP in the order shown on screen, and the only
// thing that survives unzipping is the file name — so number the files.
export const buildOrdinalPrefix = (ordinal, total) => {
    if (!ordinal || ordinal < 1) return '';
    const width = Math.max(3, String(total || ordinal).length);
    return `${String(ordinal).padStart(width, '0')} - `;
};

// These get printed and sorted by hand at the show, so the file name has to say which class it is,
// e.g. "001 - Ranch Riding - custom-Junior 8-13 Intro - Judge Smith.pdf" instead of a storage UUID.
export const buildScoresheetDownloadName = (scoresheet, sourceUrl, ordinal = null, total = null) => {
    const isPdf = isPdfSource(scoresheet?.file_name)
        || isPdfSource(scoresheet?.storage_path)
        || isPdfSource(sourceUrl);
    const extension = isPdf ? 'pdf' : 'png';
    const prefix = buildOrdinalPrefix(ordinal, total);

    const parts = [scoresheet?.disciplineName, scoresheet?.divisionName, scoresheet?.judgeName].filter(Boolean);
    if (parts.length === 0) {
        const fallback = scoresheet?.file_name
            || scoresheet?.storage_path?.split('/').pop()
            || `scoresheet.${extension}`;
        return `${prefix}${fallback}`;
    }

    const base = parts.join(' - ').replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
    return `${prefix}${base}.${extension}`;
};

// The judge scores at the arena from the printed sheet, so the rules page has to travel
// with the grid. Robert's uploads keep them as two separate files, so find the cheat
// sheet that belongs to the same class. Returns null when there isn't a PDF one.
export const findAccessoryDocUrl = async (supabase, { associationAbbrev, discipline }) => {
    if (!associationAbbrev || !discipline) return null;

    const { data, error } = await preferBestScoresheet(
        supabase
            .from('tbl_scoresheet')
            .select('image_url, file_name, city_state')
            .eq('association_abbrev', associationAbbrev)
            .eq('discipline', discipline),
        ACCESSORY_DOC_TYPE,
    ).limit(1);

    if (error) return null;
    const row = data?.[0];
    if (!row?.image_url) return null;
    if (!isPdfSource(row.file_name) && !isPdfSource(row.image_url)) return null;
    return row.image_url;
};

// Join PDFs into one file, in the order given.
export const mergePdfBlobs = async (blobs) => {
    const { PDFDocument } = await import('pdf-lib');
    const merged = await PDFDocument.create();

    for (const blob of blobs) {
        const source = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach(page => merged.addPage(page));
    }

    return new Blob([await merged.save()], { type: 'application/pdf' });
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
