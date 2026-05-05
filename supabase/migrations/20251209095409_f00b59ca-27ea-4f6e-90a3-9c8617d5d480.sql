-- Delete all existing analytics data to start fresh (non-admin users only going forward)
TRUNCATE TABLE public.analytics_behavior_events CASCADE;
TRUNCATE TABLE public.analytics_pattern_events CASCADE;
TRUNCATE TABLE public.analytics_performance_logs CASCADE;
TRUNCATE TABLE public.analytics_user_sessions CASCADE;