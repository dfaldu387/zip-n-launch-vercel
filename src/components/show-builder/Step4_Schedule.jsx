import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Undo, Redo, Save, AlertTriangle, Search, GripVertical } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

const ScheduleClassItem = React.forwardRef(({ pbbClass, associationsData, ...props }, ref) => {
    const getAssociationBadges = () => {
        const selectedAssocIds = Object.keys(pbbClass.selectedAssociations);
        const assocs = selectedAssocIds
            .filter(assocId => !(assocId === 'NSBA' && pbbClass.isDualApproved))
            .map(assocId => {
                const assoc = associationsData.find(a => a.id === assocId);
                return <Badge key={assocId} variant="secondary" className="text-xs px-1 py-0">{assoc?.name || assocId}</Badge>;
            });

        if (pbbClass.isDualApproved) {
             assocs.push(<Badge key="nsba-da" variant="outline" className="text-xs px-1 py-0 font-bold border-green-600 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">NSBA D-A</Badge>);
        }
        return assocs;
    }

    return (
        <div ref={ref} {...props} className="p-2 border rounded-lg bg-background cursor-grab active:cursor-grabbing touch-none">
            <div className="flex items-start gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex-grow">
                    <p className="text-sm font-semibold leading-tight">{pbbClass.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {getAssociationBadges()}
                    </div>
                </div>
            </div>
        </div>
    );
});

const UnscheduledClass = ({ pbbClass, associationsData }) => {
    return <ScheduleClassItem pbbClass={pbbClass} associationsData={associationsData} />;
};

const ScheduleHeader = ({ showName, startDate, endDate, onSave }) => {
    const { toast } = useToast();
    const handleNotImplemented = () => {
        toast({
            title: "🚧 Feature Not Implemented",
            description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
        });
    };

    return (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm -mx-6 px-6 py-3 border-b mb-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">{showName || "Untitled Show"}</h2>
                    <p className="text-sm text-muted-foreground">{startDate} - {endDate || startDate}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleNotImplemented}><Undo className="h-4 w-4 mr-2" />Undo</Button>
                    <Button variant="outline" size="sm" onClick={handleNotImplemented}><Redo className="h-4 w-4 mr-2" />Redo</Button>
                    <Button size="sm" onClick={onSave}><Save className="h-4 w-4 mr-2" />Save Schedule</Button>
                </div>
            </div>
        </div>
    );
};

const DateTabs = ({ startDate, endDate, selectedDate, setSelectedDate }) => {
    const dates = useMemo(() => {
        if (!startDate || !endDate) return startDate ? [startDate] : [];
        const list = [];
        let current = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        while (current <= end) {
            list.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return list;
    }, [startDate, endDate]);

    if (dates.length <= 1) return null;

    return (
        <div className="sticky top-[77px] z-10 bg-background/80 backdrop-blur-sm -mx-6 px-6 py-2 border-b mb-4">
            <Tabs value={selectedDate} onValueChange={setSelectedDate}>
                <TabsList>
                    {dates.map(date => (
                        <TabsTrigger key={date} value={date}>
                            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );
};

const ClassPalette = ({ classes, associationsData }) => {
    const { toast } = useToast();
    const handleNotImplemented = () => {
        toast({
            title: "🚧 Feature Not Implemented",
            description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
        });
    };

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-2 px-1">Class Palette & Tools</h3>
            <div className="relative mb-4">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search classes..." className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={handleNotImplemented}>Insert Break</Button>
                <Button variant="outline" size="sm" onClick={handleNotImplemented}>Insert Drag</Button>
                <Button variant="outline" size="sm" onClick={handleNotImplemented}>Insert Ceremony</Button>
            </div>
            <Label className="text-sm font-medium text-muted-foreground px-1">Unscheduled Classes</Label>
            <ScrollArea className="flex-grow mt-2 border rounded-lg p-2 bg-muted/30">
                <div className="space-y-2">
                    {classes.map(pbbClass => (
                        <UnscheduledClass key={pbbClass.id} pbbClass={pbbClass} associationsData={associationsData} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};

const ScheduleCanvas = ({ arenas }) => {
    const timeSlots = Array.from({ length: 16 * 4 }, (_, i) => {
        const hour = Math.floor(i / 4) + 6; // 6 AM to 9 PM
        const minute = (i % 4) * 15;
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    });

    const validArenas = arenas.filter(a => a.name.trim() !== '');

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-2 px-1">Day Scheduler</h3>
            <ScrollArea className="flex-grow border rounded-lg relative">
                {validArenas.length > 0 ? (
                    <div className="grid" style={{ gridTemplateColumns: `60px repeat(${validArenas.length}, minmax(150px, 1fr))` }}>
                        {/* Header */}
                        <div className="sticky top-0 bg-background z-10"></div>
                        {validArenas.map(arena => (
                            <div key={arena.id} className="sticky top-0 bg-background z-10 p-2 border-b border-l text-center font-semibold">
                                {arena.name}
                            </div>
                        ))}

                        {/* Time slots and grid lines */}
                        {timeSlots.map((time, index) => (
                            <React.Fragment key={time}>
                                <div className={cn("flex items-start justify-center text-xs text-muted-foreground h-12", index % 4 === 0 ? "border-t" : "")}>
                                    {index % 4 === 0 && <span className="-translate-y-2">{time}</span>}
                                </div>
                                {validArenas.map(arena => (
                                    <div key={`${arena.id}-${time}`} className={cn("h-12 border-l", index % 4 === 0 ? "border-t" : "border-t border-dashed border-muted-foreground/20")}>
                                        {/* Drop zone content here */}
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>Please add and name arenas in Step 4: Show Details.</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};

const ConflictsPanel = () => {
    return (
        <div className="h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-2 px-1">Conflicts & Insights</h3>
            <div className="flex-grow border rounded-lg p-4 bg-muted/30">
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="font-semibold">No conflicts detected.</p>
                    <p className="text-sm text-muted-foreground">Conflicts will appear here as you build the schedule.</p>
                </div>
            </div>
        </div>
    );
};

export const Step4_Schedule = ({ formData, setFormData }) => {
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState(formData.startDate);
    const [activeClass, setActiveClass] = useState(null);
    const [associationsData, setAssociationsData] = useState([]);

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

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const unscheduledClasses = useMemo(() => {
        // For now, all classes are unscheduled
        return formData.classes;
    }, [formData.classes]);

    const arenas = useMemo(() => {
        return formData.arenas || [];
    }, [formData.arenas]);

    const handleSave = () => {
        toast({
            title: "🚧 Save In Progress",
            description: "This will save your schedule layout. Functionality coming soon!",
        });
    };

    const handleDragStart = (event) => {
        const { active } = event;
        const pbbClass = unscheduledClasses.find(c => c.id === active.id);
        if (pbbClass) {
            setActiveClass(pbbClass);
        }
    };

    const handleDragEnd = (event) => {
        setActiveClass(null);
        toast({
            title: "🚧 Drop Functionality Coming Soon!",
            description: "You'll soon be able to drop classes into the schedule. Stay tuned!",
        });
    };

    return (
        <motion.div key="step5" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader>
                <CardTitle>Step 6: Organize Schedule</CardTitle>
                <CardDescription>Drag and drop classes from the palette to the schedule. The system will help you manage times, arenas, and conflicts.</CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100vh-350px)]">
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <ScheduleHeader showName={formData.showName} startDate={formData.startDate} endDate={formData.endDate} onSave={handleSave} />
                    <DateTabs startDate={formData.startDate} endDate={formData.endDate} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                        <div className="lg:col-span-3 h-full">
                            <ClassPalette classes={unscheduledClasses} associationsData={associationsData} />
                        </div>
                        <div className="lg:col-span-6 h-full">
                            <ScheduleCanvas arenas={arenas} />
                        </div>
                        <div className="lg:col-span-3 h-full">
                            <ConflictsPanel />
                        </div>
                    </div>
                    <DragOverlay>
                        {activeClass ? <ScheduleClassItem pbbClass={activeClass} associationsData={associationsData} /> : null}
                    </DragOverlay>
                </DndContext>
            </CardContent>
        </motion.div>
    );
};