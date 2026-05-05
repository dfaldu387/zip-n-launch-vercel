import React from 'react';
import { AssociationSelection } from '@/components/shared/AssociationSelection';

export const Step1_NameAndAssociations = ({
  formData,
  setFormData,
  associationsData,
}) => {
  return (
    <AssociationSelection
      formData={formData}
      setFormData={setFormData}
      associationsData={associationsData}
      context="pattern-upload"
      stepNumber={1}
    />
  );
};
