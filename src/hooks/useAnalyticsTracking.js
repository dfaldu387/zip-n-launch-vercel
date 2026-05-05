import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Detect device type
const getDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
};

// Get browser info
const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edge')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
};

// Admin user IDs to exclude from tracking
const ADMIN_USER_IDS = [
    '09f47f1a-5ecd-4d99-8994-a9499990ee8b' // John Doe
];

export const useAnalyticsTracking = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const sessionIdRef = useRef(null);
    const sessionStartRef = useRef(null);
    const previousPageRef = useRef(null);
    const isInitializedRef = useRef(false);

    // Check if user is admin or administrator - skip tracking for these roles
    const roleLC = profile?.role?.toLowerCase() || '';
    const isAdminRole = roleLC === 'admin' || roleLC === 'administrator' || roleLC.includes('admin');
    const isAdminById = user?.id && ADMIN_USER_IDS.includes(user.id);
    const isAdmin = isAdminRole || isAdminById;

    // Start session on mount (skip for admins and anonymous users)
    useEffect(() => {
        // Only start session when user is authenticated (has user_id)
        if (isInitializedRef.current || isAdmin || !user?.id) return;
        isInitializedRef.current = true;

        const startSession = async () => {
            try {
                const { data, error } = await supabase
                    .from('analytics_user_sessions')
                    .insert({
                        user_id: user.id, // Now guaranteed to have user.id
                        device_type: getDeviceType(),
                        browser: getBrowserInfo()
                    })
                    .select('id')
                    .single();
                
                if (!error && data) {
                    sessionIdRef.current = data.id;
                    sessionStartRef.current = Date.now();
                    console.log('Analytics session started:', data.id);
                    
                    // Track page load performance automatically
                    trackPageLoadPerformance();
                }
            } catch (err) {
                console.error('Failed to start analytics session:', err);
            }
        };

        // Track initial page load performance
        const trackPageLoadPerformance = async () => {
            try {
                // Use Performance API if available
                const perfEntries = performance.getEntriesByType('navigation');
                const navTiming = perfEntries[0] || performance.timing;
                
                let loadTime = 0;
                if (navTiming) {
                    if (navTiming.loadEventEnd && navTiming.startTime !== undefined) {
                        // Modern Performance API
                        loadTime = Math.round(navTiming.loadEventEnd - navTiming.startTime);
                    } else if (navTiming.loadEventEnd && navTiming.navigationStart) {
                        // Legacy timing API
                        loadTime = navTiming.loadEventEnd - navTiming.navigationStart;
                    }
                }
                
                // Only log if we got a valid load time
                if (loadTime > 0) {
                    await supabase.from('analytics_performance_logs').insert({
                        user_id: user.id,
                        metric_type: 'page_load',
                        page_path: window.location.pathname,
                        load_time_ms: loadTime,
                        device_type: getDeviceType(),
                        browser: getBrowserInfo(),
                        network_type: navigator.connection?.effectiveType || 'unknown'
                    });
                }
            } catch (err) {
                console.error('Failed to track page load performance:', err);
            }
        };

        startSession();

        // End session on unmount/tab close
        const endSession = async () => {
            if (sessionIdRef.current && sessionStartRef.current) {
                const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
                try {
                    await supabase
                        .from('analytics_user_sessions')
                        .update({
                            session_end: new Date().toISOString(),
                            duration_seconds: duration
                        })
                        .eq('id', sessionIdRef.current);
                } catch (err) {
                    console.error('Failed to end session:', err);
                }
            }
        };

        window.addEventListener('beforeunload', endSession);
        return () => {
            endSession();
            window.removeEventListener('beforeunload', endSession);
        };
    }, [user?.id, isAdmin]);

    // Track page views (skip for admins and anonymous users)
    useEffect(() => {
        if (isAdmin || !user?.id) return; // Skip if no user_id
        
        const trackPageView = async () => {
            if (!location.pathname) return;
            
            try {
                await supabase.from('analytics_behavior_events').insert({
                    user_id: user.id, // Now guaranteed to have user.id
                    session_id: sessionIdRef.current,
                    event_type: 'page_view',
                    page_path: location.pathname,
                    previous_page: previousPageRef.current,
                    event_data: { search: location.search }
                });
                previousPageRef.current = location.pathname;
            } catch (err) {
                console.error('Failed to track page view:', err);
            }
        };

        // Small delay to ensure session is initialized
        const timeout = setTimeout(trackPageView, 100);
        return () => clearTimeout(timeout);
    }, [location.pathname, user?.id, isAdmin]);

    // Track pattern events (skip for admins and anonymous users)
    const trackPatternEvent = useCallback(async (action, patternData = {}) => {
        if (isAdmin || !user?.id) return; // Skip tracking for admins and anonymous
        
        try {
            await supabase.from('analytics_pattern_events').insert({
                user_id: user.id, // Now guaranteed to have user.id
                action,
                pattern_id: patternData.patternId || null,
                association_id: patternData.associationId || null,
                discipline: patternData.discipline || null,
                difficulty_level: patternData.difficultyLevel || null,
                time_spent_seconds: patternData.timeSpent || null,
                version_id: patternData.versionId || null,
                device_type: getDeviceType(),
                browser: getBrowserInfo()
            });
        } catch (err) {
            console.error('Failed to track pattern event:', err);
        }
    }, [user?.id, isAdmin]);

    // Track behavior events (skip for admins and anonymous users)
    const trackBehaviorEvent = useCallback(async (eventType, eventData = {}) => {
        if (isAdmin || !user?.id) return; // Skip tracking for admins and anonymous
        
        try {
            await supabase.from('analytics_behavior_events').insert({
                user_id: user.id, // Now guaranteed to have user.id
                session_id: sessionIdRef.current,
                event_type: eventType,
                page_path: location.pathname,
                event_data: eventData
            });
        } catch (err) {
            console.error('Failed to track behavior event:', err);
        }
    }, [user?.id, location.pathname, isAdmin]);

    // Track search (skip for admins)
    const trackSearch = useCallback((searchTerm) => {
        if (isAdmin) return;
        trackBehaviorEvent('search', { searchTerm });
    }, [trackBehaviorEvent, isAdmin]);

    // Track click flow (skip for admins)
    const trackClick = useCallback((elementId, elementType) => {
        if (isAdmin) return;
        trackBehaviorEvent('click', { elementId, elementType });
    }, [trackBehaviorEvent, isAdmin]);

    // Track performance (skip for admins and anonymous users)
    const trackPerformance = useCallback(async (metricType, data = {}) => {
        if (isAdmin || !user?.id) return; // Skip tracking for admins and anonymous
        
        try {
            await supabase.from('analytics_performance_logs').insert({
                user_id: user.id, // Now guaranteed to have user.id
                metric_type: metricType,
                page_path: location.pathname,
                load_time_ms: data.loadTime || null,
                error_message: data.errorMessage || null,
                error_stack: data.errorStack || null,
                device_type: getDeviceType(),
                browser: getBrowserInfo(),
                network_type: navigator.connection?.effectiveType || 'unknown'
            });
        } catch (err) {
            console.error('Failed to track performance:', err);
        }
    }, [user?.id, location.pathname, isAdmin]);

    // Track errors (skip for admins)
    const trackError = useCallback((error) => {
        if (isAdmin) return;
        trackPerformance('error', {
            errorMessage: error.message,
            errorStack: error.stack
        });
    }, [trackPerformance, isAdmin]);

    return {
        trackPatternEvent,
        trackBehaviorEvent,
        trackSearch,
        trackClick,
        trackPerformance,
        trackError
    };
};

export default useAnalyticsTracking;
