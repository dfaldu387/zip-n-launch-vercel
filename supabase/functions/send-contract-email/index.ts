import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContractEmailRequest {
  recipientEmail: string;
  recipientName: string;
  roleName: string;
  showName: string;
  associationName: string;
  totalCompensation: string;
  employmentStart: string;
  employmentEnd: string;
  signingDeadline: string;
  senderName: string;
  customMessage: string;
  emailSubject: string;
  contractId: string;
  projectId: string;
  contractPdfBase64?: string;
  contractFileName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!POSTMARK_API_TOKEN) {
      console.error("POSTMARK_API_TOKEN not found");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: ContractEmailRequest = await req.json();

    const {
      recipientEmail,
      recipientName,
      roleName,
      showName,
      associationName,
      totalCompensation,
      employmentStart,
      employmentEnd,
      signingDeadline,
      customMessage,
      emailSubject,
      contractPdfBase64,
      contractFileName,
    } = body;

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required field: recipientEmail" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending contract email via Postmark:", { recipientEmail, recipientName, showName, roleName });

    const customMessageHtml = customMessage
      ? `<div style="background: white; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 16px; margin: 16px 0; white-space: pre-wrap;">${customMessage.replace(/\n/g, "<br>")}</div>`
      : "";

    const deadlineHtml = signingDeadline
      ? `<div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;"><span style="font-weight: bold; color: #6b7280;">Signing Deadline:</span> ${signingDeadline}</div>`
      : "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f9fc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Contract Ready for Review</h1>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${showName}${associationName ? ` — ${associationName}` : ""}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">Hello ${recipientName},</p>
              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">Your contract for <strong>${roleName || "your role"}</strong> at <strong>${showName}</strong> is ready for your review and signature.</p>

              ${customMessageHtml}

              <!-- Details Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                <tr>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: #f9fafb; border-radius: 4px; padding: 12px;">
                      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Role</div>
                      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-top: 4px;">${roleName || "—"}</div>
                    </div>
                  </td>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: #f9fafb; border-radius: 4px; padding: 12px;">
                      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Compensation</div>
                      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-top: 4px;">${totalCompensation || "—"}</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: #f9fafb; border-radius: 4px; padding: 12px;">
                      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Start Date</div>
                      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-top: 4px;">${employmentStart || "—"}</div>
                    </div>
                  </td>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: #f9fafb; border-radius: 4px; padding: 12px;">
                      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">End Date</div>
                      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-top: 4px;">${employmentEnd || "—"}</div>
                    </div>
                  </td>
                </tr>
              </table>

              ${deadlineHtml}

              <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 24px 0 0;">Please review the contract details and respond to this email with your signed contract and any required documents (W-9, association membership ID, emergency contact information).</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #374151; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
              <p style="margin: 0;">EquiPatterns — Horse Show Management</p>
              <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} EquiPatterns. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: recipientEmail,
        Subject: emailSubject || `Contract Ready for Signature — ${showName}`,
        HtmlBody: htmlBody,
        MessageStream: "outbound",
        ...(contractPdfBase64 ? {
          Attachments: [{
            Name: contractFileName || "Contract.pdf",
            Content: contractPdfBase64,
            ContentType: "application/pdf",
          }],
        } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Postmark error:", errorText);
      return new Response(
        JSON.stringify({ error: `Email delivery failed: ${response.status}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await response.json();
    console.log("Contract email sent successfully:", result.MessageID);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending contract email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
