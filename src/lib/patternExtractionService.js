import { extractPatternStepsWithProgress } from '@/lib/pdfUtils';
import { extractPatternDiagram } from '@/lib/patternImageExtractor';
import { formatPatternVerbiage } from '@/lib/patternTextFormatter';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pattern Extraction Service
 *
 * Orchestrates client-side PDF extraction:
 *   1. Extract text from PDF (pdfUtils)
 *   2. Extract diagram image from PDF (patternImageExtractor)
 *   3. Parse maneuver steps from text (patternTextFormatter)
 *   4. Upload original file + diagram to Supabase storage
 *   5. Insert tbl_patterns + tbl_maneuvers rows
 */

/**
 * Extract text, image, and maneuver steps from a PDF file.
 * @param {File} pdfFile
 * @param {Function} onProgress - callback({ stage, message, percent })
 * @returns {Promise<{ rawText, steps, warnings, diagramDataUrl, fullImageDataUrl, numPages }>}
 */
export async function extractFromPdf(pdfFile, onProgress) {
  onProgress?.({ stage: 'text', message: 'Extracting text from PDF...', percent: 10 });

  // Extract text (returns a stepMap: { 1: "...", 2: "..." })
  let rawText = '';
  const stepMap = await extractPatternStepsWithProgress(pdfFile, (progress) => {
    onProgress?.({ stage: 'text', message: progress.message, percent: 20 });
  });

  // Build raw text from step map for formatting
  const stepEntries = Object.entries(stepMap);
  if (stepEntries.length > 0) {
    rawText = stepEntries.map(([num, desc]) => `${num}. ${desc}`).join('\n');
  }

  onProgress?.({ stage: 'image', message: 'Extracting pattern diagram...', percent: 40 });

  // Extract diagram image
  let imageResult = { diagramDataUrl: null, fullImageDataUrl: null, cropped: false };
  try {
    imageResult = await extractPatternDiagram(pdfFile);
  } catch (err) {
    console.warn('Image extraction failed, continuing without image:', err);
  }

  onProgress?.({ stage: 'parse', message: 'Parsing maneuver steps...', percent: 60 });

  // Parse into structured steps using the formatter
  const { steps, warnings } = formatPatternVerbiage(rawText);

  // If formatter returned no steps but we have the raw stepMap, use that directly
  let finalSteps = steps;
  if ((!steps || steps.length === 0) && stepEntries.length > 0) {
    finalSteps = stepEntries.map(([num, desc]) => ({
      stepNumber: parseInt(num, 10),
      instruction: desc,
      isOptional: false,
    }));
  }

  // Count pages
  let numPages = 1;
  try {
    const { pdfjs } = await import('react-pdf');
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    numPages = pdf.numPages;
  } catch { /* use default */ }

  onProgress?.({ stage: 'done', message: `Extracted ${finalSteps.length} steps`, percent: 100 });

  return {
    rawText,
    steps: finalSteps,
    warnings: warnings || [],
    diagramDataUrl: imageResult.diagramDataUrl,
    fullImageDataUrl: imageResult.fullImageDataUrl,
    cropped: imageResult.cropped,
    numPages,
  };
}

/**
 * Convert a data URL to a Blob.
 */
function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Save an extracted pattern to Supabase.
 *
 * @param {object} params
 * @param {object} params.formData - { patternName, association, discipline }
 * @param {object} params.extractionResult - from extractFromPdf()
 * @param {File} params.originalFile - the original PDF file
 * @param {string} params.userId
 * @param {Function} params.onProgress
 * @returns {Promise<{ patternId, success }>}
 */
export async function saveExtractedPattern({ formData, extractionResult, originalFile, userId, onProgress }) {
  const fileId = uuidv4();

  onProgress?.({ stage: 'upload', message: 'Uploading original PDF...', percent: 10 });

  // 1. Upload original PDF
  const pdfPath = `public/${fileId}-${originalFile.name}`;
  const { error: pdfUploadError } = await supabase.storage
    .from('pattern_uploads')
    .upload(pdfPath, originalFile);

  if (pdfUploadError) throw new Error(`PDF upload failed: ${pdfUploadError.message}`);

  // 2. Upload diagram image if available
  let previewImageUrl = null;
  if (extractionResult.diagramDataUrl) {
    onProgress?.({ stage: 'upload', message: 'Uploading diagram image...', percent: 30 });

    const imageBlob = dataUrlToBlob(extractionResult.diagramDataUrl);
    const imagePath = `public/${fileId}-diagram.png`;
    const { error: imageUploadError } = await supabase.storage
      .from('pattern_uploads')
      .upload(imagePath, imageBlob, { contentType: 'image/png' });

    if (!imageUploadError) {
      const { data: imageUrlData } = supabase.storage
        .from('pattern_uploads')
        .getPublicUrl(imagePath);
      previewImageUrl = imageUrlData?.publicUrl;
    }
  }

  onProgress?.({ stage: 'save', message: 'Saving pattern record...', percent: 50 });

  // 3. Insert pattern record
  const patternRecord = {
    association_name: formData.association || null,
    discipline: formData.discipline || null,
    division: formData.division || 'Open',
    division_level: formData.divisionLevel || null,
    pdf_file_name: originalFile.name,
    pattern_version: '1',
    page_no: 1,
    pattern_date: new Date().toISOString().split('T')[0],
    pattern_name: formData.patternName || null,
    created_by: userId || null,
    status: 'draft',
  };

  const { data: patternData, error: patternError } = await supabase
    .from('tbl_patterns')
    .insert(patternRecord)
    .select('id')
    .single();

  if (patternError) throw new Error(`Pattern save failed: ${patternError.message}`);

  const patternId = patternData.id;

  // 4. Insert maneuver steps
  if (extractionResult.steps && extractionResult.steps.length > 0) {
    onProgress?.({ stage: 'save', message: 'Saving maneuver steps...', percent: 70 });

    const maneuverRows = extractionResult.steps.map((step) => ({
      pattern_id: patternId,
      step_no: step.stepNumber,
      instruction: step.instruction,
    }));

    const { error: maneuverError } = await supabase
      .from('tbl_maneuvers')
      .insert(maneuverRows);

    if (maneuverError) throw new Error(`Maneuver save failed: ${maneuverError.message}`);
  }

  // 5. Save diagram to tbl_pattern_media if we have one
  if (previewImageUrl) {
    onProgress?.({ stage: 'save', message: 'Saving media record...', percent: 85 });

    await supabase.from('tbl_pattern_media').insert({
      pattern_id: patternId,
      image_url: previewImageUrl,
      file_name: `${fileId}-diagram.png`,
      page_no: 1,
      association_abbrev: formData.association || null,
      discipline: formData.discipline || null,
    });
  }

  onProgress?.({ stage: 'done', message: 'Pattern saved successfully!', percent: 100 });

  return { patternId, success: true };
}

/**
 * Update maneuver steps for a pattern.
 * Deletes existing steps and inserts new ones.
 */
export async function updateManeuverSteps(patternId, steps) {
  // Delete existing
  const { error: deleteError } = await supabase
    .from('tbl_maneuvers')
    .delete()
    .eq('pattern_id', patternId);

  if (deleteError) throw new Error(`Delete maneuvers failed: ${deleteError.message}`);

  // Insert new
  if (steps.length > 0) {
    const rows = steps.map((step, index) => ({
      pattern_id: patternId,
      step_no: step.stepNumber || index + 1,
      instruction: step.instruction,
    }));

    const { error: insertError } = await supabase
      .from('tbl_maneuvers')
      .insert(rows);

    if (insertError) throw new Error(`Insert maneuvers failed: ${insertError.message}`);
  }

  return { success: true };
}

/**
 * Update pattern status.
 */
export async function updatePatternStatus(patternId, status) {
  const { error } = await supabase
    .from('tbl_patterns')
    .update({ status })
    .eq('id', patternId);

  if (error) throw new Error(`Status update failed: ${error.message}`);
  return { success: true };
}
