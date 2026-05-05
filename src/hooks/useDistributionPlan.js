import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { mergeClassEquipment, calculateFullShowRequirements } from '@/lib/equipmentCalculator';

export const useDistributionPlan = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [shows, setShows] = useState([]);
  const [isShowsLoading, setIsShowsLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  const [distributionItems, setDistributionItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);
  const [missingDataMessage, setMissingDataMessage] = useState(null);

  const [inventory, setInventory] = useState({});
  const [summaryStats, setSummaryStats] = useState({
    totalEquipmentTypes: 0,
    totalItemsDistributed: 0,
    arenasCount: 0,
    shortageCount: 0,
  });

  // ---- SHOWS ----

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

  // ---- FETCH EXISTING PLAN ----

  const computeStats = useCallback((items, inv) => {
    const eqIds = new Set(items.map(i => i.equipment_id));
    const arenaIds = new Set(items.map(i => i.arena_id));
    const totalQty = items.reduce((sum, i) => sum + (i.planned_qty || 0), 0);
    let shortageCount = 0;
    for (const eqId of eqIds) {
      const totalPlanned = items.filter(i => i.equipment_id === eqId).reduce((s, i) => s + (i.planned_qty || 0), 0);
      const owned = inv[eqId]?.total_qty_owned ?? 0;
      if (totalPlanned > owned) shortageCount++;
    }
    setSummaryStats({
      totalEquipmentTypes: eqIds.size,
      totalItemsDistributed: totalQty,
      arenasCount: arenaIds.size,
      shortageCount,
    });
  }, []);

  const fetchDistributionPlan = useCallback(async (showId) => {
    if (!user || !showId) return;
    setIsLoading(true);

    const [distResult, invResult] = await Promise.all([
      supabase
        .from('distribution_plan')
        .select('*, equipment_items(id, name, category, unit_type, total_qty_owned), arenas(id, name), disciplines(id, name)')
        .eq('show_id', showId)
        .eq('user_id', user.id)
        .order('arena_id')
        .order('equipment_id'),
      supabase
        .from('equipment_items')
        .select('id, name, category, unit_type, total_qty_owned')
        .eq('user_id', user.id),
    ]);

    if (distResult.error) {
      toast({ title: 'Error loading plan', description: distResult.error.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const inv = {};
    (invResult.data || []).forEach(item => { inv[item.id] = item; });
    setInventory(inv);

    const items = distResult.data || [];
    setDistributionItems(items);
    computeStats(items, inv);

    if (items.length > 0) {
      setLastGeneratedAt(items[0]?.created_at || null);
    }

    setIsLoading(false);
  }, [user, toast, computeStats]);

  // ---- GENERATE PLAN ----

  const generateDistributionPlan = useCallback(async (showId) => {
    if (!user || !showId) return;
    setIsGenerating(true);
    setMissingDataMessage(null);

    try {
      // 1. Fetch arenas
      const { data: arenas, error: arenaErr } = await supabase
        .from('arenas')
        .select('id, name, arena_type')
        .eq('show_id', showId)
        .eq('user_id', user.id);

      if (arenaErr) throw new Error('Failed to fetch arenas: ' + arenaErr.message);
      if (!arenas || arenas.length === 0) {
        setMissingDataMessage({ text: 'No arenas found for this show. Add arenas in Arena Sessions first.' });
        setIsGenerating(false);
        return;
      }

      const arenaIds = arenas.map(a => a.id);
      const arenaNameMap = {};
      arenas.forEach(a => { arenaNameMap[a.id] = a.name; });

      // 2. Fetch sessions
      const { data: sessions, error: sessErr } = await supabase
        .from('arena_sessions')
        .select('id, arena_id, session_name, date, calculation_mode')
        .in('arena_id', arenaIds)
        .order('date')
        .order('session_name');

      if (sessErr) throw new Error('Failed to fetch sessions: ' + sessErr.message);
      if (!sessions || sessions.length === 0) {
        setMissingDataMessage({ text: 'No sessions found. Add sessions to your arenas in Arena Sessions first.' });
        setIsGenerating(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // 3. Fetch session classes
      const { data: sessionClasses, error: scErr } = await supabase
        .from('arena_session_classes')
        .select('id, arena_session_id, class_template_id, quantity, reset_between, class_templates(id, name, discipline_id)')
        .in('arena_session_id', sessionIds);

      if (scErr) throw new Error('Failed to fetch session classes: ' + scErr.message);
      if (!sessionClasses || sessionClasses.length === 0) {
        setMissingDataMessage({ text: 'No class templates assigned to sessions yet. Assign class templates in Arena Sessions first.' });
        setIsGenerating(false);
        return;
      }

      const templateIds = [...new Set(sessionClasses.map(sc => sc.class_template_id).filter(Boolean))];
      const disciplineIds = [...new Set(sessionClasses.map(sc => sc.class_templates?.discipline_id).filter(Boolean))];

      // 4. Parallel fetches
      const [discResult, discEquipResult, tmplEquipResult, inventoryResult] = await Promise.all([
        supabase.from('disciplines').select('id, name').in('id', disciplineIds),
        supabase.from('discipline_equipment')
          .select('discipline_id, equipment_id, quantity, is_optional, equipment_items(id, name, category, unit_type)')
          .eq('user_id', user.id)
          .in('discipline_id', disciplineIds),
        supabase.from('class_template_equipment')
          .select('class_template_id, equipment_id, quantity, equipment_items(id, name, category, unit_type)')
          .in('class_template_id', templateIds),
        supabase.from('equipment_items')
          .select('id, name, category, unit_type, total_qty_owned')
          .eq('user_id', user.id),
      ]);

      if (discResult.error) throw new Error('Failed to fetch disciplines: ' + discResult.error.message);
      if (discEquipResult.error) throw new Error('Failed to fetch discipline equipment: ' + discEquipResult.error.message);
      if (tmplEquipResult.error) throw new Error('Failed to fetch template equipment: ' + tmplEquipResult.error.message);
      if (inventoryResult.error) throw new Error('Failed to fetch inventory: ' + inventoryResult.error.message);

      const disciplineNameMap = {};
      (discResult.data || []).forEach(d => { disciplineNameMap[d.id] = d.name; });

      const discEquipByDisc = {};
      (discEquipResult.data || []).forEach(row => {
        if (!discEquipByDisc[row.discipline_id]) discEquipByDisc[row.discipline_id] = [];
        discEquipByDisc[row.discipline_id].push(row);
      });

      const tmplEquipByTmpl = {};
      (tmplEquipResult.data || []).forEach(row => {
        if (!tmplEquipByTmpl[row.class_template_id]) tmplEquipByTmpl[row.class_template_id] = [];
        tmplEquipByTmpl[row.class_template_id].push(row);
      });

      const inv = {};
      (inventoryResult.data || []).forEach(item => { inv[item.id] = item; });

      // 5. Assemble sessions for calculator
      const scBySession = {};
      sessionClasses.forEach(sc => {
        if (!scBySession[sc.arena_session_id]) scBySession[sc.arena_session_id] = [];
        scBySession[sc.arena_session_id].push(sc);
      });

      // Track equipment → discipline per arena for discipline_id assignment
      const equipDisciplineByArena = {}; // { `${arenaId}_${eqId}`: Set<disciplineId> }

      const assembledSessions = sessions.map(session => {
        const classes = (scBySession[session.id] || []).map(sc => {
          const disciplineId = sc.class_templates?.discipline_id;
          const discEquipRows = discEquipByDisc[disciplineId] || [];
          const tmplEquipRows = tmplEquipByTmpl[sc.class_template_id] || [];
          const merged = mergeClassEquipment(discEquipRows, tmplEquipRows);

          // Track discipline per (arena, equipment)
          for (const eqId of Object.keys(merged)) {
            const key = `${session.arena_id}_${eqId}`;
            if (!equipDisciplineByArena[key]) equipDisciplineByArena[key] = new Set();
            if (disciplineId) equipDisciplineByArena[key].add(disciplineId);
          }

          return {
            class_template_id: sc.class_template_id,
            class_template_name: sc.class_templates?.name || 'Unknown',
            discipline_name: disciplineNameMap[disciplineId] || 'Unknown',
            quantity: sc.quantity || 1,
            reset_between: sc.reset_between || false,
            equipment: merged,
          };
        });

        return {
          id: session.id,
          session_name: session.session_name,
          arena_id: session.arena_id,
          arena_name: arenaNameMap[session.arena_id] || 'Unknown',
          date: session.date,
          calculation_mode: session.calculation_mode,
          classes,
        };
      });

      // 6. Run calculator
      const results = calculateFullShowRequirements(assembledSessions, inv);

      // 7. Extract per-arena peak quantities from dayResults
      const arenaEquipmentPeaks = {}; // { arena_id: { equipment_id: qty } }

      for (const dayResult of results.dayResults) {
        for (const [eqId, arenaInfo] of Object.entries(dayResult.arenaBreakdown || {})) {
          for (const [arenaId, arenaData] of Object.entries(arenaInfo)) {
            if (!arenaEquipmentPeaks[arenaId]) arenaEquipmentPeaks[arenaId] = {};
            if (!arenaEquipmentPeaks[arenaId][eqId]) {
              arenaEquipmentPeaks[arenaId][eqId] = 0;
            }
            arenaEquipmentPeaks[arenaId][eqId] = Math.max(
              arenaEquipmentPeaks[arenaId][eqId],
              arenaData.qty
            );
          }
        }
      }

      // 8. Build distribution rows
      const rows = [];
      for (const [arenaId, equipMap] of Object.entries(arenaEquipmentPeaks)) {
        for (const [eqId, qty] of Object.entries(equipMap)) {
          if (qty <= 0) continue;
          const key = `${arenaId}_${eqId}`;
          const discSet = equipDisciplineByArena[key];
          const disciplineId = discSet && discSet.size === 1 ? [...discSet][0] : null;

          rows.push({
            user_id: user.id,
            show_id: showId,
            arena_id: arenaId,
            equipment_id: eqId,
            planned_qty: qty,
            date: null,
            discipline_id: disciplineId,
            notes: null,
          });
        }
      }

      // 9. Delete old, insert new
      const { error: delError } = await supabase
        .from('distribution_plan')
        .delete()
        .eq('show_id', showId)
        .eq('user_id', user.id);

      if (delError) throw new Error('Failed to clear old plan: ' + delError.message);

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error: insError } = await supabase.from('distribution_plan').insert(chunk);
          if (insError) throw new Error('Failed to save plan: ' + insError.message);
        }
      }

      setInventory(inv);
      toast({ title: 'Distribution plan generated!' });
      setLastGeneratedAt(new Date().toISOString());

      // 10. Reload the plan
      await fetchDistributionPlan(showId);
    } catch (err) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    }

    setIsGenerating(false);
  }, [user, toast, fetchDistributionPlan]);

  // ---- UPDATE / DELETE ----

  const updatePlannedQty = useCallback(async (id, qty) => {
    if (!user) return;
    const { error } = await supabase
      .from('distribution_plan')
      .update({ planned_qty: qty })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error updating quantity', description: error.message, variant: 'destructive' });
    } else {
      setDistributionItems(prev => {
        const updated = prev.map(item => item.id === id ? { ...item, planned_qty: qty } : item);
        computeStats(updated, inventory);
        return updated;
      });
    }
  }, [user, toast, inventory, computeStats]);

  const deleteDistributionItem = useCallback(async (id) => {
    if (!user) return;
    const { error } = await supabase
      .from('distribution_plan')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error deleting item', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Item removed from plan.' });
      setDistributionItems(prev => {
        const updated = prev.filter(item => item.id !== id);
        computeStats(updated, inventory);
        return updated;
      });
    }
  }, [user, toast, inventory, computeStats]);

  return {
    shows, isShowsLoading, selectedShow, setSelectedShow, fetchUserShows,
    distributionItems, isLoading,
    isGenerating, lastGeneratedAt, missingDataMessage,
    inventory, summaryStats,
    fetchDistributionPlan, generateDistributionPlan,
    updatePlannedQty, deleteDistributionItem,
  };
};
