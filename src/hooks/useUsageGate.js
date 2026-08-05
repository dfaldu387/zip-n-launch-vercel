import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { computeUsageAllowance, freeLimitFor } from '@/lib/usageAllowance';

/**
 * @param {'show' | 'pattern_book'} projectType - which project type to count
 */
export function useUsageGate(projectType = 'show') {
  const { user, isSubscribed, isAdmin } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const freeLimit = freeLimitFor(projectType);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      // Only count projects that have been Approved & Locked or Finalized
      // Draft and In-progress projects do NOT consume credits
      const { count: total, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('project_type', projectType)
        .in('status', ['Locked', 'locked', 'Final', 'final', 'Lock & Approve Mode', 'Publication']);

      if (error) throw error;
      setCount(total || 0);
    } catch (error) {
      console.error(`Error fetching ${projectType} count:`, error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, projectType]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const { isUnlimited, canCreate, remainingFree } = computeUsageAllowance({
    isSubscribed,
    isAdmin,
    count,
    freeLimit,
  });

  return {
    canCreate,
    isUnlimited,
    showCount: count,
    remainingFree,
    freeLimit,
    loading,
    refetch: fetchCount,
  };
}
