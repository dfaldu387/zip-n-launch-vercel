-- Enable REPLICA IDENTITY FULL for the judge_notifications table
ALTER TABLE public.judge_notifications REPLICA IDENTITY FULL;

-- Add the table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_notifications;