import { supabase } from '@/lib/supabaseClient';

export const fetchImageAsBase64 = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error fetching image as base64:", error);
        return null;
    }
};

/**
 * Compress a base64 image using Canvas API.
 * Resizes to fit within maxWidth × maxHeight (preserving aspect ratio)
 * and outputs JPEG at the given quality.
 */
export const compressImage = (base64, maxWidth = 200, maxHeight = 200, quality = 0.8) => {
    return new Promise((resolve) => {
        if (!base64) { resolve(null); return; }
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            // Scale down if larger than max dimensions
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            // White background (handles PNG transparency)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(null);
        img.src = base64;
    });
};

/**
 * Smart-crop a pattern image (base64): removes baked-in header text at top
 * and summary/legend at bottom, keeping only the diagram portion.
 * Uses pixel scanning to find the largest blank gaps that separate the
 * header and footer regions from the diagram.
 * Falls back to a simple 3% bottom trim if scanning doesn't find clear gaps.
 */
export const cropPatternImageSmart = (base64) => {
    return new Promise((resolve) => {
        if (!base64) { resolve(base64); return; }
        const img = new Image();
        const timeout = setTimeout(() => { resolve(base64); }, 5000);
        img.onload = () => {
            clearTimeout(timeout);
            try {
                const w = img.width;
                const h = img.height;
                const scanCanvas = document.createElement('canvas');
                scanCanvas.width = w;
                scanCanvas.height = h;
                const ctx = scanCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const pixels = ctx.getImageData(0, 0, w, h).data;

                const DARK = 200;
                const step = 2;
                const minDark = Math.max(3, Math.floor(w / step * 0.005));
                const rowDark = new Array(h).fill(0);
                for (let y = 0; y < h; y++) {
                    let cnt = 0;
                    for (let x = 0; x < w; x += step) {
                        const idx = (y * w + x) * 4;
                        if ((pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3 < DARK) cnt++;
                    }
                    rowDark[y] = cnt;
                }

                let firstRow = 0, lastRow = h - 1;
                for (let y = 0; y < h; y++) { if (rowDark[y] > minDark) { firstRow = y; break; } }
                for (let y = h - 1; y >= 0; y--) { if (rowDark[y] > minDark) { lastRow = y; break; } }

                const minGap = Math.floor(h * 0.02);
                const gaps = [];
                let gapStart = null;
                for (let y = firstRow; y <= lastRow; y++) {
                    const blank = rowDark[y] <= minDark;
                    if (blank && gapStart === null) gapStart = y;
                    else if (!blank && gapStart !== null) {
                        const size = y - gapStart;
                        if (size >= minGap) gaps.push({ start: gapStart, end: y, size, mid: (gapStart + y) / 2 / h });
                        gapStart = null;
                    }
                }

                const topGaps = gaps.filter(g => g.mid < 0.45).sort((a, b) => b.size - a.size);
                const bottomGaps = gaps.filter(g => g.mid > 0.55).sort((a, b) => b.size - a.size);

                let cropTop = topGaps[0] ? topGaps[0].end : firstRow;
                let cropBottom = bottomGaps[0] ? bottomGaps[0].start : lastRow;
                const pad = Math.floor(h * 0.008);
                cropTop = Math.max(0, cropTop - pad);
                cropBottom = Math.min(h, cropBottom + pad);
                const cropH = cropBottom - cropTop;

                if (cropH <= 0 || cropH >= h * 0.90) {
                    // Fallback: simple 3% bottom trim
                    const fbH = Math.floor(h * 0.97);
                    const fbCanvas = document.createElement('canvas');
                    fbCanvas.width = w; fbCanvas.height = fbH;
                    fbCanvas.getContext('2d').drawImage(img, 0, 0, w, fbH, 0, 0, w, fbH);
                    resolve(fbCanvas.toDataURL('image/png'));
                    return;
                }

                const outCanvas = document.createElement('canvas');
                outCanvas.width = w; outCanvas.height = cropH;
                const oCtx = outCanvas.getContext('2d');
                oCtx.fillStyle = '#FFFFFF';
                oCtx.fillRect(0, 0, w, cropH);
                oCtx.drawImage(img, 0, cropTop, w, cropH, 0, 0, w, cropH);
                resolve(outCanvas.toDataURL('image/png'));
            } catch (e) {
                resolve(base64);
            }
        };
        img.onerror = () => { clearTimeout(timeout); resolve(base64); };
        img.src = base64;
    });
};

export const fetchPatternAndScoresheetAssets = async (pbbData) => {
    const assetUrls = {
        patterns: {},
        scoresheets: {}
    };

    const patternIds = new Set();
    const scoresheetIds = new Set();

    if (pbbData.patternSelections) {
        Object.values(pbbData.patternSelections).forEach(disciplineSelection => {
            Object.values(disciplineSelection).forEach(selection => {
                // Skip special selection types (judge-assigned, custom-request)
                if (typeof selection === 'object' && selection !== null) {
                    if (selection.type === 'judgeAssigned' || selection.type === 'customRequest') return;
                    const id = selection.patternId || selection.id;
                    if (id) patternIds.add(id);
                } else if (selection) {
                    patternIds.add(selection);
                }
            });
        });
    }

    if (pbbData.scoresheetSelections) {
        Object.values(pbbData.scoresheetSelections).forEach(disciplineSelection => {
            Object.values(disciplineSelection).forEach(scoresheetId => {
                if (scoresheetId) scoresheetIds.add(scoresheetId);
            });
        });
    }

    const fetchPromises = [];

    if (patternIds.size > 0) {
        fetchPromises.push(
            supabase.from('patterns').select('id, preview_image_url').in('id', Array.from(patternIds))
        );
    } else {
        fetchPromises.push(Promise.resolve({ data: [] }));
    }

    if (scoresheetIds.size > 0) {
        fetchPromises.push(
            supabase.from('association_assets').select('id, file_url').in('id', Array.from(scoresheetIds))
        );
    } else {
        fetchPromises.push(Promise.resolve({ data: [] }));
    }

    const [patternsRes, scoresheetsRes] = await Promise.all(fetchPromises);

    // Fetch all images in parallel for better performance
    if (patternsRes.data) {
        const patternFetches = patternsRes.data
            .filter(p => p.preview_image_url)
            .map(async (pattern) => {
                const base64 = await fetchImageAsBase64(pattern.preview_image_url);
                if (base64) assetUrls.patterns[pattern.id] = base64;
            });
        await Promise.all(patternFetches);
    }

    if (scoresheetsRes.data) {
        const scoresheetFetches = scoresheetsRes.data
            .filter(s => s.file_url)
            .map(async (scoresheet) => {
                const base64 = await fetchImageAsBase64(scoresheet.file_url);
                if (base64) assetUrls.scoresheets[scoresheet.id] = base64;
            });
        await Promise.all(scoresheetFetches);
    }

    return assetUrls;
};