import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// bookName is written by the caller and dropped straight into the subject and
// the HTML body. Unescaped, a name containing markup becomes markup in an email
// sent from our own verified domain — a link of someone else's choosing inside
// what looks like a genuine EquiPatterns message.
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface SendPatternBookRequest {
  email: string;
  pdfDataUri: string;
  bookName: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("POSTMARK_API_TOKEN");
    
    if (!apiKey) {
      throw new Error("Postmark API token not configured");
    }
    
    // ── Who is asking ───────────────────────────────────────────────────────
    // The caller supplies the recipient AND the PDF, and it goes out from
    // Info@equipatterns.com. With no check, anyone who guessed the URL could
    // email any document they liked to anybody, and it would arrive looking like
    // genuine EquiPatterns mail. Only signed-in members build pattern books, so
    // that is the bar; the book itself is generated in the browser, so there is
    // no project id here to check ownership against.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token || token === anonKey) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to email a pattern book." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to email a pattern book." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, pdfDataUri, bookName }: SendPatternBookRequest = await req.json();

    const safeBookName = escapeHtml(bookName);

    console.log(`Sending pattern book "${bookName}" to ${email} via Postmark`);

    // Extract base64 data from data URI
    const base64Data = pdfDataUri.split(',')[1];
    if (!base64Data) {
      throw new Error("Invalid PDF data URI format");
    }

    const fileName = `${bookName.replace(/\s+/g, '_')}.pdf`;
    const fromEmail = "EquiPatterns <Info@equipatterns.com>";
    
    console.log(`Attempting to send email from: ${fromEmail} to: ${email}`);

    // Send via Postmark API
    const postmarkResponse = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": apiKey,
      },
      body: JSON.stringify({
        From: fromEmail,
        To: email,
        Subject: `Your Pattern Book: ${safeBookName}`,
        HtmlBody: `
          <h1>Your Pattern Book is Ready!</h1>
          <p>Hello,</p>
          <p>Please find attached your pattern book: <strong>${safeBookName}</strong></p>
          <p>Thank you for using Pattern Book Builder!</p>
          <br>
          <p>Best regards,<br>The EquiPattern Team</p>
        `,
        TextBody: `Your Pattern Book is Ready!\n\nHello,\n\nPlease find attached your pattern book: ${bookName}\n\nThank you for using Pattern Book Builder!\n\nBest regards,\nThe EquiPattern Team`,
        MessageStream: "broadcast",
        Attachments: [
          {
            Name: fileName,
            Content: base64Data,
            ContentType: "application/pdf",
          },
        ],
      }),
    });

    const postmarkResult = await postmarkResponse.json();
    
    console.log("Postmark API response:", JSON.stringify(postmarkResult));

    // Check for Postmark errors
    if (postmarkResult.ErrorCode) {
      throw new Error(`Postmark error: ${postmarkResult.Message}`);
    }

    console.log("Email sent successfully to:", email);

    return new Response(JSON.stringify({ success: true, data: postmarkResult }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-pattern-book function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
