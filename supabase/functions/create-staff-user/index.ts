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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const postmarkApiToken = Deno.env.get('POSTMARK_API_TOKEN') ?? '';

    const { email, name, role }: CreateStaffUserRequest = await req.json();

    // Normalize email (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedEmail = email.trim();
    console.log(`Processing user for email: ${normalizedEmail}, original: ${email}, name: ${name}, role: ${role}`);

    // First, check if customer exists in customers table by email (case-insensitive)
    let existingCustomerByEmail = null;
    let customerCheckError = null;
    
    // Try case-insensitive check first
    const { data: customerIlike, error: errorIlike } = await supabaseAdmin
      .from('customers')
      .select('id, user_id, email, full_name')
      .ilike('email', normalizedEmail)
      .maybeSingle();
    
    if (errorIlike) {
      console.error('Error with ilike check:', errorIlike);
      // Fallback to exact match
      const { data: customerExact, error: errorExact } = await supabaseAdmin
        .from('customers')
        .select('id, user_id, email, full_name')
        .eq('email', trimmedEmail)
        .maybeSingle();
      
      existingCustomerByEmail = customerExact;
      customerCheckError = errorExact;
    } else {
      existingCustomerByEmail = customerIlike;
      customerCheckError = errorIlike;
    }

    if (customerCheckError) {
      console.error('Error checking customers table:', customerCheckError);
    }

    // If customer exists in customers table, don't create anything
    if (existingCustomerByEmail) {
      console.log('Customer already exists in customers table:', existingCustomerByEmail.id, 'with email:', existingCustomerByEmail.email);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Customer already exists',
          userId: existingCustomerByEmail.user_id,
          created: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('No customer found with email:', normalizedEmail, '- proceeding with user creation');
    }

    // Check if user already exists in auth.users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const existingAuthUser = users.find(user => user.email === email);

    if (existingAuthUser) {
      console.log('User already exists in auth.users:', existingAuthUser.id);
      
      // Check if customer exists by email (already checked above, but double-check by user_id)
      const { data: existingCustomerByUserId, error: customerCheckByUserIdError } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', existingAuthUser.id)
        .maybeSingle();

      if (customerCheckByUserIdError) {
        console.error('Error checking customer by user_id:', customerCheckByUserIdError);
      }

      // If customer doesn't exist, create profile first, then customer
      if (!existingCustomerByUserId) {
        // Step 1: Ensure profile exists first
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: existingAuthUser.id,
            full_name: name,
            role: role
          }, {
            onConflict: 'id'
          })
          .select('id')
          .single();

        if (profileError) {
          console.error('Error upserting profile for existing user:', profileError);
        } else {
          console.log('Profile ensured for existing user:', profileData.id);
        }

        // Step 2: Create customer record using profile id
        const nameParts = name.trim().split(/\s+/);
        const lastName = nameParts.slice(1).join(' ') || null;

        const { error: customerCreateError } = await supabaseAdmin
          .from('customers')
          .upsert({
            user_id: existingAuthUser.id,
            email: email,
            full_name: name,
            last_name: lastName,
          }, {
            onConflict: 'user_id'
          });

        if (customerCreateError) {
          console.error('Error creating customer record for existing user:', customerCreateError);
        } else {
          console.log('Customer record created for existing user:', existingAuthUser.id);
        }
      } else {
        // Customer exists, just update profile role
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ role: role, full_name: name })
          .eq('id', existingAuthUser.id);

        if (updateError) {
          console.error('Error updating role for existing user:', updateError);
        }
      }

      console.log('Processed existing user:', existingAuthUser.id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User processed',
          userId: existingAuthUser.id,
          created: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new user with default password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: '12345',
      email_confirm: true,
      user_metadata: {
        full_name: name
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw createError;
    }

    console.log('User created successfully:', newUser.user.id);

    // Step 1: Create/Insert profile first
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        full_name: name,
        role: role
      })
      .select('id')
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Try upsert as fallback (in case profile was created by trigger)
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          full_name: name,
          role: role
        }, {
          onConflict: 'id'
        });
      
      if (upsertError) {
        console.error('Error upserting profile (fallback):', upsertError);
        throw new Error(`Failed to create profile: ${upsertError.message}`);
      } else {
        console.log('Profile upserted successfully (fallback) for user:', newUser.user.id);
      }
    } else {
      console.log('Profile created successfully with id:', profileData.id);
    }

    // Step 2: Use profile id to create customer record
    // Parse name to get first and last name
    const nameParts = name.trim().split(/\s+/);
    const lastName = nameParts.slice(1).join(' ') || null;

    // Create customer record using the profile id (user_id)
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({
        user_id: newUser.user.id,
        email: email,
        full_name: name,
        last_name: lastName,
      }, {
        onConflict: 'user_id'
      });

    if (customerError) {
      console.error('Error creating customer record:', customerError);
      throw new Error(`Failed to create customer record: ${customerError.message}`);
    } else {
      console.log('Customer record created successfully using profile id:', newUser.user.id);
    }

    // Send welcome email with role-specific message via Postmark
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
            <p><strong>Your Login Credentials:</strong></p>
            <ul>
              <li>Email: ${email}</li>
              <li>Temporary Password: <strong>12345</strong></li>
            </ul>
            <p>Please log in and change your password immediately for security reasons.</p>
            <p>Best regards,<br>The EquiPatterns Team</p>
          `,
          MessageStream: 'outbound',
        }),
      });

      if (emailResponse.ok) {
        console.log('Welcome email sent to:', email);
      } else {
        const errorText = await emailResponse.text();
        console.error('Postmark error sending welcome email:', errorText);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        userId: newUser.user.id,
        created: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-staff-user function:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name
    });
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        created: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});