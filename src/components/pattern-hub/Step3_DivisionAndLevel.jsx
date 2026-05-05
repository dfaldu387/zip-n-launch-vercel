import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// Disciplines that should NOT show the "Open" division group
const NO_OPEN_DISCIPLINES = ['Showmanship at Halter', 'Hunt Seat Equitation', 'Western Horsemanship'];

export const Step3_DivisionAndLevel = ({ formData, setFormData, divisionsData, associationsData, stepNumber = 3 }) => {
  const selectedAssocIds = Object.keys(formData.associations || {}).filter(id => formData.associations[id]);

  // Determine if "Open" division should be hidden based on selected disciplines
  const shouldHideOpen = useMemo(() => {
    const disciplines = formData.disciplines || [];
    if (disciplines.length === 0) return false;
    // Hide Open if ALL selected disciplines are in the no-open list
    return disciplines.every(d =>
      NO_OPEN_DISCIPLINES.includes(d.name) ||
      (d.name && d.name.toLowerCase().includes('amateur'))
    );
  }, [formData.disciplines]);

  // Filter divisions per association based on discipline rules
  const getFilteredDivisions = (assocId) => {
    const divisions = divisionsData[assocId] || [];
    if (!shouldHideOpen) return divisions;
    return divisions.filter(d => d.group.toLowerCase() !== 'open');
  };

  const handleToggleDivision = (assocId, groupName, checked) => {
    setFormData(prev => ({
      ...prev,
      selectedDivisions: {
        ...prev.selectedDivisions,
        [assocId]: {
          ...(prev.selectedDivisions?.[assocId] || {}),
          [groupName]: checked,
        }
      },
      // Clear levels when deselecting a division group
      selectedLevels: !checked ? {
        ...prev.selectedLevels,
        [assocId]: {
          ...(prev.selectedLevels?.[assocId] || {}),
          [groupName]: [],
        }
      } : prev.selectedLevels,
    }));
  };

  const handleToggleLevel = (assocId, groupName, levelName, checked) => {
    setFormData(prev => {
      const currentLevels = prev.selectedLevels?.[assocId]?.[groupName] || [];
      const newLevels = checked
        ? [...currentLevels, levelName]
        : currentLevels.filter(l => l !== levelName);
      return {
        ...prev,
        selectedLevels: {
          ...prev.selectedLevels,
          [assocId]: {
            ...(prev.selectedLevels?.[assocId] || {}),
            [groupName]: newLevels,
          }
        }
      };
    });
  };

  const handleSelectAllLevels = (assocId, groupName, levels) => {
    const currentLevels = formData.selectedLevels?.[assocId]?.[groupName] || [];
    const allSelected = levels.every(l => currentLevels.includes(l));
    setFormData(prev => ({
      ...prev,
      selectedLevels: {
        ...prev.selectedLevels,
        [assocId]: {
          ...(prev.selectedLevels?.[assocId] || {}),
          [groupName]: allSelected ? [] : [...levels],
        }
      }
    }));
  };

  // Count total selections
  const totalSelected = Object.values(formData.selectedLevels || {}).reduce((sum, groups) => {
    return sum + Object.values(groups || {}).reduce((s, levels) => s + (levels?.length || 0), 0);
  }, 0);

  return (
    <motion.div key="step3-division-level" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Step {stepNumber}: Division & Level</CardTitle>
        <CardDescription className="text-sm">
          Select the divisions and levels for your horse show patterns.
          {totalSelected > 0 && (
            <Badge variant="secondary" className="ml-2">{totalSelected} level{totalSelected !== 1 ? 's' : ''} selected</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedAssocIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No associations selected. Go back to step 1 to select associations.</p>
        ) : (
          <Accordion type="multiple" defaultValue={selectedAssocIds} className="w-full">
            {selectedAssocIds.map(assocId => {
              const divisions = getFilteredDivisions(assocId);
              const association = associationsData.find(a => a.id === assocId);
              if (divisions.length === 0) return null;

              return (
                <AccordionItem key={assocId} value={assocId}>
                  <AccordionTrigger className="text-base font-semibold">
                    <div className="flex items-center gap-2">
                      {association?.logo && <img src={association.logo} alt="" className="h-5 w-5 object-contain" />}
                      {association?.name || assocId}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 space-y-4">
                    {divisions.map(div => {
                      const isDivSelected = formData.selectedDivisions?.[assocId]?.[div.group] || false;
                      const selectedLevels = formData.selectedLevels?.[assocId]?.[div.group] || [];

                      return (
                        <div key={div.group} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`div-${assocId}-${div.group}`}
                              checked={isDivSelected}
                              onCheckedChange={(checked) => handleToggleDivision(assocId, div.group, !!checked)}
                            />
                            <Label htmlFor={`div-${assocId}-${div.group}`} className="font-semibold cursor-pointer">
                              {div.group}
                            </Label>
                            {isDivSelected && selectedLevels.length > 0 && (
                              <Badge variant="outline" className="text-xs">{selectedLevels.length}/{div.levels.length}</Badge>
                            )}
                          </div>
                          {isDivSelected && div.levels.length > 0 && (
                            <div className="ml-6 space-y-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Checkbox
                                  id={`all-${assocId}-${div.group}`}
                                  checked={div.levels.every(l => selectedLevels.includes(l))}
                                  onCheckedChange={() => handleSelectAllLevels(assocId, div.group, div.levels)}
                                />
                                <Label htmlFor={`all-${assocId}-${div.group}`} className="text-sm italic cursor-pointer text-muted-foreground">
                                  Select All
                                </Label>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                                {div.levels.map(level => (
                                  <div key={level} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`level-${assocId}-${div.group}-${level}`}
                                      checked={selectedLevels.includes(level)}
                                      onCheckedChange={(checked) => handleToggleLevel(assocId, div.group, level, !!checked)}
                                    />
                                    <Label htmlFor={`level-${assocId}-${div.group}-${level}`} className="text-sm font-normal cursor-pointer">
                                      {level}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </motion.div>
  );
};
