import React, { useMemo, useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { Label } from '@/components/ui/label';
    import { Check, ListChecks, Trash2 } from 'lucide-react';
    import { Badge } from '@/components/ui/badge';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    
    export const AvailableClasses = ({ formData, onAddDiscipline, disciplineLibrary, associationsData }) => {
        const isOpenShowMode = formData.showType === 'open-unaffiliated' || !!formData.associations['open-show'];
        const selectedDisciplineNames = useMemo(() => new Set(formData.disciplines.map(c => c.name)), [formData.disciplines]);
    
        const openShowSuggestions = useMemo(() => {
            const aqhaDisciplines = disciplineLibrary.filter(d => d.associations.includes('AQHA'));
            return {
                disciplines: aqhaDisciplines,
                divisions: [
                    { group: 'Walk-Trot', levels: ['All'] },
                    { group: 'Youth', levels: ['All', '13 & Under', '14-18'] },
                    { group: 'Amateur', levels: ['All', 'Select'] },
                    { group: 'Open', levels: ['All', 'Junior Horse', 'Senior Horse'] },
                ]
            };
        }, [disciplineLibrary]);

        const availableDisciplines = useMemo(() => {
            if (formData.showType === 'versatility-ranch') {
                return disciplineLibrary.filter(d => d.associations.includes('versatility-ranch'));
            }
            if (formData.showType === 'open-unaffiliated') return [];
    
            const selectedIds = Object.keys(formData.associations).filter(id => id !== 'open-show');
            if (selectedIds.length === 0) return [];
            
            return disciplineLibrary.filter(disc => (disc.associations || []).some(assocId => selectedIds.includes(assocId)));
        }, [formData.showType, formData.associations, disciplineLibrary]);
    
        const disciplinesToRender = isOpenShowMode ? openShowSuggestions.disciplines : availableDisciplines;
        const handleAdd = isOpenShowMode ? (disc) => onAddDiscipline(disc, true) : onAddDiscipline;
    
        if (disciplinesToRender.length === 0 && !isOpenShowMode) {
            return <p className="text-muted-foreground text-center col-span-full">Select an association in Step 1 to see available disciplines.</p>;
        }
    
        return (
            <div className="space-y-4">
                <Label className="font-semibold text-base">Or, Add Disciplines Manually</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {disciplinesToRender.map(disc => {
                        const isAdded = selectedDisciplineNames.has(disc.name);
                        return <Button key={disc.name} variant="outline" disabled={isAdded} onClick={() => handleAdd(disc)}>{isAdded && <Check className="w-4 h-4 mr-2"/>}{disc.name}</Button>;
                    })}
                </div>
            </div>
        );
    };
    
    export const SelectedClasses = ({ disciplines, onRemoveDiscipline, associationsData }) => (
        <div className="p-4 border rounded-lg bg-background/50">
            <Label className="font-semibold text-base flex items-center mb-3"><ListChecks className="w-5 h-5 mr-2 text-primary"/>Selected Disciplines</Label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {disciplines.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No disciplines selected yet.</p>
                ) : (
                    disciplines.map(disc => (
                        <div key={disc.id} className="flex items-center justify-between bg-background p-2 rounded-md border">
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-sm font-medium">{disc.name}</span>
                                <div className="flex flex-wrap gap-1">
                                  {Object.keys(disc.selectedAssociations).map(assocId => {
                                      if (assocId === 'NSBA' && disc.isDualApproved) return null;
                                      const assoc = associationsData.find(a => a.id === assocId);
                                      return <Badge key={assocId} variant={assoc?.color || 'secondary'} className="text-xs">{assoc?.name || assocId}</Badge>
                                  })}
                                  {disc.isDualApproved && <Badge variant="dualApproved">NSBA Dual-Approved</Badge>}
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveDiscipline(disc.id)}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );