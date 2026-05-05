-- Fix 1: Judge Notifications - Restrict to authenticated users viewing their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.judge_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.judge_notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON public.judge_notifications;

CREATE POLICY "Users can read their own notifications"
ON public.judge_notifications FOR SELECT
TO authenticated
USING (judge_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own notifications"
ON public.judge_notifications FOR UPDATE
TO authenticated
USING (judge_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Authenticated users can insert notifications"
ON public.judge_notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can manage all notifications"
ON public.judge_notifications FOR ALL
TO authenticated
USING (is_admin());

-- Fix 2: Employees - Add proper RLS policies
DROP POLICY IF EXISTS "Admins can manage all employee records" ON public.employees;
DROP POLICY IF EXISTS "Users can manage their own employee record if linked" ON public.employees;

-- Enable RLS if not already enabled
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Admins have full access
CREATE POLICY "Admins have full access to employees"
ON public.employees FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Employees can view and update their own record
CREATE POLICY "Employees can view their own record"
ON public.employees FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Employees can update their own record"
ON public.employees FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Show managers can view employees assigned to their shows
CREATE POLICY "Show managers can view employees for their shows"
ON public.employees FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT s.employee_id FROM shifts s
    JOIN assignments a ON s.assignment_id = a.id
    WHERE a.show_id IN (
      SELECT p.id FROM projects p WHERE p.user_id = auth.uid()
    )
  )
);

-- Fix 3: tbl_maneuvers - Restrict write access
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.tbl_maneuvers;
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.tbl_maneuvers;

-- Public can view maneuvers
CREATE POLICY "Public can view maneuvers"
ON public.tbl_maneuvers FOR SELECT
USING (true);

-- Only admins can modify maneuvers
CREATE POLICY "Admins can manage maneuvers"
ON public.tbl_maneuvers FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());