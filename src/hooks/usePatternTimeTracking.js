import { useRef, useCallback, useEffect } from 'react';
import { useAnalyticsTracking } from './useAnalyticsTracking';

/**
 * Hook to track time spent viewing/interacting with patterns
 * Usage:
 *   const { startTracking, stopTracking, trackWithDuration } = usePatternTimeTracking();
 *   
 *   // Start when pattern is opened
 *   startTracking();
 *   
 *   // Stop when pattern is closed (returns time spent in seconds)
 *   const timeSpent = stopTracking();
 *   
 *   // Or use trackWithDuration for automatic tracking
 *   trackWithDuration('view', { patternId: '123', discipline: 'Trail' });
 */
export const usePatternTimeTracking = () => {
    const { trackPatternEvent } = useAnalyticsTracking();
    const startTimeRef = useRef(null);
    const currentPatternRef = useRef(null);

    // Start tracking time for a pattern
    const startTracking = useCallback((patternData = {}) => {
        startTimeRef.current = Date.now();
        currentPatternRef.current = patternData;
    }, []);

    // Stop tracking and return time spent in seconds
    const stopTracking = useCallback(() => {
        if (!startTimeRef.current) return 0;
        
        const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
        startTimeRef.current = null;
        
        return timeSpent;
    }, []);

    // Track pattern event with automatic time calculation
    const trackWithDuration = useCallback(async (action, patternData = {}) => {
        const timeSpent = stopTracking();
        
        await trackPatternEvent(action, {
            ...currentPatternRef.current,
            ...patternData,
            timeSpent: timeSpent > 0 ? timeSpent : patternData.timeSpent
        });
        
        currentPatternRef.current = null;
    }, [trackPatternEvent, stopTracking]);

    // Auto-track time spent when component unmounts
    const useAutoTrack = useCallback((action, patternData = {}) => {
        useEffect(() => {
            startTracking(patternData);
            
            return () => {
                trackWithDuration(action, patternData);
            };
        }, []);
    }, [startTracking, trackWithDuration]);

    return {
        startTracking,
        stopTracking,
        trackWithDuration,
        useAutoTrack,
        getElapsedTime: () => startTimeRef.current 
            ? Math.round((Date.now() - startTimeRef.current) / 1000) 
            : 0
    };
};

export default usePatternTimeTracking;
