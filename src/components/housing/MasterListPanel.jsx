import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Search, Download, Printer, ArrowUpDown, ArrowUp, ArrowDown, ClipboardList } from 'lucide-react';
import { getRequestedStallCount, getAssignedStallsForBooking } from '@/lib/stallAssignment';

// ── Phase 1: Master List ──
// A spreadsheet-style roster of everyone who booked (stalls + RV). Read-only
// summary with sort / filter / print / CSV export. Assignment itself still
// happens via the per-row "Manage Stalls" dialog (drag-drop board is Phase 2).

// How many RV spots a booking asked for (across all rv line items).
const getRvCount = (booking) =>
    (booking?.items || []).reduce((sum, it) => sum + (it.type === 'rv' ? (Number(it.qty) || 0) : 0), 0);

// How many horses the exhibitor is bringing (several shapes across builders).
const getHorseCount = (booking) => {
    if (Number.isFinite(booking?.horseCount)) return booking.horseCount;
    if (Array.isArray(booking?.horseNames)) return booking.horseNames.length;
    return booking?.horseName ? 1 : 0;
};

// Build one flat row per booking with everything the table + export need.
const buildRow = (booking, barns) => {
    const requested = getRequestedStallCount(booking);
    const assigned = getAssignedStallsForBooking(booking, barns);
    return {
        booking,
        name: booking.exhibitorName || '—',
        trainer: booking.trainerName || '',
        stalls: requested,
        assignedCount: assigned.length,
        stallNumbersArr: assigned.map(s => s.number),
        stallNumbers: assigned.map(s => s.number).join(', '),
        rv: getRvCount(booking),
        horses: getHorseCount(booking),
        status: booking.status || 'pending',
    };
};

const STATUS_STYLES = {
    pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    confirmed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    checked_in: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    cancelled: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const csvCell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const COLUMNS = [
    { key: 'name', label: 'Exhibitor', align: 'left' },
    { key: 'trainer', label: 'Trainer / Group', align: 'left' },
    { key: 'stalls', label: 'Stalls', align: 'center' },
    { key: 'assignedCount', label: 'Assigned', align: 'center' },
    { key: 'rv', label: 'RV', align: 'center' },
    { key: 'horses', label: 'Horses', align: 'center' },
    { key: 'status', label: 'Status', align: 'left' },
];

const MasterListPanel = ({ bookings = [], barns = [], rvAreas = [], showName = 'Show' }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [assignFilter, setAssignFilter] = useState('all'); // all | assigned | partial | unassigned
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

    const rows = useMemo(
        () => (bookings || []).filter(Boolean).map(b => buildRow(b, barns)),
        [bookings, barns]
    );

    const trainers = useMemo(() => {
        const set = new Set(rows.map(r => r.trainer).filter(Boolean));
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [rows]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = rows.filter(r => {
            if (q) {
                const hay = `${r.name} ${r.trainer} ${r.stallNumbers}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (assignFilter !== 'all') {
                if (assignFilter === 'assigned' && !(r.stalls > 0 && r.assignedCount >= r.stalls)) return false;
                if (assignFilter === 'partial' && !(r.assignedCount > 0 && r.assignedCount < r.stalls)) return false;
                if (assignFilter === 'unassigned' && !(r.stalls > 0 && r.assignedCount === 0)) return false;
            }
            return true;
        });
        const { key, dir } = sort;
        const mult = dir === 'asc' ? 1 : -1;
        list = [...list].sort((a, b) => {
            const av = a[key], bv = b[key];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
            return String(av).localeCompare(String(bv)) * mult;
        });
        return list;
    }, [rows, search, statusFilter, assignFilter, sort]);

    const totals = useMemo(() => filtered.reduce((t, r) => ({
        stalls: t.stalls + r.stalls,
        assigned: t.assigned + r.assignedCount,
        rv: t.rv + r.rv,
        horses: t.horses + r.horses,
    }), { stalls: 0, assigned: 0, rv: 0, horses: 0 }), [filtered]);

    const toggleSort = (key) => setSort(prev =>
        prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

    const SortIcon = ({ colKey }) => {
        if (sort.key !== colKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
        return sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
    };

    const exportCsv = () => {
        const header = ['Exhibitor', 'Trainer/Group', 'Stalls', 'Assigned', 'Assigned Stalls', 'RV', 'Horses', 'Status'];
        const lines = [header.join(',')];
        for (const r of filtered) {
            lines.push([
                r.name, r.trainer, r.stalls, r.assignedCount, r.stallNumbers, r.rv, r.horses, r.status,
            ].map(csvCell).join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${showName.replace(/[^\w-]+/g, '_')}_master_list.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const printList = () => {
        const rowsHtml = filtered.map(r => `
            <tr>
                <td>${r.name}</td><td>${r.trainer}</td>
                <td style="text-align:center">${r.stalls}</td>
                <td style="text-align:center">${r.assignedCount}/${r.stalls} ${r.stallNumbers ? `<span style="color:#666">(${r.stallNumbers})</span>` : ''}</td>
                <td style="text-align:center">${r.rv}</td>
                <td style="text-align:center">${r.horses}</td>
                <td>${r.status.replace('_', ' ')}</td>
            </tr>`).join('');
        const html = `<!doctype html><html><head><title>${showName} — Master List</title>
            <style>
                body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#111}
                h1{font-size:18px;margin:0 0 4px} p{color:#666;margin:0 0 16px;font-size:12px}
                table{border-collapse:collapse;width:100%;font-size:12px}
                th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
                th{background:#f3f4f6}
            </style></head><body>
            <h1>${showName} — Master Booking List</h1>
            <p>${filtered.length} bookings · ${totals.stalls} stalls · ${totals.rv} RV · ${totals.horses} horses</p>
            <table><thead><tr>
                <th>Exhibitor</th><th>Trainer / Group</th><th>Stalls</th><th>Assigned</th><th>RV</th><th>Horses</th><th>Status</th>
            </tr></thead><tbody>${rowsHtml}</tbody></table>
            </body></html>`;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
    };

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, trainer, stall..." className="h-8 pl-8 text-sm" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                        <SelectItem value="confirmed" className="text-xs">Confirmed</SelectItem>
                        <SelectItem value="checked_in" className="text-xs">Checked in</SelectItem>
                        <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={assignFilter} onValueChange={setAssignFilter}>
                    <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Assignment" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All assignment</SelectItem>
                        <SelectItem value="assigned" className="text-xs">Fully assigned</SelectItem>
                        <SelectItem value="partial" className="text-xs">Partly assigned</SelectItem>
                        <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv} disabled={filtered.length === 0}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={printList} disabled={filtered.length === 0}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                </Button>
            </div>

            {rows.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No bookings yet. They appear here as soon as exhibitors book.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                {COLUMNS.map(col => (
                                    <th key={col.key}
                                        className={cn('px-3 py-2 font-medium select-none cursor-pointer',
                                            col.align === 'center' ? 'text-center' : 'text-left')}
                                        onClick={() => toggleSort(col.key)}>
                                        <span className={cn('inline-flex items-center gap-1', col.align === 'center' && 'justify-center')}>
                                            {col.label} <SortIcon colKey={col.key} />
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => {
                                const full = r.stalls > 0 && r.assignedCount >= r.stalls;
                                const partial = r.assignedCount > 0 && r.assignedCount < r.stalls;
                                return (
                                    <tr key={r.booking.id} className="border-b last:border-0 hover:bg-muted/30">
                                        <td className="px-3 py-2 font-medium">{r.name}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{r.trainer || '—'}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{r.stalls || '—'}</td>
                                        <td className="px-3 py-2">
                                            {r.stalls > 0 ? (
                                                <div className="flex items-center gap-1 flex-wrap justify-center">
                                                    {r.assignedCount === 0 ? (
                                                        <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-500">Unassigned</Badge>
                                                    ) : (
                                                        <>
                                                            {r.stallNumbersArr.slice(0, 8).map((num, i) => (
                                                                <Badge key={i} className="bg-emerald-600 text-white text-[10px] font-mono">{num}</Badge>
                                                            ))}
                                                            {r.stallNumbersArr.length > 8 && (
                                                                <Badge variant="outline" className="text-[10px]">+{r.stallNumbersArr.length - 8}</Badge>
                                                            )}
                                                            {partial && (
                                                                <span className="text-[10px] text-amber-600 font-medium">• {r.stalls - r.assignedCount} left</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ) : <span className="text-muted-foreground flex justify-center">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center tabular-nums">{r.rv || '—'}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{r.horses || '—'}</td>
                                        <td className="px-3 py-2">
                                            <Badge className={cn('text-[10px] capitalize', STATUS_STYLES[r.status] || '')}>
                                                {r.status.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr className="border-t bg-muted/30 font-medium">
                                    <td className="px-3 py-2" colSpan={2}>{filtered.length} bookings</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.stalls}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.assigned}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.rv}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.horses}</td>
                                    <td className="px-3 py-2" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </div>
    );
};

export default MasterListPanel;
