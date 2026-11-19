import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO, getDay, addDays } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    CalendarDays, List as ListIcon, PawPrint, Warehouse, Car, Package, Printer, AlertCircle,
    ChevronLeft, ChevronRight, ChevronDown, Truck, MapPin, X, Rows, StickyNote, Trash2, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildHousingCalendar, filterSupplies, emptyDayRow, deliveriesOfDay } from '@/lib/housingCalendar';
import { ensureAllRvSpots } from '@/lib/rvAssignment';
import { toCsv, downloadCsv } from '@/lib/calendarViews';
import SavedViewsMenu from './SavedViewsMenu';

// Operations calendar. Robert 2026-11-15: "an overall understanding of how many bags of
// shavings are pre-delivered, how many bales of hay, how many stalls and RV spots are
// being used each day, how many total horses are on the grounds."
// Robert 2026-11-16: pick barns / RV lots first, and every number follows that pick;
// click a day for an Overview / By Barn / By RV Lot panel; show what was delivered.
// Read-only — it only reads bookings, so it can't change anything.

const fmtDay = (iso, pattern) => {
    try { return format(parseISO(iso), pattern); } catch { return iso; }
};

const Tile = ({ icon: Icon, label, value, sub, tone }) => (
    <div className={cn('rounded-xl border p-4', tone)}>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
            <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
);

// One cell value — a dash for zero keeps the table easy to scan.
const num = (n) => (n > 0 ? n : <span className="text-muted-foreground/50">–</span>);
const pct = (used, total) => (total > 0 ? `${Math.round((used / total) * 100)}%` : '–');

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Pick several barns / RV lots. Nothing ticked = the whole facility.
export function LocationPicker({ barns, rvAreas, barnIds, rvIds, onBarns, onRv }) {
    const picked = barnIds.length + rvIds.length;
    const toggle = (list, id, set) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    const label = picked === 0 ? 'Entire Facility (all barns & RV lots)' : `${picked} location${picked === 1 ? '' : 's'} picked`;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[240px]">
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {label}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 max-h-80 overflow-y-auto p-3 space-y-3">
                <button
                    type="button"
                    className={cn('w-full text-left text-sm rounded px-2 py-1.5 hover:bg-muted', picked === 0 && 'font-semibold bg-muted')}
                    onClick={() => { onBarns([]); onRv([]); }}
                >
                    Entire Facility
                </button>
                {barns.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">Barns</p>
                        {barns.map((b) => (
                            <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted">
                                <Checkbox checked={barnIds.includes(b.id)} onCheckedChange={() => toggle(barnIds, b.id, onBarns)} />
                                <span className="flex-1 truncate">{b.name}</span>
                                {b.stalls != null && <span className="text-xs text-muted-foreground">{b.stalls} stalls</span>}
                            </label>
                        ))}
                    </div>
                )}
                {rvAreas.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">RV lots</p>
                        {rvAreas.map((a) => (
                            <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted">
                                <Checkbox checked={rvIds.includes(a.id)} onCheckedChange={() => toggle(rvIds, a.id, onRv)} />
                                <span className="flex-1 truncate">{a.name}</span>
                                {a.spots != null && <span className="text-xs text-muted-foreground">{a.spots} spots</span>}
                            </label>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

// Pick which supplies to look at. Nothing ticked = every supply.
function SupplyPicker({ options, picked, onChange }) {
    const [q, setQ] = useState('');
    const shown = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
    const toggle = (name) => onChange(picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name]);
    const label = picked.length === 0 ? 'All supplies' : `${picked.length} suppl${picked.length === 1 ? 'y' : 'ies'} picked`;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[170px]">
                    <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> {label}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3 space-y-2">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplies..." className="h-8 text-sm" />
                <button
                    type="button"
                    className={cn('w-full text-left text-sm rounded px-2 py-1.5 hover:bg-muted', picked.length === 0 && 'font-semibold bg-muted')}
                    onClick={() => onChange([])}
                >
                    All supplies
                </button>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {shown.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No supply matches.</p>}
                    {shown.map((name) => (
                        <label key={name} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted">
                            <Checkbox checked={picked.includes(name)} onCheckedChange={() => toggle(name)} />
                            <span className="flex-1 truncate">{name}</span>
                        </label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// What was delivered on one day for one kind ('pre' or 'show'), product by product.
// Nothing delivered = a quiet one-liner, never a list of zeros.
function DayDeliveries({ title, icon: Icon, tone, items }) {
    return (
        <div>
            <p className={cn('text-xs font-semibold flex items-center gap-1', tone)}><Icon className="h-3.5 w-3.5" /> {title}</p>
            {items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1.5">None this day</p>
            ) : (
                <div className="divide-y">
                    {items.map((d) => (
                        <div key={d.product} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-muted-foreground">{d.product}<span className="text-xs"> ({d.unit})</span></span>
                            <span className="font-semibold tabular-nums">{d.qty}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Whole-show delivery totals for one kind (Robert 2026-11-17): every product named,
// total ordered next to how many are completed. Zero rows are left out.
function DeliveryCard({ title, icon: Icon, tone, products, orderedKey, deliveredKey, emptyText }) {
    const rows = Object.entries(products || {}).filter(([, p]) => p[orderedKey] > 0 || p[deliveredKey] > 0);
    return (
        <div className={cn('rounded-xl border p-4 print:break-inside-avoid', tone)}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {title}
            </div>
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">{emptyText}</p>
            ) : (
                <table className="w-full text-sm mt-2">
                    <thead className="text-xs text-muted-foreground">
                        <tr>
                            <th className="text-left font-medium py-1">Product</th>
                            <th className="text-right font-medium py-1">Total</th>
                            <th className="text-right font-medium py-1">Completed</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map(([name, p]) => (
                            <tr key={name}>
                                <td className="py-1.5 pr-2">{name}<span className="text-muted-foreground text-xs"> ({p.unit})</span></td>
                                <td className="py-1.5 text-right tabular-nums font-semibold">{p[orderedKey]}</td>
                                <td className="py-1.5 text-right tabular-nums">{p[deliveredKey]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// Side panel for one clicked day: Overview / By Barn / By RV Lot.
function DayPanel({ row, cal, barnIds, rvIds, notes, onUpdateDayNote, onClose }) {
    const [tab, setTab] = useState('overview');
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const { user, profile } = useAuth();
    const myName = profile?.full_name || profile?.name
        || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        || user?.user_metadata?.full_name || 'Staff';

    const addNote = async () => {
        const text = draft.trim();
        if (!text || !onUpdateDayNote || saving) return;
        setSaving(true);
        await onUpdateDayNote({
            action: 'add', date: row.date,
            note: { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, by: myName, at: new Date().toISOString() },
        });
        setDraft('');
        setSaving(false);
    };
    const { capacity, locations } = cal;
    const barnList = locations.barns.filter((b) => !barnIds.length || barnIds.includes(b.id));
    const rvList = locations.rvAreas.filter((a) => !rvIds.length || rvIds.includes(a.id));
    const line = (label, value, tone) => (
        <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('font-semibold tabular-nums', tone)}>{value}</span>
        </div>
    );
    return (
        <div className="rounded-xl border bg-card overflow-hidden print:hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
                <p className="font-semibold text-sm">{fmtDay(row.date, 'EEEE, MMM d')}</p>
                <button type="button" onClick={onClose} aria-label="Close day panel" className="opacity-80 hover:opacity-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex border-b text-xs">
                {[['overview', 'Overview'], ['barn', 'By Barn'], ['rv', 'By RV Lot'], ['notes', `Notes${notes.length ? ` (${notes.length})` : ''}`]].map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={cn('flex-1 py-2 font-medium', tab === id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:bg-muted/40')}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="p-4 space-y-3">
                {tab === 'overview' && (
                    <>
                        <div className="divide-y">
                            {line('Stalls in use', capacity.stalls ? `${row.stalls} / ${capacity.stalls} (${pct(row.stalls, capacity.stalls)})` : row.stalls)}
                            {line('Available stalls', capacity.stalls ? Math.max(capacity.stalls - row.stalls, 0) : '–')}
                            {line('RV spots in use', capacity.rvs ? `${row.rvs} / ${capacity.rvs} (${pct(row.rvs, capacity.rvs)})` : row.rvs)}
                            {line('Horses on grounds', row.horses)}
                        </div>
                        <DayDeliveries
                            title="Pre-deliveries made" icon={Package} tone="text-amber-700 dark:text-amber-400"
                            items={deliveriesOfDay(row).filter((d) => d.kind === 'pre')}
                        />
                        <DayDeliveries
                            title="At-show deliveries made" icon={Truck} tone="text-blue-700 dark:text-blue-400"
                            items={deliveriesOfDay(row).filter((d) => d.kind === 'show')}
                        />
                    </>
                )}
                {tab === 'barn' && (
                    barnList.length === 0 ? <p className="text-sm text-muted-foreground">No barns set up yet.</p> : (
                        <div className="divide-y">
                            {barnList.map((b) => {
                                const used = row.byBarn[b.id] || 0;
                                const sup = Object.entries(row.barnSupply[b.id] || {}).filter(([, p]) => p.preDelivered > 0 || p.showDelivered > 0);
                                return (
                                    <div key={b.id}>
                                        {line(b.name, `${used} / ${b.stalls} (${pct(used, b.stalls)})`)}
                                        {sup.length > 0 && (
                                            <ul className="pb-2 pl-3 space-y-0.5 text-xs text-muted-foreground">
                                                {sup.map(([name, p]) => (
                                                    <li key={name} className="flex justify-between gap-2">
                                                        <span className="truncate">{name}</span>
                                                        <span className="tabular-nums shrink-0">
                                                            {[p.preDelivered ? `${p.preDelivered} pre-delivery` : '', p.showDelivered ? `${p.showDelivered} at-show` : ''].filter(Boolean).join(' · ')}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                            {row.byBarn.unassigned > 0 && line('Not placed in a barn yet', row.byBarn.unassigned, 'text-amber-600')}
                        </div>
                    )
                )}
                {tab === 'notes' && (
                    <div className="space-y-3">
                        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes for this day yet.</p>}
                        {notes.map((n) => (
                            <div key={n.id} className="rounded-lg border bg-muted/30 p-2.5 text-sm">
                                <p className="whitespace-pre-wrap break-words">{n.text}</p>
                                <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                                    <span>{n.by || 'Staff'}{n.at ? ` · ${fmtDay(n.at, 'MMM d, h:mm a')}` : ''}</span>
                                    {onUpdateDayNote && (
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 hover:text-red-600"
                                            onClick={() => onUpdateDayNote({ action: 'delete', date: row.date, noteId: n.id })}
                                        >
                                            <Trash2 className="h-3 w-3" /> Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {onUpdateDayNote && (
                            <div className="space-y-2">
                                <Textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder="Add a note for this day (e.g. truck arrives at 7am, gate code...)"
                                    className="min-h-[70px] text-sm"
                                />
                                <Button size="sm" className="w-full" disabled={!draft.trim() || saving} onClick={addNote}>
                                    {saving ? 'Saving…' : 'Add note'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                {tab === 'rv' && (
                    rvList.length === 0 ? <p className="text-sm text-muted-foreground">No RV lots set up yet.</p> : (
                        <div className="divide-y">
                            {rvList.map((a) => {
                                const used = row.byRv[a.id] || 0;
                                return line(a.name, `${used} / ${a.spots} (${pct(used, a.spots)})`);
                            })}
                            {row.byRv.unassigned > 0 && line('Not placed in a lot yet', row.byRv.unassigned, 'text-amber-600')}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default function HousingCalendarPanel({ bookings, supplies, startDate, endDate, showName, barns = [], rvAreas = [], dayNotes, onUpdateDayNote, showId }) {
    const notesOf = (date) => (dayNotes && Array.isArray(dayNotes[date]) ? dayNotes[date] : []);
    const [view, setView] = useState('month');
    const [hideEmpty, setHideEmpty] = useState(true);
    const [barnIds, setBarnIds] = useState([]);
    const [rvIds, setRvIds] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    // Fold / unfold a month (Robert 2026-11-18: "have these open and close").
    const [folded, setFolded] = useState([]);
    const toggleMonth = (key) => {
        setFolded((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));
        setSelectedDay((d) => (d && d.startsWith(key) ? null : d));
    };
    // Floating day panel (Robert 2026-11-18): opens right next to the clicked day.
    const wrapRef = useRef(null);
    const panelRef = useRef(null);
    const [anchor, setAnchor] = useState(null);
    const pickDay = (iso, e) => {
        if (iso === selectedDay) { setSelectedDay(null); return; }
        const wrap = wrapRef.current?.getBoundingClientRect();
        const el = e?.currentTarget?.getBoundingClientRect();
        setAnchor(wrap && el ? { top: el.top - wrap.top, left: el.left - wrap.left, right: el.right - wrap.left, width: wrap.width } : null);
        setSelectedDay(iso);
    };
    useEffect(() => {
        if (!selectedDay) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setSelectedDay(null); };
        document.addEventListener('keydown', onKey);
        panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        return () => document.removeEventListener('keydown', onKey);
    }, [selectedDay]);
    const [weekIdx, setWeekIdx] = useState(0);

    const rvFull = useMemo(() => ensureAllRvSpots(rvAreas), [rvAreas]);

    const [supplyNames, setSupplyNames] = useState([]);
    const [showPre, setShowPre] = useState(true);
    const [showAtShow, setShowAtShow] = useState(true);

    const baseCal = useMemo(
        () => buildHousingCalendar({ bookings, supplies, startDate, endDate, barns, rvAreas: rvFull, barnIds, rvIds }),
        [bookings, supplies, startDate, endDate, barns, rvFull, barnIds, rvIds],
    );
    // The supply filter sits on top of the barn / RV pick.
    const cal = useMemo(
        () => filterSupplies(baseCal, { names: supplyNames, pre: showPre, show: showAtShow }),
        [baseCal, supplyNames, showPre, showAtShow],
    );
    // Only supplies that were really ordered for delivery are offered.
    const supplyOptions = useMemo(
        () => Object.entries(baseCal.productTotals)
            .filter(([, p]) => p.preOrdered + p.showOrdered + p.preDelivered + p.showDelivered > 0)
            .map(([name]) => name),
        [baseCal],
    );
    const { rows, totals, peaks, missingHorseCount, capacity, locations, productTotals } = cal;

    // A day is "empty" when nothing is booked or delivered on it.
    const isActive = (r) => r.bookings > 0 || r.stalls > 0 || r.rvs > 0 || r.horses > 0
        || deliveriesOfDay(r).length > 0 || notesOf(r.date).length > 0;
    const shownRows = useMemo(() => (hideEmpty ? rows.filter(isActive) : rows), [rows, hideEmpty]);

    // Week view: 7 days at a time.
    const weeks = useMemo(() => {
        const out = [];
        for (let i = 0; i < shownRows.length; i += 7) out.push(shownRows.slice(i, i + 7));
        return out;
    }, [shownRows]);
    const safeWeek = Math.min(weekIdx, Math.max(weeks.length - 1, 0));
    const tableRows = view === 'week' ? (weeks[safeWeek] || []) : shownRows;

    // Every month from one before the first busy day to the last, so a note can go on any day.
    const months = useMemo(() => {
        const keys = [...new Set(shownRows.map((r) => r.date.slice(0, 7)))].sort();
        if (keys.length === 0) return [];
        const out = [];
        let cur = parseISO(`${keys[0]}-01`);
        cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
        const end = parseISO(`${keys[keys.length - 1]}-01`);
        while (cur <= end) {
            out.push({ key: format(cur, 'yyyy-MM'), label: format(cur, 'MMMM yyyy') });
            cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        }
        return out;
    }, [shownRows]);
    const rowByDate = useMemo(() => Object.fromEntries(rows.map((r) => [r.date, r])), [rows]);

    const selectedRow = selectedDay ? (rowByDate[selectedDay] || emptyDayRow(selectedDay)) : null;

    // CSV of what is on screen: same filters, same days.
    const exportCsv = () => {
        const names = (list, ids) => (ids.length ? list.filter((x) => ids.includes(x.id)).map((x) => x.name).join(' + ') : 'Entire facility');
        const where = [names(locations.barns, barnIds), rvIds.length ? names(locations.rvAreas, rvIds) : ''].filter(Boolean).join(' + ');
        // Delivered that day, product by product: "4 Shavings | 1 Hay (Alfalfa)".
        const deliveredText = (r, kind) => deliveriesOfDay(r).filter((d) => d.kind === kind).map((d) => `${d.qty} ${d.product}`).join(' | ');
        const body = shownRows.map((r) => [
            r.date, r.bookings, r.stalls, capacity.stalls ? pct(r.stalls, capacity.stalls) : '', r.rvs, r.horses,
            deliveredText(r, 'pre'), deliveredText(r, 'show'),
            notesOf(r.date).map((n) => n.text).join(' | '),
        ]);
        // The filters on screen (barns, supplies, pre / at-show) are part of the file.
        const filterNote = [
            supplyNames.length ? `Supplies: ${supplyNames.join(' + ')}` : 'Supplies: all',
            `Showing: ${[showPre ? 'pre-delivery' : '', showAtShow ? 'at-show' : ''].filter(Boolean).join(' + ') || 'nothing'}`,
        ].join(' | ');
        const csv = toCsv(
            ['Day', 'Bookings', 'Stalls used', 'Stall use %', 'RV spots used', 'Horses on grounds', 'Pre-delivery (delivered)', 'At-show delivery (delivered)', 'Notes'],
            body,
        );
        downloadCsv(`operations-calendar-${format(new Date(), 'yyyy-MM-dd')}.csv`, `${toCsv([`Location: ${where}`, filterNote], [])}\r\n${csv}`);
    };

    if (rows.length === 0) {
        return (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
                📭 Nothing to show yet — set the move-in / move-out dates or add a booking and the calendar fills in.
            </div>
        );
    }

    const peakUtil = capacity.stalls ? pct(peaks.stalls.value, capacity.stalls) : null;
    const rvUtil = capacity.rvs ? pct(peaks.rvs.value, capacity.rvs) : null;
    const picked = barnIds.length + rvIds.length;

    return (
        <div className="space-y-4 housing-calendar">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-[260px] flex-1">
                            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Operations Calendar</CardTitle>
                            <CardDescription>
                                What is on the grounds each day{showName ? ` — ${showName}` : ''}. Updates live as bookings come in.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
                                <Button size="sm" variant={view === 'table' ? 'default' : 'ghost'} className="h-8 text-xs" onClick={() => setView('table')}>
                                    <ListIcon className="h-3.5 w-3.5 mr-1.5" /> Day by day
                                </Button>
                                <Button size="sm" variant={view === 'week' ? 'default' : 'ghost'} className="h-8 text-xs" onClick={() => setView('week')}>
                                    <Rows className="h-3.5 w-3.5 mr-1.5" /> Week
                                </Button>
                                <Button size="sm" variant={view === 'month' ? 'default' : 'ghost'} className="h-8 text-xs" onClick={() => setView('month')}>
                                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Month view
                                </Button>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                                <input type="checkbox" className="h-3.5 w-3.5" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
                                Hide empty days
                            </label>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCsv}>
                                <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>
                                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 print:hidden">
                        <LocationPicker
                            barns={locations.barns} rvAreas={locations.rvAreas}
                            barnIds={barnIds} rvIds={rvIds}
                            onBarns={setBarnIds} onRv={setRvIds}
                        />
                        <SupplyPicker options={supplyOptions} picked={supplyNames} onChange={setSupplyNames} />
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <Checkbox checked={showPre} onCheckedChange={(v) => setShowPre(v === true)} /> Pre-delivery
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <Checkbox checked={showAtShow} onCheckedChange={(v) => setShowAtShow(v === true)} /> At-show
                        </label>
                        {(picked > 0 || supplyNames.length > 0 || !showPre || !showAtShow) && (
                            <Button
                                size="sm" variant="ghost" className="h-9 text-xs"
                                onClick={() => { setBarnIds([]); setRvIds([]); setSupplyNames([]); setShowPre(true); setShowAtShow(true); }}
                            >
                                <X className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                        )}
                        <SavedViewsMenu
                            showId={showId}
                            calendar="operations"
                            getState={() => ({ barnIds, rvIds, view, hideEmpty, supplyNames, showPre, showAtShow })}
                            onApply={(s) => {
                                // A barn deleted since the view was saved is quietly dropped.
                                setBarnIds((s.barnIds || []).filter((id) => locations.barns.some((b) => b.id === id)));
                                setRvIds((s.rvIds || []).filter((id) => locations.rvAreas.some((a) => a.id === id)));
                                setSupplyNames((s.supplyNames || []).filter((n) => supplyOptions.includes(n)));
                                setShowPre(s.showPre !== false);
                                setShowAtShow(s.showAtShow !== false);
                                if (s.view) setView(s.view);
                                if (typeof s.hideEmpty === 'boolean') setHideEmpty(s.hideEmpty);
                                setSelectedDay(null);
                            }}
                        />
                        <span className="text-xs text-muted-foreground">Every number below follows this pick.</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Tile icon={Warehouse} label="Stalls (busiest day)" value={capacity.stalls ? `${peaks.stalls.value} / ${capacity.stalls}` : peaks.stalls.value}
                            sub={peaks.stalls.value ? `${peakUtil ? `${peakUtil} in use · ` : ''}${fmtDay(peaks.stalls.date, 'EEE, MMM d')}` : 'No stalls booked'}
                            tone="bg-blue-50/60 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900" />
                        <Tile icon={Car} label="RV spots (busiest day)" value={capacity.rvs ? `${peaks.rvs.value} / ${capacity.rvs}` : peaks.rvs.value}
                            sub={peaks.rvs.value ? `${rvUtil ? `${rvUtil} in use · ` : ''}${fmtDay(peaks.rvs.date, 'EEE, MMM d')}` : 'No RV spots booked'}
                            tone="bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900" />
                        <Tile icon={PawPrint} label="Most horses on grounds" value={peaks.horses.value}
                            sub={peaks.horses.value ? fmtDay(peaks.horses.date, 'EEE, MMM d') : 'No horse counts yet'}
                            tone="bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <DeliveryCard
                            title="Pre-delivery totals" icon={Package}
                            tone="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                            products={productTotals} orderedKey="preOrdered" deliveredKey="preDelivered"
                            emptyText={showPre ? 'No pre-delivery orders for this pick.' : 'Pre-delivery is switched off in the filter.'}
                        />
                        <DeliveryCard
                            title="At-show delivery totals" icon={Truck}
                            tone="bg-sky-50/60 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900"
                            products={productTotals} orderedKey="showOrdered" deliveredKey="showDelivered"
                            emptyText={showAtShow ? 'No at-show orders for this pick.' : 'At-show is switched off in the filter.'}
                        />
                    </div>

                    {missingHorseCount > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                {missingHorseCount} booking{missingHorseCount === 1 ? ' has' : 's have'} no horse count, so
                                the horse totals below may be low. Open the booking in the Master List to add it.
                            </span>
                        </div>
                    )}

                    <div ref={wrapRef} className="relative">
                        <div className="min-w-0 space-y-3">
                            {view === 'week' && weeks.length > 0 && (
                                <div className="flex items-center gap-2 print:hidden">
                                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={safeWeek === 0} onClick={() => setWeekIdx(safeWeek - 1)} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={safeWeek >= weeks.length - 1} onClick={() => setWeekIdx(safeWeek + 1)} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
                                    <span className="text-sm font-semibold">
                                        {weeks[safeWeek]?.length ? `${fmtDay(weeks[safeWeek][0].date, 'MMM d')} – ${fmtDay(weeks[safeWeek][weeks[safeWeek].length - 1].date, 'MMM d')}` : ''}
                                    </span>
                                    <span className="text-xs text-muted-foreground">Week {safeWeek + 1} of {weeks.length}</span>
                                </div>
                            )}

                            {view !== 'month' ? (
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                            <tr>
                                                <th className="text-left px-2 py-2 font-medium">Day</th>
                                                <th className="text-right px-2 py-2 font-medium">Bookings</th>
                                                <th className="text-right px-2 py-2 font-medium">Stalls</th>
                                                {capacity.stalls > 0 && <th className="text-right px-2 py-2 font-medium">Stall use</th>}
                                                <th className="text-right px-2 py-2 font-medium">RV used</th>
                                                <th className="text-right px-2 py-2 font-medium">Horses</th>
                                                <th className="text-left px-2 py-2 font-medium">Pre-delivery</th>
                                                <th className="text-left px-2 py-2 font-medium">At-show delivery</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRows.length === 0 && (
                                                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No days with bookings yet.</td></tr>
                                            )}
                                            {tableRows.map((r) => (
                                                <tr
                                                    key={r.date}
                                                    onClick={(e) => pickDay(r.date, e)}
                                                    className={cn('border-t cursor-pointer hover:bg-muted/30', r.date === selectedDay && 'bg-primary/10')}
                                                >
                                                    <td className="px-2 py-2 font-medium whitespace-nowrap">
                                                        {fmtDay(r.date, 'EEE, MMM d')}
                                                        {notesOf(r.date).length > 0 && <StickyNote className="inline h-3.5 w-3.5 ml-1.5 text-yellow-600" aria-label="Has a note" />}
                                                    </td>
                                                    <td className="px-2 py-2 text-right tabular-nums">{num(r.bookings)}</td>
                                                    <td className="px-2 py-2 text-right tabular-nums">{num(r.stalls)}</td>
                                                    {capacity.stalls > 0 && <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.stalls > 0 ? pct(r.stalls, capacity.stalls) : '–'}</td>}
                                                    <td className="px-2 py-2 text-right tabular-nums">{num(r.rvs)}</td>
                                                    <td className="px-2 py-2 text-right tabular-nums font-semibold">{num(r.horses)}</td>
                                                    {['pre', 'show'].map((kind) => {
                                                        const list = deliveriesOfDay(r).filter((d) => d.kind === kind);
                                                        return (
                                                            <td key={kind} className={cn('px-2 py-2 text-xs', kind === 'pre' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400')}>
                                                                {list.length ? list.map((d) => `${d.qty} ${d.product}`).join(', ') : <span className="text-muted-foreground/50">–</span>}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="border-t bg-muted/30 text-xs">
                                            <tr>
                                                <td className="px-2 py-2 font-semibold" colSpan={capacity.stalls > 0 ? 6 : 5}>Total</td>
                                                <td className="px-2 py-2 font-semibold tabular-nums">{Object.values(productTotals).reduce((n, x) => n + x.preDelivered, 0)} delivered</td>
                                                <td className="px-2 py-2 font-semibold tabular-nums">{Object.values(productTotals).reduce((n, x) => n + x.showDelivered, 0)} delivered</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground print:hidden">
                                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pre-delivery</span>
                                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> At-show delivery</span>
                                        <span>Click any day for details or to add a note.</span>
                                    </div>
                                    {months.map((m) => {
                                        const first = parseISO(`${m.key}-01`);
                                        const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
                                        const cells = [];
                                        for (let i = 0; i < getDay(first); i++) cells.push(null);
                                        for (let d = 0; d < daysInMonth; d++) {
                                            const iso = format(addDays(first, d), 'yyyy-MM-dd');
                                            cells.push({ iso, day: d + 1, data: rowByDate[iso] || null });
                                        }
                                        return (
                                            <div key={m.key}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleMonth(m.key)}
                                                    aria-expanded={!folded.includes(m.key)}
                                                    title={folded.includes(m.key) ? 'Open this month' : 'Fold this month'}
                                                    className="flex items-center gap-1.5 font-semibold mb-2 print:pointer-events-none hover:text-primary"
                                                >
                                                    <ChevronDown className={cn('h-4 w-4 transition-transform print:hidden', folded.includes(m.key) && '-rotate-90')} />
                                                    {m.label}
                                                </button>
                                                {!folded.includes(m.key) && (<>
                                                <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
                                                    {WEEKDAYS.map((d) => <div key={d} className="text-center">{d}</div>)}
                                                </div>
                                                <div className="grid grid-cols-7 gap-1">
                                                    {cells.map((c, i) => {
                                                        if (!c) return <div key={`pad-${i}`} />;
                                                        const r = c.data;
                                                        const hasNote = notesOf(c.iso).length > 0;
                                                        const dels = r ? deliveriesOfDay(r) : [];
                                                        const busy = !!r && (r.stalls > 0 || r.rvs > 0 || r.horses > 0 || dels.length > 0);
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={c.iso}
                                                                onClick={(e) => pickDay(c.iso, e)}
                                                                className={cn(
                                                                    'rounded-md border p-1.5 min-h-[88px] text-[11px] leading-tight text-left cursor-pointer hover:border-primary',
                                                                    busy ? 'bg-card' : 'bg-muted/20 text-muted-foreground/60',
                                                                    c.iso === selectedDay && 'border-primary ring-1 ring-primary bg-primary/5',
                                                                )}
                                                            >
                                                                <div className="font-semibold text-xs mb-1 flex items-center justify-between">
                                                                    <span>{c.day}</span>
                                                                    {hasNote && <StickyNote className="h-3.5 w-3.5 text-yellow-600" aria-label="Has a note" />}
                                                                </div>
                                                                {busy && (
                                                                    <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                                                                        {r.stalls > 0 && <div title="Stalls used">🐴 {r.stalls} stalls</div>}
                                                                        {r.rvs > 0 && <div title="RV spots used">🚐 {r.rvs} RV</div>}
                                                                        {r.horses > 0 && <div title="Horses on grounds" className="font-semibold">🐎 {r.horses} horses</div>}
                                                                        {dels.map((d) => (
                                                                            <div
                                                                                key={`${d.kind}-${d.product}`}
                                                                                title={d.kind === 'pre' ? 'Pre-delivery' : 'Delivered at the show'}
                                                                                className={d.kind === 'pre' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}
                                                                            >
                                                                                🚚 {d.qty} {d.product}
                                                                                <span className="block text-[10px] opacity-80 pl-4">{d.kind === 'pre' ? 'Pre-delivery' : 'At-show'}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                </>)}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {selectedRow && (() => {
                            const W = Math.min(320, anchor?.width || 320);
                            let left = 0;
                            if (anchor) {
                                left = anchor.right + 8 + W <= anchor.width ? anchor.right + 8 : anchor.left - W - 8;
                                left = Math.max(0, Math.min(left, anchor.width - W));
                            }
                            const narrow = anchor && anchor.width < 640;
                            return (
                                <div
                                    ref={panelRef}
                                    className="absolute z-30 shadow-2xl rounded-xl max-h-[80vh] overflow-y-auto"
                                    style={narrow ? { left: 0, right: 0, top: anchor.top + 40 } : { width: W, left, top: anchor ? Math.max(0, anchor.top) : 0 }}
                                >
                                    <DayPanel key={selectedRow.date} row={selectedRow} cal={cal} barnIds={barnIds} rvIds={rvIds} notes={notesOf(selectedRow.date)} onUpdateDayNote={onUpdateDayNote} onClose={() => setSelectedDay(null)} />
                                </div>
                            );
                        })()}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        A booking counts from its arrival day through its departure day. Nightly-fee stalls count only on the nights picked.
                        Pre-delivery hay and shavings are due on the arrival day; "Delivered" shows the day an order was marked Delivered
                        (pre-show and at-show orders). With barns or lots picked, only bookings placed in them are counted.
                        Cancelled bookings are not included.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
