import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Users, Calendar, ChevronRight, ChevronDown, ChevronUp, FolderOpen,
    Hash, MapPin, Building2, Check, UserPlus, AlertCircle, Search,
    X, Save, Lock, Unlock,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { stampModuleStatusOnSave, isWizardReadOnly } from '@/lib/moduleStatusService';
import { ModuleLockGuard } from '@/components/shared/ModuleLockGuard';
import { v4 as uuidv4 } from 'uuid';
import { staffRoles } from '@/lib/staffingData';
import { qtyForDate, requiredDates, totalSlots as slotsForDates, filledSlots as filledForDates, findOrphanedAssignments, ORPHAN_REASONS } from '@/lib/staffQty';
import { flattenPersonnel } from '@/lib/contractUtils';
import { useToast } from '@/components/ui/use-toast';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { ShowOfficialsStaffPanel } from '@/components/shared/ShowOfficialsStaffPanel';

// ── Show Picker (reusable pattern) ──

const ShowPicker = ({ shows, onSelect }) => {
    const navigate = useNavigate();
    if (shows.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Shows Found</h3>
                    <p className="text-sm text-muted-foreground mb-6">Create a horse show first, then set up venues and arenas.</p>
                    <Button onClick={() => navigate('/horse-show-manager/create')}>Create Horse Show</Button>
                </CardContent>
            </Card>
        );
    }
    return (
        <div className="space-y-3">
            {shows.map((show, i) => {
                const pd = show.project_data || {};
                const arenaCount = (pd.arenas || []).length;
                const hasStaffSetup = arenaCount > 0 && (pd.arenas || []).some(a => (a.staffPositions || []).length > 0);
                return (
                    <motion.div key={show.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <button type="button" className="w-full text-left" onClick={() => onSelect(show)}>
                            <Card className={cn(
                                "hover:border-primary/50 hover:shadow-md transition-all cursor-pointer",
                                !hasStaffSetup && "opacity-60"
                            )}>
                                <CardContent className="py-4 px-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-base truncate">{show.project_name || 'Untitled'}</h3>
                                                {pd.showNumber && <Badge variant="secondary" className="text-xs"><Hash className="h-3 w-3 mr-0.5" />{pd.showNumber}</Badge>}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                {pd.venueName && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{pd.venueName}</span>}
                                                <span>{arenaCount} arenas</span>
                                                {pd.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{pd.startDate}</span>}
                                            </div>
                                            {!hasStaffSetup && (
                                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" /> Set up venues & arenas first
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground ml-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        </button>
                    </motion.div>
                );
            })}
        </div>
    );
};

// ── Assignment Cell ──

const AssignmentCell = ({ assignment, position, arenaId, dateStr, slotIdx = 0, allDates = [], onAssign, onRemove, employeeRoster, busyOnDate = {}, locked = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [search, setSearch] = useState('');
    const [applyAll, setApplyAll] = useState(false);

    // People still free on this day come first; anyone already booked sits at the bottom.
    const filteredRoster = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matches = q ? employeeRoster.filter(e => e.name.toLowerCase().includes(q)) : employeeRoster;
        return [...matches].sort((a, b) => (busyOnDate[a.id] ? 1 : 0) - (busyOnDate[b.id] ? 1 : 0));
    }, [employeeRoster, search, busyOnDate]);

    if (assignment) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-xs group">
                <Users className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="font-medium truncate flex-1">{assignment.employeeName}</span>
                {!locked && (
                    <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemove(assignment.id)}
                    >
                        <X className="h-3 w-3 text-destructive" />
                    </button>
                )}
            </div>
        );
    }

    if (locked) {
        return (
            <div className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md border border-dashed border-muted-foreground/20 text-xs text-muted-foreground/60 cursor-not-allowed">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="space-y-1">
                <div className="flex items-center gap-1">
                    <Input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="h-6 text-xs"
                        onKeyDown={(e) => e.key === 'Escape' && setIsEditing(false)}
                    />
                    <button type="button" onClick={() => setIsEditing(false)}>
                        <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                </div>
                {allDates.length > 1 && (
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
                        Same person on all {allDates.length} dates
                    </label>
                )}
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {filteredRoster.map(emp => {
                        const busyAt = busyOnDate[emp.id];
                        return (
                            <button
                                key={emp.id}
                                type="button"
                                disabled={!!busyAt}
                                title={busyAt ? `Already working in ${busyAt} on this date` : undefined}
                                className={cn(
                                    'w-full text-left text-xs px-2 py-1 rounded truncate',
                                    busyAt ? 'text-muted-foreground/60 cursor-not-allowed' : 'hover:bg-accent'
                                )}
                                onClick={() => {
                                    onAssign({
                                        id: uuidv4(),
                                        arenaId,
                                        date: dateStr,
                                        roleId: position.roleId,
                                        positionId: position.id,
                                        employeeId: emp.id,
                                        employeeName: emp.name,
                                    }, { slotIdx, dates: applyAll && allDates.length > 1 ? allDates : [dateStr] });
                                    setIsEditing(false);
                                    setSearch('');
                                    setApplyAll(false);
                                }}
                            >
                                {emp.name}
                                {busyAt
                                    ? <span> — busy: {busyAt}</span>
                                    : (emp.roleName && <span className="text-muted-foreground"> — {emp.roleName}</span>)}
                            </button>
                        );
                    })}
                    {filteredRoster.length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">No match</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <button
            type="button"
            className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md border border-dashed border-muted-foreground/30 text-xs text-muted-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => setIsEditing(true)}
        >
            <UserPlus className="h-3 w-3" />
            <span>Assign</span>
        </button>
    );
};

// ── Lock button shown in an arena's header ──

const LockToggle = ({ locked, onToggle }) => (
    <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
        title={locked ? 'Locked — click to unlock' : 'Lock this schedule so it cannot be changed by accident'}
        className={cn(
            'h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent',
            locked ? 'text-amber-500' : 'text-muted-foreground hover:text-primary'
        )}
    >
        {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
    </button>
);

// ── Scheduling Grid for one Arena ──

const ArenaScheduleGrid = ({ arena, dates: showDates, assignments, onAssign, onRemove, employeeRoster, busyByDate, locked = false, onToggleLock }) => {
    // Starts folded: the header already shows "N positions x D days · X of Y filled".
    const [open, setOpen] = useState(false);
    const positions = arena.staffPositions || [];
    // An arena that has its own dates is only scheduled on those; otherwise the show's dates.
    const dates = (arena.dates || []).length > 0 ? [...arena.dates].sort() : showDates;
    if (positions.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No staff positions configured for {arena.name}.</p>
                    <p className="text-xs text-muted-foreground mt-1">Go to Venue & Arena Setup to add staff positions.</p>
                </CardContent>
            </Card>
        );
    }

    const totalSlots = slotsForDates(positions, dates);
    const filled = filledForDates(positions, arena.id, dates, assignments);

    return (
        <Card>
            <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {arena.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {positions.filter(p => dates.some(d => qtyForDate(p, d) > 0)).length} positions x {dates.length} day{dates.length !== 1 ? 's' : ''} · {filled} of {totalSlots} filled
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <LockToggle locked={locked} onToggle={onToggleLock} />
                        {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                </div>
            </CardHeader>
            {open && <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/30">
                                <th className="text-left px-3 py-2 font-medium min-w-[160px]">Position</th>
                                {dates.map(d => (
                                    <th key={d} className="text-center px-3 py-2 font-medium min-w-[160px]">
                                        <div className="flex items-center justify-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(d)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map(pos => {
                                const role = staffRoles[pos.roleId];
                                const Icon = role?.icon || Users;
                                // Rows = the busiest day's need; quieter days show "—" in the extra rows.
                                const qty = Math.max(0, ...dates.map(d => qtyForDate(pos, d)));
                                return Array.from({ length: qty }, (_, slotIdx) => (
                                    <tr key={`${pos.id}-${slotIdx}`} className="border-b last:border-0">
                                        <td className="px-3 py-2">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                                <span className="font-medium text-xs">
                                                    {role?.name || pos.roleId}
                                                    {qty > 1 && <span className="text-muted-foreground ml-1">#{slotIdx + 1}</span>}
                                                </span>
                                                <RequiredBadge pos={pos} dates={dates} />
                                            </div>
                                        </td>
                                        {dates.map(dateStr => {
                                            if (slotIdx >= qtyForDate(pos, dateStr)) {
                                                return (
                                                    <td key={dateStr} className="px-2 py-1.5 text-center text-muted-foreground/50 bg-muted/20" title="Not needed this day">—</td>
                                                );
                                            }
                                            const slotAssignments = assignments.filter(
                                                a => a.arenaId === arena.id && a.date === dateStr && a.positionId === pos.id
                                            );
                                            const assignment = slotAssignments[slotIdx] || null;
                                            return (
                                                <td key={dateStr} className="px-2 py-1.5">
                                                    <AssignmentCell
                                                        assignment={assignment}
                                                        position={pos}
                                                        arenaId={arena.id}
                                                        locked={locked}
                                                        dateStr={dateStr}
                                                        slotIdx={slotIdx}
                                                        allDates={dates}
                                                        onAssign={onAssign}
                                                        onRemove={onRemove}
                                                        employeeRoster={employeeRoster}
                                                        busyOnDate={busyByDate[dateStr]}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ));
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>}
        </Card>
    );
};

// ── Shared Staff Schedule ──

const SharedStaffGrid = ({ sharedStaff, dates, assignments, onAssign, onRemove, employeeRoster, busyByDate, locked = false, onToggleLock }) => {
    const [open, setOpen] = useState(false);
    if (!sharedStaff || sharedStaff.length === 0) return null;

    const totalSlots = slotsForDates(sharedStaff, dates);
    const filled = filledForDates(sharedStaff, '__shared__', dates, assignments);

    return (
        <Card>
            <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-600" />
                            Shared / Show-Level Staff
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Staff not tied to a specific arena · {filled} of {totalSlots} filled
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <LockToggle locked={locked} onToggle={onToggleLock} />
                        {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                </div>
            </CardHeader>
            {open && <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/30">
                                <th className="text-left px-3 py-2 font-medium min-w-[160px]">Position</th>
                                {dates.map(d => (
                                    <th key={d} className="text-center px-3 py-2 font-medium min-w-[160px]">
                                        <div className="flex items-center justify-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(d)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sharedStaff.map(pos => {
                                const role = staffRoles[pos.roleId];
                                const Icon = role?.icon || Users;
                                const qty = Math.max(0, ...dates.map(d => qtyForDate(pos, d)));
                                return Array.from({ length: qty }, (_, slotIdx) => (
                                    <tr key={`${pos.id}-${slotIdx}`} className="border-b last:border-0">
                                        <td className="px-3 py-2">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <Icon className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                                                <span className="font-medium text-xs">
                                                    {role?.name || pos.roleId}
                                                    {qty > 1 && <span className="text-muted-foreground ml-1">#{slotIdx + 1}</span>}
                                                </span>
                                                <RequiredBadge pos={pos} dates={dates} />
                                            </div>
                                        </td>
                                        {dates.map(dateStr => {
                                            if (slotIdx >= qtyForDate(pos, dateStr)) {
                                                return (
                                                    <td key={dateStr} className="px-2 py-1.5 text-center text-muted-foreground/50 bg-muted/20" title="Not needed this day">—</td>
                                                );
                                            }
                                            const slotAssignments = assignments.filter(
                                                a => a.arenaId === '__shared__' && a.date === dateStr && a.positionId === pos.id
                                            );
                                            const assignment = slotAssignments[slotIdx] || null;
                                            return (
                                                <td key={dateStr} className="px-2 py-1.5">
                                                    <AssignmentCell
                                                        assignment={assignment}
                                                        position={pos}
                                                        arenaId="__shared__"
                                                        locked={locked}
                                                        dateStr={dateStr}
                                                        slotIdx={slotIdx}
                                                        allDates={dates}
                                                        onAssign={onAssign}
                                                        onRemove={onRemove}
                                                        employeeRoster={employeeRoster}
                                                        busyOnDate={busyByDate[dateStr]}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ));
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>}
        </Card>
    );
};

// ── Helpers ──

// "Req" when the position is required every day, "Req: Fri 6/19" for one or two days,
// "Req: 3 days" for more (the hover text lists them). Always one line.
function RequiredBadge({ pos, dates }) {
    const reqDays = requiredDates(pos, dates);
    if (reqDays.length === 0) return null;
    const everyDay = reqDays.length === dates.length;
    const short = (d) => {
        const dt = new Date(d + 'T00:00:00');
        return Number.isNaN(dt.getTime()) ? d : `${dt.toLocaleDateString('en-US', { weekday: 'short' })} ${dt.getMonth() + 1}/${dt.getDate()}`;
    };
    const label = everyDay ? 'Req' : reqDays.length <= 2 ? `Req: ${reqDays.map(short).join(', ')}` : `Req: ${reqDays.length} days`;
    const title = everyDay ? 'Required every day' : `Required: ${reqDays.map(formatDate).join(', ')}`;
    return <Badge variant="outline" title={title} className="text-[9px] px-1 py-0 whitespace-nowrap shrink-0">{label}</Badge>;
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

function getShowDates(pd) {
    // 1. Try arena dates
    const arenaDates = new Set();
    for (const arena of (pd.arenas || [])) {
        for (const d of (arena.dates || [])) {
            arenaDates.add(d);
        }
    }
    if (arenaDates.size > 0) {
        return [...arenaDates].sort();
    }
    // 2. Try start/end date range
    if (pd.startDate) {
        const dates = [];
        const start = new Date(pd.startDate + 'T00:00:00');
        const end = pd.endDate ? new Date(pd.endDate + 'T00:00:00') : start;
        const current = new Date(start);
        while (current <= end) {
            // Local date parts: toISOString() shifts the day back in time zones ahead of UTC.
            dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }
    // 3. Fallback to showBill days
    if (pd.showBill?.days?.length > 0) {
        return pd.showBill.days.map(d => d.date).filter(Boolean).sort();
    }
    // 4. Fallback to personnel employment dates (showDetails.officials)
    const empDates = new Set();
    const officials = pd.showDetails?.officials || pd.officials || {};
    for (const assocGroup of Object.values(officials)) {
        for (const roleGroup of Object.values(assocGroup || {})) {
            for (const person of (Array.isArray(roleGroup) ? roleGroup : [])) {
                const sd = person.employment_start_date;
                const ed = person.employment_end_date;
                if (sd) empDates.add(typeof sd === 'string' ? sd.split('T')[0] : new Date(sd).toISOString().split('T')[0]);
                if (ed) empDates.add(typeof ed === 'string' ? ed.split('T')[0] : new Date(ed).toISOString().split('T')[0]);
            }
        }
    }
    if (empDates.size > 0) {
        const sorted = [...empDates].sort();
        const dates = [];
        const start = new Date(sorted[0] + 'T00:00:00');
        const end = new Date(sorted[sorted.length - 1] + 'T00:00:00');
        const current = new Date(start);
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }
    return [];
}

// ── Employee Roster Manager ──

// Everyone who can be scheduled: the people on the show's Officials & Staff list
// (same list as Show Structure Step 3) plus any names typed in by hand earlier.
// Officials & Staff people keep their own id, so an assignment follows the person
// when they are renamed.
function buildStaffList(officials, manualRoster) {
    const fromOfficials = flattenPersonnel({ showDetails: { officials: officials || {} } })
        .filter(m => (m.name || '').trim())
        .map(m => ({
            id: m.id,
            name: m.name.trim(),
            roleName: m.roleName || '',
            cards: m.cards_held || '',
            email: m.email || '',
            phone: m.phone || '',
            source: 'officials',
        }));
    const seen = new Set(fromOfficials.map(p => p.id));
    const manual = (manualRoster || [])
        .filter(e => e && !seen.has(e.id))
        .map(e => ({
            id: e.id,
            name: e.name || '',
            roleName: '',
            cards: '',
            email: e.email || '',
            phone: e.phone || '',
            source: 'manual',
        }));
    return [...fromOfficials, ...manual];
}

// ── Master staff list ──

const StaffMasterList = ({ staffList, assignments = [], onAddManual, onRenameManual, onRemoveManual, onSave, isSaving, hasUnsaved }) => {
    const [search, setSearch] = useState('');
    const [newName, setNewName] = useState('');

    // How many days each person is booked, so unbooked people can be seen at a glance.
    const bookedDays = useMemo(() => {
        const days = {};
        for (const a of assignments) {
            if (!days[a.employeeId]) days[a.employeeId] = new Set();
            days[a.employeeId].add(a.date);
        }
        const counts = {};
        for (const [id, set] of Object.entries(days)) counts[id] = set.size;
        return counts;
    }, [assignments]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matches = !q ? staffList : staffList.filter(p =>
            [p.name, p.roleName, p.cards, p.email, p.phone].some(v => (v || '').toLowerCase().includes(q))
        );
        // Unbooked people stay at the top; booked people move down.
        return [...matches].sort((a, b) => (bookedDays[a.id] ? 1 : 0) - (bookedDays[b.id] ? 1 : 0));
    }, [staffList, search, bookedDays]);

    const handleAdd = () => {
        const name = newName.trim();
        if (!name) return;
        onAddManual({ id: uuidv4(), name, phone: '', email: '' });
        setNewName('');
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            All Staff ({staffList.length})
                            {hasUnsaved && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Everyone hired for this show. Add or edit people in Officials &amp; Staff above; they appear here and can be assigned to positions.
                        </CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={onSave} disabled={isSaving || !hasUnsaved}>
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {isSaving ? 'Saving...' : 'Save List'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, role, certification, email or phone..."
                            className="pl-9 h-9 text-sm"
                        />
                    </div>
                    <div className="flex gap-2 sm:w-80">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Add a name by hand..."
                            className="h-9 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <Button size="sm" className="h-9" onClick={handleAdd} disabled={!newName.trim()}>
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                        </Button>
                    </div>
                </div>

                {staffList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No staff yet. Add people in Officials &amp; Staff above and they will appear here.
                    </p>
                ) : visible.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No one matches "{search}".</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="text-left px-3 py-2 font-medium text-xs uppercase">Name</th>
                                    <th className="text-left px-3 py-2 font-medium text-xs uppercase">Role</th>
                                    <th className="text-left px-3 py-2 font-medium text-xs uppercase">Certifications</th>
                                    <th className="text-left px-3 py-2 font-medium text-xs uppercase">Email</th>
                                    <th className="text-left px-3 py-2 font-medium text-xs uppercase">Phone</th>
                                    <th className="text-left px-3 py-2 font-medium text-xs uppercase">Contract</th>
                                    <th className="text-left px-3 py-2 font-medium text-xs uppercase">Booked</th>
                                    <th className="px-3 py-2 w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(p => (
                                    <tr key={p.id} className="border-b last:border-0">
                                        <td className="px-3 py-2 font-medium">
                                            {p.source === 'manual' ? (
                                                <Input
                                                    value={p.name}
                                                    onChange={(e) => onRenameManual(p.id, e.target.value)}
                                                    className="h-7 text-sm"
                                                />
                                            ) : p.name}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {p.source === 'manual'
                                                ? <Badge variant="outline" className="text-[10px]">Added by hand</Badge>
                                                : (p.roleName || '—')}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">{p.cards || '—'}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{p.email || '—'}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{p.phone || '—'}</td>
                                        <td className="px-3 py-2 text-muted-foreground">—</td>
                                        <td className="px-3 py-2">
                                            {bookedDays[p.id]
                                                ? <Badge variant="secondary" className="text-[10px]">{bookedDays[p.id]} day{bookedDays[p.id] !== 1 ? 's' : ''}</Badge>
                                                : <span className="text-xs text-emerald-600">Free</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            {p.source === 'manual' && (
                                                <button
                                                    type="button"
                                                    title="Remove (also clears their assignments)"
                                                    onClick={() => onRemoveManual(p.id)}
                                                >
                                                    <X className="h-3.5 w-3.5 text-destructive" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ── Report: who is working where and when ──

const ScheduleReport = ({ assignments, arenas }) => {
    const [open, setOpen] = useState(false);
    const rows = useMemo(() => {
        const where = (arenaId) => (arenaId === '__shared__'
            ? 'Shared / Show-Level'
            : (arenas.find(a => a.id === arenaId)?.name || 'Unknown arena'));
        return [...assignments]
            .map(a => ({
                name: a.employeeName || 'Unnamed',
                date: a.date,
                location: where(a.arenaId),
                position: staffRoles[a.roleId]?.name || a.roleId || '',
            }))
            .sort((x, y) => x.name.localeCompare(y.name) || String(x.date).localeCompare(String(y.date)));
    }, [assignments, arenas]);

    // rows are already sorted by name, so people come out in order
    const byPerson = useMemo(() => {
        const map = new Map();
        rows.forEach(r => { if (!map.has(r.name)) map.set(r.name, []); map.get(r.name).push(r); });
        return [...map.entries()];
    }, [rows]);

    const downloadCsv = () => {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['Name', 'Date', 'Arena', 'Position'].map(esc).join(',')]
            .concat(rows.map(r => [r.name, r.date, r.location, r.position].map(esc).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'staff-schedule.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Who Works Where &amp; When
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {rows.length} assignment{rows.length !== 1 ? 's' : ''} · {byPerson.length} {byPerson.length === 1 ? 'person' : 'people'}
                        </CardDescription>
                    </div>
                    {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
            </CardHeader>
            {open && <CardContent>
                <Button size="sm" variant="outline" className="mb-3" onClick={downloadCsv} disabled={rows.length === 0}>
                    Download CSV
                </Button>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No one is assigned yet.</p>
                ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {byPerson.map(([name, list]) => (
                            <div key={name}>
                                <p className="text-sm font-semibold">{name}</p>
                                <ul className="mt-1 space-y-0.5">
                                    {list.map((r, i) => (
                                        <li key={i} className="text-xs text-muted-foreground">
                                            {formatDate(r.date)} · {r.location} · {r.position}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>}
        </Card>
    );
};

// ── Assignments that lost their slot ──

const OrphanedAssignmentsCard = ({ orphaned, arenas, lockedArenas, onRemove }) => {
    const arenaName = (id) => (id === '__shared__' ? 'Shared staff' : arenas.find(a => a.id === id)?.name || 'Removed arena');
    const removable = orphaned.filter(({ assignment }) => !lockedArenas[assignment.arenaId]);
    return (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/10">
            <CardContent className="py-4 space-y-3">
                <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                            {orphaned.length} assignment{orphaned.length !== 1 ? 's' : ''} no longer {orphaned.length !== 1 ? 'have' : 'has'} a slot
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                            Setup changed after these people were assigned. They cannot be seen in the grid, and they are still counted as busy on that day.
                        </p>
                    </div>
                </div>
                <ul className="space-y-2">
                    {orphaned.map(({ assignment, reason }) => (
                        <li key={assignment.id} className="rounded-md border bg-background px-2.5 py-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{assignment.employeeName || 'Unnamed'}</p>
                                    <p className="text-muted-foreground">
                                        {formatDate(assignment.date)} · {arenaName(assignment.arenaId)} · {staffRoles[assignment.roleId]?.name || assignment.roleId || 'Position'}
                                    </p>
                                    <p className="text-red-700 dark:text-red-400">{ORPHAN_REASONS[reason]}</p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs shrink-0"
                                    disabled={!!lockedArenas[assignment.arenaId]}
                                    title={lockedArenas[assignment.arenaId] ? 'Unlock this arena to remove' : 'Remove this assignment'}
                                    onClick={() => onRemove(assignment.id)}
                                >
                                    Remove
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
                {removable.length > 1 && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs w-full"
                        onClick={() => removable.forEach(({ assignment }) => onRemove(assignment.id))}
                    >
                        Remove all {removable.length}
                    </Button>
                )}
                <p className="text-[11px] text-muted-foreground">Click Save Schedule after removing.</p>
            </CardContent>
        </Card>
    );
};

// ── Main Scheduling Dashboard ──

const SchedulingDashboard = ({ show, staffList, assignments: savedAssignments, setAssignments, onSave, isSaving, lockedArenas = {}, onToggleLock }) => {
    const pd = show.project_data || {};
    const arenas = pd.arenas || [];
    const sharedStaff = pd.sharedStaff || [];
    const dates = useMemo(() => getShowDates(pd), [pd]);
    const navigate = useNavigate();
    const { toast } = useToast();

    // Show each person's CURRENT name: a rename in Officials & Staff must reach
    // the grid, not the name stored when they were assigned.
    const assignments = useMemo(() => {
        const nameById = new Map(staffList.map(p => [p.id, p.name]));
        return savedAssignments.map(a => (
            nameById.has(a.employeeId) ? { ...a, employeeName: nameById.get(a.employeeId) } : a
        ));
    }, [savedAssignments, staffList]);

    // date → { employeeId: where they already work }. One person cannot be in two
    // places on the same day, so the picker greys these out.
    const busyByDate = useMemo(() => {
        const where = (arenaId) => (arenaId === '__shared__'
            ? 'Shared staff'
            : (arenas.find(a => a.id === arenaId)?.name || 'another arena'));
        const map = {};
        for (const a of assignments) {
            if (!map[a.date]) map[a.date] = {};
            map[a.date][a.employeeId] = where(a.arenaId);
        }
        return map;
    }, [assignments, arenas]);

    // `scope` = { slotIdx, dates }: fill this same slot on each of those dates.
    // Days where the slot is taken or the person already works elsewhere are skipped.
    const addAssignment = useCallback((assignment, scope) => {
        const slotIdx = scope?.slotIdx ?? 0;
        const dateList = scope?.dates?.length ? scope.dates : [assignment.date];
        const added = [];
        const skipped = [];
        for (const d of dateList) {
            const sameSlotCount = savedAssignments.filter(a =>
                a.arenaId === assignment.arenaId && a.date === d && a.positionId === assignment.positionId
            ).length;
            const slotTaken = sameSlotCount > slotIdx;
            const personBusy = savedAssignments.some(a => a.employeeId === assignment.employeeId && a.date === d);
            if (slotTaken || personBusy) { skipped.push(d); continue; }
            added.push({ ...assignment, id: uuidv4(), date: d });
        }
        if (added.length > 0) setAssignments(prev => [...prev, ...added]);
        if (skipped.length > 0) {
            toast({
                title: added.length > 0 ? 'Some days were skipped' : 'Not assigned',
                description: `${assignment.employeeName} is already working or the slot is filled on: ${skipped.map(formatDate).join(', ')}.`,
                variant: 'destructive',
            });
        }
    }, [savedAssignments, setAssignments, toast]);

    const removeAssignment = useCallback((assignmentId) => {
        setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    }, [setAssignments]);

    const handleSave = () => {
        onSave();
    };

    // People still assigned to a slot that setup has since removed or shrunk. The grid cannot show
    // them, so the sidebar lists them and lets a person remove each one.
    const orphaned = useMemo(
        () => findOrphanedAssignments(arenas, sharedStaff, dates, assignments),
        [arenas, sharedStaff, dates, assignments]
    );

    // Stats
    const arenaDatesOf = (arena) => ((arena.dates || []).length > 0 ? arena.dates : dates);
    const totalSlots = useMemo(() => {
        let count = 0;
        for (const arena of arenas) {
            count += slotsForDates(arena.staffPositions || [], arenaDatesOf(arena));
        }
        count += slotsForDates(sharedStaff, dates);
        return count;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [arenas, sharedStaff, dates]);

    const filledSlots = useMemo(() => {
        let count = 0;
        for (const arena of arenas) {
            count += filledForDates(arena.staffPositions || [], arena.id, arenaDatesOf(arena), assignments);
        }
        count += filledForDates(sharedStaff, '__shared__', dates, assignments);
        return count;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [arenas, sharedStaff, dates, assignments]);
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    if (arenas.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Arenas Configured</h3>
                    <p className="text-sm text-muted-foreground mb-6">Set up venues and arenas with staff positions first.</p>
                    {/* In-app navigation: window.location.href reloaded the whole app,
                        which threw away unsaved schedule edits. */}
                    <Button onClick={() => navigate(`/horse-show-manager/venue-arena-setup/${show.id}`)}>
                        Go to Venue & Arena Setup
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (dates.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Show Dates Found</h3>
                    <p className="text-sm text-muted-foreground mb-6">Add dates to your arenas or set a show start/end date.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Employees</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{staffList.length}</p>
                </div>
                <div className="rounded-xl border p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Slots</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totalSlots}</p>
                </div>
                <div className="rounded-xl border p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Assigned</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{filledSlots}</p>
                </div>
                <div className="rounded-xl border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Fill Rate</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{fillRate}%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
                {/* Scheduling grids (min-w-0 lets a wide table scroll inside its card instead of pushing the sidebar off the page) */}
                <div className="space-y-4 min-w-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Schedule by Arena</h3>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {isSaving ? 'Saving...' : 'Save Schedule'}
                        </Button>
                    </div>

                    {arenas.map(arena => (
                        <ArenaScheduleGrid
                            key={arena.id}
                            arena={arena}
                            locked={!!lockedArenas[arena.id]}
                            onToggleLock={() => onToggleLock?.(arena.id)}
                            dates={dates}
                            assignments={assignments}
                            onAssign={addAssignment}
                            onRemove={removeAssignment}
                            employeeRoster={staffList}
                            busyByDate={busyByDate}
                        />
                    ))}

                    <SharedStaffGrid
                        locked={!!lockedArenas.__shared__}
                        onToggleLock={() => onToggleLock?.('__shared__')}
                        sharedStaff={sharedStaff}
                        dates={dates}
                        assignments={assignments}
                        onAssign={addAssignment}
                        onRemove={removeAssignment}
                        employeeRoster={staffList}
                        busyByDate={busyByDate}
                    />
                </div>

                {/* Sidebar: who works where & when — stays in view while scrolling the grids */}
                <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                    <ScheduleReport assignments={assignments} arenas={arenas} />
                    {orphaned.length > 0 && (
                        <OrphanedAssignmentsCard
                            orphaned={orphaned}
                            arenas={arenas}
                            lockedArenas={lockedArenas}
                            onRemove={removeAssignment}
                        />
                    )}
                    {/* Unfilled positions warning */}
                    {filledSlots < totalSlots && (
                        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
                            <CardContent className="py-4">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                            {totalSlots - filledSlots} position{totalSlots - filledSlots !== 1 ? 's' : ''} unfilled
                                        </p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                            Click "Assign" in the grid to fill open slots.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Main Page ──

const EmployeeSchedulingPage = () => {
    const navigate = useNavigate();
    const { showId } = useParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const [shows, setShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShow, setSelectedShow] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchShows = async () => {
            if (!user) { setIsLoading(false); return; }
            const { data, error } = await supabase
                .from('projects')
                .select('id, project_name, project_type, project_data, status, created_at')
                .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (!error && data) {
                setShows(data);
                if (showId) {
                    const match = data.find(s => s.id === showId);
                    if (match) setSelectedShow(match);
                }
            }
            setIsLoading(false);
        };
        fetchShows();
    }, [user, showId]);

    const isReadOnly = isWizardReadOnly(selectedShow?.project_data, 'employeeScheduling');

    // Schedule state lives here (not in the dashboard) so the staff list works even
    // when the show has no arenas yet.
    const [assignments, setAssignments] = useState([]);
    const [roster, setRoster] = useState([]); // names typed by hand
    const [lockedArenas, setLockedArenas] = useState({}); // arenaId (or '__shared__') → true
    const [liveOfficials, setLiveOfficials] = useState(null);
    const savedScheduleJsonRef = useRef('');
    const failedScheduleJsonRef = useRef(null); // the edit that last failed to save, so it is not retried in a loop
    const handleSaveRef = useRef(null);

    useEffect(() => {
        const sched = selectedShow?.project_data?.staffSchedule;
        const a = sched?.assignments || [];
        const r = sched?.roster || [];
        const l = sched?.lockedArenas || {};
        setAssignments(a);
        setRoster(r);
        setLockedArenas(l);
        setLiveOfficials(null);
        savedScheduleJsonRef.current = JSON.stringify({ a, r, l });
        failedScheduleJsonRef.current = null;
        // Only when a different show is picked: a save must not reset what is on screen.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedShow?.id]);

    const staffList = useMemo(
        () => buildStaffList(liveOfficials ?? selectedShow?.project_data?.showDetails?.officials, roster),
        [liveOfficials, selectedShow, roster]
    );
    const hasUnsavedSchedule = JSON.stringify({ a: assignments, r: roster, l: lockedArenas }) !== savedScheduleJsonRef.current;
    // A lock is saved the moment it is clicked (it must survive a refresh). Only the lock
    // is written: assignments you have not saved yet are left as they are.
    const toggleArenaLock = async (arenaId) => {
        if (!selectedShow || isReadOnly) return;
        const previous = lockedArenas;
        const next = { ...previous };
        if (next[arenaId]) delete next[arenaId]; else next[arenaId] = true;
        setLockedArenas(next);
        try {
            const { data: latestRow, error: readError } = await supabase
                .from('projects')
                .select('project_data')
                .eq('id', selectedShow.id)
                .maybeSingle();
            if (readError) throw readError;
            const latest = latestRow?.project_data || selectedShow.project_data || {};
            const updatedData = {
                ...latest,
                staffSchedule: { ...(latest.staffSchedule || {}), lockedArenas: next },
            };
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            // The lock is now saved, so it no longer counts as an unsaved change.
            try {
                const ref = JSON.parse(savedScheduleJsonRef.current || '{}');
                savedScheduleJsonRef.current = JSON.stringify({ ...ref, l: next });
            } catch { /* keep the old reference */ }
            setSelectedShow(prev => (prev ? { ...prev, project_data: updatedData } : prev));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            toast({ title: next[arenaId] ? 'Locked' : 'Unlocked', description: next[arenaId] ? 'This schedule can no longer be changed until you unlock it.' : 'This schedule can be edited again.' });
        } catch (error) {
            setLockedArenas(previous);
            toast({ title: 'Could not save the lock', description: error.message, variant: 'destructive' });
        }
    };

    const addManual = (emp) => setRoster(prev => [...prev, emp]);
    const renameManual = (id, name) => setRoster(prev => prev.map(e => e.id === id ? { ...e, name } : e));
    const removeManual = (id) => {
        setRoster(prev => prev.filter(e => e.id !== id));
        setAssignments(prev => prev.filter(a => a.employeeId !== id));
    };

    const handleSave = async ({ silent = false } = {}) => {
        if (!selectedShow || isReadOnly) return; // a locked section must never write back
        setIsSaving(true);
        try {
            // Build on the newest saved copy, not the one loaded with this page: staff
            // saved from the Officials & Staff panel (or any other module) since then
            // would otherwise be written back to their old values.
            const { data: latestRow } = await supabase
                .from('projects')
                .select('project_data')
                .eq('id', selectedShow.id)
                .maybeSingle();
            const updatedData = stampModuleStatusOnSave({
                ...(latestRow?.project_data || selectedShow.project_data),
                staffSchedule: { assignments, roster, lockedArenas },
            }, 'employeeScheduling');
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            savedScheduleJsonRef.current = JSON.stringify({ a: assignments, r: roster, l: lockedArenas });
            failedScheduleJsonRef.current = null;
            // keep the saved copy in step so reselecting the show shows the same lock
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            if (!silent) toast({ title: 'Schedule Saved', description: 'Staff assignments have been saved successfully.' });
        } catch (error) {
            failedScheduleJsonRef.current = JSON.stringify({ a: assignments, r: roster, l: lockedArenas });
            toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    handleSaveRef.current = handleSave;

    // Auto-save: one and a half seconds after the last edit, save quietly. Only real edits differ from the
    // copy taken at load/save time, so just opening the page never writes anything.
    const scheduleJson = JSON.stringify({ a: assignments, r: roster, l: lockedArenas });
    useEffect(() => {
        if (!selectedShow || isReadOnly || isSaving || isLoading) return;
        if (scheduleJson === savedScheduleJsonRef.current || scheduleJson === failedScheduleJsonRef.current) return;
        const t = setTimeout(() => { handleSaveRef.current?.({ silent: true }); }, 1500);
        return () => clearTimeout(t);
    }, [scheduleJson, selectedShow, isReadOnly, isSaving, isLoading]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Employee Scheduling - Horse Show Manager</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="mb-6">
                        <div className="mb-4">
                            <Button variant="ghost" onClick={() => navigate(`/horse-show-manager/employee-scheduling${showId ? `/${showId}` : ''}`)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-400">
                            Employee Scheduling
                        </h1>
                        <p className="text-muted-foreground">
                            Assign staff to arenas, dates, and positions.
                        </p>
                    </div>

                    {!showId && (
                        <LinkToExistingShow
                            existingProjects={shows}
                            linkedProjectId={selectedShow?.id || null}
                            onLink={(projectId) => {
                                if (projectId === 'none') {
                                    setSelectedShow(null);
                                } else {
                                    const show = shows.find(s => s.id === projectId);
                                    if (show) setSelectedShow(show);
                                }
                            }}
                            description="Link to a show to manage its staff scheduling."
                        />
                    )}

                    {/* Officials & Staff first: the same list as Show Structure & Expenses Step 3,
                        so Employee Management can be used without visiting the wizard. */}
                    {selectedShow && (
                        <div className="mt-6">
                            <ShowOfficialsStaffPanel
                                key={selectedShow.id}
                                showId={selectedShow.id}
                                defaultOpen
                                onOfficialsChange={setLiveOfficials}
                            />
                        </div>
                    )}

                    {selectedShow && (
                        <div className="mt-6">
                            <ModuleLockGuard isLocked={isReadOnly} moduleName="Employee / Arena Scheduling">
                                <div className="space-y-6">
                                    <StaffMasterList
                                        staffList={staffList}
                                        assignments={assignments}
                                        onAddManual={addManual}
                                        onRenameManual={renameManual}
                                        onRemoveManual={removeManual}
                                        onSave={() => handleSave()}
                                        isSaving={isSaving}
                                        hasUnsaved={hasUnsavedSchedule}
                                    />
                                    <SchedulingDashboard
                                        show={selectedShow}
                                        lockedArenas={lockedArenas}
                                        onToggleLock={toggleArenaLock}
                                        staffList={staffList}
                                        assignments={assignments}
                                        setAssignments={setAssignments}
                                        onSave={() => handleSave()}
                                        isSaving={isSaving}
                                    />
                                </div>
                            </ModuleLockGuard>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default EmployeeSchedulingPage;
