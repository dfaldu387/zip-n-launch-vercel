import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { ModuleLockGuard } from '@/components/shared/ModuleLockGuard';
import { isWizardReadOnly } from '@/lib/moduleStatusService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Building2, Plus, Trash2, Hash, Calendar,
    ChevronRight, FolderOpen, Users, MapPin, ChevronDown, ChevronUp,
    Wand2, Check, X, GripVertical, Lock, Unlock,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { staffRoles, roleGroups } from '@/lib/staffingData';
import { useToast } from '@/components/ui/use-toast';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { setupQtyForDate, withQtyForDate, hasDayOverrides, peakQty, requiredForDate, withRequiredForDate, hasRequiredOverrides, peakRequiredQty, newPosition } from '@/lib/staffQty';

// ── Day selector: "All days" edits the base Qty, a single day edits only that day ──

const formatDay = (d) => {
    try {
        return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
        return d;
    }
};

const DaySelector = ({ dates, value, onChange }) => {
    if (!dates || dates.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Needs for:</span>
            <Button
                type="button"
                size="sm"
                variant={value === null ? 'default' : 'outline'}
                className="h-7 px-2.5 text-xs"
                onClick={() => onChange(null)}
            >
                All days
            </Button>
            {dates.map((d) => (
                <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={value === d ? 'default' : 'outline'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => onChange(d)}
                >
                    {formatDay(d)}
                </Button>
            ))}
        </div>
    );
};

// Every day from start to end (inclusive).
const dayRange = (start, end) => {
    if (!start) return [];
    const out = [];
    const cur = new Date(`${start}T00:00:00`);
    const last = new Date(`${end || start}T00:00:00`);
    if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) return [];
    let guard = 0;
    while (cur <= last && guard++ < 60) {
        // Local date parts: toISOString() shifts the day back in time zones ahead of UTC.
        out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
        cur.setDate(cur.getDate() + 1);
    }
    return out;
};

// ── Default staff positions per arena ──

const DEFAULT_ARENA_STAFF = [
    { roleId: 'JUDGE', required: true, qty: 1 },
    { roleId: 'GATE_MANAGER', required: true, qty: 1 },
    { roleId: 'ANNOUNCER', required: true, qty: 1 },
    { roleId: 'SCRIBE_RING_STEWARD', required: true, qty: 1 },
    { roleId: 'SCORE_RUNNER', required: false, qty: 1 },
    { roleId: 'TIMER', required: false, qty: 0 },
    { roleId: 'ARENA_CREW', required: false, qty: 1 },
];

// ── Shared (show-level) staff positions ──

const SHARED_STAFF = [
    { roleId: 'SHOW_MANAGER', required: true, qty: 1 },
    { roleId: 'SHOW_SECRETARY', required: true, qty: 1 },
    { roleId: 'OFFICE_ASSISTANT', required: false, qty: 1 },
    { roleId: 'SHOW_STEWARD', required: false, qty: 1 },
    { roleId: 'PHOTOGRAPHER', required: false, qty: 1 },
    { roleId: 'AWARDS_COORDINATOR', required: false, qty: 1 },
];

// ── Show Picker ──

const ShowPicker = ({ shows, onSelect }) => {
    const navigate = useNavigate();
    if (shows.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Shows Found</h3>
                    <p className="text-sm text-muted-foreground mb-6">Create a horse show first to set up venues and arenas.</p>
                    <Button onClick={() => navigate('/horse-show-manager/create')}>Create Horse Show</Button>
                </CardContent>
            </Card>
        );
    }
    return (
        <div className="space-y-3">
            {shows.map((show, i) => {
                const pd = show.project_data || {};
                return (
                    <motion.div key={show.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <button type="button" className="w-full text-left" onClick={() => onSelect(show)}>
                            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                                <CardContent className="py-4 px-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-base truncate">{show.project_name || 'Untitled'}</h3>
                                                {pd.showNumber && <Badge variant="secondary" className="text-xs"><Hash className="h-3 w-3 mr-0.5" />#{pd.showNumber}</Badge>}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                {pd.venueName && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{pd.venueName}</span>}
                                                <span>{(pd.arenas || []).length} arenas</span>
                                                {pd.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{pd.startDate}</span>}
                                            </div>
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

// ── Staff Position Row ──

// `date` = one day picked in the day selector; null = "All days" (the base Qty).
const StaffPositionRow = ({ position, onUpdate, onRemove, date = null, dates = [] }) => {
    const role = staffRoles[position.roleId];
    const Icon = role?.icon || Users;
    const qtyValue = date ? setupQtyForDate(position, date) : position.qty;
    const isOverridden = date && (position.qtyByDate?.[date] !== undefined || position.requiredByDate?.[date] !== undefined);
    const varies = !date && (hasDayOverrides(position, dates) || hasRequiredOverrides(position, dates));
    const requiredValue = date ? requiredForDate(position, date) : !!position.required;
    const handleRequired = (checked) => {
        if (date) onUpdate('requiredByDate', withRequiredForDate(position, date, checked).requiredByDate);
        else onUpdate('required', checked);
    };
    const handleQty = (e) => {
        const n = parseInt(e.target.value) || 0;
        if (date) onUpdate('qtyByDate', withQtyForDate(position, date, n).qtyByDate);
        else onUpdate('qty', n);
    };
    return (
        <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-background border">
            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{role?.name || position.roleId}</span>
            {varies && <Badge variant="secondary" className="text-[10px]">Varies by day</Badge>}
            {isOverridden && <Badge variant="outline" className="text-[10px] border-primary text-primary">This day only</Badge>}
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Qty:</Label>
                <Input
                    type="number"
                    min={0}
                    value={qtyValue}
                    onChange={handleQty}
                    className="h-7 w-14 text-xs text-center"
                />
            </div>
            <div className="flex items-center gap-1.5">
                <Checkbox
                    checked={requiredValue}
                    onCheckedChange={handleRequired}
                    id={`req-${position.id}`}
                />
                <Label htmlFor={`req-${position.id}`} className="text-xs text-muted-foreground cursor-pointer">Required</Label>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onRemove}>
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
};

// ── Arena Card ──

const SetupLockToggle = ({ locked, onToggle }) => (
    <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7', locked ? 'text-amber-500' : 'text-muted-foreground hover:text-primary')}
        onClick={onToggle}
        title={locked ? 'Locked — click to unlock' : 'Lock so this cannot be changed by accident'}
    >
        {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
    </Button>
);

const ArenaCard = ({ arena, onUpdate, onRemove, onUpdateStaff, showDates = [], locked = false, onToggleLock }) => {
    // Cards start closed so a long list of arenas stays easy to scan.
    const [expanded, setExpanded] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const staffPositions = arena.staffPositions || [];
    // Same days the scheduling grid uses: the arena's own dates, else the show's.
    const arenaDays = (arena.dates || []).length > 0 ? [...arena.dates].sort() : showDates;
    const day = selectedDay && arenaDays.includes(selectedDay) ? selectedDay : null;
    const totalStaff = staffPositions.reduce((sum, p) => sum + peakQty(p, arenaDays), 0);
    const requiredStaff = staffPositions.reduce((sum, p) => sum + peakRequiredQty(p, arenaDays), 0);

    const addStaffPosition = (roleId) => {
        if (staffPositions.find(p => p.roleId === roleId)) return;
        // With a day picked above, the new position is needed on that day only.
        onUpdateStaff([...staffPositions, newPosition(uuidv4(), roleId, day)]);
    };

    const updatePosition = (posId, field, value) => {
        onUpdateStaff(staffPositions.map(p => p.id === posId ? { ...p, [field]: value } : p));
    };

    const removePosition = (posId) => {
        onUpdateStaff(staffPositions.filter(p => p.id !== posId));
    };

    const availableRoles = Object.entries(staffRoles).filter(
        ([id]) => id !== 'CUSTOM' && !staffPositions.find(p => p.roleId === id)
    );

    return (
        <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <Input
                            value={arena.name}
                            disabled={locked}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            className="h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 max-w-xs"
                            placeholder="Arena name..."
                        />
                        <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />{totalStaff} staff ({requiredStaff} required)
                        </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                        <SetupLockToggle locked={locked} onToggle={onToggleLock} />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" disabled={locked} className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onRemove}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                {arena.dates && arena.dates.length > 0 && (
                    <div className="flex gap-1 mt-1">
                        {arena.dates.map(d => (
                            <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                        ))}
                    </div>
                )}
            </CardHeader>
            {expanded && (
                <CardContent className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Staff Positions</p>
                    </div>
                    <DaySelector dates={arenaDays} value={day} onChange={setSelectedDay} />
                    {locked && (
                        <p className="text-xs text-amber-600 flex items-center gap-1"><Lock className="h-3 w-3" /> Locked. Unlock this arena to change its staff.</p>
                    )}
                    {/* A disabled fieldset turns off every input, checkbox and button inside it. */}
                    <fieldset disabled={locked} className={cn('space-y-2 min-w-0 border-0 p-0 m-0', locked && 'opacity-70')}>
                    <div className="space-y-1.5">
                        {staffPositions.map(pos => (
                            <StaffPositionRow
                                key={pos.id}
                                position={pos}
                                date={day}
                                dates={arenaDays}
                                onUpdate={(field, value) => updatePosition(pos.id, field, value)}
                                onRemove={() => removePosition(pos.id)}
                            />
                        ))}
                    </div>
                    {availableRoles.length > 0 && (
                        <Select value="" onValueChange={addStaffPosition}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={day ? `+ Add staff position for ${formatDay(day)} only...` : '+ Add staff position...'} />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(roleGroups).map(([groupId, group]) => {
                                    const rolesInGroup = availableRoles.filter(([, r]) => r.group === groupId);
                                    if (rolesInGroup.length === 0) return null;
                                    return (
                                        <React.Fragment key={groupId}>
                                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">{group.name}</div>
                                            {rolesInGroup.map(([id, role]) => (
                                                <SelectItem key={id} value={id} className="text-xs">{role.name}</SelectItem>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    )}
                    </fieldset>
                </CardContent>
            )}
        </Card>
    );
};

// ── Venue & Arena Setup Dashboard ──

const VenueArenaSetup = ({ show, onSave, isSaving, onPersistLocks }) => {
    const pd = show.project_data || {};
    const { toast } = useToast();

    const [venueName, setVenueName] = useState(pd.venueName || '');
    const [venueAddress, setVenueAddress] = useState(pd.venueAddress || '');
    const [arenas, setArenas] = useState(() => {
        const existing = pd.arenas || [];
        return existing.map(a => ({
            ...a,
            staffPositions: a.staffPositions || DEFAULT_ARENA_STAFF.map(s => ({ ...s, id: uuidv4() })),
        }));
    });
    const [sharedStaff, setSharedStaff] = useState(() => {
        return pd.sharedStaff || SHARED_STAFF.map(s => ({ ...s, id: uuidv4() }));
    });

    const [sharedLocked, setSharedLocked] = useState(!!pd.sharedStaffLocked);
    const [confirmAutoGenerate, setConfirmAutoGenerate] = useState(false);

    // A lock is saved the moment it is clicked, so it survives a refresh.
    const toggleArenaLock = async (arenaId) => {
        const previousArenas = arenas;
        const nextArenas = arenas.map(a => a.id === arenaId ? { ...a, locked: !a.locked } : a);
        setArenas(nextArenas);
        const ok = await onPersistLocks?.({
            arenaLocks: Object.fromEntries(nextArenas.map(a => [a.id, !!a.locked])),
            sharedLocked,
            changed: nextArenas.find(a => a.id === arenaId)?.locked ? 'Locked' : 'Unlocked',
        });
        if (ok === false) setArenas(previousArenas);
    };

    const toggleSharedLock = async () => {
        const next = !sharedLocked;
        setSharedLocked(next);
        const ok = await onPersistLocks?.({
            arenaLocks: Object.fromEntries(arenas.map(a => [a.id, !!a.locked])),
            sharedLocked: next,
            changed: next ? 'Locked' : 'Unlocked',
        });
        if (ok === false) setSharedLocked(!next);
    };

    const addArena = () => {
        const newArena = {
            id: uuidv4(),
            name: `Arena ${String.fromCharCode(65 + arenas.length)}`,
            dates: [],
            staffPositions: DEFAULT_ARENA_STAFF.map(s => ({ ...s, id: uuidv4() })),
        };
        setArenas(prev => [...prev, newArena]);
    };

    const updateArena = (arenaId, field, value) => {
        setArenas(prev => prev.map(a => a.id === arenaId ? { ...a, [field]: value } : a));
    };

    const removeArena = (arenaId) => {
        setArenas(prev => prev.filter(a => a.id !== arenaId));
    };

    // Saved schedule assignments that sit in an arena (or shared staff) this reset would replace.
    const assignmentsAtRisk = (() => {
        const resetIds = new Set(arenas.filter(a => !a.locked).map(a => a.id));
        if (!sharedLocked) resetIds.add('__shared__');
        return (pd.staffSchedule?.assignments || []).filter(a => resetIds.has(a.arenaId)).length;
    })();

    const autoGenerateStaff = () => {
        // Locked arenas and locked shared staff are left exactly as they are.
        setArenas(prev => prev.map(a => (a.locked ? a : {
            ...a,
            staffPositions: DEFAULT_ARENA_STAFF.map(s => ({ ...s, id: uuidv4() })),
        })));
        if (!sharedLocked) setSharedStaff(SHARED_STAFF.map(s => ({ ...s, id: uuidv4() })));
        toast({ title: 'Staff auto-generated', description: `Default positions applied to ${arenas.length} arena(s).` });
    };

    // The days the scheduling grid uses: any arena dates, else the show's start–end range,
    // else the show bill's days.
    const showDates = useMemo(() => {
        const fromArenas = new Set();
        for (const a of arenas) for (const d of (a.dates || [])) fromArenas.add(d);
        if (fromArenas.size > 0) return [...fromArenas].sort();
        const range = dayRange(pd.startDate, pd.endDate);
        if (range.length > 0) return range;
        return (pd.showBill?.days || []).map(d => d.date).filter(Boolean).sort();
    }, [arenas, pd.startDate, pd.endDate, pd.showBill]);
    const arenaDaysOf = (a) => ((a.dates || []).length > 0 ? [...a.dates].sort() : showDates);
    const [sharedDay, setSharedDay] = useState(null);
    const sharedDaySafe = sharedDay && showDates.includes(sharedDay) ? sharedDay : null;

    // Total staff summary — the most people needed on any single day
    const totalArenaStaff = arenas.reduce((sum, a) =>
        sum + (a.staffPositions || []).reduce((s, p) => s + peakQty(p, arenaDaysOf(a)), 0), 0
    );
    const totalSharedStaff = sharedStaff.reduce((sum, p) => sum + peakQty(p, showDates), 0);
    const totalStaff = totalArenaStaff + totalSharedStaff;

    // Staff summary table
    const staffSummary = useMemo(() => {
        const map = {};
        const daysOf = (a) => ((a.dates || []).length > 0 ? [...a.dates].sort() : showDates);
        for (const arena of arenas) {
            for (const pos of (arena.staffPositions || [])) {
                const n = peakQty(pos, daysOf(arena));
                if (!map[pos.roleId]) map[pos.roleId] = { role: staffRoles[pos.roleId]?.name || pos.roleId, arenas: {}, shared: 0, total: 0 };
                map[pos.roleId].arenas[arena.name] = (map[pos.roleId].arenas[arena.name] || 0) + n;
                map[pos.roleId].total += n;
            }
        }
        for (const pos of sharedStaff) {
            const n = peakQty(pos, showDates);
            if (!map[pos.roleId]) map[pos.roleId] = { role: staffRoles[pos.roleId]?.name || pos.roleId, arenas: {}, shared: 0, total: 0 };
            map[pos.roleId].shared += n;
            map[pos.roleId].total += n;
        }
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [arenas, sharedStaff, showDates]);

    const handleSave = () => {
        onSave({ venueName, venueAddress, arenas, sharedStaff, sharedStaffLocked: sharedLocked });
    };

    return (
        <div className="space-y-6">
            {/* Venue Info */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Venue Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Venue Name</Label>
                            <Input value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="e.g., State Fairgrounds" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Address</Label>
                            <Input value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder="e.g., 123 Main St, City, State" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Arenas</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{arenas.length}</p>
                </div>
                <div className="rounded-xl border p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Arena Staff</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totalArenaStaff}</p>
                </div>
                <div className="rounded-xl border p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Shared Staff</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalSharedStaff}</p>
                </div>
                <div className="rounded-xl border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Staff</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalStaff}</p>
                </div>
            </div>


            {/* Auto-Generate Staff replaces every unlocked arena's positions, so ask first. */}
            <AlertDialog open={confirmAutoGenerate} onOpenChange={setConfirmAutoGenerate}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset all staff positions?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This replaces the staff positions in every unlocked arena (and unlocked shared staff) with the default list.
                            Your own positions, one-day settings and Required settings there will be removed.
                            {assignmentsAtRisk > 0
                                ? ` ${assignmentsAtRisk} ${assignmentsAtRisk === 1 ? 'person' : 'people'} already assigned in the schedule will lose their slot.`
                                : ''}
                            {' '}Locked arenas are not changed. Nothing is saved until you click Save Setup.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={autoGenerateStaff}>Yes, reset positions</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <Button onClick={addArena} variant="outline">
                    <Plus className="h-4 w-4 mr-2" /> Add Arena
                </Button>
                <Button onClick={() => setConfirmAutoGenerate(true)} variant="outline">
                    <Wand2 className="h-4 w-4 mr-2" /> Auto-Generate Staff
                </Button>
                <div className="flex-1" />
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    {isSaving ? 'Saving...' : 'Save Setup'}
                </Button>
            </div>

            {/* Arena Cards */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5" /> Arenas ({arenas.length})
                </h3>
                {arenas.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No arenas yet. Click "Add Arena" to get started.</p>
                        </CardContent>
                    </Card>
                ) : (
                    arenas.map(arena => (
                        <ArenaCard
                            key={arena.id}
                            arena={arena}
                            showDates={showDates}
                            locked={!!arena.locked}
                            onToggleLock={() => toggleArenaLock(arena.id)}
                            onUpdate={(field, value) => updateArena(arena.id, field, value)}
                            onRemove={() => removeArena(arena.id)}
                            onUpdateStaff={(positions) => updateArena(arena.id, 'staffPositions', positions)}
                        />
                    ))
                )}
            </div>

            {/* Shared Staff */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /> Shared / Show-Level Staff</CardTitle>
                            <CardDescription className="text-xs">Staff not assigned to a specific arena (management, office, photography, etc.)</CardDescription>
                        </div>
                        <SetupLockToggle locked={sharedLocked} onToggle={toggleSharedLock} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                    <DaySelector dates={showDates} value={sharedDaySafe} onChange={setSharedDay} />
                    {sharedLocked && (
                        <p className="text-xs text-amber-600 flex items-center gap-1"><Lock className="h-3 w-3" /> Locked. Unlock to change shared staff.</p>
                    )}
                    <fieldset disabled={sharedLocked} className={cn('space-y-1.5 min-w-0 border-0 p-0 m-0', sharedLocked && 'opacity-70')}>
                    {sharedStaff.map(pos => (
                        <StaffPositionRow
                            key={pos.id}
                            position={pos}
                            date={sharedDaySafe}
                            dates={showDates}
                            onUpdate={(field, value) => setSharedStaff(prev => prev.map(p => p.id === pos.id ? { ...p, [field]: value } : p))}
                            onRemove={() => setSharedStaff(prev => prev.filter(p => p.id !== pos.id))}
                        />
                    ))}
                    <Select value="" onValueChange={(roleId) => {
                        if (sharedStaff.find(p => p.roleId === roleId)) return;
                        setSharedStaff(prev => [...prev, newPosition(uuidv4(), roleId, sharedDaySafe)]);
                    }}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={sharedDaySafe ? `+ Add shared staff position for ${formatDay(sharedDaySafe)} only...` : '+ Add shared staff position...'} />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(staffRoles)
                                .filter(([id]) => id !== 'CUSTOM' && !sharedStaff.find(p => p.roleId === id))
                                .map(([id, role]) => (
                                    <SelectItem key={id} value={id} className="text-xs">{role.name}</SelectItem>
                                ))
                            }
                        </SelectContent>
                    </Select>
                    </fieldset>
                </CardContent>
            </Card>

            {/* Staff Summary Table */}
            {staffSummary.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Staff Requirements Summary</CardTitle>
                        <CardDescription className="text-xs">Overview of all staff needed across arenas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-left px-3 py-2 font-medium">Position</th>
                                        {arenas.map(a => (
                                            <th key={a.id} className="text-center px-3 py-2 font-medium">{a.name}</th>
                                        ))}
                                        <th className="text-center px-3 py-2 font-medium">Shared</th>
                                        <th className="text-right px-3 py-2 font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffSummary.map(row => (
                                        <tr key={row.role} className="border-b last:border-0">
                                            <td className="px-3 py-2 font-medium">{row.role}</td>
                                            {arenas.map(a => (
                                                <td key={a.id} className="px-3 py-2 text-center text-muted-foreground">
                                                    {row.arenas[a.name] || '-'}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-center text-muted-foreground">{row.shared || '-'}</td>
                                            <td className="px-3 py-2 text-right font-semibold">{row.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 font-semibold">
                                        <td className="px-3 py-2">Total</td>
                                        {arenas.map(a => {
                                            const arenaTotal = (a.staffPositions || []).reduce((s, p) => s + peakQty(p, arenaDaysOf(a)), 0);
                                            return <td key={a.id} className="px-3 py-2 text-center">{arenaTotal}</td>;
                                        })}
                                        <td className="px-3 py-2 text-center">{totalSharedStaff}</td>
                                        <td className="px-3 py-2 text-right">{totalStaff}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// ── Main Page ──

const VenueArenaSetupPage = () => {
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

    // Saves only the lock flags, the moment a lock is clicked. Other unsaved edits on
    // the page are not written. Returns false when it failed so the page can undo.
    const persistLocks = async ({ arenaLocks, sharedLocked, changed }) => {
        if (!selectedShow || isReadOnly) return false;
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
                arenas: (latest.arenas || []).map(a => (
                    a.id in arenaLocks ? { ...a, locked: !!arenaLocks[a.id] } : a
                )),
                sharedStaffLocked: !!sharedLocked,
            };
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            toast({ title: changed || 'Saved', description: changed === 'Locked' ? 'This cannot be changed until you unlock it.' : 'This can be edited again.' });
            return true;
        } catch (error) {
            toast({ title: 'Could not save the lock', description: error.message, variant: 'destructive' });
            return false;
        }
    };

    const handleSave = async ({ venueName, venueAddress, arenas, sharedStaff, sharedStaffLocked }) => {
        if (!selectedShow || isReadOnly) return; // a locked section must never write back
        setIsSaving(true);
        try {
            const updatedData = {
                ...selectedShow.project_data,
                venueName,
                venueAddress,
                arenas,
                sharedStaff,
                sharedStaffLocked,
            };
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            toast({ title: 'Venue & Arena Setup Saved', description: 'All changes have been saved successfully.' });
        } catch (error) {
            toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Venue & Arena Setup</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="mb-6">
                        <div className="mb-4">
                            <Button variant="ghost" onClick={() => navigate(`/horse-show-manager/employee-scheduling${showId ? `/${showId}` : ''}`)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-400">
                            Venue & Arena Setup
                        </h1>
                        <p className="text-muted-foreground">
                            Configure venues, arenas, and auto-generate staff positions.
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
                            description="Link to a show to configure its venue and arena setup."
                        />
                    )}

                    {selectedShow && (
                        <div className="mt-6">
                            <ModuleLockGuard isLocked={isReadOnly} moduleName="Employee / Arena Scheduling">
                                <VenueArenaSetup show={selectedShow} onSave={handleSave} isSaving={isSaving} onPersistLocks={persistLocks} />
                            </ModuleLockGuard>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default VenueArenaSetupPage;
