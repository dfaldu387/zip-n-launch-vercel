import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Building2, Users, FileText, Send, FolderOpen, CheckCircle, Save, Loader2, RotateCcw, FileSignature } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';
import { BuilderSteps } from '@/components/pbb/BuilderSteps';
import { applyLinkedProjectData, isBudgetFrozen } from '@/lib/contractUtils';
import { stampModuleStatusOnSave } from '@/lib/moduleStatusService';
import { format } from 'date-fns';

// Step Components
import { Step1_ShowStructure } from '@/components/contract-management/Step1_ShowStructure';
import { Step2_OfficialsStaff } from '@/components/contract-management/Step2_OfficialsStaff';
import { Step3_ContractTemplate } from '@/components/contract-management/Step3_ContractTemplate';
import { Step4_GenerateContracts } from '@/components/contract-management/Step4_GenerateContracts';
import { Step5_PreviewReview } from '@/components/contract-management/Step5_PreviewReview';
import { Step6_CloseOut } from '@/components/contract-management/Step6_CloseOut';

const steps = [
  { id: 1, name: 'Event Setup', icon: Building2 },
  { id: 2, name: 'Officials & Staff', icon: Users },
  { id: 3, name: 'Contract Template', icon: FileText },
  { id: 4, name: 'Generate & Send', icon: Send },
  { id: 5, name: 'Track & Documents', icon: FolderOpen },
  { id: 6, name: 'Save & Manage', icon: CheckCircle },
];

const initialFormData = {
  // Steps 1-2
  selectedShow: null,
  showDetails: null,
  associations: {},
  selectedAssociations: [],
  subAssociationSelections: {},
  showName: '',
  showNumber: '',
  linkedProjectId: null,
  primaryAffiliates: [],
  customAssociations: [],
  // Step 3: Contract Template
  contractBuilder: {
    globalTemplate: '',
    employeeOverrides: {},
  },
  contractSettings: {
    effectiveDate: '',
    expirationDate: '',
    paymentMethod: 'check',
    signingDeadline: '',
    additionalTerms: '',
  },
  // Step 4: Per-employee folders
  employeeFolders: {},
  // Step 5: Delivery
  deliverySettings: {
    deliveryMethod: 'email',
    emailSubject: 'Contract Documents Ready for Review',
    emailMessage: '',
    sendReminders: true,
    requireSignature: true,
    notifyOnComplete: true,
  },
  // Email Activity Log
  emailActivity: [],
  // Step 6: Close Out
  closeOutChecklist: [],
  closeOutNotes: '',
  paymentStatus: 'unpaid',
  paymentConfirmedAt: null,
  paymentNotes: '',
  savedToProject: false,
  linkedToPersonnel: false,
};

const ContractManagementPage = () => {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const sanitizedProjectId = projectId && projectId !== 'undefined' ? projectId : null;
  // showId query param: when navigating from ShowWorkspace, auto-link to this show
  const showIdFromQuery = searchParams.get('showId');

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingProjects, setExistingProjects] = useState([]);
  const [associationsData, setAssociationsData] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const skipReloadRef = useRef(false);
  const formDataRef = useRef(formData);
  const saveProjectRef = useRef(null);
  const currentStepRef = useRef(currentStep);
  const completedStepsRef = useRef(completedSteps);
  const autoSaveTimerRef = useRef(null);
  const hasPendingChangesRef = useRef(false);

  // Sync selectedAssociations (array) from associations (object) for Step 2 compatibility
  useEffect(() => {
    const assocObj = formData.associations || {};
    const derived = Object.keys(assocObj).filter(key => assocObj[key]);
    const current = formData.selectedAssociations || [];
    // Only update if they differ to avoid infinite loops
    if (JSON.stringify(derived.sort()) !== JSON.stringify([...current].sort())) {
      setFormData(prev => ({ ...prev, selectedAssociations: derived }));
    }
  }, [formData.associations]);

  // Keep refs in sync
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { completedStepsRef.current = completedSteps; }, [completedSteps]);

  // Mark pending changes whenever formData changes (skip initial load)
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    hasPendingChangesRef.current = true;

    // Debounced auto-save: save 3 seconds after last change
    // Only auto-save if we already have a project ID (i.e., the project was explicitly saved before)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const latestData = formDataRef.current;
      const hasProjectId = sanitizedProjectId || latestData.id;
      if (saveProjectRef.current && hasPendingChangesRef.current && hasProjectId) {
        saveProjectRef.current({ silent: true });
        hasPendingChangesRef.current = false;
      }
    }, 3000);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [formData]);

  // Clear initial load flag once data is loaded
  useEffect(() => {
    if (!isLoading) isInitialLoadRef.current = false;
  }, [isLoading]);

  // Save on browser refresh / tab close — only if project already exists
  useEffect(() => {
    const handleBeforeUnload = () => {
      const latestData = formDataRef.current;
      const hasProjectId = sanitizedProjectId || latestData.id;
      if (saveProjectRef.current && hasPendingChangesRef.current && hasProjectId) {
        saveProjectRef.current({ silent: true });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Auto-save when user navigates away (React unmount) — only if project already exists
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      const latestData = formDataRef.current;
      const hasProjectId = sanitizedProjectId || latestData.id;
      if (saveProjectRef.current && hasPendingChangesRef.current && hasProjectId) {
        saveProjectRef.current({ silent: true });
      }
    };
  }, []);

  // Load existing project or initial data
  useEffect(() => {
    // Skip reload when we just created the project (navigate changed the URL)
    if (skipReloadRef.current) {
      skipReloadRef.current = false;
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [projectsRes, associationsRes] = await Promise.all([
          supabase
            .from('projects')
            .select('id, project_name, project_type, project_data, created_at')
            .eq('user_id', user.id)
            .in('project_type', ['show', 'pattern_book'])
            .order('created_at', { ascending: false }),
          supabase
            .from('associations')
            .select('*')
            .order('position')
            .order('name'),
        ]);

        if (projectsRes.error) throw projectsRes.error;
        if (associationsRes.error) throw associationsRes.error;

        setExistingProjects(projectsRes.data || []);
        setAssociationsData(associationsRes.data || []);

        // Load existing contract project if projectId is present
        if (sanitizedProjectId) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('project_data')
            .eq('id', sanitizedProjectId)
            .single();

          if (projectError) throw projectError;
          if (projectData?.project_data) {
            const saved = projectData.project_data;
            // Migrate legacy data: convert selectedAssociations array to associations object
            if (saved.selectedAssociations?.length > 0 && (!saved.associations || Object.keys(saved.associations).length === 0)) {
              saved.associations = {};
              saved.selectedAssociations.forEach(id => { saved.associations[id] = true; });
            }

            let restoredData = { ...initialFormData, ...saved, id: sanitizedProjectId };

            // Sync from linked project: if contract has a linkedProjectId,
            // re-apply auto-fill from the linked project to pick up any
            // fields that weren't populated when the contract was first created.
            if (saved.linkedProjectId && projectsRes.data) {
              const linkedProject = projectsRes.data.find(p => p.id === saved.linkedProjectId);
              if (linkedProject) {
                const officials = saved.showDetails?.officials;
                const hasOfficials = officials && Object.keys(officials).length > 0;
                if (!hasOfficials) {
                  restoredData = applyLinkedProjectData(restoredData, linkedProject);
                  restoredData.id = sanitizedProjectId;
                }
              }
            }

            setFormData(restoredData);
            setCurrentStep(saved.currentStep || 1);
            setCompletedSteps(new Set(saved.completedSteps || []));
          }
        } else if (showIdFromQuery && projectsRes.data) {
          // Navigated from ShowWorkspace with ?showId=xxx — find existing contract or auto-link
          // First, check if a contract already exists for this show
          const { data: existingContract } = await supabase
            .from('projects')
            .select('id')
            .eq('project_type', 'contract')
            .eq('user_id', user.id)
            .filter('project_data->>linkedProjectId', 'eq', showIdFromQuery)
            .limit(1)
            .maybeSingle();

          if (existingContract) {
            // Contract already exists for this show — navigate to it
            // Don't set skipReloadRef — the new URL needs to trigger a full data load
            navigate(`/horse-show-manager/employee-management/contracts/${existingContract.id}`, { replace: true });
            return;
          }

          // No existing contract — auto-link to the show
          const showProject = projectsRes.data.find(p => p.id === showIdFromQuery);
          if (showProject) {
            setFormData(prev => applyLinkedProjectData(prev, showProject));
          }
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

    fetchData();
  }, [sanitizedProjectId, showIdFromQuery, toast]);

  // Save project to Supabase — uses refs to always capture latest state
  const saveProject = useCallback(async ({ silent = false, stepOverride = null } = {}) => {
    const latestFormData = formDataRef.current;
    const latestStep = currentStepRef.current;
    const latestCompleted = completedStepsRef.current;

    if (!user) {
      if (!silent) toast({ title: 'Authentication Error', description: 'You must be logged in to save.', variant: 'destructive' });
      return null;
    }

    if (!latestFormData.showName?.trim()) {
      if (!silent) toast({ title: 'Project Name Required', description: 'Please enter a show/project name before saving.', variant: 'destructive' });
      return null;
    }

    setIsSaving(true);
    try {
      const showNameTrimmed = latestFormData.showName.trim();
      let currentProjectId = sanitizedProjectId || latestFormData.id;

      // If linked to a project, find existing contract for that project to avoid duplicates
      if (!currentProjectId && latestFormData.linkedProjectId) {
        const { data: linkedContract } = await supabase
          .from('projects')
          .select('id, project_name')
          .eq('project_type', 'contract')
          .eq('user_id', user.id)
          .filter('project_data->>linkedProjectId', 'eq', latestFormData.linkedProjectId)
          .limit(1)
          .maybeSingle();

        if (linkedContract) {
          currentProjectId = linkedContract.id;
          setFormData(prev => ({ ...prev, id: currentProjectId }));
        }
      }

      // Fallback: if still no ID, check for existing contract with same show name
      if (!currentProjectId && showNameTrimmed) {
        const { data: nameMatch } = await supabase
          .from('projects')
          .select('id, project_name')
          .eq('project_type', 'contract')
          .eq('user_id', user.id)
          .filter('project_data->>showName', 'ilike', showNameTrimmed)
          .limit(1)
          .maybeSingle();

        if (nameMatch) {
          currentProjectId = nameMatch.id;
          setFormData(prev => ({ ...prev, id: currentProjectId }));
        }
      }

      // Auto-generate project_name: on new creation use today's date, on update keep existing name
      let projectDisplayName;
      if (currentProjectId) {
        // Fetch existing project_name to preserve original date
        const { data: existingProject } = await supabase
          .from('projects')
          .select('project_name')
          .eq('id', currentProjectId)
          .single();
        projectDisplayName = existingProject?.project_name || `Contract - ${showNameTrimmed} - ${format(new Date(), 'MMM d yyyy')}`;
        // Update name if show name changed but keep the original date
        if (existingProject?.project_name) {
          const dateMatch = existingProject.project_name.match(/ - ([A-Z][a-z]{2} \d{1,2} \d{4})$/);
          const originalDate = dateMatch ? dateMatch[1] : format(new Date(), 'MMM d yyyy');
          projectDisplayName = `Contract - ${showNameTrimmed} - ${originalDate}`;
        }
      } else {
        projectDisplayName = `Contract - ${showNameTrimmed} - ${format(new Date(), 'MMM d yyyy')}`;
      }

      // Check for duplicate project name (when not linked to an existing project)
      if (!currentProjectId && !latestFormData.linkedProjectId) {
        const { data: existing } = await supabase
          .from('projects')
          .select('id')
          .eq('project_type', 'contract')
          .eq('project_name', projectDisplayName)
          .eq('user_id', user.id);

        const isDuplicate = existing?.some(p => p.id !== currentProjectId);
        if (isDuplicate) {
          if (!silent) toast({ title: 'Duplicate Name', description: `A contract project named "${projectDisplayName}" already exists. Please use a different name.`, variant: 'destructive' });
          setIsSaving(false);
          return null;
        }
      }

      const stepToSave = stepOverride ?? latestStep;
      const updatedCompleted = new Set(latestCompleted);
      updatedCompleted.add(latestStep);
      setCompletedSteps(updatedCompleted);

      const projectToSave = {
        ...latestFormData,
        currentStep: stepToSave,
        completedSteps: Array.from(updatedCompleted),
      };

      const projectPayload = {
        project_name: projectDisplayName,
        project_type: 'contract',
        project_data: projectToSave,
        status: 'In progress',
        user_id: user.id,
      };

      if (currentProjectId) {
        const { error } = await supabase
          .from('projects')
          .update(projectPayload)
          .eq('id', currentProjectId);

        if (error) {
          if (!silent) toast({ title: 'Error saving project', description: error.message, variant: 'destructive' });
          return null;
        }
        hasPendingChangesRef.current = false;

        // Sync module status to the linked show
        if (latestFormData.linkedProjectId) {
          try {
            const { data: showRow } = await supabase
              .from('projects')
              .select('project_data')
              .eq('id', latestFormData.linkedProjectId)
              .single();
            if (showRow?.project_data) {
              const updated = stampModuleStatusOnSave(showRow.project_data, 'contracts');
              await supabase
                .from('projects')
                .update({ project_data: updated })
                .eq('id', latestFormData.linkedProjectId);
            }
          } catch { /* non-critical — don't block save */ }
        }

        return currentProjectId;
      } else {
        const newId = uuidv4();
        const { data, error } = await supabase
          .from('projects')
          .insert([{ ...projectPayload, id: newId }])
          .select('id')
          .single();

        if (error) {
          if (!silent) toast({ title: 'Error creating project', description: error.message, variant: 'destructive' });
          return null;
        }

        const newProjectId = data.id;
        setFormData(prev => ({ ...prev, id: newProjectId }));
        skipReloadRef.current = true;
        navigate(`/horse-show-manager/employee-management/contracts/${newProjectId}`, { replace: true });
        hasPendingChangesRef.current = false;

        // Sync module status to the linked show
        if (latestFormData.linkedProjectId) {
          try {
            const { data: showRow } = await supabase
              .from('projects')
              .select('project_data')
              .eq('id', latestFormData.linkedProjectId)
              .single();
            if (showRow?.project_data) {
              const updated = stampModuleStatusOnSave(showRow.project_data, 'contracts');
              await supabase
                .from('projects')
                .update({ project_data: updated })
                .eq('id', latestFormData.linkedProjectId);
            }
          } catch { /* non-critical — don't block save */ }
        }

        return newProjectId;
      }
    } catch (error) {
      if (!silent) toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [sanitizedProjectId, toast, navigate, user]);

  // Keep saveProject ref in sync for auto-save on unmount
  useEffect(() => { saveProjectRef.current = saveProject; }, [saveProject]);

  // Manual save button
  const handleSaveProject = async () => {
    const result = await saveProject();
    if (result) {
      toast({ title: 'Project Saved', description: 'All changes have been saved successfully.' });
    }
  };

  // Next with auto-save
  const handleNext = async () => {
    const nextStep = Math.min(currentStep + 1, 6);
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    await saveProject({ silent: true, stepOverride: nextStep });
    setCurrentStep(nextStep);
  };

  const handlePrev = async () => {
    await saveProject({ silent: true });
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Step navigation with auto-save
  const handleStepClick = async (stepId) => {
    if (stepId !== currentStep) {
      await saveProject({ silent: true });
      setCurrentStep(stepId);
    }
  };

  const handleResetStep = () => {
    if (currentStep === 2 && isBudgetFrozen(formData)) {
      toast({
        title: 'Staff Partially Locked',
        description: 'Step 2 cannot be reset because one or more contracts have been sent. Staff with sent contracts are locked.',
        variant: 'destructive',
      });
      return;
    }
    setFormData(prev => {
      switch (currentStep) {
        case 1:
          return { ...prev, associations: {}, selectedAssociations: [], subAssociationSelections: {}, showName: '', showNumber: '', selectedShow: null, showDetails: null, primaryAffiliates: [], customAssociations: [] };
        case 2:
          return { ...prev };
        case 3:
          return { ...prev, contractBuilder: initialFormData.contractBuilder, contractSettings: initialFormData.contractSettings };
        case 4:
          return { ...prev, employeeFolders: {} };
        case 5:
          return { ...prev, deliverySettings: initialFormData.deliverySettings };
        case 6:
          return { ...prev, closeOutChecklist: [], closeOutNotes: '', paymentStatus: 'unpaid', paymentConfirmedAt: null, paymentNotes: '', savedToProject: false, linkedToPersonnel: false };
        default:
          return prev;
      }
    });
    toast({
      title: 'Step Reset',
      description: `Step ${currentStep} has been reset to default values.`,
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1_ShowStructure formData={formData} setFormData={setFormData} associationsData={associationsData} existingProjects={existingProjects} />;
      case 2:
        return <Step2_OfficialsStaff formData={formData} setFormData={setFormData} />;
      case 3:
        return <Step3_ContractTemplate formData={formData} setFormData={setFormData} />;
      case 4:
        return <Step4_GenerateContracts formData={formData} setFormData={setFormData} onSave={saveProject} isSaving={isSaving} />;
      case 5:
        return <Step5_PreviewReview formData={formData} setFormData={setFormData} />;
      case 6:
        return <Step6_CloseOut formData={formData} setFormData={setFormData} onSave={saveProject} isSaving={isSaving} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>Contract Management - EquiPatterns</title>
        <meta name="description" content="Manage employee contracts and agreements." />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="container mx-auto px-4 py-4">
          <PageHeader title="Contract Management" backTo={showIdFromQuery ? `/horse-show-manager/show/${showIdFromQuery}` : formData.linkedProjectId ? `/horse-show-manager/show/${formData.linkedProjectId}` : '/horse-show-manager'} />
          <div className="max-w-7xl mx-auto">
            <BuilderSteps steps={steps} currentStep={currentStep} completedSteps={completedSteps} setCurrentStep={handleStepClick} isEditMode={!!sanitizedProjectId} />
            <Card className="glass-effect">
              <CardContent className="p-0 sm:p-6">
                <AnimatePresence mode="wait">
                  {renderStep()}
                </AnimatePresence>
              </CardContent>
              <CardFooter className="p-4 flex justify-between items-center border-t border-border">
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handlePrev} disabled={currentStep === 1}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleResetStep} className="text-muted-foreground hover:text-destructive">
                    <RotateCcw className="mr-1 h-4 w-4" /> Reset Step
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={handleSaveProject} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Project
                  </Button>
                  {currentStep < 6 ? (
                    <Button onClick={handleNext} disabled={isSaving}>
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => toast({ title: 'Contracts Finalized!', description: 'All contracts have been processed successfully.' })}
                      disabled={formData.paymentStatus !== 'confirmed'}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Finalize Contracts
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
};

export default ContractManagementPage;
