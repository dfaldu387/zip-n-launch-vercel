import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, GitMerge, ListPlus, Calendar, UploadCloud, LayoutTemplate, Eye, FileSignature, ShieldCheck, BookCopy, Save, Loader2, Download, Settings2, Share2, RotateCcw } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Step1_Associations } from '@/components/pbb/Step1_Associations';
import { Step2_ClassesAndDivisions } from '@/components/pbb/Step2_ClassesAndDivisions';
import { Step3_Details } from '@/components/pbb/Step3_Details';
import { Step4_Uploads } from '@/components/pbb/Step4_Uploads';
import { Step6_PatternAndLayout } from '@/components/pbb/Step6_PatternAndLayout';
import { Step_CloseOutAndDelegate } from '@/components/pbb/Step_CloseOutAndDelegate';
import { Step6_Preview } from '@/components/pbb/Step6_Preview';

import { BuilderSteps } from '@/components/pbb/BuilderSteps';
import { usePatternBookBuilder } from '@/hooks/usePatternBookBuilder';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import GenerateBookDialog from '@/components/pbb/GenerateBookDialog';
import { ClassConfiguration } from '@/components/pbb/ClassConfiguration';
import { useAnalytics } from '@/components/AnalyticsProvider';
import { UsageLimitGate } from '@/components/shared/UsageLimitGate';

const steps = [
    { id: 1, name: 'Event Setup', icon: GitMerge },
    { id: 2, name: 'Select Disciplines', icon: ListPlus },
    { id: 3, name: 'Configure Classes', icon: Settings2 },
    { id: 4, name: 'Show Details', icon: Calendar },
    { id: 5, name: 'Pattern Selection', icon: LayoutTemplate },
    { id: 6, name: 'Uploads & Media', icon: UploadCloud },
    { id: 7, name: 'Preview', icon: Eye },
    { id: 8, name: 'Save & Manage', icon: ShieldCheck },
];

const isDisciplineComplete = (pbbDiscipline, isOpenShowMode, allDisciplines = null) => {
    if (!pbbDiscipline) return false;
    const disciplinesToCheck = allDisciplines || [pbbDiscipline];
    // Complete when any discipline has divisions in divisionOrder
    return disciplinesToCheck.some(disc => disc?.divisionOrder?.length > 0);
};


const PatternBookBuilderPage = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isPreviewMode = searchParams.get('mode') === 'preview';
    const isJudgeViewMode = searchParams.get('mode') === 'judgeView';
    const {
        step: currentStep,
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
        resetCurrentStep,
        refreshDisciplineLibrary,
        unlockSection,
        existingProjects,
    } = usePatternBookBuilder(projectId);

    // Locked/Final pattern books are read-only. User must click
    // "Unlock & Save as Draft" on Step 8 to edit them.
    const isProjectLocked = ['Locked', 'Final', 'Lock & Approve Mode', 'Publication']
        .includes(formData.projectStatus);
    const isReadOnly = isPreviewMode || isJudgeViewMode || isProjectLocked;

    const [isSaving, setIsSaving] = useState(false);
    const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
    const [isSaveConfirmationOpen, setIsSaveConfirmationOpen] = useState(false);
    const [showUnlockDialog, setShowUnlockDialog] = useState(false);

    // Lock state: Step 1 is locked after save (unless explicitly unlocked)
    const isStep1Locked = !!formData.lockedSections?.step1 && !isReadOnly;
    const { toast } = useToast();
    const { trackBehaviorEvent, trackPatternEvent } = useAnalytics();
    const sessionStartRef = React.useRef(Date.now());

    // Track when user enters PBB with time tracking
    useEffect(() => {
        sessionStartRef.current = Date.now();
        
        trackBehaviorEvent('pbb_session_start', {
            projectId: projectId || 'new',
            isPreviewMode,
            isJudgeViewMode,
        });

        // Track time spent when leaving PBB
        return () => {
            const timeSpent = Math.round((Date.now() - sessionStartRef.current) / 1000);
            if (timeSpent > 0) {
                trackPatternEvent('pbb_session_end', {
                    patternId: projectId || 'new',
                    timeSpent: timeSpent,
                    discipline: formData.disciplines?.map(d => d.name).join(', '),
                    associationId: Object.keys(formData.associations || {}).filter(k => formData.associations[k]).join(', '),
                });
            }
        };
    }, [projectId, isPreviewMode, isJudgeViewMode]);

    // Track step changes
    useEffect(() => {
        trackBehaviorEvent('pbb_step_change', {
            step: currentStep,
            stepName: steps[currentStep - 1]?.name,
            projectId: projectId || 'new',
        });
    }, [currentStep, projectId]);

    const handleNext = async () => {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
        // Auto-save on step navigation to prevent data loss
        await createOrUpdateProject();
        if (currentStep < steps.length) {
            nextStep();
        }
    };
    const handleBack = async () => {
        if (currentStep > 1) {
            // Auto-save on step navigation to prevent data loss
            await createOrUpdateProject();
            prevStep();
        }
    };

    const handleSaveProject = async () => {
        setIsSaving(true);
        try {
            const savedProjectId = await createOrUpdateProject();
            
            // Calculate time spent since session start
            const timeSpent = Math.round((Date.now() - sessionStartRef.current) / 1000);
            
            // Track save event with time spent
            trackPatternEvent('save', {
                patternId: savedProjectId || projectId,
                associationId: Object.keys(formData.associations || {}).filter(k => formData.associations[k]).join(', '),
                discipline: formData.disciplines?.map(d => d.name).join(', '),
                timeSpent: timeSpent,
            });
            
            trackBehaviorEvent('pbb_project_saved', {
                projectId: savedProjectId || projectId,
                step: currentStep,
                showName: formData.showName,
            });
            
            // Only navigate if we're creating a new project (no projectId before)
            if (savedProjectId && !projectId) {
                navigate(`/pattern-book-builder/${savedProjectId}`, { replace: true });
            }
            // Don't show duplicate toast - it's already shown in the hook
        } catch (error) {
            trackBehaviorEvent('pbb_save_error', {
                projectId: projectId || 'new',
                error: error?.message,
            });
            // Error toast is handled in the hook
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetStep = () => {
        resetCurrentStep(currentStep);
        toast({
            title: 'Step Reset',
            description: `Step ${currentStep} has been reset to default values.`,
        });
    };

    const isNextDisabled = useMemo(() => {
        if (isLoading) return true;
        switch (currentStep) {
            case 1:
                return !formData.showName || !formData.associations || Object.keys(formData.associations).filter(key => formData.associations[key]).length === 0;
            case 2:
                return !(formData.disciplines && formData.disciplines.length > 0);
            case 3:
                const isOpenShowMode = formData.showType === 'open-unaffiliated' || !!formData.associations['open-show'];
                if (!formData.disciplines || formData.disciplines.length === 0) return true;
                
                // Group disciplines by name (same as ClassConfiguration) to handle merged disciplines
                const disciplineGroups = {};
                formData.disciplines.forEach(disc => {
                    const name = disc.name;
                    if (!disciplineGroups[name]) {
                        disciplineGroups[name] = [];
                    }
                    disciplineGroups[name].push(disc);
                });
                
                // Check if all discipline groups are complete
                const allComplete = Object.values(disciplineGroups).every(mergedDisciplines => {
                    const primaryDiscipline = mergedDisciplines[0];
                    return isDisciplineComplete(primaryDiscipline, isOpenShowMode, mergedDisciplines);
                });
                
                return !allComplete;
            case 4:
                return !(formData.showName && formData.startDate);
            case 5:
                return false; // Pattern & Layout validation if needed
            case 6:
                return false; // Uploads & Media is now optional
            case 7:
            case 8:
                return false;
            default:
                return !completedSteps.has(currentStep);
        }
    }, [currentStep, formData, isLoading, completedSteps]);

    // Validation function to check Show Manager and Judge - returns first error found
    const validateStaffAndDelegation = () => {
        // Get all staff members (officials and judges)
        const staff = new Map();
        
        // Add officials (including Show Manager)
        (formData.officials || []).forEach(official => {
            if (official && official.name) {
                staff.set(official.id, {
                    id: official.id,
                    name: official.name,
                    email: official.email,
                    phone: official.phone,
                    role: official.role,
                    delegation: formData.delegations?.[official.id] || { accessPhase: [], roles: [] }
                });
            }
        });
        
        // Add judges from associationJudges
        Object.entries(formData.associationJudges || {}).forEach(([assocId, assocData]) => {
            (assocData.judges || []).forEach((judge, index) => {
                if (judge && judge.name) {
                    const judgeId = `judge-${assocId}-${index}`;
                    staff.set(judgeId, {
                        id: judgeId,
                        name: judge.name,
                        email: judge.email,
                        phone: judge.phone,
                        role: 'Judge',
                        delegation: formData.delegations?.[judgeId] || { accessPhase: [], roles: [] }
                    });
                }
            });
        });
        
        const staffList = Array.from(staff.values());
        
        return null; // All validations passed
    };
    
    const handlePayAndPublish = () => {
        const error = validateStaffAndDelegation();
        if (error) {
            // Only show generic toast if error is not the special flag (flag means specific toasts were already shown)
            if (error !== 'JUDGE_INCOMPLETE_FLAG') {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: error,
                });
            }
            // Don't open dialog when there are errors
            return;
        }
        // Show save confirmation dialog first
        setIsSaveConfirmationOpen(true);
    };

    const handleSaveAndPublish = async () => {
        setIsSaveConfirmationOpen(false);
        setIsSaving(true);
        try {
            const savedProjectId = await createOrUpdateProject();
            
            // Calculate time spent since session start
            const timeSpent = Math.round((Date.now() - sessionStartRef.current) / 1000);
            
            // Track save event with time spent
            trackPatternEvent('save', {
                patternId: savedProjectId || projectId,
                associationId: Object.keys(formData.associations || {}).filter(k => formData.associations[k]).join(', '),
                discipline: formData.disciplines?.map(d => d.name).join(', '),
                timeSpent: timeSpent,
            });
            
            trackBehaviorEvent('pbb_project_saved', {
                projectId: savedProjectId || projectId,
                step: currentStep,
                showName: formData.showName,
            });
            
            // Only navigate if we're creating a new project (no projectId before)
            if (savedProjectId && !projectId) {
                navigate(`/pattern-book-builder/${savedProjectId}`, { replace: true });
            }
            
            toast({
                title: "Project Saved",
                description: "Your project has been saved successfully.",
            });

            // Custom pattern request emails are sent explicitly via the per-request
            // "Send Request" button in Step 6 — no longer auto-sent on save.

            // After saving, open the Generate & Email Pattern Book dialog
            setIsGenerateDialogOpen(true);
        } catch (error) {
            console.error('Error saving project:', error);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: "Failed to save project. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const renderStepContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            );
        }
        const isOpenShowMode = formData.showType === 'open-unaffiliated' || !!formData.associations['open-show'];

        switch (currentStep) {
            case 1: return <Step1_Associations formData={formData} setFormData={setFormData} associationsData={associationsData} onShowTypeChange={handleShowTypeChange} isPBB={true} isReadOnly={isReadOnly} isLocked={isStep1Locked} onUnlock={() => setShowUnlockDialog(true)} existingProjects={existingProjects} />;
            case 2: return <Step2_ClassesAndDivisions formData={formData} setFormData={setFormData} disciplineLibrary={disciplineLibrary} associationsData={associationsData} isReadOnly={isReadOnly} onRefreshDisciplines={refreshDisciplineLibrary} />;
            case 3: return (
                <>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-xl">Step 3: Configure Classes</CardTitle>
                        <CardDescription className="text-sm">Drag to reorder, expand to configure divisions, and group patterns for each class.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ClassConfiguration
                            formData={formData}
                            setFormData={setFormData}
                            isOpenShowMode={isOpenShowMode}
                            associationsData={associationsData}
                            divisionsData={divisionsData}
                            isReadOnly={isReadOnly}
                        />
                    </CardContent>
                </>
            );
            case 4: return <Step3_Details formData={formData} setFormData={setFormData} isReadOnly={isReadOnly} />;
            case 5: return <Step6_PatternAndLayout formData={formData} setFormData={setFormData} associationsData={associationsData} isReadOnly={isReadOnly} />;
            case 6: return <Step4_Uploads formData={formData} setFormData={setFormData} isReadOnly={isReadOnly} />;
            case 7: return <Step6_Preview formData={formData} setFormData={setFormData} isReadOnly={isReadOnly} onGoToStep={setCurrentStep} />;
            case 8: return <Step_CloseOutAndDelegate formData={formData} setFormData={setFormData} isReadOnly={isReadOnly} createOrUpdateProject={createOrUpdateProject} />;
            default: return null;
        }
    };

    return (
        <UsageLimitGate toolName="Pattern Book Builder" projectType="pattern_book" isEditing={!!projectId}>
            <Helmet>
                <title>Pattern Book Builder - EquiPatterns</title>
                <meta name="description" content="Generate a compliant, auto-filled pattern book for your show in minutes." />
            </Helmet>
            <div className="min-h-screen bg-background text-foreground">
                <Navigation />
                <main className="container mx-auto px-4 py-4">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-4">
                        <BookCopy className="mx-auto h-12 w-12 text-primary mb-2" />
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Pattern Book Builder</h1>
                        <p className="mt-2 max-w-2xl mx-auto text-base text-muted-foreground">Generate a compliant, auto-filled pattern book for your show in minutes.</p>
                    </motion.div>
                    <div className="max-w-7xl mx-auto">
                        <BuilderSteps steps={steps} currentStep={currentStep} completedSteps={completedSteps} setCurrentStep={setCurrentStep} isEditMode={!!projectId} />
                        <Card className="glass-effect">
                            <AnimatePresence mode="wait">
                                {currentStep !== 3 ? (
                                    <CardContent className="p-0 sm:p-6">
                                        {renderStepContent()}
                                    </CardContent>
                                ) : (
                                    renderStepContent()
                                )}
                            </AnimatePresence>
                            <CardFooter className="p-4 flex justify-between items-center border-t border-border">
                            {isReadOnly ? (
                                    <>
                                        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="px-3 py-1">
                                                <Eye className="mr-2 h-4 w-4" /> {
                                                    isJudgeViewMode ? 'Judge View (Read Only)'
                                                    : isPreviewMode ? 'Preview Mode (Read Only)'
                                                    : `${formData.projectStatus || 'Locked'} — Unlock on Step 8 to edit`
                                                }
                                            </Badge>
                                            {currentStep < steps.length && (
                                                <Button onClick={handleNext}>
                                                    Next <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                                            {(currentStep <= 5 || currentStep === 8) && (
                                                <Button variant="ghost" size="sm" onClick={handleResetStep} className="text-muted-foreground hover:text-destructive">
                                                    <RotateCcw className="mr-1 h-4 w-4" /> Reset Step
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="secondary" onClick={handleSaveProject} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Save Project
                                            </Button>
                                            {currentStep < steps.length && (
                                                <Button onClick={handleNext} disabled={isNextDisabled}>
                                                    Next <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardFooter>
                        </Card>
                    </div>
                </main>
                <GenerateBookDialog
                    open={isGenerateDialogOpen}
                    onOpenChange={setIsGenerateDialogOpen}
                    pbbData={formData}
                />
                
                {/* Unlock Confirmation Dialog */}
                <ConfirmationDialog
                    isOpen={showUnlockDialog}
                    onClose={() => setShowUnlockDialog(false)}
                    onConfirm={() => {
                        unlockSection('step1');
                        unlockSection('structure');
                        setShowUnlockDialog(false);
                        toast({
                            title: 'Sections Unlocked',
                            description: 'You can now edit locked sections. Save again to persist changes.',
                        });
                    }}
                    title="Unlock Sections?"
                    description="Unlocking may affect saved data. Your existing data will NOT be erased, but changes to associations or class structure could impact pattern selections. Are you sure?"
                    confirmText="Unlock"
                    cancelText="Cancel"
                />

                {/* Save Confirmation Dialog */}
                <Dialog open={isSaveConfirmationOpen} onOpenChange={setIsSaveConfirmationOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save Project First</DialogTitle>
                            <DialogDescription>
                                Please save your project before publishing. This ensures all your changes are saved.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button 
                                variant="outline" 
                                onClick={() => setIsSaveConfirmationOpen(false)}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSaveAndPublish} 
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save & Continue
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </UsageLimitGate>
    );
};

export default PatternBookBuilderPage;