import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO, getDay, addDays } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    DollarSign, ShoppingCart, CreditCard, Clock, CalendarDays, List as ListIcon, Printer, X, Download,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildFinancialCalendar, ORDER_KINDS } from '@/lib/financialCalendar';
import { ensureAllRvSpots } from '@/lib/rvAssignment';
import { toCsv, downloadCsv } from '@/lib/calendarViews';
import { LocationPicker } from './HousingCalendarPanel';
import SavedViewsMenu from './SavedViewsMenu';

// Orders & Financial calendar (Robert 2026-11-16): orders, sales, payments collected and
// outstanding for each day. Read-only; it only reads bookings.

const fmtDay = (iso, pattern) => {
    try { return format(parseISO(iso), pattern); } catch { return iso; }
};
const money = (n) => {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
const UNIT_WORD = { stall: ['stall', 'stalls'], rv: ['RV spot', 'RV spots'] };
const unitText = (k, n) => (UNIT_WORD[k] && n > 0 ? `${n} ${UNIT_WORD[k][n === 1 ? 0 : 1]}` : '');
const pctOf = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND_LABEL = Object.fromEntries(ORDER_KINDS.map((k) => [k.id, k.label]));
const KIND_TEXT = { supply: 'text-violet-700 dark:text-violet-400', atshow: 'text-amber-700 dark:text-amber-400' };
const KIND_BAR = { stall: 'bg-blue-500', rv: 'bg-green-500', supply: 'bg-violet-500', atshow: 'bg-amber-500' };

const Select = ({ label, value, onChange, options }) => (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
        >
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    </label>
);

const Tile = ({ icon: Icon, label, value, sub, tone }) => (
    <div className={cn('rounded-xl border p-4', tone)}>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
            <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
);

function DayPanel({ row, onClose }) {
    const [tab, setTab] = useState('overview');
    const kinds = ORDER_KINDS.filter((k) => row.byKind[k.id]);
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
                {[['overview', 'Overview'], ['orders', 'Orders'], ['payments', 'Payments']].map(([id, label]) => (
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
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="rounded-lg border p-2"><p className="text-lg font-bold">{row.orders}</p><p className="text-[11px] text-muted-foreground">Orders</p></div>
                            <div className="rounded-lg border p-2"><p className="text-lg font-bold text-green-700 dark:text-green-400">{money(row.sales)}</p><p className="text-[11px] text-muted-foreground">Sales</p></div>
                            <div className="rounded-lg border p-2"><p className="text-lg font-bold">{money(row.paid)}</p><p className="text-[11px] text-muted-foreground">Collected</p></div>
                            <div className="rounded-lg border p-2"><p className={cn('text-lg font-bold', row.outstanding > 0 && 'text-amber-600')}>{money(row.outstanding)}</p><p className="text-[11px] text-muted-foreground">Outstanding</p></div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold mb-1">Orders by type</p>
                            <div className="divide-y">
                                {kinds.length === 0 && <p className="text-sm text-muted-foreground">No orders this day.</p>}
                                {kinds.map((k) => (
                                    <div key={k.id} className="flex items-center justify-between py-1.5 text-sm">
                                        <span>{k.label}</span>
                                        <span className="tabular-nums"><span className="text-muted-foreground mr-3">{row.byKind[k.id].orders}{unitText(k.id, row.byKind[k.id].units) ? ` · ${unitText(k.id, row.byKind[k.id].units)}` : ''}</span><span className="font-semibold">{money(row.byKind[k.id].sales)}</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {['stall', 'rv'].filter((k) => row.byKind[k]?.units > 0).map((k) => (
                            <div key={k}>
                                <p className="text-xs font-semibold mb-1">{k === 'stall' ? 'Stalls' : 'RV spots'} ordered this day</p>
                                <div className="divide-y">
                                    {row.list.filter((o) => o.units?.[k] > 0).map((o) => (
                                        <div key={o.id} className="flex items-center justify-between py-1.5 text-sm">
                                            <span className="text-muted-foreground truncate">{o.name}</span>
                                            <span className="font-semibold tabular-nums">{o.units[k]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {row.products.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold mb-1">Supplies ordered this day</p>
                                <div className="divide-y">
                                    {row.products.map((p) => (
                                        <div key={`${p.kind}-${p.name}`} className="flex items-center justify-between py-1.5 text-sm">
                                            <span className="text-muted-foreground">{p.name}<span className={cn('text-[11px] ml-1.5', KIND_TEXT[p.kind])}>{p.kind === 'atshow' ? 'At-show' : 'Pre-order'}</span></span>
                                            <span className="font-semibold tabular-nums">{p.qty}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
                {tab === 'orders' && (
                    row.list.length === 0 ? <p className="text-sm text-muted-foreground">No orders this day.</p> : (
                        <div className="divide-y">
                            {row.list.map((o) => (
                                <div key={o.id} className="py-2 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium truncate">{o.name}</span>
                                        <span className="font-semibold tabular-nums">{money(o.sales)}</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">{o.kinds.map((k) => KIND_LABEL[k]).join(', ')}{['stall', 'rv'].filter((k) => o.units?.[k] > 0).map((k) => ` · ${unitText(k, o.units[k])}`).join('')}</p>
                                    {o.lines.length > 0 && <p className="text-[11px]">{o.lines.map((l) => `${l.qty} ${l.name}`).join(' · ')}</p>}
                                </div>
                            ))}
                        </div>
                    )
                )}
                {tab === 'payments' && (
                    row.list.length === 0 ? <p className="text-sm text-muted-foreground">No payments this day.</p> : (
                        <div className="divide-y">
                            {line('Collected', money(row.paid), 'text-green-700 dark:text-green-400')}
                            {line('Outstanding', money(row.outstanding), row.outstanding > 0 ? 'text-amber-600' : '')}
                            {row.list.map((o) => (
                                <div key={o.id} className="flex items-center justify-between py-1.5 text-sm">
                                    <span className="truncate">{o.name}</span>
                                    <span className={cn('text-xs font-medium', o.outstanding > 0.005 ? 'text-amber-600' : 'text-green-700 dark:text-green-400')}>
                                        {o.outstanding > 0.005 ? `${money(o.outstanding)} due` : 'Paid'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default function HousingFinancialCalendar({ bookings, startDate, endDate, showName, barns = [], rvAreas = [], extraStallFees = [], showId }) {
    const [view, setView] = useState('month');
    const [hideEmpty, setHideEmpty] = useState(true);
    const [barnIds, setBarnIds] = useState([]);
    const [rvIds, setRvIds] = useState([]);
    const [kind, setKind] = useState('all');
    const [pay, setPay] = useState('all');
    const [selectedDay, setSelectedDay] = useState(null);
    // Fold / unfold a month (Robert 2026-11-18: "have these open and close").
    const [folded, setFolded] = useState([]);
    const toggleMonth = (key) => {
        setFolded((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));
        setSelectedDay((d) => (d && d.startsWith(key) ? null : d));
    };
    // Floating day panel (Robert 2026-11-18): opens right next to the clicked day, no scrolling.
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
        // Make sure the popup is fully on screen when it opens.
        panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        return () => document.removeEventListener('keydown', onKey);
    }, [selectedDay]);

    const rvFull = useMemo(() => ensureAllRvSpots(rvAreas), [rvAreas]);
    const cal = useMemo(
        () => buildFinancialCalendar({ bookings, barns, rvAreas: rvFull, extraStallFees, barnIds, rvIds, kind, pay, startDate, endDate }),
        [bookings, barns, rvFull, extraStallFees, barnIds, rvIds, kind, pay, startDate, endDate],
    );
    const { rows, totals, locations } = cal;

    const shownRows = useMemo(() => (hideEmpty ? rows.filter((r) => r.orders > 0) : rows), [rows, hideEmpty]);
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
    // Whole-show supply totals by product (all days, same filters as the rest of the page).
    const productTotals = useMemo(() => {
        const out = { supply: [], atshow: [] };
        for (const r of rows) {
            for (const p of r.products) {
                const list = out[p.kind] || (out[p.kind] = []);
                const hit = list.find((x) => x.name === p.name);
                if (hit) hit.qty += p.qty; else list.push({ name: p.name, qty: p.qty });
            }
        }
        out.supply.sort((a, b) => b.qty - a.qty);
        out.atshow.sort((a, b) => b.qty - a.qty);
        return out;
    }, [rows]);
    const picked = barnIds.length + rvIds.length;
    const filtered = picked > 0 || kind !== 'all' || pay !== 'all';
    // CSV of what is on screen: same filters, same days.
    const exportCsv = () => {
        const names = (list, ids) => list.filter((x) => ids.includes(x.id)).map((x) => x.name).join(' + ');
        const where = picked ? [names(locations.barns, barnIds), names(locations.rvAreas, rvIds)].filter(Boolean).join(' + ') : 'Entire facility';
        const typeLabel = kind === 'all' ? 'All orders' : KIND_LABEL[kind];
        const payLabel = { all: 'All payments', paid: 'Paid in full', unpaid: 'Balance due' }[pay];
        // Products ordered that day, by kind: "2 Hay (Grass) | 40 Shavings".
        const productsText = (r, k) => r.products.filter((p) => p.kind === k).map((p) => `${p.qty} ${p.name}`).join(' | ');
        const body = shownRows.map((r) => [r.date, r.orders, r.sales, r.paid, r.outstanding, productsText(r, 'supply'), productsText(r, 'atshow')]);
        const csv = toCsv(['Day', 'Orders', 'Sales', 'Collected', 'Outstanding', 'Pre-order supplies', 'At-show supplies'], body);
        downloadCsv(
            `orders-financial-calendar-${format(new Date(), 'yyyy-MM-dd')}.csv`,
            `${toCsv([`Location: ${where} | ${typeLabel} | ${payLabel}`], [])}\r\n${csv}`,
        );
    };
    const maxKind =Math.max(...ORDER_KINDS.map((k) => totals.byKind[k.id]?.sales || 0), 1);

    return (
        <div className="space-y-4 housing-calendar">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-[260px] flex-1">
                            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Orders &amp; Financial Calendar</CardTitle>
                            <CardDescription>
                                Orders, sales and payments by the day the order was placed{showName ? ` — ${showName}` : ''}.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
                                <Button size="sm" variant={view === 'table' ? 'default' : 'ghost'} className="h-8 text-xs" onClick={() => setView('table')}>
                                    <ListIcon className="h-3.5 w-3.5 mr-1.5" /> Day by day
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
                        <LocationPicker barns={locations.barns} rvAreas={locations.rvAreas} barnIds={barnIds} rvIds={rvIds} onBarns={setBarnIds} onRv={setRvIds} />
                        <Select label="Order type" value={kind} onChange={setKind}
                            options={[['all', 'All orders'], ...ORDER_KINDS.map((k) => [k.id, k.label])]} />
                        <Select label="Payment" value={pay} onChange={setPay}
                            options={[['all', 'All payments'], ['paid', 'Paid in full'], ['unpaid', 'Balance due']]} />
                        <SavedViewsMenu
                            showId={showId}
                            calendar="financial"
                            getState={() => ({ barnIds, rvIds, kind, pay, view, hideEmpty })}
                            onApply={(s) => {
                                setBarnIds((s.barnIds || []).filter((id) => locations.barns.some((b) => b.id === id)));
                                setRvIds((s.rvIds || []).filter((id) => locations.rvAreas.some((a) => a.id === id)));
                                setKind(ORDER_KINDS.some((k) => k.id === s.kind) ? s.kind : 'all');
                                setPay(['paid', 'unpaid'].includes(s.pay) ? s.pay : 'all');
                                if (s.view) setView(s.view);
                                if (typeof s.hideEmpty === 'boolean') setHideEmpty(s.hideEmpty);
                                setSelectedDay(null);
                            }}
                        />
                        {filtered && (
                            <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => { setBarnIds([]); setRvIds([]); setKind('all'); setPay('all'); }}>
                                <X className="h-3.5 w-3.5 mr-1" /> Reset
                            </Button>
                        )}
                        <span className="text-xs text-muted-foreground">Every number below follows these filters.</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Tile icon={ShoppingCart} label="Total orders" value={totals.orders}
                            sub={ORDER_KINDS.filter((k) => totals.byKind[k.id]).map((k) => `${KIND_LABEL[k.id].replace(' orders', '')}: ${totals.byKind[k.id].orders}${unitText(k.id, totals.byKind[k.id].units) ? ` (${unitText(k.id, totals.byKind[k.id].units)})` : ''}`).join(' · ') || 'No orders'}
                            tone="bg-blue-50/60 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900" />
                        <Tile icon={DollarSign} label="Total sales" value={money(totals.sales)} sub="live prices, before fees"
                            tone="bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-900" />
                        <Tile icon={CreditCard} label="Payments collected" value={money(totals.paid)} sub={`${pctOf(totals.paid, totals.sales)} of sales`}
                            tone="bg-violet-50/60 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900" />
                        <Tile icon={Clock} label="Outstanding" value={money(totals.outstanding)} sub={`${pctOf(totals.outstanding, totals.sales)} of sales`}
                            tone="bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900" />
                    </div>

                    <div className="rounded-lg border p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Sales by category</p>
                        <div className="space-y-1.5">
                            {ORDER_KINDS.map((k) => {
                                const v = totals.byKind[k.id]?.sales || 0;
                                return (
                                    <div key={k.id} className="flex items-center gap-3 text-sm">
                                        <span className="w-36 shrink-0">{k.label.replace(' orders', '')}</span>
                                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                                            <div className={cn('h-full rounded-full', KIND_BAR[k.id])} style={{ width: `${(v / maxKind) * 100}%` }} />
                                        </div>
                                        <span className="w-24 text-right font-semibold tabular-nums">{money(v)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {(productTotals.supply.length > 0 || productTotals.atshow.length > 0) && (
                        <div className="rounded-lg border p-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Supplies by product (whole show)</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {[['supply', 'Pre-order supplies'], ['atshow', 'At-show supplies']].map(([k, label]) => (
                                    <div key={k}>
                                        <p className="text-xs font-medium mb-1">{label}</p>
                                        {productTotals[k].length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                                            <table className="w-full text-sm">
                                                <tbody className="divide-y">
                                                    {productTotals[k].map((p) => (
                                                        <tr key={p.name}>
                                                            <td className="py-1">{p.name}</td>
                                                            <td className="py-1 text-right font-semibold tabular-nums">{p.qty}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div ref={wrapRef} className="relative">
                        <div className="min-w-0">
                            {view === 'table' ? (
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                            <tr>
                                                <th className="text-left px-3 py-2 font-medium">Day</th>
                                                <th className="text-right px-3 py-2 font-medium">Orders</th>
                                                <th className="text-right px-3 py-2 font-medium">Sales</th>
                                                <th className="text-right px-3 py-2 font-medium">Collected</th>
                                                <th className="text-right px-3 py-2 font-medium">Outstanding</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shownRows.length === 0 && (
                                                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No orders match these filters.</td></tr>
                                            )}
                                            {shownRows.map((r) => (
                                                <tr
                                                    key={r.date}
                                                    onClick={(e) => pickDay(r.date, e)}
                                                    className={cn('border-t cursor-pointer hover:bg-muted/30', r.date === selectedDay && 'bg-primary/10')}
                                                >
                                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{fmtDay(r.date, 'EEE, MMM d')}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{r.orders || <span className="text-muted-foreground/50">–</span>}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-700 dark:text-green-400">{r.orders ? money(r.sales) : '–'}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{r.orders ? money(r.paid) : '–'}</td>
                                                    <td className={cn('px-3 py-2 text-right tabular-nums', r.outstanding > 0 && 'text-amber-600')}>{r.orders ? money(r.outstanding) : '–'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="border-t bg-muted/30 text-xs">
                                            <tr>
                                                <td className="px-3 py-2 font-semibold">Total</td>
                                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{totals.orders}</td>
                                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(totals.sales)}</td>
                                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(totals.paid)}</td>
                                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(totals.outstanding)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {months.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No orders match these filters.</p>}
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
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={c.iso}
                                                                disabled={!r}
                                                                onClick={(e) => pickDay(c.iso, e)}
                                                                className={cn(
                                                                    'rounded-md border p-1.5 min-h-[72px] text-[11px] leading-tight text-left',
                                                                    r ? 'bg-card hover:border-primary cursor-pointer' : 'bg-muted/20 text-muted-foreground/50 cursor-default',
                                                                    c.iso === selectedDay && 'border-primary ring-1 ring-primary bg-primary/5',
                                                                )}
                                                            >
                                                                <div className="font-semibold text-xs mb-1">{c.day}</div>
                                                                {r && (
                                                                    <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                                                                        <div>🛒 {r.orders} order{r.orders === 1 ? '' : 's'}</div>
                                                                        {['stall', 'rv'].filter((k) => r.byKind[k]?.units > 0).map((k) => (
                                                                            <div key={k} className="font-medium">{k === 'stall' ? '🐴' : '🚐'} {unitText(k, r.byKind[k].units)}</div>
                                                                        ))}
                                                                        <div className="font-semibold text-green-700 dark:text-green-400">{money(r.sales)}</div>
                                                                        {r.products.map((p) => (
                                                                            <div key={`${p.kind}-${p.name}`} className={KIND_TEXT[p.kind]}>
                                                                                {p.qty} {p.name}
                                                                                <span className="block text-[10px] opacity-80">{p.kind === 'atshow' ? 'At-show' : 'Pre-order'}</span>
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
                                    <DayPanel key={selectedRow.date} row={selectedRow} onClose={() => setSelectedDay(null)} />
                                </div>
                            );
                        })()}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        A sale counts on the day the order was placed. Amounts use today's live prices (the same as the invoice), before card
                        fees. Collected is what is recorded as paid. Cancelled orders are not included. With barns or lots picked, only the part of
                        an order placed in them is counted.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
