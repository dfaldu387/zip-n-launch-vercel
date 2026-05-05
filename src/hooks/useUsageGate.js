import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const FREE_LIMITS = {
  show: 2,
  pattern_book: 2,
};

/**
 * @param {'show' | 'pattern_book'} projectType - which project type to count
 */
export function useUsageGate(projectType = 'show') {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const freeLimit = FREE_LIMITS[projectType] ?? 2;

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

  const canCreate = count < freeLimit;
  const remainingFree = Math.max(0, freeLimit - count);

  return {
    canCreate,
    showCount: count,
    remainingFree,
    freeLimit,
    loading,
    refetch: fetchCount,
  };
}
