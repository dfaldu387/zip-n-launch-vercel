import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Search, Calendar as CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parseDivisionId } from '@/lib/showBillUtils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

const DraggableClassItem = React.forwardRef(({ id, classItem, formData, isSelected, onSelect, isDragging, associationsData, ...props }, ref) => {
    const { attributes, listeners, setNodeRef: setSortableNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    const getAssociationBadges = () => {
        if (!classItem || !formData || !associationsData) return [];
        
        const badges = [];
        const nsbaDualApprovedWith = formData.nsbaDualApprovedWith || [];
        
        const discipline = formData.disciplines.find(d => d.id === classItem.disciplineId);
        if (discipline) {
            badges.push(<Badge key="discipline" variant="discipline">{discipline.name}</Badge>);
        }

        const assoc = associationsData.find(a => a.id === classItem.assocId);
        if (assoc) {
            badges.push(<Badge key={classItem.assocId} variant={assoc?.color || 'secondary'}>{assoc.abbreviation || assoc.name}</Badge>);
        }

        if (discipline?.isDualApproved && nsbaDualApprovedWith.includes(classItem.assocId)) {
            badges.push(<Badge key={`${classItem.assocId}-da`} variant="dualApproved">NSBA Dual-Approved</Badge>);
        }

        if (discipline?.isNsbaStandalone && classItem.assocId === 'NSBA') {
            badges.push(<Badge key="nsba-standalone" variant="standalone">NSBA Standalone</Badge>);
        }
        
        return badges;
    };
    
    return (
        <div ref={setSortableNodeRef} style={style} className={cn("flex items-center gap-2 p-2 border rounded-lg bg-background touch-none shadow-sm", isDragging ? 'opacity-50' : '')}>
            {onSelect && <Checkbox checked={isSelected} onCheckedChange={onSelect} className="shrink-0" />}
            <div ref={ref} {...props} {...attributes} {...listeners} className="flex-grow flex items-center gap-2 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-grow">
                    <p className="font-semibold text-sm">{classItem.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1 text-xs">
                        {getAssociationBadges()}
                    </div>
                </div>
            </div>
        </div>
    );
});

const UnassignedClassesPalette = ({ classes, selected, onSelect, onSelectAll, onSearch, onQuickAssign, searchTerm, formData, associationsData }) => (
    <div className="p-4 border rounded-lg h-full flex flex-col gap-4 bg-muted/20">
        <h3 className="text-lg font-bold">Unassigned Classes ({classes.length})</h3>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search classes..." className="pl-9" value={searchTerm} onChange={e => onSearch(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
             <div className="flex items-center space-x-2">
                <Checkbox id="select-all-unassigned" checked={selected.length === classes.length && classes.length > 0} onCheckedChange={onSelectAll} />
                <Label htmlFor="select-all-unassigned">Select All</Label>
            </div>
            {selected.length > 0 && (
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm"><CalendarIcon className="h-4 w-4 mr-2" /> Quick Assign Date</Button>
                    </PopoverTrigger>
                    <PopoverContent>
                        <Calendar
                            mode="single"
                            onSelect={date => onQuickAssign(date)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            )}
        </div>
        <ScrollArea className="flex-grow bg-background border rounded-md p-2">
            <SortableContext items={classes.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {classes.map(classItem => (
                        <DraggableClassItem
                            key={classItem.id}
                            id={classItem.id}
                            classItem={classItem}
                            formData={formData}
                            isSelected={selected.includes(classItem.id)}
                            onSelect={() => onSelect(classItem.id)}
                            associationsData={associationsData}
                        />
                    ))}
                </div>
            </SortableContext>
        </ScrollArea>
    </div>
);

const DaySchedule = ({ date, arenas, classes, onRemoveDay, setFormData, formData, associationsData }) => {
    const [openArenaId, setOpenArenaId] = useState(arenas?.[0]?.id);

    const handleDragOver = (event) => {
        const { over } = event;
        if (!over || !over.data.current?.sortable) return;
        
        const overContainerId = over.data.current.sortable.containerId;
        if (overContainerId && openArenaId !== overContainerId) {
            setOpenArenaId(overContainerId);
        }
    };

    const getArenaClasses = (arenaId) => {
        return classes.filter(c => c.arenaId === arenaId).sort((a, b) => a.order - b.order);
    };

    return (
        <div className="p-4 border rounded-lg bg-muted/20">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                <Button variant="destructive" size="sm" onClick={() => onRemoveDay(date)}><Trash2 className="h-4 w-4 mr-2"/>Remove Day</Button>
            </div>
            <Tabs value={openArenaId} onValueChange={setOpenArenaId} className="w-full">
                <TabsList>
                    {(arenas || []).map(arena => <TabsTrigger key={arena.id} value={arena.id}>{arena.name}</TabsTrigger>)}
                </TabsList>
                {(arenas || []).map(arena => (
                    <TabsContent key={arena.id} value={arena.id}>
                        <SortableContext id={arena.id} items={getArenaClasses(arena.id).map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2 p-2 border-2 border-dashed rounded-md min-h-[150px]">
                                {getArenaClasses(arena.id).map(classItem => (
                                    <DraggableClassItem
                                        key={classItem.id}
                                        id={classItem.id}
                                        classItem={classItem}
                                        formData={formData}
                                        associationsData={associationsData}
                                    />
                                ))}
                                {getArenaClasses(arena.id).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Drag classes here</p>}
                            </div>
                        </SortableContext>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

const ScheduleContent = ({ formData, setFormData }) => {
    const [activeId, setActiveId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUnassigned, setSelectedUnassigned] = useState([]);
    const [associationsData, setAssociationsData] = useState([]);
    const { toast } = useToast();
    
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    useEffect(() => {
        const fetchAssociations = async () => {
            const { data, error } = await supabase.from('associations').select('*');
            if (error) {
                toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
            } else {
                setAssociationsData(data);
            }
        };
        fetchAssociations();
    }, [toast]);

    const allClassItems = useMemo(() => {
        return (formData.disciplines || []).flatMap(discipline => {
            return (discipline.divisionOrder || []).map(divisionId => {
                const { assocId, divisionName } = parseDivisionId(divisionId);
                const customTitle = discipline.divisionPrintTitles?.[divisionId];
                const name = customTitle || (divisionName.startsWith('custom-') ? divisionName.substring(7) : divisionName);
                
                return {
                    id: divisionId,
                    name: name,
                    disciplineId: discipline.id,
                    assocId: assocId,
                    scheduleDate: discipline.divisionDates?.[divisionId] || null,
                    arenaId: discipline.divisionArenaIds?.[divisionId] || null,
                    order: discipline.divisionOrders?.[divisionId] || 0,
                };
            });
        });
    }, [formData.disciplines]);

    const scheduledClasses = useMemo(() => allClassItems.filter(c => c.scheduleDate), [allClassItems]);
    const unassignedClasses = useMemo(() => allClassItems.filter(c => !c.scheduleDate), [allClassItems]);

    const filteredUnassigned = useMemo(() =>
        unassignedClasses.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [unassignedClasses, searchTerm]
    );

    const scheduleDays = useMemo(() => {
        const dates = new Set(scheduledClasses.map(c => c.scheduleDate));
        return Array.from(dates).sort((a,b) => new Date(a) - new Date(b));
    }, [scheduledClasses]);
    
    const handleDragStart = event => setActiveId(event.active.id);
    
    const handleDragEnd = useCallback(event => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeClassId = active.id;
        const overId = over.id;
        
        setFormData(prev => {
            const newDisciplines = JSON.parse(JSON.stringify(prev.disciplines));

            const findDiscipline = (classId) => newDisciplines.find(d => d.divisionOrder?.includes(classId));

            const activeDiscipline = findDiscipline(activeClassId);
            if (!activeDiscipline) return prev;

            const overIsArena = over.data.current?.sortable?.containerId;
            
            if (overIsArena) { // Dropping into an empty arena
                const arenaId = over.id;
                const date = over.data.current.sortable.items.find(i => i.id === over.id)?.data.current.date; // This is tricky, need better way
                const overEl = document.querySelector(`[data-sortable-id="${over.id}"]`);
                const dayDate = overEl?.closest('[data-date]')?.dataset.date;

                if (!activeDiscipline.divisionDates) activeDiscipline.divisionDates = {};
                if (!activeDiscipline.divisionArenaIds) activeDiscipline.divisionArenaIds = {};
                if (!activeDiscipline.divisionOrders) activeDiscipline.divisionOrders = {};

                activeDiscipline.divisionDates[activeClassId] = dayDate;
                activeDiscipline.divisionArenaIds[activeClassId] = arenaId;
                activeDiscipline.divisionOrders[activeClassId] = 0; // Add to top
            } else { // Dropping on another item or in a list
                const overDiscipline = findDiscipline(overId);
                if (!overDiscipline) return prev;

                const targetDate = overDiscipline.divisionDates?.[overId];
                const targetArena = overDiscipline.divisionArenaIds?.[overId];

                if (!activeDiscipline.divisionDates) activeDiscipline.divisionDates = {};
                if (!activeDiscipline.divisionArenaIds) activeDiscipline.divisionArenaIds = {};
                if (!activeDiscipline.divisionOrders) activeDiscipline.divisionOrders = {};

                activeDiscipline.divisionDates[activeClassId] = targetDate;
                activeDiscipline.divisionArenaIds[activeClassId] = targetArena;

                // Reordering logic
                const classesInTargetList = allClassItems
                    .filter(c => c.scheduleDate === targetDate && c.arenaId === targetArena)
                    .sort((a, b) => a.order - b.order);
                
                const oldIndex = classesInTargetList.findIndex(c => c.id === activeClassId);
                const newIndex = classesInTargetList.findIndex(c => c.id === overId);

                if (oldIndex !== -1) classesInTargetList.splice(oldIndex, 1);
                classesInTargetList.splice(newIndex, 0, allClassItems.find(c => c.id === activeClassId));

                classesInTargetList.forEach((item, index) => {
                    const disc = findDiscipline(item.id);
                    if (disc) {
                        if (!disc.divisionOrders) disc.divisionOrders = {};
                        disc.divisionOrders[item.id] = index;
                    }
                });
            }

            return { ...prev, disciplines: newDisciplines };
        });
    }, [allClassItems, setFormData]);
    
    const handleAddDay = () => {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + scheduleDays.length + 1);
        const dateString = newDate.toISOString().split('T')[0];
        
        if (unassignedClasses.length > 0) {
            handleQuickAssign(dateString, [unassignedClasses[0].id]);
        } else {
            alert("Please ensure there is at least one unassigned class to create a new day.");
        }
    };

    const handleRemoveDay = (date) => {
        setFormData(prev => {
            const newDisciplines = prev.disciplines.map(disc => {
                const newDates = { ...disc.divisionDates };
                const newArenas = { ...disc.divisionArenaIds };
                Object.keys(newDates).forEach(key => {
                    if (newDates[key] === date) {
                        delete newDates[key];
                        if (newArenas[key]) delete newArenas[key];
                    }
                });
                return { ...disc, divisionDates: newDates, divisionArenaIds: newArenas };
            });
            return { ...prev, disciplines: newDisciplines };
        });
    };

    const handleSelectUnassigned = (id) => {
        setSelectedUnassigned(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    
    const handleSelectAllUnassigned = (checked) => {
        setSelectedUnassigned(checked ? filteredUnassigned.map(c => c.id) : []);
    };
    
    const handleQuickAssign = (date, classIds = selectedUnassigned) => {
        if (!date || classIds.length === 0) return;
        const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
        const firstArenaId = formData.arenas?.[0]?.id;

        if (!firstArenaId) {
            alert("Please add an arena in 'Details & Staff' step first.");
            return;
        }

        setFormData(prev => {
            const newDisciplines = prev.disciplines.map(disc => {
                let wasModified = false;
                const newDates = { ...(disc.divisionDates || {}) };
                const newArenas = { ...(disc.divisionArenaIds || {}) };
                
                (disc.divisionOrder || []).forEach(divId => {
                    if (classIds.includes(divId)) {
                        newDates[divId] = dateString;
                        newArenas[divId] = firstArenaId;
                        wasModified = true;
                    }
                });

                if (wasModified) {
                    return { ...disc, divisionDates: newDates, divisionArenaIds: newArenas };
                }
                return disc;
            });
            return { ...prev, disciplines: newDisciplines };
        });
        setSelectedUnassigned([]);
    };

    const activeClassItem = activeId ? allClassItems.find(c => c.id === activeId) : null;

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <UnassignedClassesPalette 
                        classes={filteredUnassigned}
                        selected={selectedUnassigned}
                        onSelect={handleSelectUnassigned}
                        onSelectAll={handleSelectAllUnassigned}
                        onSearch={setSearchTerm}
                        onQuickAssign={handleQuickAssign}
                        searchTerm={searchTerm}
                        formData={formData}
                        associationsData={associationsData}
                    />
                </div>
                <div className="lg:col-span-2 space-y-4">
                    {scheduleDays.map(day => (
                        <DaySchedule 
                            key={day}
                            date={day}
                            arenas={formData.arenas || []}
                            classes={scheduledClasses.filter(c => c.scheduleDate === day)}
                            onRemoveDay={handleRemoveDay}
                            setFormData={setFormData}
                            formData={formData}
                            associationsData={associationsData}
                        />
                    ))}
                     <Button variant="outline" onClick={handleAddDay}><PlusCircle className="h-4 w-4 mr-2"/>Add Competition Day</Button>
                </div>
            </div>
            <DragOverlay>
                {activeId && activeClassItem ? <DraggableClassItem id={activeId} classItem={activeClassItem} formData={formData} isDragging associationsData={associationsData} /> : null}
            </DragOverlay>
        </DndContext>
    );
};

export const Step4_OrganizeSchedule = ({ formData, setFormData }) => {
    const disciplines = formData?.disciplines || [];

    if (disciplines.length === 0) {
        return (
            <motion.div key="step5" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardHeader>
                    <CardTitle>Step 6: Organize Schedule</CardTitle>
                    <CardDescription>Drag classes to schedule them by day and arena. The order of classes determines the schedule for the day.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No classes to schedule yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">Go back to Step 3 to configure your disciplines and create classes.</p>
                    </div>
                </CardContent>
            </motion.div>
        );
    }
    
    return (
        <motion.div key="step5" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 6: Organize Schedule</CardTitle>
                <CardDescription>Drag classes to schedule them by day and arena. Use quick assign for bulk scheduling. The order of classes determines the schedule for the day.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScheduleContent formData={formData} setFormData={setFormData} />
            </CardContent>
        </motion.div>
    );
};