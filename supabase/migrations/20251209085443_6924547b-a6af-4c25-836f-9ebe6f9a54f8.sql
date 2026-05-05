-- Analytics Pattern Events Table
CREATE TABLE public.analytics_pattern_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    pattern_id UUID,
    action TEXT NOT NULL, -- 'view', 'download', 'practice', 'save', 'revisit'
    association_id TEXT,
    discipline TEXT,
    difficulty_level TEXT,
    time_spent_seconds INTEGER,
    version_id TEXT,
    device_type TEXT, -- 'mobile', 'tablet', 'desktop'
    browser TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Analytics User Sessions Table
CREATE TABLE public.analytics_user_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    device_type TEXT,
    browser TEXT,
    ip_hash TEXT, -- anonymized IP
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Analytics Behavior Events Table
CREATE TABLE public.analytics_behavior_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.analytics_user_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'page_view', 'click', 'search', 'navigation', 'abandonment'
    event_data JSONB, -- stores click flows, search terms, etc.
    page_path TEXT,
    previous_page TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Analytics Performance Logs Table
CREATE TABLE public.analytics_performance_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metric_type TEXT NOT NULL, -- 'page_load', 'api_latency', 'error', 'upload_failure'
    page_path TEXT,
    load_time_ms INTEGER,
    error_message TEXT,
    error_stack TEXT,
    device_type TEXT,
    browser TEXT,
    network_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.analytics_pattern_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_performance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only Admins can view all data
CREATE POLICY "Admins can view all pattern events" 
ON public.analytics_pattern_events 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can insert pattern events" 
ON public.analytics_pattern_events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all user sessions" 
ON public.analytics_user_sessions 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can insert user sessions" 
ON public.analytics_user_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update user sessions" 
ON public.analytics_user_sessions 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can view all behavior events" 
ON public.analytics_behavior_events 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can insert behavior events" 
ON public.analytics_behavior_events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all performance logs" 
ON public.analytics_performance_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can insert performance logs" 
ON public.analytics_performance_logs 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_pattern_events_user ON public.analytics_pattern_events(user_id);
CREATE INDEX idx_pattern_events_action ON public.analytics_pattern_events(action);
CREATE INDEX idx_pattern_events_created ON public.analytics_pattern_events(created_at);
CREATE INDEX idx_user_sessions_user ON public.analytics_user_sessions(user_id);
CREATE INDEX idx_behavior_events_user ON public.analytics_behavior_events(user_id);
CREATE INDEX idx_behavior_events_session ON public.analytics_behavior_events(session_id);
CREATE INDEX idx_performance_logs_type ON public.analytics_performance_logs(metric_type);
CREATE INDEX idx_performance_logs_created ON public.analytics_performance_logs(created_at);