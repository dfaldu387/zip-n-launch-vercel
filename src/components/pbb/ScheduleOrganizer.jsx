import React, { useState, useMemo } from 'react';
    import { parseDivisionId } from '@/lib/showBillUtils';
    import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
    import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
    import { CSS } from '@dnd-kit/utilities';
    import { GripVertical, Calendar as CalendarIcon, X, Plus, Check } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Badge } from '@/components/ui/badge';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';
    import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { format } from 'date-fns';
    import { parseLocalDate } from '@/lib/utils';

    const SortableDivisionItem = ({
        divisionIdentifier,
        onSelectionChange,
        isSelected,
        go1Date,
        go2Date,
        hasGo2,
        customTitle,
        onTitleChange,
        onDateClear,
        onRemoveGo2,
        formData,
        pbbDiscipline,
        associationsData,
    }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: divisionIdentifier });
        const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
        const [isEditing, setIsEditing] = useState(false);
        const [editValue, setEditValue] = useState('');

    const { assocId, divisionName: originalDivisionName } = parseDivisionId(divisionIdentifier);

    // Parse division name to extract tag and name
    const parseDivisionDisplay = (divName) => {
        const cleanName = divName.startsWith('custom-') ? divName.substring(7) : divName;
        const parts = cleanName.split(' - ');
        if (parts.length === 2) {
            return { tag: parts[0], name: parts[1] };
        }
        return { tag: null, name: cleanName };
    };

    const { tag: divisionTag, name: divisionName } = parseDivisionDisplay(originalDivisionName);

    const getAssociationBadges = () => {
        if (!pbbDiscipline || !formData) return [];

        const badges = [];
        const nsbaDualApprovedWith = formData.nsbaDualApprovedWith || [];

        // Add Discipline Badge first
        if (pbbDiscipline.name) {
            badges.push(<Badge key="discipline-badge" variant="outline" className="text-xs bg-gray-100 dark:bg-gray-800">{pbbDiscipline.name.replace(' at Halter', '')}</Badge>);
        }

        const assoc = associationsData.find(a => a.id === assocId);
        if (assoc) {
            badges.push(<Badge key={assocId} variant={assoc?.color || 'secondary'} className="text-xs">{assoc.abbreviation || assoc.name}</Badge>);

            if (pbbDiscipline.isDualApproved && nsbaDualApprovedWith.includes(assocId)) {
                badges.push(<Badge key={`${assocId}-da`} variant="dualApproved" className="text-xs">NSBA Dual-Approved</Badge>);
            }
        }

        if (pbbDiscipline.isNsbaStandalone && assocId === 'NSBA') {
            badges.push(<Badge key="nsba-standalone" variant="standalone" className="text-xs">NSBA Standalone</Badge>);
        }

        return badges;
    };

        return (
            <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-1.5 bg-background rounded-lg border shadow-sm touch-none">
                <Button variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing h-7 w-7">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Checkbox id={`select-${divisionIdentifier}`} checked={isSelected} onCheckedChange={(checked) => onSelectionChange(divisionIdentifier, checked)} />
        <div className="flex-grow text-sm min-w-0">
            {isEditing ? (
                <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                        onTitleChange(divisionIdentifier, editValue.trim() === divisionName ? '' : editValue.trim());
                        setIsEditing(false);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onTitleChange(divisionIdentifier, editValue.trim() === divisionName ? '' : editValue.trim());
                            setIsEditing(false);
                        }
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    className="h-7 text-sm"
                />
            ) : (
                <span
                    className="cursor-text hover:text-primary transition-colors"
                    onDoubleClick={() => {
                        setEditValue(customTitle || divisionName);
                        setIsEditing(true);
                    }}
                    title="Double-click to edit title"
                >
                    {customTitle || divisionName}
                </span>
            )}
        </div>
        {divisionTag && (
            <Badge variant="outline" className="text-xs rounded-full px-2">
                {divisionTag}
            </Badge>
        )}
                {/* Go 1 Date Badge - only show label if class has Go 2 */}
                {go1Date && (
                    <Badge variant="outline" className="flex items-center gap-1 border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                        <CalendarIcon className="h-3 w-3" />
                        {hasGo2 && <span className="font-medium">Go 1:</span>}
                        {format(parseLocalDate(go1Date), 'EEE, MMM d')}
                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-blue-100 dark:hover:bg-blue-900/40" onClick={() => onDateClear(divisionIdentifier, 'go1')}>
                            <X className="h-3 w-3" />
                        </Button>
                    </Badge>
                )}
                {/* Go 2 Date Badge */}
                {hasGo2 && go2Date && (
                    <Badge variant="outline" className="flex items-center gap-1 border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                        <CalendarIcon className="h-3 w-3" />
                        <span className="font-medium">Go 2:</span>
                        {format(parseLocalDate(go2Date), 'EEE, MMM d')}
                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40" onClick={() => onDateClear(divisionIdentifier, 'go2')}>
                            <X className="h-3 w-3" />
                        </Button>
                    </Badge>
                )}
                {/* Go 2 indicator (no date assigned yet) */}
                {hasGo2 && !go2Date && (
                    <Badge variant="outline" className="flex items-center gap-1 border-indigo-300 bg-indigo-50/50 text-indigo-600 dark:bg-indigo-900/10 dark:text-indigo-400">
                        <span className="font-medium">Go 2</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40" onClick={() => onRemoveGo2(divisionIdentifier)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </Badge>
                )}
                <div className="flex items-center gap-1 ml-auto">
                    {getAssociationBadges()}
                </div>
            </div>
        );
    };

    export const ScheduleOrganizer = ({ pbbDiscipline, setFormData, formData, associationsData }) => {
        const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
        const [selectedDivisions, setSelectedDivisions] = useState([]);
        const [go1DateForPopover, setGo1DateForPopover] = useState(null);
        const [go2DateForPopover, setGo2DateForPopover] = useState(null);
        const [activeDragId, setActiveDragId] = useState(null);

        const divisionsWithData = useMemo(() => {
            if (!pbbDiscipline) return [];
            return (pbbDiscipline.divisionOrder || []).map(divId => {
                const goInfo = pbbDiscipline.divisionGos?.[divId] || {};
                return {
                    id: divId,
                    go1Date: goInfo.go1Date || null,
                    go2Date: goInfo.go2Date || null,
                    hasGo2: goInfo.hasGo2 || false,
                    customTitle: (pbbDiscipline.divisionPrintTitles && pbbDiscipline.divisionPrintTitles[divId]) || ''
                };
            });
        }, [pbbDiscipline]);

        // Check if any selected division has Go 2 enabled
        const selectedHaveGo2 = useMemo(() => {
            if (selectedDivisions.length === 0) return false;
            return selectedDivisions.some(divId => {
                const goInfo = pbbDiscipline?.divisionGos?.[divId];
                return goInfo?.hasGo2;
            });
        }, [selectedDivisions, pbbDiscipline]);

        // Check if all selected divisions have Go 2 enabled
        const allSelectedHaveGo2 = useMemo(() => {
            if (selectedDivisions.length === 0) return false;
            return selectedDivisions.every(divId => {
                const goInfo = pbbDiscipline?.divisionGos?.[divId];
                return goInfo?.hasGo2;
            });
        }, [selectedDivisions, pbbDiscipline]);

        const groupedDivisions = useMemo(() => {
            const groups = divisionsWithData.reduce((acc, division) => {
                // Use Go 1 date as primary grouping, or Go 2 if no Go 1, or 'Unscheduled'
                const dateKey = division.go1Date || division.go2Date || 'Unscheduled';
                if (!acc[dateKey]) {
                    acc[dateKey] = [];
                }
                acc[dateKey].push(division);
                return acc;
            }, {});

            const sortedKeys = Object.keys(groups).sort((a, b) => {
                if (a === 'Unscheduled') return -1;
                if (b === 'Unscheduled') return 1;
                return parseLocalDate(a) - parseLocalDate(b);
            });

            const finalGroups = {};
            sortedKeys.forEach(key => {
                finalGroups[key] = groups[key];
            });
            return finalGroups;
        }, [divisionsWithData]);

        if (!pbbDiscipline) {
            return <div className="text-center p-4">Loading discipline data...</div>;
        }

        const handleDragStart = (event) => {
            setActiveDragId(event.active.id);
        };

        const handleDragEnd = (event) => {
            setActiveDragId(null);
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            if (active.id !== over.id) {
                setFormData(prev => {
                    const newDisciplines = prev.disciplines.map(disc => {
                        if (disc.id === pbbDiscipline.id) {
                            const oldIndex = disc.divisionOrder.findIndex(id => id === active.id);
                            const newIndex = disc.divisionOrder.findIndex(id => id === over.id);
                            const newDivisionOrder = arrayMove(disc.divisionOrder, oldIndex, newIndex);
                            return { ...disc, divisionOrder: newDivisionOrder };
                        }
                        return disc;
                    });
                    return { ...prev, disciplines: newDisciplines };
                });
            }
        };

        const handleSelectionChange = (divisionId, isChecked) => {
            setSelectedDivisions(prev => isChecked ? [...prev, divisionId] : prev.filter(id => id !== divisionId));
        };

        // Apply Go 1 date to selected divisions
        const handleApplyGo1Date = (date) => {
            if (!date || selectedDivisions.length === 0) return;
            const dateString = format(date, 'yyyy-MM-dd');

            setFormData(prev => {
                const newDisciplines = prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        const newDivisionGos = { ...(disc.divisionGos || {}) };
                        selectedDivisions.forEach(divId => {
                            newDivisionGos[divId] = {
                                ...(newDivisionGos[divId] || { hasGo2: false, go2Date: null }),
                                go1Date: dateString
                            };
                        });
                        return { ...disc, divisionGos: newDivisionGos };
                    }
                    return disc;
                });
                return { ...prev, disciplines: newDisciplines };
            });
            setSelectedDivisions([]);
        };

        // Apply Go 2 date to selected divisions (only those with Go 2 enabled)
        const handleApplyGo2Date = (date) => {
            if (!date || selectedDivisions.length === 0) return;
            const dateString = format(date, 'yyyy-MM-dd');

            setFormData(prev => {
                const newDisciplines = prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        const newDivisionGos = { ...(disc.divisionGos || {}) };
                        selectedDivisions.forEach(divId => {
                            // Only apply Go 2 date if Go 2 is enabled for this division
                            if (newDivisionGos[divId]?.hasGo2) {
                                newDivisionGos[divId] = {
                                    ...newDivisionGos[divId],
                                    go2Date: dateString
                                };
                            }
                        });
                        return { ...disc, divisionGos: newDivisionGos };
                    }
                    return disc;
                });
                return { ...prev, disciplines: newDisciplines };
            });
            setSelectedDivisions([]);
        };

        // Toggle Go 2 for selected divisions
        const handleToggleGo2 = () => {
            if (selectedDivisions.length === 0) return;

            setFormData(prev => {
                const newDisciplines = prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        const newDivisionGos = { ...(disc.divisionGos || {}) };
                        selectedDivisions.forEach(divId => {
                            const currentGoInfo = newDivisionGos[divId] || { go1Date: null, go2Date: null, hasGo2: false };
                            // Toggle: if all selected have Go 2, remove it; otherwise add it
                            newDivisionGos[divId] = {
                                ...currentGoInfo,
                                hasGo2: !allSelectedHaveGo2,
                                // Clear Go 2 date if removing Go 2
                                go2Date: allSelectedHaveGo2 ? null : currentGoInfo.go2Date
                            };
                        });
                        return { ...disc, divisionGos: newDivisionGos };
                    }
                    return disc;
                });
                return { ...prev, disciplines: newDisciplines };
            });
        };

        // Remove Go 2 from a single division
        const handleRemoveGo2 = (divisionId) => {
            setFormData(prev => ({
                ...prev,
                disciplines: prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        const newDivisionGos = { ...(disc.divisionGos || {}) };
                        if (newDivisionGos[divisionId]) {
                            newDivisionGos[divisionId] = {
                                ...newDivisionGos[divisionId],
                                hasGo2: false,
                                go2Date: null
                            };
                        }
                        return { ...disc, divisionGos: newDivisionGos };
                    }
                    return disc;
                })
            }));
        };

        const handleDateClear = (divisionId, dateType) => {
            setFormData(prev => ({
                ...prev,
                disciplines: prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        const newDivisionGos = { ...(disc.divisionGos || {}) };
                        if (newDivisionGos[divisionId]) {
                            if (dateType === 'go1') {
                                newDivisionGos[divisionId] = {
                                    ...newDivisionGos[divisionId],
                                    go1Date: null
                                };
                            } else if (dateType === 'go2') {
                                newDivisionGos[divisionId] = {
                                    ...newDivisionGos[divisionId],
                                    go2Date: null
                                };
                            }
                        }
                        return { ...disc, divisionGos: newDivisionGos };
                    }
                    return disc;
                })
            }));
        };

        const handlePrintTitleChange = (divisionId, newTitle) => {
            setFormData(prev => ({
                ...prev,
                disciplines: prev.disciplines.map(disc => {
                    if (disc.id === pbbDiscipline.id) {
                        const newDivisionPrintTitles = { ...(disc.divisionPrintTitles || {}) };
                        if (newTitle) {
                            newDivisionPrintTitles[divisionId] = newTitle;
                        } else {
                            delete newDivisionPrintTitles[divisionId];
                        }
                        return { ...disc, divisionPrintTitles: newDivisionPrintTitles };
                    }
                    return disc;
                })
            }));
        };

        const handleOverallPrintTitleChange = (e) => {
            const newTitle = e.target.value;
            setFormData(prev => ({
                ...prev,
                disciplines: prev.disciplines.map(disc =>
                    disc.id === pbbDiscipline.id ? { ...disc, printTitle: newTitle } : disc
                )
            }));
        };

        const areAllSelected = divisionsWithData.length > 0 && selectedDivisions.length === divisionsWithData.length;

        // Check if all divisions have at least a Go 1 date assigned
        const allDatesAssigned = divisionsWithData.length > 0 && divisionsWithData.every(d => !!d.go1Date);

        const toggleSelectAll = (checked) => {
            if (checked) {
                setSelectedDivisions(divisionsWithData.map(d => d.id));
            } else {
                setSelectedDivisions([]);
            }
        };

        return (
            <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                    Organize the general class schedule. Drag to reorder. Select classes to apply a date or add Go 2.
                </p>

                <div className="p-3 border rounded-lg bg-background space-y-2">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox id={`select-all-${pbbDiscipline.id}`} checked={areAllSelected} onCheckedChange={toggleSelectAll} />
                                <Label htmlFor={`select-all-${pbbDiscipline.id}`} className="text-sm font-medium">Select All</Label>
                            </div>
                            {/* Go 1 Date Picker */}
                            <Popover onOpenChange={(open) => {
                                if (open && selectedDivisions.length > 0) {
                                    const firstSelectedDiv = divisionsWithData.find(d => d.id === selectedDivisions[0]);
                                    if (firstSelectedDiv?.go1Date) {
                                        setGo1DateForPopover(new Date(firstSelectedDiv.go1Date));
                                    } else {
                                        setGo1DateForPopover(null);
                                    }
                                }
                            }}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={selectedDivisions.length === 0}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedHaveGo2 ? 'Go 1 Date' : 'Assign Date'} ({selectedDivisions.length})
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={go1DateForPopover}
                                        onSelect={(newDate) => {
                                            setGo1DateForPopover(newDate);
                                            handleApplyGo1Date(newDate);
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            {/* Add/Remove Go 2 Toggle */}
                            <Button
                                variant={allSelectedHaveGo2 ? "default" : "outline"}
                                size="sm"
                                disabled={selectedDivisions.length === 0}
                                onClick={handleToggleGo2}
                            >
                                {allSelectedHaveGo2 ? (
                                    <Check className="mr-2 h-4 w-4" />
                                ) : (
                                    <Plus className="mr-2 h-4 w-4" />
                                )}
                                Go 2 ({selectedDivisions.length})
                            </Button>
                            {/* Go 2 Date Picker - only show when some selected divisions have Go 2 */}
                            {selectedHaveGo2 && (
                                <Popover onOpenChange={(open) => {
                                    if (open && selectedDivisions.length > 0) {
                                        const firstSelectedDiv = divisionsWithData.find(d => d.id === selectedDivisions[0]);
                                        if (firstSelectedDiv?.go2Date) {
                                            setGo2DateForPopover(new Date(firstSelectedDiv.go2Date));
                                        } else {
                                            setGo2DateForPopover(null);
                                        }
                                    }
                                }}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={selectedDivisions.length === 0}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            Go 2 Date
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={go2DateForPopover}
                                            onSelect={(newDate) => {
                                                setGo2DateForPopover(newDate);
                                                handleApplyGo2Date(newDate);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                        {formData?.showName && (
                            <div className="text-xs font-medium text-muted-foreground">
                                Horse Show: {formData.showName}
                            </div>
                        )}
                    </div>

                    <div>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                            <SortableContext items={divisionsWithData.map(d => d.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                     {Object.entries(groupedDivisions).map(([dateKey, divisions]) => (
                                        <div key={dateKey}>
                                            <h4 className="font-semibold text-xs mb-1.5 pb-1 border-b">
                                                {dateKey === 'Unscheduled' ? 'Unscheduled' : format(parseLocalDate(dateKey), 'EEEE, MMMM d, yyyy')}
                                            </h4>
                                            <div className="space-y-1.5">
                                                {divisions.map(({ id, go1Date, go2Date, hasGo2, customTitle }) => (
                                                    <SortableDivisionItem
                                                        key={id}
                                                        divisionIdentifier={id}
                                                        isSelected={selectedDivisions.includes(id)}
                                                        onSelectionChange={handleSelectionChange}
                                                        go1Date={go1Date}
                                                        go2Date={go2Date}
                                                        hasGo2={hasGo2}
                                                        customTitle={customTitle}
                                                        onTitleChange={handlePrintTitleChange}
                                                        onDateClear={handleDateClear}
                                                        onRemoveGo2={handleRemoveGo2}
                                                        formData={formData}
                                                        pbbDiscipline={pbbDiscipline}
                                                        associationsData={associationsData}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SortableContext>
                            <DragOverlay>
                                {activeDragId && (() => {
                                    const divData = divisionsWithData.find(d => d.id === activeDragId);
                                    if (!divData) return null;
                                    const parts = activeDragId.split('-');
                                    const divName = parts.slice(1).join('-');
                                    const cleanName = divName.startsWith('custom-') ? divName.substring(7) : divName;
                                    const nameParts = cleanName.split(' - ');
                                    const displayName = nameParts.length === 2 ? nameParts[1] : cleanName;
                                    return (
                                        <div className="flex items-center gap-2 p-1.5 bg-background rounded-lg border shadow-lg cursor-grabbing">
                                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-semibold">{divData.customTitle || displayName}</span>
                                        </div>
                                    );
                                })()}
                            </DragOverlay>
                        </DndContext>
                    </div>
                </div>
                {/* Subtle prompt when all dates are assigned */}
                {allDatesAssigned && (
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 animate-in fade-in duration-300">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <p className="text-xs text-green-700 dark:text-green-300">
                            All dates assigned. You can now proceed to <span className="font-semibold">Tab 3 — Group Patterns</span> to organize divisions into pattern groups.
                        </p>
                    </div>
                )}
            </div>
        );
    };
