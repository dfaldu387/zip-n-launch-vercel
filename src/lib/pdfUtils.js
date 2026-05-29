import { pdfjs } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

const dataUrlToUint8Array = (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

export const generateQrPngDataUrl = async (url, size = 256) =>
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: size });

export const pdfToDataUrls = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = srcDoc.getPageCount();

    if (pageCount > 5) {
        throw new Error(`PDF has ${pageCount} pages. Maximum allowed is 5.`);
    }

    const results = [];
    for (let i = 0; i < pageCount; i++) {
        const newDoc = await PDFDocument.create();
        const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
        newDoc.addPage(copiedPage);
        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        results.push({ dataUrl, blob });
    }
    return results;
};

// Normalize common OCR artifacts and encoding issues
const normalizeText = (text) => {
    return text
        .replace(/[\u2018\u2019\u201A]/g, "'")    // smart single quotes
        .replace(/[\u201C\u201D\u201E]/g, '"')     // smart double quotes
        .replace(/\u2013/g, '-')                    // en-dash
        .replace(/\u2014/g, '--')                   // em-dash
        .replace(/\ufb01/g, 'fi')                   // fi ligature
        .replace(/\ufb02/g, 'fl')                   // fl ligature
        .replace(/\ufb03/g, 'ffi')                  // ffi ligature
        .replace(/\ufb04/g, 'ffl')                  // ffl ligature
        .replace(/\s+/g, ' ')                       // collapse whitespace
        .trim();
};

export const extractPatternSteps = async (pdfFile) => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
    }

    fullText = normalizeText(fullText);

    // Try standard "1." marker first, then fallback to "1)" or "1:" formats
    let startIndex = fullText.indexOf('1.');
    if (startIndex === -1) {
        const altMatch = fullText.match(/(?:^|\s)(1[\)\:])\s/);
        startIndex = altMatch ? fullText.indexOf(altMatch[1]) : -1;
    }

    if (startIndex === -1) {
        // No numbered steps found — return empty instead of throwing
        return {};
    }

    const endIndex = fullText.toLowerCase().indexOf('pattern complete');
    const effectiveEndIndex = endIndex === -1 ? fullText.length : endIndex;

    const patternText = fullText.substring(startIndex, effectiveEndIndex).trim();

    // Support "1.", "1)", and "1:" step formats
    const steps = patternText
      .split(/\s+(?=\d+[\.\)\:])/g)
      .map(step => step.trim())
      .filter(Boolean);

    const stepMap = {};
    steps.forEach(step => {
        const match = step.match(/^(\d+)[\.\)\:]\s*(.*)/);
        if (match) {
            const stepNumber = parseInt(match[1], 10);
            let description = match[2].trim();
            if (description) {
                stepMap[stepNumber] = description;
            }
        }
    });

    return stepMap;
};

export const extractPatternStepsWithProgress = async (pdfFile, onProgress) => {
    onProgress?.({ status: 'loading', message: 'Reading PDF...' });

    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let fullText = '';

    onProgress?.({ status: 'extracting', message: `Extracting text from ${numPages} page${numPages !== 1 ? 's' : ''}...` });

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
    }

    fullText = normalizeText(fullText);

    onProgress?.({ status: 'parsing', message: 'Parsing maneuver steps...' });

    let startIndex = fullText.indexOf('1.');
    if (startIndex === -1) {
        const altMatch = fullText.match(/(?:^|\s)(1[\)\:])\s/);
        startIndex = altMatch ? fullText.indexOf(altMatch[1]) : -1;
    }

    if (startIndex === -1) {
        onProgress?.({ status: 'done', message: 'No numbered steps found in PDF text.' });
        return {};
    }

    const endIndex = fullText.toLowerCase().indexOf('pattern complete');
    const effectiveEndIndex = endIndex === -1 ? fullText.length : endIndex;
    const patternText = fullText.substring(startIndex, effectiveEndIndex).trim();

    const steps = patternText
      .split(/\s+(?=\d+[\.\)\:])/g)
      .map(step => step.trim())
      .filter(Boolean);

    const stepMap = {};
    steps.forEach(step => {
        const match = step.match(/^(\d+)[\.\)\:]\s*(.*)/);
        if (match) {
            const stepNumber = parseInt(match[1], 10);
            let description = match[2].trim();
            if (description) {
                stepMap[stepNumber] = description;
            }
        }
    });

    onProgress?.({ status: 'done', message: `Found ${Object.keys(stepMap).length} steps` });
    return stepMap;
};

// Group text items into lines based on Y-position proximity
const groupItemsIntoLines = (items, yTolerance = 3) => {
    if (items.length === 0) return [];

    // Sort by Y descending (top to bottom in PDF coords), then X ascending (left to right)
    const sorted = [...items].sort((a, b) => {
        const yA = a.transform[5];
        const yB = b.transform[5];
        if (Math.abs(yA - yB) > yTolerance) return yB - yA; // higher Y = higher on page
        return a.transform[4] - b.transform[4]; // left to right
    });

    const lines = [];
    let currentLine = [sorted[0]];
    let currentY = sorted[0].transform[5];

    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i];
        const itemY = item.transform[5];
        if (Math.abs(itemY - currentY) <= yTolerance) {
            currentLine.push(item);
        } else {
            // Sort current line left-to-right before pushing
            currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
            lines.push(currentLine);
            currentLine = [item];
            currentY = itemY;
        }
    }
    // Push last line
    currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
    lines.push(currentLine);

    return lines;
};

// Extract ALL text from a PDF, optionally filtered by a region
// bounds: { x, y, width, height } as normalized fractions (0-1) of page dimensions, or null for full page
export const extractAllTextFromRegion = async (pdfFile, bounds = null) => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    let filteredItems = textContent.items.filter(item => item.str.trim().length > 0);

    if (bounds) {
        // Convert normalized bounds to PDF coordinate space
        // PDF origin is bottom-left; bounds origin is top-left (image coords)
        const pdfX = bounds.x * viewport.width;
        const pdfY = (1 - bounds.y - bounds.height) * viewport.height; // flip Y axis
        const pdfW = bounds.width * viewport.width;
        const pdfH = bounds.height * viewport.height;

        filteredItems = filteredItems.filter(item => {
            const itemX = item.transform[4];
            const itemY = item.transform[5];
            return (
                itemX >= pdfX &&
                itemX <= pdfX + pdfW &&
                itemY >= pdfY &&
                itemY <= pdfY + pdfH
            );
        });
    }

    const lineGroups = groupItemsIntoLines(filteredItems);
    const lines = lineGroups.map(group =>
        normalizeText(group.map(item => item.str).join(' '))
    ).filter(line => line.length > 0);

    const rawText = lines.join('\n');

    return { rawText, lines };
};

// Convenience wrapper: extract ALL text from page 1 with no region filter
export const extractAllText = async (pdfFile) => {
    return extractAllTextFromRegion(pdfFile, null);
};

// Words that typically appear in a pattern Key/Legend (the small symbol box
// in a corner of the pattern PDF). Case-insensitive whole-word match.
const KEY_INDICATOR_WORDS = [
    'walk', 'trot', 'jog', 'lope', 'canter', 'gallop',
    'extended', 'collected',
    'back', 'sidepass', 'side pass', 'back/side pass',
    'turn around', 'turnaround', 'rollback', 'reverse',
    'strides', 'of strides',
];

/**
 * Attempt to auto-detect the pattern Key (legend box) on page 1 of a PDF.
 *
 * Returns a normalized 0–1 rect ({x, y, w, h}) over the rendered page image
 * if a likely key cluster is found, otherwise null. Uses image-coordinate
 * convention (origin top-left), matching how the rendered PDF image is
 * displayed in the upload wizard.
 *
 * Strategy:
 *   1. Find "label-like" text items (short, no leading list number, contain
 *      a legend word). This filters out the maneuver list, which uses the
 *      same vocabulary but in long sentences ("1. Walk into box, 360° right").
 *   2. Cluster surviving matches by spatial proximity.
 *   3. Pick the densest cluster whose bounding box fits the size budget for
 *      a legend (small fraction of the page).
 */
export const detectPatternKeyRect = async (pdfFile) => {
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        const items = textContent.items.filter(it => it.str && it.str.trim().length > 0);
        if (items.length === 0) return null;

        // 1. Build label candidates. A key entry is a short standalone label
        //    like "Walk", "Extended Lope", "Back/Side Pass". We exclude items
        //    that look like maneuver-list lines ("1. Walk into box, ...").
        const LIST_PREFIX = /^\s*\d+\s*[\.\)]/;
        const candidates = [];
        for (const it of items) {
            const raw = it.str.trim();
            if (raw.length === 0 || raw.length > 30) continue;     // long sentence → not a label
            if (LIST_PREFIX.test(raw)) continue;                    // "1." / "2)" → maneuver list
            const lc = raw.toLowerCase();
            const matchesWord = KEY_INDICATOR_WORDS.some(w => lc === w || lc.split(/[^a-z]+/).includes(w));
            if (!matchesWord) continue;

            const x = it.transform[4];
            const y = it.transform[5];
            const w = it.width || 0;
            const h = it.height || (it.transform[3] || 10);
            candidates.push({ x, y, w, h, text: raw });
        }

        if (candidates.length < 3) return null;

        // 2. Cluster spatially. Two candidates belong to the same cluster if
        //    they're within ~12% of the page in both X and Y. Iterative merge.
        const proxX = viewport.width * 0.12;
        const proxY = viewport.height * 0.12;
        const clusters = [];
        for (const c of candidates) {
            const fit = clusters.find(cl =>
                cl.items.some(o =>
                    Math.abs(((o.x + o.w / 2)) - ((c.x + c.w / 2))) < proxX &&
                    Math.abs(o.y - c.y) < proxY
                )
            );
            if (fit) {
                fit.items.push(c);
            } else {
                clusters.push({ items: [c] });
            }
        }

        // 3. Compute bbox per cluster and score. Reject clusters whose bbox is
        //    too big — those are the maneuver list, not the legend.
        const maxClusterW = viewport.width * 0.35;
        const maxClusterH = viewport.height * 0.45;
        const viable = [];
        for (const cl of clusters) {
            if (cl.items.length < 3) continue;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const it of cl.items) {
                if (it.x < minX) minX = it.x;
                if (it.y < minY) minY = it.y;
                if (it.x + it.w > maxX) maxX = it.x + it.w;
                if (it.y + it.h > maxY) maxY = it.y + it.h;
            }
            const w = maxX - minX;
            const h = maxY - minY;
            if (w > maxClusterW || h > maxClusterH) continue;
            // Density score: prefer clusters with more matches in smaller area.
            const area = Math.max(1, w * h);
            const score = cl.items.length / Math.sqrt(area);
            viable.push({ minX, minY, maxX, maxY, score });
        }

        if (viable.length === 0) return null;
        // Prefer clusters in the right half / bottom half of the page (a key
        // is almost always in a corner). Cheap bias on top of the density
        // score so we still pick the densest match when ties happen elsewhere.
        viable.forEach(v => {
            const cxNorm = (v.minX + v.maxX) / 2 / viewport.width;
            const cyNorm = 1 - (v.minY + v.maxY) / 2 / viewport.height; // image-coords
            const cornerBias = (cxNorm > 0.5 ? 0.1 : 0) + (cyNorm > 0.5 ? 0.1 : 0);
            v.score += cornerBias;
        });
        viable.sort((a, b) => b.score - a.score);
        const best = viable[0];

        // 4. Pad generously — the red border should frame the legend with
        //    visible space on every side, not sit flush against it.
        const padX = viewport.width * 0.035;
        const padY = viewport.height * 0.035;
        const x0 = Math.max(0, best.minX - padX);
        const y0 = Math.max(0, best.minY - padY);
        const x1 = Math.min(viewport.width, best.maxX + padX);
        const y1 = Math.min(viewport.height, best.maxY + padY);

        // 5. Convert PDF coords (origin bottom-left) → image coords (top-left),
        //    then normalize to 0–1.
        return {
            x: x0 / viewport.width,
            y: 1 - (y1 / viewport.height),
            w: (x1 - x0) / viewport.width,
            h: (y1 - y0) / viewport.height,
        };
    } catch (err) {
        console.warn('detectPatternKeyRect failed:', err);
        return null;
    }
};

/**
 * Fallback: scan an already-rendered PDF page image for a content cluster
 * in the bottom-right quadrant of the page. Used when text-based key
 * detection finds nothing — common when the legend is embedded as a raster
 * image rather than selectable PDF text.
 *
 * Scans pixels in a search window (default: right 35% × bottom 30%), finds
 * the bounding box of "dark" pixels, and returns a normalized 0–1 rect.
 * Returns null if too little content is found (i.e. the corner is blank).
 *
 * @param {string} imageDataUrl - rendered PDF page as a data URL
 * @param {Object} [options]
 * @param {number} [options.searchRight=0.35]  - fraction of width to scan from the right edge
 * @param {number} [options.searchBottom=0.30] - fraction of height to scan from the bottom edge
 * @param {number} [options.darkThreshold=210] - per-channel max value to count as "ink"
 * @param {number} [options.minFillRatio=0.005] - min dark-pixel density to consider a hit
 */
export const detectKeyFromImage = (imageDataUrl, options = {}) => {
    const {
        // Tight search window over just the bottom-right corner — keeps
        // the maneuver list and pattern arrows out of the scan entirely so
        // they can never anchor the top of the bbox.
        searchRight = 0.22,
        searchBottom = 0.30,
        darkThreshold = 215,
        minFillRatio = 0.003,
    } = options;
    return new Promise((resolve) => {
        if (!imageDataUrl) { resolve(null); return; }
        const img = new Image();
        const timeout = setTimeout(() => resolve(null), 5000);
        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);

                const sx = Math.floor(img.width * (1 - searchRight));
                const sy = Math.floor(img.height * (1 - searchBottom));
                const sw = img.width - sx;
                const sh = img.height - sy;
                if (sw <= 0 || sh <= 0) { resolve(null); return; }

                const data = ctx.getImageData(sx, sy, sw, sh).data;
                const step = 2;

                // Build a row-density profile by sampling rows on a step
                // grid. rowCounts[i] holds the dark-pixel count for the
                // i-th sampled row. sampleY[i] holds its y coordinate
                // inside the search window. Keeping these as parallel
                // arrays avoids the off-by-parity bug we had when indexing
                // a full-sized array on a step grid.
                const rowCounts = [];
                const sampleY = [];
                let totalHits = 0;
                for (let y = 0; y < sh; y += step) {
                    let rowCount = 0;
                    for (let x = 0; x < sw; x += step) {
                        const i = (y * sw + x) * 4;
                        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                        if (a === 0) continue;
                        if (r < darkThreshold && g < darkThreshold && b < darkThreshold) {
                            rowCount++;
                            totalHits++;
                        }
                    }
                    rowCounts.push(rowCount);
                    sampleY.push(y);
                }

                const cells = rowCounts.length * Math.ceil(sw / step);
                if (totalHits / cells < minFillRatio) { resolve(null); return; }

                // A row is "active" if it carries real content. Threshold
                // is high enough that scattered pattern-diagram pixels
                // (dashed arrows, stray marks above the key) don't qualify.
                const activeThreshold = 5;

                // Walk UP from the last sampled row toward the first.
                // Continue as long as we keep finding active rows; stop on
                // the first long enough whitespace gap (≥ 2% of the page
                // height). The first active row we found above that gap is
                // the true top of the key.
                const gapPixelLimit = Math.max(8, Math.floor(img.height * 0.02));
                let topIdx = rowCounts.length - 1;
                let bottomIdx = -1;
                let gapPixels = 0;
                for (let i = rowCounts.length - 1; i >= 0; i--) {
                    if (rowCounts[i] >= activeThreshold) {
                        topIdx = i;
                        if (bottomIdx < 0) bottomIdx = i;
                        gapPixels = 0;
                    } else {
                        gapPixels += step;
                        if (bottomIdx >= 0 && gapPixels >= gapPixelLimit) break;
                    }
                }
                if (bottomIdx < 0) { resolve(null); return; }

                const minY = sampleY[topIdx];
                const maxY = sampleY[bottomIdx];

                // For X bounds, scan only the active row range so we don't
                // pull in content from the excluded rows above.
                let minX = Infinity, maxX = -Infinity;
                for (let y = minY; y <= maxY; y += step) {
                    for (let x = 0; x < sw; x += step) {
                        const i = (y * sw + x) * 4;
                        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                        if (a === 0) continue;
                        if (r < darkThreshold && g < darkThreshold && b < darkThreshold) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                        }
                    }
                }
                if (minX === Infinity) { resolve(null); return; }

                // Uniform "frame" padding — same breathing room on every
                // side so the red border looks like a deliberate frame
                // around the key + attribution, not a tight outline. Roughly
                // a 7×6 frame around a 6×5 content area.
                const padX = img.width * 0.025;
                const padTop = img.height * 0.018;
                const padBottom = img.height * 0.035;
                const x0 = Math.max(0, sx + minX - padX);
                const y0 = Math.max(0, sy + minY - padTop);
                const x1 = Math.min(img.width, sx + maxX + padX);
                const y1 = Math.min(img.height, sy + maxY + padBottom);

                // Sanity: reject if the cluster fills the whole search area
                // (means there's just noise, not a discrete legend).
                if ((x1 - x0) >= sw * 0.98 && (y1 - y0) >= sh * 0.98) {
                    resolve(null);
                    return;
                }

                resolve({
                    x: x0 / img.width,
                    y: y0 / img.height,
                    w: (x1 - x0) / img.width,
                    h: (y1 - y0) / img.height,
                });
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = () => { clearTimeout(timeout); resolve(null); };
        img.src = imageDataUrl;
    });
};

export const generateScoreSheetPdf = async (templatePath, steps, patternInfo, qrUrl = null) => {
    const templateBytes = await fetch(templatePath).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Minimal margins for full-page use
    const margin = 20;

    // QR code in the top-right corner — Robert wants it in the same spot every
    // time so people get used to going there.
    if (qrUrl) {
        const qrDataUrl = await generateQrPngDataUrl(qrUrl, 256);
        const qrImage = await pdfDoc.embedPng(dataUrlToUint8Array(qrDataUrl));
        const qrSize = 54;
        page.drawImage(qrImage, {
            x: width - margin - qrSize,
            y: height - margin - qrSize,
            width: qrSize,
            height: qrSize,
        });
    }

    // Header: class name
    page.drawText(patternInfo.className || 'Equipatterns', {
        x: width / 2,
        y: height - margin - 20,
        font: helveticaBoldFont,
        size: 20,
        color: rgb(0, 0, 0),
        maxWidth: width - margin * 2,
        lineHeight: 24,
        xAlign: 'center',
    });

    // Sub-header: pattern name
    if (patternInfo.patternName) {
        page.drawText(patternInfo.patternName, {
            x: width / 2,
            y: height - margin - 42,
            font: helveticaFont,
            size: 14,
            color: rgb(0, 0, 0),
            maxWidth: width - margin * 2,
            lineHeight: 18,
            xAlign: 'center',
        });
    }

    // Grid layout — dynamically sized to fill page
    const cols = 3;
    const rows = 5;
    const gapX = 8;
    const gapY = 6;
    const gridTop = height - margin - 60;
    const gridBottom = margin + 50; // reserve space for penalty/total row
    const gridLeft = margin;
    const gridWidth = width - margin * 2;

    const totalGridH = gridTop - gridBottom;
    const boxWidth = (gridWidth - (cols - 1) * gapX) / cols;
    const boxHeight = (totalGridH - (rows - 1) * gapY) / rows;

    for (const stepNumberStr in steps) {
        const stepNumber = parseInt(stepNumberStr, 10);
        const text = steps[stepNumber];
        if (stepNumber > 15) continue;

        const col = (stepNumber - 1) % cols;
        const row = Math.floor((stepNumber - 1) / cols);

        const x = gridLeft + col * (boxWidth + gapX);
        const y = gridTop - row * (boxHeight + gapY);

        let fontSize = 11;
        let textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
        while (textWidth > boxWidth - 12 && fontSize > 6) {
            fontSize -= 0.5;
            textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
        }

        const textLines = [];
        let currentLine = '';
        const words = text.split(' ');
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (helveticaFont.widthOfTextAtSize(testLine, fontSize) < boxWidth - 12) {
                currentLine = testLine;
            } else {
                textLines.push(currentLine);
                currentLine = word;
            }
        }
        textLines.push(currentLine);

        page.drawText(textLines.join('\n'), {
            x: x + boxWidth / 2,
            y: y - 8,
            font: helveticaFont,
            size: fontSize,
            color: rgb(0, 0, 0),
            lineHeight: fontSize + 2,
            xAlign: 'center',
            yAlign: 'top',
        });
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};