import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';

// Private bucket + table: see supabase/migrations/20261029130000_staff_contract_copies.sql
const BUCKET = 'contract-documents';

/** Contract text -> PDF, as base64 without the data-URI prefix. jsPDF loads only when a contract is produced. */
export async function contractTextToPdfBase64(text) {
  if (!text) return null;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const margin = 20;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  let y = margin;
  const lineHeight = 6;
  for (const line of lines) {
    if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }
  return doc.output('datauristring').split(',')[1];
}

const base64ToBlob = (base64) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'application/pdf' });
};

/**
 * Keep a copy of the sent contract where that person can download it in the Staff Portal.
 * A re-send replaces the copy. Never blocks the send; failures are only logged.
 */
export async function saveStaffContractCopy({ showId, email, pdfBase64, fileName }) {
  if (!showId || !email || !pdfBase64) return null;
  try {
    const path = `sent/${showId}/${uuidv4()}.pdf`;
    const { error: upError } = await supabase.storage
      .from(BUCKET)
      .upload(path, base64ToBlob(pdfBase64), { contentType: 'application/pdf', upsert: false });
    if (upError) {
      console.warn('saveStaffContractCopy upload failed:', upError.message);
      return null;
    }
    const { error } = await supabase.from('staff_contract_copies').upsert(
      {
        show_id: String(showId),
        member_email: email.toLowerCase(),
        file_name: fileName || 'Contract.pdf',
        storage_path: path,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'show_id,member_email' },
    );
    if (error) {
      console.warn('saveStaffContractCopy row failed:', error.message);
      await supabase.storage.from(BUCKET).remove([path]);
      return null;
    }
    return true;
  } catch (err) {
    console.warn('saveStaffContractCopy threw:', err);
    return null;
  }
}
