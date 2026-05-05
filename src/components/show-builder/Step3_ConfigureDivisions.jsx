import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, pointerWithin, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { GripVertical, Undo2, Redo2, CalendarDays, X, CopyPlus, AlertTriangle, ChevronDown, ChevronRight, Lock, Unlock, Clock, Plus, Coffee, FileText, Megaphone, Grip, MapPin, Building2, Award, Stethoscope, CircleDot, HeartHandshake } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import ClassPalette from '@/components/show-builder/show-bill/ClassPalette';
import {
    initializeShowBill,
    getAllClassItems,
    getUnplacedClasses,
    createShowBillItem,
    renumberShowBill,
    findItemLocation,
    toLocalDateStr,
} from '@/lib/showBillUtils';

const MAX_UNDO = 50;

// ─── Compact sortable class card inside an arena ────────────────
const SortableClassCard = ({ item, allClassItems, associationsData, onRemove, onUpdateTitle, onAddSecondGo, isSelected, onToggleSelection, isLocked, onToggleLock }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
        data: { origin: 'arena', item },
        disabled: isLocked,
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(item.title || '');

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const classDetails = (item.classes || []).map(cid => allClassItems.find(c => c.id === cid || c.divisionId === cid)).filter(Boolean);
    const firstAssoc = classDetails[0] && associationsData?.find(a => a.id === classDetails[0].assocId);

    const handleStartEdit = () => {
        setEditValue(item.title || '');
        setIsEditing(true);
    };

    const handleFinishEdit = () => {
        setIsEditing(false);
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== item.title) {
            onUpdateTitle?.(item.id, trimmed);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleFinishEdit();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group flex items-center gap-1.5 p-1.5 border-2 rounded touch-none text-sm',
                isLocked ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/20 dark:border-amber-700' : 'bg-blue-50/80 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700',
                isDragging && 'opacity-40',
                isSelected && 'ring-2 ring-primary',
            )}
        >
            <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelection?.(item.id)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5 shrink-0"
            />
            {isLocked ? (
                <div className="shrink-0">
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                </div>
            ) : (
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
            )}
            {isEditing ? (
                <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleFinishEdit}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="flex-grow font-medium bg-white dark:bg-background border border-primary/40 rounded px-1 py-0 text-sm outline-none focus:ring-1 focus:ring-primary"
                    onPointerDown={(e) => e.stopPropagation()}
                />
            ) : (
                <span
                    className="flex-grow font-medium cursor-text hover:underline hover:decoration-dotted leading-snug break-words min-w-0"
                    onDoubleClick={handleStartEdit}
                    title="Double-click to edit"
                >
                    {item.title || 'Untitled'}
                </span>
            )}
            {item.isSecondGo && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">2nd Go</Badge>
            )}
            {firstAssoc && (
                <span className="text-xs text-muted-foreground shrink-0">({firstAssoc.abbreviation})</span>
            )}
            {!item.isSecondGo && (
                <button
                    type="button"
                    className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-primary/10 flex items-center justify-center"
                    onClick={() => onAddSecondGo?.(item.id)}
                    title="Add Second Go"
                >
                    <CopyPlus className="h-3 w-3 text-primary" />
                </button>
            )}
            <button
                type="button"
                className={cn(
                    'h-5 w-5 shrink-0 transition-opacity rounded flex items-center justify-center',
                    isLocked ? 'opacity-100 hover:bg-amber-100 dark:hover:bg-amber-900/30' : 'opacity-0 group-hover:opacity-100 hover:bg-muted',
                )}
                onClick={() => onToggleLock?.(item.id)}
                title={isLocked ? 'Unlock class' : 'Lock class'}
            >
                {isLocked
                    ? <Lock className="h-3 w-3 text-amber-500" />
                    : <Unlock className="h-3 w-3 text-muted-foreground" />
                }
            </button>
            <button
                type="button"
                className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-destructive/10 flex items-center justify-center"
                onClick={() => onRemove(item.id)}
            >
                <X className="h-3 w-3 text-destructive" />
            </button>
        </div>
    );
};

// ─── Non-class item (break, note, announcement, drag) inside an arena ───
const NON_CLASS_ICONS = {
    break: Coffee,
    drag: Grip,
    sectionHeader: FileText,
    custom: Megaphone,
};
const NON_CLASS_LABELS = {
    break: 'Break',
    drag: 'Arena Drag',
    sectionHeader: 'Note / Header',
    custom: 'Announcement',
};
const NON_CLASS_COLORS = {
    break: 'bg-orange-50 border-orange-300 dark:bg-orange-950/20 dark:border-orange-700',
    drag: 'bg-gray-50 border-gray-300 dark:bg-gray-900/30 dark:border-gray-600',
    sectionHeader: 'bg-violet-50 border-violet-300 dark:bg-violet-950/20 dark:border-violet-700',
    custom: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-700',
};

const SortableNonClassItem = ({ item, onRemove, onUpdateTitle }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
        data: { origin: 'arena', item },
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(item.title || '');

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const Icon = NON_CLASS_ICONS[item.type] || FileText;
    const colorClass = NON_CLASS_COLORS[item.type] || NON_CLASS_COLORS.custom;

    const handleFinishEdit = () => {
        setIsEditing(false);
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== item.title) {
            onUpdateTitle?.(item.id, trimmed);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group flex items-center gap-1.5 p-1.5 border-2 border-dashed rounded touch-none text-sm',
                colorClass,
                isDragging && 'opacity-40',
            )}
        >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {isEditing ? (
                <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleFinishEdit}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEdit(); if (e.key === 'Escape') setIsEditing(false); }}
                    autoFocus
                    className="flex-grow font-medium bg-white dark:bg-background border border-primary/40 rounded px-1 py-0 text-sm outline-none focus:ring-1 focus:ring-primary"
                    onPointerDown={(e) => e.stopPropagation()}
                />
            ) : (
                <span
                    className="flex-grow font-medium italic cursor-text hover:underline hover:decoration-dotted leading-snug break-words min-w-0"
                    onDoubleClick={() => { setEditValue(item.title || ''); setIsEditing(true); }}
                    title="Double-click to edit"
                >
                    {item.title || NON_CLASS_LABELS[item.type] || 'Item'}
                    {item.type === 'break' && item.duration && (
                        <span className="text-muted-foreground"> — {item.duration}</span>
                    )}
                </span>
            )}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {NON_CLASS_LABELS[item.type] || item.type}
            </Badge>
            <button
                type="button"
                className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-destructive/10 flex items-center justify-center"
                onClick={() => onRemove(item.id)}
            >
                <X className="h-3 w-3 text-destructive" />
            </button>
        </div>
    );
};

// ─── Arena drop zone with close toggle ──────────────────────────
const ArenaContainer = ({ arena, dayId, dayDate, allClassItems, associationsData, onRemoveItem, onUpdateTitle, onAddSecondGo, onUpdateArenaStartTime, onAddNonClassItem, isClosed, onToggleClosed, selectedArenaItemIds, onToggleArenaItemSelection, isCollapsed, onToggleCollapsed, lockedItemIds, onToggleLock }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `droppable-${dayId}-${arena.id}`,
        data: { dayId, arenaId: arena.id, origin: 'arena-zone' },
    });

    return (
        <div className={cn(
            'border rounded-lg shadow-sm',
            isClosed ? 'bg-muted/50 opacity-60' : 'bg-white dark:bg-card'
        )}>
            <div
                className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 cursor-pointer select-none"
                onClick={() => !isClosed && onToggleCollapsed?.()}
            >
                {!isClosed && (
                    isCollapsed
                        ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-bold text-base">{arena.name}</h4>
                {dayDate && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 shrink-0">
                        {new Date(dayDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Badge>
                )}
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                        value={arena.startTime ? arena.startTime.split(':')[0] : ''}
                        onChange={(e) => {
                            const hr = e.target.value;
                            const min = arena.startTime ? arena.startTime.split(':')[1]?.split(' ')[0] : '00';
                            const ampm = arena.startTime?.includes('PM') ? 'PM' : 'AM';
                            onUpdateArenaStartTime?.(arena.id, hr ? `${hr}:${min} ${ampm}` : '');
                        }}
                        className="text-xs font-medium border rounded px-1 py-0.5 bg-background focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer"
                        title="Hour"
                    >
                        <option value="">--</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                            <option key={h} value={String(h)}>{String(h)}</option>
                        ))}
                    </select>
                    <span className="text-xs font-bold text-muted-foreground">:</span>
                    <select
                        value={arena.startTime ? arena.startTime.split(':')[1]?.split(' ')[0] : ''}
                        onChange={(e) => {
                            const hr = arena.startTime ? arena.startTime.split(':')[0] : '8';
                            const ampm = arena.startTime?.includes('PM') ? 'PM' : 'AM';
                            onUpdateArenaStartTime?.(arena.id, `${hr}:${e.target.value} ${ampm}`);
                        }}
                        className="text-xs font-medium border rounded px-1 py-0.5 bg-background focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer"
                        title="Minute"
                    >
                        {['00', '15', '30', '45'].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    <select
                        value={arena.startTime?.includes('PM') ? 'PM' : 'AM'}
                        onChange={(e) => {
                            const hr = arena.startTime ? arena.startTime.split(':')[0] : '8';
                            const min = arena.startTime ? arena.startTime.split(':')[1]?.split(' ')[0] : '00';
                            onUpdateArenaStartTime?.(arena.id, `${hr}:${min} ${e.target.value}`);
                        }}
                        className="text-xs font-medium border rounded px-1 py-0.5 bg-background focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer"
                        title="AM/PM"
                    >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">
                    {arena.items.length} class{arena.items.length !== 1 ? 'es' : ''}
                </Badge>
                {isClosed && (
                    <Badge variant="secondary" className="text-xs">Closed</Badge>
                )}
                <Switch
                    checked={!isClosed}
                    onCheckedChange={onToggleClosed}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-75"
                />
            </div>

            {!isClosed ? (
                isCollapsed ? (
                    <div ref={setNodeRef} className="px-4 py-2 text-xs text-muted-foreground italic">
                        {arena.items.length} class{arena.items.length !== 1 ? 'es' : ''} — click header to expand
                    </div>
                ) : (
                    <div className="p-3">
                        <SortableContext
                            id={`${dayId}::${arena.id}`}
                            items={arena.items.map(i => i.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div
                                ref={setNodeRef}
                                className={cn(
                                    'space-y-1 min-h-[60px] rounded-md transition-colors',
                                    isOver && 'bg-primary/5 ring-2 ring-primary/20',
                                    arena.items.length === 0 && 'border-2 border-dashed border-muted-foreground/20 flex items-center justify-center',
                                )}
                            >
                                {arena.items.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-6">Drag classes here</p>
                                ) : (
                                    arena.items.map(item => (
                                        item.type === 'classBox' ? (
                                            <SortableClassCard
                                                key={item.id}
                                                item={item}
                                                allClassItems={allClassItems}
                                                associationsData={associationsData}
                                                onRemove={onRemoveItem}
                                                onUpdateTitle={onUpdateTitle}
                                                onAddSecondGo={onAddSecondGo}
                                                isSelected={selectedArenaItemIds?.has(item.id)}
                                                onToggleSelection={onToggleArenaItemSelection}
                                                isLocked={lockedItemIds?.has(item.id)}
                                                onToggleLock={onToggleLock}
                                            />
                                        ) : (
                                            <SortableNonClassItem
                                                key={item.id}
                                                item={item}
                                                onRemove={onRemoveItem}
                                                onUpdateTitle={onUpdateTitle}
                                            />
                                        )
                                    ))
                                )}
                            </div>
                        </SortableContext>
                        <div className="mt-2 flex justify-center">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">
                                        <Plus className="h-3.5 w-3.5" /> Add Item
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center">
                                    <DropdownMenuItem onClick={() => onAddNonClassItem?.(arena.id, 'break')}>
                                        <Coffee className="h-4 w-4 mr-2 text-orange-500" /> Break
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAddNonClassItem?.(arena.id, 'drag')}>
                                        <Grip className="h-4 w-4 mr-2 text-gray-500" /> Arena Drag
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAddNonClassItem?.(arena.id, 'sectionHeader')}>
                                        <FileText className="h-4 w-4 mr-2 text-violet-500" /> Note / Header
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAddNonClassItem?.(arena.id, 'custom')}>
                                        <Megaphone className="h-4 w-4 mr-2 text-emerald-500" /> Announcement
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                )
            ) : (
                <div className="p-3 text-center text-sm text-muted-foreground italic">
                    Arena closed for this day
                </div>
            )}
        </div>
    );
};

// Get the assigned competition date for a class from formData disciplines
function getClassAssignedDate(classId, formData) {
    // classId may be composite "disciplineId::divisionId" or plain "divisionId"
    const divId = classId.includes('::') ? classId.split('::')[1] : classId;
    for (const disc of formData.disciplines || []) {
        const date = disc.divisionDates?.[divId];
        if (date) return date;
    }
    return null;
}

function formatDateShort(dateStr) {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

const LOCATION_ICONS = {
    'show-office': Building2,
    'awards-room': Award,
    'vet-area': Stethoscope,
    'warmup-ring': CircleDot,
    'volunteer-desk': HeartHandshake,
};

function formatTimeDisplay(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ─── Main component ─────────────────────────────────────────────
export const Step3_ConfigureDivisions = ({ formData, setFormData, associationsData }) => {
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [activeDayId, setActiveDayId] = useState(null);
    const [activeDragData, setActiveDragData] = useState(null);

    // Multi-select state
    const [selectedPaletteIds, setSelectedPaletteIds] = useState(new Set());
    const [selectedArenaItemIds, setSelectedArenaItemIds] = useState(new Set());

    // Collapsed arenas (UI-only, keyed by "dayId::arenaId")
    const [collapsedArenas, setCollapsedArenas] = useState({});

    // Locked class items — cannot be dragged or reordered
    const [lockedItemIds, setLockedItemIds] = useState(new Set());

    // Pending drop that requires date-mismatch confirmation
    const [pendingDrop, setPendingDrop] = useState(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const showBill = formData.showBill;

    // Initialize showBill on first mount, or sync days + arenas from formData
    useEffect(() => {
        setFormData(prev => {
            // No showBill yet — create one from scratch
            if (!prev.showBill) {
                return { ...prev, showBill: initializeShowBill(prev) };
            }

            const sourceArenas = (prev.arenas || []).filter(a => a.name.trim() !== '');
            const sourceIds = new Set(sourceArenas.map(a => a.id));
            let changed = false;

            // ── Sync days from date range ──
            const expectedDates = [];
            if (prev.startDate) {
                let current = new Date(prev.startDate + 'T00:00:00');
                const end = prev.endDate ? new Date(prev.endDate + 'T00:00:00') : current;
                while (current <= end) {
                    expectedDates.push(toLocalDateStr(current));
                    current.setDate(current.getDate() + 1);
                }
            }

            const existingDateMap = {};
            for (const day of prev.showBill.days) {
                existingDateMap[day.date] = day;
            }

            let syncedDays;
            const existingDates = new Set(prev.showBill.days.map(d => d.date));
            const expectedSet = new Set(expectedDates);

            const hasNewDates = expectedDates.some(d => !existingDates.has(d));
            const hasRemovedDates = prev.showBill.days.some(d => !expectedSet.has(d.date));

            if (hasNewDates || hasRemovedDates) {
                changed = true;
                syncedDays = expectedDates.map(dateStr => {
                    if (existingDateMap[dateStr]) {
                        return existingDateMap[dateStr];
                    }
                    // New day — create with arenas
                    const d = new Date(dateStr + 'T00:00:00');
                    return {
                        id: `day-${crypto.randomUUID ? crypto.randomUUID() : dateStr}`,
                        date: dateStr,
                        label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
                        arenas: sourceArenas
                            .filter(a => !a.dates || a.dates.length === 0 || a.dates.includes(dateStr))
                            .map(a => ({ id: a.id, name: a.name, items: [] })),
                    };
                });
            } else {
                syncedDays = prev.showBill.days;
            }

            // ── Sync arenas within each day ──
            if (sourceArenas.length > 0) {
                const updatedDays = syncedDays.map(day => {
                    const existingArenaIds = new Set(day.arenas.map(a => a.id));

                    const newArenas = sourceArenas
                        .filter(a => !existingArenaIds.has(a.id))
                        .filter(a => !a.dates || a.dates.length === 0 || a.dates.includes(day.date))
                        .map(a => ({ id: a.id, name: a.name, items: [] }));

                    const keptArenas = day.arenas.filter(a => sourceIds.has(a.id));

                    const renamedArenas = keptArenas.map(a => {
                        const source = sourceArenas.find(s => s.id === a.id);
                        return source && source.name !== a.name ? { ...a, name: source.name } : a;
                    });

                    if (newArenas.length > 0 || keptArenas.length !== day.arenas.length || renamedArenas.some((a, i) => a !== keptArenas[i])) {
                        changed = true;
                        return { ...day, arenas: [...renamedArenas, ...newArenas] };
                    }
                    return day;
                });
                syncedDays = updatedDays;
            }

            if (!changed) return prev;
            return { ...prev, showBill: { ...prev.showBill, days: syncedDays } };
        });
    }, [formData.showBill, formData.arenas, formData.startDate, formData.endDate, setFormData]);

    // Set default active day
    useEffect(() => {
        if (showBill?.days?.length > 0 && !activeDayId) {
            setActiveDayId(showBill.days[0].id);
        }
    }, [showBill, activeDayId]);

    const allClassItems = useMemo(() => getAllClassItems(formData), [formData]);
    const unplacedClasses = useMemo(() => getUnplacedClasses(formData), [formData]);
    const activeDay = useMemo(() => showBill?.days?.find(d => d.id === activeDayId), [showBill, activeDayId]);

    // Prune stale palette selections
    useEffect(() => {
        if (selectedPaletteIds.size > 0) {
            const unplacedIds = new Set(unplacedClasses.map(c => c.id));
            const pruned = new Set([...selectedPaletteIds].filter(id => unplacedIds.has(id)));
            if (pruned.size !== selectedPaletteIds.size) setSelectedPaletteIds(pruned);
        }
    }, [unplacedClasses, selectedPaletteIds]);

    // Selection helpers
    const clearSelection = useCallback(() => {
        setSelectedPaletteIds(new Set());
        setSelectedArenaItemIds(new Set());
    }, []);

    const selectedCount = selectedPaletteIds.size + selectedArenaItemIds.size;

    const togglePaletteSelection = useCallback((classId) => {
        setSelectedArenaItemIds(new Set());
        setSelectedPaletteIds(prev => {
            const next = new Set(prev);
            if (next.has(classId)) next.delete(classId);
            else next.add(classId);
            return next;
        });
    }, []);

    const bulkTogglePaletteSelection = useCallback((classIds, selected) => {
        setSelectedArenaItemIds(new Set());
        if (selected) {
            // Replace entire selection with this group
            setSelectedPaletteIds(new Set(classIds));
        } else {
            // Deselect this group's classes
            setSelectedPaletteIds(prev => {
                const next = new Set(prev);
                classIds.forEach(id => next.delete(id));
                return next;
            });
        }
    }, []);

    const toggleItemLock = useCallback((itemId) => {
        setLockedItemIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }, []);

    const toggleArenaItemSelection = useCallback((itemId) => {
        setSelectedPaletteIds(new Set());
        setSelectedArenaItemIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }, []);

    // Undo-aware setter
    const setShowBill = useCallback((newShowBill) => {
        setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), formData.showBill]);
        setRedoStack([]);
        setFormData(prev => ({ ...prev, showBill: newShowBill }));
    }, [formData.showBill, setFormData]);

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const prevState = undoStack[undoStack.length - 1];
        setRedoStack(r => [...r, formData.showBill]);
        setUndoStack(u => u.slice(0, -1));
        setFormData(p => ({ ...p, showBill: prevState }));
    }, [undoStack, formData.showBill, setFormData]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[redoStack.length - 1];
        setUndoStack(u => [...u, formData.showBill]);
        setRedoStack(r => r.slice(0, -1));
        setFormData(p => ({ ...p, showBill: nextState }));
    }, [redoStack, formData.showBill, setFormData]);

    // Toggle arena closed/open — closing removes all items back to the unplaced palette
    const handleToggleArenaClosed = useCallback((dayId, arenaId) => {
        const key = `${dayId}::${arenaId}`;
        const sb = JSON.parse(JSON.stringify(showBill));
        if (!sb.closedArenas) sb.closedArenas = {};
        if (sb.closedArenas[key]) {
            delete sb.closedArenas[key];
        } else {
            sb.closedArenas[key] = true;
            // Remove all items from this arena so they return to the unplaced palette
            const day = sb.days.find(d => d.id === dayId);
            const arena = day?.arenas.find(a => a.id === arenaId);
            if (arena) {
                arena.items = [];
            }
        }
        setShowBill(renumberShowBill(sb));
    }, [showBill, setShowBill]);

    // Remove an item from its arena
    const handleRemoveItem = useCallback((itemId) => {
        const loc = findItemLocation(showBill, itemId);
        if (!loc) return;
        const sb = JSON.parse(JSON.stringify(showBill));
        const day = sb.days.find(d => d.id === loc.dayId);
        const arena = day?.arenas.find(a => a.id === loc.arenaId);
        if (arena) {
            arena.items = arena.items.filter(i => i.id !== itemId);
        }
        setShowBill(renumberShowBill(sb));
    }, [showBill, setShowBill]);

    // Update an arena's start time
    const handleUpdateArenaStartTime = useCallback((arenaId, time) => {
        if (!activeDayId) return;
        const sb = JSON.parse(JSON.stringify(showBill));
        const day = sb.days.find(d => d.id === activeDayId);
        const arena = day?.arenas.find(a => a.id === arenaId);
        if (arena) arena.startTime = time;
        setShowBill(sb);
    }, [showBill, activeDayId, setShowBill]);

    // Update an item's title
    const handleUpdateItemTitle = useCallback((itemId, newTitle) => {
        const loc = findItemLocation(showBill, itemId);
        if (!loc) return;
        const sb = JSON.parse(JSON.stringify(showBill));
        const day = sb.days.find(d => d.id === loc.dayId);
        const arena = day?.arenas.find(a => a.id === loc.arenaId);
        if (arena) {
            const item = arena.items.find(i => i.id === itemId);
            if (item) item.title = newTitle;
        }
        setShowBill(sb);
    }, [showBill, setShowBill]);

    // Add Second Go for a class item
    const handleAddSecondGo = useCallback((itemId) => {
        const loc = findItemLocation(showBill, itemId);
        if (!loc) return;
        const sb = JSON.parse(JSON.stringify(showBill));
        const day = sb.days.find(d => d.id === loc.dayId);
        const arena = day?.arenas.find(a => a.id === loc.arenaId);
        if (!arena) return;
        const parentItem = arena.items[loc.index];
        const secondGoItem = {
            type: 'classBox',
            id: uuidv4(),
            number: 0,
            title: `${parentItem.title} (Second Go)`,
            classes: [...(parentItem.classes || [])],
            isSecondGo: true,
            parentItemId: parentItem.id,
            parentNumber: parentItem.number,
        };
        // Insert right after the parent
        arena.items.splice(loc.index + 1, 0, secondGoItem);
        setShowBill(renumberShowBill(sb));
    }, [showBill, setShowBill]);

    // Add a non-class item (break, note, etc.) to an arena
    const handleAddNonClassItem = useCallback((arenaId, itemType) => {
        if (!activeDayId) return;
        const sb = JSON.parse(JSON.stringify(showBill));
        const day = sb.days.find(d => d.id === activeDayId);
        const arena = day?.arenas.find(a => a.id === arenaId);
        if (!arena) return;
        const newItem = createShowBillItem(itemType);
        arena.items.push(newItem);
        setShowBill(renumberShowBill(sb));
    }, [showBill, activeDayId, setShowBill]);

    // Reorder a class within its discipline's divisionOrder
    const handleReorderPaletteClass = useCallback((classItem, direction) => {
        setFormData(prev => {
            const newDisciplines = prev.disciplines.map(disc => {
                const order = disc.divisionOrder || [];
                // classItem.id is "disciplineId::divisionId", divisionOrder stores divisionId
                const divId = classItem.divisionId || classItem.id;
                const idx = order.indexOf(divId);
                if (idx === -1) return disc;

                const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (swapIdx < 0 || swapIdx >= order.length) return disc;

                const newOrder = [...order];
                [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
                return { ...disc, divisionOrder: newOrder };
            });
            return { ...prev, disciplines: newDisciplines };
        });
    }, [setFormData]);

    // ─── Execute a validated drop action ─────────────────────────
    const executeDrop = useCallback((action) => {
        if (action.type === 'palette-to-arena') {
            const { classesToMove, targetDayId, targetArenaId, targetIndex } = action;
            const sb = JSON.parse(JSON.stringify(showBill));
            const day = sb.days.find(d => d.id === targetDayId);
            const arena = day?.arenas.find(a => a.id === targetArenaId);
            if (arena) {
                const newItems = classesToMove.map(cls => createShowBillItem('classBox', {
                    title: cls.name,
                    classes: [cls.id],
                }));
                arena.items.splice(targetIndex, 0, ...newItems);
            }
            setShowBill(renumberShowBill(sb));
            clearSelection();
        } else if (action.type === 'arena-multi-move') {
            const { destDayId, destArenaId, overId, itemIds } = action;
            const sb = JSON.parse(JSON.stringify(showBill));

            // Find the original index of the over-item BEFORE removal, so we can
            // determine whether selected items were above or below the drop target
            const destDayPre = sb.days.find(d => d.id === destDayId);
            const destArenaPre = destDayPre?.arenas.find(a => a.id === destArenaId);
            const overOriginalIdx = destArenaPre?.items.findIndex(i => i.id === overId) ?? -1;
            // Count how many selected items sit before the over-item in the destination arena
            let selectedBeforeOver = 0;
            if (destArenaPre) {
                for (let i = 0; i < overOriginalIdx; i++) {
                    if (itemIds.has(destArenaPre.items[i].id)) selectedBeforeOver++;
                }
            }

            const collectedItems = [];
            for (const day of sb.days) {
                for (const arena of day.arenas) {
                    const kept = [];
                    for (const item of arena.items) {
                        if (itemIds.has(item.id)) collectedItems.push(item);
                        else kept.push(item);
                    }
                    arena.items = kept;
                }
            }
            const destDay = sb.days.find(d => d.id === destDayId);
            const destArena = destDay?.arenas.find(a => a.id === destArenaId);
            if (!destArena) return;
            let destIdx = destArena.items.findIndex(i => i.id === overId);
            if (destIdx === -1) {
                destIdx = destArena.items.length;
            } else if (selectedBeforeOver > 0) {
                // Items were dragged downward — insert AFTER the over-item
                destIdx += 1;
            }
            destArena.items.splice(destIdx, 0, ...collectedItems);
            setShowBill(renumberShowBill(sb));
            clearSelection();
        } else if (action.type === 'arena-reorder') {
            const { dayId, arenaId, activeId, overId } = action;
            const sb = JSON.parse(JSON.stringify(showBill));
            const arena = sb.days.find(d => d.id === dayId)?.arenas.find(a => a.id === arenaId);
            if (!arena) return;
            const oldIdx = arena.items.findIndex(i => i.id === activeId);
            const newIdx = arena.items.findIndex(i => i.id === overId);
            if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
            arena.items = arrayMove(arena.items, oldIdx, newIdx);
            setShowBill(renumberShowBill(sb));
        } else if (action.type === 'arena-cross-move') {
            const { srcDayId, srcArenaId, destDayId, destArenaId, activeId, overId } = action;
            const sb = JSON.parse(JSON.stringify(showBill));
            const srcArena = sb.days.find(d => d.id === srcDayId)?.arenas.find(a => a.id === srcArenaId);
            const destArena = sb.days.find(d => d.id === destDayId)?.arenas.find(a => a.id === destArenaId);
            if (!srcArena || !destArena) return;
            const srcIdx = srcArena.items.findIndex(i => i.id === activeId);
            if (srcIdx === -1) return;
            const [movedItem] = srcArena.items.splice(srcIdx, 1);
            let destIdx = destArena.items.findIndex(i => i.id === overId);
            if (destIdx === -1) destIdx = destArena.items.length;
            destArena.items.splice(destIdx, 0, movedItem);
            setShowBill(renumberShowBill(sb));
        }
    }, [showBill, setShowBill, clearSelection]);

    // Check for date mismatches and either execute or prompt
    const executeOrPrompt = useCallback((action) => {
        const targetDay = showBill?.days?.find(d => d.id === action.targetDayId || d.id === action.destDayId);
        const targetDate = targetDay?.date;
        if (!targetDate) { executeDrop(action); return; }

        // Collect class IDs involved in this drop
        let classIds = [];
        if (action.type === 'palette-to-arena') {
            classIds = action.classesToMove.map(c => c.id);
        } else if (action.type === 'arena-cross-move') {
            // Find the item's class IDs
            const srcDay = showBill.days.find(d => d.id === action.srcDayId);
            const srcArena = srcDay?.arenas.find(a => a.id === action.srcArenaId);
            const item = srcArena?.items.find(i => i.id === action.activeId);
            classIds = item?.classes || [];
        } else if (action.type === 'arena-multi-move') {
            for (const day of showBill.days) {
                for (const arena of day.arenas) {
                    for (const item of arena.items) {
                        if (action.itemIds.has(item.id) && item.classes) {
                            classIds.push(...item.classes);
                        }
                    }
                }
            }
        }

        // Check if any class has an assigned date that differs from the target day
        const mismatches = [];
        for (const cid of classIds) {
            const assignedDate = getClassAssignedDate(cid, formData);
            if (assignedDate && assignedDate !== targetDate) {
                mismatches.push({ classId: cid, assignedDate });
            }
        }

        if (mismatches.length > 0) {
            setPendingDrop({ action, mismatches, targetDate });
        } else {
            executeDrop(action);
        }
    }, [showBill, formData, executeDrop]);

    const confirmPendingDrop = useCallback(() => {
        if (pendingDrop) {
            executeDrop(pendingDrop.action);
            setPendingDrop(null);
        }
    }, [pendingDrop, executeDrop]);

    const cancelPendingDrop = useCallback(() => {
        setPendingDrop(null);
    }, []);

    // Custom collision detection: palette drags require the pointer to actually
    // be inside an arena zone (pointerWithin) — prevents accidental placement when
    // the user drags within the palette list. Arena reordering uses closestCenter.
    const collisionDetection = useCallback((args) => {
        if (activeDragData?.origin === 'palette') {
            return pointerWithin(args);
        }
        return closestCenter(args);
    }, [activeDragData]);

    // DnD handlers
    const handleDragStart = (event) => {
        setActiveDragData(event.active.data.current);
    };

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveDragData(null);
        if (!over || !showBill) return;

        const activeData = active.data.current;

        // Case 1: Palette → Arena
        if (activeData?.origin === 'palette') {
            // Ignore drops back onto palette items (user was reordering within palette, not placing)
            const overId = String(over.id);
            if (overId.startsWith('palette-') || over.data.current?.origin === 'palette') {
                return;
            }

            const classItem = activeData.classItem;

            const isMulti = selectedPaletteIds.has(classItem.id) && selectedPaletteIds.size > 1;
            const classesToMove = isMulti
                ? unplacedClasses.filter(c => selectedPaletteIds.has(c.id))
                : [classItem];

            let targetDayId, targetArenaId, targetIndex;

            if (over.data.current?.origin === 'arena-zone') {
                targetDayId = over.data.current.dayId;
                targetArenaId = over.data.current.arenaId;
                const day = showBill.days.find(d => d.id === targetDayId);
                const arena = day?.arenas.find(a => a.id === targetArenaId);
                targetIndex = arena?.items.length || 0;
            } else if (over.data.current?.sortable?.containerId) {
                const containerId = over.data.current.sortable.containerId;
                const [dayId, arenaId] = containerId.split('::');
                targetDayId = dayId;
                targetArenaId = arenaId;
                const day = showBill.days.find(d => d.id === dayId);
                const arena = day?.arenas.find(a => a.id === arenaId);
                targetIndex = arena?.items.findIndex(i => i.id === over.id);
                if (targetIndex === -1) targetIndex = arena?.items.length || 0;
            } else {
                return;
            }

            if ((showBill.closedArenas || {})[`${targetDayId}::${targetArenaId}`]) return;

            executeOrPrompt({
                type: 'palette-to-arena',
                classesToMove,
                targetDayId,
                targetArenaId,
                targetIndex,
            });
            return;
        }

        // Case 2: Reorder within / between arenas
        if (activeData?.origin === 'arena') {
            const activeContainerId = active.data.current?.sortable?.containerId;
            let overContainerId = over.data.current?.sortable?.containerId;

            if (!overContainerId && over.data.current?.origin === 'arena-zone') {
                overContainerId = `${over.data.current.dayId}::${over.data.current.arenaId}`;
            }
            if (!activeContainerId || !overContainerId) return;

            const [srcDayId, srcArenaId] = activeContainerId.split('::');
            const [destDayId, destArenaId] = overContainerId.split('::');

            if ((showBill.closedArenas || {})[`${destDayId}::${destArenaId}`]) return;

            const isDraggedSelected = selectedArenaItemIds.has(active.id) && selectedArenaItemIds.size > 1;

            if (isDraggedSelected) {
                executeOrPrompt({
                    type: 'arena-multi-move',
                    destDayId,
                    destArenaId,
                    overId: over.id,
                    itemIds: new Set(selectedArenaItemIds),
                });
                return;
            }

            if (srcDayId === destDayId && srcArenaId === destArenaId) {
                // Same arena reorder — no date change, execute directly
                executeDrop({
                    type: 'arena-reorder',
                    dayId: srcDayId,
                    arenaId: srcArenaId,
                    activeId: active.id,
                    overId: over.id,
                });
            } else {
                executeOrPrompt({
                    type: 'arena-cross-move',
                    srcDayId,
                    srcArenaId,
                    destDayId,
                    destArenaId,
                    activeId: active.id,
                    overId: over.id,
                });
            }
        }
    }, [showBill, selectedPaletteIds, selectedArenaItemIds, unplacedClasses, executeDrop, executeOrPrompt]);

    // Empty state — no classes built
    if (!formData.disciplines || formData.disciplines.length === 0) {
        return (
            <motion.div key="step5-schedule" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardHeader>
                    <CardTitle>Step 6: Organize Schedule</CardTitle>
                    <CardDescription>Drag and drop classes into arena time slots to build your show schedule.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground font-medium">No classes built yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">Go back to Step 4 to build your class list.</p>
                    </div>
                </CardContent>
            </motion.div>
        );
    }

    if (!showBill) {
        return (
            <motion.div key="step5-schedule" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <CardContent className="flex items-center justify-center p-16">
                    <p className="text-muted-foreground">Initializing schedule...</p>
                </CardContent>
            </motion.div>
        );
    }

    return (
        <motion.div key="step5-schedule" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <CardTitle>Step 6: Organize Schedule</CardTitle>
                            <CardDescription>Drag classes from the library into arena containers to build your show schedule.</CardDescription>
                        </div>
                        {selectedCount > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full text-sm">
                                <span className="font-semibold">{selectedCount} selected</span>
                                <button onClick={clearSelection} className="p-0.5 rounded-full hover:bg-primary/20">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo">
                            <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo">
                            <Redo2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    {/* Day tabs */}
                    {showBill.days.length > 1 && (
                        <Tabs value={activeDayId} onValueChange={setActiveDayId} className="mb-4">
                            <TabsList>
                                {showBill.days.map(day => (
                                    <TabsTrigger key={day.id} value={day.id}>{day.label}</TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left — Class Library */}
                        <div>
                            <div className="sticky top-4">
                                <ClassPalette
                                    allClassItems={allClassItems}
                                    unplacedClasses={unplacedClasses}
                                    associationsData={associationsData}
                                    selectedIds={selectedPaletteIds}
                                    onToggleSelection={togglePaletteSelection}
                                    onBulkToggle={bulkTogglePaletteSelection}
                                    formData={formData}
                                    activeDayDate={activeDay?.date}
                                    onReorderClass={handleReorderPaletteClass}
                                />
                            </div>
                        </div>

                        {/* Right — Arena Workspace */}
                        <div>
                            <div className="bg-gray-50 dark:bg-muted/10 rounded-lg p-4 min-h-[500px] shadow-inner">
                                {activeDay ? (
                                    <div className="space-y-4">
                                        {activeDay.arenas.length > 0 ? (
                                            activeDay.arenas.map(arena => {
                                                const arenaKey = `${activeDay.id}::${arena.id}`;
                                                const isClosed = !!(showBill.closedArenas || {})[arenaKey];
                                                return (
                                                    <ArenaContainer
                                                        key={arena.id}
                                                        arena={arena}
                                                        dayId={activeDay.id}
                                                        dayDate={activeDay.date}
                                                        allClassItems={allClassItems}
                                                        associationsData={associationsData}
                                                        onRemoveItem={handleRemoveItem}
                                                        onUpdateTitle={handleUpdateItemTitle}
                                                        onAddSecondGo={handleAddSecondGo}
                                                        onUpdateArenaStartTime={handleUpdateArenaStartTime}
                                                        onAddNonClassItem={handleAddNonClassItem}
                                                        isClosed={isClosed}
                                                        onToggleClosed={() => handleToggleArenaClosed(activeDay.id, arena.id)}
                                                        selectedArenaItemIds={selectedArenaItemIds}
                                                        onToggleArenaItemSelection={toggleArenaItemSelection}
                                                        isCollapsed={!!collapsedArenas[arenaKey]}
                                                        onToggleCollapsed={() => setCollapsedArenas(prev => ({ ...prev, [arenaKey]: !prev[arenaKey] }))}
                                                        lockedItemIds={lockedItemIds}
                                                        onToggleLock={toggleItemLock}
                                                    />
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-10 text-muted-foreground">
                                                <p>No arenas for this day.</p>
                                                <p className="text-sm mt-1">Go back to Arenas & Dates to assign arenas to dates.</p>
                                            </div>
                                        )}

                                        {/* Show Locations for this day */}
                                        {(formData.locations || []).length > 0 && (
                                            <div className="mt-6 space-y-2">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Show Locations</span>
                                                </div>
                                                {(formData.locations || []).map(loc => {
                                                    const Icon = LOCATION_ICONS[loc.id] || MapPin;
                                                    const dayHours = loc.hours?.[activeDay.date] || {};
                                                    return (
                                                        <div key={loc.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                                                            <Icon className="h-4 w-4 text-primary shrink-0" />
                                                            <span className="text-sm font-medium flex-1">{loc.name}</span>
                                                            {dayHours.open && dayHours.close ? (
                                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                    <Clock className="h-3.5 w-3.5" />
                                                                    <span>{formatTimeDisplay(dayHours.open)} – {formatTimeDisplay(dayHours.close)}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">No hours set</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-center text-muted-foreground py-10">Select a day to view the schedule</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Drag overlay */}
                    <DragOverlay>
                        {activeDragData?.origin === 'palette' && activeDragData.classItem && (
                            <div className="p-2 border rounded-lg bg-background shadow-lg cursor-grabbing flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{activeDragData.classItem.name}</span>
                                {selectedPaletteIds.has(activeDragData.classItem.id) && selectedPaletteIds.size > 1 && (
                                    <Badge className="ml-1">{selectedPaletteIds.size}</Badge>
                                )}
                            </div>
                        )}
                        {activeDragData?.origin === 'arena' && activeDragData.item && (
                            <div className="p-2 border rounded-lg bg-background shadow-lg cursor-grabbing flex items-center gap-2 opacity-90">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{activeDragData.item.title || 'Class'}</span>
                                {selectedArenaItemIds.has(activeDragData.item.id) && selectedArenaItemIds.size > 1 ? (
                                    <Badge className="ml-auto">{selectedArenaItemIds.size}</Badge>
                                ) : (
                                    activeDragData.item.number && (
                                        <Badge className="ml-auto">{activeDragData.item.number}</Badge>
                                    )
                                )}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </CardContent>

            {/* Date-mismatch warning dialog */}
            <AlertDialog open={!!pendingDrop} onOpenChange={(open) => { if (!open) cancelPendingDrop(); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Date Mismatch
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>
                                    {pendingDrop?.mismatches.length === 1
                                        ? 'This class was originally assigned to a different day:'
                                        : `${pendingDrop?.mismatches.length} classes were originally assigned to different days:`
                                    }
                                </p>
                                <div className="rounded-md border bg-muted/50 p-3 space-y-1 max-h-40 overflow-y-auto">
                                    {pendingDrop?.mismatches.map(m => {
                                        const disc = (formData.disciplines || []).find(d => (d.divisionOrder || []).includes(m.classId));
                                        const name = disc?.divisionPrintTitles?.[m.classId] || m.classId;
                                        return (
                                            <div key={m.classId} className="flex items-center justify-between text-sm">
                                                <span className="font-medium truncate mr-2">{name}</span>
                                                <Badge variant="outline" className="shrink-0">{formatDateShort(m.assignedDate)}</Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p>
                                    You are moving {pendingDrop?.mismatches.length === 1 ? 'it' : 'them'} to <span className="font-semibold">{pendingDrop?.targetDate && formatDateShort(pendingDrop.targetDate)}</span>. Do you want to continue?
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmPendingDrop}>Move Anyway</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
};
