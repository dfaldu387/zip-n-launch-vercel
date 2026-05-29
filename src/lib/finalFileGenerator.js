import jsPDF from 'jspdf';
import { fetchImageAsBase64 } from '@/lib/pdfHelpers';
import { supabase } from '@/lib/supabaseClient';

const PAGE_WIDTH = 612; // Letter width in points
const PAGE_HEIGHT = 792; // Letter height in points
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

/**
 * Load a base64 image and return its natural dimensions.
 */
function getImageDimensions(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

/**
 * Generate a final composite PDF combining the pattern image and verbiage text.
 *
 * @param {Object} options
 * @param {string} options.patternImageUrl - URL of the extracted pattern diagram
 * @param {string} options.verbiageText - Language/instructions text
 * @param {string} options.patternName - Display name for the header
 * @param {string} [options.discipline] - Discipline (e.g. "Walk Trot") shown as subtitle
 * @param {string} [options.level] - Level (e.g. "Beginner") shown as subtitle
 * @returns {Promise<Blob>} The generated PDF as a Blob
 */
export async function generateFinalFilePdf({ patternImageUrl, verbiageText, patternName, discipline, level }) {
  const doc = new jsPDF('p', 'pt', 'letter');
  let y = MARGIN;

  // Title — large, bold, identifies the pattern
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(patternName || 'Pattern', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 22;

  // Subtitle — Discipline · Level (so the header is meaningful instead of
  // showing a page number from the source PDF).
  const subtitleParts = [discipline, level].filter(Boolean);
  if (subtitleParts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitleParts.join(' · '), PAGE_WIDTH / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 16;
  } else {
    y += 4;
  }

  // Divider line under title
  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 18;

  // Pattern image
  if (patternImageUrl) {
    try {
      const base64 = await fetchImageAsBase64(patternImageUrl);
      if (base64) {
        const { width: natW, height: natH } = await getImageDimensions(base64);

        // Auto-size: fit within content width, max 52% of page height
        // (slightly smaller than before to give the heading + Key more room).
        const maxImgHeight = PAGE_HEIGHT * 0.52;
        const scaleW = CONTENT_WIDTH / natW;
        const scaleH = maxImgHeight / natH;
        const scale = Math.min(scaleW, scaleH, 1); // don't upscale

        const imgW = natW * scale;
        const imgH = natH * scale;

        // Center horizontally
        const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;

        doc.addImage(base64, 'PNG', imgX, y, imgW, imgH);
        y += imgH + 20;
      }
    } catch (err) {
      console.warn('Failed to add pattern image to final file:', err);
    }
  }

  // Key / Verbiage section
  if (verbiageText && verbiageText.trim()) {
    // "KEY" section header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text('KEY', MARGIN, y);
    y += 4;
    doc.setDrawColor(180);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(verbiageText, CONTENT_WIDTH);
    const lineHeight = 14;

    for (const line of lines) {
      // Page break if needed
      if (y + lineHeight > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
  }

  return doc.output('blob');
}

/**
 * Upload the generated final file to Supabase storage and update the pattern record.
 *
 * @param {Blob} blob - The PDF blob
 * @param {string} patternId - Pattern record ID
 * @param {string} userId - User ID for storage path
 * @returns {Promise<string>} The public URL of the uploaded file
 */
export async function uploadFinalFile(blob, patternId, userId) {
  const storagePath = `${userId}/finals/${patternId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('pattern_files')
    .upload(storagePath, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('pattern_files')
    .getPublicUrl(storagePath);

  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    throw new Error('Failed to get public URL for uploaded file');
  }

  const { error: updateError } = await supabase
    .from('patterns')
    .update({
      final_file_url: publicUrl,
      last_modified_at: new Date().toISOString(),
    })
    .eq('id', patternId);

  if (updateError) {
    throw new Error(`Failed to update pattern record: ${updateError.message}`);
  }

  return publicUrl;
}
