import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Info, GitMerge, ListPlus, Settings2, LayoutTemplate, Eye, ArrowLeft, ArrowRight, Save, Download, FileText, CheckCircle, CheckSquare, Square, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

import { StepContainer } from './StepContainer';
import { usePatternHub } from '@/hooks/usePatternHub';
import { Step1_Associations } from '@/components/pbb/Step1_Associations';
import { Step2_ClassesAndDivisions } from '@/components/pbb/Step2_ClassesAndDivisions';
import { ClassConfiguration } from '@/components/pbb/ClassConfiguration';
import { Step6_PatternAndLayout } from '@/components/pbb/Step6_PatternAndLayout';
import { Step6_Preview } from '@/components/pbb/Step6_Preview';

import { BuilderSteps } from '@/components/pbb/BuilderSteps';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generatePatternBookPdf } from '@/lib/bookGenerator';

// All possible steps — matches Pattern Book Builder flow
// Step 5 (Uploads & Media) removed per client request
const ALL_STEPS = [
  { id: 0, name: 'Usage Purpose', icon: Info },
  { id: 1, name: 'Event Setup', icon: GitMerge },
  { id: 2, name: 'Select Disciplines', icon: ListPlus },
  { id: 3, name: 'Configure Classes', icon: Settings2 },
  { id: 4, name: 'Pattern Selection', icon: LayoutTemplate },
  { id: 5, name: 'Preview Pattern', icon: Eye },
  { id: 6, name: 'Generate', icon: Download },
];

const UsagePurposeStep = ({ setFormData, usageType, usagePurposes, isLoadingPurposes }) => {
    const getShowName = (type) => {
        if (type === 'horse_show') return 'equipatterns.com - Horse Show Patterns';
        if (type === 'clinic') return '';
        if (type === 'just_for_fun') return 'equipatterns.com - Choose a Pattern';
        return 'equipatterns.com - Choose a Pattern';
    };

    return (
        <StepContainer title="Purpose" description="Select how you intend to use the patterns or score sheets you're looking for.">
            {isLoadingPurposes ? (
                <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="usage-type">Purpose</Label>
                    <Select onValueChange={(value) => setFormData(prev => ({ ...prev, usageType: value, showName: getShowName(value) }))} value={usageType}>
                        <SelectTrigger id="usage-type" className="w-full">
                            <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                            {usagePurposes.map(purpose => (
                                <SelectItem key={purpose.id} value={purpose.id}>{purpose.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </StepContainer>
    );
};

const GenerateStep = ({ isGenerated, isSaved, formData, setFormData, onSave, isSaving, onGenerate, isGenerating, onGoToProjects, onDownloadAgain }) => {
    // Extract pattern summary from formData
    const patternSummary = useMemo(() => {
        const summaries = [];
        const disciplines = formData?.disciplines?.filter(d => d.pattern) || [];
        for (const disc of disciplines) {
            const groups = disc.patternGroups || [];
            for (const group of groups) {
                const selection = formData?.patternSelections?.[disc.id]?.[group.id];
                if (selection?.patternId) {
                    const divisions = (group.divisions || []).map(d => d.division).filter(Boolean);
                    const categories = [...new Set((group.divisions || []).map(d => d.category).filter(Boolean))];
                    summaries.push({
                        patternName: selection.patternName || selection.patternId,
                        customLabel: group.customLabel || '',
                        discipline: disc.name || disc.label || 'Unknown',
                        divisions,
                        categories,
                    });
                }
            }
        }
        return summaries;
    }, [formData]);

    const downloadIncludes = formData?.downloadIncludes || { pattern: true, scoresheet: true };

    const toggleInclude = (key) => {
        setFormData(prev => ({
            ...prev,
            downloadIncludes: {
                ...prev.downloadIncludes,
                [key]: !prev.downloadIncludes?.[key],
            },
        }));
    };

    return (
        <motion.div key="step-generate" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader className="pb-3">
                <CardTitle className="text-xl">{isGenerated ? 'Pattern Generated Successfully' : 'Generate Pattern'}</CardTitle>
                <CardDescription className="text-sm">
                    {isGenerated
                        ? 'Your pattern has been downloaded and saved to My Projects.'
                        : 'Your pattern is ready. Select what to include and generate.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isGenerated ? (
                    <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center space-y-6">
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-semibold">Pattern Generated Successfully</p>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Your pattern PDF has been downloaded and saved to My Projects.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button onClick={onGoToProjects} className="gap-2">
                                <FolderOpen className="h-4 w-4" />
                                Go to My Projects
                            </Button>
                            <Button variant="outline" onClick={onDownloadAgain} className="gap-2">
                                <Download className="h-4 w-4" />
                                Download Again
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Pattern Summary */}
                        {patternSummary.length > 0 && (
                            <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3">
                                <p className="text-sm font-semibold text-foreground">Pattern Summary</p>
                                {patternSummary.map((item, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                            <span className="text-sm font-medium">{item.patternName}</span>
                                            {item.customLabel && (
                                                <Badge variant="outline" className="text-xs">{item.customLabel}</Badge>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                                            <Badge variant="secondary" className="text-xs">{item.discipline}</Badge>
                                            {item.categories.map((cat, i) => (
                                                <Badge key={`cat-${i}`} variant="outline" className="text-xs">{cat}</Badge>
                                            ))}
                                            {item.divisions.map((div, i) => (
                                                <Badge key={`div-${i}`} variant="outline" className="text-xs">{div}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* What to Include */}
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-foreground">What to include</p>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                <button
                                    type="button"
                                    onClick={() => toggleInclude('pattern')}
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
                                >
                                    {downloadIncludes.pattern ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                                    Pattern
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleInclude('scoresheet')}
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
                                >
                                    {downloadIncludes.scoresheet ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                                    Score Sheet
                                </button>
                            </div>
                        </div>

                        {/* Save first, then Generate & Download */}
                        {!isSaved ? (
                            <div className="space-y-2">
                                <Button
                                    onClick={onSave}
                                    disabled={isSaving}
                                    className="w-full gap-2"
                                    size="lg"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-5 w-5" />
                                            Save Project
                                        </>
                                    )}
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                    Complete all steps and save your project to enable download.
                                </p>
                            </div>
                        ) : (
                            <Button
                                onClick={onGenerate}
                                disabled={isGenerating}
                                className="w-full gap-2"
                                size="lg"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-5 w-5" />
                                        Generate & Download
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </motion.div>
    );
};

export const PatternHub = ({ projectId }) => {
    const { toast } = useToast();
    const {
        currentStep, setCurrentStep,
        formData, setFormData,
        isLoading,
        disciplineLibrary,
        associationsData,
        divisionsData,
        usagePurposes,
        resetDisciplines,
        highestStepReached,
        setHighestStepReached,
    } = usePatternHub(projectId);

    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(!!projectId); // existing projects are already saved
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGenerated, setIsGenerated] = useState(false);
    const [lastPdfBlob, setLastPdfBlob] = useState(null);

    const isClinic = formData.usageType === 'clinic';
    const isOpenShowMode = formData.showType === 'open-unaffiliated' || !!formData.associations['open-show'];

    // Skip "Configure Classes" step for non-Horse Show usage types
    const isHorseShow = formData.usageType === 'horse_show';
    const hubSteps = useMemo(() => {
        const steps = isHorseShow ? ALL_STEPS : ALL_STEPS.filter(s => s.id !== 3);
        return steps.map((s, i) => ({ ...s, displayNumber: i }));
    }, [isHorseShow]);

    // Map step ID to 1-indexed display number for content titles
    const getDisplayStepNumber = (stepId) => {
        const step = hubSteps.find(s => s.id === stepId);
        return step ? step.displayNumber + 1 : stepId + 1;
    };

    // Find the max step ID in the current flow
    const maxStepId = hubSteps[hubSteps.length - 1]?.id ?? 5;

    const handleNext = () => {
        // Auto-fill show name if user left it blank on the Event Setup step
        if (currentStep === 1 && !formData.showName?.trim()) {
            const defaultName = formData.usageType === 'horse_show'
                ? 'equipatterns.com - Horse Show Patterns'
                : formData.usageType === 'clinic'
                    ? 'Untitled Clinic'
                    : 'equipatterns.com - Choose a Pattern';
            setFormData(prev => ({ ...prev, showName: defaultName }));
        }

        const currentIndex = hubSteps.findIndex(s => s.id === currentStep);
        const nextStep = hubSteps[currentIndex + 1];
        if (nextStep) {
            setCurrentStep(nextStep.id);
            if (nextStep.id > highestStepReached) {
                setHighestStepReached(nextStep.id);
            }
        }
    };

    const handleBack = () => {
        const currentIndex = hubSteps.findIndex(s => s.id === currentStep);
        const prevStep = hubSteps[currentIndex - 1];
        if (prevStep) setCurrentStep(prevStep.id);
    };

    const handleSaveProject = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({
                    title: "Authentication Required",
                    description: "Please log in to save your project.",
                    variant: "destructive",
                });
                return;
            }

            // Check if all steps are complete (skip step 3 for non-horse-show, matching the UI flow)
            const isStep0Complete = !!formData.usageType;
            const isStep1Complete = Object.values(formData.associations || {}).some(val => val);
            const isStep2Complete = formData.disciplines.length > 0;
            const isStep3Complete = !isHorseShow || ((formData.disciplines || []).length > 0 &&
                (formData.disciplines || []).every(d => (d.divisionOrder || []).length > 0));
            const isStep4Complete = (() => {
                const patternDisciplines = formData.disciplines.filter(d => d.pattern);
                if (patternDisciplines.length === 0) return true;
                return patternDisciplines.every(pbbDiscipline => {
                    const groups = pbbDiscipline.patternGroups || [];
                    if (groups.length === 0) return true;
                    return groups.some(group =>
                        !!formData.patternSelections?.[pbbDiscipline.id]?.[group.id]?.patternId
                    );
                });
            })();

            const allStepsComplete = isStep0Complete && isStep1Complete && isStep2Complete &&
                                     isStep3Complete && isStep4Complete;

            const status = allStepsComplete ? 'Draft' : 'In progress';

            const { id: formDataId, ...formDataToSave } = formData;

            const projectData = {
                project_name: isClinic
                    ? (formData.showName || 'Untitled Clinic')
                    : (formData.showName || 'Untitled Pattern Hub Project'),
                project_type: 'pattern_hub',
                project_data: {
                    ...formDataToSave,
                    currentStep: currentStep,
                    completedSteps: Array.from(completedSteps),
                },
                user_id: user.id,
                status: status,
            };

            if (projectId && projectId !== 'undefined') {
                projectData.id = projectId;
            } else if (formDataId) {
                projectData.id = formDataId;
            } else {
                // No existing project ID — check if a project with this name already exists
                // to prevent creating duplicates
                const projectName = projectData.project_name;
                const { data: existingProject } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('project_type', 'pattern_hub')
                    .eq('user_id', user.id)
                    .ilike('project_name', projectName)
                    .limit(1)
                    .single();

                if (existingProject) {
                    projectData.id = existingProject.id;
                }
            }

            const { error } = await supabase
                .from('projects')
                .upsert(projectData, { onConflict: 'id' })
                .select();

            if (error) throw error;

            setIsSaved(true);
            toast({
                title: "Project Saved",
                description: 'Your project has been saved. You can now generate and download.',
            });
        } catch (error) {
            toast({
                title: "Error Saving",
                description: error.message || "Failed to save project. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Helper: convert data URI to Blob for reliable downloads
    const dataUriToBlob = (dataUri) => {
        const [header, base64] = dataUri.split(',');
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    };

    const triggerDownload = (blob, fileName) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const fileName = (formData.showName || 'Pattern').replace(/ /g, '_');
            toast({ title: 'Generating PDF...', description: 'Your pattern is being created.' });

            const pdfDataUri = await generatePatternBookPdf(formData, { skipCoverAndToc: true });
            const blob = dataUriToBlob(pdfDataUri);

            // Download the PDF
            triggerDownload(blob, `${fileName}.pdf`);

            // Keep blob for "Download Again"
            setLastPdfBlob(blob);

            setIsGenerated(true);
            toast({ title: 'Success!', description: 'Your pattern has been downloaded and saved to My Projects.' });
        } catch (error) {
            console.error('Failed to generate pattern:', error);
            toast({
                variant: 'destructive',
                title: 'Generation Failed',
                description: error.message || 'There was a problem generating your pattern.',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadAgain = () => {
        const fileName = (formData.showName || 'Pattern').replace(/ /g, '_');
        if (lastPdfBlob) {
            triggerDownload(lastPdfBlob, `${fileName}.pdf`);
            toast({ title: 'Downloaded!', description: 'Your pattern PDF has been downloaded again.' });
        } else {
            // Re-generate if blob was lost
            handleGenerate();
        }
    };

    const handleGoToProjects = () => {
        navigate('/customer-portal');
    };

    const renderStepContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            );
        }

        switch (currentStep) {
            case 0:
                return <UsagePurposeStep setFormData={setFormData} usageType={formData.usageType} usagePurposes={usagePurposes} isLoadingPurposes={isLoading} />;
            case 1:
                return (
                    <Step1_Associations
                      formData={formData}
                      setFormData={setFormData}
                      associationsData={associationsData}
                      onShowTypeChange={resetDisciplines}
                      isHub={true}
                      stepNumber={getDisplayStepNumber(1)}
                      selectedPurposeName={usagePurposes.find(p => p.id === formData.usageType)?.name || 'Pattern'}
                    />
                );
            case 2:
                return (
                    <Step2_ClassesAndDivisions formData={formData} setFormData={setFormData} disciplineLibrary={disciplineLibrary} associationsData={associationsData} stepNumber={getDisplayStepNumber(2)} isHubMode={true} maxDisciplines={2} />
                );
            case 3:
                return (
                    <ClassConfiguration
                      formData={formData}
                      setFormData={setFormData}
                      isOpenShowMode={isOpenShowMode}
                      associationsData={associationsData}
                      divisionsData={divisionsData}
                    />
                );
            case 4:
                return (
                    <Step6_PatternAndLayout formData={formData} setFormData={setFormData} associationsData={associationsData} stepNumber={getDisplayStepNumber(4)} isClinicMode={formData.usageType === 'clinic'} isHubMode={true} />
                );
            case 5:
                return (
                    <Step6_Preview formData={formData} setFormData={setFormData} isEducationMode={false} stepNumber={getDisplayStepNumber(5)} purposeName={isClinic ? 'Clinic Materials' : null} isHubMode={true} />
                );
            case 6:
                return <GenerateStep isGenerated={isGenerated} isSaved={isSaved} formData={formData} setFormData={setFormData} onSave={handleSaveProject} isSaving={isSaving} onGenerate={handleGenerate} isGenerating={isGenerating} onGoToProjects={handleGoToProjects} onDownloadAgain={handleDownloadAgain} />;
            default:
                return null;
        }
    };

    // Check if current step requirements are met
    const isCurrentStepComplete = useMemo(() => {
        switch (currentStep) {
            case 0:
                return !!formData.usageType;
            case 1: {
                const hasAssociation = Object.values(formData.associations || {}).some(val => val);
                // Clinic requires Clinic Number (stored in showName)
                if (isClinic) return hasAssociation && !!formData.showName?.trim();
                return hasAssociation;
            }
            case 2:
                return formData.disciplines.length > 0;
            case 3: {
                // Configure Classes — each discipline must have divisions selected
                // and pattern disciplines must have all divisions in pattern groups
                const discs = formData.disciplines || [];
                if (discs.length === 0) return false;
                return discs.every(d => {
                    const hasDivisions = (d.divisionOrder || []).length > 0;
                    if (!hasDivisions) return false;
                    if (!d.pattern) return true;
                    // Pattern disciplines: every division must be in a patternGroup
                    const groupedDivIds = new Set(
                        (d.patternGroups || []).flatMap(g => (g.divisions || []).map(div => div.id))
                    );
                    return (d.divisionOrder || []).every(divId => groupedDivIds.has(divId));
                });
            }
            case 4: {
                const patternDisciplines = formData.disciplines.filter(d => d.pattern);
                if (patternDisciplines.length === 0) return true;
                return patternDisciplines.every(pbbDiscipline => {
                    const groups = pbbDiscipline.patternGroups || [];
                    if (groups.length === 0) return true;
                    return groups.some(group =>
                        !!formData.patternSelections?.[pbbDiscipline.id]?.[group.id]?.patternId
                    );
                });
            }
            case 5:
                return true; // Preview always completable
            case 6:
                return true; // Generate step
            default:
                return false;
        }
    }, [currentStep, formData]);

    // Steps are completed only if they've been passed through
    const completedSteps = useMemo(() => {
        const completed = new Set();
        for (let i = 0; i < highestStepReached; i++) {
            completed.add(i);
        }
        return completed;
    }, [highestStepReached]);

    const getNextStepId = () => {
        for (let i = 0; i < hubSteps.length; i++) {
            if (!completedSteps.has(hubSteps[i].id)) {
                return hubSteps[i].id;
            }
        }
        return hubSteps[hubSteps.length - 1].id;
    };
    const nextStepId = getNextStepId();

    const isFinalStep = currentStep === maxStepId;

    return (
        <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Choose A Pattern</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                        Your central resource for individual patterns and score sheets. Find exactly what you need.
                    </p>
                </div>
            </motion.div>

            <BuilderSteps
              steps={hubSteps}
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              completedSteps={completedSteps}
              nextStepId={nextStepId}
            />

            <Card className="w-full">
              <AnimatePresence mode="wait">
                <CardContent className="p-0 sm:p-6">
                    {renderStepContent()}
                </CardContent>
              </AnimatePresence>
               <div className="p-3 sm:p-6 flex justify-between items-center gap-2 border-t border-border">
                    <Button variant="outline" size="sm" className="sm:size-default" onClick={handleBack} disabled={currentStep === 0}><ArrowLeft className="mr-1 sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Back</span><span className="sm:hidden">Back</span></Button>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {!isClinic && (
                            <Button variant="secondary" size="sm" className="sm:size-default" onClick={handleSaveProject} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 sm:mr-2 h-4 w-4" />}
                                <span className="hidden sm:inline">Save Project</span><span className="sm:hidden">Save</span>
                            </Button>
                        )}
                        {isFinalStep ? (
                            isGenerated ? (
                                <Button size="sm" className="sm:size-default" onClick={() => { setIsGenerated(false); setIsSaved(false); setLastPdfBlob(null); setCurrentStep(0); }}>
                                    <ArrowRight className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">New Pattern</span><span className="sm:hidden">New</span>
                                </Button>
                            ) : null
                        ) : (
                            <Button size="sm" className="sm:size-default" onClick={handleNext} disabled={isFinalStep || !isCurrentStepComplete}>
                                Next <ArrowRight className="ml-1 sm:ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
              </div>
            </Card>

        </div>
    );
};
