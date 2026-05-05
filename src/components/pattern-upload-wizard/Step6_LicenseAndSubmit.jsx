import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent, Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import LicensingAgreement from '@/components/pattern-upload/LicensingAgreement';
import SubmissionSummary from './SubmissionSummary';

export const Step6_LicenseAndSubmit = ({
  formData,
  setFormData,
  associationsData,
  uploadSlots,
  onGoToStep,
}) => {
  const hasPatterns = Object.values(formData.patterns).some(p => p);

  return (
    <motion.div
      key="step-6"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Step 6: License Agreement & Submit</CardTitle>
        <CardDescription className="text-sm">
          Review your submission, agree to the licensing terms, and submit your pattern set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Submission Summary */}
        <SubmissionSummary
          formData={formData}
          associationsData={associationsData}
          uploadSlots={uploadSlots}
          onGoToStep={onGoToStep}
        />

        {/* Original Pattern Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Original Pattern Usage</CardTitle>
            <CardDescription>
              How should the original uploaded pattern be used in <strong>Choose a Pattern</strong>?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={
                formData.useAsOriginal === null ? ''
                  : formData.useAsOriginal
                    ? (formData.chooseAPatternOnly ? 'capo' : 'op')
                    : 'no'
              }
              onValueChange={(v) => setFormData(prev => ({
                ...prev,
                useAsOriginal: v === 'op' || v === 'capo' ? true : v === 'no' ? false : null,
                chooseAPatternOnly: v === 'capo',
              }))}
              className="flex flex-col gap-3"
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="no" id="wiz-use-original-no" className="mt-0.5" />
                <Label htmlFor="wiz-use-original-no" className="cursor-pointer leading-snug">
                  <div className="font-medium">No — generated version only</div>
                  <div className="text-xs text-muted-foreground">We'll generate a branded pattern; the original is not shared in Choose A Pattern. Identifier: <code className="font-mono">P</code></div>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="op" id="wiz-use-original-op" className="mt-0.5" />
                <Label htmlFor="wiz-use-original-op" className="cursor-pointer leading-snug">
                  <div className="font-medium">Yes — Original Pattern</div>
                  <div className="text-xs text-muted-foreground">Original is available in Choose A Pattern. Identifier: <code className="font-mono">OP</code></div>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="capo" id="wiz-use-original-capo" className="mt-0.5" />
                <Label htmlFor="wiz-use-original-capo" className="cursor-pointer leading-snug">
                  <div className="font-medium">Choose A Pattern Only</div>
                  <div className="text-xs text-muted-foreground">Original is available in Choose A Pattern only — no generated/branded version will be produced. Identifier: <code className="font-mono">CAPO</code></div>
                </Label>
              </div>
            </RadioGroup>
            {formData.useAsOriginal === null && (
              <p className="text-xs text-amber-600 mt-2">Please select an option before submitting.</p>
            )}
          </CardContent>
        </Card>

        {/* License Agreement */}
        <LicensingAgreement
          agreedToTerms={formData.agreedToTerms}
          setAgreedToTerms={(val) => setFormData(prev => ({ ...prev, agreedToTerms: val }))}
        />

        {/* Status indicators */}
        {!hasPatterns && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              You must upload at least one pattern before submitting.
            </p>
          </div>
        )}
      </CardContent>
    </motion.div>
  );
};
