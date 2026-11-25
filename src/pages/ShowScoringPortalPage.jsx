import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ClipboardList, ChevronRight, CheckCircle2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import { useShowScoringClasses } from '@/hooks/useShowScoringClasses';
import { formatSheetDate, formatScore, workOrderLabel } from '@/lib/scoringSheetInfo';
import { ordinal } from '@/lib/scoreMath';
import { supabase } from '@/lib/supabaseClient';

/**
 * Scoring Portal: one row per class + judge. Click a row to open that judge's
 * score sheet.
 */
const ShowScoringPortalPage = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { isLoading, show, book, rows } = useShowScoringClasses(showId);
  const [completed, setCompleted] = useState({});
  const [openKey, setOpenKey] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('scoring_class_results').select('sheet_key, results, completed_at').eq('show_id', showId);
      if (!cancelled) setCompleted(Object.fromEntries((data || []).map((d) => [d.sheet_key, d])));
    })();
    return () => { cancelled = true; };
  }, [showId]);
  const [filters, setFilters] = useState({ association: '', discipline: '', division: '', go: '', judge: '', date: '', status: '' });
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const goText = (r) => (r.goNumber ? `Go ${r.goNumber}` : '—');
  const FILTER_FIELDS = [
    { k: 'association', label: 'Association', get: (r) => r.associationId || '—' },
    { k: 'discipline', label: 'Discipline', get: (r) => r.disciplineName || '—' },
    { k: 'division', label: 'Division', get: (r) => r.divisionName || '—' },
    { k: 'go', label: 'Go', get: goText },
    { k: 'judge', label: 'Judge', get: (r) => r.judgeName || '—' },
    { k: 'date', label: 'Date', get: (r) => (r.date ? formatSheetDate(r.date) : '—'), sortBy: (r) => r.date || '' },
  ];
  const optionsFor = (f) => {
    const seen = new Map();
    rows.forEach((r) => { const v = f.get(r); if (!seen.has(v)) seen.set(v, f.sortBy ? f.sortBy(r) : v); });
    return [...seen.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), undefined, { numeric: true })).map(([v]) => v);
  };
  // Same class = same association, discipline, division and go. Every judge of that class is one sheet.
  const classKey = (r) => [r.associationId, r.disciplineName, r.divisionName, r.goNumber || 0].join('|');
  const classJudges = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const k = classKey(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push({ name: r.judgeName || 'Judge', done: !!completed[r.key] });
    });
    return m;
  }, [rows, completed]);
  const allDone = (r) => { const j = classJudges.get(classKey(r)) || []; return j.length > 0 && j.every((x) => x.done); };
  const filteredRows = rows.filter((r) => {
    if (filters.status === 'alldone' && !allDone(r)) return false;
    if (!FILTER_FIELDS.every((f) => !filters[f.k] || f.get(r) === filters[f.k])) return false;
    if (filters.status === 'completed' && !completed[r.key]) return false;
    if (filters.status === 'open' && completed[r.key]) return false;
    return true;
  });
  const anyFilter = Object.values(filters).some(Boolean);
  const back =() => navigate(`/horse-show-manager/patterns-scoresheets/${showId}`);
  const open = (r) => navigate(`/horse-show-manager/scoring-portal/${showId}/sheet?key=${encodeURIComponent(r.key)}`);

  return (
    <>
      <Helmet><title>{show?.project_name || 'Show'} - Scoring Portal</title></Helmet>
      <div className="h-[100dvh] overflow-y-auto bg-background">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" onClick={back}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ClipboardList className="h-6 w-6" />
            Scoring Portal
          </h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {show?.project_name} · {rows.length} score sheet{rows.length === 1 ? '' : 's'} (one per class and judge). Click a row to open it.
          </p>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !book ? (
            <p className="py-10 text-center text-muted-foreground">No pattern book is linked to this show yet.</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No classes with a pattern or score sheet were found.</p>
          ) : (
            <>
            <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-3 shadow-sm">
              <span className="flex items-center gap-1.5 pb-2 text-sm font-semibold"><Filter className="h-4 w-4" /> Filters</span>
              {FILTER_FIELDS.map((f) => (
                <label key={f.k} className="flex flex-col text-xs font-medium text-muted-foreground">
                  {f.label}
                  <select
                    className={`mt-1 h-9 rounded-lg border px-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${filters[f.k] ? 'border-primary bg-primary/10 font-medium' : 'bg-background'}`}
                    value={filters[f.k]}
                    onChange={(e) => setFilter(f.k, e.target.value)}
                  >
                    <option value="">All</option>
                    {optionsFor(f).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              ))}
              <label className="flex flex-col text-xs font-medium text-muted-foreground">
                Status
                <select
                  className={`mt-1 h-9 rounded-lg border px-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${filters.status ? 'border-primary bg-primary/10 font-medium' : 'bg-background'}`}
                  value={filters.status}
                  onChange={(e) => setFilter('status', e.target.value)}
                >
                  <option value="">All</option>
                  <option value="completed">Completed</option>
                  <option value="open">Not completed</option>
                  <option value="alldone">All judges done</option>
                </select>
              </label>
              {anyFilter && (
                <Button variant="outline" size="sm" className="h-9" onClick={() => setFilters({ association: '', discipline: '', division: '', go: '', judge: '', date: '', status: '' })}>
                  Clear
                </Button>
              )}
              <span className="ml-auto rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">Showing {filteredRows.length} of {rows.length}</span>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Association</th>
                    <th className="px-3 py-2">Discipline</th>
                    <th className="px-3 py-2">Division</th>
                    <th className="px-3 py-2">Go</th>
                    <th className="px-3 py-2">Judge</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Judges done</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No score sheets match these filters.</td></tr>
                  )}
                  {filteredRows.map((r, i) => {
                    const done = completed[r.key];
                    return (
                      <React.Fragment key={r.key}>
                        <tr className="cursor-pointer border-t hover:bg-muted/40" onClick={() => open(r)}>
                          <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-3">{r.associationId || '—'}</td>
                          <td className="px-3 py-3">{r.disciplineName}</td>
                          <td className="px-3 py-3">{r.divisionName}</td>
                          <td className="px-3 py-3">{goText(r)}</td>
                          <td className="px-3 py-3">{r.judgeName || '—'}</td>
                          <td className="px-3 py-3">{formatSheetDate(r.date)}</td>
                          <td className="px-3 py-3">
                            {done ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100"
                                onClick={(e) => { e.stopPropagation(); setOpenKey(openKey === r.key ? null : r.key); }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Completed · {openKey === r.key ? 'Hide' : 'Placings'}
                              </button>
                            ) : <span className="text-xs text-muted-foreground">Not completed</span>}
                          </td>
                          <td className="px-3 py-3">
                            {(() => {
                              const js = classJudges.get(classKey(r)) || [];
                              const n = js.filter((x) => x.done).length;
                              const every = js.length > 0 && n === js.length;
                              return (
                                <span
                                  title={js.map((x) => `${x.done ? '✔' : '○'} ${x.name}`).join('\n')}
                                  className={every
                                    ? 'inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100'
                                    : 'text-xs text-muted-foreground'}
                                >
                                  {every ? <><CheckCircle2 className="h-3.5 w-3.5" /> All judges done</> : `${n} of ${js.length}`}
                                  {js.length > 1 && <span className="ml-1 tracking-wide">{js.map((x) => (x.done ? '✔' : '○')).join(' ')}</span>}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                        </tr>
                        {done && openKey === r.key && (
                          <tr className="border-t bg-emerald-50/60 dark:bg-emerald-950/20">
                            <td colSpan={10} className="px-3 py-3">
                              <p className="mb-2 text-xs font-medium text-muted-foreground">
                                Placings for {r.judgeName || 'this judge'} · {r.divisionName}
                              </p>
                              {(done.results || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No horses were scored.</p>
                              ) : (
                                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  {done.results.map((x) => (
                                    <li key={`${x.work_order}-${x.back_number}`} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
                                      <span className="w-12 font-bold">{x.placing ? ordinal(x.placing) : 'DQ'}</span>
                                      <span className="flex-1">
                                        <span className="block font-medium">Back # {x.back_number}</span>
                                        <span className="block text-xs text-muted-foreground">{workOrderLabel(x.work_order)}</span>
                                      </span>
                                      <span className="font-semibold">{x.status === 'dq' ? '—' : formatScore(x.total)}</span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ShowScoringPortalPage;
