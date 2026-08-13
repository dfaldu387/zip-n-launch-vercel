import { supabase } from '@/lib/supabaseClient';

// Priority 4: a completed score sheet is attached to the QR record that was printed
// on the sheet itself, so scanning the same code shows the scored copy.

// Where completed sheets used to go. project_files is a PUBLIC bucket, so every
// posted sheet became a permanent web address that opened for anyone — no login,
// no publish check. The page hid the button; the file did not care.
//
// Nothing here is moved or changed. Sheets already posted keep their address
// (stored in full on the row) and keep working; only new ones go somewhere
// private.
//
// A separate, private bucket. Deliberately not project_files: that one also
// holds pattern PDFs and other uploads, and making it private would break every
// one of them plus every link already shared.
export const POSTED_BUCKET = 'posted-scoresheets';

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

    // A plain insert, not an upsert. The path already carries the QR id and a
    // timestamp so it is unique every time, and upsert would need read and update
    // rights on the bucket as well — rights nothing else should have, since the
    // whole point is that no client can read this bucket directly.
    const { error: uploadError } = await supabase.storage
        .from(POSTED_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) throw uploadError;

    // posted_sheet_url stays NULL for private sheets, and that null is the flag:
    // a row with a url is an old public sheet and is served by that url, a row
    // with only a path is private and gets a short-lived signed link instead.
    // No schema change, and no existing row is touched.
    const postedAt = new Date(timestamp).toISOString();
    const { error: updateError } = await supabase
        .from('score_sheet_qr_codes')
        .update({
            posted_sheet_url: null,
            posted_sheet_path: path,
            posted_at: postedAt,
            posted_by: userId,
            posted_by_name: poster.name || null,
            posted_by_email: poster.email || null,
        })
        .eq('id', record.id);
    if (updateError) throw updateError;

    return { url: null, path, postedAt, name: poster.name || null };
};

/**
 * A link the browser can open for a posted sheet, or null when there isn't one.
 *
 * Old sheets carry a permanent public address and keep using it. New ones are in
 * a private bucket, so this asks for a signed link that stops working after an
 * hour — long enough to read, short enough that a forwarded address is useless.
 */
export const resolvePostedSheetLink = async (record) => {
    if (!record) return null;
    if (record.posted_sheet_url) return record.posted_sheet_url;   // pre-existing sheet
    if (!record.posted_sheet_path) return null;                    // nothing posted

    // Signing happens in the edge function, not here. A rider scanning a QR code
    // has no account, so the browser has no permission to sign anything in a
    // private bucket; the function does it with the service key after checking
    // the show is published (or that the caller is staff).
    const { data, error } = await supabase.functions.invoke('sign-posted-sheet', {
        body: { qrId: record.id },
    });

    if (error) {
        console.warn('Could not get a link for the posted sheet:', error.message);
        return null;
    }
    return data?.url || null;
};
