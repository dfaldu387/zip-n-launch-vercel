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
 * Smart-crop a pattern image (base64). Strategy:
 *   1. Find bounding box of all rows/cols that contain dark content
 *      (loose threshold so we don't lose thin diagram lines).
 *   2. Within that bounding box, find blank gaps — vertical gaps that
 *      typically separate title/diagram/description, horizontal gaps that
 *      separate diagram from a side-attached numbered list.
 *   3. Use the LARGEST gap in the top zone (mid<0.45) to drop a header,
 *      and the LARGEST gap in the bottom zone (mid>0.55) to drop a
 *      description/legend. Same for left/right columns.
 *   4. Safety: if any crop axis would shrink to <40% of the original
 *      extent, keep the original extent for that axis (avoid catastrophic
 *      cropping where we lose the diagram itself).
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
                const sampledCols = Math.floor(w / step);

                // --- Per-row darkness ---
                const rowDark = new Array(h).fill(0);
                for (let y = 0; y < h; y++) {
                    let cnt = 0;
                    for (let x = 0; x < w; x += step) {
                        const idx = (y * w + x) * 4;
                        if ((pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3 < DARK) cnt++;
                    }
                    rowDark[y] = cnt;
                }

                // "Has any content" threshold. Tuned slightly stricter so faint
                // stray pixels (watermarks, header rules) don't mislocate firstRow.
                const minDarkRow = Math.max(5, Math.floor(sampledCols * 0.008));

                let firstRow = 0, lastRow = h - 1;
                for (let y = 0; y < h; y++) { if (rowDark[y] > minDarkRow) { firstRow = y; break; } }
                for (let y = h - 1; y >= 0; y--) { if (rowDark[y] > minDarkRow) { lastRow = y; break; } }

                // Find blank-row gaps inside the bounding box. Threshold is
                // very small so a thin separator between title/diagram/text
                // still registers.
                const minGap = Math.max(3, Math.floor(h * 0.003)); // 0.3% of height
                const gaps = [];
                let gapStart = null;
                for (let y = firstRow; y <= lastRow; y++) {
                    const blank = rowDark[y] <= minDarkRow;
                    if (blank && gapStart === null) gapStart = y;
                    else if (!blank && gapStart !== null) {
                        const size = y - gapStart;
                        if (size >= minGap) gaps.push({ start: gapStart, end: y, size, mid: (gapStart + y) / 2 / h });
                        gapStart = null;
                    }
                }

                // Top zone = upper 48%, bottom zone = lower 48%. Wider than
                // before so gaps near vertical center still count.
                const topGaps = gaps.filter(g => g.mid < 0.48).sort((a, b) => b.size - a.size);
                const bottomGaps = gaps.filter(g => g.mid > 0.52).sort((a, b) => b.size - a.size);

                let cropTop = topGaps[0] ? topGaps[0].end : firstRow;
                let cropBottom = bottomGaps[0] ? bottomGaps[0].start : lastRow;
                const padY = Math.floor(h * 0.01);
                cropTop = Math.max(0, cropTop - padY);
                cropBottom = Math.min(h, cropBottom + padY);

                // Safety: if our crop would shrink height to <30% of the loose
                // bounding box, abandon — likely the diagram itself got cut.
                const originalContentH = lastRow - firstRow;
                if (cropBottom - cropTop < originalContentH * 0.3) {
                    cropTop = firstRow;
                    cropBottom = lastRow;
                }
                const cropH = cropBottom - cropTop;

                if (cropH <= 0 || cropH >= h * 0.99) {
                    // Fallback: simple 3% bottom trim
                    const fbH = Math.floor(h * 0.97);
                    const fbCanvas = document.createElement('canvas');
                    fbCanvas.width = w; fbCanvas.height = fbH;
                    fbCanvas.getContext('2d').drawImage(img, 0, 0, w, fbH, 0, 0, w, fbH);
                    resolve(fbCanvas.toDataURL('image/png'));
                    return;
                }

                // --- Column crop intentionally disabled ---
                // Heuristic column cropping was cutting INTO diagrams (START
                // labels, arena boundaries) on AQHA / VRH-RHC patterns. The
                // win (auto-removing side-attached numbered lists) wasn't
                // worth the regression risk on horizontal arena patterns.
                // Patterns with embedded side text should be re-uploaded with
                // a cleaner source image (diagram only).
                //
                // We still trim any trailing whitespace using the loose
                // bounding box so width is at least tight.
                const rowStep = 2;
                const sampledRowsInBand = Math.max(1, Math.floor(cropH / rowStep));
                const colDark = new Array(w).fill(0);
                for (let x = 0; x < w; x++) {
                    let cnt = 0;
                    for (let y = cropTop; y < cropBottom; y += rowStep) {
                        const idx = (y * w + x) * 4;
                        if ((pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3 < DARK) cnt++;
                    }
                    colDark[x] = cnt;
                }

                const minDarkCol = Math.max(3, Math.floor(sampledRowsInBand * 0.005));
                let firstCol = 0, lastCol = w - 1;
                for (let x = 0; x < w; x++) { if (colDark[x] > minDarkCol) { firstCol = x; break; } }
                for (let x = w - 1; x >= 0; x--) { if (colDark[x] > minDarkCol) { lastCol = x; break; } }

                const padX = Math.floor(w * 0.015);
                let cropLeft = Math.max(0, firstCol - padX);
                let cropRight = Math.min(w, lastCol + padX);
                let cropW = cropRight - cropLeft;

                if (cropW <= 0 || cropW < w * 0.20) {
                    cropLeft = 0;
                    cropW = w;
                }

                const outCanvas = document.createElement('canvas');
                outCanvas.width = cropW; outCanvas.height = cropH;
                const oCtx = outCanvas.getContext('2d');
                oCtx.fillStyle = '#FFFFFF';
                oCtx.fillRect(0, 0, cropW, cropH);
                oCtx.drawImage(img, cropLeft, cropTop, cropW, cropH, 0, 0, cropW, cropH);
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