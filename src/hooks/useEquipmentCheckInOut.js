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

  // ---- CHECK IN ----

  const checkIn = useCallback(async ({ equipmentId, quantity, notes }) => {
    if (!user || !selectedShow || !selectedArena) return;

    // Validate
    const available = globalState[equipmentId]?.available ?? 0;
    if (quantity > available) {
      toast({ title: 'Validation error', description: `Only ${available} available in warehouse.`, variant: 'destructive' });
      return;
    }
    if (quantity <= 0) {
      toast({ title: 'Validation error', description: 'Quantity must be greater than zero.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('equipment_transactions').insert({
      user_id: user.id,
      show_id: selectedShow,
      equipment_id: equipmentId,
      transaction_type: 'check_in',
      quantity,
      arena_id: selectedArena,
      notes: notes || null,
    });

    if (error) {
      toast({ title: 'Check-in failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Equipment checked in.' });
      await fetchTransactions(selectedShow, selectedArena);
    }
    setIsSaving(false);
  }, [user, toast, selectedShow, selectedArena, globalState, fetchTransactions]);

  // ---- CHECK OUT ----

  const checkOut = useCallback(async ({ equipmentId, quantity, assignedTo, crewName, notes }) => {
    if (!user || !selectedShow || !selectedArena) return;

    const onHand = arenaState[equipmentId]?.onHand ?? 0;
    if (quantity > onHand) {
      toast({ title: 'Validation error', description: `Only ${onHand} on hand at this arena.`, variant: 'destructive' });
      return;
    }
    if (quantity <= 0) {
      toast({ title: 'Validation error', description: 'Quantity must be greater than zero.', variant: 'destructive' });
      return;
    }
    if (!assignedTo && !crewName) {
      toast({ title: 'Validation error', description: 'Please specify who this is assigned to.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('equipment_transactions').insert({
      user_id: user.id,
      show_id: selectedShow,
      equipment_id: equipmentId,
      transaction_type: 'check_out',
      quantity,
      arena_id: selectedArena,
      assigned_to: assignedTo || null,
      crew_name: crewName || null,
      notes: notes || null,
    });

    if (error) {
      toast({ title: 'Check-out failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Equipment checked out.' });
      await fetchTransactions(selectedShow, selectedArena);
    }
    setIsSaving(false);
  }, [user, toast, selectedShow, selectedArena, arenaState, fetchTransactions]);

  // ---- TRANSFER ----

  const transfer = useCallback(async ({ equipmentId, quantity, toArenaId, notes }) => {
    if (!user || !selectedShow || !selectedArena) return;

    if (toArenaId === selectedArena) {
      toast({ title: 'Validation error', description: 'Cannot transfer to the same arena.', variant: 'destructive' });
      return;
    }
    const onHand = arenaState[equipmentId]?.onHand ?? 0;
    if (quantity > onHand) {
      toast({ title: 'Validation error', description: `Only ${onHand} on hand at this arena.`, variant: 'destructive' });
      return;
    }
    if (quantity <= 0) {
      toast({ title: 'Validation error', description: 'Quantity must be greater than zero.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('equipment_transactions').insert({
      user_id: user.id,
      show_id: selectedShow,
      equipment_id: equipmentId,
      transaction_type: 'transfer',
      quantity,
      arena_id: null,
      from_arena_id: selectedArena,
      to_arena_id: toArenaId,
      notes: notes || null,
    });

    if (error) {
      toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Equipment transferred.' });
      await fetchTransactions(selectedShow, selectedArena);
    }
    setIsSaving(false);
  }, [user, toast, selectedShow, selectedArena, arenaState, fetchTransactions]);

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
