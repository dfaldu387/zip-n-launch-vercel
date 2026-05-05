-- Delete all analytics data again to remove admin user data
DELETE FROM public.analytics_behavior_events;
DELETE FROM public.analytics_pattern_events;
DELETE FROM public.analytics_performance_logs;
DELETE FROM public.analytics_user_sessions;