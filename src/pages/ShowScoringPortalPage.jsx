import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ClipboardList, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import { useShowScoringClasses } from '@/hooks/useShowScoringClasses';
import { formatSheetDate } from '@/lib/scoringSheetInfo';

/**
 * Scoring Portal: one row per class + judge. Click a row to open that judge's
 * score sheet.
 */
const ShowScoringPortalPage = () => {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { isLoading, show, book, rows } = useShowScoringClasses(showId);
  const back = () => navigate(`/horse-show-manager/patterns-scoresheets/${showId}`);
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
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => open(r)}>
                      <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">{r.associationId || '—'}</td>
                      <td className="px-3 py-3">{r.disciplineName}</td>
                      <td className="px-3 py-3">{r.divisionName}</td>
                      <td className="px-3 py-3">{r.goNumber ? `Go ${r.goNumber}` : '—'}</td>
                      <td className="px-3 py-3">{r.judgeName || '—'}</td>
                      <td className="px-3 py-3">{formatSheetDate(r.date)}</td>
                      <td className="px-3 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                    </tr>
                  ))}
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
