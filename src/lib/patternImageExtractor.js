import { pdfjs } from 'react-pdf';

/**
 * Pattern Image Extractor
 *
 * Two approaches:
 *   1. Auto-detect: Scans the rendered image pixels to find the diagram area
 *      by looking for the large blank gap above and below the drawing.
 *   2. Manual crop: User selects the region visually (handled in the UI component).
 */

const DEFAULT_RENDER_SCALE = 2;

/**
 * Render a PDF page to a canvas.
 */
export async function renderPdfPageToCanvas(pdfFile, scale = DEFAULT_RENDER_SCALE) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    return { canvas, width: viewport.width, height: viewport.height };
}

/**
 * Scan pixel rows of a rendered image to find content boundaries.
 * Returns normalized (0-1) positions of where non-white content exists.
 *
 * Strategy: scan each horizontal row of pixels. A row is "content" if it
 * has enough dark pixels (below brightness threshold). Then find the
 * largest blank gap in the top portion (header→diagram gap) and
 * the largest blank gap in the bottom portion (diagram→footer gap).
 */
function scanContentRows(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // For each row, count how many dark pixels it has
    const rowDarkness = new Array(height).fill(0);
    const DARK_THRESHOLD = 200; // pixel brightness below this = "dark"
    const sampleStep = 2; // sample every 2nd pixel for speed

    for (let y = 0; y < height; y++) {
        let darkCount = 0;
        for (let x = 0; x < width; x += sampleStep) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const brightness = (r + g + b) / 3;
            if (brightness < DARK_THRESHOLD) {
                darkCount++;
            }
        }
        rowDarkness[y] = darkCount;
    }

    // A row is "content" if it has more than a few dark pixels
    // (text or diagram lines)
    const MIN_DARK_PIXELS = Math.max(3, Math.floor(width / sampleStep * 0.005));

    // Find first and last content rows
    let firstContentRow = 0;
    let lastContentRow = height - 1;

    for (let y = 0; y < height; y++) {
        if (rowDarkness[y] > MIN_DARK_PIXELS) {
            firstContentRow = y;
            break;
        }
    }
    for (let y = height - 1; y >= 0; y--) {
        if (rowDarkness[y] > MIN_DARK_PIXELS) {
            lastContentRow = y;
            break;
        }
    }

    // Now find the biggest blank gap in the content area.
    // The pattern PDF typically has: text ... GAP ... diagram ... GAP ... text
    // We want to find the diagram by finding these gaps.

    // Build list of blank runs (consecutive rows with no/minimal content)
    const MIN_GAP_ROWS = Math.floor(height * 0.02); // 2% of page height = meaningful gap
    const gaps = [];
    let gapStart = null;

    for (let y = firstContentRow; y <= lastContentRow; y++) {
        const isBlank = rowDarkness[y] <= MIN_DARK_PIXELS;
        if (isBlank && gapStart === null) {
            gapStart = y;
        } else if (!isBlank && gapStart !== null) {
            const gapSize = y - gapStart;
            if (gapSize >= MIN_GAP_ROWS) {
                gaps.push({ start: gapStart, end: y, size: gapSize, midNorm: ((gapStart + y) / 2) / height });
            }
            gapStart = null;
        }
    }

    // Find the best header gap (gap in the top 45% of the page)
    // and the best footer gap (gap in the bottom 55% of the page)
    const topGaps = gaps.filter(g => g.midNorm < 0.45);
    const bottomGaps = gaps.filter(g => g.midNorm > 0.55);

    // The header gap is the largest gap in the top portion
    const headerGap = topGaps.sort((a, b) => b.size - a.size)[0];
    // The footer gap is the largest gap in the bottom portion
    const footerGap = bottomGaps.sort((a, b) => b.size - a.size)[0];

    // Diagram starts after the header gap, ends before the footer gap
    let diagramTop = headerGap ? headerGap.end / height : firstContentRow / height;
    let diagramBottom = footerGap ? footerGap.start / height : lastContentRow / height;

    // If we didn't find good gaps, use content boundaries with some margin
    if (!headerGap && !footerGap) {
        diagramTop = firstContentRow / height;
        diagramBottom = lastContentRow / height;
    }

    return {
        diagramTop,
        diagramBottom,
        firstContentRow: firstContentRow / height,
        lastContentRow: lastContentRow / height,
        gapCount: gaps.length,
        headerGapFound: !!headerGap,
        footerGapFound: !!footerGap,
    };
}

/**
 * Extract the diagram-only image from a pattern PDF.
 * Uses pixel scanning to find the diagram boundaries.
 */
export async function extractPatternDiagram(pdfFile, options = {}) {
    const { scale = DEFAULT_RENDER_SCALE } = options;

    const { canvas, width, height } = await renderPdfPageToCanvas(pdfFile, scale);

    // Scan pixels to find diagram boundaries
    const scan = scanContentRows(canvas);

    const cropTop = Math.max(0, scan.diagramTop) * height;
    const cropBottom = Math.min(1, scan.diagramBottom) * height;
    const cropHeight = cropBottom - cropTop;

    // If the crop would keep more than 90% of the page, it didn't find good boundaries
    if (cropHeight <= 0 || cropHeight >= height * 0.90) {
        return {
            diagramDataUrl: canvas.toDataURL('image/png'),
            fullImageDataUrl: canvas.toDataURL('image/png'),
            regions: scan,
            cropped: false,
            cropBounds: { top: 0, bottom: 1, heightRatio: 1 },
        };
    }

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = cropHeight;
    const ctx = croppedCanvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);

    ctx.drawImage(
        canvas,
        0, cropTop, width, cropHeight,
        0, 0, width, cropHeight
    );

    return {
        diagramDataUrl: croppedCanvas.toDataURL('image/png'),
        fullImageDataUrl: canvas.toDataURL('image/png'),
        regions: scan,
        cropped: true,
        cropBounds: {
            top: cropTop / height,
            bottom: cropBottom / height,
            heightRatio: cropHeight / height,
        },
    };
}

/**
 * Crop a base64 image using user-specified normalized bounds.
 * Used when the user manually selects the diagram region.
 *
 * @param {string} imageDataUrl - The full page image as data URL
 * @param {object} bounds - { top, bottom } as fractions 0-1 from top of image
 * @returns {Promise<string>} Cropped image data URL
 */
export function cropImageWithBounds(imageDataUrl, bounds) {
    return new Promise((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => resolve(imageDataUrl), 5000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const cropTop = Math.floor(img.height * bounds.top);
                const cropBottom = Math.floor(img.height * bounds.bottom);
                const cropHeight = cropBottom - cropTop;

                if (cropHeight <= 0) {
                    resolve(imageDataUrl);
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = cropHeight;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, cropTop, img.width, cropHeight, 0, 0, img.width, cropHeight);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                resolve(imageDataUrl);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            resolve(imageDataUrl);
        };

        img.src = imageDataUrl;
    });
}

/**
 * Paint white rectangles onto an image and return a new data URL.
 *
 * @param {string} imageDataUrl - source image as data URL
 * @param {Array<{x:number,y:number,w:number,h:number}>} rects - normalized 0-1 rects
 * @returns {Promise<string>} data URL of the new image with whiteouts baked in
 */
export function applyWhiteoutsToImage(imageDataUrl, rects) {
    return new Promise((resolve) => {
        if (!Array.isArray(rects) || rects.length === 0) {
            resolve(imageDataUrl);
            return;
        }
        const img = new Image();
        const timeout = setTimeout(() => resolve(imageDataUrl), 5000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, img.width, img.height);
                ctx.fillStyle = '#FFFFFF';
                rects.forEach((r) => {
                    const x = Math.max(0, Math.floor(r.x * img.width));
                    const y = Math.max(0, Math.floor(r.y * img.height));
                    const w = Math.min(img.width - x, Math.ceil(r.w * img.width));
                    const h = Math.min(img.height - y, Math.ceil(r.h * img.height));
                    if (w > 0 && h > 0) ctx.fillRect(x, y, w, h);
                });
                resolve(canvas.toDataURL('image/png'));
            } catch {
                resolve(imageDataUrl);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            resolve(imageDataUrl);
        };

        img.src = imageDataUrl;
    });
}

/**
 * Crop a base64 image to remove the bottom summary box.
 */
export async function cropBottomSummary(base64, keepPercent = 0.88) {
    try {
        return await new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => resolve(base64), 5000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const cropHeight = Math.floor(img.height * keepPercent);
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = cropHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, img.width, cropHeight, 0, 0, img.width, cropHeight);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    resolve(base64);
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                resolve(base64);
            };

            img.src = base64;
        });
    } catch {
        return base64;
    }
}
