import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileBarChart, Printer, Loader2, FileDown, FileSpreadsheet, Save, Bookmark, Trash2, RefreshCw, DollarSign, Users, Plane, CheckCircle2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { exportReportToPdf, exportReportToExcel } from '@/lib/employeeReportExport';
import { ReportTable, SummaryTiles } from '@/components/employee-reports/ReportTable';
import { readLatestForSave } from '@/lib/latestShowGuard';
import {
  REPORTS,
  REPORT_CATEGORIES,
  TRAVEL_STATUS_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  buildReportContext,
  findReport,
  runReport,
  summaryTiles,
  countLabel,
  addSavedReport,
  removeSavedReport,
  usableSavedReports,
} from '@/lib/employeeReports';

const ALL = 'all';

const CATEGORY_ICONS = { finance: DollarSign, staffing: Users, travel: Plane, readiness: CheckCircle2 };

const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

const EmployeeReportsPage = () => {
  const { showId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [show, setShow] = useState(null);
  const [contractPd, setContractPd] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [reportId, setReportId] = useState(REPORTS[0].id);
  const [filters, setFilters] = useState({});
  const [pulledAt, setPulledAt] = useState(null);
  const [isNaming, setIsNaming] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reads the show, plus the contract record linked to it (contract status lives there).
  // `quiet` re-reads without the full-page spinner, for re-running a saved report.
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!user || !showId) { setIsLoading(false); return; }
    if (!quiet) setIsLoading(true);
    try {
      const { data: showRow, error } = await supabase
        .from('projects')
        .select('id, project_name, project_data')
        .eq('id', showId)
        .maybeSingle();
      if (error) throw error;
      const { data: contractRow } = await supabase
        .from('projects')
        .select('project_data')
        .eq('project_type', 'contract')
        .filter('project_data->>linkedProjectId', 'eq', showId)
        .limit(1)
        .maybeSingle();
      setShow(showRow || null);
      setContractPd(contractRow?.project_data || {});
      setPulledAt(new Date());
    } catch (error) {
      toast({ title: 'Error loading report data', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, showId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Saved reports live on the show (project_data.savedReports). Only the recipe is kept; opening one
  // re-reads the show and runs it on today's data.
  const savedReports = usableSavedReports(show?.project_data?.savedReports || []);

  const writeSaved = async (change) => {
    setIsSaving(true);
    try {
      const check = await readLatestForSave(showId, 'employeeScheduling');
      if (!check.ok) {
        toast({ title: check.reason === 'locked' ? 'Show Locked' : 'Not saved', description: check.message, variant: 'destructive' });
        return false;
      }
      const next = { ...check.latest, savedReports: change(check.latest.savedReports || []) };
      const { error } = await supabase.from('projects').update({ project_data: next }).eq('id', showId);
      if (error) throw error;
      setShow((prev) => (prev ? { ...prev, project_data: next } : prev));
      return true;
    } catch (error) {
      toast({ title: 'Error saving report', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveReport = async () => {
    if (!saveName.trim()) return;
    const name = saveName.trim();
    const ok = await writeSaved((list) => addSavedReport(list, { name: saveName, reportId, filters }));
    if (ok) {
      setSaveName('');
      setIsNaming(false);
      toast({ title: 'Report saved', description: `"${name}" is in the Saved reports list.` });
    }
  };

  const openSaved = async (saved) => {
    setReportId(saved.reportId);
    setFilters(saved.filters || {});
    await load({ quiet: true });
  };

  const deleteSaved = async (saved) => {
    if (!window.confirm(`Delete the saved report "${saved.name}"?`)) return;
    await writeSaved((list) => removeSavedReport(list, saved.id));
  };

  const context = useMemo(() => buildReportContext(show?.project_data || {}, contractPd), [show, contractPd]);
  const report = findReport(reportId);
  const result = useMemo(() => runReport(report, context, filters), [report, context, filters]);

  const roleOptions = useMemo(
    () => [...new Set(context.entries.map((e) => e.role).filter(Boolean))].sort().map((r) => ({ value: r, label: r })),
    [context]
  );
  const personOptions = useMemo(
    () => context.entries.map((e) => ({ value: e.id, label: e.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [context]
  );
  const setFilter = (key) => (value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const hasFilters = Object.values(filters).some(Boolean);
  const showName = show?.project_name || show?.project_data?.showName || '';

  const CatIcon = CATEGORY_ICONS[report.category] || FileBarChart;
  const tiles = summaryTiles(report, result);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const pulledText = pulledAt ? pulledAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const noRows = result.rows.length === 0;

  return (
    <>
      <Helmet>
        <title>Employee Reports - Horse Show Manager</title>
        <meta name="description" content="Run budget, staffing, travel and contract reports for a show." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="print:hidden"><Navigation /></div>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="print:hidden">
            <PageHeader
              title="Employee Reports Center"
              backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'}
            />
          </div>

          {!showId ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Open the Reports Center from a show so it knows which show to report on.
            </CardContent></Card>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading report data…
            </div>
          ) : !show ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">This show could not be found.</CardContent></Card>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[17rem_1fr]">
              {/* Phone: pick a report from a list instead of the long side menu */}
              <div className="lg:hidden print:hidden">
                <Select value={reportId} onValueChange={setReportId}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORTS.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Report menu */}
              <aside className="hidden lg:block print:hidden">
                <nav className="sticky top-4 space-y-5 rounded-xl border bg-card p-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
                  {REPORT_CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.id] || FileBarChart;
                    const items = REPORTS.filter((r) => r.category === cat.id);
                    return (
                      <div key={cat.id}>
                        <div className="mb-1.5 flex items-center gap-2 px-2">
                          <span className="rounded-md bg-primary/10 p-1 text-primary"><Icon className="h-3.5 w-3.5" /></span>
                          <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cat.title}</h2>
                          <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">{items.length}</span>
                        </div>
                        <div className="space-y-0.5">
                          {items.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setReportId(r.id)}
                              className={cn(
                                'w-full rounded-md border-l-2 px-3 py-1.5 text-left text-sm transition-colors',
                                r.id === reportId
                                  ? 'border-primary bg-primary/10 font-medium text-primary'
                                  : 'border-transparent text-foreground/80 hover:bg-muted'
                              )}
                            >
                              {r.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div>
                    <div className="mb-1.5 flex items-center gap-2 px-2">
                      <span className="rounded-md bg-primary/10 p-1 text-primary"><Bookmark className="h-3.5 w-3.5" /></span>
                      <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saved reports</h2>
                      <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">{savedReports.length}</span>
                    </div>
                    {savedReports.length === 0 ? (
                      <p className="mx-2 rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
                        Set up a report and filters, then click Save report to keep it here.
                      </p>
                    ) : (
                      <div className="space-y-0.5">
                        {savedReports.map((sv) => (
                          <div key={sv.id} className="group flex items-center rounded-md hover:bg-muted">
                            <button type="button" className="min-w-0 flex-1 px-3 py-1.5 text-left" onClick={() => openSaved(sv)}>
                              <span className="block truncate text-sm">{sv.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {findReport(sv.reportId).title} · {new Date(sv.savedAt).toLocaleDateString([], { dateStyle: 'medium' })}
                              </span>
                            </button>
                            <Button variant="ghost" size="icon" className="mr-1 h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100" aria-label={`Delete ${sv.name}`} onClick={() => deleteSaved(sv)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </nav>
              </aside>

              <section className="min-w-0 space-y-4">
                {/* Filters */}
                <Card className="print:hidden">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        Filters
                        {activeFilters > 0 && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{activeFilters} on</span>
                        )}
                      </p>
                      <Button variant="ghost" size="sm" className="h-7" disabled={activeFilters === 0} onClick={() => setFilters({})}>Clear filters</Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <FilterSelect label="Employee" value={filters.personId} onChange={setFilter('personId')} options={personOptions} />
                      <FilterSelect label="Role" value={filters.role} onChange={setFilter('role')} options={roleOptions} />
                      <FilterSelect label="Travel status" value={filters.travelStatus} onChange={setFilter('travelStatus')} options={TRAVEL_STATUS_OPTIONS} />
                      <FilterSelect label="Contract status" value={filters.contractStatus} onChange={setFilter('contractStatus')} options={CONTRACT_STATUS_OPTIONS} />
                    </div>
                  </CardContent>
                </Card>

                {/* The report: this card is what Print produces */}
                <Card className="print:border-0 print:shadow-none">
                  <CardContent className="space-y-5 p-5 print:p-0">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="rounded-xl bg-primary/10 p-2.5 text-primary print:hidden"><CatIcon className="h-5 w-5" /></span>
                        <div className="min-w-0">
                          <h2 className="text-2xl font-semibold leading-tight">{report.title}</h2>
                          <p className="text-sm text-muted-foreground">{report.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">{showName}</span> · Pulled on {pulledText} · {countLabel(report, result.count)}
                          </p>
                        </div>
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
                        <Button size="sm" variant="ghost" onClick={() => load({ quiet: true })} title="Read the latest data">
                          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsNaming((v) => !v)}>
                          <Save className="mr-2 h-4 w-4" /> Save report
                        </Button>
                        <Button size="sm" variant="outline" disabled={noRows} onClick={() => exportReportToPdf({ result, showName, pulledAt })}>
                          <FileDown className="mr-2 h-4 w-4" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" disabled={noRows} onClick={() => exportReportToExcel({ result, showName, pulledAt })}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button size="sm" disabled={noRows} onClick={() => window.print()}>
                          <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                      </div>
                    </div>

                    {isNaming && (
                      <form
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 print:hidden"
                        onSubmit={(e) => { e.preventDefault(); handleSaveReport(); }}
                      >
                        <Input
                          autoFocus
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          placeholder={`Name this report, for example "${report.title} - approved staff"`}
                          className="h-9 bg-background"
                          maxLength={80}
                        />
                        <Button type="submit" size="sm" disabled={!saveName.trim() || isSaving}>
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setIsNaming(false); setSaveName(''); }}>Cancel</Button>
                      </form>
                    )}

                    {noRows ? (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-center">
                        <FileBarChart className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm font-medium">Nothing to show</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                          {context.entries.length === 0
                            ? 'No staff on this show yet. Add people in Officials & Staff and they will appear here.'
                            : 'No one matches these filters. Try clearing a filter.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <SummaryTiles tiles={tiles} />
                        <ReportTable report={report} result={result} />
                        {report.id === 'budget-vs-actual' && (
                          <p className="text-xs text-muted-foreground">
                            Over / (Under) is actual minus budget, counting only the lines that have an actual entered.
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>
            </motion.div>
          )}
        </main>
      </div>
    </>
  );
};

export default EmployeeReportsPage;
