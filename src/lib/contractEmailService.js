import { supabase } from '@/lib/supabaseClient';
import { calculateMemberFinancials, currency, formatDate } from '@/lib/contractUtils';

/**
 * Send a contract email to an employee for signing + document upload.
 * Invokes the Supabase Edge Function `send-contract-email`.
 *
 * @param {Object} params
 * @param {Object} params.member - Personnel member object
 * @param {Object} params.formData - Full form data from ContractManagementPage
 * @param {Object} [params.deliverySettings] - Optional delivery settings override
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendContractEmail({ member, formData, deliverySettings, contractPdfBase64, contractFileName }) {
  const settings = deliverySettings || formData.deliverySettings || {};
  const contractSettings = formData.contractSettings || {};
  const financials = calculateMemberFinancials(member);

  const payload = {
    recipientEmail: member.email,
    recipientName: member.name || 'Team Member',
    roleName: member.roleName || '',
    showName: formData.showName || 'Horse Show',
    associationName: member.associationName || '',
    totalCompensation: currency(financials.totalCompensation),
    employmentStart: formatDate(member.employment_start_date) || '',
    employmentEnd: formatDate(member.employment_end_date) || '',
    signingDeadline: formatDate(contractSettings.signingDeadline) || '',
    senderName: '',
    customMessage: settings.emailMessage || '',
    emailSubject: settings.emailSubject || `Contract Ready for Signature — ${formData.showName || 'Horse Show'}`,
    contractId: member.id,
    projectId: formData.id || '',
    contractPdfBase64: contractPdfBase64 || null,
    contractFileName: contractFileName || 'Contract.pdf',
  };

  // Validate email
  if (!payload.recipientEmail) {
    return { success: false, error: `No email address for ${payload.recipientName}` };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-contract-email', {
      body: payload,
    });

    if (error) {
      console.error('Edge function error:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err) {
    console.error('Contract email send failed:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Send contract emails to multiple employees.
 *
 * @param {Object} params
 * @param {Array} params.members - Array of personnel member objects
 * @param {Object} params.formData - Full form data
 * @param {Object} [params.deliverySettings] - Optional delivery settings override
 * @returns {Promise<{sent: number, failed: number, errors: Array}>}
 */
export async function sendContractEmailBulk({ members, formData, deliverySettings }) {
  const results = { sent: 0, failed: 0, errors: [] };

  for (const member of members) {
    const result = await sendContractEmail({ member, formData, deliverySettings });
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push({ name: member.name, error: result.error });
    }
  }

  return results;
}
