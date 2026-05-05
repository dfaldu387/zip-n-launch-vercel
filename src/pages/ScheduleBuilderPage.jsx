import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useShowBuilder } from '@/hooks/useShowBuilder';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Loader2, Shield, ListPlus, Settings2, Info, LayoutGrid, CalendarDays, Palette, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { PageHeader } from '@/components/shared/PageHeader';

import { Step1_ShowAssociations } from '@/components/show-builder/Step1_ShowAssociations';
import { Step2_ClassesAndDivisions } from '@/components/pbb/Step2_ClassesAndDivisions';
import { ClassConfiguration } from '@/components/pbb/ClassConfiguration';
import { Step4_ShowDetails } from '@/components/show-builder/Step4_ShowDetails';
import { Step3_ArenasAndDates } from '@/components/show-builder/Step3_ArenasAndDates';
import { Step5_Schedule } from '@/components/show-builder/Step5_Schedule';
import { Step7_ScheduleLayout } from '@/components/show-builder/Step7_ScheduleLayout';
import { Step6_Preview } from '@/components/show-builder/Step6_Preview';

const WIZARD_STEPS = [
    { id: 1, name: 'Event Setup', icon: Shield },
    { id: 2, name: 'Select Disciplines', icon: ListPlus },
    { id: 3, name: 'Configure Classes', icon: Settings2 },
    { id: 4, name: 'Show Details', icon: Info },
    { id: 5, name: 'Arenas & Dates', icon: LayoutGrid },
    { id: 6, name: 'Organize Schedule', icon: CalendarDays },
    { id: 7, name: 'Schedule Layout', icon: Palette },
    { id: 8, name: 'Save & Manage', icon: Search },
];

const STEP_COMPONENTS = [
    { id: 1, component: Step1_ShowAssociations },
    { id: 2, component: Step2_ClassesAndDivisions },
    { id: 3, component: 'ClassConfiguration' },
    { id: 4, component: Step4_ShowDetails },
    { id: 5, component: Step3_ArenasAndDates, props: { stepNumber: 5, stepTitle: 'Arenas & Dates' } },
    { id: 6, component: Step5_Schedule, props: { stepNumber: 6, stepTitle: 'Organize Schedule' } },
    { id: 7, component: Step7_ScheduleLayout },
    { id: 8, component: Step6_Preview, props: { stepNumber: 8, stepTitle: 'Save & Manage' } },
];

const StepIndicator = ({ currentStep, completedSteps, onStepClick, isEditMode = false }) => {
    const nextStepId = (() => {
        for (const step of WIZARD_STEPS) {
            if (!completedSteps.has(step.id)) return step.id;
        }
        return WIZARD_STEPS[WIZARD_STEPS.length - 1]?.id;
    })();

    return (
        <div className="flex items-start mb-8 w-full">
            {WIZARD_STEPS.map((step, index) => {
                const isCompleted = completedSteps.has(step.id);
                const isActive = currentStep === step.id;
                const isNavigable = isEditMode || isCompleted || isActive || step.id === nextStepId;
                return (
                    <React.Fragment key={step.id}>
                        <div
                            className={cn(
                                'flex flex-col items-center text-center flex-1',
                                isNavigable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            )}
                            onClick={() => isNavigable && onStepClick(step.id)}
                        >
                            <div className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                                isActive ? 'bg-primary border-primary text-primary-foreground' : 'bg-secondary border-border text-muted-foreground',
                                isCompleted && !isActive && 'bg-green-600 border-green-600 text-white'
                            )}>
                                {isCompleted ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                            </div>
                            <p className={cn(
                                'mt-2 text-xs font-medium leading-tight',
                                isActive ? 'text-foreground' : 'text-muted-foreground',
                                isCompleted && !isActive && 'text-green-600'
                            )}>
                                {step.name}
                            </p>
                        </div>
                        {index < WIZARD_STEPS.length - 1 && (
                            <div className={cn(
                                'w-full h-0.5 mt-5 rounded-full transition-colors duration-300',
                                isCompleted && completedSteps.has(WIZARD_STEPS[index + 1]?.id)
                                    ? 'bg-green-600'
                                    : currentStep > WIZARD_STEPS[index + 1]?.id
                                        ? 'bg-primary'
                                        : 'bg-border'
                            )} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const AUTO_SAVE_DELAY = 3000;

const ScheduleBuilderPage = () => {
    const { showId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const {
        formData, setFormData, createOrUpdateShow,
        isLoading: isDataLoading, associationsData, divisionsData, existingProjects,
        disciplineLibrary, resetDisciplines, refreshDisciplineLibrary,
    } = useShowBuilder(showId);

    const [isSaving, setIsSaving] = useState(false);
    const [currentStep, setCurrentStepState] = useState(1);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [autoSaveStatus, setAutoSaveStatus] = useState(null);
    const autoSaveTimer = useRef(null);
    const lastSavedData = useRef(null);

    const performAutoSave = useCallback(async () => {
        if (!formData.id && !showId) return;
        setAutoSaveStatus('saving');
        try {
            await createOrUpdateShow(null, 'scheduleBuilder', 'draft');
            lastSavedData.current = JSON.stringify(formData);
            setAutoSaveStatus('saved');
            setTimeout(() => setAutoSaveStatus(null), 2000);
        } catch {
            setAutoSaveStatus('error');
            setTimeout(() => setAutoSaveStatus(null), 3000);
        }
    }, [createOrUpdateShow, formData, showId]);

    useEffect(() => {
        const currentData = JSON.stringify(formData);
        if (lastSavedData.current === currentData) return;
        if (!formData.id && !showId) return;

        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(performAutoSave, AUTO_SAVE_DELAY);

        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        };
    }, [formData, performAutoSave, showId]);

    const setCurrentStep = (stepNumber) => {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
        setCurrentStepState(stepNumber);
    };

    const nextStep = () => {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
        if (currentStep < STEP_COMPONENTS.length) {
            setCurrentStepState(prev => prev + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStepState(prev => prev - 1);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const project = await createOrUpdateShow(null, 'scheduleBuilder', 'draft');
            lastSavedData.current = JSON.stringify(formData);
            if (project && !showId) {
                navigate(`/horse-show-manager/schedule-builder/${project.id}`, { replace: true });
            }
        } catch {
            // Error handled in hook
        } finally {
            setIsSaving(false);
        }
    };

    const currentStepConfig = STEP_COMPONENTS.find(s => s.id === currentStep);
    const CurrentStepComponent = currentStepConfig?.component;
    const currentStepProps = currentStepConfig?.props || {};
    const isClassConfig = CurrentStepComponent === 'ClassConfiguration';

    if (isDataLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Horse Show Schedule Builder</title>
                <meta name="description" content="Build your horse show schedule step-by-step." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <PageHeader
                        title="Horse Show Schedule Builder"
                        subtitle={`Step ${currentStep} of ${WIZARD_STEPS.length} — ${WIZARD_STEPS[currentStep - 1]?.name}`}
                        backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'}
                    />

                    <StepIndicator
                        currentStep={currentStep}
                        completedSteps={completedSteps}
                        onStepClick={setCurrentStep}
                        isEditMode={!!showId}
                    />

                    {!showId && (
                        <LinkToExistingShow
                            existingProjects={existingProjects}
                            linkedProjectId={formData.linkedProjectId || null}
                            onLink={(projectId) => {
                                if (projectId === 'none') {
                                    setFormData(prev => ({ ...prev, linkedProjectId: null }));
                                } else {
                                    const project = existingProjects.find(p => p.id === projectId);
                                    const pd = project?.project_data || {};
                                    setFormData(prev => ({
                                        ...prev,
                                        linkedProjectId: projectId,
                                        showName: pd.showName || prev.showName,
                                        showNumber: pd.showNumber || prev.showNumber,
                                        associations: pd.associations || prev.associations,
                                        customAssociations: pd.customAssociations || prev.customAssociations,
                                        primaryAffiliates: pd.primaryAffiliates || prev.primaryAffiliates,
                                        subAssociationSelections: pd.subAssociationSelections || prev.subAssociationSelections,
                                        disciplines: pd.disciplines || prev.disciplines,
                                        startDate: pd.startDate || prev.startDate,
                                        endDate: pd.endDate || prev.endDate,
                                        venueAddress: pd.venueAddress || prev.venueAddress,
                                        venueName: pd.venueName || prev.venueName,
                                        arenas: pd.arenas || prev.arenas,
                                        officials: pd.officials || prev.officials,
                                        staff: pd.staff || prev.staff,
                                    }));
                                    // Silent link — no popup
                                }
                            }}
                            onDuplicated={(newProject) => {
                                navigate(`/horse-show-manager/schedule-builder/${newProject.id}`, { replace: true });
                            }}
                            description="Link to an existing show or pattern book to auto-fill details, or duplicate a previous show."
                        />
                    )}

                    <Card className="mt-4">
                        <AnimatePresence mode="wait">
                            {isClassConfig ? (
                                <div key={currentStep}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-xl">Step 3: Configure Classes</CardTitle>
                                        <CardDescription className="text-sm">Drag to reorder, expand to configure divisions, and group patterns for each class.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ClassConfiguration
                                            formData={formData}
                                            setFormData={setFormData}
                                            isOpenShowMode={formData.showType === 'open-unaffiliated' || !!formData.associations?.['open-show']}
                                            associationsData={associationsData}
                                            divisionsData={divisionsData}
                                        />
                                    </CardContent>
                                </div>
                            ) : CurrentStepComponent ? (
                                <CurrentStepComponent
                                    key={currentStep}
                                    formData={formData}
                                    setFormData={setFormData}
                                    setCurrentStep={setCurrentStep}
                                    associationsData={associationsData}
                                    divisionsData={divisionsData}
                                    existingProjects={existingProjects}
                                    disciplineLibrary={disciplineLibrary}
                                    resetDisciplines={resetDisciplines}
                                    createOrUpdateShow={createOrUpdateShow}
                                    onRefreshDisciplines={refreshDisciplineLibrary}
                                    showTimedAdditional={true}
                                    {...currentStepProps}
                                />
                            ) : null}
                        </AnimatePresence>
                    </Card>

                    <div className="mt-8 flex justify-between items-center">
                        <Button
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStep === 1}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Previous
                        </Button>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                                {isSaving
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <Save className="mr-2 h-4 w-4" />
                                }
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                            {currentStep < STEP_COMPONENTS.length ? (
                                <Button onClick={nextStep}>
                                    Next
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={async () => {
                                        setIsSaving(true);
                                        try {
                                            const project = await createOrUpdateShow(null, 'scheduleBuilder', 'draft');
                                            lastSavedData.current = JSON.stringify(formData);
                                            const id = project?.id || showId || formData.id;
                                            toast({ title: 'Schedule Saved!', description: 'Your show schedule has been saved successfully.' });
                                            if (id) {
                                                navigate(`/horse-show-manager/schedule-builder/${id}`, { replace: true });
                                            }
                                        } catch {
                                            // Error handled in hook
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={isSaving}
                                >
                                    {isSaving
                                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        : <Check className="mr-2 h-4 w-4" />
                                    }
                                    Finish & Save
                                </Button>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
};

export default ScheduleBuilderPage;
