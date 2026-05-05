import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SiteBrandingContext = createContext(null);

const EMPTY_BRANDING = { background_url: '', logo_url: '' };

export function SiteBrandingProvider({ children }) {
  const [branding, setBranding] = useState(EMPTY_BRANDING);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const markTableMissing = useCallback(() => setTableMissing(true), []);

  const refreshBranding = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);

    const { data, error } = await supabase
      .from('site_branding')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const missing =
        msg.includes('could not find the table') ||
        msg.includes('site_branding');

      if (missing) {
        setTableMissing(true);
        setBranding(EMPTY_BRANDING);
        setLoading(false);
        return;
      }

      // PGRST116 = no row found; treat as not configured yet.
      if (error.code === 'PGRST116') {
        setBranding(EMPTY_BRANDING);
        setLoading(false);
        return;
      }

      // Any other error: keep existing branding, just stop loading.
      setLoading(false);
      return;
    }

    setBranding({
      background_url: data?.background_url || '',
      logo_url: data?.logo_url || '',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  const value = useMemo(
    () => ({
      branding,
      setBranding,
      refreshBranding,
      loading,
      tableMissing,
      markTableMissing,
    }),
    [branding, refreshBranding, loading, tableMissing, markTableMissing],
  );

  return (
    <SiteBrandingContext.Provider value={value}>
      {children}
    </SiteBrandingContext.Provider>
  );
}

export function useSiteBranding() {
  const ctx = useContext(SiteBrandingContext);
  if (!ctx) throw new Error('useSiteBranding must be used within a SiteBrandingProvider');
  return ctx;
}


