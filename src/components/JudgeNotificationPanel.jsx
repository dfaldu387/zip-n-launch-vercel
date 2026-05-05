import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, FileText, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
const JudgeNotificationPanel = ({ userEmail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Handle notification click - navigate to Judges Portal
    const handleNotificationClick = async (notification) => {
        // Mark as read if not already
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }
        
        // Close the panel and navigate to Judges Portal
        setIsOpen(false);
        navigate('/judges-portal');
    };

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            if (!userEmail) return;
            
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('judge_notifications')
                    .select('*')
                    .eq('judge_email', userEmail.toLowerCase())
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) {
                    // Table may not exist yet
                    if (error.code === 'PGRST205' || error.code === '42P01') {
                        setNotifications([]);
                        return;
                    }
                    throw error;
                }
                setNotifications(data || []);
            } catch (error) {
                console.error('Error fetching notifications:', error);
                setNotifications([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotifications();
        
        // Set up real-time subscription
        const channel = supabase
            .channel('judge-notifications')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'judge_notifications',
                    filter: `judge_email=eq.${userEmail?.toLowerCase()}`
                }, 
                (payload) => {
                    setNotifications(prev => [payload.new, ...prev]);
                    toast({
                        title: 'New Notification',
                        description: payload.new.message,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userEmail, toast]);

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('judge_notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications(prev => 
                prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length === 0) return;

            const { error } = await supabase
                .from('judge_notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', unreadIds);

            if (error) throw error;

            setNotifications(prev => 
                prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
            
            toast({
                title: 'All Marked as Read',
                description: 'All notifications have been marked as read.',
            });
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'assignment':
                return <FileText className="h-4 w-4 text-primary" />;
            default:
                return <Bell className="h-4 w-4 text-primary" />;
        }
    };

    const portalRoot = typeof document !== 'undefined' ? document.body : null;

    return (
        <>
            {/* Notification Bell Button */}
            <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label="Open notifications"
                onClick={() => setIsOpen(true)}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <Badge 
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                )}
            </Button>

            {/* Slide-out Panel (portaled to body so it isn't constrained by header/layout transforms) */}
            {portalRoot &&
                createPortal(
                    <AnimatePresence>
                        {isOpen && (
                            <>
                                {/* Backdrop */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                                    onClick={() => setIsOpen(false)}
                                />

                                {/* Panel */}
                                <motion.div
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-xl z-50 flex flex-col"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between p-4 border-b border-border">
                                        <div className="flex items-center gap-2">
                                            <Bell className="h-5 w-5 text-primary" />
                                            <h2 className="text-lg font-semibold">Notifications</h2>
                                            {unreadCount > 0 && (
                                                <Badge variant="secondary">{unreadCount} unread</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {unreadCount > 0 && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={markAllAsRead}
                                                >
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Mark all read
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Close notifications"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Notifications List */}
                                    <ScrollArea className="flex-1">
                                        {isLoading ? (
                                            <div className="flex items-center justify-center h-32">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                            </div>
                                        ) : notifications.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                                <Bell className="h-12 w-12 mb-4 opacity-50" />
                                                <p className="text-lg font-medium">No notifications</p>
                                                <p className="text-sm">You're all caught up!</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-border">
                                                {notifications.map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                                                            !notification.is_read ? 'bg-primary/5' : ''
                                                        }`}
                                                        onClick={() => handleNotificationClick(notification)}
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                {getNotificationIcon(notification.notification_type)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''}`}>
                                                                        {notification.message}
                                                                    </p>
                                                                    {!notification.is_read && (
                                                                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                                    <Clock className="h-3 w-3" />
                                                                    <span>
                                                                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                                    </span>
                                                                </div>
                                                                {notification.project_name && (
                                                                    <div className="flex items-center gap-1 mt-2">
                                                                        <Badge variant="outline" className="text-xs">
                                                                            <FileText className="h-3 w-3 mr-1" />
                                                                            {notification.project_name}
                                                                        </Badge>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>,
                    portalRoot
                )}
        </>
    );
};

export default JudgeNotificationPanel;
