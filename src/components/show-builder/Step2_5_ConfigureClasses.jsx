import React, { useState, useMemo, useEffect } from 'react';
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
import { GripVertical, Search, Calendar, PlusCircle, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

const assocColors = {
  AQHA: 'shadow-red-500/50',
  APHA: 'shadow-blue-500/50',
  APHC: 'shadow-orange-500/50',
  NSBA: 'shadow-green-500/50',
  PTHA: 'shadow-purple-500/50',
  PHBA: 'shadow-yellow-500/50',
  default: 'shadow-gray-500/50'
};

const getAssociationColorClass = (pbbDiscipline) => {
    const primaryAssocId = Object.keys(pbbDiscipline.selectedAssociations)[0];
    return assocColors[primaryAssocId] || assocColors.default;
};

const DraggableDisciplineItem = React.forwardRef(({ id, pbbDiscipline, isSelected, onSelect, isDragging, associationsData, ...props }, ref) => {
    const { attributes, listeners, setNodeRef: setSortableNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    const getAssociationBadges = () => {
        const selectedAssocIds = Object.keys(pbbDiscipline.selectedAssociations);
        const assocs = selectedAssocIds.map(assocId => {
            if (assocId === 'NSBA' && pbbDiscipline.isDualApproved) return null;
            const assoc = associationsData.find(a => a.id === assocId);
            return <Badge key={assocId} variant={assoc?.color || 'secondary'} className="text-xs">{assoc?.name || assocId}</Badge>;
        }).filter(Boolean);

        if (pbbDiscipline.isDualApproved) {
            assocs.push(<Badge key="nsba-da" variant="dualApproved" className="text-xs">NSBA D-A</Badge>);
        }
        return assocs;
    };
    
    return (
        <div ref={setSortableNodeRef} style={style} className={cn("flex items-center gap-2 p-2 border rounded-lg bg-background touch-none shadow-md", getAssociationColorClass(pbbDiscipline), isDragging ? 'opacity-50' : '')}>
            <Checkbox checked={isSelected} onCheckedChange={onSelect} />
            <div ref={ref} {...props} {...attributes} {...listeners} className="flex-grow flex items-center gap-2 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <div className="flex-grow">
                    <p className="font-semibold">{pbbDiscipline.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">{getAssociationBadges()}</div>
                </div>
            </div>
        </div>
    );
});


const UnassignedDisciplinesPalette = ({ disciplines, selected, onSelect, onSelectAll, onSearch, onQuickAssign, searchTerm, associationsData }) => (
    <div className="p-4 border rounded-lg h-full flex flex-col gap-4 bg-muted/20">
        <h3 className="text-lg font-bold">Unassigned Disciplines</h3>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search disciplines..." className="pl-9" value={searchTerm} onChange={e => onSearch(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
             <div className="flex items-center space-x-2">
                <Checkbox id="select-all-unassigned" checked={selected.length === disciplines.length && disciplines.length > 0} onCheckedChange={onSelectAll} />
                <Label htmlFor="select-all-unassigned">Select All</Label>
            </div>
            {selected.length > 0 && (
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm"><Calendar className="h-4 w-4 mr-2" /> Quick Assign Date</Button>
                    </PopoverTrigger>
                    <PopoverContent>
                        <CalendarPicker
                            mode="single"
                            onSelect={date => onQuickAssign(date)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            )}
        </div>
        <ScrollArea className="flex-grow bg-background border rounded-md p-2">
            <SortableContext items={disciplines.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {disciplines.map(pbbDiscipline => (
                        <DraggableDisciplineItem
                            key={pbbDiscipline.id}
                            id={pbbDiscipline.id}
                            pbbDiscipline={pbbDiscipline}
                            isSelected={selected.includes(pbbDiscipline.id)}
                            onSelect={() => onSelect(pbbDiscipline.id)}
                            associationsData={associationsData}
                        />
                    ))}
                </div>
            </SortableContext>
        </ScrollArea>
    </div>
);

const DaySchedule = ({ date, arenas, disciplines, onUpdateDiscipline, onRemoveDay, associationsData }) => {
    const [openArenaId, setOpenArenaId] = useState(arenas[0]?.id);

    return (
        <div className="p-4 border rounded-lg bg-muted/20">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                <Button variant="destructive" size="sm" onClick={() => onRemoveDay(date)}><Trash2 className="h-4 w-4 mr-2"/>Remove Day</Button>
            </div>
            <Tabs value={openArenaId} onValueChange={setOpenArenaId} className="w-full">
                <TabsList>
                    {arenas.map(arena => <TabsTrigger key={arena.id} value={arena.id}>{arena.name}</TabsTrigger>)}
                </TabsList>
                {arenas.map(arena => (
                    <TabsContent key={arena.id} value={arena.id}>
                        <SortableContext items={disciplines.filter(c => c.arenaId === arena.id).map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2 p-2 border-2 border-dashed rounded-md min-h-[150px]">
                                {disciplines.filter(c => c.arenaId === arena.id).map(pbbDiscipline => (
                                    <DraggableDisciplineItem
                                        key={pbbDiscipline.id}
                                        id={pbbDiscipline.id}
                                        pbbDiscipline={pbbDiscipline}
                                        associationsData={associationsData}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

export const Step2_5_ConfigureClasses = ({ formData, setFormData }) => {
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

    const scheduledDisciplines = useMemo(() => formData.disciplines.filter(c => c.scheduleDate), [formData.disciplines]);
    const unassignedDisciplines = useMemo(() => formData.disciplines.filter(c => !c.scheduleDate), [formData.disciplines]);

    const filteredUnassigned = useMemo(() =>
        unassignedDisciplines.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [unassignedDisciplines, searchTerm]
    );

    const scheduleDays = useMemo(() => {
        const dates = new Set(scheduledDisciplines.map(c => c.scheduleDate));
        return Array.from(dates).sort((a,b) => new Date(a) - new Date(b));
    }, [scheduledDisciplines]);
    
    const handleDragStart = event => setActiveId(event.active.id);

    const handleDragEnd = event => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;
        
        const activeDiscipline = formData.disciplines.find(c => c.id === active.id);
        if (!activeDiscipline) return;

        const isMovingWithinUnassigned = unassignedDisciplines.some(c => c.id === active.id) && unassignedDisciplines.some(c => c.id === over.id);
        if (isMovingWithinUnassigned) {
             setFormData(prev => {
                const oldIndex = prev.disciplines.findIndex(c => c.id === active.id);
                const newIndex = prev.disciplines.findIndex(c => c.id === over.id);
                return {...prev, disciplines: arrayMove(prev.disciplines, oldIndex, newIndex) };
             });
             return;
        }

        let targetDate, targetArenaId;
        const overEl = document.getElementById(over.id);
        const parentTabsContent = overEl?.closest('[role="tabpanel"]');
        if (parentTabsContent) {
            targetArenaId = parentTabsContent.getAttribute('data-value');
            const parentDayDiv = parentTabsContent.closest('.p-4.border.rounded-lg');
            targetDate = scheduleDays.find(day => parentDayDiv?.innerHTML.includes(new Date(day + 'T00:00:00').toLocaleDateString()));
        } else {
             // Handle drop on another item
            const overDiscipline = formData.disciplines.find(c => c.id === over.id);
            if(overDiscipline && overDiscipline.scheduleDate) {
                targetDate = overDiscipline.scheduleDate;
                targetArenaId = overDiscipline.arenaId;
            }
        }
        
        if (targetDate && targetArenaId) {
             setFormData(prev => {
                const updatedDisciplines = prev.disciplines.map(c => c.id === active.id ? { ...c, scheduleDate: targetDate, arenaId: targetArenaId } : c);
                const oldIndex = updatedDisciplines.findIndex(c => c.id === active.id);
                const newIndex = updatedDisciplines.findIndex(c => c.id === over.id);
                if (oldIndex !== -1 && newIndex !== -1) {
                    return {...prev, disciplines: arrayMove(updatedDisciplines, oldIndex, newIndex)};
                }
                return {...prev, disciplines: updatedDisciplines };
            });
        }
    };
    
    const handleAddDay = () => {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + scheduleDays.length);
        const dateString = newDate.toISOString().split('T')[0];
        
        // This doesn't add a discipline, just makes a new day appear if there aren't any.
        // It relies on disciplines being assigned to a date to create the day.
        // Let's find an unassigned discipline and assign it.
        const firstUnassigned = unassignedDisciplines[0];
        if (firstUnassigned) {
            handleQuickAssign(dateString, [firstUnassigned.id]);
        }
    };

    const handleRemoveDay = (date) => {
        setFormData(prev => ({
            ...prev,
            disciplines: prev.disciplines.map(c => c.scheduleDate === date ? { ...c, scheduleDate: null, arenaId: null } : c)
        }));
    };

    const handleSelectUnassigned = (id) => {
        setSelectedUnassigned(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    
    const handleSelectAllUnassigned = (checked) => {
        setSelectedUnassigned(checked ? filteredUnassigned.map(c => c.id) : []);
    };
    
    const handleQuickAssign = (date, disciplineIds = selectedUnassigned) => {
        if (!date || disciplineIds.length === 0) return;
        const dateString = date.toISOString().split('T')[0];
        const firstArenaId = formData.arenas?.[0]?.id;

        setFormData(prev => ({
            ...prev,
            disciplines: prev.disciplines.map(c => disciplineIds.includes(c.id) ? { ...c, scheduleDate: dateString, arenaId: firstArenaId } : c)
        }));
        setSelectedUnassigned([]);
    };

    const activeDiscipline = activeId ? formData.disciplines.find(c => c.id === activeId) : null;
    
    return (
        <motion.div key="step2_5" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 6: Organize Schedule</CardTitle>
                <CardDescription>Drag disciplines to schedule them by day and arena. Use quick assign for bulk scheduling. The order of disciplines determines the schedule for the day.</CardDescription>
            </CardHeader>
            <CardContent>
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <UnassignedDisciplinesPalette 
                                disciplines={filteredUnassigned}
                                selected={selectedUnassigned}
                                onSelect={handleSelectUnassigned}
                                onSelectAll={handleSelectAllUnassigned}
                                onSearch={setSearchTerm}
                                onQuickAssign={handleQuickAssign}
                                searchTerm={searchTerm}
                                associationsData={associationsData}
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-4">
                            {scheduleDays.map(day => (
                                <DaySchedule 
                                    key={day}
                                    date={day}
                                    arenas={formData.arenas || []}
                                    disciplines={scheduledDisciplines.filter(c => c.scheduleDate === day)}
                                    onRemoveDay={handleRemoveDay}
                                    associationsData={associationsData}
                                />
                            ))}
                             <Button variant="outline" onClick={handleAddDay}><PlusCircle className="h-4 w-4 mr-2"/>Add Competition Day</Button>
                        </div>
                    </div>
                    <DragOverlay>
                        {activeId && activeDiscipline ? <DraggableDisciplineItem id={activeId} pbbDiscipline={activeDiscipline} isDragging associationsData={associationsData} /> : null}
                    </DragOverlay>
                </DndContext>
            </CardContent>
        </motion.div>
    );
};