import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useShowBuilder } from '@/hooks/useShowBuilder';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Loader2, Shield, DollarSign, HeartHandshake, Search, Check, Lock } from 'lucide-react';
import { isWizardReadOnly } from '@/lib/moduleStatusService';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { PageHeader } from '@/components/shared/PageHeader';
import { UsageLimitGate } from '@/components/shared/UsageLimitGate';

import { AssociationStep } from '@/components/show-structure/AssociationStep';
import { FeeStructureStep } from '@/components/show-structure/FeeStructureStep';
import { SponsorsStep } from '@/components/show-structure/SponsorsStep';
import { ReviewStep } from '@/components/show-structure/ReviewStep';

const WIZARD_STEPS = [
    { id: 1, name: 'Event Setup', icon: Shield },
    { id: 2, name: 'Fee Structure', icon: DollarSign },
    { id: 3, name: 'Sponsors', icon: HeartHandshake },
    { id: 4, name: 'Save & Manage', icon: Search },
];

const STEP_COMPONENTS = [
    { id: 1, component: AssociationStep },
    { id: 2, component: FeeStructureStep },
    { id: 3, component: SponsorsStep },
    { id: 4, component: ReviewStep },
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

const CreateHorseShowWizardPage = () => {
    const { showId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const {
        formData, setFormData, createOrUpdateShow,
        isLoading: isDataLoading, associationsData, divisionsData, existingProjects,
    } = useShowBuilder(showId);

    const [isSaving, setIsSaving] = useState(false);
    const [currentStep, setCurrentStepState] = useState(1);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [autoSaveStatus, setAutoSaveStatus] = useState(null);
    const autoSaveTimer = useRef(null);
    const lastSavedData = useRef(null);

    // A locked or published section opens read-only.
    const isReadOnly = isWizardReadOnly(formData, 'feeStructure');

    // Auto-save: debounce formData changes
    const performAutoSave = useCallback(async () => {
        if (isReadOnly) return; // a locked section must never write back
        if (!formData.id && !showId) return; // Don't auto-save brand new unsaved shows
        setAutoSaveStatus('saving');
        try {
            await createOrUpdateShow(null, 'feeStructure', 'draft');
            lastSavedData.current = JSON.stringify(formData);
            setAutoSaveStatus('saved');
            setTimeout(() => setAutoSaveStatus(null), 2000);
        } catch {
            setAutoSaveStatus('error');
            setTimeout(() => setAutoSaveStatus(null), 3000);
        }
    }, [createOrUpdateShow, formData, showId, isReadOnly]);

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
        if (isReadOnly) return; // a locked section must never write back
        setIsSaving(true);
        try {
            const project = await createOrUpdateShow(null, 'feeStructure', 'draft');
            lastSavedData.current = JSON.stringify(formData);
            if (project && !showId) {
                navigate(`/horse-show-manager/fee-structure/${project.id}`, { replace: true });
            }
        } catch {
            // Error handled in hook
        } finally {
            setIsSaving(false);
        }
    };

    const CurrentStepComponent = STEP_COMPONENTS.find(s => s.id === currentStep)?.component;

    if (isDataLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <UsageLimitGate toolName="Fee Structure & Sponsors" isEditing={!!showId}>
            <Helmet>
                <title>Fee Structure & Sponsors</title>
                <meta name="description" content="Manage entry fees, stall fees, and sponsorship packages for your horse show." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <PageHeader
                        title="Fee Structure & Sponsors"
                        subtitle={`Step ${currentStep} of ${WIZARD_STEPS.length} — ${WIZARD_STEPS[currentStep - 1]?.name}`}
                        backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'}
                    />

                    {/* Step Indicator */}
                    <StepIndicator
                        currentStep={currentStep}
                        completedSteps={completedSteps}
                        onStepClick={setCurrentStep}
                        isEditMode={!!showId}
                    />

                    {/* Link to Existing Show - only on step 1 */}
                    {currentStep === 1 && !showId && (
                        <LinkToExistingShow
                            existingProjects={existingProjects}
                            linkedProjectId={formData.linkedProjectId || null}
                            onLink={(projectId) => {
                                if (projectId === 'none') {
                                    setFormData(prev => ({ ...prev, linkedProjectId: null }));
                                } else {
                                    // Open the linked show directly instead of copying its fields into
                                    // this unsaved draft — every save from here on updates THAT show,
                                    // rather than creating a second draft with the same name.
                                    navigate(`/horse-show-manager/fee-structure/${projectId}`, { replace: true });
                                }
                            }}
                            onDuplicated={(newProject) => {
                                navigate(`/horse-show-manager/fee-structure/${newProject.id}`, { replace: true });
                            }}
                            description="Link to an existing show to auto-fill fee structure and sponsor details."
                        />
                    )}

                    {isReadOnly && (
                        <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                            <Lock className="h-4 w-4 flex-shrink-0" />
                            <span>This section is locked. Every step is read-only — unlock it on Step 4 (Save &amp; Manage) to edit.</span>
                        </div>
                    )}

                    {/* Step Content */}
                    <Card className={cn('mt-4', isReadOnly && 'opacity-75')}>
                        {/* One disabled fieldset turns off every input on every step at once, so a
                            locked section can never be half-editable. Step 4 (Save & Manage) is
                            exempt — it holds the status controls used to unlock. */}
                        <fieldset disabled={isReadOnly && currentStep !== STEP_COMPONENTS.length} className="min-w-0 m-0 border-0 p-0">
                        <AnimatePresence mode="wait">
                            {CurrentStepComponent && (
                                <CurrentStepComponent
                                    key={currentStep}
                                    formData={formData}
                                    setFormData={setFormData}
                                    setCurrentStep={setCurrentStep}
                                    associationsData={associationsData}
                                    divisionsData={divisionsData}
                                    existingProjects={existingProjects}
                                    isReadOnly={isReadOnly}
                                    // Save & Manage changes status directly — without this the
                                    // unlock would only live in local state and never persist.
                                    onSave={createOrUpdateShow}
                                    variant="create"
                                />
                            )}
                        </AnimatePresence>
                        </fieldset>
                    </Card>

                    {/* Navigation Footer */}
                    {currentStep < STEP_COMPONENTS.length && (
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
                                <Button
                                    variant="outline"
                                    onClick={handleSave}
                                    disabled={isSaving || isReadOnly}
                                    title={isReadOnly ? 'This section is locked — unlock it to make changes' : undefined}
                                >
                                    {isSaving
                                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        : <Save className="mr-2 h-4 w-4" />
                                    }
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                                <Button onClick={nextStep}>
                                    Next
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                    {currentStep === STEP_COMPONENTS.length && (
                        <div className="mt-8">
                            <Button variant="outline" onClick={prevStep}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Previous
                            </Button>
                        </div>
                    )}
                </main>
            </div>
        </UsageLimitGate>
    );
};

export default CreateHorseShowWizardPage;
