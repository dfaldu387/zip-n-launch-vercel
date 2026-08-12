import { supabase } from '@/lib/supabaseClient';

// Priority 4: a completed score sheet is attached to the QR record that was printed
// on the sheet itself, so scanning the same code shows the scored copy.

const POSTED_BUCKET = 'project_files';

// Sheets are posted from a phone at the arena, on show wifi. A recent handset
// takes 15-30 MB photos, and nothing checked the size before uploading — so a
// full-resolution shot became a long silent wait, and a failure part-way through
// looked exactly the same as success taking a while.
export const MAX_POSTED_BYTES = 15 * 1024 * 1024;

const MB = (bytes) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

/**
 * Why this file can't be posted, or null when it's fine.
 *
 * Separate from the upload so the message can be specific: someone standing in a
 * barn needs to know what to do next, not that "the upload failed".
 */
export const validatePostedFile = (file) => {
    if (!file) return 'No file selected.';

    const type = file.type || '';
    const isImage = type.startsWith('image/');
    const isPdf = type === 'application/pdf';
    // A blank type comes from some Android file pickers — fall back to the name.
    const looksRight = isImage || isPdf
        || /\.(jpe?g|png|heic|heif|webp|pdf)$/i.test(file.name || '');
    if (!looksRight) {
        return 'Please choose a photo or a PDF of the score sheet.';
    }

    if (file.size > MAX_POSTED_BYTES) {
        return `That file is ${MB(file.size)} MB and the limit is ${MB(MAX_POSTED_BYTES)} MB. `
             + 'Retake the photo at a smaller size, or choose Medium / Actual Size when your phone offers it.';
    }

    return null;
};

const extensionOf = (file) => {
    const fromName = (file?.name || '').split('.').pop();
    if (fromName && fromName.length <= 5 && !fromName.includes('/')) return fromName.toLowerCase();
    return file?.type === 'application/pdf' ? 'pdf' : 'jpg';
};

/**
 * Who posted a sheet, in a form Robert can read. Falls back to the email, then the
 * raw id — an unnamed uploader is still better than a blank.
 */
export const resolvePosterIdentity = async (user) => {
    if (!user?.id) return { name: null, email: null };
    const email = user.email || null;
    try {
        const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();
        return { name: data?.full_name || email || user.id, email };
    } catch {
        return { name: email || user.id, email };
    }
};

/**
 * Upload the completed sheet and attach it to the QR record.
 * The storage path starts with the uploader's user id — the bucket policy requires it.
 *
 * @param {File} file - photo or PDF of the scored sheet
 * @param {Object} record - the score_sheet_qr_codes row
 * @param {string} userId - signed-in staff member
 * @param {number} timestamp - Date.now() from the caller, keeps this function pure
 * @param {{name?: string, email?: string}} [poster] - readable identity for the audit trail
 * @returns {Promise<{url: string, path: string, postedAt: string, name: string|null}>}
 */
export const postScoredSheet = async (file, record, userId, timestamp, poster = {}) => {
    const problem = validatePostedFile(file);
    if (problem) throw new Error(problem);
    if (!userId) throw new Error('You must be signed in to post results.');

    const path = `${userId}/${record.project_id || 'unlinked'}/posted-scoresheets/${record.id}-${timestamp}.${extensionOf(file)}`;

    const { error: uploadError } = await supabase.storage
        .from(POSTED_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(POSTED_BUCKET).getPublicUrl(path);
    const url = publicData?.publicUrl;
    if (!url) throw new Error('Upload succeeded but the file has no public link.');

    const postedAt = new Date(timestamp).toISOString();
    const { error: updateError } = await supabase
        .from('score_sheet_qr_codes')
        .update({
            posted_sheet_url: url,
            posted_sheet_path: path,
            posted_at: postedAt,
            posted_by: userId,
            posted_by_name: poster.name || null,
            posted_by_email: poster.email || null,
        })
        .eq('id', record.id);
    if (updateError) throw updateError;

    return { url, path, postedAt, name: poster.name || null };
};
