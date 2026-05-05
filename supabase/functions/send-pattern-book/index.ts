import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    
    const { email, pdfDataUri, bookName }: SendPatternBookRequest = await req.json();

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
        Subject: `Your Pattern Book: ${bookName}`,
        HtmlBody: `
          <h1>Your Pattern Book is Ready!</h1>
          <p>Hello,</p>
          <p>Please find attached your pattern book: <strong>${bookName}</strong></p>
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
