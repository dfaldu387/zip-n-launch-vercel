import React, { useMemo, useState } from 'react';
import { format, parseISO, getDay, addDays } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, List as ListIcon, PawPrint, Warehouse, Car, Package, Printer, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildHousingCalendar } from '@/lib/housingCalendar';

// Robert 2026-11-15: "an overall understanding of how many bags of shavings are
// pre-delivered, how many bales of hay, how many stalls and RV spots are being
// used each day, how many total horses are on the grounds."
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

export default function HousingCalendarPanel({ bookings, supplies, startDate, endDate, showName }) {
    const [view, setView] = useState('table');
    const [hideEmpty, setHideEmpty] = useState(false);

    const cal = useMemo(
        () => buildHousingCalendar({ bookings, supplies, startDate, endDate }),
        [bookings, supplies, startDate, endDate],
    );
    const { rows, totals, peaks, missingHorseCount } = cal;

    // A day is "empty" when nothing is booked or delivered on it.
    const isActive = (r) => r.bookings > 0 || r.stalls > 0 || r.rvs > 0 || r.horses > 0 || r.shavingsBags > 0 || r.hayBales > 0;
    const shownRows = useMemo(() => (hideEmpty ? rows.filter(isActive) : rows), [rows, hideEmpty]);

    // Month grid: pad the front so day 1 lands under the right weekday, one grid per month.
    // With "Hide empty days" on, a month with nothing in it is left out entirely.
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

    if (rows.length === 0) {
        return (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
                📭 Nothing to show yet — set the move-in / move-out dates or add a booking and the calendar fills in.
            </div>
        );
    }

    return (
        <div className="space-y-4 housing-calendar">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Calendar</CardTitle>
                            <CardDescription>
                                What is on the grounds each day{showName ? ` — ${showName}` : ''}. Updates live as bookings come in.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 print:hidden">
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
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>
                                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <Tile icon={Warehouse} label="Most stalls in a day" value={peaks.stalls.value}
                            sub={peaks.stalls.value ? fmtDay(peaks.stalls.date, 'EEE, MMM d') : 'No stalls booked'}
                            tone="bg-blue-50/60 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900" />
                        <Tile icon={Car} label="Most RV spots in a day" value={peaks.rvs.value}
                            sub={peaks.rvs.value ? fmtDay(peaks.rvs.date, 'EEE, MMM d') : 'No RV spots booked'}
                            tone="bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900" />
                        <Tile icon={PawPrint} label="Most horses on grounds" value={peaks.horses.value}
                            sub={peaks.horses.value ? fmtDay(peaks.horses.date, 'EEE, MMM d') : 'No horse counts yet'}
                            tone="bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" />
                        <Tile icon={Package} label="Shavings pre-delivered" value={totals.shavingsBags} sub="bags, before the show"
                            tone="bg-violet-50/60 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900" />
                        <Tile icon={Package} label="Hay pre-delivered" value={totals.hayBales} sub="bales, before the show"
                            tone="bg-rose-50/60 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900" />
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

                    {view === 'table' ? (
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="text-left px-3 py-2 font-medium">Day</th>
                                        <th className="text-right px-3 py-2 font-medium">Bookings</th>
                                        <th className="text-right px-3 py-2 font-medium">Stalls used</th>
                                        <th className="text-right px-3 py-2 font-medium">RV spots used</th>
                                        <th className="text-right px-3 py-2 font-medium">Horses on grounds</th>
                                        <th className="text-right px-3 py-2 font-medium">Shavings (bags)</th>
                                        <th className="text-right px-3 py-2 font-medium">Hay (bales)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shownRows.length === 0 && (
                                        <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No days with bookings yet.</td></tr>
                                    )}
                                    {shownRows.map((r) => (
                                        <tr key={r.date} className="border-t hover:bg-muted/30">
                                            <td className="px-3 py-2 font-medium whitespace-nowrap">{fmtDay(r.date, 'EEE, MMM d')}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{num(r.bookings)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{num(r.stalls)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{num(r.rvs)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-semibold">{num(r.horses)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{num(r.shavingsBags)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{num(r.hayBales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t bg-muted/30 text-xs">
                                    <tr>
                                        <td className="px-3 py-2 font-semibold" colSpan={5}>Total pre-delivered</td>
                                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{totals.shavingsBags}</td>
                                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{totals.hayBales}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="space-y-6">
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
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="text-center">{d}</div>)}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {cells.map((c, i) => {
                                                if (!c) return <div key={`pad-${i}`} />;
                                                const r = c.data;
                                                return (
                                                    <div key={c.iso} className={cn(
                                                        'rounded-md border p-1.5 min-h-[88px] text-[11px] leading-tight',
                                                        r ? 'bg-card' : 'bg-muted/20 text-muted-foreground/50',
                                                    )}>
                                                        <div className="font-semibold text-xs mb-1">{c.day}</div>
                                                        {r && (
                                                            <div className="space-y-0.5">
                                                                <div title="Stalls used">🐴 {r.stalls} stalls</div>
                                                                <div title="RV spots used">🚐 {r.rvs} RV</div>
                                                                <div title="Horses on grounds" className="font-semibold">🐎 {r.horses} horses</div>
                                                                {r.shavingsBags > 0 && <div title="Shavings pre-delivered" className="text-violet-600 dark:text-violet-400">🛍 {r.shavingsBags} bags</div>}
                                                                {r.hayBales > 0 && <div title="Hay pre-delivered" className="text-rose-600 dark:text-rose-400">🌾 {r.hayBales} bales</div>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        A booking counts from its arrival day through its departure day. Nightly-fee stalls count only on the nights picked.
                        Pre-delivered hay and shavings are shown on the arrival day. Cancelled bookings and at-show orders are not included.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
