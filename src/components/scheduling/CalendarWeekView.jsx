import React, { useMemo, useState } from 'react';
import { Building2, Users, ChevronDown, ChevronUp, X, Search, UserX, FileDown } from 'lucide-react';
import { generateSchedulePdf } from '@/lib/schedulePdfGenerator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { staffRoles } from '@/lib/staffingData';
import { scheduleQtyForDate, totalSlots as slotsForDates, filledSlots as filledForDates } from '@/lib/staffQty';

// One table for every arena, days across the top, positions down the side.
// The cell, "not needed" cell and lock button come from the page so both views behave the same.

const dayLabel = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`);
    return {
        dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
        md: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
};

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Every day from first to last, so a quiet day between two busy ones still shows as a "—" column.
const fillRange = (first, last) => {
    const out = [];
    const cur = new Date(`${first}T00:00:00`);
    const end = new Date(`${last}T00:00:00`);
    while (cur <= end) {
        out.push(isoDay(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
};

export const CalendarWeekView = ({
    showName, arenas, sharedStaff, showDates, rangeStart, rangeEnd, assignments, onAssign, onRemove, onUpdate,
    employeeRoster, busyByDate, lockedArenas = {}, onToggleLock,
    AssignmentCell, NotNeededCell, LockToggle,
}) => {
    const [collapsed, setCollapsed] = useState({});
    const [arenaFilter, setArenaFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [unassignedOnly, setUnassignedOnly] = useState(false);

    const groups = useMemo(() => {
        const list = arenas
            .filter(a => (a.staffPositions || []).length > 0)
            .map(a => ({
                id: a.id,
                name: a.name,
                positions: a.staffPositions,
                dates: (a.dates || []).length > 0 ? [...a.dates].sort() : showDates,
                icon: Building2,
            }));
        if (sharedStaff.length > 0) {
            list.push({ id: '__shared__', name: 'Shared / Show-Level Staff', positions: sharedStaff, dates: showDates, icon: Users });
        }
        return list;
    }, [arenas, sharedStaff, showDates]);

    // One column per day across the show's whole date range, so each arena lines up under the same date.
    const columns = useMemo(() => {
        const days = groups.flatMap(g => g.dates);
        if (rangeStart) days.push(rangeStart);
        if (rangeEnd) days.push(rangeEnd);
        const sorted = [...new Set(days)].sort();
        return sorted.length ? fillRange(sorted[0], sorted[sorted.length - 1]) : [];
    }, [groups, rangeStart, rangeEnd]);

    const roleOptions = useMemo(() => {
        const ids = new Set(groups.flatMap(g => g.positions.map(p => p.roleId)));
        return [...ids].map(id => ({ id, name: staffRoles[id]?.name || id })).sort((a, b) => a.name.localeCompare(b.name));
    }, [groups]);

    const slotAssignment = (g, pos, dateStr, slotIdx) => assignments.filter(
        a => a.arenaId === g.id && a.date === dateStr && a.positionId === pos.id
    )[slotIdx] || null;

    // Keep a row when it passes the role, search and "unassigned only" filters.
    const q = search.trim().toLowerCase();
    const rowVisible = (g, pos, slotIdx) => {
        if (roleFilter !== 'all' && pos.roleId !== roleFilter) return false;
        const needed = g.dates.filter(d => slotIdx < scheduleQtyForDate(pos, g.dates, d));
        if (needed.length === 0) return false;
        const cells = needed.map(d => slotAssignment(g, pos, d, slotIdx));
        if (unassignedOnly && cells.every(Boolean)) return false;
        if (q && !cells.some(c => c && (c.employeeName || '').toLowerCase().includes(q))) return false;
        return true;
    };

    const visibleGroups = groups
        .filter(g => arenaFilter === 'all' || g.id === arenaFilter)
        .map(g => ({
            ...g,
            rows: g.positions.flatMap(pos => {
                const qty = Math.max(0, ...g.dates.map(d => scheduleQtyForDate(pos, g.dates, d)));
                return Array.from({ length: qty }, (_, slotIdx) => ({ pos, slotIdx, qty })).filter(r => rowVisible(g, r.pos, r.slotIdx));
            }),
        }))
        .filter(g => g.rows.length > 0);
    const filtering = arenaFilter !== 'all' || roleFilter !== 'all' || q || unassignedOnly;

    // Same rows the screen shows (filters included), laid out for paper.
    const exportPdf = () => {
        generateSchedulePdf({
            showName,
            columns,
            groups: visibleGroups.map(g => ({
                name: g.name,
                rows: g.rows.map(({ pos, slotIdx, qty }) => ({
                    label: `${staffRoles[pos.roleId]?.name || pos.roleId}${qty > 1 ? ` #${slotIdx + 1}` : ''}`,
                    cells: columns.map(d => {
                        if (!g.dates.includes(d)) return '-';
                        if (slotIdx >= scheduleQtyForDate(pos, g.dates, d)) return 'x';
                        const a = slotAssignment(g, pos, d, slotIdx);
                        return a ? { name: a.employeeName, report: a.reportTime, start: a.startTime } : null;
                    }),
                })),
            })),
        });
    };

    const dash = <span className="text-muted-foreground/50">—</span>;

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <Select value={arenaFilter} onValueChange={setArenaFilter}>
                    <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Arenas</SelectItem>
                        {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {roleOptions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search personnel..." className="h-9 pl-8" />
                </div>
                <Button
                    type="button"
                    variant={unassignedOnly ? 'default' : 'outline'}
                    size="sm"
                    className={unassignedOnly ? 'bg-violet-600 hover:bg-violet-700' : ''}
                    onClick={() => setUnassignedOnly(v => !v)}
                >
                    <UserX className="h-4 w-4 mr-1.5" />Show Unassigned
                </Button>
                <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={exportPdf} disabled={visibleGroups.length === 0}>
                    <FileDown className="h-4 w-4 mr-1.5" />Export PDF
                </Button>
                {filtering && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setArenaFilter('all'); setRoleFilter('all'); setSearch(''); setUnassignedOnly(false); }}>
                        Clear
                    </Button>
                )}
            </div>
            {visibleGroups.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Nothing matches these filters.</p>
            )}
            <div className="overflow-x-auto rounded-xl border border-violet-200 dark:border-violet-900">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-violet-200 dark:border-violet-900 bg-background">
                            <th className="text-left px-3 py-3 font-semibold min-w-[190px] sticky left-0 z-10 bg-background border-r border-violet-100 dark:border-violet-900">
                                Position / Personnel
                            </th>
                            {columns.map(d => {
                                const { dow, md } = dayLabel(d);
                                return (
                                    <th key={d} className="text-center px-2 py-2 font-medium min-w-[150px] border-l border-violet-100 dark:border-violet-900">
                                        <div className="text-sm font-semibold">{dow}</div>
                                        <div className="text-xs text-muted-foreground">{md}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    {visibleGroups.map(g => {
                        const GroupIcon = g.icon;
                        const locked = !!lockedArenas[g.id];
                        const isCollapsed = !!collapsed[g.id];
                        const total = slotsForDates(g.positions, g.dates);
                        const filled = filledForDates(g.positions, g.id, g.dates, assignments);
                        return (
                            <tbody key={g.id}>
                                <tr className="bg-violet-200/60 dark:bg-violet-950/50 border-y border-violet-200 dark:border-violet-900">
                                    <td colSpan={columns.length + 1} className="px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-semibold text-base flex items-center gap-2">
                                                <GroupIcon className="h-5 w-5 text-violet-600" />{g.name}
                                            </span>
                                            <span className="flex items-center gap-3 text-xs text-violet-700 dark:text-violet-300">
                                                {g.positions.length} positions · {filled} of {total} filled
                                                <LockToggle locked={locked} onToggle={() => onToggleLock?.(g.id)} />
                                                <button
                                                    type="button"
                                                    aria-label={isCollapsed ? `Show ${g.name}` : `Hide ${g.name}`}
                                                    onClick={() => setCollapsed(c => ({ ...c, [g.id]: !c[g.id] }))}
                                                >
                                                    {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                                </button>
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                {!isCollapsed && g.rows.map(({ pos, slotIdx, qty }) => {
                                    const role = staffRoles[pos.roleId];
                                    const Icon = role?.icon || Users;
                                    return [
                                        <tr key={`${pos.id}-${slotIdx}`} className="border-b border-violet-100 dark:border-violet-900/60">
                                            <td className="px-3 py-2 sticky left-0 z-10 bg-background border-r border-violet-100 dark:border-violet-900">
                                                <div className="flex items-center gap-2.5">
                                                    <Icon className="h-4 w-4 text-violet-600 flex-shrink-0" />
                                                    <span className="font-medium text-sm">
                                                        {role?.name || pos.roleId}
                                                        {qty > 1 && <span className="text-muted-foreground ml-1">#{slotIdx + 1}</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            {columns.map(dateStr => {
                                                if (!g.dates.includes(dateStr)) {
                                                    return (
                                                        <td key={dateStr} className="px-2 py-1.5 text-center border-l border-violet-100 dark:border-violet-900/60">
                                                            {dash}
                                                        </td>
                                                    );
                                                }
                                                if (slotIdx >= scheduleQtyForDate(pos, g.dates, dateStr)) {
                                                    return <NotNeededCell key={dateStr} />;
                                                }
                                                const assignment = slotAssignment(g, pos, dateStr, slotIdx);
                                                return (
                                                    <td key={dateStr} className="px-1.5 py-1.5 border-l border-violet-100 dark:border-violet-900/60">
                                                        <AssignmentCell
                                                            assignment={assignment}
                                                            position={pos}
                                                            arenaId={g.id}
                                                            locked={locked}
                                                            dateStr={dateStr}
                                                            slotIdx={slotIdx}
                                                            allDates={g.dates}
                                                            onAssign={onAssign}
                                                            onRemove={onRemove}
                                                            onUpdate={onUpdate}
                                                            employeeRoster={employeeRoster}
                                                            busyOnDate={busyByDate[dateStr]}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ];
                                })}
                            </tbody>
                        );
                    })}
                </table>
            </div>

            {/* Legend, like the mockup */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground px-1">
                <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-6 rounded bg-violet-200/70" />Assigned</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-6 rounded border bg-muted/40 inline-flex items-center justify-center"><X className="h-2.5 w-2.5" /></span>Not needed</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-6 rounded border border-dashed border-muted-foreground/50" />Unassigned</span>
                <span className="inline-flex items-center gap-1.5">Click a name to set report time, start time and notes</span>
            </div>
        </div>
    );
};
