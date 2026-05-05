import React from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import ScoresheetGroupPreview from './ScoresheetGroupPreview';

export const Step7_PreviewScoresheets = ({ formData, setFormData }) => {
  const scoresheetDisciplines = (formData.disciplines || []).filter(d => d.scoresheet);

  return (
    <motion.div key="step7-preview" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>Step 9: Preview Scoresheets</CardTitle>
        <CardDescription>Review the generated scoresheets for each class group.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {scoresheetDisciplines.length > 0 ? (
          <div className="space-y-6">
            {scoresheetDisciplines.map((pbbDiscipline) => {
              const originalDisciplineIndex = formData.disciplines.findIndex(d => d.id === pbbDiscipline.id);
              return (
                <div key={originalDisciplineIndex} className="p-4 border rounded-lg bg-background/50">
                  <h4 className="font-bold text-lg mb-4 text-primary">{pbbDiscipline.name.replace(' at Halter', '')}</h4>
                  <div className="space-y-6">
                    {(pbbDiscipline.patternGroups || []).map((group, groupIndex) => (
                      <ScoresheetGroupPreview
                        key={group.id}
                        group={group}
                        scoresheets={group.scoresheets || []}
                        discipline={pbbDiscipline}
                        formData={formData}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No disciplines require scoresheets.</p>
          </div>
        )}
      </CardContent>
    </motion.div>
  );
};