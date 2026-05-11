import React, { useMemo } from 'react';
import {
    PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
    DollarSign, TrendingUp, PieChart as PieIcon, Activity, Home, Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const money = (n) => `$${(Number(n) || 0).toLocaleString()}`;

// ───── Palettes ─────

const REVENUE_PALETTE = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b'];

const STATUS_META = {
    pending:     { color: '#f59e0b', label: 'Pending' },
    confirmed:   { color: '#3b82f6', label: 'Confirmed' },
    checked_in:  { color: '#10b981', label: 'Checked In' },
    checked_out: { color: '#64748b', label: 'Checked Out' },
    cancelled:   { color: '#ef4444', label: 'Cancelled' },
};

const tooltipContentStyle = {
    background: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
    padding: '8px 12px',
};

const EmptyChart = ({ message, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center h-[260px] text-sm text-muted-foreground gap-2">
        {Icon && <Icon className="h-8 w-8 opacity-30" />}
        <p className="italic">{message}</p>
    </div>
);

// ───── Custom donut with center label ─────

const CenterLabelDonut = ({ data, palette, centerLabel, centerValue, height = 260 }) => (
    <ResponsiveContainer width="100%" height={height}>
        <PieChart>
            <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={3}
                stroke="none"
            >
                {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color || palette[i % palette.length]} />
                ))}
                <text x="50%" y="46%" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="500" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {centerLabel}
                </text>
                <text x="50%" y="58%" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="22" fontWeight="700">
                    {centerValue}
                </text>
            </Pie>
            <Tooltip
                formatter={(v) => money(v)}
                contentStyle={tooltipContentStyle}
            />
        </PieChart>
    </ResponsiveContainer>
);

// ───── 1. Revenue by Source — Donut + breakdown ─────

const RevenueChart = ({ analytics }) => {
    const data = useMemo(() => {
        const r = analytics?.revenue || {};
        return [
            { name: 'Stalls',   value: r.byStalls   || 0, color: REVENUE_PALETTE[0] },
            { name: 'RV',       value: r.byRv       || 0, color: REVENUE_PALETTE[1] },
            { name: 'Support',  value: r.bySupport  || 0, color: REVENUE_PALETTE[2] },
            { name: 'Supplies', value: r.bySupplies || 0, color: REVENUE_PALETTE[3] },
        ].filter(d => d.value > 0);
    }, [analytics]);

    const total = data.reduce((s, d) => s + d.value, 0);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" /> Revenue by Source
                </CardTitle>
                <CardDescription className="text-xs">Realized revenue across stalls, RV, support, and supplies.</CardDescription>
            </CardHeader>
            <CardContent>
                {total === 0 ? (
                    <EmptyChart message="No revenue yet — book some stalls to see this." icon={DollarSign} />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <CenterLabelDonut
                            data={data}
                            palette={REVENUE_PALETTE}
                            centerLabel="Total"
                            centerValue={money(total)}
                        />
                        <div className="space-y-2.5">
                            {data.map((d, i) => {
                                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                return (
                                    <div key={d.name} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                                                <span className="font-medium">{d.name}</span>
                                            </div>
                                            <span className="tabular-nums font-semibold">{money(d.value)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ background: d.color, width: `${pct}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground text-right">{pct}%</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ───── 2. Demand by Area — Ranked progress list (not bar chart) ─────

const DemandChart = ({ analytics }) => {
    const data = useMemo(
        () => (analytics?.demandList || []).map(d => ({ name: d.name, value: d.count, type: d.type })),
        [analytics]
    );
    const max = Math.max(1, ...data.map(d => d.value));

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" /> Demand by Area
                </CardTitle>
                <CardDescription className="text-xs">Most-requested barns and RV areas across all bookings.</CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyChart message="No bookings reference any specific area yet." icon={TrendingUp} />
                ) : (
                    <div className="space-y-3 py-2">
                        {data.map((d, i) => {
                            const pct = (d.value / max) * 100;
                            const Icon = d.type === 'rv' ? Car : Home;
                            const rank = i + 1;
                            const isTop = rank === 1;
                            return (
                                <div key={d.name + i} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={cn(
                                                'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0',
                                                isTop ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                                            )}>
                                                {rank}
                                            </span>
                                            <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', d.type === 'rv' ? 'text-cyan-600' : 'text-primary')} />
                                            <span className="font-medium truncate" title={d.name}>{d.name}</span>
                                        </div>
                                        <span className="tabular-nums text-xs text-muted-foreground flex-shrink-0">
                                            <span className="font-bold text-foreground">{d.value}</span> booking{d.value !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={cn('h-full rounded-full transition-all', isTop ? 'bg-amber-500' : 'bg-purple-500')}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ───── 3. Booking Status — Donut with center total + side legend ─────

const StatusChart = ({ bookings }) => {
    const data = useMemo(() => {
        const counts = {};
        for (const b of bookings || []) {
            const s = b.status || 'pending';
            counts[s] = (counts[s] || 0) + 1;
        }
        return Object.entries(counts)
            .map(([status, count]) => ({
                name: STATUS_META[status]?.label || status,
                value: count,
                status,
                color: STATUS_META[status]?.color || '#94a3b8',
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [bookings]);

    const total = data.reduce((s, d) => s + d.value, 0);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <PieIcon className="h-4 w-4 text-blue-600" /> Booking Status
                </CardTitle>
                <CardDescription className="text-xs">Distribution of bookings across statuses.</CardDescription>
            </CardHeader>
            <CardContent>
                {total === 0 ? (
                    <EmptyChart message="No bookings yet." icon={PieIcon} />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <CenterLabelDonut
                            data={data}
                            palette={Object.values(STATUS_META).map(m => m.color)}
                            centerLabel="Bookings"
                            centerValue={total}
                        />
                        <div className="space-y-2">
                            {data.map(d => {
                                const pct = Math.round((d.value / total) * 100);
                                return (
                                    <div key={d.status} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                            <span className="font-medium truncate">{d.name}</span>
                                        </div>
                                        <div className="flex items-baseline gap-2 tabular-nums flex-shrink-0">
                                            <span className="font-bold">{d.value}</span>
                                            <span className="text-[10px] text-muted-foreground">{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ───── 4. Bookings Over Time — Polished area chart ─────

const TimelineChart = ({ bookings }) => {
    const data = useMemo(() => {
        const valid = (bookings || [])
            .map(b => b.createdAt)
            .filter(Boolean)
            .map(d => {
                try { return startOfDay(parseISO(d)); } catch { return null; }
            })
            .filter(Boolean)
            .sort((a, b) => a - b);

        if (valid.length === 0) return [];

        const byDay = new Map();
        for (const d of valid) {
            const key = format(d, 'yyyy-MM-dd');
            byDay.set(key, (byDay.get(key) || 0) + 1);
        }

        const first = valid[0];
        const last = valid[valid.length - 1];
        const days = eachDayOfInterval({ start: first, end: last });

        let cumulative = 0;
        return days.map(d => {
            const key = format(d, 'yyyy-MM-dd');
            const count = byDay.get(key) || 0;
            cumulative += count;
            return {
                date: format(d, 'MMM d'),
                'New today': count,
                'Total bookings': cumulative,
            };
        });
    }, [bookings]);

    const totalBookings = data.length > 0 ? data[data.length - 1]['Total bookings'] : 0;

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="h-4 w-4 text-cyan-600" /> Bookings Over Time
                        </CardTitle>
                        <CardDescription className="text-xs">Daily new bookings and cumulative total.</CardDescription>
                    </div>
                    {totalBookings > 0 && (
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Total</p>
                            <p className="text-2xl font-bold tabular-nums text-cyan-600">{totalBookings}</p>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <EmptyChart message="Bookings with timestamps will appear here." icon={Activity} />
                ) : (
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={data} margin={{ left: 0, right: 16, top: 8 }}>
                            <defs>
                                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                            />
                            <Tooltip contentStyle={tooltipContentStyle} />
                            <Area
                                type="monotone"
                                dataKey="Total bookings"
                                stroke="#06b6d4"
                                strokeWidth={2.5}
                                fill="url(#cumGrad)"
                            />
                            <Area
                                type="monotone"
                                dataKey="New today"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                fill="url(#dailyGrad)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
};

// ───── Top-level layout ─────

const AnalyticsCharts = ({ analytics, bookings }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart analytics={analytics} />
        <DemandChart analytics={analytics} />
        <StatusChart bookings={bookings} />
        <TimelineChart bookings={bookings} />
    </div>
);

export default AnalyticsCharts;
