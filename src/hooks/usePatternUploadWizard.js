import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Jumping disciplines get per-discipline upload slots instead of skill-level slots
const JUMPING_DISCIPLINE_NAMES = new Set([
  'Hunter Hack', 'Working Hunter', 'Equitation Over Fences', 'Jumping',
]);

const toSlotId = (name) => `disc-${name.toLowerCase().replace(/\s+/g, '-')}`;

const initialFormData = {
  // Step 1: Name + Associations
  showName: '',           // Used as "Pattern Set Name" — matches AssociationSelection field name
  associations: {},
  primaryAffiliates: [],  // Required by AssociationSelection
  subAssociationSelections: {},  // Required by AssociationSelection
  associationDifficulties: {},

  // Step 2: Discipline + Class
  selectedDiscipline: '',
  selectedClasses: [],

  // Step 3: Upload & Organize
  hierarchyOrder: [
    { id: 'level-1', title: 'Championship', description: 'Pinnacle difficulty, finals-style patterns' },
    { id: 'level-2', title: 'Skilled', description: 'Polished, technical riding' },
    { id: 'level-3', title: 'Intermediate', description: 'Developing control, more elements introduced' },
    { id: 'level-4', title: 'Beginner', description: 'Beginner riders moving beyond basics' },
    { id: 'level-5', title: 'Walk-Trot', description: 'Entry, foundation patterns' },
  ],
  patterns: {},
  stagedPdfs: [],
  patternDivisions: {},

  // Step 4: Maneuver Editing + Annotation
  patternManeuvers: {},
  patternAnnotations: {},
  patternVerbiage: {}, // { [levelId]: { raw: string, formatted: ManeuverStep[], extractedAt: ISO } }
  patternImages: {},   // { [levelId]: { diagramDataUrl, fullImageDataUrl, cropped, cropBounds } }

  // Step 5: Equipment & Documents
  accessoryDocs: [],
  equipmentNotes: '',

  // Step 6: License & Submit
  agreedToTerms: false,
  submissionNotes: '',
  useAsOriginal: null, // null | true | false — user must explicitly answer before submit
  chooseAPatternOnly: false, // when true AND useAsOriginal=true → CAPO identifier; otherwise OP
};

export const usePatternUploadWizard = (projectId) => {
  const sanitizedProjectId = projectId && projectId !== 'undefined' ? projectId : null;

  const [formData, setFormData] = useState(initialFormData);
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [associationsData, setAssociationsData] = useState([]);
  const [disciplineLibrary, setDisciplineLibrary] = useState([]);
  const [divisionsData, setDivisionsData] = useState({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [assocRes, discRes, divRes] = await Promise.all([
          supabase.from('associations').select('*').order('position').order('name'),
          supabase.from('disciplines').select('*').order('sort_order'),
          supabase.from('divisions').select('*, division_levels(*)').order('sort_order'),
        ]);

        if (assocRes.error) throw assocRes.error;
        if (discRes.error) throw discRes.error;
        if (divRes.error) throw divRes.error;

        setAssociationsData(assocRes.data || []);

        const disciplinesWithAssociationId = (discRes.data || []).map(d => ({
          ...d,
          associations: d.association_id ? [{ association_id: d.association_id, sub_association_type: d.sub_association_type }] : [],
        }));
        setDisciplineLibrary(disciplinesWithAssociationId);

        // Build divisionsData grouped by association
        // Format: { assocId: { divisions: [{ group, levels }] } }
        const divsByAssoc = (divRes.data || []).reduce((acc, div) => {
          const key = div.association_id;
          if (!acc[key]) acc[key] = { divisions: [] };
          div.division_levels.sort((a, b) => a.sort_order - b.sort_order);
          acc[key].divisions.push({
            group: div.name,
            levels: div.division_levels.map(l => l.name),
            sub_association_type: div.sub_association_type,
          });
          return acc;
        }, {});
        setDivisionsData(divsByAssoc);

        // Load existing project if editing
        if (sanitizedProjectId) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('project_data')
            .eq('id', sanitizedProjectId)
            .single();

          if (projectError) throw projectError;
          if (projectData?.project_data) {
            const saved = projectData.project_data;
            setFormData(prev => ({ ...initialFormData, ...saved, id: sanitizedProjectId }));
            setStep(saved.currentStep || 1);
            setCompletedSteps(new Set(saved.completedSteps || []));
          }
        } else {
          setFormData(initialFormData);
          setStep(1);
          setCompletedSteps(new Set());
        }
      } catch (error) {
        toast({
          title: 'Error loading data',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [sanitizedProjectId, toast]);

  // --- Navigation ---
  const nextStep = useCallback(() => setStep(prev => Math.min(prev + 1, 6)), []);
  const prevStep = useCallback(() => setStep(prev => Math.max(prev - 1, 1)), []);
  const setCurrentStep = useCallback((newStep) => setStep(newStep), []);

  // --- Association handlers ---
  const handleAssociationChange = useCallback((assocId, isSelected) => {
    setFormData(prev => {
      const newAssociations = { ...prev.associations };
      if (isSelected) {
        newAssociations[assocId] = true;
      } else {
        delete newAssociations[assocId];
        // Clean up difficulties and divisions for removed association
        const newDifficulties = { ...prev.associationDifficulties };
        delete newDifficulties[assocId];

        const newDivisions = { ...prev.patternDivisions };
        Object.keys(newDivisions).forEach(patternId => {
          if (newDivisions[patternId]?.[assocId]) {
            const updated = { ...newDivisions[patternId] };
            delete updated[assocId];
            newDivisions[patternId] = updated;
          }
        });

        return {
          ...prev,
          associations: newAssociations,
          associationDifficulties: newDifficulties,
          patternDivisions: newDivisions,
        };
      }
      return { ...prev, associations: newAssociations };
    });
  }, []);

  const handleDifficultyChange = useCallback((assocId, difficulty) => {
    setFormData(prev => ({
      ...prev,
      associationDifficulties: { ...prev.associationDifficulties, [assocId]: difficulty },
    }));
  }, []);

  // --- Pattern handlers (migrated from usePatternUpload) ---
  const handleFileDrop = useCallback(async (levelId, file) => {
    if (file && file.type === 'application/pdf') {
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
        setFormData(prev => ({
          ...prev,
          patterns: { ...prev.patterns, [levelId]: { id: levelId, file, dataUrl, name: file.name } },
        }));
      } catch (error) {
        toast({ title: 'Error reading file', description: 'Could not read the selected file.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Invalid File Type', description: 'Please upload a PDF file.', variant: 'destructive' });
    }
  }, [toast]);

  const handleRemovePattern = useCallback((levelId) => {
    setFormData(prev => {
      const pattern = prev.patterns[levelId];
      const newPatterns = { ...prev.patterns };
      delete newPatterns[levelId];

      // Return the pattern to staging area instead of deleting
      let newStagedPdfs = prev.stagedPdfs;
      if (pattern && (pattern.file || pattern.dataUrl)) {
        newStagedPdfs = [...prev.stagedPdfs, {
          id: uuidv4(),
          dataUrl: pattern.dataUrl,
          originalFileName: pattern.file?.name || pattern.name || 'pattern.pdf',
          displayName: pattern.name || pattern.file?.name || 'Unassigned Pattern',
          pageNumber: 1,
          file: pattern.file,
        }];
      }

      // Clean up linked accessory docs
      const newDocs = prev.accessoryDocs.map(doc => ({
        ...doc,
        linkedPatternIds: doc.linkedPatternIds.filter(id => id !== levelId),
      }));

      // Clean up maneuvers, annotations, and verbiage
      const newManeuvers = { ...prev.patternManeuvers };
      delete newManeuvers[levelId];
      const newAnnotations = { ...prev.patternAnnotations };
      delete newAnnotations[levelId];
      const newVerbiage = { ...prev.patternVerbiage };
      delete newVerbiage[levelId];

      return {
        ...prev,
        patterns: newPatterns,
        stagedPdfs: newStagedPdfs,
        accessoryDocs: newDocs,
        patternManeuvers: newManeuvers,
        patternAnnotations: newAnnotations,
        patternVerbiage: newVerbiage,
      };
    });
    toast({ title: 'Pattern Unassigned', description: 'Returned to staging area.' });
  }, [toast]);

  const handleMovePattern = useCallback((fromSlotId, toSlotId) => {
    if (fromSlotId === toSlotId) return;
    setFormData(prev => {
      const fromPattern = prev.patterns[fromSlotId];
      if (!fromPattern) return prev;

      // If target slot already has a pattern, swap them
      const toPattern = prev.patterns[toSlotId];
      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [toSlotId]: { ...fromPattern, id: toSlotId },
          [fromSlotId]: toPattern ? { ...toPattern, id: fromSlotId } : undefined,
        },
      };
    });
    toast({ title: 'Pattern Moved' });
  }, [toast]);

  // --- PDF splitting ---
  const handlePdfSplit = useCallback(async (file) => {
    if (!file) return;
    toast({ title: 'Processing PDF...', description: 'Splitting pages into individual patterns.' });
    try {
      const { pdfToDataUrls } = await import('@/lib/pdfUtils');
      const pages = await pdfToDataUrls(file);
      const baseName = file.name.replace(/\.pdf$/i, '');
      const newStagedPdfs = pages.map((page, index) => ({
        id: uuidv4(),
        dataUrl: page.dataUrl,
        originalFileName: file.name,
        displayName: `${baseName} - Page ${index + 1}`,
        pageNumber: index + 1,
        file: new File([page.blob], `${baseName}_page_${index + 1}.pdf`, { type: 'application/pdf' }),
      }));
      setFormData(prev => ({
        ...prev,
        stagedPdfs: [...prev.stagedPdfs, ...newStagedPdfs],
      }));
      toast({ title: 'PDF Split Successfully', description: `${pages.length} pages ready to assign.` });
    } catch (error) {
      toast({ title: 'PDF Split Failed', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  const assignStagedPdf = useCallback((stagedPdfId, slotId) => {
    let assignedName = '';
    let slotTitle = '';
    setFormData(prev => {
      const stagedPdf = prev.stagedPdfs.find(p => p.id === stagedPdfId);
      if (!stagedPdf) return prev;
      assignedName = stagedPdf.displayName || stagedPdf.originalFileName;
      const slot = prev.hierarchyOrder.find(h => h.id === slotId);
      slotTitle = slot?.title || slotId.replace(/^disc-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [slotId]: {
            id: slotId,
            file: stagedPdf.file,
            dataUrl: stagedPdf.dataUrl,
            name: stagedPdf.displayName || `${stagedPdf.originalFileName} (Page ${stagedPdf.pageNumber})`,
          },
        },
        stagedPdfs: prev.stagedPdfs.filter(p => p.id !== stagedPdfId),
      };
    });
    // Show toast after state update is queued
    if (assignedName) {
      toast({ title: 'Pattern Assigned', description: `"${assignedName}" → ${slotTitle}` });
    }
  }, [toast]);

  const removeStagedPdf = useCallback((stagedPdfId) => {
    setFormData(prev => ({
      ...prev,
      stagedPdfs: prev.stagedPdfs.filter(p => p.id !== stagedPdfId),
    }));
  }, []);

  const renameStagedPdf = useCallback((stagedPdfId, newName) => {
    setFormData(prev => ({
      ...prev,
      stagedPdfs: prev.stagedPdfs.map(p =>
        p.id === stagedPdfId ? { ...p, displayName: newName } : p
      ),
    }));
  }, []);

  // --- Division handlers ---
  const handleDivisionChange = useCallback((patternId, assocId, level, isSelected) => {
    setFormData(prev => {
      const newDivisions = JSON.parse(JSON.stringify(prev.patternDivisions));
      if (!newDivisions[patternId]) newDivisions[patternId] = {};
      if (!Array.isArray(newDivisions[patternId][assocId])) {
        newDivisions[patternId][assocId] = [];
      }
      const list = newDivisions[patternId][assocId];
      if (isSelected) {
        if (!list.includes(level)) list.push(level);
      } else {
        const idx = list.indexOf(level);
        if (idx > -1) list.splice(idx, 1);
      }
      return { ...prev, patternDivisions: newDivisions };
    });
  }, []);

  const handleDivisionGroupChange = useCallback((patternId, assocId, levels, isSelected) => {
    setFormData(prev => {
      const newDivisions = JSON.parse(JSON.stringify(prev.patternDivisions));
      if (!newDivisions[patternId]) newDivisions[patternId] = {};
      if (!Array.isArray(newDivisions[patternId][assocId])) {
        newDivisions[patternId][assocId] = [];
      }
      const list = newDivisions[patternId][assocId];
      levels.forEach(level => {
        if (isSelected) {
          if (!list.includes(level)) list.push(level);
        } else {
          const idx = list.indexOf(level);
          if (idx > -1) list.splice(idx, 1);
        }
      });
      return { ...prev, patternDivisions: newDivisions };
    });
  }, []);

  const handleBulkDivisionChange = useCallback((division, isSelected) => {
    const assocIds = Array.from(division.associations);
    const levelName = division.level;
    setFormData(prev => {
      const newDivisions = JSON.parse(JSON.stringify(prev.patternDivisions));
      // Iterate over all patterns that have uploads (mode-agnostic)
      Object.keys(prev.patterns).forEach(patternId => {
        if (prev.patterns[patternId]) {
          if (!newDivisions[patternId]) newDivisions[patternId] = {};
          assocIds.forEach(assocId => {
            if (!Array.isArray(newDivisions[patternId][assocId])) {
              newDivisions[patternId][assocId] = [];
            }
            const list = newDivisions[patternId][assocId];
            const idx = list.indexOf(levelName);
            if (isSelected) {
              if (idx === -1) list.push(levelName);
            } else {
              if (idx > -1) list.splice(idx, 1);
            }
          });
        }
      });
      return { ...prev, patternDivisions: newDivisions };
    });
  }, []);

  // --- Accessory document handlers ---
  const handleAddAccessoryDoc = useCallback((file, type) => {
    const newDoc = { id: uuidv4(), file, type, linkedPatternIds: [] };
    setFormData(prev => ({
      ...prev,
      accessoryDocs: [...prev.accessoryDocs, newDoc],
    }));
  }, []);

  const handleRemoveAccessoryDoc = useCallback((docId) => {
    setFormData(prev => ({
      ...prev,
      accessoryDocs: prev.accessoryDocs.filter(doc => doc.id !== docId),
    }));
  }, []);

  const handleUpdateAccessoryDoc = useCallback((docId, updates) => {
    setFormData(prev => ({
      ...prev,
      accessoryDocs: prev.accessoryDocs.map(doc =>
        doc.id === docId ? { ...doc, ...updates } : doc
      ),
    }));
  }, []);

  // --- Draft save ---
  const createOrUpdateProject = useCallback(async () => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to save.', variant: 'destructive' });
      return null;
    }

    const updatedCompletedSteps = new Set(completedSteps);
    updatedCompletedSteps.add(step);
    setCompletedSteps(updatedCompletedSteps);

    // Strip non-serializable File objects for JSON storage
    const serializablePatterns = {};
    Object.entries(formData.patterns).forEach(([key, val]) => {
      if (val) {
        serializablePatterns[key] = { id: val.id, name: val.name, dataUrl: val.dataUrl };
      }
    });

    const serializableDocs = formData.accessoryDocs.map(doc => ({
      id: doc.id,
      type: doc.type,
      linkedPatternIds: doc.linkedPatternIds,
      fileName: doc.file?.name,
    }));

    const projectToSave = {
      ...formData,
      patterns: serializablePatterns,
      accessoryDocs: serializableDocs,
      stagedPdfs: [], // Don't persist staged PDFs in draft
      currentStep: step,
      completedSteps: Array.from(updatedCompletedSteps),
    };

    const projectPayload = {
      project_name: formData.showName || 'Untitled Pattern Upload',
      project_type: 'pattern_upload',
      project_data: projectToSave,
      status: 'In progress',
      user_id: user.id,
    };

    let currentProjectId = sanitizedProjectId || formData.id;

    if (currentProjectId) {
      const { error } = await supabase
        .from('projects')
        .update(projectPayload)
        .eq('id', currentProjectId);

      if (error) {
        toast({ title: 'Error saving draft', description: error.message, variant: 'destructive' });
        return null;
      }
      toast({ title: 'Draft Saved!', description: 'Your progress has been saved.' });
      return currentProjectId;
    } else {
      const newId = uuidv4();
      const { data, error } = await supabase
        .from('projects')
        .insert([{ ...projectPayload, id: newId }])
        .select('id')
        .single();

      if (error) {
        toast({ title: 'Error creating draft', description: error.message, variant: 'destructive' });
        return null;
      }

      const newProjectId = data.id;
      setFormData(prev => ({ ...prev, id: newProjectId }));
      navigate(`/upload-patterns/edit/${newProjectId}`, { replace: true });
      toast({ title: 'Draft Created & Saved!', description: 'Your pattern upload draft has been saved.' });
      return newProjectId;
    }
  }, [formData, step, completedSteps, sanitizedProjectId, toast, navigate, user]);

  // --- Reset ---
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setStep(1);
    setCompletedSteps(new Set());
  }, []);

  // --- Auto-save (30s debounce) ---
  const [lastAutoSaved, setLastAutoSaved] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef(null);

  useEffect(() => {
    if (!formData.id || !user) return;

    const snapshot = JSON.stringify({
      showName: formData.showName,
      associations: formData.associations,
      selectedClasses: formData.selectedClasses,
      patterns: Object.keys(formData.patterns),
      patternManeuvers: formData.patternManeuvers,
      patternVerbiage: formData.patternVerbiage,
      equipmentNotes: formData.equipmentNotes,
    });

    if (snapshot === lastSavedSnapshotRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await createOrUpdateProject();
        lastSavedSnapshotRef.current = snapshot;
        setLastAutoSaved(new Date());
      } catch (e) {
        console.warn('Auto-save failed:', e);
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formData, user, createOrUpdateProject]);

  // --- Validation ---
  const isNextDisabled = useMemo(() => {
    if (isLoading) return true;
    switch (step) {
      case 1:
        return !formData.showName?.trim() ||
          Object.keys(formData.associations).filter(k => formData.associations[k]).length === 0;
      case 2:
        return formData.selectedClasses.length === 0;
      case 3:
        return !Object.values(formData.patterns).some(p => p);
      case 4:
        return false; // Optional step
      case 5:
        return false; // Optional step
      case 6:
        return !formData.agreedToTerms;
      default:
        return false;
    }
  }, [step, formData, isLoading]);

  // --- Derived state ---
  const hasPatterns = useMemo(() => Object.values(formData.patterns).some(p => p), [formData.patterns]);
  const selectedAssociationIds = useMemo(
    () => Object.keys(formData.associations).filter(k => formData.associations[k]),
    [formData.associations]
  );

  // Dynamic upload slots: discipline-based for Jumping group, skill-level for everything else
  const uploadSlots = useMemo(() => {
    const selectedNames = [...new Set(
      (formData.selectedClasses || [])
        .filter(k => k.includes('::'))
        .map(k => k.split('::')[1])
    )];
    const jumpingSelected = selectedNames.filter(n => JUMPING_DISCIPLINE_NAMES.has(n));
    if (jumpingSelected.length > 0) {
      return jumpingSelected.map(name => ({
        id: toSlotId(name),
        title: name,
        description: `Upload pattern for ${name}`,
        isDisciplineSlot: true,
      }));
    }
    return formData.hierarchyOrder;
  }, [formData.selectedClasses, formData.hierarchyOrder]);

  const handlePatternSkillLevel = useCallback((slotId, skillLevel) => {
    setFormData(prev => {
      const pattern = prev.patterns[slotId];
      if (!pattern) return prev;
      return {
        ...prev,
        patterns: {
          ...prev.patterns,
          [slotId]: { ...pattern, skillLevel: skillLevel || undefined },
        },
      };
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
    isNextDisabled,
    associationsData,
    disciplineLibrary,
    divisionsData,
    hasPatterns,
    selectedAssociationIds,
    uploadSlots,
    resetForm,
    lastAutoSaved,
    // Pattern handlers
    handleFileDrop,
    handlePatternSkillLevel,
    handleRemovePattern,
    handleMovePattern,
    handlePdfSplit,
    assignStagedPdf,
    removeStagedPdf,
    renameStagedPdf,
    // Association handlers
    handleAssociationChange,
    handleDifficultyChange,
    // Division handlers
    handleDivisionChange,
    handleDivisionGroupChange,
    handleBulkDivisionChange,
    // Accessory doc handlers
    handleAddAccessoryDoc,
    handleRemoveAccessoryDoc,
    handleUpdateAccessoryDoc,
  };
};
