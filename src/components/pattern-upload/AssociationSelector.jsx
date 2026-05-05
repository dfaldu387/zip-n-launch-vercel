import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { addLogoToAssociations } from '@/lib/associationsData';

// Only these associations are shown in the UI (others hidden, not deleted)
const VISIBLE_ASSOCIATION_IDS = ['AQHA'];

const AssociationSelector = ({ selectedAssociations, associationDifficulties, onAssociationChange, onDifficultyChange }) => {
  const { toast } = useToast();
  const [associationsData, setAssociationsData] = useState([]);

  useEffect(() => {
    const fetchAssociations = async () => {
        const { data, error } = await supabase.from('associations').select('*').order('name');
        if (error) {
            toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
        } else {
            setAssociationsData(addLogoToAssociations(data));
        }
    };
    fetchAssociations();
  }, [toast]);

  // Get the currently selected association ID (if any)
  const selectedId = Object.keys(selectedAssociations).find(id => selectedAssociations[id]) || '';

  const handleRadioChange = (newId) => {
    // Deselect previous
    if (selectedId && selectedId !== newId) {
      onAssociationChange(selectedId, false);
    }
    // Select new
    onAssociationChange(newId, true);
  };

  const visibleAssociations = associationsData
    .filter(a => !a.is_group && !a.is_open_show)
    .filter(a => VISIBLE_ASSOCIATION_IDS.includes(a.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Shield className="mr-2 h-6 w-6 text-primary" /> Legal Associations & Difficulty</CardTitle>
        <CardDescription>Select one association and specify if the pattern set is for beginners.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedId} onValueChange={handleRadioChange} className="space-y-2">
          {visibleAssociations.map(assoc => (
            <div key={assoc.id} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-b-0">
              <div className="flex items-center space-x-3">
                <RadioGroupItem value={assoc.id} id={`assoc-${assoc.id}`} />
                <Label htmlFor={`assoc-${assoc.id}`} className="font-medium text-sm flex-1 cursor-pointer">{assoc.name}</Label>
              </div>
              {selectedAssociations[assoc.id] && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3">
                    <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Is this a beginner pattern set?</Label>
                    <RadioGroup
                      value={associationDifficulties[assoc.id]}
                      onValueChange={(value) => onDifficultyChange(assoc.id, value)}
                      className="flex items-center gap-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Beginner" id={`beginner-yes-${assoc.id}`} />
                        <Label htmlFor={`beginner-yes-${assoc.id}`} className="text-xs font-normal cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Intermediate" id={`beginner-no-${assoc.id}`} />
                        <Label htmlFor={`beginner-no-${assoc.id}`} className="text-xs font-normal cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};

export default AssociationSelector;

/* ═══════════════════════════════════════════════════════════════════════════
   PRESERVED — Original checkbox-based multi-association selector
   ═══════════════════════════════════════════════════════════════════════════

   Previously showed ALL associations from Supabase with checkboxes (max 1):

   import { Checkbox } from '@/components/ui/checkbox';

   {associationsData.filter(a => !a.is_group && !a.is_open_show).map(assoc => (
     <Checkbox
       checked={!!selectedAssociations[assoc.id]}
       onCheckedChange={(c) => onAssociationChange(assoc.id, c)}
       disabled={!selectedAssociations[assoc.id] && Object.keys(selectedAssociations).length >= 1}
     />
   ))}

   To restore all associations, remove the VISIBLE_ASSOCIATION_IDS filter.

══════════════════════════════════════════════════════════════════════════ */
