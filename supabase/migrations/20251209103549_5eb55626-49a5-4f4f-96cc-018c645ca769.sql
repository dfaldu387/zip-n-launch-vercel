-- Delete all sessions with null user_id (these are admin sessions from before fix)
DELETE FROM public.analytics_user_sessions WHERE user_id IS NULL;
DELETE FROM public.analytics_behavior_events WHERE user_id IS NULL;
DELETE FROM public.analytics_pattern_events WHERE user_id IS NULL;
DELETE FROM public.analytics_performance_logs WHERE user_id IS NULL;