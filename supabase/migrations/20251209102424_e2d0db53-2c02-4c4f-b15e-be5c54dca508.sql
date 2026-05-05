-- Delete all analytics data for admin users and clean slate
DELETE FROM public.analytics_behavior_events WHERE user_id = '09f47f1a-5ecd-4d99-8994-a9499990ee8b';
DELETE FROM public.analytics_pattern_events WHERE user_id = '09f47f1a-5ecd-4d99-8994-a9499990ee8b';
DELETE FROM public.analytics_performance_logs WHERE user_id = '09f47f1a-5ecd-4d99-8994-a9499990ee8b';
DELETE FROM public.analytics_user_sessions WHERE user_id = '09f47f1a-5ecd-4d99-8994-a9499990ee8b';

-- Also delete anonymous sessions that might be from admins
DELETE FROM public.analytics_user_sessions;
DELETE FROM public.analytics_behavior_events;
DELETE FROM public.analytics_pattern_events;
DELETE FROM public.analytics_performance_logs;