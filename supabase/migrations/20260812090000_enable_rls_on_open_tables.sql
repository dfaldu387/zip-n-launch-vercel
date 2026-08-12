-- Security Advisor: three tables in `public` were exposed through PostgREST
-- with RLS switched off, so the anon key could read, write and delete every
-- row in them:
--
--   site_branding                     rls_disabled_in_public
--   pattern_change_history            rls_disabled_in_public
--   role_permissions_backup_20260804  rls_disabled_in_public
--
-- Each one gets RLS plus policies that match how the app actually uses it.
-- is_admin() is already SECURITY DEFINER, so it does not re-enter the
-- policies it is called from.

-- ---------------------------------------------------------------------------
-- site_branding
-- Read: everyone. SiteBrandingProvider is mounted in main.jsx above the
-- router, so logged-out visitors fetch the logo/background too. Keeping the
-- read open to `anon` is what stops the public pages losing their branding.
-- Write: admins only (Admin -> Site Branding upserts the single 'main' row).
-- ---------------------------------------------------------------------------
ALTER TABLE public.site_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site branding" ON public.site_branding;
CREATE POLICY "Anyone can read site branding"
ON public.site_branding
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage site branding" ON public.site_branding;
CREATE POLICY "Admins can manage site branding"
ON public.site_branding
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- pattern_change_history
-- Audit log written and read only by AdminPatternReviewPage. It stores
-- admin_id / admin_email, so nobody outside the admins should see it, and
-- an audit log nobody can quietly edit is the whole point.
-- ---------------------------------------------------------------------------
ALTER TABLE public.pattern_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage pattern change history" ON public.pattern_change_history;
CREATE POLICY "Admins can manage pattern change history"
ON public.pattern_change_history
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- role_permissions_backup_20260804
-- A one-off backup copy of role_permissions. Nothing in the app references
-- it. RLS on with no policy at all = no client key can touch it; only
-- service_role / SQL editor can still read it if the backup is needed.
-- ---------------------------------------------------------------------------
ALTER TABLE public.role_permissions_backup_20260804 ENABLE ROW LEVEL SECURITY;
