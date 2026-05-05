import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Loader2, DollarSign, TrendingDown, Hash,
    ChevronRight, FolderOpen, Calendar, Users,
    Receipt, Briefcase, FileSpreadsheet,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { flattenPersonnel, calculateMemberFinancials } from '@/lib/contractUtils';
import { exportBudgetToExcel } from '@/lib/contractBudgetExport';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';

const currency = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? '$0' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

// ── KPI Card ──

const KpiCard = ({ title, value, subtitle, icon: Icon, color = 'blue' }) => {
    const styles = {
        blue: { bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200', icon: 'text-blue-600', value: 'text-blue-700 dark:text-blue-300' },
        green: { bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200', icon: 'text-emerald-600', value: 'text-emerald-700 dark:text-emerald-300' },
        red: { bg: 'bg-red-50 dark:bg-red-950/20 border-red-200', icon: 'text-red-600', value: 'text-red-700 dark:text-red-300' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200', icon: 'text-amber-600', value: 'text-amber-700 dark:text-amber-300' },
        purple: { bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200', icon: 'text-purple-600', value: 'text-purple-700 dark:text-purple-300' },
    };
    const s = styles[color];
    return (
        <div className={cn('rounded-xl border p-4', s.bg)}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                    <p className={cn('text-2xl font-bold mt-1', s.value)}>{value}</p>
                    {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
                </div>
                <Icon className={cn('h-5 w-5 mt-1', s.icon)} />
            </div>
        </div>
    );
};

// ── Budget Line Item ──

const BudgetLine = ({ label, amount, indent = false, bold = false, color }) => (
    <div className={cn('flex items-center justify-between py-1.5 text-sm', indent && 'pl-6', bold && 'font-semibold border-t pt-2 mt-1')}>
        <span className={cn(bold ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
        <span className={cn(bold ? 'text-foreground' : '', color)}>{currency(amount)}</span>
    </div>
);

// ── Progress Bar ──

const BudgetBar = ({ label, amount, total, color = 'bg-blue-500' }) => {
    const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{currency(amount)} ({pct.toFixed(1)}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// ── Show Picker ──

const ShowPicker = ({ shows, onSelect }) => {
    const navigate = useNavigate();
    if (shows.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Shows Found</h3>
                    <p className="text-sm text-muted-foreground mb-6">Create a horse show first to use the budgeting tool.</p>
                    <Button onClick={() => navigate('/horse-show-manager/create')}>Create Horse Show</Button>
                </CardContent>
            </Card>
        );
    }
    return (
        <div className="space-y-3">
            {shows.map((show, i) => {
                const pd = show.project_data || {};
                return (
                    <motion.div key={show.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <button type="button" className="w-full text-left" onClick={() => onSelect(show)}>
                            <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                                <CardContent className="py-4 px-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-base truncate">{show.project_name || 'Untitled'}</h3>
                                                {pd.showNumber && <Badge variant="secondary" className="text-xs"><Hash className="h-3 w-3 mr-0.5" />#{pd.showNumber}</Badge>}
                                                <Badge variant="outline" className={cn('text-xs', show.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300')}>{show.status || 'draft'}</Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                {pd.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{pd.startDate}</span>}
                                                <span>{(pd.fees || []).length} fees</span>
                                                <span>{(pd.sponsors || []).length} sponsors</span>
                                                <span>{(pd.showExpenses || []).length} expenses</span>
                                            </div>
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

// ── Budget Dashboard ──

const BudgetDashboard = ({ show, contractProject }) => {
    const pd = show.project_data || {};
    const cpd = contractProject?.project_data || {};

    // Employee costs from contract management (the primary data source)
    const employeeCosts = useMemo(() => {
        const personnel = flattenPersonnel(cpd);
        let totalDayPay = 0;
        let totalExpenses = 0;
        let totalCompensation = 0;
        const byRole = {};
        const byExpenseType = {};

        for (const member of personnel) {
            const fin = calculateMemberFinancials(member);
            totalDayPay += fin.totalDayFee;
            totalExpenses += fin.totalExpenses;
            totalCompensation += fin.totalCompensation;

            const role = member.roleName || 'Other';
            if (!byRole[role]) byRole[role] = { count: 0, total: 0, dayPay: 0, expenses: 0 };
            byRole[role].count += 1;
            byRole[role].total += fin.totalCompensation;
            byRole[role].dayPay += fin.totalDayFee;
            byRole[role].expenses += fin.totalExpenses;

            // Aggregate expense types
            for (const [expId, amount] of Object.entries(fin.expenseBreakdown)) {
                byExpenseType[expId] = (byExpenseType[expId] || 0) + amount;
            }
        }

        return { personnelCount: personnel.length, totalDayPay, totalExpenses, totalCompensation, byRole, byExpenseType, personnel };
    }, [cpd]);

    const employeeTotal = employeeCosts.totalCompensation;

    const EXPENSE_LABELS = {
        airfare: 'Airline Tickets',
        baggage: 'Baggage',
        airportParking: 'Airport Parking',
        tolls: 'Tolls',
        fuel: 'Fuel',
        rentalCar: 'Rental Car',
        perDiem: 'Per Diem',
        hotel: 'Hotel Costs',
        mileage: 'Mileage',
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{show.project_name}</h2>
                    {pd.showNumber && <Badge variant="secondary"><Hash className="h-3 w-3 mr-0.5" />#{pd.showNumber}</Badge>}
                    {!contractProject && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">No contract data linked</Badge>
                    )}
                </div>
                {contractProject && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const success = exportBudgetToExcel(contractProject.project_data || {});
                            if (!success) alert('No personnel data to export.');
                        }}
                    >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export Budget to Excel
                    </Button>
                )}
            </div>

            {/* KPI Cards — staff expenses only */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="Total Staff Costs" value={currency(employeeTotal)} subtitle={`${employeeCosts.personnelCount} personnel`} icon={Users} color="purple" />
                <KpiCard title="Day Pay" value={currency(employeeCosts.totalDayPay)} subtitle="Compensation fees" icon={Briefcase} color="blue" />
                <KpiCard title="Travel & Expenses" value={currency(employeeCosts.totalExpenses)} subtitle="Reimbursable costs" icon={TrendingDown} color="amber" />
                <KpiCard title="Roles" value={String(Object.keys(employeeCosts.byRole).length)} subtitle={`${employeeCosts.personnelCount} staff total`} icon={Users} color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column: Staff Cost Breakdown */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Cost Breakdown by Role */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-purple-600" /> Staff Costs by Role</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {employeeCosts.personnelCount > 0 ? (
                                <>
                                    <div className="space-y-3">
                                        {Object.entries(employeeCosts.byRole).map(([role, data]) => (
                                            <BudgetBar key={role} label={`${role} (${data.count})`} amount={data.total} total={employeeTotal} color="bg-purple-500" />
                                        ))}
                                    </div>
                                    <Accordion type="single" collapsible>
                                        {Object.entries(employeeCosts.byRole).map(([role, data]) => (
                                            <AccordionItem key={role} value={role}>
                                                <AccordionTrigger className="text-sm hover:no-underline">{role} — {data.count} staff</AccordionTrigger>
                                                <AccordionContent>
                                                    <BudgetLine label="Day Pay" amount={data.dayPay} indent />
                                                    <BudgetLine label="Travel & Expenses" amount={data.expenses} indent />
                                                    <BudgetLine label={`Total ${role} Costs`} amount={data.total} bold />
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                    <BudgetLine label="TOTAL STAFF COSTS" amount={employeeTotal} bold color="text-purple-600" />
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No staff data. Link a contract project to see employee costs.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Expense Type Breakdown */}
                    {Object.keys(employeeCosts.byExpenseType).length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-amber-600" /> Travel & Expense Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {Object.entries(employeeCosts.byExpenseType).map(([expId, amount]) => (
                                    <BudgetBar key={expId} label={EXPENSE_LABELS[expId] || expId} amount={amount} total={employeeCosts.totalExpenses} color="bg-amber-500" />
                                ))}
                                <BudgetLine label="TOTAL TRAVEL & EXPENSES" amount={employeeCosts.totalExpenses} bold color="text-amber-600" />
                            </CardContent>
                        </Card>
                    )}

                    {/* Staff Summary Table */}
                    {employeeCosts.personnel.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-600" /> Staff Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b">
                                                <th className="text-left px-3 py-2 font-medium text-xs uppercase">Name</th>
                                                <th className="text-left px-3 py-2 font-medium text-xs uppercase">Role</th>
                                                <th className="text-right px-3 py-2 font-medium text-xs uppercase">Day Pay</th>
                                                <th className="text-right px-3 py-2 font-medium text-xs uppercase">Expenses</th>
                                                <th className="text-right px-3 py-2 font-medium text-xs uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employeeCosts.personnel.map((member) => {
                                                const fin = calculateMemberFinancials(member);
                                                return (
                                                    <tr key={member.id} className="border-b last:border-0">
                                                        <td className="px-3 py-2 font-medium">{member.name || 'Unnamed'}</td>
                                                        <td className="px-3 py-2 text-muted-foreground">{member.roleName || ''}</td>
                                                        <td className="px-3 py-2 text-right">{currency(fin.totalDayFee)}</td>
                                                        <td className="px-3 py-2 text-right">{currency(fin.totalExpenses)}</td>
                                                        <td className="px-3 py-2 text-right font-semibold">{currency(fin.totalCompensation)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="bg-muted/30 font-semibold">
                                                <td className="px-3 py-2" colSpan={2}>TOTAL</td>
                                                <td className="px-3 py-2 text-right">{currency(employeeCosts.totalDayPay)}</td>
                                                <td className="px-3 py-2 text-right">{currency(employeeCosts.totalExpenses)}</td>
                                                <td className="px-3 py-2 text-right">{currency(employeeTotal)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right column: Quick Stats */}
                <div className="space-y-6">
                    {/* Cost Split */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-purple-600" /> Cost Split</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-blue-500" /> Day Pay</span>
                                <span className="font-medium">{currency(employeeCosts.totalDayPay)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-amber-500" /> Travel & Expenses</span>
                                <span className="font-medium">{currency(employeeCosts.totalExpenses)}</span>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
                                <span>Total</span>
                                <span className="text-purple-600">{currency(employeeTotal)}</span>
                            </div>
                            {employeeTotal > 0 && (
                                <div className="flex h-6 rounded-lg overflow-hidden border mt-3">
                                    <div className="bg-blue-500 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${(employeeCosts.totalDayPay / employeeTotal * 100)}%` }}>
                                        Pay
                                    </div>
                                    <div className="bg-amber-500 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${(employeeCosts.totalExpenses / employeeTotal * 100)}%` }}>
                                        Travel
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Data Completeness */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Data Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {[
                                { label: 'Employee contracts linked', ok: employeeCosts.personnelCount > 0 },
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-2 text-sm">
                                    <div className={cn('h-2.5 w-2.5 rounded-full', item.ok ? 'bg-emerald-500' : 'bg-gray-300')} />
                                    <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// ── Main Page ──

const EmployeeBudgetingToolPage = () => {
    const navigate = useNavigate();
    const { showId } = useParams();
    const { user } = useAuth();
    const [shows, setShows] = useState([]);
    const [contractProjects, setContractProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShow, setSelectedShow] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) { setIsLoading(false); return; }
            const [showsRes, contractsRes] = await Promise.all([
                supabase.from('projects').select('id, project_name, project_type, project_data, status, created_at')
                    .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('projects').select('id, project_name, project_data, status')
                    .eq('project_type', 'contract').eq('user_id', user.id),
            ]);
            if (showsRes.data) {
                setShows(showsRes.data);
                // Auto-select show from URL param
                if (showId) {
                    const match = showsRes.data.find(s => s.id === showId);
                    if (match) setSelectedShow(match);
                }
            }
            if (contractsRes.data) setContractProjects(contractsRes.data);
            setIsLoading(false);
        };
        fetchData();
    }, [user, showId]);

    // Find linked contract project for selected show
    const linkedContract = useMemo(() => {
        if (!selectedShow) return null;
        return contractProjects.find(cp => cp.project_data?.linkedProjectId === selectedShow.id) || null;
    }, [selectedShow, contractProjects]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Employee Budgeting Tool</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <PageHeader title="Employee Budgeting Tool" backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'} />

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
                            description="Link to a show to view its budget, revenue forecast, and profit analysis."
                        />
                    )}

                    {selectedShow && (
                        <div className="mt-6">
                            <BudgetDashboard show={selectedShow} contractProject={linkedContract} />
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default EmployeeBudgetingToolPage;
