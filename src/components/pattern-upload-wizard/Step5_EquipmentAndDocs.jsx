import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AccessoryDocumentUploader from '@/components/pattern-upload/AccessoryDocumentUploader';

export const Step5_EquipmentAndDocs = ({
  formData,
  setFormData,
  handleAddAccessoryDoc,
  handleRemoveAccessoryDoc,
  handleUpdateAccessoryDoc,
}) => {
  return (
    <motion.div
      key="step-5"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Step 5: Equipment & Supporting Documents</CardTitle>
        <CardDescription className="text-sm">
          Add optional equipment lists, build sheets, and any supporting documents. This step is optional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Supporting Documents */}
        <AccessoryDocumentUploader
          accessoryDocs={formData.accessoryDocs}
          onAdd={handleAddAccessoryDoc}
          onRemove={handleRemoveAccessoryDoc}
          onUpdate={handleUpdateAccessoryDoc}
          patterns={formData.patterns}
          hierarchyOrder={formData.hierarchyOrder}
        />

        {/* Equipment Notes */}
        <div className="space-y-2">
          <Label htmlFor="equipmentNotes" className="font-semibold">
            Equipment Notes
          </Label>
          <p className="text-xs text-muted-foreground">
            List any special equipment needed for these patterns (cones, poles, markers, etc.)
          </p>
          <Textarea
            id="equipmentNotes"
            placeholder="E.g., 4 cones, 2 ground poles, 1 bridge obstacle..."
            value={formData.equipmentNotes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, equipmentNotes: e.target.value }))}
            rows={4}
          />
        </div>
      </CardContent>
    </motion.div>
  );
};
