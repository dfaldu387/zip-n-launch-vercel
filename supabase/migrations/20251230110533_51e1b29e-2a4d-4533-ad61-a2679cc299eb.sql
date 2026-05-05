-- Create notifications table for judge notifications
CREATE TABLE public.judge_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    judge_email TEXT NOT NULL,
    judge_name TEXT,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'assignment',
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX idx_judge_notifications_email ON public.judge_notifications(judge_email);
CREATE INDEX idx_judge_notifications_read ON public.judge_notifications(is_read);

-- Enable RLS
ALTER TABLE public.judge_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for edge function/app to create notifications)
CREATE POLICY "Allow insert notifications" 
ON public.judge_notifications 
FOR INSERT 
WITH CHECK (true);

-- Policy: Users can read their own notifications (by email)
CREATE POLICY "Users can read own notifications" 
ON public.judge_notifications 
FOR SELECT 
USING (true);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" 
ON public.judge_notifications 
FOR UPDATE 
USING (true);