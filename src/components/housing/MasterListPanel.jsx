import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Search, Download, Printer, ArrowUpDown, ArrowUp, ArrowDown, ClipboardList, ChevronRight, ChevronDown, Mail, Phone, Users } from 'lucide-react';
import { getRequestedStallCount, getAssignedStallsForBooking } from '@/lib/stallAssignment';

// ── Phase 1: Master List ──
// A spreadsheet-style roster of everyone who booked (stalls + RV + pre-ordered
// supplies like shavings/hay). Read-only summary with sort / filter, plus two
// paper-ready exports: a CSV (opens in Excel/Sheets — includes contact, dates,
// supplies and horse names) and a printable Stalls & RV worklist with a tick-off
// column. Assignment itself still happens via the per-row "Manage Stalls" dialog.

// How many RV spots a booking asked for (across all rv line items).
const getRvCount = (booking) =>
    (booking?.items || []).reduce((sum, it) => sum + (it.type === 'rv' ? (Number(it.qty) || 0) : 0), 0);

// How many horses the exhibitor is bringing (several shapes across builders).
const getHorseCount = (booking) => {
    if (Number.isFinite(booking?.horseCount)) return booking.horseCount;
    if (Array.isArray(booking?.horseNames)) return booking.horseNames.length;
    return booking?.horseName ? 1 : 0;
};

// The actual horse names (array, comma-string, or single field — normalize to a list).
const getHorseNames = (booking) => {
    if (Array.isArray(booking?.horseNames)) return booking.horseNames.filter(Boolean);
    if (typeof booking?.horseNames === 'string') return booking.horseNames.split(',').map(s => s.trim()).filter(Boolean);
    if (booking?.horseName) return [booking.horseName];
    return [];
};

// Pre-ordered supplies (shavings / hay / feed) — one entry per supply line item.
// item.name already reads like "Shavings × 3"; strip the trailing "× n" so we can
// re-render it consistently as "Shavings ×3" and expose the qty on its own.
const getSupplies = (booking) =>
    (booking?.items || [])
        .filter(it => it?.type === 'supply')
        .map(it => {
            const qty = Number(it.qty) || 0;
            const base = String(it.name || '').replace(/\s*×\s*\d+\s*$/, '').trim();
            return { name: base || it.name || 'Item', qty };
        });

// 'YYYY-MM-DD' → 'Jul 3' without pulling in a date library.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return String(iso);
    return `${MONTHS[m - 1]} ${d}`;
};

// ISO timestamp → "Jul 14, 11:08 PM" for the "Booked" line in the detail panel.
const fmtDateTime = (iso) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
    } catch {
        return String(iso);
    }
};

// Build one flat row per booking with everything the table + export need.
const buildRow = (booking, barns) => {
    const requested = getRequestedStallCount(booking);
    const assigned = getAssignedStallsForBooking(booking, barns);
    const supplies = getSupplies(booking);
    const horseNamesArr = getHorseNames(booking);
    return {
        booking,
        name: booking.exhibitorName || '—',
        trainer: booking.trainerName || '',
        trainerEmail: booking.trainerEmail || '',
        trainerPhone: booking.trainerPhone || '',
        email: booking.email || '',
        phone: booking.phone || '',
        arrival: booking.arrivalDate || '',
        departure: booking.departureDate || '',
        arrivalLabel: fmtDate(booking.arrivalDate),
        departureLabel: fmtDate(booking.departureDate),
        stalls: requested,
        assignedCount: assigned.length,
        stallNumbersArr: assigned.map(s => s.number),
        stallNumbers: assigned.map(s => s.number).join(', '),
        rv: getRvCount(booking),
        supplies,
        supplyCount: supplies.reduce((n, s) => n + s.qty, 0),
        suppliesStr: supplies.map(s => `${s.name} ×${s.qty}`).join(', '),
        horses: getHorseCount(booking),
        horseNamesArr,
        horseNamesStr: horseNamesArr.join(', '),
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

// A generation timestamp for every export, so a printed/emailed copy is traceable.
// `human` reads like "Jul 7, 2026, 12:25 PM"; `file` is filename-safe "2026-07-07_1225".
const exportStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const human = d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const file = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    return { human, file };
};

const COLUMNS = [
    { key: 'name', label: 'Exhibitor', align: 'left' },
    { key: 'trainer', label: 'Trainer / Group', align: 'left' },
    { key: 'stalls', label: 'Stalls', align: 'center' },
    { key: 'assignedCount', label: 'Assigned', align: 'center' },
    { key: 'rv', label: 'RV', align: 'center' },
    { key: 'suppliesStr', label: 'Supplies / Pre-Orders', align: 'left' },
    { key: 'horses', label: 'Horses', align: 'center' },
    { key: 'status', label: 'Status', align: 'left' },
];

const MasterListPanel = ({ bookings = [], barns = [], rvAreas = [], showName = 'Show' }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [assignFilter, setAssignFilter] = useState('all'); // all | assigned | partial | unassigned
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
    // Rows the user has expanded (independent — several can be open at once).
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const toggleExpanded = (id) => setExpandedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

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
                const hay = `${r.name} ${r.trainer} ${r.trainerEmail} ${r.trainerPhone} ${r.stallNumbers} ${r.suppliesStr} ${r.horseNamesStr} ${r.email} ${r.phone}`.toLowerCase();
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
        supplies: t.supplies + r.supplyCount,
        horses: t.horses + r.horses,
    }), { stalls: 0, assigned: 0, rv: 0, supplies: 0, horses: 0 }), [filtered]);

    const toggleSort = (key) => setSort(prev =>
        prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

    const SortIcon = ({ colKey }) => {
        if (sort.key !== colKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
        return sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
    };

    const exportCsv = () => {
        const { human, file } = exportStamp();
        const header = [
            'Exhibitor', 'Email', 'Phone',
            'Trainer/Group', 'Trainer Email', 'Trainer Phone',
            'Arrival', 'Departure',
            'Stalls', 'Assigned', 'Assigned Stalls', 'RV',
            'Supplies / Pre-Orders', 'Horses', 'Horse Names', 'Status',
        ];
        const lines = [
            '﻿' + csvCell(`${showName} — Master List`), // BOM so Excel reads UTF-8 accents correctly
            'Generated:,' + csvCell(human),
            '', // blank spacer row before the table header
            header.join(','),
        ];
        for (const r of filtered) {
            lines.push([
                r.name, r.email, r.phone,
                r.trainer, r.trainerEmail, r.trainerPhone,
                r.arrivalLabel, r.departureLabel,
                r.stalls, r.assignedCount, r.stallNumbers, r.rv,
                r.suppliesStr, r.horses, r.horseNamesStr, r.status,
            ].map(csvCell).join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${showName.replace(/[^\w-]+/g, '_')}_master_list_${file}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Escape values before injecting into the print window's HTML.
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const printList = () => {
        const { human } = exportStamp();
        const rowsHtml = filtered.map(r => {
            const assignedCell = r.stalls > 0
                ? `${r.assignedCount}/${r.stalls}${r.stallNumbers ? ` <span class="muted">(${esc(r.stallNumbers)})</span>` : ''}`
                : '—';
            const contact = [r.email, r.phone].filter(Boolean).map(esc).join(' · ');
            const dates = (r.arrivalLabel || r.departureLabel)
                ? `${esc(r.arrivalLabel)} – ${esc(r.departureLabel)}` : '';
            return `
            <tr>
                <td class="check"></td>
                <td>
                    <strong>${esc(r.name)}</strong>
                    ${contact ? `<div class="muted">${contact}</div>` : ''}
                    ${r.trainer ? `<div class="muted">${esc(r.trainer)}${(() => { const tc = [r.trainerEmail, r.trainerPhone].filter(Boolean).map(esc).join(' · '); return tc ? ` — ${tc}` : ''; })()}</div>` : ''}
                    ${dates ? `<div class="muted">${dates}</div>` : ''}
                </td>
                <td class="c">${assignedCell}</td>
                <td class="c">${r.rv || '—'}</td>
                <td>${r.suppliesStr ? esc(r.suppliesStr) : '—'}</td>
                <td>${r.horseNamesStr ? esc(r.horseNamesStr) : (r.horses ? `${r.horses} horse${r.horses !== 1 ? 's' : ''}` : '—')}</td>
                <td class="cap">${esc(r.status.replace('_', ' '))}</td>
            </tr>`;
        }).join('');
        const html = `<!doctype html><html><head><title>${esc(showName)} — Master List</title>
            <style>
                *{box-sizing:border-box}
                body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#111}
                h1{font-size:18px;margin:0 0 4px}
                p.sub{color:#666;margin:0 0 16px;font-size:12px}
                table{border-collapse:collapse;width:100%;font-size:12px}
                th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
                th{background:#f3f4f6;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
                td.c,th.c{text-align:center}
                td.cap{text-transform:capitalize}
                td.check{width:26px;text-align:center}
                td.check::before{content:"";display:inline-block;width:13px;height:13px;border:1.5px solid #333;border-radius:2px}
                .muted{color:#666;font-size:11px;margin-top:2px}
                tbody tr:nth-child(even){background:#fafafa}
                @media print{body{padding:0}tbody tr{page-break-inside:avoid}}
            </style></head><body>
            <h1>${esc(showName)} — Stalls, RV &amp; Supplies Worklist</h1>
            <p class="sub">Generated ${esc(human)}</p>
            <p class="sub">${filtered.length} bookings · ${totals.stalls} stalls · ${totals.rv} RV · ${totals.supplies} supplies · ${totals.horses} horses</p>
            <table><thead><tr>
                <th>✔</th><th>Exhibitor / Contact</th><th class="c">Stalls</th><th class="c">RV</th>
                <th>Supplies / Pre-Orders</th><th>Horses</th><th>Status</th>
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
                                const isOpen = expandedIds.has(r.booking.id);
                                const extraStalls = Math.max(r.assignedCount - r.horses, 0);
                                return (
                                    <React.Fragment key={r.booking.id}>
                                    <tr className={cn('border-b last:border-0 hover:bg-muted/30', isOpen && 'bg-muted/20')}>
                                        <td className="px-3 py-2 font-medium">
                                            <button
                                                type="button"
                                                onClick={() => toggleExpanded(r.booking.id)}
                                                className="inline-flex items-center gap-1.5 text-left hover:text-primary"
                                                title={isOpen ? 'Hide details' : 'Show details'}
                                            >
                                                {isOpen
                                                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                                {r.name}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {r.trainer || (r.trainerEmail || r.trainerPhone ? '' : '—')}
                                            {(r.trainerEmail || r.trainerPhone) && (
                                                <div className="text-[10px] text-muted-foreground/70 leading-tight">
                                                    {[r.trainerEmail, r.trainerPhone].filter(Boolean).join(' · ')}
                                                </div>
                                            )}
                                        </td>
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
                                        <td className="px-3 py-2">
                                            {r.supplies.length > 0 ? (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {r.supplies.map((s, i) => (
                                                        <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                                            {s.name} <span className="ml-1 font-semibold tabular-nums">×{s.qty}</span>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className="tabular-nums font-medium">{r.horses || '—'}</span>
                                            {r.horseNamesStr && (
                                                <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{r.horseNamesStr}</div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <Badge className={cn('text-[10px] capitalize', STATUS_STYLES[r.status] || '')}>
                                                {r.status.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr className="border-b bg-muted/30">
                                            <td colSpan={COLUMNS.length} className="px-4 py-3 text-xs">
                                                <div className="space-y-2.5">
                                                    {/* Contacts */}
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                        {r.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {r.email}</span> : null}
                                                        {r.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {r.phone}</span> : null}
                                                        {!r.email && !r.phone && <span className="text-muted-foreground italic">No exhibitor contact on file</span>}
                                                    </div>
                                                    {(r.trainer || r.trainerEmail || r.trainerPhone) && (
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                                                            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Trainer: {r.trainer || '—'}</span>
                                                            {r.trainerEmail ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {r.trainerEmail}</span> : null}
                                                            {r.trainerPhone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {r.trainerPhone}</span> : null}
                                                        </div>
                                                    )}

                                                    {/* Horses, stalls, extra */}
                                                    <div className="grid gap-2 sm:grid-cols-3">
                                                        <div>
                                                            <p className="font-medium text-muted-foreground mb-0.5">Horses ({r.horses})</p>
                                                            <p>{r.horseNamesArr.length ? r.horseNamesArr.join(', ') : <span className="italic text-muted-foreground">None listed</span>}</p>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-muted-foreground mb-0.5">Stalls ({r.assignedCount}{r.stalls ? ` of ${r.stalls}` : ''})</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {r.stallNumbersArr.length
                                                                    ? r.stallNumbersArr.map((num, i) => (
                                                                        <Badge key={i} className="bg-emerald-600 text-white text-[10px] font-mono">{num}</Badge>
                                                                    ))
                                                                    : <span className="italic text-muted-foreground">Unassigned</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-muted-foreground mb-0.5">Extra stalls beyond horses</p>
                                                            <p className={cn('font-semibold', extraStalls > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                                                                {extraStalls > 0 ? `+${extraStalls}` : '0'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Supplies */}
                                                    {r.supplies.length > 0 && (
                                                        <div>
                                                            <p className="font-medium text-muted-foreground mb-0.5">Supplies / Pre-Orders</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {r.supplies.map((s, i) => (
                                                                    <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                                                        {s.name} <span className="ml-1 font-semibold tabular-nums">×{s.qty}</span>
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Meta */}
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground pt-1 border-t">
                                                        <span>Payment: <span className="capitalize font-medium text-foreground">{(r.booking.paymentStatus || 'unpaid').replace('_', ' ')}</span></span>
                                                        {(r.arrivalLabel || r.departureLabel) ? <span>Dates: <span className="font-medium text-foreground">{r.arrivalLabel || '?'} – {r.departureLabel || '?'}</span></span> : null}
                                                        {r.booking.source ? <span>Source: <span className="capitalize font-medium text-foreground">{r.booking.source}</span></span> : null}
                                                        {r.booking.createdAt ? <span>Booked: <span className="font-medium text-foreground">{fmtDateTime(r.booking.createdAt)}</span></span> : null}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    </React.Fragment>
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
                                    <td className="px-3 py-2 tabular-nums">{totals.supplies ? `${totals.supplies} items` : ''}</td>
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
