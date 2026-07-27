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

// The "one PDF" download needs every sheet to be a PDF page, but image-backed templates
// render to PNG. Wrap one in a fixed US Letter page rather than a page the size of the
// source pixels — a packet of mixed page sizes makes the printer re-scale sheet by sheet,
// which is exactly the manual work this download exists to remove.
export const imageBlobToPdfBlob = async (blob) => {
    const { PDFDocument } = await import('pdf-lib');
    const bytes = await blob.arrayBuffer();
    const pdf = await PDFDocument.create();

    const isJpeg = /jpe?g/i.test(blob.type || '');
    const image = isJpeg ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);

    const landscape = image.width > image.height;
    const pageWidth = landscape ? 792 : 612;
    const pageHeight = landscape ? 612 : 792;
    const page = pdf.addPage([pageWidth, pageHeight]);

    // Fit inside the page, centred, aspect ratio kept — never crop a judge's grid.
    const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
    });

    return new Blob([await pdf.save()], { type: 'application/pdf' });
};

// The merged packet gets printed and then stacked on a table, so the file name has to say
// whose pile it is — "Mo Holmes - Score Sheets.pdf", not "Scoresheets.pdf". Only filters
// narrowed to a single value contribute; "2 Selected" tells the person holding it nothing.
export const buildMergedPdfName = (filterSets = [], fallback = '') => {
    const single = (set) => {
        if (!set || typeof set.size !== 'number' || set.size !== 1) return null;
        const value = String(Array.from(set)[0] || '').trim();
        return value || null;
    };

    const label = filterSets.map(single).filter(Boolean).join(' - ')
        || String(fallback || '').trim();

    const safe = label.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
    return safe ? `${safe} - Score Sheets.pdf` : 'Score Sheets.pdf';
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
