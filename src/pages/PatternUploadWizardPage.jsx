import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, FileText, ListChecks, Upload, PenTool, Package, ShieldCheck, Save, Loader2, CheckCircle, LogOut, Send, MessageCircle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { BuilderSteps } from '@/components/pbb/BuilderSteps';
import { usePatternUploadWizard } from '@/hooks/usePatternUploadWizard';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import PatternPreviewModal from '@/components/pattern-upload/PatternPreviewModal';
import { submitPatternSet } from '@/lib/patternUploadUtils';

import { Step1_NameAndAssociations } from '@/components/pattern-upload-wizard/Step1_NameAndAssociations';
import { Step2_DisciplineAndClass } from '@/components/pattern-upload-wizard/Step2_DisciplineAndClass';
import { Step3_UploadAndOrganize } from '@/components/pattern-upload-wizard/Step3_UploadAndOrganize';
import { Step4_ManeuverAnnotation } from '@/components/pattern-upload-wizard/Step4_ManeuverAnnotation';
import { Step5_EquipmentAndDocs } from '@/components/pattern-upload-wizard/Step5_EquipmentAndDocs';
import { Step6_LicenseAndSubmit } from '@/components/pattern-upload-wizard/Step6_LicenseAndSubmit';

const steps = [
  { id: 1, name: 'Name & Associations', icon: FileText },
  { id: 2, name: 'Discipline & Class', icon: ListChecks },
  { id: 3, name: 'Upload Patterns', icon: Upload },
  { id: 4, name: 'Maneuver Editing', icon: PenTool },
  { id: 5, name: 'Equipment & Docs', icon: Package },
  { id: 6, name: 'License & Submit', icon: ShieldCheck },
];

const PatternUploadWizardPage = () => {
  const { projectId } = useParams();
  const { toast } = useToast();
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
    isNextDisabled,
    associationsData,
    disciplineLibrary,
    divisionsData,
    hasPatterns,
    selectedAssociationIds,
    uploadSlots,
    handleFileDrop,
    handlePatternSkillLevel,
    handleRemovePattern,
    handleMovePattern,
    handlePdfSplit,
    assignStagedPdf,
    removeStagedPdf,
    renameStagedPdf,
    handleAssociationChange,
    handleDifficultyChange,
    handleDivisionChange,
    handleDivisionGroupChange,
    handleBulkDivisionChange,
    handleAddAccessoryDoc,
    handleRemoveAccessoryDoc,
    handleUpdateAccessoryDoc,
  } = usePatternUploadWizard(projectId);

  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState(null);
  const [previewingPattern, setPreviewingPattern] = useState(null);
  const saveTimerRef = useRef(null);

  // Auto-dismiss save confirmation after 5 seconds
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleNext = async () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));

    // Auto-save on step advance if project already exists
    if (formData.id) {
      try {
        await createOrUpdateProject();
      } catch (e) {
        // Non-blocking: don't prevent navigation if auto-save fails
        console.warn('Auto-save failed:', e);
      }
    }

    if (currentStep < steps.length) {
      nextStep();
    }
  };

  const handleBack = () => currentStep > 1 && prevStep();

  const showSaveConfirmation = (savedId) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveConfirmation({ timestamp: new Date().toLocaleTimeString(), projectId: savedId });
    saveTimerRef.current = setTimeout(() => setSaveConfirmation(null), 5000);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const savedId = await createOrUpdateProject();
      if (savedId) {
        showSaveConfirmation(savedId);
        toast({
          title: 'Pattern Saved Successfully',
          description: `Draft saved at ${new Date().toLocaleTimeString()}`,
        });
      }
    } catch (error) {
      // Error toast handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitPatterns = async () => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to submit.', variant: 'destructive' });
      return;
    }
    if (!formData.agreedToTerms) {
      toast({ title: 'Terms Required', description: 'Please agree to the licensing terms.', variant: 'destructive' });
      return;
    }
    if (!hasPatterns) {
      toast({ title: 'No Patterns', description: 'Please upload at least one pattern.', variant: 'destructive' });
      return;
    }
    if (formData.useAsOriginal === null || formData.useAsOriginal === undefined) {
      toast({
        title: 'Answer Required',
        description: 'Please confirm whether the original pattern should appear in Choose a Pattern.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Save draft first to ensure all data is persisted
      await createOrUpdateProject();

      // Submit the pattern set
      await submitPatternSet(formData, user);

      setCompletedSteps(prev => new Set([...prev, currentStep]));

      toast({
        title: 'Patterns Submitted!',
        description: 'Your pattern set has been submitted successfully.',
      });

      navigate('/upload-patterns');
    } catch (error) {
      toast({ title: 'Submission Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndExit = async () => {
    setIsSaving(true);
    try {
      const savedId = await createOrUpdateProject();
      if (savedId) {
        navigate('/upload-patterns');
      }
    } catch (error) {
      // Error toast handled in hook
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

    switch (currentStep) {
      case 1:
        return (
          <Step1_NameAndAssociations
            formData={formData}
            setFormData={setFormData}
            associationsData={associationsData}
          />
        );
      case 2:
        return (
          <Step2_DisciplineAndClass
            formData={formData}
            setFormData={setFormData}
            disciplineLibrary={disciplineLibrary}
            associationsData={associationsData}
          />
        );
      case 3:
        return (
          <Step3_UploadAndOrganize
            formData={formData}
            setFormData={setFormData}
            uploadSlots={uploadSlots}
            handleFileDrop={handleFileDrop}
            handleRemovePattern={handleRemovePattern}
            handleMovePattern={handleMovePattern}
            handlePatternSkillLevel={handlePatternSkillLevel}
            handlePdfSplit={handlePdfSplit}
            assignStagedPdf={assignStagedPdf}
            removeStagedPdf={removeStagedPdf}
            renameStagedPdf={renameStagedPdf}
            handleDivisionChange={handleDivisionChange}
            handleDivisionGroupChange={handleDivisionGroupChange}
            handleBulkDivisionChange={handleBulkDivisionChange}
            divisionsData={divisionsData}
            selectedAssociationIds={selectedAssociationIds}
            onPreview={setPreviewingPattern}
          />
        );
      case 4:
        return (
          <Step4_ManeuverAnnotation
            formData={formData}
            setFormData={setFormData}
            uploadSlots={uploadSlots}
          />
        );
      case 5:
        return (
          <Step5_EquipmentAndDocs
            formData={formData}
            setFormData={setFormData}
            handleAddAccessoryDoc={handleAddAccessoryDoc}
            handleRemoveAccessoryDoc={handleRemoveAccessoryDoc}
            handleUpdateAccessoryDoc={handleUpdateAccessoryDoc}
          />
        );
      case 6:
        return (
          <Step6_LicenseAndSubmit
            formData={formData}
            setFormData={setFormData}
            associationsData={associationsData}
            uploadSlots={uploadSlots}
            onGoToStep={setCurrentStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>Upload Patterns - EquiPatterns</title>
        <meta name="description" content="Upload your patterns through our guided wizard." />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="container mx-auto px-4 py-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-4"
          >
            <Upload className="mx-auto h-12 w-12 text-primary mb-2" />
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              {formData.resubmitPatternId ? 'Edit & Resubmit Pattern' : 'Upload Patterns'}
            </h1>
            <p className="mt-2 max-w-2xl mx-auto text-base text-muted-foreground">
              {formData.resubmitPatternId
                ? 'Update your pattern based on the admin feedback and resubmit for review.'
                : 'Share your expertise through our guided pattern upload wizard.'}
            </p>
          </motion.div>

          {/* Rejection reason banner for resubmissions */}
          {formData.rejectionReason && (
            <div className="max-w-7xl mx-auto mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
              <div className="flex items-start gap-3">
                <MessageCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-800 text-sm">Admin Feedback — Why This Was Rejected</h3>
                  <p className="text-red-700 text-sm mt-1 whitespace-pre-line">{formData.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}

          <div className="max-w-7xl mx-auto">
            <BuilderSteps
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              setCurrentStep={setCurrentStep}
              isEditMode={!!projectId}
            />

            <Card className="glass-effect">
              <AnimatePresence mode="wait">
                <CardContent className="p-0 sm:p-6">
                  {renderStepContent()}
                </CardContent>
              </AnimatePresence>

              {/* Save confirmation banner */}
              <AnimatePresence>
                {saveConfirmation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.25 }}
                    className="mx-4 mb-0 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200">
                      Saved successfully at {saveConfirmation.timestamp}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <CardFooter className="p-4 flex justify-between items-center border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Project name indicator */}
                  {formData.id && formData.showName && (
                    <span className="text-xs text-muted-foreground hidden sm:inline mr-1">
                      Project: {formData.showName}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveAndExit}
                    disabled={isSaving}
                    className="text-muted-foreground"
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" /> Save & Exit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Draft
                  </Button>
                  {currentStep < steps.length ? (
                    <Button onClick={handleNext} disabled={isNextDisabled}>
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleSubmitPatterns} disabled={isNextDisabled || isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Submit Patterns
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>
        </main>

        <PatternPreviewModal
          isOpen={!!previewingPattern}
          onClose={() => setPreviewingPattern(null)}
          pattern={previewingPattern}
        />
      </div>
    </>
  );
};

export default PatternUploadWizardPage;
