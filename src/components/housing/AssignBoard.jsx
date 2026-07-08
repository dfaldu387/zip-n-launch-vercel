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
    assignStallToBooking, unassignStall, applyPlanToBarns,
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

// Spreadsheet-style default labels: rows → A, B, … Z, AA, AB…; columns → 1, 2, 3…
// Users can overtype either with any custom text (stored on the barn).
const defaultRowLabel = (i) => {
    let n = i, s = '';
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
};
// Smart defaults: letter only the ROWS that actually contain stalls (A on the first
// stall row, skipping aisle/empty rows) and number only the COLUMNS with stalls — so
// the labels line up with real stalls the way a paper barn chart letters each aisle.
// Aisle-only rows/columns get a blank default (still editable if the user wants one).
const computeGridLabels = (units, cols) => {
    const c = Math.max(1, cols);
    const rowCount = Math.ceil(units.length / c);
    const isStall = (u) => u && (u.type || 'stall') === 'stall';
    let rc = 0;
    const rowLabels = Array.from({ length: rowCount }, (_, r) =>
        units.slice(r * c, r * c + c).some(isStall) ? defaultRowLabel(rc++) : '');
    let cc = 0;
    const colLabels = Array.from({ length: c }, (_, col) => {
        for (let r = 0; r < rowCount; r++) if (isStall(units[r * c + col])) return String(++cc);
        return '';
    });
    return { rowLabels, colLabels };
};
// A custom label (if the user typed one) wins; otherwise fall back to the smart default.
const labelValue = (custom, defaults, i) =>
    (custom && custom[i] != null && custom[i] !== '') ? custom[i] : (defaults[i] ?? '');

// A header cell you can type into. Holds a local buffer and commits on blur/Enter so
// we don't persist (and re-render the whole board) on every keystroke.
const LabelInput = ({ value, onCommit, className, title }) => {
    const [v, setV] = useState(value);
    React.useEffect(() => { setV(value); }, [value]);
    return (
        <input
            value={v}
            title={title}
            onChange={(e) => setV(e.target.value)}
            onBlur={() => { if (v !== value) onCommit(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className={className}
        />
    );
};

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

// Group outline colour: a bold near-black boundary that stays visible on top of any
// booking fill colour (the group's identity colour lives on the left-rail dot).
const GROUP_OUTLINE = '#0f172a';

// Build an inset box-shadow that draws the group outline on only the sides where the
// neighbouring box belongs to a different group (i.e. the group's boundary). A thin
// white line sits just inside so the dark edge reads clearly against dark fills too.
const outlineShadow = (sides) => {
    if (!sides) return null;
    const p = [];
    if (sides.top) { p.push(`inset 0 3px 0 0 ${GROUP_OUTLINE}`); p.push('inset 0 4px 0 0 rgba(255,255,255,0.6)'); }
    if (sides.bottom) { p.push(`inset 0 -3px 0 0 ${GROUP_OUTLINE}`); p.push('inset 0 -4px 0 0 rgba(255,255,255,0.6)'); }
    if (sides.left) { p.push(`inset 3px 0 0 0 ${GROUP_OUTLINE}`); p.push('inset 4px 0 0 0 rgba(255,255,255,0.6)'); }
    if (sides.right) { p.push(`inset -3px 0 0 0 ${GROUP_OUTLINE}`); p.push('inset -4px 0 0 0 rgba(255,255,255,0.6)'); }
    return p.length ? p.join(', ') : null;
};

// A single box (stall or RV spot) — both a drop target and a click target.
const UnitCell = ({ unit, color, ownerName, isSelectedOwner, onClickUnit, groupOutline, groupColor, groupName }) => {
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

    const shadow = groupOutline ? outlineShadow(groupOutline) : null;

    return (
        <div
            ref={setNodeRef}
            onClick={() => onClickUnit(unit)}
            title={taken ? `${unit.number} · ${ownerName}${groupName ? ` · ${groupName}` : ''}` : `${unit.number} · available — click or drop to assign`}
            className={cn(
                'flex items-center justify-center border rounded-none -ml-px -mt-px h-9 w-12 text-[9px] font-mono font-semibold cursor-pointer select-none transition-all',
                isOver && 'ring-2 ring-primary z-10 scale-105',
                isSelectedOwner && 'ring-2 ring-primary z-10',
                shadow && 'z-10',
                !taken && 'bg-background hover:bg-primary/10'
            )}
            style={{
                ...(taken ? { backgroundColor: color, color: '#fff', borderColor: color } : {}),
                ...(shadow ? { boxShadow: shadow } : {}),
            }}
        >
            {unit.number}
        </div>
    );
};

const AssignBoard = ({ bookings = [], barns = [], rvAreas = [], onApplyBarns, onApplyRvAreas, meta = {} }) => {
    const { toast } = useToast();
    const [mode, setMode] = useState('stalls'); // 'stalls' | 'rv'
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState(null); // a whole trainer group picked for autofill
    const [activeBookingId, setActiveBookingId] = useState(null);

    // Selecting a booking and selecting a group are mutually exclusive.
    const pickBooking = (id) => { setSelectedGroupId(null); setSelectedBookingId(id); };
    const pickGroup = (id) => { setSelectedBookingId(null); setSelectedGroupId(prev => prev === id ? null : id); };

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
                rowLabels: b.rowLabels || [], colLabels: b.colLabels || [],
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

    // Group the stall bookings by Trainer / Ranch / Group name (reuses the contact
    // field exhibitors enter when booking). Bookings with no trainer are individuals.
    const { trainerGroups, individuals } = useMemo(() => {
        if (mode !== 'stalls') return { trainerGroups: [], individuals: needRows };
        const map = new Map();
        const solo = [];
        needRows.forEach(r => {
            const key = (r.booking.trainerName || '').trim().toLowerCase();
            if (!key) { solo.push(r); return; }
            if (!map.has(key)) map.set(key, { id: key, name: (r.booking.trainerName || '').trim(), rows: [] });
            map.get(key).rows.push(r);
        });
        const trainerGroups = [...map.values()].map(g => ({
            ...g,
            totalRequested: g.rows.reduce((s, r) => s + r.requested, 0),
            totalAssigned: g.rows.reduce((s, r) => s + r.assigned, 0),
        }));
        return { trainerGroups, individuals: solo };
    }, [needRows, mode]);

    // One stable colour per trainer group, used for the left-rail dot and the chart outline.
    const colorByGroup = useMemo(() => {
        const m = {};
        trainerGroups.forEach((g, i) => { m[g.id] = PALETTE[i % PALETTE.length]; });
        return m;
    }, [trainerGroups]);

    // bookingId → its trainer group id (only bookings that belong to a named group).
    const groupIdByBooking = useMemo(() => {
        const m = {};
        trainerGroups.forEach(g => g.rows.forEach(r => { m[r.booking.id] = g.id; }));
        return m;
    }, [trainerGroups]);

    const groupById = useMemo(
        () => Object.fromEntries(trainerGroups.map(g => [g.id, g])),
        [trainerGroups]
    );

    const selectedGroup = trainerGroups.find(g => g.id === selectedGroupId) || null;

    // ownerId → true for the currently selected booking's units (ring highlight)
    const unitOwner = (unit) => unit.bookingId || null;

    // Autofill a whole group starting at the clicked stall: walk forward through the
    // barn's boxes from that point, dropping each still-needed member into the next
    // free stall. One batched save so the whole block lands at once.
    const fillGroupFrom = (group, startUnit) => {
        const barn = (barns || []).find(b => (b.stalls || []).some(s => s.id === startUnit.id));
        if (!barn) return;
        const units = barn.stalls || [];
        const startIdx = units.findIndex(s => s.id === startUnit.id);
        // Build the queue of stalls still needed, biggest bookings first so blocks stay tidy.
        const queue = [];
        [...group.rows].sort((a, b) => b.requested - a.requested).forEach(r => {
            const remaining = r.requested - r.assigned;
            for (let i = 0; i < remaining; i++) queue.push(r.booking.id);
        });
        if (queue.length === 0) { toast({ title: 'Group already fully assigned' }); return; }
        const plan = [];
        for (let i = startIdx; i < units.length && queue.length; i++) {
            const s = units[i];
            if ((s.type || 'stall') === 'stall' && !s.bookingId) {
                plan.push({ stallId: s.id, bookingId: queue.shift() });
            }
        }
        if (plan.length === 0) { toast({ title: 'No free stalls here', description: 'Pick an empty stall to start the group.' }); return; }
        onApplyBarns?.(applyPlanToBarns(barns, plan));
        setSelectedGroupId(null);
        if (queue.length > 0) {
            toast({ title: `Placed ${plan.length} of "${group.name}"`, description: `${queue.length} still need stalls — ran out of free boxes from here.`, variant: 'destructive' });
        } else {
            toast({ title: `Group "${group.name}" placed`, description: `${plan.length} stalls filled.` });
        }
    };

    const handleUnitClick = (unit) => {
        // A whole group is selected → autofill it from this stall.
        if (mode === 'stalls' && selectedGroup) {
            if ((unit.type || 'stall') !== 'stall') return;
            if (unit.bookingId) { toast({ title: 'Start on an empty stall', description: 'Click a free stall to place the group.' }); return; }
            fillGroupFrom(selectedGroup, unit);
            return;
        }
        const owner = unitOwner(unit);
        if (owner && owner === selectedBookingId) { cfg.unassign(unit.id); return; }   // toggle off
        if (selectedBookingId) { cfg.assign(unit.id, selectedBookingId); return; }       // assign / reassign
        if (owner) { cfg.unassign(unit.id); return; }                                    // clear when nothing selected
        toast({ title: 'Pick a booking first', description: `Select a name on the left, then click ${cfg.unitWord}s to assign.` });
    };

    // Save a custom row/column label onto its barn (stalls only). Sparse arrays are
    // fine — unset slots fall back to the A,B,C / 1,2,3 defaults.
    const setBarnLabel = (barnId, field, index, value) => {
        const next = (barns || []).map(b => {
            if (b.id !== barnId) return b;
            const arr = [...(b[field] || [])];
            arr[index] = value;
            return { ...b, [field]: arr };
        });
        onApplyBarns?.(next);
    };

    // Clear all custom labels on a barn so the smart A,B,C / 1,2,3 defaults return.
    const resetBarnLabels = (barnId) => {
        const next = (barns || []).map(b => (b.id === barnId ? { ...b, rowLabels: [], colLabels: [] } : b));
        onApplyBarns?.(next);
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
                <button key={m.id} type="button" onClick={() => { setMode(m.id); setSelectedBookingId(null); setSelectedGroupId(null); }}
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
                    <p>Select a name{mode === 'stalls' ? ' (or "Assign group" for a whole trainer block)' : ''}, then click {cfg.unitWord}s to assign — or drag a name onto one. Click a filled {cfg.unitWord} to remove it.</p>
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
                    {/* Left rail — bookings (grouped by trainer in Stalls mode) */}
                    <div className="lg:col-span-4 space-y-3">
                        {mode === 'stalls' ? (
                            <>
                                {selectedGroup && (
                                    <div className="rounded-md border border-primary bg-primary/5 p-2 text-xs">
                                        Group <span className="font-semibold">{selectedGroup.name}</span> selected — click the first empty stall to place all{' '}
                                        <span className="font-semibold">{Math.max(0, selectedGroup.totalRequested - selectedGroup.totalAssigned)}</span> remaining stalls in a block.
                                    </div>
                                )}
                                {trainerGroups.map(g => {
                                    const remaining = g.totalRequested - g.totalAssigned;
                                    const done = remaining <= 0;
                                    const sel = selectedGroupId === g.id;
                                    return (
                                        <div key={g.id} className={cn('rounded-lg border p-2 space-y-1.5', sel && 'ring-2 ring-primary')} style={{ borderLeft: `4px solid ${colorByGroup[g.id]}` }}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                                                        <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: colorByGroup[g.id] }} />
                                                        {g.name}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">{g.rows.length} exhibitor{g.rows.length > 1 ? 's' : ''} · <span className={cn(done ? 'text-emerald-600' : 'text-amber-600', 'font-medium tabular-nums')}>{g.totalAssigned}/{g.totalRequested}</span> stalls</p>
                                                </div>
                                                <Button variant={sel ? 'default' : 'outline'} size="sm" className="h-7 text-xs shrink-0" disabled={done}
                                                    onClick={() => pickGroup(g.id)}>
                                                    {done ? <Check className="h-3.5 w-3.5" /> : (sel ? 'Selected' : 'Assign group')}
                                                </Button>
                                            </div>
                                            <div className="space-y-1 pl-1">
                                                {g.rows.map(r => (
                                                    <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                                        assigned={r.assigned} requested={r.requested}
                                                        selected={selectedBookingId === r.booking.id} onSelect={pickBooking} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                {individuals.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">Individuals ({individuals.length})</p>
                                        {individuals.map(r => (
                                            <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                                assigned={r.assigned} requested={r.requested}
                                                selected={selectedBookingId === r.booking.id} onSelect={pickBooking} />
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">To assign ({toAssign.length})</p>
                                    {toAssign.length === 0 ? (
                                        <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Everyone is assigned.</p>
                                    ) : toAssign.map(r => (
                                        <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                            assigned={r.assigned} requested={r.requested}
                                            selected={selectedBookingId === r.booking.id} onSelect={pickBooking} />
                                    ))}
                                </div>
                                {doneRows.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">Fully assigned ({doneRows.length})</p>
                                        {doneRows.map(r => (
                                            <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                                assigned={r.assigned} requested={r.requested}
                                                selected={selectedBookingId === r.booking.id} onSelect={pickBooking} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {(selectedBookingId || selectedGroupId) && (
                            <Button variant="outline" size="sm" className="h-7 text-xs w-full"
                                onClick={() => { setSelectedBookingId(null); setSelectedGroupId(null); }}>
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
                            const showLabels = mode === 'stalls';
                            const c = Math.max(1, container.cols);
                            const units = container.units;
                            const { rowLabels: defRowLabels, colLabels: defColLabels } = computeGridLabels(units, c);
                            const rowCount = Math.ceil(units.length / c);
                            const grid = Array.from({ length: rowCount }, (_, r) => units.slice(r * c, r * c + c));
                            const freeCount = units.filter(u => (u.type || 'stall') === 'stall' && !u.bookingId).length;
                            return (
                                <div key={container.id} className="rounded-lg border p-3 bg-background/60">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-semibold flex items-center gap-1.5"><cfg.Icon className="h-4 w-4 text-primary" /> {container.name}</p>
                                        <span className="text-xs text-muted-foreground">{freeCount} free</span>
                                    </div>
                                    {showLabels && (
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <p className="text-[11px] text-muted-foreground">
                                                ✏️ Click a <span className="font-medium text-foreground">row (A, B…)</span> or <span className="font-medium text-foreground">column (1, 2…)</span> label to rename it.
                                            </p>
                                            {((container.rowLabels || []).some(Boolean) || (container.colLabels || []).some(Boolean)) && (
                                                <button
                                                    type="button"
                                                    onClick={() => resetBarnLabels(container.id)}
                                                    className="text-[11px] text-muted-foreground hover:text-primary underline shrink-0"
                                                >
                                                    Reset labels
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="overflow-x-auto">
                                        <div className="inline-flex flex-col gap-0">
                                            {/* Column labels (1,2,3… default, click to rename) — stalls only */}
                                            {showLabels && (
                                                <div className="flex gap-0">
                                                    <div className="h-6 w-8 shrink-0" />
                                                    {Array.from({ length: c }).map((_, ci) => (
                                                        <LabelInput
                                                            key={ci}
                                                            value={labelValue(container.colLabels, defColLabels, ci)}
                                                            title="Column label — click to rename"
                                                            onCommit={(val) => setBarnLabel(container.id, 'colLabels', ci, val)}
                                                            className={cn('h-6 w-12 text-center text-[10px] font-semibold text-muted-foreground bg-transparent outline-none cursor-text rounded-sm border border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 focus:border-primary focus:border-solid focus:bg-primary/10 focus:text-foreground', ci > 0 && '-ml-px')}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {grid.map((rowUnits, ri) => (
                                                <div key={ri} className="flex gap-0 items-stretch">
                                                    {/* Row label (A,B,C… default, click to rename) — stalls only */}
                                                    {showLabels && (
                                                        <LabelInput
                                                            value={labelValue(container.rowLabels, defRowLabels, ri)}
                                                            title="Row label — click to rename"
                                                            onCommit={(val) => setBarnLabel(container.id, 'rowLabels', ri, val)}
                                                            className={cn('h-9 w-8 shrink-0 text-center text-[10px] font-semibold text-muted-foreground bg-transparent outline-none cursor-text rounded-sm border border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 focus:border-primary focus:border-solid focus:bg-primary/10 focus:text-foreground', ri > 0 && '-mt-px')}
                                                        />
                                                    )}
                                                    {rowUnits.map((unit, ci) => {
                                                        const owner = unit.bookingId ? bookingById[unit.bookingId] : null;
                                                        // Group outline: draw a border on each side where the neighbour
                                                        // box belongs to a different group (the group's boundary).
                                                        const gid = showLabels && unit.bookingId ? groupIdByBooking[unit.bookingId] : null;
                                                        let sides = null;
                                                        if (gid) {
                                                            const idx = ri * c + ci;
                                                            const gOf = (j) => (j >= 0 && j < units.length && units[j]?.bookingId) ? groupIdByBooking[units[j].bookingId] : null;
                                                            sides = {
                                                                top: gOf(idx - c) !== gid,
                                                                bottom: gOf(idx + c) !== gid,
                                                                left: ci === 0 || gOf(idx - 1) !== gid,
                                                                right: ci === c - 1 || gOf(idx + 1) !== gid,
                                                            };
                                                        }
                                                        return (
                                                            <UnitCell key={unit.id} unit={unit}
                                                                color={unit.bookingId ? (colorByBooking[unit.bookingId] || '#2563eb') : undefined}
                                                                ownerName={owner?.exhibitorName || 'Booked'}
                                                                isSelectedOwner={!!selectedBookingId && unit.bookingId === selectedBookingId}
                                                                groupOutline={sides}
                                                                groupColor={gid ? colorByGroup[gid] : undefined}
                                                                groupName={gid ? groupById[gid]?.name : undefined}
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
