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
 * @returns {Promise<Blob>} The generated PDF as a Blob
 */
export async function generateFinalFilePdf({ patternImageUrl, verbiageText, patternName }) {
  const doc = new jsPDF('p', 'pt', 'letter');
  let y = MARGIN;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(patternName || 'Pattern', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 28;

  // Divider line under title
  doc.setDrawColor(180);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 16;

  // Pattern image
  if (patternImageUrl) {
    try {
      const base64 = await fetchImageAsBase64(patternImageUrl);
      if (base64) {
        const { width: natW, height: natH } = await getImageDimensions(base64);

        // Auto-size: fit within content width, max 55% of page height
        const maxImgHeight = PAGE_HEIGHT * 0.55;
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

  // Verbiage / language text
  if (verbiageText && verbiageText.trim()) {
    // Divider before verbiage
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 12;

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
