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