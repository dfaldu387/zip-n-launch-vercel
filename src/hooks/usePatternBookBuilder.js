import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const initialFormData = {
  showName: '',
  showNumber: '',
  showType: 'multi-day',
  associations: {},
  customAssociations: [],
  primaryAffiliates: [],
  subAssociationSelections: {},
  nsbaApprovalType: '',
  nsbaCategory: '',
  nsbaDualApprovedWith: [],
  phbaHorseType: 'stock',
  pthaHorseType: 'stock',
  disciplines: [],
  startDate: null,
  endDate: null,
  venueName: '',
  venueAddress: '',
  officials: [],
  associationJudges: {},
  showDetails: {
    officials: {},
    judges: {},
    judgeCount: {},
  },
  staff: [],
  schedule: [],
  groupDueDates: {},
  groupStaff: {},
  groupJudges: {},
  patternSelections: {},
  disciplinePatterns: {},
  judgeSelections: [],
  dueDateSelections: [],
  disciplineDueDates: {},
  lockedSections: { step1: false, structure: false },
  showClassNumbers: false,
};

// Migration function: Convert old Prelims/Finals format to new Go 1/Go 2 format
const migrateToGoFormat = (projectData) => {
  if (!projectData || !projectData.disciplines) return projectData;

  const migratedDisciplines = projectData.disciplines.map(discipline => {
    // Skip if already migrated (has divisionGos)
    if (discipline.divisionGos && Object.keys(discipline.divisionGos).length > 0) {
      return discipline;
    }

    const divisionPrelimsDates = discipline.divisionPrelimsDates || {};
    const divisionFinalsDates = discipline.divisionFinalsDates || {};

    // If no old date fields, nothing to migrate
    if (Object.keys(divisionPrelimsDates).length === 0 && Object.keys(divisionFinalsDates).length === 0) {
      return { ...discipline, divisionGos: {} };
    }

    const divisionGos = {};

    // Divisions with Finals date = two-go class
    Object.keys(divisionFinalsDates).forEach(divId => {
      divisionGos[divId] = {
        hasGo2: true,
        go1Date: divisionPrelimsDates[divId] || null,
        go2Date: divisionFinalsDates[divId]
      };
    });

    // Divisions with only Prelims date = single-go class with date
    Object.keys(divisionPrelimsDates).forEach(divId => {
      if (!divisionGos[divId]) {
        divisionGos[divId] = {
          hasGo2: false,
          go1Date: divisionPrelimsDates[divId],
          go2Date: null
        };
      }
    });

    return {
      ...discipline,
      divisionGos,
      // Keep old fields for reference but they're now deprecated
      _migrated_divisionPrelimsDates: divisionPrelimsDates,
      _migrated_divisionFinalsDates: divisionFinalsDates
    };
  });

  return { ...projectData, disciplines: migratedDisciplines };
};

export const usePatternBookBuilder = (projectId) => {
  // Sanitize projectId - treat "undefined" string as null
  const sanitizedProjectId = projectId && projectId !== 'undefined' ? projectId : null;

  const [formData, setFormData] = useState(initialFormData);
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  // Track when project was just created locally to skip reload resetting the step
  const justCreatedRef = useRef(false);
  // Synchronous record of the row this builder session is bound to. Both
  // sanitizedProjectId (URL) and formData.id (state) update asynchronously, so a
  // second save firing in the same tick would otherwise see no id and INSERT a
  // duplicate row. This ref is set the instant a row is created/updated so
  // concurrent saves target the same row.
  const boundProjectIdRef = useRef(null);
  // Serializes saves so two concurrent createOrUpdateProject calls can't both
  // run the INSERT path and create duplicate pattern books.
  const saveLockRef = useRef(Promise.resolve());
  const [disciplineLibrary, setDisciplineLibrary] = useState([]);
  const [associationsData, setAssociationsData] = useState([]);
  const [divisionsData, setDivisionsData] = useState({});
  const [existingProjects, setExistingProjects] = useState([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch disciplines function (reusable for refreshing)
  const fetchDisciplines = useCallback(async () => {
    const { data, error } = await supabase.from('disciplines').select('*').order('sort_order');
    if (error) {
      console.error('Error fetching disciplines:', error);
      return [];
    }
    const disciplinesWithAssociationId = data.map(d => ({
      ...d,
      associations: d.association_id ? [{ association_id: d.association_id, sub_association_type: d.sub_association_type }] : []
    }));
    return disciplinesWithAssociationId;
  }, []);

  // Refresh discipline library (call after adding new disciplines)
  const refreshDisciplineLibrary = useCallback(async () => {
    const disciplines = await fetchDisciplines();
    setDisciplineLibrary(disciplines);
  }, [fetchDisciplines]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const projectsQuery = user
          ? supabase.from('projects').select('id, project_name, project_type, project_data, status').eq('user_id', user.id).in('project_type', ['show', 'pattern_book']).order('created_at', { ascending: false })
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

        const disciplinesWithAssociationId = disciplinesRes.data.map(d => ({
          ...d,
          associations: d.association_id ? [{ association_id: d.association_id, sub_association_type: d.sub_association_type }] : []
        }));

        setDisciplineLibrary(disciplinesWithAssociationId);
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
        if (projectsRes.data) setExistingProjects(projectsRes.data);

        if (sanitizedProjectId) {
          // Bind this session to the loaded row so saves update it, never INSERT.
          boundProjectIdRef.current = sanitizedProjectId;
          // Skip reloading from DB if we just created this project in the same session.
          // The URL changed (added projectId) but step/formData are already correct in state.
          if (justCreatedRef.current) {
            justCreatedRef.current = false;
          } else {
            const { data: projectData, error: projectError } = await supabase
              .from('projects')
              .select('project_data, status')
              .eq('id', sanitizedProjectId)
              .single();

            if (projectError) throw projectError;
            if (projectData && projectData.project_data) {
              // Migrate old Prelims/Finals format to new Go 1/Go 2 format
              const migratedData = migrateToGoFormat(projectData.project_data);
              // The top-level `projects.status` column is the source of truth
              // for lock/publish state (Customer Portal writes to it directly).
              // Override any stale projectStatus inside the JSON blob so Step 8
              // always reflects the current lock state.
              if (projectData.status) {
                migratedData.projectStatus = projectData.status;
              }
              setFormData(prev => ({ ...initialFormData, ...migratedData, id: sanitizedProjectId }));
              const savedStep = migratedData.currentStep || 1;
              const savedCompleted = migratedData.completedSteps || [];
              setStep(savedStep);
              setCompletedSteps(new Set(savedCompleted));
            }
          }
        } else {
          // Brand-new builder session — not bound to any row yet.
          boundProjectIdRef.current = null;
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
    };

    fetchInitialData();
  }, [sanitizedProjectId, toast]);

  const handleShowTypeChange = useCallback((newShowType) => {
    setFormData(prev => {
      let newDisciplines = [...(prev.disciplines || [])];
      const vrhDisciplines = disciplineLibrary.filter(d => d.associations.some(a => a.association_id === 'versatility-ranch'));

      if (newShowType === 'versatility-ranch') {
        const existingVrhNames = new Set(newDisciplines.map(d => d.name));
        vrhDisciplines.forEach(vrhDisc => {
          if (!existingVrhNames.has(vrhDisc.name)) {
            newDisciplines.push({
              ...vrhDisc,
              id: `${vrhDisc.name.replace(/\s+/g, '-')}-${Date.now()}`,
              pattern: vrhDisc.category?.startsWith('pattern'),
              scoresheet: vrhDisc.category !== 'none',
              patternType: vrhDisc.pattern_type || 'none',
              isCustom: false,
              selectedAssociations: { 'versatility-ranch': true },
              divisions: { 'versatility-ranch': {} },
              patternGroups: [{ id: `pg-${Date.now()}`, name: 'Pattern 1', divisions: [], competitionDate: null }],
            });
          }
        });
      } else {
        const vrhDisciplineNames = new Set(vrhDisciplines.map(d => d.name));
        newDisciplines = newDisciplines.filter(d => !vrhDisciplineNames.has(d.name));
      }

      newDisciplines.sort((a, b) => {
        const aSort = disciplineLibrary.find(d => d.name === a.name)?.sort_order ?? 999;
        const bSort = disciplineLibrary.find(d => d.name === b.name)?.sort_order ?? 999;
        return aSort - bSort;
      });

      return { ...prev, showType: newShowType, disciplines: newDisciplines };
    });
  }, [disciplineLibrary]);

  // Helper function to get the next available show number
  // Starts from 1000 and increments sequentially, filling any gaps
  const getNextShowNumber = useCallback(async () => {
    try {
      // Fetch all pattern book projects
      const { data: projects, error } = await supabase
        .from('projects')
        .select('project_data')
        .eq('project_type', 'pattern_book');

      if (error) {
        console.error('Error fetching projects for show number:', error);
        return '1000'; // Default to 1000 on error
      }

      // Extract show numbers from project_data
      // Only consider numbers that are >= 1000 and are simple numeric values
      const showNumbers = new Set();
      if (projects && projects.length > 0) {
        projects.forEach(project => {
          const showNumber = project.project_data?.showNumber;
          if (showNumber) {
            const showNumberStr = showNumber.toString().trim();
            // Only consider if it's a simple numeric value (not formats like "2024-001")
            // Check if it's a pure number >= 1000
            if (/^\d+$/.test(showNumberStr)) {
              const numericValue = parseInt(showNumberStr, 10);
              if (!isNaN(numericValue) && numericValue >= 1000) {
                showNumbers.add(numericValue);
              }
            }
          }
        });
      }

      // If no show numbers exist, start from 1000
      if (showNumbers.size === 0) {
        return '1000';
      }

      // Find the next available number sequentially starting from 1000
      // This fills any gaps in the sequence
      for (let num = 1000; num <= 9999; num++) {
        if (!showNumbers.has(num)) {
          return num.toString();
        }
      }

      // If all numbers 1000-9999 are taken, continue from highest + 1
      const highestNumber = Math.max(...Array.from(showNumbers));
      return (highestNumber + 1).toString();
    } catch (error) {
      console.error('Error generating show number:', error);
      return '1000'; // Default to 1000 on error
    }
  }, []);

  // Create staff notifications for all staff added via OfficialsStaffSection
  const createStaffNotifications = async (projectId, projectName, projectData) => {
    try {
      // Collect all emails to notify
      const toNotify = []; // [{email, name, type}]

      // From showDetails.officials: assocId → roleId → [{name, email, ...}]
      const sdOfficials = projectData.showDetails?.officials || {};
      for (const rolesMap of Object.values(sdOfficials)) {
        if (typeof rolesMap !== 'object' || rolesMap === null) continue;
        for (const members of Object.values(rolesMap)) {
          if (!Array.isArray(members)) continue;
          for (const member of members) {
            if (!member?.email || !member.email.includes('@')) continue;
            const email = member.email.trim().toLowerCase();
            if (!toNotify.some(n => n.email === email)) {
              toNotify.push({ email, name: member.name || null, type: 'staff_assignment' });
            }
          }
        }
      }

      // From showDetails.judges: assocId → [{name, email}]
      const sdJudges = projectData.showDetails?.judges || {};
      for (const judges of Object.values(sdJudges)) {
        if (!Array.isArray(judges)) continue;
        for (const judge of judges) {
          if (!judge?.email || !judge.email.includes('@')) continue;
          const email = judge.email.trim().toLowerCase();
          if (!toNotify.some(n => n.email === email)) {
            toNotify.push({ email, name: judge.name || null, type: 'assignment' });
          }
        }
      }

      if (toNotify.length === 0) return;

      // Check which notifications already exist for this project
      const { data: existing } = await supabase
        .from('judge_notifications')
        .select('judge_email')
        .eq('project_id', projectId)
        .in('judge_email', toNotify.map(n => n.email));

      const existingEmails = new Set((existing || []).map(e => e.judge_email));

      // Only insert for new staff/judges
      for (const person of toNotify) {
        if (existingEmails.has(person.email)) continue;

        const { error: insertError } = await supabase
          .from('judge_notifications')
          .insert({
            judge_email: person.email,
            judge_name: person.name,
            project_id: projectId,
            project_name: projectName,
            notification_type: person.type,
            message: person.type === 'staff_assignment'
              ? `You have been assigned as staff to ${projectName}.`
              : `You have been assigned to ${projectName}.`,
            is_read: false,
            created_by: user?.id || null,
          });

        if (insertError) {
          console.warn('Staff notification insert failed:', person.email, insertError.message);
        }
      }
    } catch (error) {
      console.error('Error creating staff notifications:', error);
    }
  };

  // Create judge notifications for all judges added to the project (Step 4 onwards)
  const createJudgeNotifications = async (projectId, projectName, projectData) => {
    try {
      const associationJudges = projectData.associationJudges || {};
      const judgesFound = [];

      // Collect all judge emails
      for (const [assocId, assocData] of Object.entries(associationJudges)) {
        const judges = assocData?.judges || [];
        for (const judge of judges) {
          if (!judge?.email || !judge.email.includes('@')) continue;
          const judgeEmail = judge.email.trim().toLowerCase();
          if (!judgesFound.includes(judgeEmail)) {
            judgesFound.push(judgeEmail);
          }
        }
      }

      if (judgesFound.length === 0) return;

      // Check which notifications already exist for this project
      const { data: existing } = await supabase
        .from('judge_notifications')
        .select('judge_email')
        .eq('project_id', projectId)
        .in('judge_email', judgesFound);

      const existingEmails = new Set((existing || []).map(e => e.judge_email));

      // Only insert for new judges
      for (const [assocId, assocData] of Object.entries(associationJudges)) {
        const judges = assocData?.judges || [];
        for (const judge of judges) {
          if (!judge?.email || !judge.email.includes('@')) continue;
          const judgeEmail = judge.email.trim().toLowerCase();
          if (existingEmails.has(judgeEmail)) continue;
          existingEmails.add(judgeEmail); // prevent duplicates within same batch

          const { error: insertError } = await supabase
            .from('judge_notifications')
            .insert({
              judge_email: judgeEmail,
              judge_name: judge.name || null,
              project_id: projectId,
              project_name: projectName,
              notification_type: 'assignment',
              message: `You have been assigned to ${projectName}.`,
              is_read: false,
              created_by: user?.id || null,
            });

          if (insertError) {
            console.log('Judge notification insert result:', judgeEmail, insertError?.message || 'OK');
          } else {
            console.log('Judge notification created for:', judgeEmail);
          }
        }
      }
      console.log('Judge notifications processed. Judges found:', judgesFound);
    } catch (error) {
      console.error('Error creating judge notifications:', error);
    }
  };

  const performCreateOrUpdateProject = useCallback(async (explicitStatus) => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to save a project.', variant: 'destructive' });
      return null;
    }

    // Auto-generate show number if empty
    let finalFormData = { ...formData };
    if (!finalFormData.showNumber || String(finalFormData.showNumber).trim() === '') {
      const generatedShowNumber = await getNextShowNumber();
      finalFormData.showNumber = generatedShowNumber;
      // Update formData state so it's reflected in the UI
      setFormData(prev => ({ ...prev, showNumber: generatedShowNumber }));
    }

    // Add current step to completedSteps before saving
    const updatedCompletedSteps = new Set(completedSteps);
    updatedCompletedSteps.add(step);

    // Update the state so it's reflected immediately
    setCompletedSteps(updatedCompletedSteps);

    // If an explicit status is provided (from closeout step), use it directly.
    // Otherwise, auto-determine based on step completion.
    let projectStatus;
    if (explicitStatus) {
      projectStatus = explicitStatus;
      // Persist the status in formData so it's available on reload
      finalFormData.projectStatus = explicitStatus;
      setFormData(prev => ({ ...prev, projectStatus: explicitStatus }));
    } else {
      // Status lifecycle rules:
      //   - "In progress" is ONLY for brand-new books that have never been saved
      //     past the first gate. Once a book leaves this state it can never return.
      //   - "Draft" is the active editable state.
      //   - "Locked" / "Final" (also legacy "Lock & Approve Mode" / "Publication")
      //     are frozen states. The UI is read-only in these states. Status is
      //     preserved on save; the only way out is an explicit "Unlock & Save as
      //     Draft" click on the closeout step, which passes explicitStatus='Draft'.
      const currentStatus = finalFormData.projectStatus;
      if (currentStatus && currentStatus !== 'In progress') {
        projectStatus = currentStatus;
      } else {
        const completedStepsArray = Array.from(updatedCompletedSteps);
        const allSteps = [1, 2, 3, 4, 5, 6, 7, 8];
        const allStepsComplete = allSteps.every(step => completedStepsArray.includes(step));
        projectStatus = allStepsComplete ? 'Draft' : 'In progress';
      }
    }

    const projectToSave = {
      ...finalFormData,
      currentStep: step,
      completedSteps: Array.from(updatedCompletedSteps),
    };

    const trimmedName = (finalFormData.showName || '').trim() || 'Untitled Pattern Book';

    const projectPayload = {
      project_name: trimmedName,
      project_type: 'pattern_book',
      project_data: projectToSave,
      status: projectStatus,
      user_id: user.id,
    };

    // Never use linkedProjectId as save target — it's a read-only reference to another project.
    // boundProjectIdRef is the synchronous fallback: if an earlier save in this
    // session already created the row, its id is here before state/URL catch up.
    let currentProjectId = sanitizedProjectId || formData.id || boundProjectIdRef.current;

    // If no project ID yet, check if a project with this name already exists for this user
    // and reuse it instead of creating a duplicate. Pick the most recent match so
    // any pre-existing duplicates collapse onto a single row going forward.
    if (!currentProjectId && trimmedName !== 'Untitled Pattern Book') {
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('project_type', 'pattern_book')
        .eq('user_id', user.id)
        .ilike('project_name', trimmedName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingProject) {
        currentProjectId = existingProject.id;
      }
    }

    if (currentProjectId) {
      const { error } = await supabase
        .from('projects')
        .update(projectPayload)
        .eq('id', currentProjectId);

      if (error) {
        toast({ title: 'Error saving project', description: error.message, variant: 'destructive' });
        return null;
      }
      // Bind this session to the row so any later save updates it, never INSERTs.
      boundProjectIdRef.current = currentProjectId;
      // Silent save — no popup during normal editing
      // Auto-lock Step 1 and structure after save
      setFormData(prev => ({
        ...prev,
        id: currentProjectId,
        lockedSections: { ...prev.lockedSections, step1: true, structure: true }
      }));
      // If URL doesn't have the project ID yet, navigate to it
      if (!sanitizedProjectId) {
        justCreatedRef.current = true;
        navigate(`/pattern-book-builder/${currentProjectId}`, { replace: true });
      }
      // Create notifications for judges and staff
      await createJudgeNotifications(currentProjectId, trimmedName, finalFormData);
      await createStaffNotifications(currentProjectId, trimmedName, finalFormData);
      return currentProjectId;
    } else {
      const newId = uuidv4();
      const { data, error } = await supabase
        .from('projects')
        .insert([{ ...projectPayload, id: newId }])
        .select('id')
        .single();

      if (error) {
        toast({ title: 'Error creating project', description: error.message, variant: 'destructive' });
        return null;
      }

      const newProjectId = data.id;
      // Record the new id synchronously so a save firing before state/URL update
      // reuses this row instead of inserting another duplicate.
      boundProjectIdRef.current = newProjectId;
      setFormData(prev => ({
        ...prev,
        id: newProjectId,
        lockedSections: { ...prev.lockedSections, step1: true, structure: true }
      }));
      justCreatedRef.current = true;
      navigate(`/pattern-book-builder/${newProjectId}`, { replace: true });
      // Silent save — no popup during normal editing
      return newProjectId;
    }
  }, [formData, step, completedSteps, setCompletedSteps, sanitizedProjectId, toast, navigate, user, getNextShowNumber]);

  // Public save entrypoint. Chains every call onto the previous one so a second
  // save waits for the first to finish (and record its row id) before running —
  // this is what stops two near-simultaneous saves from both INSERTing and
  // creating duplicate "In progress" + "Draft" books for the same show.
  const createOrUpdateProject = useCallback((explicitStatus) => {
    const result = saveLockRef.current.then(() => performCreateOrUpdateProject(explicitStatus));
    // Keep the lock chain alive even if a save rejects, so it never deadlocks.
    saveLockRef.current = result.catch(() => {});
    return result;
  }, [performCreateOrUpdateProject]);

  const nextStep = () => setStep(prev => Math.min(prev + 1, 10));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));
  const setCurrentStep = (newStep) => setStep(newStep);

  const unlockSection = useCallback((sectionKey) => {
    setFormData(prev => ({
      ...prev,
      lockedSections: { ...prev.lockedSections, [sectionKey]: false }
    }));
  }, []);

  const resetDisciplines = useCallback(() => {
    setFormData(prev => ({ ...prev, disciplines: [] }));
  }, [setFormData]);

  const resetCurrentStep = useCallback((currentStep) => {
    setFormData(prev => {
      switch (currentStep) {
        case 1:
          return {
            ...prev,
            showName: '',
            associations: {},
            subAssociationSelections: {},
            customAssociations: [],
            primaryAffiliates: [],
            nsbaApprovalType: '',
            nsbaCategory: '',
            nsbaDualApprovedWith: [],
            phbaHorseType: 'stock',
            pthaHorseType: 'stock',
          };
        case 2:
          return { ...prev, disciplines: [], selected4HCity: '' };
        case 3:
          return {
            ...prev,
            disciplines: prev.disciplines.map(d => ({
              ...d,
              divisions: {},
              divisionOrder: [],
              divisionDates: {},
              divisionPrintTitles: {},
              divisionGos: {},  // Go 1/Go 2 configuration
              patternGroups: [{ id: `pg-${Date.now()}`, name: 'Group 1', divisions: [], competitionDate: null }],
            })),
            // Also reset Step 5 data that depends on class configuration
            patternSelections: {},
            disciplinePatterns: {},
            groupDueDates: {},
            groupStaff: {},
            groupJudges: {},
            disciplineDueDates: {},
            judgeSelections: [],
            dueDateSelections: [],
          };
        case 4:
          return {
            ...prev,
            startDate: null,
            endDate: null,
            venueName: '',
            venueAddress: '',
            officials: [],
            associationJudges: {},
            showDetails: { officials: {}, judges: {}, judgeCount: {} },
          };
        case 5:
          return {
            ...prev,
            patternSelections: {},
            disciplinePatterns: {},
            groupDueDates: {},
            groupStaff: {},
            groupJudges: {},
            disciplineDueDates: {},
            judgeSelections: [],
            dueDateSelections: [],
          };
        case 8:
          return {
            ...prev,
            delegations: {},
            adminOwner: null,
            secondAdmin: null,
            publicationDate: null,
          };
        default:
          return prev;
      }
    });
  }, []);

  return {
    step,
    setCurrentStep,
    nextStep,
    prevStep,
    formData,
    setFormData,
    completedSteps,
    setCompletedSteps,
    createOrUpdateProject,
    isLoading,
    disciplineLibrary,
    associationsData,
    divisionsData,
    handleShowTypeChange,
    resetDisciplines,
    resetCurrentStep,
    refreshDisciplineLibrary,
    unlockSection,
    existingProjects,
  };
};