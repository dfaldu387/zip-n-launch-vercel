import React, { useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { GripVertical, Home, Car, Check, MousePointerClick, X, Printer, ZoomIn, ZoomOut, Maximize2, PanelLeftClose, PanelLeftOpen, Users, Layers, Download, Loader2 } from 'lucide-react';
import {
    getRequestedStallCount, getAssignedStallsForBooking,
    assignStallToBooking, unassignStall, applyPlanToBarns,
} from '@/lib/stallAssignment';
import {
    ensureAllRvSpots, getRequestedRvCount, getAssignedRvSpotsForBooking,
    assignRvSpotToBooking, unassignRvSpot,
} from '@/lib/rvAssignment';
import { printStallingChart, downloadStallingChartPdf } from '@/lib/stallingChartPrint';
import { gridCols, computeGridLabels, labelValue, renumberStalls } from '@/lib/barnGrid';
import { STALL_LAYERS, buildLayerIndex, layerCell, layerLegend } from '@/lib/stallLayers';

// ── Assignment Board (Stalls AND RV) ──
// One screen with the booking list on the left and the chart on the right.
// A toggle switches between the stall chart and the RV / camping chart; the
// drag / click mechanics are identical. Stalls write stall.bookingId; RV spots
// write spot.bookingId — both flow to the same shared project_data.
//
// Three things make the stall chart readable at real barn sizes:
//   · zoom (S/M/L) and a Fit button that scales the whole grid into the page
//   · aisle rows collapse into a thin walkway strip instead of a wall of "aisl"
//   · a layer switch that changes only the TEXT inside each box (name, bags, …)

const PALETTE = [
    '#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed',
    '#0891b2', '#dc2626', '#4f46e5', '#059669', '#ca8a04',
    '#be123c', '#0d9488', '#9333ea', '#c2410c', '#1d4ed8',
];

// Marker stored on a booking to say "keep this one out of every group", as opposed
// to `stallGroup` being empty which means "fall back to the trainer name".
const NO_GROUP = '__none__';

const rvCols = (area) => Math.min(Math.max(1, Number(area.spotCount) || 1), 10);

// Which group a booking belongs to: an explicit manual group wins, otherwise the
// trainer / ranch name it booked under.
const groupNameOf = (b) => {
    const manual = (b.stallGroup || '').trim();
    if (manual === NO_GROUP) return '';
    if (manual) return manual;
    return (b.trainerName || '').trim();
};

// Hex + alpha, so a stall with nothing to show under the current layer still hints
// at who owns it instead of going blank.
const withAlpha = (hex, aa) => `${hex}${aa}`;

// Box sizes. `px` must match the Tailwind width so the aisle strip and the fit
// calculation line up with the boxes exactly.
const SIZES = {
    sm: { cell: 'h-9 w-12', px: 48, main: 'text-[9px]', sub: 'text-[7px]', label: 'w-8 h-9', colLabel: 'w-12' },
    md: { cell: 'h-12 w-16', px: 64, main: 'text-[10px]', sub: 'text-[8px]', label: 'w-8 h-12', colLabel: 'w-16' },
    lg: { cell: 'h-16 w-20', px: 80, main: 'text-xs', sub: 'text-[9px]', label: 'w-8 h-16', colLabel: 'w-20' },
};
const SIZE_ORDER = ['sm', 'md', 'lg'];

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
const BookingChip = ({ booking, color, assigned, requested, selected, onSelect, groupOptions, onSetGroup }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `bk-${booking.id}`,
        data: { bookingId: booking.id },
    });
    const done = assigned >= requested;
    const current = (booking.stallGroup || '').trim();
    const value = current === NO_GROUP ? NO_GROUP : (current || '__auto__');
    return (
        <div
            ref={setNodeRef}
            className={cn(
                'rounded-md border bg-background p-2 transition-all select-none',
                selected ? 'ring-2 ring-primary shadow-sm' : 'hover:bg-muted/50',
                isDragging && 'opacity-40'
            )}
            style={{ borderLeft: `4px solid ${color}` }}
        >
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelect(booking.id)}>
                <span {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground" title="Drag onto a stall">
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
            {/* Move this exhibitor into any group by hand — Robert's "take individuals
                and put them in the group". Auto = follow the trainer name they booked with. */}
            {onSetGroup && (
                <Select value={value} onValueChange={(v) => onSetGroup(booking.id, v)}>
                    <SelectTrigger className="h-6 text-[10px] mt-1.5 px-2" onClick={(e) => e.stopPropagation()}>
                        <SelectValue placeholder="Group" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__auto__" className="text-xs">
                            Auto{booking.trainerName ? ` — ${booking.trainerName}` : ' — no trainer'}
                        </SelectItem>
                        {groupOptions.map(g => (
                            <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                        ))}
                        <SelectItem value={NO_GROUP} className="text-xs">On their own</SelectItem>
                    </SelectContent>
                </Select>
            )}
        </div>
    );
};

// Draw the group outline on only the sides where the neighbouring box belongs to a
// different group — the group's boundary. The outline uses the GROUP's own colour
// (so you can tell two touching groups apart) with a white inner line so it still
// reads on top of a dark booking fill.
const outlineShadow = (sides, color) => {
    if (!sides) return null;
    const p = [];
    if (sides.top) { p.push(`inset 0 3px 0 0 ${color}`); p.push('inset 0 4px 0 0 rgba(255,255,255,0.75)'); }
    if (sides.bottom) { p.push(`inset 0 -3px 0 0 ${color}`); p.push('inset 0 -4px 0 0 rgba(255,255,255,0.75)'); }
    if (sides.left) { p.push(`inset 3px 0 0 0 ${color}`); p.push('inset 4px 0 0 0 rgba(255,255,255,0.75)'); }
    if (sides.right) { p.push(`inset -3px 0 0 0 ${color}`); p.push('inset -4px 0 0 0 rgba(255,255,255,0.75)'); }
    return p.length ? p.join(', ') : null;
};

// The 1px cell border sits OUTSIDE that inset shadow, so on a boundary box it would
// ring the group's colour in the exhibitor's colour and the block reads as the wrong
// group. Recolour only the boundary sides; the inner sides keep the exhibitor colour.
const outlineBorders = (sides, color) => {
    if (!sides) return null;
    const s = {};
    if (sides.top) s.borderTopColor = color;
    if (sides.bottom) s.borderBottomColor = color;
    if (sides.left) s.borderLeftColor = color;
    if (sides.right) s.borderRightColor = color;
    return s;
};

// A single box (stall or RV spot) — both a drop target and a click target.
const UnitCell = ({
    unit, color, ownerName, isSelectedOwner, onClickUnit,
    groupOutline, groupColor, groupName, showGroupTag, size, cellText,
}) => {
    const type = unit.type || 'stall';       // RV spots have no type → assignable
    const assignable = type === 'stall';
    const taken = assignable && !!unit.bookingId;
    const S = SIZES[size];

    const { setNodeRef, isOver } = useDroppable({
        id: `u-${unit.id}`,
        data: { unitId: unit.id },
        disabled: !assignable,
    });

    if (!assignable) {
        // Office / feed / wash / tack keep their name. Aisle and empty print nothing —
        // a quiet grey box, not the word "aisl" repeated across the row.
        const quiet = type === 'aisle' || type === 'empty';
        return (
            <div className={cn(
                'flex items-center justify-center border rounded-none -ml-px -mt-px select-none font-mono text-muted-foreground/60',
                S.cell, S.sub,
                quiet ? 'bg-muted/30 border-dashed border-muted-foreground/20' : 'bg-muted/40'
            )}>
                {quiet ? '' : (type === 'blocked' ? unit.number : type.slice(0, 4))}
            </div>
        );
    }

    const shadow = groupOutline && groupColor ? outlineShadow(groupOutline, groupColor) : null;
    const tone = cellText?.tone || 'booked';
    // What colour the box gets painted. 'warm' = pre-bedded; 'muted' = the owner holds
    // this stall but has nothing to show on this layer, so fade their colour.
    const fill = !taken ? null
        : tone === 'warm' ? '#f59e0b'
            : tone === 'muted' ? withAlpha(color, '55')
                : color;
    const darkText = taken && tone === 'muted';

    return (
        <div
            ref={setNodeRef}
            onClick={() => onClickUnit(unit)}
            title={taken
                ? `${unit.number} · ${ownerName}${groupName ? ` · ${groupName}` : ''}`
                : `${unit.number} · available — click or drop to assign`}
            className={cn(
                'relative flex flex-col items-center justify-center border rounded-none -ml-px -mt-px font-mono font-semibold cursor-pointer select-none transition-all overflow-hidden',
                S.cell, S.main,
                isOver && 'ring-2 ring-primary z-10 scale-105',
                isSelectedOwner && 'ring-2 ring-primary z-10',
                shadow && 'z-10',
                !taken && 'bg-background hover:bg-primary/10'
            )}
            style={{
                ...(fill ? { backgroundColor: fill, color: darkText ? '#0f172a' : '#fff', borderColor: fill } : {}),
                ...(shadow ? { boxShadow: shadow } : {}),
                ...(shadow ? outlineBorders(groupOutline, groupColor) : {}),
            }}
        >
            {/* The group's name, printed once at the top-left box of its block. */}
            {showGroupTag && groupName && (
                <span
                    className="absolute top-0 left-0 px-1 text-[7px] font-sans font-bold uppercase tracking-wide text-white rounded-br-sm max-w-full truncate"
                    style={{ background: groupColor }}
                >
                    {groupName}
                </span>
            )}
            <span className={cn('px-0.5 text-center leading-tight truncate max-w-full', showGroupTag && 'mt-1.5')}>
                {cellText ? cellText.text : unit.number}
            </span>
            {cellText?.sub && (
                <span className={cn(S.sub, 'opacity-70 leading-none')}>{cellText.sub}</span>
            )}
        </div>
    );
};

const AssignBoard = ({ bookings = [], barns = [], rvAreas = [], supplies = [], onApplyBarns, onApplyRvAreas, onSetBookingGroup, meta = {} }) => {
    const { toast } = useToast();
    const [mode, setMode] = useState('stalls'); // 'stalls' | 'rv'
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState(null); // a whole group picked for autofill
    const [activeBookingId, setActiveBookingId] = useState(null);
    const [size, setSize] = useState('md');
    const [fit, setFit] = useState(false);
    const [railOpen, setRailOpen] = useState(true);
    const [layer, setLayer] = useState('number');
    const [isDownloadingChart, setIsDownloadingChart] = useState(false);

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

    // Everything a layer needs to write inside a box (names, bags, pre-bedding).
    const layerIndex = useMemo(
        () => buildLayerIndex({ bookings, barns, supplies }),
        [bookings, barns, supplies]
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
                id: b.id, name: b.name, cols: gridCols(b), units: b.stalls || [],
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

    // Bookings needing THIS mode's units, and their assigned counts. At-show supply
    // re-orders hold no stalls, so they never appear on the board.
    const needRows = useMemo(() => (bookings || [])
        .filter(b => b && b.status !== 'cancelled' && b.orderType !== 'live-supply' && cfg.requested(b) > 0)
        .map(b => ({ booking: b, requested: cfg.requested(b), assigned: cfg.assignedFor(b).length })),
        [bookings, cfg]);

    const toAssign = needRows.filter(r => r.assigned < r.requested);
    const doneRows = needRows.filter(r => r.assigned >= r.requested);

    // Group the stall bookings. A manual `stallGroup` wins; otherwise the trainer /
    // ranch name they booked under. Bookings with neither stand on their own.
    const { groups, individuals } = useMemo(() => {
        if (mode !== 'stalls') return { groups: [], individuals: needRows };
        const map = new Map();
        const solo = [];
        needRows.forEach(r => {
            const name = groupNameOf(r.booking);
            const key = name.toLowerCase();
            if (!key) { solo.push(r); return; }
            if (!map.has(key)) map.set(key, { id: key, name, rows: [] });
            map.get(key).rows.push(r);
        });
        const groups = [...map.values()].map(g => ({
            ...g,
            totalRequested: g.rows.reduce((s, r) => s + r.requested, 0),
            totalAssigned: g.rows.reduce((s, r) => s + r.assigned, 0),
        }));
        return { groups, individuals: solo };
    }, [needRows, mode]);

    // Every group name an exhibitor can be moved into (existing groups + every trainer
    // name on the books, so a solo exhibitor can join a trainer who has no block yet).
    const groupOptions = useMemo(() => {
        const names = new Set(groups.map(g => g.name));
        needRows.forEach(r => { const t = (r.booking.trainerName || '').trim(); if (t) names.add(t); });
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [groups, needRows]);

    // One stable colour per group, used for the left-rail dot, the chart outline and
    // the group name tag.
    const colorByGroup = useMemo(() => {
        const m = {};
        groups.forEach((g, i) => { m[g.id] = PALETTE[i % PALETTE.length]; });
        return m;
    }, [groups]);

    const groupIdByBooking = useMemo(() => {
        const m = {};
        groups.forEach(g => g.rows.forEach(r => { m[r.booking.id] = g.id; }));
        return m;
    }, [groups]);

    const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
    const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

    const handleSetGroup = (bookingId, value) => {
        if (!onSetBookingGroup) return;
        // '__auto__' clears the manual override and falls back to the trainer name.
        onSetBookingGroup(bookingId, value === '__auto__' ? '' : value);
    };

    // Autofill a whole group starting at a stall: walk forward through the barn's boxes
    // from that point, dropping each still-needed member into the next free stall. One
    // batched save so the whole block lands at once.
    const fillGroupFrom = (group, barn, startIdx) => {
        const units = barn.stalls || [];
        const queue = [];
        // Biggest bookings first so the block stays tidy.
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

    // "Put the whole group into a row" — start at the first free stall of that row and
    // fill forward, spilling into the rows below if the group is bigger than one row.
    const fillGroupIntoRow = (group, containerId, rowIndex) => {
        const barn = (barns || []).find(b => b.id === containerId);
        if (!barn) return;
        const c = gridCols(barn);
        const units = barn.stalls || [];
        let startIdx = -1;
        for (let ci = 0; ci < c; ci++) {
            const idx = rowIndex * c + ci;
            const s = units[idx];
            if (s && (s.type || 'stall') === 'stall' && !s.bookingId) { startIdx = idx; break; }
        }
        if (startIdx === -1) { toast({ title: 'That row is full', description: 'Pick a row with at least one free stall.', variant: 'destructive' }); return; }
        fillGroupFrom(group, barn, startIdx);
    };

    const handleUnitClick = (unit) => {
        // A whole group is selected → autofill it from this stall.
        if (mode === 'stalls' && selectedGroup) {
            if ((unit.type || 'stall') !== 'stall') return;
            if (unit.bookingId) { toast({ title: 'Start on an empty stall', description: 'Click a free stall to place the group.' }); return; }
            const barn = (barns || []).find(b => (b.stalls || []).some(s => s.id === unit.id));
            if (!barn) return;
            fillGroupFrom(selectedGroup, barn, (barn.stalls || []).findIndex(s => s.id === unit.id));
            return;
        }
        const owner = unit.bookingId || null;
        if (owner && owner === selectedBookingId) { cfg.unassign(unit.id); return; }   // toggle off
        if (selectedBookingId) { cfg.assign(unit.id, selectedBookingId); return; }       // assign / reassign
        if (owner) { cfg.unassign(unit.id); return; }                                    // clear when nothing selected
        toast({ title: 'Pick a booking first', description: `Select a name on the left, then click ${cfg.unitWord}s to assign.` });
    };

    // Save a custom row/column label onto its barn (stalls only). Sparse arrays are
    // fine — unset slots fall back to the A,B,C / 1,2,3 defaults.
    // Under row numbering the stall names are BUILT from these labels, so the barn
    // must be renumbered whenever one changes. (A no-op in continuous mode.)
    const withRenumber = (b) => ({ ...b, stalls: renumberStalls(b.stalls || [], b, gridCols(b)) });

    const setBarnLabel = (barnId, field, index, value) => {
        const next = (barns || []).map(b => {
            if (b.id !== barnId) return b;
            const arr = [...(b[field] || [])];
            arr[index] = value;
            return withRenumber({ ...b, [field]: arr });
        });
        onApplyBarns?.(next);
    };

    const resetBarnLabels = (barnId) => {
        const next = (barns || []).map(b =>
            b.id === barnId ? withRenumber({ ...b, rowLabels: [], colLabels: [] }) : b,
        );
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
    const bumpSize = (dir) => {
        setFit(false);
        setSize(cur => SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, Math.max(0, SIZE_ORDER.indexOf(cur) + dir))]);
    };

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

            {/* Toolbar: mode · layer · zoom · print */}
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={railOpen ? 'Hide the name list' : 'Show the name list'}
                        onClick={() => setRailOpen(o => !o)}>
                        {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                    </Button>
                    <ModeToggle />
                    {mode === 'stalls' && (
                        <div className="flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                            <Select value={layer} onValueChange={setLayer}>
                                <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STALL_LAYERS.map(l => (
                                        <SelectItem key={l.id} value={l.id} className="text-xs" title={l.hint}>{l.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" title="Smaller boxes" disabled={size === 'sm' && !fit} onClick={() => bumpSize(-1)}>
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" title="Bigger boxes" disabled={size === 'lg' && !fit} onClick={() => bumpSize(1)}>
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant={fit ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1.5" title="Shrink the chart until the whole barn fits the page"
                        onClick={() => setFit(f => !f)}>
                        <Maximize2 className="h-3.5 w-3.5" /> Fit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs shrink-0 ml-1"
                        onClick={() => printStallingChart({
                            barns, rvAreas: rvWithSpots, bookings, supplies,
                            layer: mode === 'stalls' ? layer : 'number',
                            showName: meta.showName || 'Show',
                            facility: meta.facility || '',
                            dateRange: meta.dateRange || '',
                        })}>
                        <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Chart
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={isDownloadingChart}
                        title="Download the whole chart as a one-page PDF"
                        onClick={async () => {
                            setIsDownloadingChart(true);
                            try {
                                const ok = await downloadStallingChartPdf({
                                    barns, rvAreas: rvWithSpots, bookings, supplies,
                                    layer: mode === 'stalls' ? layer : 'number',
                                    showName: meta.showName || 'Show',
                                    facility: meta.facility || '',
                                    dateRange: meta.dateRange || '',
                                });
                                if (!ok) toast({ title: 'Download failed', description: 'Could not build the chart PDF.', variant: 'destructive' });
                            } finally {
                                setIsDownloadingChart(false);
                            }
                        }}>
                        {isDownloadingChart
                            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Building…</>
                            : <><Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF</>}
                    </Button>
                </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
                <MousePointerClick className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <p>
                    Select a name{mode === 'stalls' ? ' (or "Assign group" for a whole trainer block)' : ''}, then click {cfg.unitWord}s to assign — or drag a name onto one. Click a filled {cfg.unitWord} to remove it.
                    {mode === 'stalls' && layerLegend(layer) && <span className="block mt-0.5 text-muted-foreground/80">{layerLegend(layer)}</span>}
                </p>
            </div>

            {needRows.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <cfg.Icon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">{cfg.emptyHint}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className={cn('grid grid-cols-1 gap-4', railOpen && 'lg:grid-cols-12')}>
                    {/* Left rail — bookings, grouped (Stalls mode) */}
                    {railOpen && (
                        <div className="lg:col-span-4 space-y-3">
                            {mode === 'stalls' ? (
                                <>
                                    {selectedGroup && (
                                        <div className="rounded-md border border-primary bg-primary/5 p-2 text-xs">
                                            Group <span className="font-semibold">{selectedGroup.name}</span> selected — click the first empty stall to place all{' '}
                                            <span className="font-semibold">{Math.max(0, selectedGroup.totalRequested - selectedGroup.totalAssigned)}</span> remaining stalls in a block,
                                            or pick a row from the <span className="font-semibold">Place in row</span> box above a barn.
                                        </div>
                                    )}
                                    {groups.map(g => {
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
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {g.rows.length} exhibitor{g.rows.length > 1 ? 's' : ''} ·{' '}
                                                            <span className={cn(done ? 'text-emerald-600' : 'text-amber-600', 'font-medium tabular-nums')}>{g.totalAssigned}/{g.totalRequested}</span> stalls
                                                        </p>
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
                                                            selected={selectedBookingId === r.booking.id} onSelect={pickBooking}
                                                            groupOptions={groupOptions} onSetGroup={onSetBookingGroup ? handleSetGroup : null} />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {individuals.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5" /> On their own ({individuals.length})
                                            </p>
                                            {individuals.map(r => (
                                                <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                                    assigned={r.assigned} requested={r.requested}
                                                    selected={selectedBookingId === r.booking.id} onSelect={pickBooking}
                                                    groupOptions={groupOptions} onSetGroup={onSetBookingGroup ? handleSetGroup : null} />
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
                                                selected={selectedBookingId === r.booking.id} onSelect={pickBooking} groupOptions={[]} />
                                        ))}
                                    </div>
                                    {doneRows.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold uppercase text-muted-foreground">Fully assigned ({doneRows.length})</p>
                                            {doneRows.map(r => (
                                                <BookingChip key={r.booking.id} booking={r.booking} color={colorByBooking[r.booking.id]}
                                                    assigned={r.assigned} requested={r.requested}
                                                    selected={selectedBookingId === r.booking.id} onSelect={pickBooking} groupOptions={[]} />
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
                    )}

                    {/* Right — charts */}
                    <div className={cn('space-y-4', railOpen && 'lg:col-span-8')}>
                        {cfg.containers.length === 0 && (
                            <p className="text-sm text-muted-foreground">{cfg.noContainers}</p>
                        )}
                        {cfg.containers.map(container => (
                            <ContainerChart
                                key={container.id}
                                container={container}
                                isStalls={mode === 'stalls'}
                                size={size}
                                fit={fit}
                                layer={layer}
                                layerIndex={layerIndex}
                                Icon={cfg.Icon}
                                bookingById={bookingById}
                                colorByBooking={colorByBooking}
                                colorByGroup={colorByGroup}
                                groupIdByBooking={groupIdByBooking}
                                groupById={groupById}
                                selectedBookingId={selectedBookingId}
                                selectedGroup={selectedGroup}
                                onClickUnit={handleUnitClick}
                                onSetLabel={setBarnLabel}
                                onResetLabels={resetBarnLabels}
                                onFillRow={fillGroupIntoRow}
                            />
                        ))}
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

// One barn (or RV area) drawn as a grid, with its label gutters, its aisle strips and
// — when "Fit" is on — scaled down until the whole thing fits the page width.
const ContainerChart = ({
    container, isStalls, size, fit, layer, layerIndex, Icon,
    bookingById, colorByBooking, colorByGroup, groupIdByBooking, groupById,
    selectedBookingId, selectedGroup, onClickUnit, onSetLabel, onResetLabels, onFillRow,
}) => {
    const wrapRef = useRef(null);
    const innerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [scaledHeight, setScaledHeight] = useState(null);
    const S = SIZES[size];
    const c = Math.max(1, container.cols);
    const units = container.units;
    const rowCount = Math.ceil(units.length / c);

    // Natural width of the grid = row-label gutter + one box per column.
    const naturalWidth = (isStalls ? 32 : 0) + c * S.px;

    // `Fit` shrinks the grid with a CSS transform. A transform doesn't change layout
    // height, so we also pin the wrapper's height to the scaled height — otherwise a
    // shrunk chart leaves a tall band of empty space under it.
    const measure = useCallback(() => {
        if (!fit) { setScale(1); setScaledHeight(null); return; }
        const w = wrapRef.current?.clientWidth || 0;
        const k = w && naturalWidth > w ? w / naturalWidth : 1;
        setScale(k);
        const h = innerRef.current?.offsetHeight || 0;
        setScaledHeight(h ? Math.ceil(h * k) : null);
    }, [fit, naturalWidth]);

    useLayoutEffect(() => {
        measure();
        if (!fit) return undefined;
        const ro = new ResizeObserver(measure);
        if (wrapRef.current) ro.observe(wrapRef.current);
        return () => ro.disconnect();
    }, [measure, fit, size, units.length]);

    const { rowLabels: defRowLabels, colLabels: defColLabels } = useMemo(
        () => computeGridLabels(units, c), [units, c]
    );
    const grid = useMemo(
        () => Array.from({ length: rowCount }, (_, r) => units.slice(r * c, r * c + c)),
        [units, c, rowCount]
    );
    const freeCount = units.filter(u => (u.type || 'stall') === 'stall' && !u.bookingId).length;

    // Rows that hold nothing but aisle / empty boxes collapse into one thin walkway
    // strip. Ten grey boxes reading "aisl" is noise, not information.
    const isWalkwayRow = (row) => row.length > 0 && row.every(u => {
        const t = u.type || 'stall';
        return t === 'aisle' || t === 'empty';
    });

    // Rows the organizer can drop a whole group into (rows with at least one free stall).
    const rowChoices = useMemo(() => {
        if (!isStalls || !selectedGroup) return [];
        const out = [];
        for (let ri = 0; ri < rowCount; ri++) {
            const row = grid[ri];
            const free = row.filter(u => (u.type || 'stall') === 'stall' && !u.bookingId).length;
            if (free > 0) out.push({ ri, label: labelValue(container.rowLabels, defRowLabels, ri) || `Row ${ri + 1}`, free });
        }
        return out;
    }, [isStalls, selectedGroup, grid, rowCount, container.rowLabels, defRowLabels]);

    const gOf = (j) => (j >= 0 && j < units.length && units[j]?.bookingId) ? groupIdByBooking[units[j].bookingId] : null;

    return (
        <div className="rounded-lg border p-3 bg-background/60">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Icon className="h-4 w-4 text-primary" /> {container.name}</p>
                <div className="flex items-center gap-2">
                    {/* "Put this group into a row and autofill it" */}
                    {rowChoices.length > 0 && (
                        <Select onValueChange={(v) => onFillRow(selectedGroup, container.id, Number(v))}>
                            <SelectTrigger className="h-7 text-xs w-[150px]">
                                <SelectValue placeholder={`Place ${selectedGroup.name} in row…`} />
                            </SelectTrigger>
                            <SelectContent>
                                {rowChoices.map(r => (
                                    <SelectItem key={r.ri} value={String(r.ri)} className="text-xs">
                                        Row {r.label} — {r.free} free
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <span className="text-xs text-muted-foreground">{freeCount} free</span>
                </div>
            </div>
            {isStalls && (
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-[11px] text-muted-foreground">
                        ✏️ Click a <span className="font-medium text-foreground">row (A, B…)</span> or <span className="font-medium text-foreground">column (1, 2…)</span> label to rename it.
                    </p>
                    {((container.rowLabels || []).some(Boolean) || (container.colLabels || []).some(Boolean)) && (
                        <button type="button" onClick={() => onResetLabels(container.id)}
                            className="text-[11px] text-muted-foreground hover:text-primary underline shrink-0">
                            Reset labels
                        </button>
                    )}
                </div>
            )}
            <div ref={wrapRef} className={cn(fit ? 'overflow-hidden' : 'overflow-x-auto')}
                style={fit && scaledHeight ? { height: scaledHeight } : undefined}>
                <div ref={innerRef} className="inline-flex flex-col gap-0 origin-top-left" style={fit ? { transform: `scale(${scale})` } : undefined}>
                    {/* Column labels (1,2,3… default, click to rename) — stalls only */}
                    {isStalls && (
                        <div className="flex gap-0">
                            <div className="h-6 w-8 shrink-0" />
                            {Array.from({ length: c }).map((_, ci) => (
                                <LabelInput
                                    key={ci}
                                    value={labelValue(container.colLabels, defColLabels, ci)}
                                    title="Column label — click to rename"
                                    onCommit={(val) => onSetLabel(container.id, 'colLabels', ci, val)}
                                    className={cn('h-6 text-center text-[10px] font-semibold text-muted-foreground bg-transparent outline-none cursor-text rounded-sm border border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 focus:border-primary focus:border-solid focus:bg-primary/10 focus:text-foreground', S.colLabel, ci > 0 && '-ml-px')}
                                />
                            ))}
                        </div>
                    )}
                    {grid.map((rowUnits, ri) => {
                        // A pure aisle row → one thin walkway strip. Its label is usually blank
                        // (the smart defaults skip aisle lines) but a typed one still shows.
                        if (isStalls && isWalkwayRow(rowUnits)) {
                            const rl = labelValue(container.rowLabels, defRowLabels, ri);
                            return (
                                <div key={ri} className="flex gap-0 items-center">
                                    <div className="w-8 shrink-0 text-center text-[10px] font-semibold text-muted-foreground">{rl}</div>
                                    {/* Boxes overlap by 1px (-ml-px) so their borders merge into one grid
                                        line; the strip has to subtract those overlaps or it overhangs. */}
                                    <div className="h-2 my-px rounded-sm bg-muted-foreground/10 border border-dashed border-muted-foreground/20"
                                        style={{ width: c * S.px - (c - 1) }} title="Aisle / walkway" />
                                </div>
                            );
                        }
                        return (
                            <div key={ri} className="flex gap-0 items-stretch">
                                {/* Row label (A,B,C… default, click to rename) — stalls only */}
                                {isStalls && (
                                    <LabelInput
                                        value={labelValue(container.rowLabels, defRowLabels, ri)}
                                        title="Row label — click to rename"
                                        onCommit={(val) => onSetLabel(container.id, 'rowLabels', ri, val)}
                                        className={cn('shrink-0 text-center text-[10px] font-semibold text-muted-foreground bg-transparent outline-none cursor-text rounded-sm border border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 focus:border-primary focus:border-solid focus:bg-primary/10 focus:text-foreground', S.label, ri > 0 && '-mt-px')}
                                    />
                                )}
                                {rowUnits.map((unit, ci) => {
                                    const owner = unit.bookingId ? bookingById[unit.bookingId] : null;
                                    // Group outline: a border on each side where the neighbouring box
                                    // belongs to a different group (the group's boundary).
                                    const gid = isStalls && unit.bookingId ? groupIdByBooking[unit.bookingId] : null;
                                    let sides = null;
                                    if (gid) {
                                        const idx = ri * c + ci;
                                        sides = {
                                            top: gOf(idx - c) !== gid,
                                            bottom: gOf(idx + c) !== gid,
                                            left: ci === 0 || gOf(idx - 1) !== gid,
                                            right: ci === c - 1 || gOf(idx + 1) !== gid,
                                        };
                                    }
                                    return (
                                        <UnitCell key={unit.id} unit={unit}
                                            size={size}
                                            cellText={isStalls ? layerCell(layer, { unit, index: layerIndex }) : null}
                                            color={unit.bookingId ? (colorByBooking[unit.bookingId] || '#2563eb') : undefined}
                                            ownerName={owner?.exhibitorName || 'Booked'}
                                            isSelectedOwner={!!selectedBookingId && unit.bookingId === selectedBookingId}
                                            groupOutline={sides}
                                            groupColor={gid ? colorByGroup[gid] : undefined}
                                            groupName={gid ? groupById[gid]?.name : undefined}
                                            showGroupTag={!!(sides && sides.top && sides.left && size !== 'sm')}
                                            onClickUnit={onClickUnit} />
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AssignBoard;
