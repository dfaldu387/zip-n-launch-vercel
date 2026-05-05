import React from 'react';
import { AssociationSelection } from '@/components/shared/AssociationSelection';

export const Step1_ShowAssociations = (props) => {
  return <AssociationSelection {...props} context="showBuilder" />;
};