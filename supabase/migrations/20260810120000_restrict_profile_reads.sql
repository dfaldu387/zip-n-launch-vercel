-- Stop every signed-in user from reading everybody else's profile.
--
-- The table had a blanket policy:
--   CREATE POLICY "Authenticated users can view profiles"
--   ON public.profiles FOR SELECT TO authenticated USING (true);
--
-- so any logged-in account could pull all 63 rows: full names, roles,
-- subscription status and Stripe customer ids.
--
-- Two policies were already in place and do the job on their own:
--   "Users can view their own profile."  SELECT  auth.uid() = id
--   "Admins can manage all profiles"     ALL     has_permission('users:manage')
--
-- Dropping the blanket policy on its own is not enough. has_permission() was
-- not SECURITY DEFINER, so it read public.profiles with RLS still on, which
-- re-entered the very policy that called it: 54001 stack depth limit exceeded.
-- USING (true) had been hiding that, because Postgres short-circuits the OR
-- against a constant and never evaluated the admin policy.
--
-- So the helper has to bypass RLS first. is_admin() is already SECURITY
-- DEFINER, this brings has_permission() in line with it.

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_permissions text[];
  user_role_code text;
BEGIN
  SELECT role, permissions INTO user_role_code, user_permissions
  FROM public.profiles WHERE id = auth.uid();

  IF user_role_code IS NULL THEN
    RETURN false;
  END IF;

  IF LOWER(user_role_code) = 'admin' THEN
    RETURN true;
  END IF;

  IF user_permissions IS NOT NULL AND p_permission_code = ANY(user_permissions) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_code = user_role_code AND permission_code = p_permission_code
  );
END;
$function$;

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Verified on production 2026-08-10:
--   signed in as a HorseManager -> 1 row (own profile)
--   signed in as Admin          -> 63 rows, admin console unaffected
