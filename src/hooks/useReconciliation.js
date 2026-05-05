import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export const useReconciliation = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Shows
  const [shows, setShows] = useState([]);
  const [isShowsLoading, setIsShowsLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  // Reconciliation data
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalPlanned: 0,
    totalAccountedFor: 0,
    totalMissing: 0,
    totalDamaged: 0,
  });

  // ---- FETCH SHOWS ----

  const fetchUserShows = useCallback(async () => {
    if (!user) return;
    setIsShowsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_data')
        .eq('user_id', user.id)
        .eq('project_type', 'show')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      const mapped = (data || []).map(p => ({
        id: p.id,
        name: p.project_data?.showName || p.project_data?.name || 'Unnamed Show',
      }));
      setShows(mapped);
    } catch (error) {
      console.error('Error fetching shows:', error);
      toast({ title: 'Error', description: 'Failed to load shows.', variant: 'destructive' });
    } finally {
      setIsShowsLoading(false);
    }
  }, [user, toast]);

  // ---- SELECT SHOW & LOAD DATA ----

  const selectShow = useCallback(async (show) => {
    setSelectedShow(show);
    if (!show || !user) {
      setItems([]);
      setSummaryStats({ totalPlanned: 0, totalAccountedFor: 0, totalMissing: 0, totalDamaged: 0 });
      return;
    }
    await fetchReconciliationData(show.id);
  }, [user]);

  const fetchReconciliationData = useCallback(async (showId) => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [distRes, txnRes, eqRes] = await Promise.all([
        supabase
          .from('distribution_plan')
          .select('equipment_id, planned_qty')
          .eq('show_id', showId)
          .eq('user_id', user.id),
        supabase
          .from('equipment_transactions')
          .select('equipment_id, transaction_type, quantity')
          .eq('show_id', showId)
          .eq('user_id', user.id),
        supabase
          .from('equipment_items')
          .select('id, name, category, total_qty_owned, condition, unit_type')
          .eq('user_id', user.id),
      ]);

      if (distRes.error) throw distRes.error;
      if (txnRes.error) throw txnRes.error;
      if (eqRes.error) throw eqRes.error;

      // Build equipment lookup
      const eqMap = {};
      for (const eq of eqRes.data || []) {
        eqMap[eq.id] = eq;
      }

      // Aggregate planned quantities per equipment
      const planned = {};
      for (const row of distRes.data || []) {
        planned[row.equipment_id] = (planned[row.equipment_id] || 0) + row.planned_qty;
      }

      // Aggregate transactions per equipment
      const txnTotals = {};
      for (const tx of txnRes.data || []) {
        if (!txnTotals[tx.equipment_id]) {
          txnTotals[tx.equipment_id] = { checkedIn: 0, checkedOut: 0 };
        }
        if (tx.transaction_type === 'check_in') {
          txnTotals[tx.equipment_id].checkedIn += tx.quantity;
        } else if (tx.transaction_type === 'check_out') {
          txnTotals[tx.equipment_id].checkedOut += tx.quantity;
        }
      }

      // Build reconciliation items — include any equipment that was planned or transacted
      const allEqIds = new Set([...Object.keys(planned), ...Object.keys(txnTotals)]);
      const reconciled = [];
      let totalPlanned = 0, totalAccountedFor = 0, totalMissing = 0, totalDamaged = 0;

      for (const eqId of allEqIds) {
        const eq = eqMap[eqId];
        if (!eq) continue;

        const plannedQty = planned[eqId] || 0;
        const checkedIn = txnTotals[eqId]?.checkedIn || 0;
        const checkedOut = txnTotals[eqId]?.checkedOut || 0;
        const onHand = checkedIn - checkedOut;
        const missing = Math.max(0, plannedQty - checkedIn);
        const isDamaged = eq.condition === 'needs_repair' || eq.condition === 'poor';

        let status = 'ok';
        if (missing > 0) status = 'missing';
        else if (plannedQty > 0 && checkedIn >= plannedQty) status = 'accounted';
        if (isDamaged) status = 'damaged';

        totalPlanned += plannedQty;
        totalAccountedFor += Math.min(checkedIn, plannedQty);
        if (missing > 0) totalMissing += missing;
        if (isDamaged) totalDamaged++;

        reconciled.push({
          equipmentId: eqId,
          name: eq.name,
          category: eq.category,
          unitType: eq.unit_type,
          totalOwned: eq.total_qty_owned,
          condition: eq.condition,
          plannedQty,
          checkedIn,
          checkedOut,
          onHand,
          missing,
          status,
        });
      }

      // Sort: missing first, then damaged, then rest
      reconciled.sort((a, b) => {
        const order = { missing: 0, damaged: 1, ok: 2, accounted: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.name.localeCompare(b.name);
      });

      setItems(reconciled);
      setSummaryStats({ totalPlanned, totalAccountedFor, totalMissing, totalDamaged });
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
      toast({ title: 'Error', description: 'Failed to load reconciliation data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // ---- MARK DAMAGED ----

  const markDamaged = useCallback(async (equipmentId) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('equipment_items')
        .update({ condition: 'needs_repair' })
        .eq('id', equipmentId);

      if (error) throw error;
      toast({ title: 'Updated', description: 'Item marked as needs repair.' });

      // Refresh data
      if (selectedShow) await fetchReconciliationData(selectedShow.id);
    } catch (error) {
      console.error('Error marking damaged:', error);
      toast({ title: 'Error', description: 'Failed to update item condition.', variant: 'destructive' });
    }
  }, [user, toast, selectedShow, fetchReconciliationData]);

  // ---- RESET SHOW TRANSACTIONS ----

  const resetShowTransactions = useCallback(async () => {
    if (!user || !selectedShow) return;
    try {
      const { error } = await supabase
        .from('equipment_transactions')
        .delete()
        .eq('show_id', selectedShow.id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Reset Complete', description: 'All transactions for this show have been cleared.' });
      await fetchReconciliationData(selectedShow.id);
    } catch (error) {
      console.error('Error resetting transactions:', error);
      toast({ title: 'Error', description: 'Failed to reset transactions.', variant: 'destructive' });
    }
  }, [user, toast, selectedShow, fetchReconciliationData]);

  return {
    shows,
    isShowsLoading,
    selectedShow,
    items,
    isLoading,
    summaryStats,
    fetchUserShows,
    selectShow,
    markDamaged,
    resetShowTransactions,
  };
};
