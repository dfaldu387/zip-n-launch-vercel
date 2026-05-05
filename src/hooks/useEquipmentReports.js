import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  generateArenaKitListPdf,
  generateDailyEquipmentSummaryPdf,
  generateShortageReportPdf,
  generateDistributionByLocationPdf,
} from '@/lib/equipmentReportGenerators';

export const useEquipmentReports = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Shows
  const [shows, setShows] = useState([]);
  const [isShowsLoading, setIsShowsLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState(null);

  // Report data
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      setShows((data || []).map(p => ({
        id: p.id,
        name: p.project_data?.showName || p.project_data?.name || 'Unnamed Show',
      })));
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
    setReportData(null);
    if (!show || !user) return;
    await fetchReportData(show.id);
  }, [user]);

  const fetchReportData = useCallback(async (showId) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [eqRes, distRes, txnRes, arenaRes] = await Promise.all([
        supabase.from('equipment_items').select('*').eq('user_id', user.id),
        supabase.from('distribution_plan').select('*').eq('show_id', showId).eq('user_id', user.id),
        supabase.from('equipment_transactions').select('*').eq('show_id', showId).eq('user_id', user.id),
        supabase.from('arenas').select('*').eq('show_id', showId),
      ]);

      if (eqRes.error) throw eqRes.error;
      if (distRes.error) throw distRes.error;
      if (txnRes.error) throw txnRes.error;
      if (arenaRes.error) throw arenaRes.error;

      const equipment = eqRes.data || [];
      const distribution = distRes.data || [];
      const transactions = txnRes.data || [];
      const arenas = arenaRes.data || [];

      // Build equipment lookup
      const eqMap = {};
      for (const eq of equipment) {
        eqMap[eq.id] = eq;
      }

      // Build transaction totals
      const txnTotals = {};
      for (const tx of transactions) {
        if (!txnTotals[tx.equipment_id]) txnTotals[tx.equipment_id] = { checkedIn: 0, checkedOut: 0 };
        if (tx.transaction_type === 'check_in') txnTotals[tx.equipment_id].checkedIn += tx.quantity;
        else if (tx.transaction_type === 'check_out') txnTotals[tx.equipment_id].checkedOut += tx.quantity;
      }

      // Build planned totals per equipment
      const plannedTotals = {};
      for (const d of distribution) {
        plannedTotals[d.equipment_id] = (plannedTotals[d.equipment_id] || 0) + d.planned_qty;
      }

      // ---- Daily Summary data ----
      const dailySummaryItems = equipment.map(eq => ({
        name: eq.name,
        category: eq.category,
        unit_type: eq.unit_type,
        total_qty_owned: eq.total_qty_owned,
        planned: plannedTotals[eq.id] || 0,
        checkedIn: txnTotals[eq.id]?.checkedIn || 0,
        checkedOut: txnTotals[eq.id]?.checkedOut || 0,
        available: eq.total_qty_owned - (txnTotals[eq.id]?.checkedOut || 0),
      })).filter(i => i.planned > 0 || i.checkedIn > 0 || i.checkedOut > 0);

      // ---- Shortages data ----
      const shortages = [];
      for (const [eqId, required] of Object.entries(plannedTotals)) {
        const eq = eqMap[eqId];
        if (!eq) continue;
        if (required > eq.total_qty_owned) {
          shortages.push({
            name: eq.name,
            category: eq.category,
            required,
            owned: eq.total_qty_owned,
            shortage: required - eq.total_qty_owned,
          });
        }
      }
      shortages.sort((a, b) => b.shortage - a.shortage);

      // ---- Distribution by Location data ----
      const arenaMap = {};
      for (const a of arenas) arenaMap[a.id] = a;

      const distByArena = {};
      for (const d of distribution) {
        const arenaId = d.arena_id;
        if (!distByArena[arenaId]) distByArena[arenaId] = [];
        const eq = eqMap[d.equipment_id];
        if (eq) {
          distByArena[arenaId].push({
            name: eq.name,
            category: eq.category,
            planned_qty: d.planned_qty,
            unit_type: eq.unit_type,
          });
        }
      }

      const arenaDistribution = arenas.map(a => ({
        name: a.name,
        type: a.arena_type || '',
        items: (distByArena[a.id] || []).sort((x, y) => x.name.localeCompare(y.name)),
      })).filter(a => a.items.length > 0);

      setReportData({
        dailySummaryItems,
        shortages,
        arenaDistribution,
        arenas,
        equipment,
        distribution,
        counts: {
          dailyItems: dailySummaryItems.length,
          shortageCount: shortages.length,
          arenaCount: arenaDistribution.length,
          totalDistributed: distribution.reduce((s, d) => s + d.planned_qty, 0),
        },
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({ title: 'Error', description: 'Failed to load report data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // ---- GENERATE REPORTS ----

  const generateReport = useCallback((reportType) => {
    if (!reportData || !selectedShow) return;
    setIsGenerating(true);
    try {
      switch (reportType) {
        case 'daily-summary':
          generateDailyEquipmentSummaryPdf({
            showName: selectedShow.name,
            items: reportData.dailySummaryItems,
          });
          break;
        case 'shortage':
          generateShortageReportPdf({
            showName: selectedShow.name,
            shortages: reportData.shortages,
          });
          break;
        case 'distribution-by-location':
          generateDistributionByLocationPdf({
            showName: selectedShow.name,
            arenas: reportData.arenaDistribution,
          });
          break;
        case 'arena-kit-list':
          // Generate kit lists for all arenas
          for (const arena of reportData.arenaDistribution) {
            generateArenaKitListPdf({
              showName: selectedShow.name,
              arenaName: arena.name,
              arenaType: arena.type,
              items: arena.items.map(i => ({
                name: i.name,
                category: i.category,
                unit_type: i.unit_type,
                planned_qty: i.planned_qty,
              })),
            });
          }
          break;
        default:
          break;
      }
      toast({ title: 'Report Generated', description: 'PDF has been downloaded.' });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ title: 'Error', description: 'Failed to generate report.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  }, [reportData, selectedShow, toast]);

  return {
    shows,
    isShowsLoading,
    selectedShow,
    reportData,
    isLoading,
    isGenerating,
    fetchUserShows,
    selectShow,
    generateReport,
  };
};
