import { supabase } from '@/lib/supabaseClient';

/**
 * Calls a Supabase edge function as the signed-in user.
 *
 * supabase-js 2.30 does not carry the session into functions.invoke — it sends the
 * anonymous key as the Authorization header instead. Any function that checks who
 * is calling therefore saw an anonymous request and refused it. Reading the session
 * and passing the token explicitly keeps the caller's identity intact.
 *
 * Returns the same `{ data, error }` shape as supabase.functions.invoke.
 */
export const invokeAsUser = async (functionName, body, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      data: null,
      error: new Error('You need to be signed in to do that. Please sign in and try again.'),
    };
  }

  return supabase.functions.invoke(functionName, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
    body,
  });
};
