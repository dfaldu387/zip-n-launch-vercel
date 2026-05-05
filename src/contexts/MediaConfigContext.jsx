import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { pageConfig } from '@/lib/pageConfig';

const MediaConfigContext = createContext();

const generateDefaultConfig = () => {
    const config = {};
    pageConfig.forEach(group => {
        group.pages.forEach(page => {
            config[page.targetId] = { url: page.defaultImage, id: null };
        });
    });
    return config;
};

const defaultConfig = generateDefaultConfig();

export const MediaConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(defaultConfig);
    const [loading, setLoading] = useState(true);

    const fetchConfig = useCallback(async () => {
        setLoading(false);
        setConfig(defaultConfig);
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    return (
        <MediaConfigContext.Provider value={{ config, updateConfig: fetchConfig, defaultConfig, loading }}>
            {children}
        </MediaConfigContext.Provider>
    );
};

export const useMediaConfig = () => useContext(MediaConfigContext);