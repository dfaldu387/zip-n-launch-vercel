import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import { supabase } from '@/lib/supabaseClient';
import ScoringHorseList from '@/components/scoring/ScoringHorseList';
import { useShowScoringClasses } from '@/hooks/useShowScoringClasses';
import { formatSheetDate, formatScore, SAMPLE_MANEUVERS, DEFAULT_RULES } from '@/lib/scoringSheetInfo';

/**
 * One judge's score sheet for one class. Step 3a: the header and the rules it will
 * score with. Horses and score entry come in the next steps.
 */
const ScoringSheetPage = () => {
  const { showId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isLoading, show, rows } = useShowScoringClasses(showId);
  const [rules, setRules] = useState(null);
  const [rulesLoading, setRulesLoading] = useState(false);

  const sheet = useMemo(() => rows.find((r) => r.key === params.get('key')) || null, [rows, params]);
  const back = () => navigate(`/horse-show-manager/scoring-portal/${showId}`);

  // Rules come from Scoring Manager (one row per discipline).
  useEffect(() => {
    if (!sheet) { setRules(null); return undefined; }
    let cancelled = false;
    setRulesLoading(true);
    (async () => {
      // The show stores its own discipline id, which can differ from the id Scoring
      // Manager saved the rules under. So try that id first, then match the discipline
      // by association + name (the same two things the admin picked).
      const ids = [];
      if (sheet.disciplineId !== null && sheet.disciplineId !== undefined) ids.push(String(sheet.disciplineId));
      if (sheet.associationId && sheet.disciplineName) {
        const { data: assoc } = await supabase.from('associations').select('id').ilike('abbreviation', sheet.associationId).limit(1);
        if (assoc?.[0]) {
          const { data: discs } = await supabase.from('disciplines').select('id')
            .eq('association_id', assoc[0].id).ilike('name', sheet.disciplineName.trim());
          (discs || []).forEach((d) => { if (!ids.includes(String(d.id))) ids.push(String(d.id)); });
        }
      }
      let found = null;
      if (ids.length > 0) {
        const { data } = await supabase.from('scoring_rules').select('*').in('discipline_id', ids);
        found = ids.map((id) => (data || []).find((r) => String(r.discipline_id) === id)).find(Boolean) || null;
      }
      if (cancelled) return;
      setRules(found);
      setRulesLoading(false);
    })();
    return () => { cancelled = true; };
    // Depend on the plain values, not the `sheet` object: that object is rebuilt every time
    // the show is re-read (for example when the browser tab is focused again), and the
    // rules do not change when that happens. Using the object made the whole page flash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.key, sheet?.disciplineId, sheet?.associationId, sheet?.disciplineName]);

  const usingDefaults = !rulesLoading && !rules;
  const effective = rules || DEFAULT_RULES;
  // The Final Maneuver (if the discipline has one) is always the last column on the sheet.
  const finalOn = !!(effective.final_maneuver?.enabled && effective.final_maneuver?.label);
  const sheetManeuvers = finalOn ? [...SAMPLE_MANEUVERS, effective.final_maneuver.label] : SAMPLE_MANEUVERS;

  return (
    <>
      <Helmet><title>{show?.project_name || 'Show'} - Score Sheet</title></Helmet>
      <div className="h-[100dvh] overflow-y-auto bg-background">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" onClick={back}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All score sheets
          </Button>

          {isLoading || rulesLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !sheet ? (
            <p className="py-10 text-center text-muted-foreground">This score sheet was not found. Go back and pick it from the list.</p>
          ) : (
            <>
              <div className="mb-4 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{show?.project_name}</p>
                <h1 className="text-2xl font-semibold">
                  {sheet.disciplineName} · {sheet.divisionName}{sheet.goNumber ? ` (Go ${sheet.goNumber})` : ''}
                </h1>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span><b>Association:</b> {sheet.associationId || '—'}</span>
                  <span><b>Judge:</b> {sheet.judgeName || '—'}</span>
                  <span><b>Date:</b> {formatSheetDate(sheet.date)}</span>
                  <span><b>Starting score:</b> {formatScore(effective.starting_score)}</span>
                </div>
                {usingDefaults && (
                  <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No scoring rules are set for this discipline yet, so the default starting score of 70 is shown.
                    An admin can set them in Scoring Manager.
                  </p>
                )}
              </div>

              <p className="mb-2 text-xs text-muted-foreground">
                The maneuver names are a sample list for now. They will come from the pattern.
              </p>
              <ScoringHorseList showId={showId} sheetKey={sheet.key} rules={effective} maneuvers={sheetManeuvers} />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ScoringSheetPage;
