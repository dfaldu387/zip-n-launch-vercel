import React, { createContext, useContext } from 'react';
import { useAnalyticsTracking } from '@/hooks/useAnalyticsTracking';

const AnalyticsContext = createContext(null);

export const useAnalytics = () => {
    const context = useContext(AnalyticsContext);
    if (!context) {
        // Return no-op functions if used outside provider
        return {
            trackPatternEvent: () => {},
            trackBehaviorEvent: () => {},
            trackSearch: () => {},
            trackClick: () => {},
            trackPerformance: () => {},
            trackError: () => {},
        };
    }
    return context;
};

export const AnalyticsProvider = ({ children }) => {
    const analytics = useAnalyticsTracking();

    return (
        <AnalyticsContext.Provider value={analytics}>
            {children}
        </AnalyticsContext.Provider>
    );
};

export default AnalyticsProvider;
