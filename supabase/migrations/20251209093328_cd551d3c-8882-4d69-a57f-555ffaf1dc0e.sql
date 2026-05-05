-- Fix is_admin function to be case-insensitive
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  ELSE
    RETURN EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND LOWER(role) = 'admin'
    );
  END IF;
END;
$function$;