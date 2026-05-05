import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// Jumping disciplines get per-discipline upload slots instead of skill-level slots
const JUMPING_DISCIPLINE_NAMES = new Set([
  'Hunter Hack', 'Working Hunter', 'Equitation Over Fences', 'Jumping',
]);

const toSlotId = (name) => `disc-${name.toLowerCase().replace(/\s+/g, '-')}`;

/** Compute the active upload slots for a given formData. */
const getUploadSlots = (formData) => {
  const selectedNames = [...new Set(
    (formData.selectedClasses || [])
      .filter(k => k.includes('::'))
      .map(k => k.split('::')[1])
  )];
  const jumpingSelected = selectedNames.filter(n => JUMPING_DISCIPLINE_NAMES.has(n));
  if (jumpingSelected.length > 0) {
    return jumpingSelected.map(name => ({
      id: toSlotId(name),
      title: name,
      isDisciplineSlot: true,
    }));
  }
  return formData.hierarchyOrder;
};

/**
 * Submits a complete pattern set to Supabase.
 * Handles: file uploads, pattern records, associations, divisions,
 * maneuvers, annotations, and accessory documents.
 */
export const submitPatternSet = async (formData, user) => {
  if (!user) throw new Error('User must be authenticated');

  // Handle resubmit of a rejected pattern
  if (formData.resubmitPatternId) {
    return await resubmitPattern(formData, user);
  }

  const classType = formData.selectedDiscipline || 'Custom';
  const selectedAssocIds = Object.keys(formData.associations).filter(k => formData.associations[k]);

  // 1. Upload pattern files and build records (supports both hierarchy and discipline slots)
  const uploadSlots = getUploadSlots(formData);
  const patternEntries = uploadSlots
    .filter(h => formData.patterns[h.id])
    .map(h => ({
      hierarchyItem: h,
      pattern: formData.patterns[h.id],
    }));

  if (patternEntries.length === 0) {
    throw new Error('No patterns to submit');
  }

  const uploadedPatterns = [];

  for (const { hierarchyItem, pattern } of patternEntries) {
    const fileExt = pattern.file ? pattern.file.name.split('.').pop() : 'pdf';
    const filePath = `${user.id}/${classType}/${uuidv4()}.${fileExt}`;

    // Upload file to storage
    if (pattern.file) {
      const { error: uploadError } = await supabase.storage
        .from('pattern_files')
        .upload(filePath, pattern.file);

      if (uploadError) {
        throw new Error(`Failed to upload ${pattern.name}: ${uploadError.message}`);
      }
    }

    const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(filePath);

    // Derive the difficulty level: discipline slots (jumping) use the
    // per-pattern skillLevel the user picked; hierarchy slots use the slot title
    // itself since each slot already represents a difficulty level.
    const level = hierarchyItem.isDisciplineSlot
      ? (pattern.skillLevel || null)
      : (hierarchyItem.title || null);

    uploadedPatterns.push({
      originalId: hierarchyItem.id,
      name: pattern.name || pattern.file?.name || 'pattern.pdf',
      file_url: publicUrl,
      file_path: filePath,
      user_id: user.id,
      class_name: hierarchyItem.isDisciplineSlot ? hierarchyItem.title : classType,
      pattern_set_name: formData.showName,
      is_custom: true,
      review_status: 'pending',
      hierarchy_order: uploadSlots.findIndex(h => h.id === hierarchyItem.id),
      level,
    });
  }

  // Phase 1/2: OP/CAPO flag + tags. pattern_number is intentionally NOT set
  // here — it's assigned sequentially on admin approval (AdminPatternReviewPage).
  // When the user picks "Choose A Pattern Only" we tag CAPO instead of OP; both
  // set use_as_original=true so PBB's Choose A Pattern query (which filters on
  // use_as_original=true) picks them up.
  const useAsOriginal = !!formData.useAsOriginal;
  const isCapo = useAsOriginal && !!formData.chooseAPatternOnly;
  const tags = [];
  if (isCapo) tags.push('CAPO');
  else if (useAsOriginal) tags.push('OP');
  if (uploadedPatterns.length > 1) tags.push('Multi');

  // 2. Insert pattern records
  const dbPatterns = uploadedPatterns.map(({ originalId, ...rest }) => ({
    ...rest,
    use_as_original: useAsOriginal,
    tags,
    verbiage: formData.patternVerbiage?.[originalId]?.raw || null,
  }));
  const { data: insertedPatterns, error: dbError } = await supabase
    .from('patterns')
    .insert(dbPatterns)
    .select();

  if (dbError) throw new Error(`Database error: ${dbError.message}`);

  // Build originalId → DB id map
  const idMap = {};
  insertedPatterns.forEach(dbPattern => {
    const original = uploadedPatterns.find(p => p.file_path === dbPattern.file_path);
    if (original) idMap[original.originalId] = dbPattern.id;
  });

  // Phase 1: mirror each uploaded pattern PDF into pattern_files. Accessory docs
  // are mirrored further below in step 8.
  const patternFileRows = insertedPatterns.map(dbPattern => ({
    pattern_id: dbPattern.id,
    file_type: 'pattern',
    file_name: dbPattern.name,
    file_url: dbPattern.file_url,
    file_path: dbPattern.file_path,
    sort_order: 0,
  }));
  if (patternFileRows.length > 0) {
    const { error: pfError } = await supabase.from('pattern_files').insert(patternFileRows);
    if (pfError) console.warn('pattern_files insert error:', pfError.message);
  }

  // 3. Insert pattern_associations
  const associationInserts = insertedPatterns.flatMap(dbPattern => {
    return selectedAssocIds.map(assocId => ({
      pattern_id: dbPattern.id,
      association_id: assocId,
      difficulty: formData.associationDifficulties?.[assocId] || 'Intermediate',
    }));
  });

  if (associationInserts.length > 0) {
    const { error } = await supabase.from('pattern_associations').insert(associationInserts);
    if (error) throw new Error(`Association link error: ${error.message}`);
  }

  // 4. Insert pattern_divisions
  const divisionInserts = insertedPatterns.flatMap(dbPattern => {
    const original = uploadedPatterns.find(p => p.file_path === dbPattern.file_path);
    if (!original) return [];
    const divisions = formData.patternDivisions?.[original.originalId] || {};
    return Object.entries(divisions).flatMap(([assocId, levels]) =>
      Array.isArray(levels)
        ? levels.map(levelName => ({
            pattern_id: dbPattern.id,
            association_id: assocId,
            division_group: 'default',
            division_level: levelName,
          }))
        : []
    );
  });

  if (divisionInserts.length > 0) {
    const { error } = await supabase.from('pattern_divisions').insert(divisionInserts);
    if (error) throw new Error(`Division link error: ${error.message}`);
  }

  // 5. Insert pattern_maneuvers (new)
  const maneuverInserts = [];
  for (const [originalId, maneuvers] of Object.entries(formData.patternManeuvers || {})) {
    const dbId = idMap[originalId];
    if (!dbId || !Array.isArray(maneuvers)) continue;
    maneuvers.forEach(m => {
      maneuverInserts.push({
        pattern_id: dbId,
        step_number: m.stepNumber,
        instruction: m.instruction,
        is_optional: m.isOptional || false,
      });
    });
  }

  if (maneuverInserts.length > 0) {
    const { error } = await supabase.from('pattern_maneuvers').insert(maneuverInserts);
    if (error) console.warn('Maneuver insert error (table may not exist yet):', error.message);
  }

  // 6. Upload extracted pattern images (diagram-only) and update pattern records
  for (const [originalId, patternImage] of Object.entries(formData.patternImages || {})) {
    const dbId = idMap[originalId];
    if (!dbId || !patternImage?.diagramDataUrl) continue;

    try {
      const response = await fetch(patternImage.diagramDataUrl);
      const blob = await response.blob();
      const imgPath = `${user.id}/pattern_images/${uuidv4()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('pattern_files')
        .upload(imgPath, blob, { contentType: 'image/png' });

      if (uploadError) {
        console.warn('Pattern image upload error:', uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(imgPath);

      // Update the pattern record with the extracted diagram image URL
      const { error } = await supabase.from('patterns').update({
        preview_image_url: publicUrl,
      }).eq('id', dbId);

      if (error) console.warn('Pattern image URL update error:', error.message);
    } catch (err) {
      console.warn('Pattern image processing error:', err.message);
    }
  }

  // 7. Upload annotation images and insert pattern_annotations (new)
  for (const [originalId, annotation] of Object.entries(formData.patternAnnotations || {})) {
    const dbId = idMap[originalId];
    if (!dbId || !annotation?.imageDataUrl) continue;

    try {
      // Convert data URL to blob
      const response = await fetch(annotation.imageDataUrl);
      const blob = await response.blob();
      const annotPath = `${user.id}/annotations/${uuidv4()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('pattern_files')
        .upload(annotPath, blob, { contentType: 'image/png' });

      if (uploadError) {
        console.warn('Annotation upload error:', uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(annotPath);

      const { error } = await supabase.from('pattern_annotations').insert({
        pattern_id: dbId,
        annotation_image_url: publicUrl,
        annotation_image_path: annotPath,
      });

      if (error) console.warn('Annotation insert error (table may not exist yet):', error.message);
    } catch (err) {
      console.warn('Annotation processing error:', err.message);
    }
  }

  // 8. Upload accessory documents
  for (const doc of formData.accessoryDocs || []) {
    if (!doc.file) continue;

    const linkedDbIds = (doc.linkedPatternIds || [])
      .map(origId => idMap[origId])
      .filter(Boolean);

    if (linkedDbIds.length === 0) continue;

    const fileExt = doc.file.name.split('.').pop();
    const docPath = `${user.id}/accessory_docs/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('pattern_files')
      .upload(docPath, doc.file);

    if (uploadError) {
      throw new Error(`Failed to upload accessory doc ${doc.file.name}: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(docPath);

    const fileTypeMap = {
      score_sheet: 'score_sheet',
      build_sheet: 'build_sheet',
      equipment: 'equipment',
    };
    const mappedType = fileTypeMap[doc.type] || 'accessory';

    for (const dbPatternId of linkedDbIds) {
      await supabase.from('pattern_accessory_documents').insert({
        pattern_id: dbPatternId,
        document_type: doc.type,
        file_name: doc.file.name,
        file_url: publicUrl,
        file_path: docPath,
      });
      // Mirror into pattern_files (unified multi-file view).
      await supabase.from('pattern_files').insert({
        pattern_id: dbPatternId,
        file_type: mappedType,
        file_name: doc.file.name,
        file_url: publicUrl,
        file_path: docPath,
        sort_order: 1,
      });
    }
  }

  return { success: true, patternCount: insertedPatterns.length };
};

/**
 * Resubmits a rejected pattern by updating the existing record.
 */
const resubmitPattern = async (formData, user) => {
  const patternId = formData.resubmitPatternId;
  const classType = formData.selectedDiscipline || 'Custom';
  const selectedAssocIds = Object.keys(formData.associations).filter(k => formData.associations[k]);

  const updateData = {
    name: formData.showName || 'Untitled Pattern',
    pattern_set_name: formData.showName || '',
    class_name: classType,
    review_status: 'pending',
    rejected_at: null,
    rejection_reason: null,
    last_modified_at: new Date().toISOString(),
  };

  // Check if a new file was uploaded (patterns object has a file with a File object)
  const uploadSlots = getUploadSlots(formData);
  const patternEntry = uploadSlots.find(h => formData.patterns[h.id]);

  if (patternEntry) {
    const pattern = formData.patterns[patternEntry.id];

    // If it has a File object (new upload), upload it
    if (pattern.file) {
      const fileExt = pattern.file.name.split('.').pop();
      const filePath = `${user.id}/${classType}/${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('pattern_files')
        .upload(filePath, pattern.file);

      if (uploadError) throw new Error(`Failed to upload: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage.from('pattern_files').getPublicUrl(filePath);
      updateData.file_url = publicUrl;
      updateData.file_path = filePath;
      updateData.original_file_name = pattern.file.name;
    }

    updateData.name = pattern.name || updateData.name;

    const verbiage = formData.patternVerbiage?.[patternEntry.id]?.raw;
    if (verbiage) updateData.verbiage = verbiage;

    const level = patternEntry.isDisciplineSlot
      ? (pattern.skillLevel || null)
      : (patternEntry.title || null);
    if (level) updateData.level = level;
  }

  // Update the pattern record
  const { error } = await supabase
    .from('patterns')
    .update(updateData)
    .eq('id', patternId);

  if (error) throw new Error(`Update error: ${error.message}`);

  // Update associations
  await supabase.from('pattern_associations').delete().eq('pattern_id', patternId);

  if (selectedAssocIds.length > 0) {
    const assocInserts = selectedAssocIds.map(assocId => ({
      pattern_id: patternId,
      association_id: assocId,
      difficulty: formData.associationDifficulties?.[assocId] || 'Intermediate',
    }));
    await supabase.from('pattern_associations').insert(assocInserts);
  }

  // Update divisions
  await supabase.from('pattern_divisions').delete().eq('pattern_id', patternId);

  if (patternEntry) {
    const divisions = formData.patternDivisions?.[patternEntry.id] || {};
    const divInserts = Object.entries(divisions).flatMap(([assocId, levels]) =>
      Array.isArray(levels)
        ? levels.map(levelName => ({
            pattern_id: patternId,
            association_id: assocId,
            division_group: 'default',
            division_level: levelName,
          }))
        : []
    );
    if (divInserts.length > 0) {
      await supabase.from('pattern_divisions').insert(divInserts);
    }
  }

  return { success: true, patternCount: 1 };
};
