import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { mergeClassEquipment, calculateFullShowRequirements } from '@/lib/equipmentCalculator';

export const useEquipmentRequirements = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [shows, setShows] = useState([]);
  const [isShowsLoading, setIsShowsLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState(null);
  const [missingDataMessage, setMissingDataMessage] = useState(null);

  const [sessionResults, setSessionResults] = useState([]);
  const [dayResults, setDayResults] = useState([]);
  const [showResults, setShowResults] = useState(null);
  const [summaryStats, setSummaryStats] = useState({
    totalEquipmentTypes: 0,
    totalSessionsCalculated: 0,
    totalShowDays: 0,
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

  const getShowDates = (show) => {
    if (!show?.project_data) return [];
    const { startDate, endDate } = show.project_data;
    if (!startDate || !endDate) return [];
    const dates = [];
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // ---- PERSIST RESULTS ----

  const persistResults = useCallback(async (showId, sResults, dResults, sShowResults) => {
    if (!user) return;

    // Delete old results for this show
    const { error: delError } = await supabase
      .from('equipment_requirements')
      .delete()
      .eq('show_id', showId)
      .eq('user_id', user.id);

    if (delError) {
      toast({ title: 'Error clearing old results', description: delError.message, variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    const rows = [];

    // Session-level rows
    for (const sr of sResults) {
      for (const [eqId, data] of Object.entries(sr.requirements)) {
        rows.push({
          user_id: user.id,
          show_id: showId,
          arena_session_id: sr.sessionId,
          equipment_id: eqId,
          required_qty: data.qty,
          shortage_qty: 0,
          aggregation_level: 'session',
          aggregation_date: null,
          calculation_details: {
            mode: sr.mode,
            arena_name: sr.arenaName,
            session_name: sr.sessionName,
            breakdown: sr.details.filter(d => d.equipment_id === eqId),
          },
          calculated_at: now,
        });
      }
    }

    // Day-level rows
    for (const dr of dResults) {
      for (const [eqId, data] of Object.entries(dr.requirements)) {
        rows.push({
          user_id: user.id,
          show_id: showId,
          arena_session_id: null,
          equipment_id: eqId,
          required_qty: data.qty,
          shortage_qty: 0,
          aggregation_level: 'day',
          aggregation_date: dr.date,
          calculation_details: { arena_breakdown: dr.arenaBreakdown?.[eqId] || {} },
          calculated_at: now,
        });
      }
    }

    // Show-level rows
    if (sShowResults) {
      for (const [eqId, peak] of Object.entries(sShowResults.peakRequirements)) {
        const shortage = sShowResults.shortages.find(s => s.equipment_id === eqId);
        rows.push({
          user_id: user.id,
          show_id: showId,
          arena_session_id: null,
          equipment_id: eqId,
          required_qty: peak.qty,
          shortage_qty: shortage ? shortage.shortage : 0,
          aggregation_level: 'show',
          aggregation_date: null,
          calculation_details: { peak_day: peak.peak_day },
          calculated_at: now,
        });
      }
    }

    if (rows.length > 0) {
      // Batch insert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error: insError } = await supabase.from('equipment_requirements').insert(chunk);
        if (insError) {
          toast({ title: 'Error saving results', description: insError.message, variant: 'destructive' });
          return;
        }
      }
    }
  }, [user, toast]);

  // ---- MAIN CALCULATION ----

  const calculateRequirements = useCallback(async (showId) => {
    if (!user || !showId) return;
    setIsCalculating(true);
    setMissingDataMessage(null);

    try {
      // 1. Fetch arenas for this show
      const { data: arenas, error: arenaErr } = await supabase
        .from('arenas')
        .select('id, name, arena_type')
        .eq('show_id', showId)
        .eq('user_id', user.id);

      if (arenaErr) throw new Error('Failed to fetch arenas: ' + arenaErr.message);
      if (!arenas || arenas.length === 0) {
        setMissingDataMessage({ step: 'arenas', text: 'No arenas found for this show. Add arenas in Arena Sessions first.' });
        setIsCalculating(false);
        return;
      }

      const arenaIds = arenas.map(a => a.id);
      const arenaMap = {};
      arenas.forEach(a => { arenaMap[a.id] = a.name; });

      // 2. Fetch all sessions for those arenas
      const { data: sessions, error: sessErr } = await supabase
        .from('arena_sessions')
        .select('id, arena_id, session_name, date, calculation_mode')
        .in('arena_id', arenaIds)
        .order('date')
        .order('session_name');

      if (sessErr) throw new Error('Failed to fetch sessions: ' + sessErr.message);
      if (!sessions || sessions.length === 0) {
        setMissingDataMessage({ step: 'sessions', text: 'No sessions found. Add sessions to your arenas in Arena Sessions first.' });
        setIsCalculating(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // 3. Fetch all session classes with class_templates join
      const { data: sessionClasses, error: scErr } = await supabase
        .from('arena_session_classes')
        .select('id, arena_session_id, class_template_id, quantity, reset_between, class_templates(id, name, discipline_id)')
        .in('arena_session_id', sessionIds);

      if (scErr) throw new Error('Failed to fetch session classes: ' + scErr.message);

      if (!sessionClasses || sessionClasses.length === 0) {
        setMissingDataMessage({ step: 'classes', text: 'No class templates assigned to sessions yet. Assign class templates in Arena Sessions first.' });
        setIsCalculating(false);
        return;
      }

      // Collect unique IDs
      const templateIds = [...new Set(sessionClasses.map(sc => sc.class_template_id).filter(Boolean))];
      const disciplineIds = [...new Set(sessionClasses.map(sc => sc.class_templates?.discipline_id).filter(Boolean))];

      // 4. Parallel fetches: discipline names, discipline equipment, template equipment, inventory
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

      // Build lookup maps
      const disciplineNameMap = {};
      (discResult.data || []).forEach(d => { disciplineNameMap[d.id] = d.name; });

      // Group discipline equipment by discipline_id
      const discEquipByDisc = {};
      (discEquipResult.data || []).forEach(row => {
        if (!discEquipByDisc[row.discipline_id]) discEquipByDisc[row.discipline_id] = [];
        discEquipByDisc[row.discipline_id].push(row);
      });

      // Group template equipment by class_template_id
      const tmplEquipByTmpl = {};
      (tmplEquipResult.data || []).forEach(row => {
        if (!tmplEquipByTmpl[row.class_template_id]) tmplEquipByTmpl[row.class_template_id] = [];
        tmplEquipByTmpl[row.class_template_id].push(row);
      });

      // Build inventory map
      const inventory = {};
      (inventoryResult.data || []).forEach(item => {
        inventory[item.id] = item;
      });

      // 5. Assemble session data for the calculator
      // Group session classes by session_id
      const scBySession = {};
      sessionClasses.forEach(sc => {
        if (!scBySession[sc.arena_session_id]) scBySession[sc.arena_session_id] = [];
        scBySession[sc.arena_session_id].push(sc);
      });

      const assembledSessions = sessions.map(session => {
        const classes = (scBySession[session.id] || []).map(sc => {
          const disciplineId = sc.class_templates?.discipline_id;
          const discEquipRows = discEquipByDisc[disciplineId] || [];
          const tmplEquipRows = tmplEquipByTmpl[sc.class_template_id] || [];
          const merged = mergeClassEquipment(discEquipRows, tmplEquipRows);

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
          arena_name: arenaMap[session.arena_id] || 'Unknown',
          date: session.date,
          calculation_mode: session.calculation_mode,
          classes,
        };
      });

      // 6. Run the calculation
      const results = calculateFullShowRequirements(assembledSessions, inventory);

      // 7. Update state
      setSessionResults(results.sessionResults);
      setDayResults(results.dayResults);
      setShowResults(results.showResults);
      setLastCalculatedAt(new Date().toISOString());

      // Compute summary stats
      const allEquipIds = new Set();
      for (const sr of results.sessionResults) {
        Object.keys(sr.requirements).forEach(id => allEquipIds.add(id));
      }
      setSummaryStats({
        totalEquipmentTypes: allEquipIds.size,
        totalSessionsCalculated: results.sessionResults.length,
        totalShowDays: results.dayResults.length,
        shortageCount: results.showResults.shortages.length,
      });

      // 8. Persist to DB
      await persistResults(showId, results.sessionResults, results.dayResults, results.showResults);

      toast({ title: 'Calculation complete!' });
    } catch (err) {
      toast({ title: 'Calculation failed', description: err.message, variant: 'destructive' });
    }

    setIsCalculating(false);
  }, [user, toast, persistResults]);

  return {
    shows, isShowsLoading, selectedShow, setSelectedShow, fetchUserShows, getShowDates,
    isCalculating, lastCalculatedAt, missingDataMessage,
    sessionResults, dayResults, showResults, summaryStats,
    calculateRequirements,
  };
};
