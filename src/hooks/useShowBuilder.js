import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { MODULE_STATUS, migrateLegacyStatus, migrateAllModuleStatuses, stampModuleStatusOnSave } from '@/lib/moduleStatusService';

// Auto-heal: keep divisionDates in sync with each division's Go 1 date.
// Older shows (and shows edited with the per-division date picker before the
// sync fix) can have a stale divisionDates while divisionGos.go1Date holds the
// newer, correct date. Consumers (Step 6 Organize Schedule, pattern book,
// scoresheets) read divisionDates, so we normalize it from go1Date on load.
// go1Date is the source of truth — it is never staler than divisionDates.
const syncDivisionDatesFromGos = (disciplines) => {
  if (!Array.isArray(disciplines)) return disciplines;
  return disciplines.map(disc => {
    const gos = disc?.divisionGos;
    if (!gos || typeof gos !== 'object') return disc;
    const newDivisionDates = { ...(disc.divisionDates || {}) };
    let changed = false;
    Object.keys(gos).forEach(divId => {
      const go1Date = gos[divId]?.go1Date;
      if (go1Date) {
        if (newDivisionDates[divId] !== go1Date) {
          newDivisionDates[divId] = go1Date;
          changed = true;
        }
      } else if (divId in newDivisionDates) {
        // Go 1 date was cleared — drop the stale divisionDates entry so the
        // division no longer appears on a day it was removed from.
        delete newDivisionDates[divId];
        changed = true;
      }
    });
    return changed ? { ...disc, divisionDates: newDivisionDates } : disc;
  });
};

const initialFormData = {
  showName: '',
  showNumber: null,
  showType: 'multi-day',
  associations: {},
  customAssociations: [],
  primaryAffiliates: [],
  subAssociationSelections: {},
  selected4HCity: '',
  nsbaApprovalType: '',
  nsbaCategory: '',
  nsbaDualApprovedWith: [],
  phbaHorseType: 'stock',
  pthaHorseType: 'stock',
  disciplines: [],
  customDisciplines: [],
  startDate: null,
  endDate: null,
  venueName: '',
  venueAddress: '',
  arenas: [],
  officials: [],
  staff: [],
  schedule: [],
  showBill: null,
  layoutSettings: null,
  showStatus: 'draft',
  isShowLocked: false,
  moduleStatuses: {},
  sponsorLevels: [
    { id: 'platinum', name: 'Platinum', amount: 5000, color: '#E5E4E2', benefits: 'Main arena banner, program cover logo, PA announcements, VIP passes' },
    { id: 'gold', name: 'Gold', amount: 2500, color: '#FFD700', benefits: 'Class sponsorship, program logo, banner placement' },
    { id: 'silver', name: 'Silver', amount: 1000, color: '#C0C0C0', benefits: 'Program listing, shared banner space' },
  ],
  sponsors: [],
};

export const useShowBuilder = (showId) => {
  const [formData, setFormData] = useState(initialFormData);
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [disciplineLibrary, setDisciplineLibrary] = useState([]);
  const [associationsData, setAssociationsData] = useState([]);
  const [divisionsData, setDivisionsData] = useState({});
  const [existingProjects, setExistingProjects] = useState([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const projectsQuery = user
        ? supabase.from('projects').select('id, project_name, project_type, project_data, status').eq('user_id', user.id).not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")').in('status', ['Draft', 'draft', 'In progress', 'in progress', 'Locked', 'locked', 'Final', 'final', 'published', 'Lock & Approve Mode', 'Publication']).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const [disciplinesRes, associationsRes, divisionsRes, projectsRes] = await Promise.all([
        supabase.from('disciplines').select('*').order('sort_order'),
        supabase.from('associations').select('*').order('position').order('name'),
        supabase.from('divisions').select('*, division_levels(*)').order('sort_order'),
        projectsQuery,
      ]);

      if (disciplinesRes.error) throw disciplinesRes.error;
      if (associationsRes.error) throw associationsRes.error;
      if (divisionsRes.error) throw divisionsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setExistingProjects(projectsRes.data || []);

      const formattedDisciplines = disciplinesRes.data.map(d => ({
        ...d,
        associations: d.association_id ? [{ association_id: d.association_id, sub_association_type: d.sub_association_type }] : []
      }));
      setDisciplineLibrary(formattedDisciplines);
      setAssociationsData(associationsRes.data);
      
      const divisionsByAssoc = (divisionsRes.data || []).reduce((acc, div) => {
          const key = div.association_id;
          
          if (!acc[key]) acc[key] = [];
          
          div.division_levels.sort((a, b) => a.sort_order - b.sort_order);
          
          acc[key].push({ 
              group: div.name, 
              levels: div.division_levels.map(l => l.name),
              sub_association_type: div.sub_association_type 
          });
          return acc;
      }, {});
      setDivisionsData(divisionsByAssoc);

      if (showId) {
        const { data: showData, error: showError } = await supabase
          .from('projects')
          .select('project_data')
          .eq('id', showId)
          .single();

        if (showError) throw showError;
        if (showData && showData.project_data) {
          // Migrate legacy statuses on load
          const migratedModuleStatuses = migrateAllModuleStatuses(showData.project_data.moduleStatuses);
          const migratedShowStatus = migrateLegacyStatus(showData.project_data.showStatus || 'draft');
          setFormData(prev => ({
            ...initialFormData,
            ...showData.project_data,
            disciplines: syncDivisionDatesFromGos(showData.project_data.disciplines ?? []),
            moduleStatuses: migratedModuleStatuses,
            showStatus: migratedShowStatus,
            id: showId,
          }));
          const savedStep = Math.min(showData.project_data.currentStep || 1, 8);
          const savedCompleted = showData.project_data.completedSteps || [];
          setStep(savedStep);
          setCompletedSteps(new Set(savedCompleted));
        }
      } else {
        setFormData(initialFormData);
        setStep(1);
        setCompletedSteps(new Set());
      }
    } catch (error) {
      toast({
        title: 'Error fetching data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showId, toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const resetDisciplines = () => {
    setFormData(prev => ({ ...prev, disciplines: [] }));
  };

  const refreshDisciplineLibrary = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('disciplines').select('*').order('sort_order');
      if (error) throw error;
      const formatted = data.map(d => ({
        ...d,
        associations: d.association_id ? [{ association_id: d.association_id, sub_association_type: d.sub_association_type }] : []
      }));
      setDisciplineLibrary(formatted);
    } catch (error) {
      toast({ title: 'Error refreshing disciplines', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  const createOrUpdateShow = useCallback(async (statusOverride, moduleKey, moduleStatus) => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to save a project.', variant: 'destructive' });
      return null;
    }

    // Block saves when show is globally locked (except for explicit unlock operations)
    if (formData.isShowLocked && statusOverride !== 'force_unlock') {
      toast({ title: 'Show Locked', description: 'Unlock the show to make changes.', variant: 'destructive' });
      return null;
    }

    // Validate: show name is required
    const trimmedName = (formData.showName || '').trim();
    if (!trimmedName) {
      toast({ title: 'Show Name Required', description: 'Please enter a show name before saving.', variant: 'destructive' });
      return null;
    }

    // Never use linkedProjectId as save target — it's a read-only reference to another project
    let currentShowId = showId || formData.id;

    // If no project ID yet, check if a show with this name already exists for this user
    // and reuse it instead of creating a duplicate
    if (!currentShowId && trimmedName) {
      const { data: existingShow } = await supabase
        .from('projects')
        .select('id')
        .eq('project_type', 'show')
        .eq('user_id', user.id)
        .ilike('project_name', trimmedName)
        .limit(1)
        .maybeSingle();

      if (existingShow) {
        currentShowId = existingShow.id;
        setFormData(prev => ({ ...prev, id: currentShowId }));
      }
    }

    // Mark current step as completed on save
    const updatedCompletedSteps = new Set(completedSteps);
    updatedCompletedSteps.add(step);
    setCompletedSteps(updatedCompletedSteps);

    // Auto-advance module status when moduleKey is provided.
    // Uses stampModuleStatusOnSave: NOT_STARTED→IN_PROGRESS→DRAFT (auto).
    // Explicit locked/published (e.g. from Step 8 "Save & Manage") is respected.
    let updatedModuleStatuses = formData.moduleStatuses || {};
    if (moduleKey) {
      if (moduleStatus && [MODULE_STATUS.LOCKED, MODULE_STATUS.PUBLISHED].includes(moduleStatus)) {
        updatedModuleStatuses = { ...updatedModuleStatuses, [moduleKey]: moduleStatus };
      } else {
        // Otherwise, auto-advance: NOT_STARTED→IN_PROGRESS, IN_PROGRESS→DRAFT
        const stamped = stampModuleStatusOnSave({ moduleStatuses: updatedModuleStatuses }, moduleKey);
        updatedModuleStatuses = stamped.moduleStatuses;
      }
    }

    // Resolve the top-level `status` column. The editWizard module is the main
    // show wizard, so when it is locked/published the show's overall status must
    // reflect that — otherwise the Horse Show Manager list (which reads the
    // top-level `status`) shows "draft" while the editor shows "Locked".
    const editWizardStatus = moduleKey === 'editWizard' ? updatedModuleStatuses.editWizard : null;
    const promotedStatus = (editWizardStatus === MODULE_STATUS.LOCKED || editWizardStatus === MODULE_STATUS.PUBLISHED)
      ? editWizardStatus
      : null;
    const effectiveStatus = statusOverride || promotedStatus || formData.showStatus || MODULE_STATUS.DRAFT;

    if (effectiveStatus !== formData.showStatus) {
      setFormData(prev => ({ ...prev, showStatus: effectiveStatus }));
    }

    const showDataToSave = {
      ...formData,
      showName: trimmedName,
      showStatus: effectiveStatus,
      moduleStatuses: updatedModuleStatuses,
      currentStep: step,
      completedSteps: Array.from(updatedCompletedSteps),
    };

    const showPayload = {
      project_name: trimmedName,
      project_type: 'show',
      project_data: showDataToSave,
      status: effectiveStatus,
      user_id: user.id,
    };

    if (currentShowId) {
      const { data, error } = await supabase
        .from('projects')
        .update(showPayload)
        .eq('id', currentShowId)
        .select('id')
        .single();

      if (error) {
        toast({ title: 'Error saving show', description: error.message, variant: 'destructive' });
        return null;
      }
      // Silent save — no popup during normal editing
      return data;
    } else {
      // Preserve a user-entered show number; only auto-generate a sequential
      // one when the field was left blank.
      let showNumber = formData.showNumber != null && String(formData.showNumber).trim() !== ''
        ? formData.showNumber
        : null;
      if (!showNumber) {
        const { count } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('project_type', 'show');
        showNumber = (count || 0) + 1;
      }

      const newId = uuidv4();
      const payloadWithNumber = {
        ...showPayload,
        id: newId,
        project_data: { ...showPayload.project_data, showNumber },
      };
      const { data, error } = await supabase
        .from('projects')
        .insert([payloadWithNumber])
        .select('id')
        .single();

      if (error) {
        toast({ title: 'Error creating show', description: error.message, variant: 'destructive' });
        return null;
      }

      const newShowId = data.id;
      setFormData(prev => ({ ...prev, id: newShowId, showNumber }));
      return data;
    }
  }, [formData, step, completedSteps, showId, toast, user]);

  const nextStep = () => setStep(prev => Math.min(prev + 1, 8));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));
  const setCurrentStep = (newStep) => setStep(newStep);

  return {
    step,
    setCurrentStep,
    nextStep,
    prevStep,
    formData,
    setFormData,
    completedSteps,
    setCompletedSteps,
    createOrUpdateShow,
    isLoading,
    disciplineLibrary,
    associationsData,
    divisionsData,
    resetDisciplines,
    refreshDisciplineLibrary,
    existingProjects,
  };
};