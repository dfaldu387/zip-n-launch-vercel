import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const MarketingContentContext = createContext(null);

const EMPTY_MARKETING = { ads: [], announcements: [] };

export function MarketingContentProvider({ children }) {
  const [content, setContent] = useState(EMPTY_MARKETING);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const markTableMissing = useCallback(() => setTableMissing(true), []);

  const refreshContent = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);

    const { data, error } = await supabase
      .from('marketing_content')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const missing =
        msg.includes('could not find the table') ||
        msg.includes('marketing_content');

      if (missing) {
        setTableMissing(true);
        setContent(EMPTY_MARKETING);
        setLoading(false);
        return;
      }

      setLoading(false);
      return;
    }

    const ads = (data || []).filter(item => item.slot?.startsWith('ad_'));
    const announcements = (data || []).filter(item => item.slot === 'announcement');

    setContent({ ads, announcements });
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshContent();
  }, [refreshContent]);

  const value = useMemo(
    () => ({
      content,
      setContent,
      refreshContent,
      loading,
      tableMissing,
      markTableMissing,
    }),
    [content, refreshContent, loading, tableMissing, markTableMissing],
  );

  return (
    <MarketingContentContext.Provider value={value}>
      {children}
    </MarketingContentContext.Provider>
  );
}

export function useMarketingContent() {
  const ctx = useContext(MarketingContentContext);
  if (!ctx) throw new Error('useMarketingContent must be used within a MarketingContentProvider');
  return ctx;
}
