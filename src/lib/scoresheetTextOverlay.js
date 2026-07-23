import { supabase } from '@/lib/supabaseClient';
import QRCode from 'qrcode';

/**
 * Generate a QR PNG and load it as an HTMLImageElement ready for canvas drawing.
 * Returns null if generation fails so callers can degrade gracefully.
 */
const loadQrImage = async (qrUrl, size = 256) => {
  if (!qrUrl) return null;
  try {
    const dataUrl = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: 'M', margin: 1, width: size });
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  } catch (e) {
    console.warn('Failed to generate QR image for scoresheet:', e);
    return null;
  }
};

/**
 * Cache for field positions by scoresheet template (keyed by image URL hash)
 * Using version suffix to invalidate cache when AI prompt changes
 */
const CACHE_VERSION = 'v10';
const fieldPositionCache = new Map();
const STORAGE_KEY_PREFIX = 'scoresheet_fields_';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a simple hash for caching
 */
const hashUrl = (url) => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${hash.toString()}_${CACHE_VERSION}`;
};

/**
 * Load field positions from localStorage
 */
const loadFromStorage = (cacheKey) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + cacheKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

/**
 * Save field positions to localStorage
 */
const saveToStorage = (cacheKey, data) => {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + cacheKey, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Failed to persist field positions to localStorage:', e.message);
  }
};

/**
 * Clear the field position cache (useful for debugging)
 */
export const clearFieldPositionCache = () => {
  fieldPositionCache.clear();
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
  console.log('Field position cache cleared (memory + localStorage)');
};

/**
 * Detect field positions on a scoresheet image using AI
 * @param {string} imageUrl - URL of the scoresheet image
 * @returns {Promise<Object>} - Field positions
 */
export const detectFieldPositions = async (imageUrl) => {
  const cacheKey = hashUrl(imageUrl);

  // Check in-memory cache first
  if (fieldPositionCache.has(cacheKey)) {
    console.log('Using in-memory cached field positions');
    return fieldPositionCache.get(cacheKey);
  }

  // Check localStorage cache
  const stored = loadFromStorage(cacheKey);
  if (stored) {
    console.log('Using localStorage cached field positions');
    fieldPositionCache.set(cacheKey, stored);
    return stored;
  }

  try {
    console.log('Calling AI to detect field positions...');

    const { data, error } = await supabase.functions.invoke('detect-scoresheet-fields', {
      body: { imageUrl }
    });

    if (error) {
      console.error('Error detecting fields:', error);
      throw error;
    }

    if (data && data.fields) {
      // Cache the result in memory and localStorage
      fieldPositionCache.set(cacheKey, data);
      saveToStorage(cacheKey, data);
      console.log('Field positions detected:', data);
      return data;
    }

    return null;
  } catch (error) {
    console.error('Failed to detect field positions:', error);
    return null;
  }
};

/**
 * Load an image from URL and return as HTMLImageElement
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>}
 */
const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Helpers
 */
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const refineFieldBox = (ctx, img, rawField, scaleX, scaleY) => {
  // AI returns x,y as TOP-LEFT of the input box, width/height as box dimensions
  const rawX = (rawField?.x ?? 0) * scaleX;
  const rawY = (rawField?.y ?? 0) * scaleY;
  const rawH = Math.max(14, ((rawField?.height || 20) * scaleY));
  const rawW = Math.max(40, ((rawField?.width || 150) * scaleX));

  // Simply use the AI coordinates directly - they should be correct after proper prompting
  // Just clamp to ensure we stay within image bounds
  const x = clamp(rawX, 0, img.width - rawW - 1);
  const yTop = clamp(rawY, 0, img.height - rawH - 1);
  const w = Math.min(rawW, img.width - x);
  const h = rawH;

  return {
    x: x,
    yCenter: yTop + h / 2,
    width: w,
    height: h,
  };
};

/**
 * Tag geometry, shared by the canvas overlay and the PDF stamp so the tag looks
 * the same however the sheet was uploaded.
 *
 * Robert asked for it condensed: it may cover the blank top of a sheet, but it
 * must not reach down into the printed judging criteria. On a letter page this
 * lands at ~2.55" × 0.89" with a QR, ~2.04" × 0.71" without — still shorter than
 * the first version (2.8" × 1.15") while carrying one more line, because the
 * discipline has to be on the tag alongside the division.
 */
export const TAG_WIDTH_RATIO = 0.30;       // of page width, when a QR is included
export const TAG_WIDTH_RATIO_NO_QR = 0.24;
export const TAG_ASPECT = 0.35;            // height ÷ width — locks the shape on any page size
export const TAG_MARGIN_RATIO = 0.012;     // gap from the top and right edges

export const getTagWidthRatio = (hasQr) => (hasQr ? TAG_WIDTH_RATIO : TAG_WIDTH_RATIO_NO_QR);

/**
 * Draw the tag inside an explicit box. `bleed` paints extra white around the box
 * so an overlay can hide the template's own SHOW/CLASS/DATE labels underneath.
 */
const drawTag = (ctx, labelX, labelY, labelW, labelH, data = {}, qrImage = null, bleed = 0, qrPlaceholder = false) => {
  const borderW = Math.max(1, Math.round(labelW * 0.004));
  const pad = Math.max(2, Math.round(labelH * 0.07));

  // QR takes a square block on the left, full label height. A preview reserves the
  // same block without minting a real code — codes belong to printed sheets only.
  const hasQrBlock = !!qrImage || qrPlaceholder;
  const qrSize = hasQrBlock ? labelH - pad * 2 : 0;
  const qrX = labelX + pad;
  const qrY = labelY + pad;
  const textLeft = hasQrBlock ? qrX + qrSize + pad : labelX + pad;
  const textRight = labelX + labelW - pad;
  const centerX = (textLeft + textRight) / 2;
  const maxTextW = textRight - textLeft;

  // Tighter type than the first version — smaller sizes, smaller gaps.
  const fontBrand = Math.max(7, Math.round(labelH * 0.10));
  const fontTitle = Math.max(9, Math.round(labelH * 0.135));
  const fontNormal = Math.max(8, Math.round(labelH * 0.12));
  const fontSmall = Math.max(8, Math.round(labelH * 0.11));
  const lineGap = Math.max(1, Math.round(labelH * 0.025));

  const fontOf = (size, bold) => `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`;

  // A cut-off judge name is useless at the arena, so shrink the line to fit before
  // resorting to an ellipsis. Only shows drop characters, and only after 25% shrink.
  const fit = (text, size, bold) => {
    let s = size;
    const min = Math.max(6, Math.round(size * 0.75));
    while (s > min) {
      ctx.font = fontOf(s, bold);
      if (ctx.measureText(text).width <= maxTextW) break;
      s -= 1;
    }
    ctx.font = fontOf(s, bold);
    let t = text;
    while (ctx.measureText(t).width > maxTextW && t.length > 3) t = t.slice(0, -2) + '…';
    return { text: t, size: s };
  };

  // Date and judge share one line — this is the "line items side by side" ask.
  const judge = (data.judgeName || '').trim();
  const footParts = [];
  if (data.date) footParts.push(data.date);
  if (judge) footParts.push(`Judge: ${judge}`);
  const footText = footParts.join('  •  ');

  // Robert's required contents: equipatterns.com, show, discipline AND division,
  // then date + judge. Discipline gets its own line so neither name gets clipped.
  const rows = [
    { text: 'www.equipatterns.com', size: fontBrand, bold: false, color: '#1a5276' },
    data.showName && { text: data.showName, size: fontTitle, bold: true, color: '#000000' },
    data.disciplineName && { text: data.disciplineName, size: fontNormal, bold: false, color: '#000000' },
    data.className && { text: data.className, size: fontNormal, bold: false, color: '#000000' },
    (footText || !judge) && { text: footText || '', size: fontSmall, bold: false, color: '#000000', judgeBlank: !judge },
  ].filter(Boolean);

  const contentH = rows.reduce((sum, r) => sum + r.size, 0) + lineGap * (rows.length - 1);

  ctx.save();

  // White background — with bleed it also wipes the labels printed underneath.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(labelX - bleed, labelY - bleed, labelW + bleed * 2, labelH + bleed * 2);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = borderW;
  ctx.strokeRect(labelX, labelY, labelW, labelH);

  if (qrImage && qrSize > 0) {
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  } else if (qrPlaceholder && qrSize > 0) {
    // Preview only — shows where the code lands without creating one.
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = Math.max(1, borderW * 0.8);
    ctx.setLineDash([Math.max(2, Math.round(qrSize * 0.06)), Math.max(2, Math.round(qrSize * 0.06))]);
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);
    ctx.setLineDash([]);
    ctx.fillStyle = '#999999';
    ctx.font = `${Math.max(6, Math.round(qrSize * 0.16))}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QR', qrX + qrSize / 2, qrY + qrSize / 2);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let curY = labelY + Math.max(pad, (labelH - contentH) / 2);

  for (const row of rows) {
    ctx.fillStyle = row.color;
    if (row.judgeBlank) {
      // No judge assigned — leave a ruled blank so it can be written in at the show.
      const label = 'Judges Name';
      ctx.font = fontOf(row.size, row.bold);
      const labelW2 = ctx.measureText(label).width;
      const blankW = Math.min(maxTextW - labelW2 - row.size * 0.4, maxTextW * 0.45);
      const startX = centerX - (labelW2 + row.size * 0.4 + blankW) / 2;
      ctx.textAlign = 'left';
      ctx.fillText(label, startX, curY);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, borderW * 0.6);
      ctx.beginPath();
      ctx.moveTo(startX + labelW2 + row.size * 0.4, curY + row.size);
      ctx.lineTo(startX + labelW2 + row.size * 0.4 + blankW, curY + row.size);
      ctx.stroke();
      ctx.textAlign = 'center';
    } else {
      const fitted = fit(row.text, row.size, row.bold);
      ctx.fillText(fitted.text, centerX, curY);
    }
    curY += row.size + lineGap;
  }

  ctx.restore();
};

/**
 * Place the tag in the top-right corner of a scoresheet canvas.
 */
const drawInfoLabel = (ctx, canvasW, canvasH, data, qrImage = null, qrPlaceholder = false) => {
  const labelW = Math.round(canvasW * getTagWidthRatio(!!qrImage || qrPlaceholder));
  const labelH = Math.round(labelW * TAG_ASPECT);
  const margin = Math.round(canvasW * TAG_MARGIN_RATIO);
  const labelX = canvasW - labelW - margin;
  const labelY = margin;
  drawTag(ctx, labelX, labelY, labelW, labelH, data, qrImage, Math.round(labelH * 0.07), qrPlaceholder);
};

/**
 * Render the tag on its own transparent-free canvas and return PNG bytes.
 * Used to stamp PDF score sheets, which never touch the canvas pipeline.
 *
 * @returns {Promise<{bytes: Uint8Array, aspect: number, hasQr: boolean}|null>}
 */
export const renderTagPng = async (data, qrUrl = null, pxWidth = 1200, qrPlaceholder = false) => {
  try {
    const qrImage = await loadQrImage(qrUrl, 512);
    const width = Math.round(pxWidth);
    const height = Math.round(width * TAG_ASPECT);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawTag(ctx, 0, 0, width, height, data, qrImage, 0, qrPlaceholder);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
    if (!blob) return null;
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      aspect: TAG_ASPECT,
      hasQr: !!qrImage || qrPlaceholder,
    };
  } catch (e) {
    console.warn('Failed to render score sheet tag image:', e);
    return null;
  }
};

/**
 * Apply text overlays to a scoresheet image at detected field positions
 * @param {string} imageUrl - URL of the scoresheet image
 * @param {Object} overlayData - Data to overlay
 * @param {string} overlayData.showName - Show/Project name
 * @param {string} overlayData.className - Class name
 * @param {string} overlayData.date - Date string
 * @param {string} overlayData.judgeName - Judge name
 * @returns {Promise<Blob>} - Modified image as blob
 */
export const applyTextOverlay = async (imageUrl, overlayData, qrUrl = null, qrPlaceholder = false) => {
  try {
    console.log('=== APPLYING TEXT OVERLAY ===');
    console.log('Image URL:', imageUrl);
    console.log('Overlay Data:', overlayData);
    console.log('QR URL:', qrUrl);
    console.log('Show Name:', overlayData?.showName);
    console.log('Class Name:', overlayData?.className);
    console.log('Date:', overlayData?.date);
    console.log('Judge Name:', overlayData?.judgeName);

    // Load the image
    const img = await loadImage(imageUrl);

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    // Fill with white so transparent source pixels don't render as black in PNG viewers
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the original image
    ctx.drawImage(img, 0, 0);

    // Detect field positions using AI
    const fieldPositions = await detectFieldPositions(imageUrl);

    if (fieldPositions?.fields) {
      // Calculate scale factors.
      // If the detector returns normalized (0..1) coordinates, we scale by the image dimensions.
      const isNormalized = fieldPositions.units === 'normalized' ||
        ((fieldPositions.imageWidth ?? 0) > 0 && (fieldPositions.imageWidth ?? 0) <= 2 &&
         (fieldPositions.imageHeight ?? 0) > 0 && (fieldPositions.imageHeight ?? 0) <= 2);

      const scaleX = isNormalized
        ? img.width
        : (fieldPositions.imageWidth ? img.width / fieldPositions.imageWidth : 1);
      const scaleY = isNormalized
        ? img.height
        : (fieldPositions.imageHeight ? img.height / fieldPositions.imageHeight : 1);

      const fields = fieldPositions.fields;

      const drawField = (rawField, text, key) => {
        if (!rawField?.found) {
          console.warn(`Field ${key} not found by AI`);
          return;
        }
        
        if (!text) {
          console.warn(`No text data for field ${key}`);
          return;
        }

        const refined = refineFieldBox(ctx, img, rawField, scaleX, scaleY);

        if (refined.width < 40 || refined.height < 12) {
          console.warn(`Skipping ${key}: refined box too small`, refined);
          return;
        }

        // Optional: small safety padding so text doesn't touch the border
        const x = refined.x;
        const y = refined.yCenter;
        const w = refined.width;
        const h = refined.height;

        console.log(`=== Drawing Field: ${key} ===`);
        console.log(`Text: "${text}"`);
        console.log(`Raw field from AI:`, rawField);
        console.log(`Refined box:`, { x, y, width: w, height: h, yCenter: y });
        console.log(`Image dimensions:`, { width: img.width, height: img.height });
        console.log(`Scale factors:`, { scaleX, scaleY });
        console.log(`Field position:`, { 
          top: refined.yCenter - refined.height / 2,
          bottom: refined.yCenter + refined.height / 2,
          left: x,
          right: x + w
        });
        
        drawFittedText(ctx, text, x, y, w, h);
      };

      // Draw info label over the SHOW/CLASS/DATE area (top-right of scoresheet).
      // Uses fixed proportional positioning — scoresheets consistently have
      // these fields in the top-right ~35% of width, top ~3-15% of height.
      const qrImage = await loadQrImage(qrUrl);
      drawInfoLabel(ctx, img.width, img.height, overlayData, qrImage, qrPlaceholder);
    } else {
      console.warn('No field positions detected, skipping text overlay');
    }

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png', 1.0);
    });
  } catch (error) {
    console.error('Error applying text overlay:', error);
    // If overlay fails, return the original image
    const response = await fetch(imageUrl);
    return await response.blob();
  }
};

/**
 * Draw text fitted to field dimensions - scales font size to fit width and height
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to draw
 * @param {number} x - X position (left edge of input box)
 * @param {number} y - Y position (VERTICAL CENTER of input box)
 * @param {number} fieldWidth - Width of the input box
 * @param {number} fieldHeight - Height of the input box
 */
const drawFittedText = (ctx, text, x, y, fieldWidth, fieldHeight = 20) => {
  if (!text) {
    console.warn('drawFittedText: No text provided');
    return;
  }

  // Minimal padding - text should start close to the left edge of the field
  const horizontalPadding = clamp(Math.round(fieldHeight * 0.05), 2, 8);
  const verticalPadding = 1;
  const availableWidth = Math.max(0, fieldWidth - horizontalPadding * 2);
  const availableHeight = Math.max(0, fieldHeight - verticalPadding * 2);

  // Start with font size based on field height - make it larger for visibility
  let fontSize = Math.min(Math.floor(availableHeight * 0.75), 24);
  const minFontSize = 12; // Increased minimum for better visibility

  // Use black color with full opacity for maximum visibility
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left'; // Left align text

  // Find the right font size to fit the text within field width
  let finalFontSize = fontSize;
  while (finalFontSize >= minFontSize) {
    ctx.font = `bold ${finalFontSize}px Arial, sans-serif`; // Use bold for better visibility
    const metrics = ctx.measureText(text);

    if (metrics.width <= availableWidth) {
      break;
    }
    finalFontSize -= 0.5;
  }

  // Calculate text position
  const fieldTop = y - fieldHeight / 2;
  const fieldCenterY = y;
  const fieldBottom = y + fieldHeight / 2;
  
  // Calculate text metrics with final font size
  ctx.font = `bold ${finalFontSize}px Arial, sans-serif`;
  const textMetrics = ctx.measureText(text);
  
  // Position text - minimal left padding
  const textX = x + horizontalPadding;
  
  // Calculate proper Y position to align text with underline
  // The underline is typically at the bottom 1/3 of the field
  // We'll use alphabetic baseline and position it so the text sits on the underline
  const underlineY = fieldTop + (fieldHeight * 0.75); // Underline at 75% from top
  
  // Use alphabetic baseline - this aligns the bottom of letters with the baseline
  // Position the baseline at the underline position
  ctx.textBaseline = 'alphabetic';
  const textY = underlineY;
  
  // Alternative: Try middle baseline with adjustment if alphabetic doesn't work well
  // Calculate if we should use middle baseline instead
  const textHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
  const middleBaselineY = fieldCenterY;
  
  console.log(`--- Text Drawing Details ---`);
  console.log(`Text: "${text}"`);
  console.log(`Field dimensions: ${fieldWidth} x ${fieldHeight}`);
  console.log(`Available space: ${availableWidth} x ${availableHeight}`);
  console.log(`Horizontal padding: ${horizontalPadding}`);
  console.log(`Font size: ${finalFontSize}px`);
  console.log(`Text width: ${textMetrics.width}px`);
  console.log(`Text height: ${textHeight}px`);
  console.log(`Text metrics:`, {
    width: textMetrics.width,
    actualBoundingBoxAscent: textMetrics.actualBoundingBoxAscent,
    actualBoundingBoxDescent: textMetrics.actualBoundingBoxDescent,
    actualBoundingBoxLeft: textMetrics.actualBoundingBoxLeft,
    actualBoundingBoxRight: textMetrics.actualBoundingBoxRight
  });
  console.log(`Field bounds:`, {
    left: x,
    right: x + fieldWidth,
    top: fieldTop,
    bottom: fieldBottom,
    centerY: fieldCenterY,
    underlineY: underlineY
  });
  console.log(`Text position (alphabetic baseline): (${textX}, ${textY})`);
  console.log(`Text baseline: alphabetic (aligns with underline)`);
  console.log(`Text align: left`);
  console.log(`Font weight: bold`);
  console.log(`Text color: #000000 (black)`);

  // Draw the text using alphabetic baseline to align with underline
  ctx.fillText(text, textX, textY);
};

/**
 * Draw an info label (white box) in the top-right corner of a scoresheet canvas.
 * Contains: branding URL, show name, class/division, date, judge name,
 * and a placeholder area for a future QR code.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context (image already drawn)
 * @param {number} canvasWidth - Canvas width in px
 * @param {number} canvasHeight - Canvas height in px
 * @param {Object} data - Label content
 * @param {string} [data.showName] - Show/project name
 * @param {string} [data.className] - Class or division name
 * @param {string} [data.date] - Date string
 * @param {string} [data.judgeName] - Judge name
 */
export const drawScoresheetLabel = (ctx, canvasWidth, canvasHeight, data = {}) => {
  // --- Configuration ---
  // Label width/height scale relative to canvas so it looks right on any resolution.
  // Target: ~220px wide on a 1700px-wide image ≈ 13% of width.
  const LABEL_W = Math.round(canvasWidth * 0.20);
  const LINE_H = Math.round(canvasHeight * 0.016);  // line height
  const PAD_X = Math.round(LINE_H * 0.6);
  const PAD_Y = Math.round(LINE_H * 0.5);
  const MARGIN = Math.round(canvasWidth * 0.015);     // margin from edge
  const FONT_SM = Math.max(10, Math.round(LINE_H * 0.72));
  const FONT_MD = Math.max(11, Math.round(LINE_H * 0.82));
  const FONT_BOLD = Math.max(12, Math.round(LINE_H * 0.92));

  // QR placeholder size (square, bottom of label)
  const QR_SIZE = Math.round(LABEL_W * 0.3);

  // Calculate content lines
  const lines = [];
  lines.push({ text: 'equipatterns.com', size: FONT_SM, bold: false, color: '#666666' });
  if (data.showName) lines.push({ text: data.showName, size: FONT_BOLD, bold: true, color: '#000000' });
  if (data.className) lines.push({ text: data.className, size: FONT_MD, bold: false, color: '#000000' });
  if (data.date) lines.push({ text: data.date, size: FONT_SM, bold: false, color: '#333333' });
  if (data.judgeName) lines.push({ text: `Judge: ${data.judgeName}`, size: FONT_SM, bold: false, color: '#333333' });

  // Calculate total label height
  const textHeight = lines.length * LINE_H;
  const qrSection = QR_SIZE + PAD_Y; // space for QR placeholder
  const LABEL_H = PAD_Y * 2 + textHeight + qrSection;

  // Position: top-right corner with margin
  const labelX = canvasWidth - LABEL_W - MARGIN;
  const labelY = MARGIN;

  // --- Draw background ---
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.95;
  ctx.fillRect(labelX, labelY, LABEL_W, LABEL_H);
  ctx.globalAlpha = 1.0;

  // Border
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = Math.max(1, Math.round(canvasWidth * 0.001));
  ctx.strokeRect(labelX, labelY, LABEL_W, LABEL_H);

  // --- Draw text lines ---
  let curY = labelY + PAD_Y + LINE_H * 0.75; // baseline of first line

  for (const line of lines) {
    ctx.fillStyle = line.color;
    ctx.font = `${line.bold ? 'bold ' : ''}${line.size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Truncate if text is too wide
    let text = line.text;
    const maxW = LABEL_W - PAD_X * 2;
    while (ctx.measureText(text).width > maxW && text.length > 3) {
      text = text.slice(0, -2) + '…';
    }
    ctx.fillText(text, labelX + PAD_X, curY);
    curY += LINE_H;
  }

  // --- QR placeholder (dashed box) ---
  const qrX = labelX + (LABEL_W - QR_SIZE) / 2;
  const qrY = curY + PAD_Y * 0.5;
  ctx.setLineDash([Math.max(2, Math.round(canvasWidth * 0.002)), Math.max(2, Math.round(canvasWidth * 0.002))]);
  ctx.strokeStyle = '#BBBBBB';
  ctx.lineWidth = Math.max(1, Math.round(canvasWidth * 0.0008));
  ctx.strokeRect(qrX, qrY, QR_SIZE, QR_SIZE);
  ctx.setLineDash([]);

  // "QR" placeholder text
  ctx.fillStyle = '#CCCCCC';
  ctx.font = `${Math.round(FONT_SM * 0.85)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QR', qrX + QR_SIZE / 2, qrY + QR_SIZE / 2);

  ctx.restore();
};

/**
 * Batch detect field positions for multiple image URLs.
 * Deduplicates so the same image_url only triggers one AI call.
 * @param {string[]} imageUrls - Array of image URLs (may contain duplicates)
 * @param {function} [onProgress] - Optional callback: (completed, total) => void
 * @returns {Promise<Map<string, Object>>} - Map of imageUrl -> field positions
 */
export const batchDetectFieldPositions = async (imageUrls, onProgress) => {
  const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];
  const results = new Map();
  let completed = 0;

  for (const url of uniqueUrls) {
    const positions = await detectFieldPositions(url);
    results.set(url, positions);
    completed++;
    onProgress?.(completed, uniqueUrls.length);
  }

  return results;
};

/**
 * Apply text overlay using pre-resolved field positions (skips AI call).
 * Used by bulk download to avoid redundant AI calls per scoresheet.
 * @param {string} imageUrl - URL of the scoresheet image
 * @param {Object} overlayData - { showName, className, date, judgeName }
 * @param {Object} fieldPositions - Pre-resolved field positions from detectFieldPositions
 * @returns {Promise<Blob>} - Modified image as PNG blob
 */
export const applyTextOverlayWithPositions = async (imageUrl, overlayData, fieldPositions, qrUrl = null) => {
  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');
    // Fill with white so transparent source pixels don't render as black in PNG viewers
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    if (fieldPositions?.fields) {
      const isNormalized = fieldPositions.units === 'normalized' ||
        ((fieldPositions.imageWidth ?? 0) > 0 && (fieldPositions.imageWidth ?? 0) <= 2 &&
         (fieldPositions.imageHeight ?? 0) > 0 && (fieldPositions.imageHeight ?? 0) <= 2);
      const scaleX = isNormalized ? img.width : (fieldPositions.imageWidth ? img.width / fieldPositions.imageWidth : 1);
      const scaleY = isNormalized ? img.height : (fieldPositions.imageHeight ? img.height / fieldPositions.imageHeight : 1);
      const fields = fieldPositions.fields;

      const drawField = (rawField, text, key) => {
        if (!rawField?.found || !text) return;
        const refined = refineFieldBox(ctx, img, rawField, scaleX, scaleY);
        if (refined.width < 40 || refined.height < 12) return;
        drawFittedText(ctx, text, refined.x, refined.yCenter, refined.width, refined.height);
      };

      // Draw info label over the SHOW/CLASS/DATE area (top-right of scoresheet)
      const qrImage = await loadQrImage(qrUrl);
      drawInfoLabel(ctx, img.width, img.height, overlayData, qrImage);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')), 'image/png', 1.0);
    });
  } catch (error) {
    console.error('Error applying text overlay with positions:', error);
    const response = await fetch(imageUrl);
    return await response.blob();
  }
};

/**
 * Get overlay data from project and scoresheet context
 * @param {Object} project - Project data
 * @param {Object} scoresheet - Scoresheet info
 * @returns {Object} - Overlay data
 */
export const getOverlayDataFromContext = (project, scoresheet) => {
  const projectData = project?.project_data || {};
  
  // Get show name
  const showName = project?.project_name || projectData.showName || '';
  
  // Get class/group name — include the actual pattern number so the overlay
  // reflects the row the user clicked (e.g. "Western Riding – Pattern 0002 – Open Amateur Youth").
  const baseDiscipline = scoresheet?.disciplineName || '';
  const baseGroup = scoresheet?.groupName || '';
  const patternNumber = scoresheet?.patternNumber || null;
  // The discipline is its own line on the tag now, so this label carries only the
  // class/division part (e.g. "Pattern 0002 \u2013 Open Amateur Youth").
  const classParts = [];
  if (patternNumber) classParts.push(`Pattern ${patternNumber}`);
  if (baseGroup && baseGroup !== baseDiscipline) classParts.push(baseGroup);
  const className = classParts.join(' \u2013 ');
  
  // Get date - prioritize per-class date from scoresheet, then divisionDates lookup, then show start date
  let date = '';
  // Use scoresheet's classDate if available
  if (scoresheet?.classDate) {
    date = scoresheet.classDate;
  }
  // Try to find per-division date by matching division name
  if (!date && scoresheet?.divisionName && projectData.disciplines?.length > 0) {
    for (const discipline of projectData.disciplines) {
      for (const group of (discipline.patternGroups || [])) {
        for (const div of (group.divisions || [])) {
          const divName = div?.name || div?.divisionName || div?.division || div?.title || '';
          const divId = div?.id;
          if (divName.trim() === scoresheet.divisionName && divId && discipline.divisionDates?.[divId]) {
            date = discipline.divisionDates[divId];
            break;
          }
        }
        if (date) break;
      }
      if (date) break;
    }
  }
  // Fallback to show start date only (not range)
  if (!date) {
    date = projectData.startDate || projectData.showDates?.startDate || '';
  }
  
  // Get judge name - check multiple possible locations
  let judgeName = '';
  
  // Check associationJudges first (has nested structure with judges array)
  if (projectData.associationJudges && Object.keys(projectData.associationJudges).length > 0) {
    for (const assocKey of Object.keys(projectData.associationJudges)) {
      const assocData = projectData.associationJudges[assocKey];
      // Check if it has judges array
      if (assocData?.judges?.length > 0) {
        judgeName = assocData.judges[0].name || assocData.judges[0].full_name || '';
        break;
      }
      // Direct name property
      if (assocData?.name) {
        judgeName = assocData.name;
        break;
      }
    }
  }
  
  // Check groupJudges
  if (!judgeName && projectData.groupJudges && Object.keys(projectData.groupJudges).length > 0) {
    const firstGroupJudge = Object.values(projectData.groupJudges)[0];
    judgeName = firstGroupJudge?.name || firstGroupJudge?.full_name || '';
  }
  
  // Check officials array
  if (!judgeName && projectData.officials?.length > 0) {
    const judge = projectData.officials.find(o => o.role === 'judge' || o.type === 'judge');
    judgeName = judge?.name || judge?.full_name || projectData.officials[0]?.name || '';
  }
  
  // Check staff array
  if (!judgeName && projectData.staff?.length > 0) {
    const judge = projectData.staff.find(s => s.role === 'judge' || s.type === 'judge');
    judgeName = judge?.name || judge?.full_name || '';
  }
  
  // Check officialsAndStaff.judges
  if (!judgeName && projectData.officialsAndStaff?.judges?.length > 0) {
    judgeName = projectData.officialsAndStaff.judges[0].name || projectData.officialsAndStaff.judges[0].full_name || '';
  }
  
  console.log('=== OVERLAY DATA EXTRACTION ===');
  console.log('Project:', project?.project_name || 'N/A');
  console.log('Project Data:', projectData);
  console.log('Scoresheet:', scoresheet);
  console.log('Extracted Data:', { 
    showName, 
    className, 
    date, 
    judgeName 
  });
  console.log('Show Name Source:', {
    project_name: project?.project_name,
    showName: projectData.showName,
    final: showName
  });
  console.log('Class Name Source:', {
    groupName: scoresheet?.groupName,
    disciplineName: scoresheet?.disciplineName,
    final: className
  });
  console.log('Date Source:', {
    startDate: projectData.startDate,
    endDate: projectData.endDate,
    showDates: projectData.showDates,
    final: date
  });
  console.log('Judge Name Source:', {
    associationJudges: projectData.associationJudges,
    groupJudges: projectData.groupJudges,
    officials: projectData.officials,
    final: judgeName
  });

  return {
    showName,
    disciplineName: baseDiscipline,
    className,
    date,
    judgeName
  };
};
