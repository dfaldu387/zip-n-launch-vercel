import React from 'react';
import { AssociationSelection } from '@/components/shared/AssociationSelection';

export const AssociationStep = ({ formData, setFormData, ...props }) => {
  return (
    <AssociationSelection formData={formData} setFormData={setFormData} {...props} context="showBuilder" />
  );
};