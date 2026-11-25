import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ClipboardList, ChevronRight, CheckCircle2 } from 'lucide-react';
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
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const done = completed[r.key];
                    return (
                      <React.Fragment key={r.key}>
                        <tr className="cursor-pointer border-t hover:bg-muted/40" onClick={() => open(r)}>
                          <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-3">{r.associationId || '—'}</td>
                          <td className="px-3 py-3">{r.disciplineName}</td>
                          <td className="px-3 py-3">{r.divisionName}</td>
                          <td className="px-3 py-3">{r.goNumber ? `Go ${r.goNumber}` : '—'}</td>
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
                          <td className="px-3 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                        </tr>
                        {done && openKey === r.key && (
                          <tr className="border-t bg-emerald-50/60 dark:bg-emerald-950/20">
                            <td colSpan={9} className="px-3 py-3">
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
          )}
        </div>
      </div>
    </>
  );
};

export default ShowScoringPortalPage;
