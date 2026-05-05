-- =============================================
-- SECURITY FIX MIGRATION - Part 2
-- =============================================

-- 1. Enable RLS on ep_show_associations table (currently disabled)
ALTER TABLE public.ep_show_associations ENABLE ROW LEVEL SECURITY;

-- Add proper RLS policies for ep_show_associations
DROP POLICY IF EXISTS "Admins have full access to show associations" ON public.ep_show_associations;
DROP POLICY IF EXISTS "Public can view show associations" ON public.ep_show_associations;
DROP POLICY IF EXISTS "ShowManagers can manage their show associations" ON public.ep_show_associations;

CREATE POLICY "Admins have full access to show associations"
ON public.ep_show_associations
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Public can view show associations"
ON public.ep_show_associations
FOR SELECT
USING (true);

CREATE POLICY "ShowManagers can manage their show associations"
ON public.ep_show_associations
FOR ALL
USING (is_assigned_to_show(show_id))
WITH CHECK (is_assigned_to_show(show_id));

-- 2. Fix profiles table - restrict public access to authenticated users only
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 3. Update functions to set search_path (fixing Function Search Path Mutable warnings)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
   NEW.updated_at = timezone('utc'::text, now()); 
   RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT permissions FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  user_permissions text[];
  user_role_code text;
BEGIN
  SELECT role, permissions INTO user_role_code, user_permissions FROM public.profiles WHERE id = auth.uid();

  IF user_role_code = 'Admin' THEN
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

CREATE OR REPLACE FUNCTION public.is_assigned_to_show(show_id_to_check uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  user_role text;
  user_shows uuid[];
BEGIN
  SELECT role, shows_allowed INTO user_role, user_shows FROM public.profiles WHERE id = auth.uid();

  IF user_role = 'Admin' THEN
    RETURN true;
  END IF;
  
  IF user_shows IS NOT NULL AND show_id_to_check = ANY(user_shows) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.get_pattern_creator_id(p_pattern_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    creator_id uuid;
BEGIN
    SELECT created_by INTO creator_id
    FROM public.ep_patterns
    WHERE id = p_pattern_id;
    RETURN creator_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_divisions(keyword text)
RETURNS SETOF divisions
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT DISTINCT d.*
  FROM divisions d
  LEFT JOIN associations a ON d.association_id = a.id
  LEFT JOIN division_levels dl ON d.id = dl.division_id
  WHERE
    keyword IS NULL OR
    d.name ILIKE '%' || keyword || '%' OR
    a.name ILIKE '%' || keyword || '%' OR
    dl.name ILIKE '%' || keyword || '%';
$function$;

CREATE OR REPLACE FUNCTION public.search_classes(keyword text)
RETURNS TABLE(id uuid, name text, category text, sort_order integer, association_id text)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT DISTINCT c.id, c.name, c.category, c.sort_order, c.association_id
  FROM classes c
  LEFT JOIN associations a ON c.association_id = a.id
  WHERE
    keyword IS NULL OR
    c.name ILIKE '%' || keyword || '%' OR
    c.category ILIKE '%' || keyword || '%' OR
    a.name ILIKE '%' || keyword || '%';
$function$;

CREATE OR REPLACE FUNCTION public.search_disciplines(keyword text)
RETURNS SETOF disciplines
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT DISTINCT d.*
  FROM disciplines d
  LEFT JOIN associations a ON d.association_id = a.id
  WHERE
    keyword IS NULL OR
    d.name ILIKE '%' || keyword || '%' OR
    d.category ILIKE '%' || keyword || '%' OR
    d.pattern_type ILIKE '%' || keyword || '%' OR
    a.name ILIKE '%' || keyword || '%';
$function$;

CREATE OR REPLACE FUNCTION public.get_my_shows()
RETURNS SETOF ep_shows
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT s.*
  FROM public.ep_shows s
  JOIN public.profiles p ON (s.id = ANY(p.shows_allowed::uuid[]) OR p.role = 'Admin')
  WHERE p.id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, role)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'Customer');

    INSERT INTO public.customers (user_id, email, full_name, last_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'last_name');

    RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_pattern_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    actor_id uuid;
BEGIN
    actor_id := auth.uid();

    INSERT INTO public.ep_audit_logs (actor_id, action, entity_type, entity_id, payload)
    VALUES (actor_id, 'status_update', 'Pattern', NEW.id, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));

    IF NEW.status = 'in_review' AND OLD.status = 'draft' THEN
        INSERT INTO public.ep_approvals (entity_type, entity_id, requested_by, approver_roles, version, created_by, updated_by)
        VALUES ('Pattern', NEW.id, actor_id, ARRAY['ShowManager', 'Judge', 'ShowSecretary'], NEW.version, actor_id, actor_id);
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    actor_id uuid;
    pattern_creator_id uuid;
    pattern_title text;
    show_id_for_class uuid;
    show_secretaries uuid[];
BEGIN
    actor_id := auth.uid();

    INSERT INTO public.ep_audit_logs (actor_id, action, entity_type, entity_id, payload)
    VALUES (actor_id, 'approval_decision', 'Approval', NEW.id, jsonb_build_object('decision', NEW.decision, 'notes', NEW.notes));

    IF NEW.decision = 'changes_requested' AND OLD.decision <> 'changes_requested' THEN
        SELECT title, created_by INTO pattern_title, pattern_creator_id
        FROM public.ep_patterns
        WHERE id = NEW.entity_id;

        INSERT INTO public.ep_tasks (title, description, entity_type, entity_id, assigned_to, status, created_by, updated_by)
        VALUES (
            'Changes Requested for Pattern: ' || pattern_title,
            'Notes: ' || NEW.notes,
            'Pattern',
            NEW.entity_id,
            pattern_creator_id,
            'open',
            actor_id,
            actor_id
        );
        
        UPDATE public.ep_patterns SET status = 'draft' WHERE id = NEW.entity_id;
    END IF;

    IF NEW.decision = 'approved' AND OLD.decision <> 'approved' THEN
        UPDATE public.ep_patterns SET status = 'approved' WHERE id = NEW.entity_id;

        SELECT c.show_id INTO show_id_for_class
        FROM public.ep_classes c
        JOIN public.ep_scoresheets s ON s.class_id = c.id
        WHERE s.pattern_id = NEW.entity_id
        LIMIT 1;

        IF show_id_for_class IS NOT NULL THEN
            SELECT array_agg(p.id) INTO show_secretaries
            FROM public.profiles p
            WHERE p.role = 'ShowSecretary' AND show_id_for_class = ANY(p.shows_allowed);

            IF array_length(show_secretaries, 1) > 0 THEN
                SELECT title INTO pattern_title FROM public.ep_patterns WHERE id = NEW.entity_id;
                FOREACH actor_id IN ARRAY show_secretaries LOOP
                    INSERT INTO public.ep_tasks (title, description, entity_type, entity_id, assigned_to, status, created_by, updated_by)
                    VALUES (
                        'Generate ScoreSheets for Approved Pattern: ' || pattern_title,
                        'Pattern "' || pattern_title || '" has been approved. Please generate linked scoresheets for the relevant classes.',
                        'Pattern',
                        NEW.entity_id,
                        actor_id,
                        'open',
                        auth.uid(),
                        auth.uid()
                    );
                END LOOP;
            END IF;
        END IF;
    END IF;
    
    IF NEW.decision = 'rejected' AND OLD.decision <> 'rejected' THEN
        UPDATE public.ep_patterns SET status = 'retired' WHERE id = NEW.entity_id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_packet_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF NEW.status = 'published' AND OLD.status <> 'published' THEN
        NEW.pages = OLD.pages;
        NEW.theme = OLD.theme;
        NEW.title = OLD.title;
        NEW.version = OLD.version + 1;
        
        INSERT INTO public.ep_audit_logs (actor_id, action, entity_type, entity_id, payload)
        VALUES (auth.uid(), 'packet_published', 'Packet', NEW.id, jsonb_build_object('version', NEW.version, 'url', NEW.output_pdf_url));
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_distribution_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.ep_audit_logs (actor_id, action, entity_type, entity_id, payload)
        VALUES (auth.uid(), 'distribution_revoked', 'Distribution', OLD.id, jsonb_build_object('target_role', OLD.target_role, 'access_code', OLD.access_code));
    END IF;
    
    RETURN OLD;
END;
$function$;