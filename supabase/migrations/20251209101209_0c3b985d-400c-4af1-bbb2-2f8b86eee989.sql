-- Delete all existing analytics data to exclude admin/administrator roles
TRUNCATE TABLE public.analytics_behavior_events CASCADE;
TRUNCATE TABLE public.analytics_pattern_events CASCADE;
TRUNCATE TABLE public.analytics_performance_logs CASCADE;
TRUNCATE TABLE public.analytics_user_sessions CASCADE;