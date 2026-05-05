import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    ArrowLeft, Loader2, Users, Calendar, ChevronRight, FolderOpen,
    Hash, MapPin, Building2, Check, UserPlus, AlertCircle, Search,
    X, Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { stampModuleStatusOnSave } from '@/lib/moduleStatusService';
import { v4 as uuidv4 } from 'uuid';
import { staffRoles } from '@/lib/staffingData';
import { useToast } from '@/components/ui/use-toast';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';

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
                                                {pd.showNumber && <Badge variant="secondary" className="text-xs"><Hash className="h-3 w-3 mr-0.5" />#{pd.showNumber}</Badge>}
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

const AssignmentCell = ({ assignment, position, arenaId, dateStr, onAssign, onRemove, employeeRoster }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [search, setSearch] = useState('');

    const filteredRoster = useMemo(() => {
        if (!search.trim()) return employeeRoster;
        const q = search.toLowerCase();
        return employeeRoster.filter(e => e.name.toLowerCase().includes(q));
    }, [employeeRoster, search]);

    if (assignment) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-xs group">
                <Users className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="font-medium truncate flex-1">{assignment.employeeName}</span>
                <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(assignment.id)}
                >
                    <X className="h-3 w-3 text-destructive" />
                </button>
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
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                    {filteredRoster.map(emp => (
                        <button
                            key={emp.id}
                            type="button"
                            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent truncate"
                            onClick={() => {
                                onAssign({
                                    id: uuidv4(),
                                    arenaId,
                                    date: dateStr,
                                    roleId: position.roleId,
                                    positionId: position.id,
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                });
                                setIsEditing(false);
                                setSearch('');
                            }}
                        >
                            {emp.name}
                        </button>
                    ))}
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

// ── Scheduling Grid for one Arena ──

const ArenaScheduleGrid = ({ arena, dates, assignments, onAssign, onRemove, employeeRoster }) => {
    const positions = arena.staffPositions || [];
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

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {arena.name}
                </CardTitle>
                <CardDescription className="text-xs">
                    {positions.length} positions x {dates.length} day{dates.length !== 1 ? 's' : ''}
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                                const qty = pos.qty || 1;
                                return Array.from({ length: qty }, (_, slotIdx) => (
                                    <tr key={`${pos.id}-${slotIdx}`} className="border-b last:border-0">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                                <span className="font-medium text-xs">
                                                    {role?.name || pos.roleId}
                                                    {qty > 1 && <span className="text-muted-foreground ml-1">#{slotIdx + 1}</span>}
                                                </span>
                                                {pos.required && <Badge variant="outline" className="text-[9px] px-1 py-0">Req</Badge>}
                                            </div>
                                        </td>
                                        {dates.map(dateStr => {
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
                                                        dateStr={dateStr}
                                                        onAssign={onAssign}
                                                        onRemove={onRemove}
                                                        employeeRoster={employeeRoster}
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
            </CardContent>
        </Card>
    );
};

// ── Shared Staff Schedule ──

const SharedStaffGrid = ({ sharedStaff, dates, assignments, onAssign, onRemove, employeeRoster }) => {
    if (!sharedStaff || sharedStaff.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    Shared / Show-Level Staff
                </CardTitle>
                <CardDescription className="text-xs">Staff not tied to a specific arena</CardDescription>
            </CardHeader>
            <CardContent>
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
                                const qty = pos.qty || 1;
                                return Array.from({ length: qty }, (_, slotIdx) => (
                                    <tr key={`${pos.id}-${slotIdx}`} className="border-b last:border-0">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                                                <span className="font-medium text-xs">
                                                    {role?.name || pos.roleId}
                                                    {qty > 1 && <span className="text-muted-foreground ml-1">#{slotIdx + 1}</span>}
                                                </span>
                                            </div>
                                        </td>
                                        {dates.map(dateStr => {
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
                                                        dateStr={dateStr}
                                                        onAssign={onAssign}
                                                        onRemove={onRemove}
                                                        employeeRoster={employeeRoster}
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
            </CardContent>
        </Card>
    );
};

// ── Helpers ──

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
            dates.push(current.toISOString().split('T')[0]);
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

const RosterPanel = ({ roster, onAdd, onRemove, onUpdate }) => {
    const [newName, setNewName] = useState('');

    const handleAdd = () => {
        const name = newName.trim();
        if (!name) return;
        onAdd({ id: uuidv4(), name, phone: '', email: '' });
        setNewName('');
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Employee Roster ({roster.length})
                </CardTitle>
                <CardDescription className="text-xs">Add employees that can be assigned to positions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex gap-2">
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Employee name..."
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <Button size="sm" className="h-8" onClick={handleAdd} disabled={!newName.trim()}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                </div>
                {roster.length > 0 ? (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                        {roster.map(emp => (
                            <div key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-sm group">
                                <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <Input
                                    value={emp.name}
                                    onChange={(e) => onUpdate(emp.id, 'name', e.target.value)}
                                    className="h-6 text-xs border-none shadow-none bg-transparent px-0 focus-visible:ring-0 flex-1"
                                />
                                <button
                                    type="button"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => onRemove(emp.id)}
                                >
                                    <X className="h-3 w-3 text-destructive" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No employees yet. Add names above to start scheduling.</p>
                )}
            </CardContent>
        </Card>
    );
};

// ── Main Scheduling Dashboard ──

const SchedulingDashboard = ({ show, onSave, isSaving }) => {
    const pd = show.project_data || {};
    const arenas = pd.arenas || [];
    const sharedStaff = pd.sharedStaff || [];
    const dates = useMemo(() => getShowDates(pd), [pd]);
    const { toast } = useToast();

    const [assignments, setAssignments] = useState(() => pd.staffSchedule?.assignments || []);
    const [roster, setRoster] = useState(() => pd.staffSchedule?.roster || []);

    const addAssignment = useCallback((assignment) => {
        setAssignments(prev => [...prev, assignment]);
    }, []);

    const removeAssignment = useCallback((assignmentId) => {
        setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    }, []);

    const addEmployee = useCallback((emp) => {
        setRoster(prev => [...prev, emp]);
    }, []);

    const removeEmployee = useCallback((empId) => {
        setRoster(prev => prev.filter(e => e.id !== empId));
        setAssignments(prev => prev.filter(a => a.employeeId !== empId));
    }, []);

    const updateEmployee = useCallback((empId, field, value) => {
        setRoster(prev => prev.map(e => e.id === empId ? { ...e, [field]: value } : e));
        if (field === 'name') {
            setAssignments(prev => prev.map(a => a.employeeId === empId ? { ...a, employeeName: value } : a));
        }
    }, []);

    const handleSave = () => {
        onSave({ assignments, roster });
    };

    // Stats
    const totalSlots = useMemo(() => {
        let count = 0;
        for (const arena of arenas) {
            for (const pos of (arena.staffPositions || [])) {
                count += (pos.qty || 1) * dates.length;
            }
        }
        for (const pos of sharedStaff) {
            count += (pos.qty || 1) * dates.length;
        }
        return count;
    }, [arenas, sharedStaff, dates]);

    const filledSlots = assignments.length;
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    if (arenas.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Arenas Configured</h3>
                    <p className="text-sm text-muted-foreground mb-6">Set up venues and arenas with staff positions first.</p>
                    <Button onClick={() => window.location.href = '/horse-show-manager/venue-arena-setup'}>
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
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{roster.length}</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                {/* Scheduling grids */}
                <div className="space-y-4">
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
                            dates={dates}
                            assignments={assignments}
                            onAssign={addAssignment}
                            onRemove={removeAssignment}
                            employeeRoster={roster}
                        />
                    ))}

                    <SharedStaffGrid
                        sharedStaff={sharedStaff}
                        dates={dates}
                        assignments={assignments}
                        onAssign={addAssignment}
                        onRemove={removeAssignment}
                        employeeRoster={roster}
                    />
                </div>

                {/* Sidebar: employee roster */}
                <div className="space-y-4">
                    <RosterPanel
                        roster={roster}
                        onAdd={addEmployee}
                        onRemove={removeEmployee}
                        onUpdate={updateEmployee}
                    />

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

    const handleSave = async ({ assignments, roster }) => {
        if (!selectedShow) return;
        setIsSaving(true);
        try {
            const updatedData = stampModuleStatusOnSave({
                ...selectedShow.project_data,
                staffSchedule: { assignments, roster },
            }, 'employeeScheduling');
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            toast({ title: 'Schedule Saved', description: 'Staff assignments have been saved successfully.' });
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
            <Helmet><title>Employee Scheduling - Horse Show Manager</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex items-center gap-3 mb-8">
                        <Button variant="outline" size="icon" onClick={() => navigate('/horse-show-manager/employee-scheduling')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <Calendar className="h-6 w-6 text-primary" />
                                Employee Scheduling
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Assign staff to arenas, dates, and positions.
                            </p>
                        </div>
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

                    {selectedShow && (
                        <div className="mt-6">
                            <SchedulingDashboard show={selectedShow} onSave={handleSave} isSaving={isSaving} />
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default EmployeeSchedulingPage;
