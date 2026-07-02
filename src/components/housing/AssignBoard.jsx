import React, { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { GripVertical, Home, Car, Check, MousePointerClick, X, Printer } from 'lucide-react';
import {
    getRequestedStallCount, getAssignedStallsForBooking,
    assignStallToBooking, unassignStall,
} from '@/lib/stallAssignment';
import {
    ensureAllRvSpots, getRequestedRvCount, getAssignedRvSpotsForBooking,
    assignRvSpotToBooking, unassignRvSpot,
} from '@/lib/rvAssignment';
import { printStallingChart } from '@/lib/stallingChartPrint';

// ── Phase 2 + 3: Assignment Board (Stalls AND RV) ──
// One screen with the booking list on the left and the chart on the right.
// A toggle switches between the stall chart and the RV / camping chart; the
// drag / click mechanics are identical. Stalls write stall.bookingId; RV spots
// write spot.bookingId — both flow to the same shared project_data.

const PALETTE = [
    '#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed',
    '#0891b2', '#dc2626', '#4f46e5', '#059669', '#ca8a04',
    '#be123c', '#0d9488', '#9333ea', '#c2410c', '#1d4ed8',
];

const barnCols = (barn) => barn.layoutCols ?? (barn.stallCount ? Math.min(barn.stallCount, 10) : 10);
const rvCols = (area) => Math.min(Math.max(1, Number(area.spotCount) || 1), 10);

// A draggable / clickable booking chip in the left rail.
const BookingChip = ({ booking, color, assigned, requested, selected, onSelect }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `bk-${booking.id}`,
        data: { bookingId: booking.id },
    });
    const done = assigned >= requested;
    return (
        <div
            ref={setNodeRef}
            onClick={() => onSelect(booking.id)}
            className={cn(
                'flex items-center gap-2 rounded-md border bg-background p-2 cursor-pointer transition-all select-none',
                selected ? 'ring-2 ring-primary shadow-sm' : 'hover:bg-muted/50',
                isDragging && 'opacity-40'
            )}
            style={{ borderLeft: `4px solid ${color}` }}
        >
            <span {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground" title="Drag onto a spot">
                <GripVertical className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{booking.exhibitorName || '—'}</p>
                {booking.trainerName && <p className="text-[11px] text-muted-foreground truncate">{booking.trainerName}</p>}
            </div>
            <Badge variant="outline" className={cn('text-[10px] tabular-nums shrink-0',
                done ? 'border-emerald-500 text-emerald-600' : 'border-amber-500 text-amber-600')}>
                {done ? <Check className="h-3 w-3" /> : `${assigned}/${requested}`}
            </Badge>
        </div>
    );
};

// A single box (stall or RV spot) — both a drop target and a click target.
const UnitCell = ({ unit, color, ownerName, isSelectedOwner, onClickUnit }) => {
    const type = unit.type || 'stall';       // RV spots have no type → assignable
    const assignable = type === 'stall';
    const taken = assignable && !!unit.bookingId;

    const { setNodeRef, isOver } = useDroppable({
        id: `u-${unit.id}`,
        data: { unitId: unit.id },
        disabled: !assignable,
    });

    if (!assignable) {
        // Office / feed / wash / tack / aisle / blocked — not assignable, shown faint.
        return (
            <div className="flex items-center justify-center border rounded-none -ml-px -mt-px h-9 w-12 text-[8px] font-mono text-muted-foreground/60 bg-muted/40 select-none">
                {type === 'blocked' ? unit.number : type.slice(0, 4)}
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            onClick={() => onClickUnit(unit)}
            title={taken ? `${unit.number} · ${ownerName}` : `${unit.number} · available — click or drop to assign`}
            className={cn(
                'flex items-center justify-center border rounded-none -ml-px -mt-px h-9 w-12 text-[9px] font-mono font-semibold cursor-pointer select-none transition-all',
                isOver && 'ring-2 ring-primary z-10 scale-105',
                isSelectedOwner && 'ring-2 ring-primary z-10',
                !taken && 'bg-background hover:bg-primary/10'
            )}
            style={taken ? { backgroundColor: color, color: '#fff', borderColor: color } : undefined}
        >
            {unit.number}
        </div>
    );
};

const AssignBoard = ({ bookings = [], barns = [], rvAreas = [], onApplyBarns, onApplyRvAreas, meta = {} }) => {
    const { toast } = useToast();
    const [mode, setMode] = useState('stalls'); // 'stalls' | 'rv'
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [activeBookingId, setActiveBookingId] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    );

    // RV areas materialized into individual spots (kept stable across reloads).
    const rvWithSpots = useMemo(() => ensureAllRvSpots(rvAreas), [rvAreas]);

    // One stable color per booking (same order as the print chart), so a person
    // reads the same color across the Stalls view, RV view and printout.
    const colorByBooking = useMemo(() => {
        const map = {};
        (bookings || []).filter(b => b && b.status !== 'cancelled')
            .forEach((b, i) => { map[b.id] = PALETTE[i % PALETTE.length]; });
        return map;
    }, [bookings]);

    const bookingById = useMemo(
        () => Object.fromEntries((bookings || []).map(b => [b.id, b])),
        [bookings]
    );

    // Mode config — everything that differs between stalls and RV lives here.
    const cfg = useMemo(() => {
        if (mode === 'rv') {
            return {
                label: 'RV / camping', unitWord: 'spot', Icon: Car,
                containers: rvWithSpots.map(a => ({
                    id: a.id, name: a.name, cols: rvCols(a), units: a.spots || [],
                })),
                requested: getRequestedRvCount,
                assignedFor: (b) => getAssignedRvSpotsForBooking(b, rvWithSpots),
                assign: (unitId, bookingId) => onApplyRvAreas?.(assignRvSpotToBooking(rvWithSpots, unitId, bookingId)),
                unassign: (unitId) => onApplyRvAreas?.(unassignRvSpot(rvWithSpots, unitId)),
                emptyHint: 'No RV bookings yet. They appear here once exhibitors book RV / camping spots.',
                noContainers: 'No RV areas yet. Add an RV area in the Inventory or Fees tab first.',
            };
        }
        return {
            label: 'Stalls', unitWord: 'stall', Icon: Home,
            containers: (barns || []).map(b => ({
                id: b.id, name: b.name, cols: Math.max(1, barnCols(b)), units: b.stalls || [],
            })),
            requested: getRequestedStallCount,
            assignedFor: (b) => getAssignedStallsForBooking(b, barns),
            assign: (unitId, bookingId) => onApplyBarns?.(assignStallToBooking(barns, unitId, bookingId)),
            unassign: (unitId) => onApplyBarns?.(unassignStall(barns, unitId)),
            emptyHint: 'No stall bookings yet. They appear here once exhibitors book stalls.',
            noContainers: 'No barns yet. Add a barn in the Inventory tab first.',
        };
    }, [mode, barns, rvWithSpots, onApplyBarns, onApplyRvAreas]);

    // Bookings needing THIS mode's units, and their assigned counts.
    const needRows = useMemo(() => (bookings || [])
        .filter(b => b && b.status !== 'cancelled' && cfg.requested(b) > 0)
        .map(b => ({ booking: b, requested: cfg.requested(b), assigned: cfg.assignedFor(b).length })),
        [bookings, cfg]);

    const toAssign = needRows.filter(r => r.assigned < r.requested);
    const doneRows = needRows.filter(r => r.assigned >= r.requested);

    // ownerId → true for the currently selected booking's units (ring highlight)
    const unitOwner = (unit) => unit.bookingId || null;

    const handleUnitClick = (unit) => {
        const owner = unitOwner(unit);
        if (owner && owner === selectedBookingId) { cfg.unassign(unit.id); return; }   // toggle off
        if (selectedBookingId) { cfg.assign(unit.id, selectedBookingId); return; }       // assign / reassign
        if (owner) { cfg.unassign(unit.id); return; }                                    // clear when nothing selected
        toast({ title: 'Pick a booking first', description: `Select a name on the left, then click ${cfg.unitWord}s to assign.` });
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveBookingId(null);
        if (!over) return;
        const bookingId = active.data.current?.bookingId;
        const unitId = over.data.current?.unitId;
        if (bookingId && unitId) cfg.assign(unitId, bookingId);
    };

    const activeBooking = activeBookingId ? bookingById[activeBookingId] : null;

    const ModeToggle = () => (
        <div className="inline-flex rounded-full border bg-muted p-0.5">
            {[{ id: 'stalls', label: 'Stalls', Icon: Home }, { id: 'rv', label: 'RV / Camping', Icon: Car }].map(m => (
                <button key={m.id} type="button" onClick={() => { setMode(m.id); setSelectedBookingId(null); }}
                    className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        mode === m.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <m.Icon className="h-3.5 w-3.5" /> {m.label}
                </button>
            ))}
        </div>
    );

    return (
        <DndContext sensors={sensors} collisionDetection={pointerWithin}
            onDragStart={(e) => setActiveBookingId(e.active.data.current?.bookingId)}
            onDragEnd={handleDragEnd}>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <ModeToggle />
                <div className="flex items-start gap-2 text-xs text-muted-foreground flex-1 min-w-[220px]">
                    <MousePointerClick className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <p>Select a name, then click {cfg.unitWord}s to assign — or drag a name onto one. Click a filled {cfg.unitWord} to remove it.</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs shrink-0"
                    onClick={() => printStallingChart({
                        barns, rvAreas: rvWithSpots, bookings,
                        showName: meta.showName || 'Show',
                        facility: meta.facility || '',
                        dateRange: meta.dateRange || '',
                    })}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Chart
                </Button>
            </div>

            {needRows.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <cfg.Icon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">{cfg.emptyHint}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left rail — bookings */}
                    <div className="lg:col-span-4 space-y-3">
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">To assign ({toAssign.length})</p>
                            {toAssign.length === 0 ? (
                                <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Everyone is assigned.</p>
                            ) : toAssign.map(r => (
                                <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                    assigned={r.assigned} requested={r.requested}
                                    selected={selectedBookingId === r.booking.id} onSelect={setSelectedBookingId} />
                            ))}
                        </div>
                        {doneRows.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Fully assigned ({doneRows.length})</p>
                                {doneRows.map(r => (
                                    <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                        assigned={r.assigned} requested={r.requested}
                                        selected={selectedBookingId === r.booking.id} onSelect={setSelectedBookingId} />
                                ))}
                            </div>
                        )}
                        {selectedBookingId && (
                            <Button variant="outline" size="sm" className="h-7 text-xs w-full"
                                onClick={() => setSelectedBookingId(null)}>
                                <X className="h-3 w-3 mr-1" /> Clear selection
                            </Button>
                        )}
                    </div>

                    {/* Right — charts */}
                    <div className="lg:col-span-8 space-y-4">
                        {cfg.containers.length === 0 && (
                            <p className="text-sm text-muted-foreground">{cfg.noContainers}</p>
                        )}
                        {cfg.containers.map(container => {
                            const c = Math.max(1, container.cols);
                            const units = container.units;
                            const rowCount = Math.ceil(units.length / c);
                            const grid = Array.from({ length: rowCount }, (_, r) => units.slice(r * c, r * c + c));
                            const freeCount = units.filter(u => (u.type || 'stall') === 'stall' && !u.bookingId).length;
                            return (
                                <div key={container.id} className="rounded-lg border p-3 bg-background/60">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-semibold flex items-center gap-1.5"><cfg.Icon className="h-4 w-4 text-primary" /> {container.name}</p>
                                        <span className="text-xs text-muted-foreground">{freeCount} free</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <div className="inline-flex flex-col gap-0">
                                            {grid.map((rowUnits, ri) => (
                                                <div key={ri} className="flex gap-0">
                                                    {rowUnits.map(unit => {
                                                        const owner = unit.bookingId ? bookingById[unit.bookingId] : null;
                                                        return (
                                                            <UnitCell key={unit.id} unit={unit}
                                                                color={unit.bookingId ? (colorByBooking[unit.bookingId] || '#2563eb') : undefined}
                                                                ownerName={owner?.exhibitorName || 'Booked'}
                                                                isSelectedOwner={!!selectedBookingId && unit.bookingId === selectedBookingId}
                                                                onClickUnit={handleUnitClick} />
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <DragOverlay>
                {activeBooking && (
                    <div className="flex items-center gap-2 rounded-md border bg-background p-2 shadow-lg cursor-grabbing"
                        style={{ borderLeft: `4px solid ${colorByBooking[activeBooking.id] || '#2563eb'}` }}>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{activeBooking.exhibitorName || '—'}</span>
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
};

export default AssignBoard;
