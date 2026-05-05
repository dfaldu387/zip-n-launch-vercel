import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const DisciplineCard = ({ discipline, onToggle, isSelected, selectedAssociations, nsbaDualApprovedWith = [], isDualApproved, isNsbaStandalone }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${isSelected ? 'bg-primary/10 border-primary' : 'bg-card'}`}
        >
            <div className="flex items-center space-x-3 flex-1 overflow-hidden">
                <Checkbox
                    id={`disc-select-${discipline.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => onToggle(discipline, checked)}
                />
                <div className="flex flex-col items-start flex-1 overflow-hidden">
                    <span className="font-medium text-sm truncate w-full">{discipline.name}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {selectedAssociations.map(assoc => (
                            <Badge key={assoc.id} variant={assoc.color || 'secondary'} className="text-xs">{assoc.abbreviation || assoc.name}</Badge>
                        ))}
                        {isDualApproved && <Badge variant="dualApproved" className="text-xs">NSBA Dual-Approved</Badge>}
                        {isNsbaStandalone && <Badge variant="standalone" className="text-xs">NSBA Standalone</Badge>}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
                {discipline.pattern_type === 'custom' && <Badge variant="outline" className="border-blue-500 text-blue-500">Custom</Badge>}
                {discipline.pattern_type === 'rulebook' && <Badge variant="outline" className="border-orange-500 text-orange-500">Rulebook</Badge>}
                {discipline.isCustom && <Badge variant="destructive">Custom</Badge>}
            </div>
        </motion.div>
    );
};

export const ClassSelectionList = ({ formData, onDisciplineToggle, setFormData, disciplineLibrary, associationsData }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const selectedAssociationIds = Object.keys(formData.associations || {}).filter(id => formData.associations[id]);
    const isVrhMode = formData.showType === 'versatility-ranch';
    const isOpenShowMode = formData.showType === 'open-unaffiliated' || formData.associations['open-show'];

    const { availableDisciplines } = useMemo(() => {
        let allAvailable = [];
        let seen = new Set();
        
        const subSelections = formData.subAssociationSelections || {};
        
        const filterBySubtype = (discipline) => {
            const assocId = discipline.association_id;
            if (subSelections[assocId]?.type) {
                return discipline.sub_association_type === subSelections[assocId].type;
            }
            return true;
        };
        
        let baseLibrary = disciplineLibrary;
        
        if(isVrhMode) {
            baseLibrary = disciplineLibrary.filter(d => d.association_id === 'versatility-ranch');
        } else if (isOpenShowMode) {
             baseLibrary = disciplineLibrary.filter(d => d.association_id === 'AQHA');
        } else {
             baseLibrary = disciplineLibrary.filter(d => selectedAssociationIds.includes(d.association_id) && filterBySubtype(d));
        }

        baseLibrary.forEach(d => {
            if (!seen.has(d.name)) {
                allAvailable.push(d);
                seen.add(d.name);
            }
        });
        
        allAvailable.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));

        return { availableDisciplines: allAvailable };
    }, [selectedAssociationIds, isVrhMode, isOpenShowMode, disciplineLibrary, formData.subAssociationSelections, formData.associations]);


    const filteredDisciplines = useMemo(() => {
        if (!searchTerm) return availableDisciplines;
        return availableDisciplines.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, availableDisciplines]);

    const selectedDisciplines = useMemo(() => formData.disciplines || [], [formData.disciplines]);
    const selectedDisciplineNames = useMemo(() => new Set(selectedDisciplines.map(d => d.name)), [selectedDisciplines]);

    const getAssociationHeader = () => {
        if (isVrhMode) return "Versatility Ranch Horse Disciplines";
        if (isOpenShowMode) return "Recommended Open Show Disciplines";
        if (selectedAssociationIds.length > 0) {
            const primaryAssocId = selectedAssociationIds.find(id => formData.primaryAffiliates.includes(id)) || selectedAssociationIds[0];
            const assocData = associationsData.find(a => a.id === primaryAssocId);
            if(!assocData) return "Available Disciplines";
            
            let name = assocData.name;
            let info = null;

            if (assocData.sub_association_info) {
                const subSelectionId = formData.subAssociationSelections?.[primaryAssocId]?.type;
                if (subSelectionId) {
                    const typeInfo = assocData.sub_association_info.types.find(t => t.id === subSelectionId);
                    name = `${assocData.abbreviation} - ${typeInfo?.name || 'Unknown Type'}`;
                    if(typeInfo?.info) info = typeInfo.info;
                }
            }
            
            const otherCount = selectedAssociationIds.filter(id => id !== primaryAssocId).length;

            return (
                <div className="flex items-center gap-2">
                    {name}
                    {info && (
                        <Popover>
                            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Info className="h-4 w-4" /></Button></PopoverTrigger>
                            <PopoverContent className="w-80 text-sm">{info}</PopoverContent>
                        </Popover>
                    )}
                    {otherCount > 0 && ` (+${otherCount} more)`}
                </div>
            )
        }
        return "Available Disciplines";
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-semibold text-lg">{getAssociationHeader()}</h4>
                <Input 
                    placeholder="Search disciplines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    <AnimatePresence>
                    {filteredDisciplines.map(discipline => {
                        const isSelected = selectedDisciplineNames.has(discipline.name);
                        const disciplineInFormData = isSelected ? selectedDisciplines.find(d => d.name === discipline.name) : {};
                        
                        const nsbaDualApprovedWith = formData.nsbaDualApprovedWith || [];

                        const selectedAssociationsForCard = Object.keys(disciplineInFormData?.selectedAssociations || {})
                            .map(id => associationsData.find(a => a.id === id))
                            .filter(Boolean);
                        
                        return (
                            <DisciplineCard
                                key={discipline.id}
                                discipline={discipline}
                                onToggle={(disc, checked) => onDisciplineToggle(disc, checked)}
                                isSelected={isSelected}
                                selectedAssociations={selectedAssociationsForCard}
                                isDualApproved={disciplineInFormData?.isDualApproved}
                                isNsbaStandalone={disciplineInFormData?.isNsbaStandalone}
                                nsbaDualApprovedWith={nsbaDualApprovedWith}
                            />
                        );
                    })}
                    </AnimatePresence>
                </div>
            </div>
            <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-background/50 sticky top-4">
                    <h4 className="font-semibold text-lg mb-3">Selected Disciplines ({selectedDisciplines.length})</h4>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                        {selectedDisciplines.length > 0 ? selectedDisciplines.map(discipline => {
                             const selectedAssociationsForCard = Object.keys(discipline.selectedAssociations || {})
                                .map(id => associationsData.find(a => a.id === id))
                                .filter(Boolean);

                            return (
                                <motion.div
                                    key={discipline.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex items-center justify-between p-2 rounded-md border bg-background"
                                >
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-medium text-sm truncate">{discipline.name}</p>
                                         <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedAssociationsForCard.map(assoc => {
                                                 if (assoc.id === 'NSBA' && discipline.isDualApproved) return null;
                                                 return <Badge key={assoc.id} variant={assoc?.color || 'secondary'} className="text-xs">{assoc?.abbreviation || assoc.name}</Badge>
                                            })}
                                            {discipline.isDualApproved && <Badge variant="dualApproved" className="text-xs">NSBA Dual-Approved</Badge>}
                                            {discipline.isNsbaStandalone && !discipline.isDualApproved && <Badge variant="standalone" className="text-xs">NSBA Standalone</Badge>}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDisciplineToggle(discipline, false)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </motion.div>
                            );
                        }) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No disciplines selected.</p>
                                <p className="text-xs mt-1">Select disciplines from the left panel.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};