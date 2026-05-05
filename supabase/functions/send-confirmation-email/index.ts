import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const POSTMARK_API_TOKEN = Deno.env.get('POSTMARK_API_TOKEN') as string
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateEmailHtml(userName: string, confirmationUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to EquiPatterns.com</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f9fc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; max-width: 600px;">
          <tr>
            <td style="padding: 40px 40px 30px;">
              <h1 style="color: #1a1a1a; font-size: 28px; font-weight: 700; margin: 0 0 30px; text-align: center;">Welcome to EquiPatterns.com</h1>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0;">Hello ${userName},</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0;">Thank you for joining EquiPatterns.com. We're excited to have you as part of our growing community.</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0;">Our goal is to simplify how patterns and score sheets are selected, organized, and accessed, while giving you a clean, reliable system to manage the files you use every day—whether for practice, shows, or judging.</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0;">As the platform continues to evolve, EquiPatterns.com is being built to support:</p>
              
              <ul style="color: #333333; font-size: 16px; line-height: 28px; margin: 20px 0; padding-left: 24px;">
                <li>Streamlined pattern selection</li>
                <li>Centralized organization of pattern files and score sheets</li>
                <li>Clear, consistent access to discipline-specific materials</li>
                <li>Legal patterns tailored to specific associations</li>
              </ul>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0;">Looking ahead, our roadmap includes the rollout of expanded show and management features, with full network-level tools targeted for release by the end of 2026.</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0;">To get started, please confirm your email address and activate your account using the link below:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${confirmationUrl}" style="background-color: #2563eb; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 600; padding: 14px 32px; text-decoration: none;">👉 Confirm Your Account</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0;">We're here to help and look forward to supporting you as the platform grows.</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 26px; margin: 16px 0 4px;">Sincerely,</p>
              <p style="color: #333333; font-size: 16px; font-weight: 600; margin: 4px 0 24px;">The EquiPatterns Team</p>
              
              <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 32px 0;">
              
              <p style="color: #8898aa; font-size: 12px; line-height: 20px; text-align: center; margin: 8px 0;">If you didn't create an account on EquiPatterns.com, you can safely ignore this email.</p>
              
              <p style="color: #8898aa; font-size: 12px; line-height: 20px; text-align: center; margin: 8px 0;">
                <a href="https://equipatterns.com" style="color: #2563eb; text-decoration: underline;">EquiPatterns.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  try {
    const wh = new Webhook(hookSecret)
    const {
      user,
      email_data: { token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
        user_metadata?: {
          full_name?: string
          first_name?: string
          last_name?: string
        }
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
      }
    }

    // Only handle signup confirmation emails
    if (email_action_type !== 'signup') {
      console.log('Skipping non-signup email type:', email_action_type)
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Get user name from metadata
    const userName = user.user_metadata?.full_name || 
                    (user.user_metadata?.first_name && user.user_metadata?.last_name 
                      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                      : 'Valued Member')

    // Build confirmation URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

    // Generate email HTML
    const html = generateEmailHtml(userName, confirmationUrl)

    // Send email via Postmark
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: 'EquiPatterns <Info@equipatterns.com>',
        To: user.email,
        Subject: 'Welcome to EquiPatterns.com - Confirm Your Account',
        HtmlBody: html,
        MessageStream: 'outbound',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Postmark error:', errorText)
      throw new Error(`Postmark API error: ${response.status}`)
    }

    const result = await response.json()
    console.log('Email sent successfully:', result.MessageID)

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error sending confirmation email:', errorMessage)
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: errorMessage,
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
})
