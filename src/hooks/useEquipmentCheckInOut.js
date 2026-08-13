import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export const useEquipmentCheckInOut = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // ---- SHOWS ----
  const [shows, setShows] = useState([]);
  const [isShowsLoading, setIsShowsLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  // ---- ARENAS ----
  const [arenas, setArenas] = useState([]);
  const [isArenasLoading, setIsArenasLoading] = useState(false);
  const [selectedArena, setSelectedArena] = useState(null);

  // ---- DATA ----
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inventory, setInventory] = useState({});
  const [distributionPlan, setDistributionPlan] = useState([]);

  // ---- COMPUTED STATE ----
  const [arenaState, setArenaState] = useState({});
  const [globalState, setGlobalState] = useState({});
  const [summaryStats, setSummaryStats] = useState({
    totalCheckedIn: 0,
    totalCheckedOut: 0,
    totalTransfers: 0,
    arenaOnHand: 0,
  });

  // ---- FORM STATE ----
  const [isSaving, setIsSaving] = useState(false);

  // ---- COMPUTE STATE FROM TRANSACTIONS ----

  const computeState = useCallback((allTxns, inv, arenaId, distPlan) => {
    // Per-arena state for selected arena
    const aState = {};
    // Global deployment across all shows
    const totalDeployed = {};

    for (const tx of allTxns) {
      const eqId = tx.equipment_id;

      if (tx.transaction_type === 'check_in') {
        // Global: track all check-ins
        if (!totalDeployed[eqId]) totalDeployed[eqId] = 0;
        totalDeployed[eqId] += tx.quantity;

        // Arena: only if this arena
        if (tx.arena_id === arenaId) {
          if (!aState[eqId]) aState[eqId] = { checkedIn: 0, checkedOut: 0, transferredIn: 0, transferredOut: 0 };
          aState[eqId].checkedIn += tx.quantity;
        }
      } else if (tx.transaction_type === 'check_out') {
        if (tx.arena_id === arenaId) {
          if (!aState[eqId]) aState[eqId] = { checkedIn: 0, checkedOut: 0, transferredIn: 0, transferredOut: 0 };
          aState[eqId].checkedOut += tx.quantity;
        }
      } else if (tx.transaction_type === 'transfer') {
        if (tx.from_arena_id === arenaId) {
          if (!aState[eqId]) aState[eqId] = { checkedIn: 0, checkedOut: 0, transferredIn: 0, transferredOut: 0 };
          aState[eqId].transferredOut += tx.quantity;
        }
        if (tx.to_arena_id === arenaId) {
          if (!aState[eqId]) aState[eqId] = { checkedIn: 0, checkedOut: 0, transferredIn: 0, transferredOut: 0 };
          aState[eqId].transferredIn += tx.quantity;
        }
      }
    }

    // Compute on-hand per equipment at arena
    for (const eqId of Object.keys(aState)) {
      const s = aState[eqId];
      s.onHand = s.checkedIn - s.checkedOut - s.transferredOut + s.transferredIn;
    }

    // Compute global state
    const gState = {};
    for (const [eqId, item] of Object.entries(inv)) {
      gState[eqId] = {
        totalOwned: item.total_qty_owned || 0,
        totalDeployed: totalDeployed[eqId] || 0,
        available: (item.total_qty_owned || 0) - (totalDeployed[eqId] || 0),
      };
    }

    // Compute summary stats for selected arena
    let totalIn = 0, totalOut = 0, totalXfer = 0, totalOnHand = 0;
    for (const tx of allTxns) {
      if (tx.transaction_type === 'check_in' && tx.arena_id === arenaId) totalIn += tx.quantity;
      if (tx.transaction_type === 'check_out' && tx.arena_id === arenaId) totalOut += tx.quantity;
      if (tx.transaction_type === 'transfer' && (tx.from_arena_id === arenaId || tx.to_arena_id === arenaId)) totalXfer += tx.quantity;
    }
    for (const s of Object.values(aState)) {
      totalOnHand += Math.max(0, s.onHand);
    }

    setArenaState(aState);
    setGlobalState(gState);
    setSummaryStats({
      totalCheckedIn: totalIn,
      totalCheckedOut: totalOut,
      totalTransfers: totalXfer,
      arenaOnHand: totalOnHand,
    });
  }, []);

  // ---- FETCH SHOWS ----

  const fetchUserShows = useCallback(async () => {
    if (!user) return;
    setIsShowsLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('id, project_name, project_data, status')
      .eq('user_id', user.id)
      .eq('project_type', 'show')
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching shows', description: error.message, variant: 'destructive' });
    } else {
      setShows(data || []);
    }
    setIsShowsLoading(false);
  }, [user, toast]);

  // ---- FETCH ARENAS FOR SHOW ----

  const fetchArenas = useCallback(async (showId) => {
    if (!user || !showId) return;
    setIsArenasLoading(true);
    setSelectedArena(null);
    setTransactions([]);
    setDistributionPlan([]);
    setArenaState({});
    setGlobalState({});

    const { data, error } = await supabase
      .from('arenas')
      .select('id, name, arena_type')
      .eq('show_id', showId)
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      toast({ title: 'Error fetching arenas', description: error.message, variant: 'destructive' });
    } else {
      setArenas(data || []);
    }
    setIsArenasLoading(false);
  }, [user, toast]);

  // ---- FETCH TRANSACTIONS + INVENTORY + DISTRIBUTION ----

  const fetchTransactions = useCallback(async (showId, arenaId) => {
    if (!user || !showId || !arenaId) return;
    setIsLoading(true);

    const [txResult, invResult, distResult] = await Promise.all([
      supabase
        .from('equipment_transactions')
        .select('*, equipment_items(id, name, category, unit_type, total_qty_owned), arenas!equipment_transactions_arena_id_fkey(id, name)')
        .eq('show_id', showId)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false }),
      supabase
        .from('equipment_items')
        .select('id, name, category, unit_type, total_qty_owned')
        .eq('user_id', user.id),
      supabase
        .from('distribution_plan')
        .select('*, equipment_items(id, name, category, unit_type, total_qty_owned)')
        .eq('show_id', showId)
        .eq('arena_id', arenaId)
        .eq('user_id', user.id),
    ]);

    if (txResult.error) {
      toast({ title: 'Error loading transactions', description: txResult.error.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const inv = {};
    (invResult.data || []).forEach(item => { inv[item.id] = item; });
    setInventory(inv);

    const txns = txResult.data || [];
    setTransactions(txns);

    const dist = distResult.data || [];
    setDistributionPlan(dist);

    computeState(txns, inv, arenaId, dist);
    setIsLoading(false);
  }, [user, toast, computeState]);

  // Every stock movement goes through one database function.
  //
  // The checks used to run here, against numbers already loaded in the page, and
  // the insert followed separately. Two people acting at the same moment both
  // passed and both wrote, so an arena could hand out more than it held — and
  // nothing told either of them. record_equipment_transaction() locks the item,
  // counts what is really there, and only then writes, so the second request is
  // measured against the first one's result.
  const runTransaction = useCallback(async (args, successMessage) => {
    const { data, error } = await supabase.rpc('record_equipment_transaction', args);

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return false;
    }
    if (!data?.ok) {
      // The function answers with the real figure, not the stale one.
      toast({ title: 'Validation error', description: data?.message || 'The stock check failed.', variant: 'destructive' });
      return false;
    }
    toast({ title: successMessage });
    return true;
  }, [toast]);

  // ---- CHECK IN ----

  const checkIn = useCallback(async ({ equipmentId, quantity, notes }) => {
    if (!user || !selectedShow || !selectedArena) return;

    setIsSaving(true);
    const ok = await runTransaction({
      p_show_id: selectedShow,
      p_equipment_id: equipmentId,
      p_type: 'check_in',
      p_quantity: quantity,
      p_arena_id: selectedArena,
      p_notes: notes || null,
    }, 'Equipment checked in.');
    if (ok) await fetchTransactions(selectedShow, selectedArena);
    setIsSaving(false);
  }, [user, selectedShow, selectedArena, runTransaction, fetchTransactions]);

  // ---- CHECK OUT ----

  const checkOut = useCallback(async ({ equipmentId, quantity, assignedTo, crewName, notes }) => {
    if (!user || !selectedShow || !selectedArena) return;

    setIsSaving(true);
    const ok = await runTransaction({
      p_show_id: selectedShow,
      p_equipment_id: equipmentId,
      p_type: 'check_out',
      p_quantity: quantity,
      p_arena_id: selectedArena,
      p_assigned_to: assignedTo || null,
      p_crew_name: crewName || null,
      p_notes: notes || null,
    }, 'Equipment checked out.');
    if (ok) await fetchTransactions(selectedShow, selectedArena);
    setIsSaving(false);
  }, [user, selectedShow, selectedArena, runTransaction, fetchTransactions]);

  // ---- TRANSFER ----

  const transfer = useCallback(async ({ equipmentId, quantity, toArenaId, notes }) => {
    if (!user || !selectedShow || !selectedArena) return;

    setIsSaving(true);
    const ok = await runTransaction({
      p_show_id: selectedShow,
      p_equipment_id: equipmentId,
      p_type: 'transfer',
      p_quantity: quantity,
      p_from_arena_id: selectedArena,
      p_to_arena_id: toArenaId,
      p_notes: notes || null,
    }, 'Equipment transferred.');
    if (ok) await fetchTransactions(selectedShow, selectedArena);
    setIsSaving(false);
  }, [user, selectedShow, selectedArena, runTransaction, fetchTransactions]);

  // ---- VOID TRANSACTION ----

  const voidTransaction = useCallback(async (id) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('equipment_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error voiding transaction', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Transaction voided.' });
      if (selectedShow && selectedArena) {
        await fetchTransactions(selectedShow, selectedArena);
      }
    }
    setIsSaving(false);
  }, [user, toast, selectedShow, selectedArena, fetchTransactions]);

  return {
    shows, isShowsLoading, selectedShow, setSelectedShow, fetchUserShows,
    arenas, isArenasLoading, selectedArena, setSelectedArena, fetchArenas,
    transactions, isLoading, inventory, distributionPlan,
    arenaState, globalState, summaryStats,
    checkIn, checkOut, transfer, voidTransaction,
    fetchTransactions,
    isSaving,
  };
};
