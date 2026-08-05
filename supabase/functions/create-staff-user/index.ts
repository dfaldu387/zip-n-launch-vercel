import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateStaffUserRequest {
  email: string;
  name: string;
  role: string;
}

// Roles this endpoint may never hand out, whatever the caller asks for. The
// request used to be trusted as sent, so anyone could call the function with
// role "Admin" and be given an administrator account.
const PRIVILEGED_ROLES = ['admin'];

// Callers send the role in whatever form their screen has: ContactInfo sends the
// display name ("Show Manager"), the close-out step sends the stored value
// ("SHOW_MANAGER"). Dropping case and every separator lets both find the same row.
const normalizeRole = (value: string | null | undefined) =>
  (value ?? '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// A one-time password nobody needs to know. The account is reached through the
// set-password link in the welcome email instead. Every account used to be
// created with the same hardcoded "12345", so knowing a judge's email address
// was enough to sign in as them.
const randomPassword = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const postmarkApiToken = Deno.env.get('POSTMARK_API_TOKEN') ?? '';
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://equipatterns.com';

    // --- 1. The caller must be signed in -------------------------------------
    // This function creates accounts and assigns roles using admin rights, so it
    // must never act for an anonymous request. supabase.functions.invoke sends
    // the caller's session token automatically.
    const authHeader = req.headers.get('Authorization') ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      return json({ success: false, error: 'Sign in required.', created: false }, 401);
    }

    const { data: caller, error: callerError } =
      await supabaseAdmin.auth.getUser(accessToken);

    if (callerError || !caller?.user) {
      return json({ success: false, error: 'Sign in required.', created: false }, 401);
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.user.id)
      .maybeSingle();

    const callerIsAdmin = normalizeRole(callerProfile?.role) === 'admin';

    // --- 2. Validate the request ---------------------------------------------
    const body: CreateStaffUserRequest = await req.json();
    const email = (body?.email ?? '').trim();
    const normalizedEmail = email.toLowerCase();
    const name = (body?.name ?? '').trim();
    const requestedRole = (body?.role ?? '').trim();

    if (!email.includes('@') || !name) {
      return json({ success: false, error: 'A name and a valid email are required.', created: false }, 400);
    }

    // The role has to be one the system actually knows, so a typo or an invented
    // value cannot be written onto an account. Matched against both the stored
    // code and the display name, because the two callers send different ones.
    const { data: knownRoles } = await supabaseAdmin.from('roles').select('role_code, name');
    const wanted = normalizeRole(requestedRole);
    const matchedRole = (knownRoles ?? []).find(
      (r: { role_code: string; name: string }) =>
        normalizeRole(r.role_code) === wanted || normalizeRole(r.name) === wanted
    );

    if (!matchedRole) {
      return json({ success: false, error: `Unknown role: ${requestedRole}`, created: false }, 400);
    }

    const role = matchedRole.role_code;

    // Checked on the resolved code, not on what was sent — asking for the Admin
    // role by its display name must be refused just the same.
    if (!callerIsAdmin && PRIVILEGED_ROLES.includes(normalizeRole(role))) {
      console.warn('Blocked privileged role request from', caller.user.id, 'for', requestedRole);
      return json({ success: false, error: 'That role cannot be assigned here.', created: false }, 403);
    }

    console.log(`create-staff-user by ${caller.user.id}: ${normalizedEmail} as ${role}`);

    // --- 3. Existing account? -------------------------------------------------
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id, user_id, email, full_name')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = (userList?.users ?? []).find(
      (u: { email?: string }) => (u.email ?? '').toLowerCase() === normalizedEmail
    );

    const existingUserId = existingAuthUser?.id ?? existingCustomer?.user_id ?? null;

    if (existingUserId) {
      // An account that already exists keeps the role it has. profiles.role is the
      // person's identity across the whole site — being staff on somebody's show is
      // not the same thing, and that is recorded on the show itself.
      //
      // Overwriting it did real damage in both directions: adding an administrator
      // to a show as a ring steward removed their admin rights, and adding a paying
      // member as a judge turned their account from Customer into JUDGE, which took
      // away the member features they had paid for.
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, full_name')
        .eq('id', existingUserId)
        .maybeSingle();

      // Only fill in a name that is missing; never replace one the person set.
      if (!existingProfile?.full_name && name) {
        await supabaseAdmin
          .from('profiles')
          .upsert({ id: existingUserId, full_name: name }, { onConflict: 'id' });
      }

      if (!existingCustomer) {
        const lastName = name.split(/\s+/).slice(1).join(' ') || null;
        await supabaseAdmin
          .from('customers')
          .upsert({ user_id: existingUserId, email, full_name: name, last_name: lastName }, { onConflict: 'user_id' });
      }

      return json({
        success: true,
        message: 'User already exists',
        userId: existingUserId,
        created: false,
        existingRole: existingProfile?.role ?? null,
      });
    }

    // --- 4. Create the account ------------------------------------------------
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createError || !newUser?.user) {
      console.error('Error creating user:', createError);
      throw createError ?? new Error('User creation returned no user');
    }

    const userId = newUser.user.id;
    console.log('User created:', userId);

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, full_name: name, role }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error saving profile:', profileError);
      throw new Error(`Failed to save profile: ${profileError.message}`);
    }

    const lastName = name.split(/\s+/).slice(1).join(' ') || null;
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({ user_id: userId, email, full_name: name, last_name: lastName }, { onConflict: 'user_id' });

    if (customerError) {
      console.error('Error creating customer record:', customerError);
      throw new Error(`Failed to create customer record: ${customerError.message}`);
    }

    // --- 5. Invite by link, never by password ---------------------------------
    let setPasswordLink = '';
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${siteUrl}/update-password` },
      });

      if (linkError) console.error('Error generating set-password link:', linkError);
      setPasswordLink = linkData?.properties?.action_link ?? '';
    } catch (linkError) {
      console.error('Error generating set-password link:', linkError);
    }

    try {
      const emailResponse = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': postmarkApiToken,
        },
        body: JSON.stringify({
          From: 'EquiPatterns <Info@equipatterns.com>',
          To: email,
          Subject: `Welcome to EquiPatterns - You've Been Added as ${role}`,
          HtmlBody: `
            <h1>Welcome to EquiPatterns, ${name}!</h1>
            <p>You have been added to EquiPatterns as <strong>${role}</strong>.</p>
            <p>Your account uses the email address <strong>${email}</strong>.</p>
            ${
              setPasswordLink
                ? `<p>Choose your password to get started:</p>
                   <p><a href="${setPasswordLink}"
                         style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;
                                text-decoration:none;border-radius:6px;font-weight:600;">Set your password</a></p>
                   <p style="font-size:12px;color:#666;">This link can only be used once. If it has expired,
                      use "Forgot password?" on the sign-in page.</p>`
                : `<p>To get started, open the sign-in page and choose
                      <strong>"Forgot password?"</strong> to set your password.</p>`
            }
            <p>Best regards,<br>The EquiPatterns Team</p>
          `,
          MessageStream: 'outbound',
        }),
      });

      if (!emailResponse.ok) {
        console.error('Postmark error sending welcome email:', await emailResponse.text());
      }
    } catch (emailError) {
      // A failed email must not undo an account that already exists.
      console.error('Error sending email:', emailError);
    }

    return json({
      success: true,
      message: 'User created successfully',
      userId,
      created: true,
    });

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    console.error('Error in create-staff-user function:', errorMessage, error?.stack);
    return json({ success: false, error: errorMessage, created: false }, 500);
  }
});
