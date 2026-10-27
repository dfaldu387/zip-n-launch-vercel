import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileBarChart, Printer, Loader2, FileDown, FileSpreadsheet, Save, Bookmark, Trash2 } from 'lucide-react';
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
import { readLatestForSave } from '@/lib/latestShowGuard';
import {
  REPORTS,
  REPORT_CATEGORIES,
  TRAVEL_STATUS_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  buildReportContext,
  findReport,
  runReport,
  formatCell,
  countLabel,
  addSavedReport,
  removeSavedReport,
  usableSavedReports,
} from '@/lib/employeeReports';

const ALL = 'all';

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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[18rem_1fr]">
              {/* Report list */}
              <aside className="space-y-4 print:hidden">
                {REPORT_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat.title}</h2>
                    <div className="space-y-2">
                      {REPORTS.filter((r) => r.category === cat.id).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReportId(r.id)}
                          className={cn(
                            'w-full text-left rounded-lg border p-3 transition-colors hover:border-primary/60',
                            r.id === reportId ? 'border-primary bg-primary/5' : 'bg-card'
                          )}
                        >
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <FileBarChart className="h-4 w-4 text-primary" /> {r.title}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Saved reports</h2>
                  {savedReports.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
                      Set up a report and filters, then click Save report to keep it here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {savedReports.map((sv) => (
                        <div key={sv.id} className="flex items-start gap-1 rounded-lg border bg-card p-3 hover:border-primary/60">
                          <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openSaved(sv)}>
                            <div className="flex items-center gap-2 font-medium text-sm">
                              <Bookmark className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">{sv.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {findReport(sv.reportId).title} · saved {new Date(sv.savedAt).toLocaleDateString([], { dateStyle: 'medium' })}
                            </p>
                          </button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Delete ${sv.name}`} onClick={() => deleteSaved(sv)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>

              <section className="space-y-4 min-w-0">
                {/* Filters */}
                <Card className="print:hidden">
                  <CardContent className="p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <FilterSelect label="Employee" value={filters.personId} onChange={setFilter('personId')} options={personOptions} />
                      <FilterSelect label="Role" value={filters.role} onChange={setFilter('role')} options={roleOptions} />
                      <FilterSelect label="Travel status" value={filters.travelStatus} onChange={setFilter('travelStatus')} options={TRAVEL_STATUS_OPTIONS} />
                      <FilterSelect label="Contract status" value={filters.contractStatus} onChange={setFilter('contractStatus')} options={CONTRACT_STATUS_OPTIONS} />
                    </div>
                    {isNaming && (
                      <form
                        className="flex items-center gap-2 mt-4"
                        onSubmit={(e) => { e.preventDefault(); handleSaveReport(); }}
                      >
                        <Input
                          autoFocus
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          placeholder={`Name this report, for example "${report.title} - approved staff"`}
                          className="h-9"
                          maxLength={80}
                        />
                        <Button type="submit" size="sm" disabled={!saveName.trim() || isSaving}>
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setIsNaming(false); setSaveName(''); }}>Cancel</Button>
                      </form>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <Button variant="ghost" size="sm" disabled={!hasFilters} onClick={() => setFilters({})}>Clear filters</Button>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setIsNaming((v) => !v)}>
                          <Save className="mr-2 h-4 w-4" /> Save report
                        </Button>
                        <Button size="sm" variant="outline" disabled={result.rows.length === 0} onClick={() => exportReportToPdf({ result, showName, pulledAt })}>
                          <FileDown className="mr-2 h-4 w-4" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" disabled={result.rows.length === 0} onClick={() => exportReportToExcel({ result, showName, pulledAt })}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button size="sm" onClick={() => window.print()} disabled={result.rows.length === 0}>
                          <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview */}
                <Card>
                  <CardContent className="p-5">
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold">{report.title}</h2>
                      <p className="text-sm text-muted-foreground">{showName}</p>
                      <p className="text-xs text-muted-foreground">
                        Pulled on {pulledAt ? pulledAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        {' · '}{countLabel(report, result.count)}
                      </p>
                    </div>

                    {result.rows.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        {context.entries.length === 0
                          ? 'No staff on this show yet. Add people in Officials & Staff and they will appear here.'
                          : 'No one matches these filters.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              {report.columns.map((c) => (
                                <th key={c.key} className={cn('py-2 px-2 font-medium', c.type === 'money' && 'text-right')}>{c.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.rows.map((row, i) => (
                              <tr key={i} className="border-b last:border-0">
                                {report.columns.map((c) => (
                                  <td key={c.key} className={cn('py-2 px-2', c.type === 'money' && 'text-right tabular-nums')}>
                                    {formatCell(row[c.key], c.type)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                          {result.totals && (
                            <tfoot>
                              <tr className="border-t-2 font-semibold">
                                {report.columns.map((c, idx) => (
                                  <td key={c.key} className={cn('py-2 px-2', c.type === 'money' && 'text-right tabular-nums')}>
                                    {idx === 0 ? 'Total' : c.sum ? formatCell(result.totals[c.key], c.type) : ''}
                                  </td>
                                ))}
                              </tr>
                            </tfoot>
                          )}
                        </table>
                        {report.id === 'budget-vs-actual' && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Over / (Under) is actual minus budget, counting only the lines that have an actual entered.
                          </p>
                        )}
                      </div>
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
