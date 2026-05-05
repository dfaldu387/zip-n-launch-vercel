import React, { useMemo, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useShowBuilder } from '@/hooks/useShowBuilder';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Loader2, DollarSign, TrendingUp, TrendingDown, Target,
    Users, Hash, BarChart3, Banknote, PiggyBank, AlertTriangle,
    HeartHandshake, Receipt, Trophy, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { calculateProjections, DEFAULT_ASSUMPTIONS } from '@/lib/showFinancialProjections';

// ── Stat Card ──

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) => {
    const colors = {
        blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
        green: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
        red: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
        amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
        purple: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
    };
    const iconColors = {
        blue: 'text-blue-600 dark:text-blue-400',
        green: 'text-emerald-600 dark:text-emerald-400',
        red: 'text-red-600 dark:text-red-400',
        amber: 'text-amber-600 dark:text-amber-400',
        purple: 'text-purple-600 dark:text-purple-400',
    };
    const valueColors = {
        blue: 'text-blue-700 dark:text-blue-300',
        green: 'text-emerald-700 dark:text-emerald-300',
        red: 'text-red-700 dark:text-red-300',
        amber: 'text-amber-700 dark:text-amber-300',
        purple: 'text-purple-700 dark:text-purple-300',
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={cn('rounded-xl border p-5', colors[color])}>
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className={cn('text-2xl font-bold mt-1', valueColors[color])}>{value}</p>
                        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
                    </div>
                    <div className={cn('p-2 rounded-lg bg-white/60 dark:bg-white/5', iconColors[color])}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
                {trend !== undefined && (
                    <div className="flex items-center gap-1 mt-3 text-xs">
                        {trend > 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> :
                         trend < 0 ? <ArrowDownRight className="h-3.5 w-3.5 text-red-500" /> :
                         <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={cn(
                            trend > 0 && 'text-emerald-600',
                            trend < 0 && 'text-red-600',
                            trend === 0 && 'text-muted-foreground'
                        )}>
                            {Math.abs(trend).toFixed(1)}% margin
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ── Progress Bar ──

const ProgressBar = ({ label, value, max, color = 'bg-blue-500', showAmount = true }) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                {showAmount && <span className="font-medium">${value.toLocaleString()}</span>}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// ── Scenario Card ──

const ScenarioCard = ({ label, data, isActive }) => {
    const profit = data.netProfit;
    return (
        <div className={cn(
            'border rounded-lg p-4 text-center transition-all',
            isActive && 'ring-2 ring-primary border-primary',
            profit >= 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : 'bg-red-50/50 dark:bg-red-950/10'
        )}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-lg font-bold mt-1">
                ${Math.abs(data.totalRevenue).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">revenue</p>
            <div className="border-t my-2" />
            <p className={cn('text-sm font-semibold', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {profit >= 0 ? '+' : '-'}${Math.abs(profit).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">net profit</p>
        </div>
    );
};

// ── Assumption Input ──

const AssumptionInput = ({ label, field, value, onChange, type = 'number', suffix }) => (
    <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <div className="relative">
            <Input
                type={type}
                value={value}
                onChange={(e) => onChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                className="h-8 text-sm pr-8"
            />
            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
        </div>
    </div>
);

// ── Main Page ──

const ShowFinancialDashboardPage = () => {
    const { showId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { formData, isLoading } = useShowBuilder(showId);
    const [shows, setShows] = useState([]);
    const [showsLoading, setShowsLoading] = useState(!showId);
    const [selectedShowId, setSelectedShowId] = useState(showId || null);

    useEffect(() => {
        if (showId) return;
        const fetchShows = async () => {
            if (!user) { setShowsLoading(false); return; }
            const { data } = await supabase
                .from('projects')
                .select('id, project_name, project_type, project_data, status')
                .eq('project_type', 'show')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (data) setShows(data);
            setShowsLoading(false);
        };
        fetchShows();
    }, [user, showId]);

    const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);

    const updateAssumption = (field, value) => {
        setAssumptions(prev => ({ ...prev, [field]: value }));
    };

    const projections = useMemo(() => calculateProjections(formData, assumptions), [formData, assumptions]);

    const fmt = (n) => `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const fmtSigned = (n) => `${n >= 0 ? '' : '-'}${fmt(n)}`;

    if (isLoading || showsLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const hasShow = showId || selectedShowId;
    const { revenue, costs, profit, timing, scenarios, breakEven } = projections;
    const maxRevBar = Math.max(revenue?.fees?.total || 0, revenue?.sponsors?.projected || 0, 1);

    return (
        <>
            <Helmet>
                <title>Financial Projections — {formData.showName || 'Show'}</title>
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                    <PageHeader title="Financial Projections" backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'} />

                    {!showId && (
                        <div className="mb-6">
                            <LinkToExistingShow
                                existingProjects={shows}
                                linkedProjectId={selectedShowId}
                                onLink={(projectId) => {
                                    if (projectId === 'none') { setSelectedShowId(null); return; }
                                    navigate(`/horse-show-manager/financials/${projectId}`);
                                }}
                                description="Link to an existing show to view its financial projections."
                            />
                        </div>
                    )}

                    {hasShow && (<>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            title="Projected Revenue"
                            value={fmt(revenue.total)}
                            subtitle={`${(formData.fees || []).length} fee types + ${(formData.sponsors || []).length} sponsors`}
                            icon={TrendingUp}
                            color="green"
                        />
                        <StatCard
                            title="Projected Costs"
                            value={fmt(costs.totalWithContingency)}
                            subtitle={`Incl. ${(costs.contingencyRate * 100).toFixed(0)}% contingency (${fmt(costs.contingencyAmount)})`}
                            icon={TrendingDown}
                            color="red"
                        />
                        <StatCard
                            title="Net Profit"
                            value={fmtSigned(profit.net)}
                            icon={profit.net >= 0 ? PiggyBank : AlertTriangle}
                            color={profit.net >= 0 ? 'blue' : 'amber'}
                            trend={profit.margin}
                        />
                        <StatCard
                            title="Break-Even"
                            value={`${breakEven.horses} horses`}
                            subtitle={breakEven.surplus >= 0
                                ? `${breakEven.surplus} horse buffer above break-even`
                                : `Need ${Math.abs(breakEven.surplus)} more horses`}
                            icon={Target}
                            color={breakEven.surplus >= 0 ? 'purple' : 'amber'}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Left: Revenue + Costs detail */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Revenue Breakdown */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Banknote className="h-5 w-5 text-emerald-600" />
                                        Revenue Breakdown
                                    </CardTitle>
                                    <CardDescription>Projected income from fees and sponsorship</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Receipt className="h-4 w-4 text-emerald-600" />
                                                <span className="text-sm font-medium">Fee Revenue</span>
                                            </div>
                                            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(revenue.fees.total)}</p>
                                        </div>
                                        <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border">
                                            <div className="flex items-center gap-2 mb-1">
                                                <HeartHandshake className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm font-medium">Sponsor Revenue</span>
                                            </div>
                                            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{fmt(revenue.sponsors.projected)}</p>
                                            {revenue.sponsors.pledged !== revenue.sponsors.projected && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {fmt(revenue.sponsors.pledged)} pledged x {(assumptions.sponsorCollectionRate * 100).toFixed(0)}% collection
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Top fee items */}
                                    <Accordion type="single" collapsible>
                                        <AccordionItem value="fees">
                                            <AccordionTrigger className="text-sm font-medium">
                                                Fee Detail ({revenue.fees.breakdown.length} items)
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                    {revenue.fees.breakdown
                                                        .sort((a, b) => b.revenue - a.revenue)
                                                        .map(item => (
                                                            <div key={item.id} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                                                                <div>
                                                                    <p className="font-medium">{item.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                                                </div>
                                                                <span className="font-semibold text-emerald-600 whitespace-nowrap ml-4">{fmt(item.revenue)}</span>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>

                                    {/* Sponsor breakdown */}
                                    {revenue.sponsors.breakdown.length > 0 && (
                                        <Accordion type="single" collapsible>
                                            <AccordionItem value="sponsors">
                                                <AccordionTrigger className="text-sm font-medium">
                                                    Sponsor Detail ({(formData.sponsors || []).length} sponsors)
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-2">
                                                        {revenue.sponsors.breakdown.map(lvl => (
                                                            <div key={lvl.levelId} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                                                                <div>
                                                                    <p className="font-medium">{lvl.levelName}</p>
                                                                    <p className="text-xs text-muted-foreground">{lvl.sponsorCount} sponsor{lvl.sponsorCount !== 1 ? 's' : ''}</p>
                                                                </div>
                                                                <span className="font-semibold text-blue-600">{fmt(lvl.projected)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Cost Breakdown */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <TrendingDown className="h-5 w-5 text-red-600" />
                                        Cost Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border text-center">
                                            <p className="text-xs text-muted-foreground">Show Expenses</p>
                                            <p className="text-lg font-bold text-red-700 dark:text-red-300">{fmt(costs.expenses.total)}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border text-center">
                                            <p className="text-xs text-muted-foreground">Award Expenses</p>
                                            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(costs.awards.total)}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/10 border text-center">
                                            <p className="text-xs text-muted-foreground">Contingency</p>
                                            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{fmt(costs.contingencyAmount)}</p>
                                        </div>
                                    </div>

                                    {costs.expenses.breakdown.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">By Category</p>
                                            {costs.expenses.breakdown
                                                .sort((a, b) => b.total - a.total)
                                                .map(cat => (
                                                    <ProgressBar
                                                        key={cat.category}
                                                        label={`${cat.category} (${cat.itemCount} items)`}
                                                        value={cat.total}
                                                        max={costs.expenses.total}
                                                        color="bg-red-500"
                                                    />
                                                ))
                                            }
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Cash Flow Timing */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <DollarSign className="h-5 w-5 text-blue-600" />
                                        Cash Flow Timing
                                    </CardTitle>
                                    <CardDescription>When revenue arrives relative to the show</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {Object.entries(timing).map(([key, data]) => (
                                        <ProgressBar
                                            key={key}
                                            label={data.label}
                                            value={data.total}
                                            max={revenue.fees.total}
                                            color={
                                                key === 'pre_entry' ? 'bg-blue-500' :
                                                key === 'at_check_in' ? 'bg-amber-500' : 'bg-purple-500'
                                            }
                                        />
                                    ))}
                                </CardContent>
                            </Card>

                            {/* Profit/Loss Waterfall (text-based) */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Profit & Loss Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-sm">Fee Revenue</span>
                                            <span className="text-sm font-semibold text-emerald-600">{fmt(revenue.fees.total)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-sm">Sponsor Revenue (projected)</span>
                                            <span className="text-sm font-semibold text-emerald-600">{fmt(revenue.sponsors.projected)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b bg-emerald-50/50 dark:bg-emerald-950/10 px-3 rounded">
                                            <span className="text-sm font-bold">Total Revenue</span>
                                            <span className="text-sm font-bold text-emerald-700">{fmt(revenue.total)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-sm">Show Expenses</span>
                                            <span className="text-sm font-semibold text-red-600">-{fmt(costs.expenses.total)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-sm">Award Expenses</span>
                                            <span className="text-sm font-semibold text-red-600">-{fmt(costs.awards.total)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b">
                                            <span className="text-sm">Contingency ({(costs.contingencyRate * 100).toFixed(0)}%)</span>
                                            <span className="text-sm font-semibold text-red-600">-{fmt(costs.contingencyAmount)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-red-50/50 dark:bg-red-950/10 px-3 rounded">
                                            <span className="text-sm font-bold">Total Costs</span>
                                            <span className="text-sm font-bold text-red-700">-{fmt(costs.totalWithContingency)}</span>
                                        </div>
                                        <div className={cn(
                                            'flex justify-between py-3 px-3 rounded-lg mt-2',
                                            profit.net >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/30' : 'bg-red-100 dark:bg-red-950/30'
                                        )}>
                                            <span className="font-bold">Net Profit / Loss</span>
                                            <span className={cn('font-bold text-lg', profit.net >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                                                {fmtSigned(profit.net)}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Sidebar: Assumptions + Scenarios */}
                        <div className="space-y-6">

                            {/* Assumptions Panel */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Projection Assumptions
                                    </CardTitle>
                                    <CardDescription>Adjust inputs to see how projections change</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <AssumptionInput label="Expected Horses" field="expectedHorses" value={assumptions.expectedHorses} onChange={updateAssumption} />
                                    <AssumptionInput label="Avg Classes / Horse" field="avgClassesPerHorse" value={assumptions.avgClassesPerHorse} onChange={updateAssumption} />
                                    <AssumptionInput label="Available Stalls" field="expectedStalls" value={assumptions.expectedStalls} onChange={updateAssumption} />
                                    <AssumptionInput label="Stall Occupancy %" field="stallOccupancyRate" value={Math.round(assumptions.stallOccupancyRate * 100)} onChange={(f, v) => updateAssumption(f, v / 100)} suffix="%" />
                                    <AssumptionInput label="Haul-In %" field="haulInPercentage" value={Math.round(assumptions.haulInPercentage * 100)} onChange={(f, v) => updateAssumption(f, v / 100)} suffix="%" />
                                    <AssumptionInput label="RV Spots" field="rvSpots" value={assumptions.rvSpots} onChange={updateAssumption} />
                                    <AssumptionInput label="Show Days" field="showDays" value={assumptions.showDays} onChange={updateAssumption} />
                                    <AssumptionInput label="Number of Judges" field="judgeCount" value={assumptions.judgeCount} onChange={updateAssumption} />
                                    <AssumptionInput label="Sponsor Collection %" field="sponsorCollectionRate" value={Math.round(assumptions.sponsorCollectionRate * 100)} onChange={(f, v) => updateAssumption(f, v / 100)} suffix="%" />
                                    <AssumptionInput label="Expense Contingency %" field="expenseContingency" value={Math.round(assumptions.expenseContingency * 100)} onChange={(f, v) => updateAssumption(f, v / 100)} suffix="%" />

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2"
                                        onClick={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
                                    >
                                        Reset to Defaults
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Scenario Analysis */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Scenario Analysis</CardTitle>
                                    <CardDescription>Conservative / Expected / Optimistic</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-2">
                                        <ScenarioCard label="Conservative" data={scenarios.conservative} />
                                        <ScenarioCard label="Expected" data={scenarios.expected} isActive />
                                        <ScenarioCard label="Optimistic" data={scenarios.optimistic} />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-3 text-center">
                                        Conservative: 75% horses | Optimistic: 120% horses
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Break-Even */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Target className="h-5 w-5" />
                                        Break-Even Analysis
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center py-4">
                                        <p className="text-3xl font-bold">{breakEven.horses}</p>
                                        <p className="text-sm text-muted-foreground">horses needed to break even</p>
                                    </div>
                                    <div className="space-y-2">
                                        <ProgressBar
                                            label="Break-even threshold"
                                            value={breakEven.horses}
                                            max={assumptions.expectedHorses}
                                            color="bg-amber-500"
                                            showAmount={false}
                                        />
                                        <ProgressBar
                                            label="Expected attendance"
                                            value={assumptions.expectedHorses}
                                            max={assumptions.expectedHorses}
                                            color="bg-emerald-500"
                                            showAmount={false}
                                        />
                                    </div>
                                    <div className={cn(
                                        'mt-4 p-3 rounded-lg text-center text-sm font-medium',
                                        breakEven.surplus >= 0
                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                                    )}>
                                        {breakEven.surplus >= 0
                                            ? `${breakEven.surplus} horse buffer above break-even`
                                            : `Need ${Math.abs(breakEven.surplus)} more horses to break even`}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Data Completeness */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Data Completeness</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {[
                                        { label: 'Fees', ok: (formData.fees || []).length > 0 },
                                        { label: 'Expenses', ok: (formData.showExpenses || []).length > 0 },
                                        { label: 'Sponsors', ok: (formData.sponsors || []).length > 0 },
                                        { label: 'Sponsor Levels', ok: (formData.sponsorLevels || []).length > 0 },
                                        { label: 'Award Expenses', ok: (formData.awardExpenses || []).length > 0 },
                                    ].map(item => (
                                        <div key={item.label} className="flex items-center justify-between text-sm">
                                            <span>{item.label}</span>
                                            <Badge variant={item.ok ? 'default' : 'outline'} className={cn('text-xs', item.ok ? 'bg-emerald-500' : '')}>
                                                {item.ok ? 'Configured' : 'Not set'}
                                            </Badge>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    </>)}
                </main>
            </div>
        </>
    );
};

export default ShowFinancialDashboardPage;
