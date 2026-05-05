import React, { useState, useMemo, useEffect } from 'react';
    import { parseDivisionId } from '@/lib/showBillUtils';
    import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
    import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
    import { CSS } from '@dnd-kit/utilities';
    import { GripVertical, PlusCircle, Trash2, Search, ChevronsRight } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Badge } from '@/components/ui/badge';
    import { useDroppable } from '@dnd-kit/core';
    import { cn } from '@/lib/utils';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';
    import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';

    const UNASSIGNED_ID = 'unassigned-divisions';
    
    const getAssociationColorClass = (assocId, associationsData) => {
        const assoc = associationsData.find(a => a.id === assocId);
        if (!assoc) return 'bg-gray-500';
        switch (assoc.id) {
            case 'NSBA': return 'bg-green-600';
            case 'AQHA': return 'bg-red-600';
            case 'APHA': return 'bg-blue-600';
            case 'ApHC': return 'bg-purple-600';
            case 'PtHA': return 'bg-yellow-500';
            case 'PHBA': return 'bg-yellow-300 text-black';
            default: return 'bg-gray-500';
        }
    };
    

    const SortableDivisionItem = ({ id, divisionIdentifier, isDraggable = true, isSelected, onSelectionChange, associationsData }) => {
        const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !isDraggable });
        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
        };

        const { assocId, divisionName } = parseDivisionId(divisionIdentifier);

        const colorClass = getAssociationColorClass(assocId, associationsData);
        
        return (
            <div ref={setNodeRef} style={style} className={cn("flex items-center p-2 bg-background rounded-lg border touch-none shadow-sm", isSelected && "ring-2 ring-primary")}>
                <Checkbox
                    id={`select-${id}`}
                    checked={isSelected}
                    onCheckedChange={onSelectionChange}
                    className="mr-2"
                />
                <Button variant="ghost" size="icon" {...attributes} {...listeners} className={cn("h-8 w-8", isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default")}>
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                </Button>
                <span className="flex-grow text-sm">{divisionName.startsWith('custom') ? divisionName.substring(7) : divisionName}</span>
                <Badge variant="secondary" className={cn("ml-auto text-white", colorClass)}>{associationsData.find(a => a.id === assocId)?.abbreviation || assocId}</Badge>
            </div>
        );
    };

    const DayColumn = ({ day, children }) => {
        const { setNodeRef, isOver } = useDroppable({ id: day.id });

        return (
            <div className="flex flex-col gap-2">
                <div ref={setNodeRef} className={cn("flex-grow p-2 border-2 border-dashed rounded-md min-h-[100px] space-y-2", isOver ? "border-primary bg-primary/10" : "border-muted-foreground/50")}>
                    {children}
                </div>
            </div>
        );
    };

    export const MultiDayScheduler = ({ pbbClass, setFormData, associationsData }) => {
        const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
        const [selectedDivisions, setSelectedDivisions] = useState(new Set());
        const [searchTerm, setSearchTerm] = useState('');
        const [newDayName, setNewDayName] = useState('');

        const allDivisions = useMemo(() => {
            return pbbClass.divisionOrder || [];
        }, [pbbClass.divisionOrder]);

        const competitionDays = pbbClass.competitionDays || [];

        const unassignedDivisions = useMemo(() => {
            const scheduledDivisionIds = new Set(competitionDays.flatMap(day => day.divisions));
            return allDivisions.filter(divId => !scheduledDivisionIds.has(divId));
        }, [allDivisions, competitionDays]);
        
        const filteredUnassignedDivisions = useMemo(() => {
            if (!searchTerm) return unassignedDivisions;
            return unassignedDivisions.filter(divId => divId.toLowerCase().includes(searchTerm.toLowerCase()));
        }, [unassignedDivisions, searchTerm]);
        
        const areAllUnassignedSelected = useMemo(() => {
            return filteredUnassignedDivisions.length > 0 && filteredUnassignedDivisions.every(divId => selectedDivisions.has(divId));
        }, [filteredUnassignedDivisions, selectedDivisions]);

        const handleAddDay = () => {
            if (!newDayName.trim()) return;
            setFormData(prev => {
                const newDisciplines = prev.disciplines.map(disc => {
                    if (disc.id === pbbClass.id) {
                        const newDay = {
                            id: `day-${Date.now()}`,
                            name: newDayName,
                            date: new Date().toISOString().split('T')[0],
                            divisions: []
                        };
                        return { ...disc, competitionDays: [...(disc.competitionDays || []), newDay] };
                    }
                    return disc;
                });
                return { ...prev, disciplines: newDisciplines };
            });
            setNewDayName('');
        };

        const handleRemoveDay = (dayId) => {
            setFormData(prev => {
                const newDisciplines = prev.disciplines.map(disc => {
                    if (disc.id === pbbClass.id) {
                        return { ...disc, competitionDays: (disc.competitionDays || []).filter(d => d.id !== dayId) };
                    }
                    return disc;
                });
                return { ...prev, disciplines: newDisciplines };
            });
        };

        const handleSelectionChange = (divisionId, isSelected) => {
            setSelectedDivisions(prev => {
                const newSelection = new Set(prev);
                if (isSelected) {
                    newSelection.add(divisionId);
                } else {
                    newSelection.delete(divisionId);
                }
                return newSelection;
            });
        };

        const handleSelectAllUnassigned = (isSelected) => {
            setSelectedDivisions(prev => {
                const newSelection = new Set(prev);
                filteredUnassignedDivisions.forEach(divId => {
                    if (isSelected) {
                        newSelection.add(divId);
                    } else {
                        newSelection.delete(divId);
                    }
                });
                return newSelection;
            });
        };

        const quickAssign = (targetDayId) => {
            if (selectedDivisions.size === 0) return;

            setFormData(prev => {
                const newDisciplines = prev.disciplines.map(disc => {
                    if (disc.id === pbbClass.id) {
                         const newCompetitionDays = (disc.competitionDays || []).map(day => {
                            if (day.id === targetDayId) {
                                const newDivisionsForDay = [...day.divisions];
                                selectedDivisions.forEach(divId => {
                                    if (unassignedDivisions.includes(divId) && !newDivisionsForDay.includes(divId)) {
                                        newDivisionsForDay.push(divId);
                                    }
                                });
                                return {...day, divisions: newDivisionsForDay};
                            }
                            return day;
                        });
                        return {...disc, competitionDays: newCompetitionDays};
                    }
                    return disc;
                });
                return { ...prev, disciplines: newDisciplines };
            });
            setSelectedDivisions(new Set());
        };

        const handleDragEnd = (event) => {
            const { active, over } = event;
            if (!active || !over) return;
        
            const divisionId = active.id;
        
            setFormData(prev => {
                const newDisciplines = [...prev.disciplines];
                const disciplineIndex = newDisciplines.findIndex(d => d.id === pbbClass.id);
                if (disciplineIndex === -1) return prev;
        
                let currentDiscipline = { ...newDisciplines[disciplineIndex] };
                let newCompetitionDays = [...(currentDiscipline.competitionDays || [])];
        
                // Find source
                let sourceDayIndex = newCompetitionDays.findIndex(d => d.divisions.includes(divisionId));
                let sourceIsUnassigned = sourceDayIndex === -1;
                
                // Find target
                let targetDayIndex = newCompetitionDays.findIndex(d => d.id === over.id);
                let targetIsUnassigned = over.id === UNASSIGNED_ID;
                let overIsDivision = false;
        
                if (targetDayIndex === -1 && !targetIsUnassigned) {
                    targetDayIndex = newCompetitionDays.findIndex(d => d.divisions.includes(over.id));
                    if (targetDayIndex !== -1) {
                        overIsDivision = true;
                    }
                }
        
                if (active.id === over.id) return prev;
        
                // Remove from source
                if (!sourceIsUnassigned) {
                    const sourceDay = { ...newCompetitionDays[sourceDayIndex] };
                    sourceDay.divisions = sourceDay.divisions.filter(id => id !== divisionId);
                    newCompetitionDays[sourceDayIndex] = sourceDay;
                }
        
                // Add to target
                if (targetIsUnassigned) {
                    // Item is dropped into the unassigned list, effectively doing nothing more than removing it from its source day.
                } else if (targetDayIndex !== -1) {
                    const targetDay = { ...newCompetitionDays[targetDayIndex] };
                    if (overIsDivision) {
                        const overIndex = targetDay.divisions.indexOf(over.id);
                        targetDay.divisions.splice(overIndex, 0, divisionId);
                    } else { // Dropped on day column
                        targetDay.divisions.push(divisionId);
                    }
                    newCompetitionDays[targetDayIndex] = targetDay;
                }
        
                currentDiscipline.competitionDays = newCompetitionDays;
                newDisciplines[disciplineIndex] = currentDiscipline;
                return { ...prev, disciplines: newDisciplines };
            });
        };

        const { setNodeRef: setUnassignedNodeRef, isOver: isOverUnassigned } = useDroppable({ id: UNASSIGNED_ID });

        return (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 flex flex-col gap-2 p-3 border rounded-lg bg-background">
                        <h4 className="font-semibold">Unassigned Divisions</h4>
                        <div className="relative">
                            <Input 
                                placeholder="Search divisions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="select-all-unassigned" checked={areAllUnassignedSelected} onCheckedChange={handleSelectAllUnassigned} />
                                <Label htmlFor="select-all-unassigned" className="text-xs font-medium">Select All</Label>
                            </div>
                            {selectedDivisions.size > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={competitionDays.length === 0}>
                                            Quick Assign <ChevronsRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {competitionDays.map(day => (
                                            <DropdownMenuItem key={day.id} onSelect={() => quickAssign(day.id)}>
                                                Assign to {day.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        <ScrollArea className="h-96">
                            <div ref={setUnassignedNodeRef} className={cn("p-2 border-2 border-dashed rounded-md min-h-[100px] space-y-2", isOverUnassigned ? "border-primary bg-primary/10" : "border-muted-foreground/50")}>
                                <SortableContext items={filteredUnassignedDivisions} strategy={verticalListSortingStrategy}>
                                    {filteredUnassignedDivisions.map(divId => (
                                        <SortableDivisionItem 
                                            key={divId} 
                                            id={divId} 
                                            divisionIdentifier={divId} 
                                            isSelected={selectedDivisions.has(divId)}
                                            onSelectionChange={(checked) => handleSelectionChange(divId, checked)}
                                            associationsData={associationsData}
                                        />
                                    ))}
                                    {filteredUnassignedDivisions.length === 0 && (
                                        <p className="text-center text-sm text-muted-foreground py-4">
                                            {unassignedDivisions.length === 0 ? 'All divisions scheduled!' : 'No matching divisions found.'}
                                        </p>
                                    )}
                                </SortableContext>
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="lg:col-span-8 space-y-4">
                        <div className="flex items-center gap-2">
                             <Input 
                                placeholder="New Competition Day Name" 
                                value={newDayName} 
                                onChange={e => setNewDayName(e.target.value)} 
                                className="flex-grow"
                            />
                            <Button onClick={handleAddDay}><PlusCircle className="h-5 w-5 mr-2" /> Add Day</Button>
                        </div>
                        <ScrollArea className="h-[450px]">
                            <div className="space-y-4 pr-4">
                            {competitionDays.length > 0 ? (
                                competitionDays.map(day => (
                                    <div key={day.id} className="p-3 border rounded-lg bg-muted/20">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="font-semibold">{day.name}</h5>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveDay(day.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                        <DayColumn day={day}>
                                            <SortableContext items={day.divisions} strategy={verticalListSortingStrategy}>
                                                {day.divisions.map(divId => (
                                                    <SortableDivisionItem 
                                                        key={divId} 
                                                        id={divId} 
                                                        divisionIdentifier={divId} 
                                                        isSelected={selectedDivisions.has(divId)}
                                                        onSelectionChange={(checked) => handleSelectionChange(divId, checked)}
                                                        associationsData={associationsData}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DayColumn>
                                    </div>
                                ))
                             ) : (
                                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg h-full">
                                    <p className="text-muted-foreground">No competition days added yet.</p>
                                    <p className="text-sm text-muted-foreground">Add a day to get started.</p>
                                </div>
                             )}
                             </div>
                        </ScrollArea>
                    </div>
                </div>
            </DndContext>
        );
    };