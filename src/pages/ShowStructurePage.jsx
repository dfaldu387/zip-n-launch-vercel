import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useShowBuilder } from '@/hooks/useShowBuilder';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Info, User, Trophy, Search, Check, Shield, TrendingDown, CalendarDays, Hash, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { UsageLimitGate } from '@/components/shared/UsageLimitGate';

import { AssociationStep } from '@/components/show-structure/AssociationStep';
import { GeneralVenueStep } from '@/components/show-structure/GeneralVenueStep';
import { OfficialsStaffStep } from '@/components/show-structure/OfficialsStaffStep';
import { ShowExpensesStep } from '@/components/show-structure/ShowExpensesStep';
import { AwardsSponsorshipStep } from '@/components/show-structure/AwardsSponsorshipStep';
import { EntrySchedulingStep } from '@/components/show-structure/EntrySchedulingStep';
import { ReviewStep } from '@/components/show-structure/ReviewStep';


const WIZARD_STEPS = [
    { id: 1, name: 'Event Setup', icon: Shield },
    { id: 2, name: 'General & Venue', icon: Info },
    { id: 3, name: 'Officials & Staff', icon: User },
    { id: 4, name: 'Show Expenses', icon: TrendingDown },
    { id: 5, name: 'Awards', icon: Trophy },
    { id: 6, name: 'General Information', icon: CalendarDays },
    { id: 7, name: 'Save & Manage', icon: Search },
];

const ShowInfoSteps = ({ currentStep, completedSteps, setCurrentStep }) => {
    return (
        <div className="flex justify-between items-start mb-8 px-4 overflow-x-auto pb-4">
            {WIZARD_STEPS.map((step, index) => {
                const isCompleted = completedSteps.has(step.id);
                const isActive = currentStep === step.id;
                return (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center text-center w-24 cursor-pointer flex-shrink-0" onClick={() => setCurrentStep(step.id)}>
                            <div className={cn(
                                'w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                                isActive ? 'bg-primary border-primary text-primary-foreground' : 'bg-secondary border-border text-muted-foreground',
                                isCompleted && !isActive && 'bg-green-600 border-green-600 text-white'
                            )}>
                                {isCompleted && !isActive ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                            </div>
                            <p className={cn(
                                'mt-2 text-xs font-medium',
                                isActive ? 'text-foreground' : 'text-muted-foreground',
                                isCompleted && !isActive && 'text-green-600'
                            )}>
                                {step.name}
                            </p>
                        </div>
                        {index < WIZARD_STEPS.length - 1 && (<div className={`flex-1 h-1 mt-5 mx-1 rounded-full transition-colors duration-300 ${isCompleted && completedSteps.has(step.id + 1) ? 'bg-green-600' : (currentStep > index + 1 ? 'bg-primary' : 'bg-border')}`} />)}
                    </React.Fragment>
                )
            })}
        </div>
    );
};


const ShowStructurePage = () => {
    const { showId } = useParams();
    const navigate = useNavigate();
    const { formData, setFormData, createOrUpdateShow, isLoading: isDataLoading, associationsData, divisionsData, existingProjects } = useShowBuilder(showId);
    const [isSaving, setIsSaving] = useState(false);
    const [currentStep, setCurrentStepState] = useState(1);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const lastSavedDataRef = useRef(null);

    // Track unsaved changes by comparing formData to last saved snapshot
    useEffect(() => {
        if (!isDataLoading && lastSavedDataRef.current !== null) {
            const changed = JSON.stringify(formData) !== JSON.stringify(lastSavedDataRef.current);
            setHasUnsavedChanges(changed);
        }
    }, [formData, isDataLoading]);

    // Set initial snapshot after data loads
    useEffect(() => {
        if (!isDataLoading) {
            lastSavedDataRef.current = { ...formData };
        }
    }, [isDataLoading]);

    // Browser close / tab close warning
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const setCurrentStep = (stepNumber) => {
        setCompletedSteps(prev => new Set([...prev, currentStep]));
        setCurrentStepState(stepNumber);
    };

    const steps = [
        { id: 1, component: AssociationStep },
        { id: 2, component: GeneralVenueStep },
        { id: 3, component: OfficialsStaffStep },
        { id: 4, component: ShowExpensesStep },
        { id: 5, component: AwardsSponsorshipStep },
        { id: 6, component: EntrySchedulingStep },
        { id: 7, component: ReviewStep },
    ];

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            const project = await createOrUpdateShow(null, 'showStructure', 'draft');
            if (project) {
                lastSavedDataRef.current = { ...formData };
                setHasUnsavedChanges(false);
                if (!showId) {
                    navigate(`/horse-show-manager/show-structure-expenses/${project.id}`, { replace: true });
                }
            }
        } catch (error) {
            // Error is handled in hook
        } finally {
            setIsSaving(false);
        }
    }, [createOrUpdateShow, formData, showId, navigate]);

    // Auto-save on Next
    const nextStep = useCallback(async () => {
        setCompletedSteps(prev => new Set([...prev, currentStep]));

        // Auto-save in the background
        try {
            const project = await createOrUpdateShow(null, 'showStructure', 'draft');
            if (project) {
                lastSavedDataRef.current = { ...formData };
                setHasUnsavedChanges(false);
                if (!showId && project.id) {
                    navigate(`/horse-show-manager/show-structure-expenses/${project.id}`, { replace: true });
                }
            }
        } catch {
            // Save failed silently — user can still proceed
        }

        if (currentStep < steps.length) {
            setCurrentStepState(prev => prev + 1);
        }
    }, [currentStep, steps.length, createOrUpdateShow, formData, showId, navigate]);

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStepState(prev => prev - 1);
        }
    };

    const CurrentStepComponent = steps.find(s => s.id === currentStep)?.component;

    if (isDataLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <UsageLimitGate toolName="Show Structure & Expenses" isEditing={!!showId}>
            <Helmet>
                <title>Show Structure & Expenses</title>
                <meta name="description" content="Manage all operational costs and structure for your horse show." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <PageHeader title="Show Structure & Expenses" backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'} />

                    <ShowInfoSteps
                        currentStep={currentStep}
                        completedSteps={completedSteps}
                        setCurrentStep={setCurrentStep}
                    />

                    {currentStep === 1 && !showId && (
                        <LinkToExistingShow
                            existingProjects={existingProjects}
                            linkedProjectId={formData.linkedProjectId || null}
                            onLink={(projectId) => {
                                if (projectId === 'none') {
                                    setFormData(prev => ({ ...prev, linkedProjectId: null }));
                                } else {
                                    const project = existingProjects.find(p => p.id === projectId);
                                    const pd = project?.project_data || {};
                                    const arenasList = pd.arenas || prev.arenas || [];
                                    setFormData(prev => ({
                                        ...prev,
                                        linkedProjectId: projectId,
                                        showName: pd.showName || prev.showName,
                                        showNumber: pd.showNumber || prev.showNumber,
                                        associations: pd.associations || prev.associations,
                                        customAssociations: pd.customAssociations || prev.customAssociations,
                                        disciplines: pd.disciplines || prev.disciplines,
                                        startDate: pd.startDate || prev.startDate,
                                        endDate: pd.endDate || prev.endDate,
                                        venueAddress: pd.venueAddress || prev.venueAddress,
                                        venueName: pd.venueName || prev.venueName,
                                        arenas: arenasList,
                                        officials: pd.officials || prev.officials,
                                        staff: pd.staff || prev.staff,
                                        sponsorLevels: pd.sponsorLevels || prev.sponsorLevels,
                                        sponsors: pd.sponsors || prev.sponsors,
                                        classSponsors: pd.classSponsors || prev.classSponsors,
                                        arenaSponsors: pd.arenaSponsors || prev.arenaSponsors,
                                        customSponsors: pd.customSponsors || prev.customSponsors,
                                        showExpenses: pd.showExpenses || prev.showExpenses,
                                        awardExpenses: pd.awardExpenses || prev.awardExpenses,
                                        classAwards: pd.classAwards || prev.classAwards,
                                        fees: pd.fees || prev.fees,
                                        showDetails: {
                                            ...(pd.showDetails || prev.showDetails || {}),
                                            venue: {
                                                ...(pd.showDetails?.venue || prev.showDetails?.venue || {}),
                                                facilityName: pd.venueName || pd.showDetails?.venue?.facilityName || prev.showDetails?.venue?.facilityName || '',
                                                address: pd.venueAddress || pd.showDetails?.venue?.address || prev.showDetails?.venue?.address || '',
                                                numberOfArenas: String(arenasList.length || prev.showDetails?.venue?.numberOfArenas || 0),
                                                arenas: arenasList.map((a, i) => ({
                                                    id: a.id || `arena-${i}`,
                                                    name: a.name || `Arena ${i + 1}`,
                                                })),
                                            },
                                        },
                                    }));
                                }
                            }}
                            onDuplicated={(newProject) => {
                                navigate(`/horse-show-manager/show-structure-expenses/${newProject.id}`, { replace: true });
                            }}
                            description="Link to an existing show to auto-fill structure and expense details."
                        />
                    )}

                    <Card className="mt-8">
                        <AnimatePresence mode="wait">
                            {CurrentStepComponent && <CurrentStepComponent
                                key={currentStep}
                                formData={formData}
                                setFormData={setFormData}
                                setCurrentStep={setCurrentStep}
                                associationsData={associationsData}
                                divisionsData={divisionsData}
                                existingProjects={existingProjects}
                                onSave={createOrUpdateShow}
                            />}
                        </AnimatePresence>
                    </Card>

                    {currentStep < steps.length && (
                        <div className="mt-8 flex justify-between items-center">
                            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                                <Button onClick={nextStep} disabled={isSaving}>
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                    {currentStep === steps.length && (
                        <div className="mt-8">
                            <Button variant="outline" onClick={prevStep}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                        </div>
                    )}
                </main>
            </div>
        </UsageLimitGate>
    );
};

export default ShowStructurePage;
