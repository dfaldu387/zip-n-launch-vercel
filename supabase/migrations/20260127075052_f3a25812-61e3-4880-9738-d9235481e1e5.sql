-- Fix: avoid selecting from auth.users inside RLS policies (causes "permission denied for table users")

DROP POLICY IF EXISTS "Users can read their own notifications" ON public.judge_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.judge_notifications;

-- Match notifications to the signed-in user's email from JWT claims
CREATE POLICY "Users can read their own notifications"
ON public.judge_notifications
FOR SELECT
TO authenticated
USING (judge_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Users can update their own notifications"
ON public.judge_notifications
FOR UPDATE
TO authenticated
USING (judge_email = (auth.jwt() ->> 'email'));
