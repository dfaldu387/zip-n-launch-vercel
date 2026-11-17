import React, { useMemo, useState } from 'react';
import { format, parseISO, getDay, addDays } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    CalendarDays, List as ListIcon, PawPrint, Warehouse, Car, Package, Printer, AlertCircle,
    ChevronLeft, ChevronRight, ChevronDown, Truck, MapPin, X, Rows, StickyNote, Trash2, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildHousingCalendar } from '@/lib/housingCalendar';
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

// Ordered / pre-delivery due / delivered, product by product (Shavings, each hay, mats...).
function ProductTable({ products, title }) {
    const entries = Object.entries(products || {});
    if (entries.length === 0) return null;
    return (
        <div>
            <p className="text-xs font-semibold mb-1">{title}</p>
            <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                    <tr>
                        <th className="text-left font-medium py-1">Product</th>
                        <th className="text-right font-medium py-1">Ordered</th>
                        <th className="text-right font-medium py-1">Due</th>
                        <th className="text-right font-medium py-1">Delivered</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {entries.map(([name, p]) => (
                        <tr key={name}>
                            <td className="py-1.5 pr-2">{name}<span className="text-muted-foreground"> ({p.unit})</span></td>
                            <td className="py-1.5 text-right tabular-nums">{num(p.ordered)}</td>
                            <td className="py-1.5 text-right tabular-nums text-amber-700 dark:text-amber-400">{num(p.due)}</td>
                            <td className="py-1.5 text-right tabular-nums text-blue-700 dark:text-blue-400">{num(p.delivered)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
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
                        <div>
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Pre-deliveries due</p>
                            <div className="divide-y">
                                {line('Shavings', `${row.shavingsBags} bags`)}
                                {line('Hay', `${row.hayBales} bales`)}
                                {(row.outstandingBags > 0 || row.outstandingBales > 0) && line('Not delivered yet', `${row.outstandingBags} bags · ${row.outstandingBales} bales`, 'text-red-600')}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Delivered this day</p>
                            <div className="divide-y">
                                {line('Shavings', `${row.deliveredBags} bags`)}
                                {line('Hay', `${row.deliveredBales} bales`)}
                            </div>
                        </div>
                        <ProductTable products={row.products} title="Items by product (this day)" />
                    </>
                )}
                {tab === 'barn' && (
                    barnList.length === 0 ? <p className="text-sm text-muted-foreground">No barns set up yet.</p> : (
                        <div className="divide-y">
                            {barnList.map((b) => {
                                const used = row.byBarn[b.id] || 0;
                                const sup = Object.entries(row.barnSupply[b.id] || {});
                                return (
                                    <div key={b.id}>
                                        {line(b.name, `${used} / ${b.stalls} (${pct(used, b.stalls)})`)}
                                        {sup.length > 0 && (
                                            <ul className="pb-2 pl-3 space-y-0.5 text-xs text-muted-foreground">
                                                {sup.map(([name, p]) => (
                                                    <li key={name} className="flex justify-between gap-2">
                                                        <span className="truncate">{name}</span>
                                                        <span className="tabular-nums shrink-0">
                                                            {[p.due ? `due ${p.due}` : '', p.delivered ? `delivered ${p.delivered}` : '', p.ordered ? `ordered ${p.ordered}` : ''].filter(Boolean).join(' · ')}
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
    const [weekIdx, setWeekIdx] = useState(0);

    const rvFull = useMemo(() => ensureAllRvSpots(rvAreas), [rvAreas]);

    const cal = useMemo(
        () => buildHousingCalendar({ bookings, supplies, startDate, endDate, barns, rvAreas: rvFull, barnIds, rvIds }),
        [bookings, supplies, startDate, endDate, barns, rvFull, barnIds, rvIds],
    );
    const { rows, totals, peaks, missingHorseCount, capacity, locations, productTotals } = cal;

    // A day is "empty" when nothing is booked or delivered on it.
    const isActive = (r) => r.bookings > 0 || r.stalls > 0 || r.rvs > 0 || r.horses > 0
        || r.shavingsBags > 0 || r.hayBales > 0 || r.deliveredBags > 0 || r.deliveredBales > 0
        || notesOf(r.date).length > 0 || Object.keys(r.products).length > 0;
    const shownRows = useMemo(() => (hideEmpty ? rows.filter(isActive) : rows), [rows, hideEmpty]);

    // Week view: 7 days at a time.
    const weeks = useMemo(() => {
        const out = [];
        for (let i = 0; i < shownRows.length; i += 7) out.push(shownRows.slice(i, i + 7));
        return out;
    }, [shownRows]);
    const safeWeek = Math.min(weekIdx, Math.max(weeks.length - 1, 0));
    const tableRows = view === 'week' ? (weeks[safeWeek] || []) : shownRows;

    const months = useMemo(() => {
        const out = [];
        for (const r of shownRows) {
            const key = r.date.slice(0, 7);
            let m = out.find((x) => x.key === key);
            if (!m) { m = { key, label: fmtDay(r.date, 'MMMM yyyy'), rows: [] }; out.push(m); }
            m.rows.push(r);
        }
        return out;
    }, [shownRows]);

    const selectedRow = selectedDay ? rows.find((r) => r.date === selectedDay) : null;

    // CSV of what is on screen: same filters, same days.
    const exportCsv = () => {
        const names = (list, ids) => (ids.length ? list.filter((x) => ids.includes(x.id)).map((x) => x.name).join(' + ') : 'Entire facility');
        const where = [names(locations.barns, barnIds), rvIds.length ? names(locations.rvAreas, rvIds) : ''].filter(Boolean).join(' + ');
        const body = shownRows.map((r) => [
            r.date, r.bookings, r.stalls, capacity.stalls ? pct(r.stalls, capacity.stalls) : '', r.rvs, r.horses,
            r.shavingsBags, r.hayBales, r.outstandingBags, r.outstandingBales, r.deliveredBags, r.deliveredBales,
            Object.entries(r.products).map(([n, x]) => `${n}: ordered ${x.ordered}, due ${x.due}, delivered ${x.delivered}`).join(' | '),
            notesOf(r.date).map((n) => n.text).join(' | '),
        ]);
        const csv = toCsv(
            ['Day', 'Bookings', 'Stalls used', 'Stall use %', 'RV spots used', 'Horses on grounds', 'Shavings due (bags)', 'Hay due (bales)',
                'Shavings not delivered (bags)', 'Hay not delivered (bales)', 'Shavings delivered (bags)', 'Hay delivered (bales)', 'Products (ordered / due / delivered)', 'Notes'],
            body,
        );
        downloadCsv(`operations-calendar-${format(new Date(), 'yyyy-MM-dd')}.csv`, `${toCsv([`Location: ${where}`], [])}\r\n${csv}`);
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
                        {picked > 0 && (
                            <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => { setBarnIds([]); setRvIds([]); }}>
                                <X className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                        )}
                        <SavedViewsMenu
                            showId={showId}
                            calendar="operations"
                            getState={() => ({ barnIds, rvIds, view, hideEmpty })}
                            onApply={(s) => {
                                // A barn deleted since the view was saved is quietly dropped.
                                setBarnIds((s.barnIds || []).filter((id) => locations.barns.some((b) => b.id === id)));
                                setRvIds((s.rvIds || []).filter((id) => locations.rvAreas.some((a) => a.id === id)));
                                if (s.view) setView(s.view);
                                if (typeof s.hideEmpty === 'boolean') setHideEmpty(s.hideEmpty);
                                setSelectedDay(null);
                            }}
                        />
                        <span className="text-xs text-muted-foreground">Every number below follows this pick.</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <Tile icon={Warehouse} label="Stalls (busiest day)" value={capacity.stalls ? `${peaks.stalls.value} / ${capacity.stalls}` : peaks.stalls.value}
                            sub={peaks.stalls.value ? `${peakUtil ? `${peakUtil} in use · ` : ''}${fmtDay(peaks.stalls.date, 'EEE, MMM d')}` : 'No stalls booked'}
                            tone="bg-blue-50/60 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900" />
                        <Tile icon={Car} label="RV spots (busiest day)" value={capacity.rvs ? `${peaks.rvs.value} / ${capacity.rvs}` : peaks.rvs.value}
                            sub={peaks.rvs.value ? `${rvUtil ? `${rvUtil} in use · ` : ''}${fmtDay(peaks.rvs.date, 'EEE, MMM d')}` : 'No RV spots booked'}
                            tone="bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900" />
                        <Tile icon={PawPrint} label="Most horses on grounds" value={peaks.horses.value}
                            sub={peaks.horses.value ? fmtDay(peaks.horses.date, 'EEE, MMM d') : 'No horse counts yet'}
                            tone="bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" />
                        <Tile icon={Package} label="Pre-delivery (due)" value={`${totals.shavingsBags} bags`}
                            sub={`${totals.hayBales} bales hay${totals.outstandingBags + totals.outstandingBales > 0 ? ` · ${totals.outstandingBags} bags / ${totals.outstandingBales} bales not delivered yet` : ''}`}
                            tone="bg-violet-50/60 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900" />
                        <Tile icon={Truck} label="Deliveries (done)" value={`${totals.deliveredBags} bags`}
                            sub={`${totals.deliveredBales} bales hay delivered`}
                            tone="bg-sky-50/60 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900" />
                    </div>

                    {Object.keys(productTotals).length > 0 && (
                        <div className="rounded-lg border p-3 print:break-inside-avoid">
                            <ProductTable products={productTotals} title="Supplies by product (whole show)" />
                        </div>
                    )}

                    {missingHorseCount > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                {missingHorseCount} booking{missingHorseCount === 1 ? ' has' : 's have'} no horse count, so
                                the horse totals below may be low. Open the booking in the Master List to add it.
                            </span>
                        </div>
                    )}

                    <div className={cn('grid gap-4', selectedRow && 'lg:grid-cols-[minmax(0,1fr)_280px]')}>
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
                                                <th className="text-right px-2 py-2 font-medium">Shavings due</th>
                                                <th className="text-right px-2 py-2 font-medium">Hay due</th>
                                                <th className="text-right px-2 py-2 font-medium">Items ordered</th>
                                                <th className="text-right px-2 py-2 font-medium">Delivered</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRows.length === 0 && (
                                                <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">No days with bookings yet.</td></tr>
                                            )}
                                            {tableRows.map((r) => (
                                                <tr
                                                    key={r.date}
                                                    onClick={() => setSelectedDay(r.date === selectedDay ? null : r.date)}
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
                                                    <td className="px-2 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{num(r.shavingsBags)}</td>
                                                    <td className="px-2 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{num(r.hayBales)}</td>
                                                    <td className="px-2 py-2 text-right tabular-nums">{num(Object.values(r.products).reduce((n, x) => n + x.ordered, 0))}</td>
                                                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-blue-700 dark:text-blue-400">
                                                        {r.deliveredBags + r.deliveredBales > 0 ? `${r.deliveredBags} bags · ${r.deliveredBales} bales` : <span className="text-muted-foreground/50">–</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="border-t bg-muted/30 text-xs">
                                            <tr>
                                                <td className="px-2 py-2 font-semibold" colSpan={capacity.stalls > 0 ? 6 : 5}>Total</td>
                                                <td className="px-2 py-2 text-right font-semibold tabular-nums">{totals.shavingsBags}</td>
                                                <td className="px-2 py-2 text-right font-semibold tabular-nums">{totals.hayBales}</td>
                                                <td className="px-2 py-2 text-right font-semibold tabular-nums">{Object.values(productTotals).reduce((n, x) => n + x.ordered, 0)}</td>
                                                <td className="px-2 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{totals.deliveredBags} bags · {totals.deliveredBales} bales</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground print:hidden">
                                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pre-delivery (due)</span>
                                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Delivered</span>
                                        <span>Click a day for details.</span>
                                    </div>
                                    {months.map((m) => {
                                        const byDate = Object.fromEntries(m.rows.map((r) => [r.date, r]));
                                        const first = parseISO(`${m.key}-01`);
                                        const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
                                        const cells = [];
                                        for (let i = 0; i < getDay(first); i++) cells.push(null);
                                        for (let d = 0; d < daysInMonth; d++) {
                                            const iso = format(addDays(first, d), 'yyyy-MM-dd');
                                            cells.push({ iso, day: d + 1, data: byDate[iso] || null });
                                        }
                                        return (
                                            <div key={m.key}>
                                                <h4 className="font-semibold mb-2">{m.label}</h4>
                                                <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
                                                    {WEEKDAYS.map((d) => <div key={d} className="text-center">{d}</div>)}
                                                </div>
                                                <div className="grid grid-cols-7 gap-1">
                                                    {cells.map((c, i) => {
                                                        if (!c) return <div key={`pad-${i}`} />;
                                                        const r = c.data;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={c.iso}
                                                                disabled={!r}
                                                                onClick={() => setSelectedDay(c.iso === selectedDay ? null : c.iso)}
                                                                className={cn(
                                                                    'rounded-md border p-1.5 min-h-[88px] text-[11px] leading-tight text-left',
                                                                    r ? 'bg-card hover:border-primary cursor-pointer' : 'bg-muted/20 text-muted-foreground/50 cursor-default',
                                                                    c.iso === selectedDay && 'border-primary ring-1 ring-primary bg-primary/5',
                                                                )}
                                                            >
                                                                <div className="font-semibold text-xs mb-1 flex items-center justify-between">
                                                                    <span>{c.day}</span>
                                                                    {notesOf(c.iso).length > 0 && <StickyNote className="h-3.5 w-3.5 text-yellow-600" aria-label="Has a note" />}
                                                                </div>
                                                                {r && (
                                                                    <div className="space-y-0.5">
                                                                        <div title="Stalls used">🐴 {r.stalls} stalls</div>
                                                                        <div title="RV spots used">🚐 {r.rvs} RV</div>
                                                                        <div title="Horses on grounds" className="font-semibold">🐎 {r.horses} horses</div>
                                                                        {r.shavingsBags > 0 && <div title="Shavings pre-delivery due" className="text-amber-600 dark:text-amber-400">🛍 {r.shavingsBags} bags (pre)</div>}
                                                                        {r.hayBales > 0 && <div title="Hay pre-delivery due" className="text-amber-600 dark:text-amber-400">🌾 {r.hayBales} bales (pre)</div>}
                                                                        {r.deliveredBags > 0 && <div title="Shavings delivered" className="text-blue-600 dark:text-blue-400">🚚 {r.deliveredBags} bags (del)</div>}
                                                                        {r.deliveredBales > 0 && <div title="Hay delivered" className="text-blue-600 dark:text-blue-400">🚚 {r.deliveredBales} bales (del)</div>}
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {selectedRow && (
                            <DayPanel key={selectedRow.date} row={selectedRow} cal={cal} barnIds={barnIds} rvIds={rvIds} notes={notesOf(selectedRow.date)} onUpdateDayNote={onUpdateDayNote} onClose={() => setSelectedDay(null)} />
                        )}
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
