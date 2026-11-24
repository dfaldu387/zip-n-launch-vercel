import React, { useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computeScore, ordinal } from '@/lib/scoreMath';
import {
  formatScore, workOrderLabel, padScores, setManeuverScore, addPenalty,
  removePenaltyOnce, penaltyLabel,
} from '@/lib/scoringSheetInfo';

const selectClass = 'h-11 w-full min-w-[84px] rounded-md border bg-background px-2 text-base';

/**
 * One horse on the score sheet: a score for every maneuver, any number of penalties,
 * and the totals. Every change is saved straight away through `onChange`.
 */
const ScoringHorseCard = ({ entry, rules, maneuvers, placing, onChange, onRemove }) => {
  const [confirming, setConfirming] = useState(false);
  const scores = useMemo(() => padScores(entry.maneuver_scores, maneuvers.length), [entry.maneuver_scores, maneuvers.length]);
  const penalties = entry.penalties || [];

  const result = useMemo(
    () => computeScore({ startingScore: rules.starting_score, maneuverScores: scores, penalties }),
    [rules.starting_score, scores, penalties],
  );

  const onScore = (i, value) => onChange({ maneuver_scores: setManeuverScore(scores, i, value, maneuvers.length) });
  const onAddPenalty = (key) => {
    const rule = (rules.penalties || []).find((p) => String(p.id ?? p.name) === key);
    if (rule) onChange({ penalties: addPenalty(penalties, rule) });
  };

  const totalText = result.status === 'dq' ? 'Disqualified' : formatScore(result.total);

  return (
    <div className="mb-4 rounded-lg border">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2">
        <span className="font-semibold">{workOrderLabel(entry.work_order)}</span>
        <span className="text-muted-foreground">Back number</span>
        <span className="text-lg font-semibold">{entry.back_number}</span>
        {placing ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-800">{ordinal(placing)} place</span> : null}
        {result.status === 'dq' && <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-800">DISQUALIFIED</span>}
        {result.status === 'zero' && <span className="rounded bg-orange-100 px-2 py-0.5 text-sm text-orange-800">ZERO</span>}
        <div className="ml-auto">
          {confirming ? (
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Remove this horse and its scores?</span>
              <Button size="sm" variant="destructive" onClick={onRemove}>Yes, remove</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirming(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Penalties: any number, shown as chips. */}
      <div className="flex flex-wrap items-center gap-2 bg-orange-50 px-4 py-3">
        <span className="mr-1 text-sm font-medium">Penalties</span>
        {penalties.length === 0 && <span className="text-sm text-muted-foreground">none</span>}
        {penalties.map((p, i) => (
          <span key={`${p.id ?? p.name}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-white py-1 pl-3 pr-1 text-sm">
            {penaltyLabel(p)}
            <button
              type="button"
              aria-label={`Remove one ${p.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-orange-100"
              onClick={() => onChange({ penalties: removePenaltyOnce(penalties, i) })}
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        ))}
        {(rules.penalties || []).length > 0 ? (
          <select
            className="h-11 rounded-md border bg-white px-2 text-base"
            value=""
            onChange={(e) => { if (e.target.value) onAddPenalty(e.target.value); }}
            aria-label="Add a penalty"
          >
            <option value="">+ Add penalty</option>
            {rules.penalties.map((p) => (
              <option key={String(p.id ?? p.name)} value={String(p.id ?? p.name)}>
                {p.kind === 'dq' ? `${p.name} (disqualified)` : p.kind === 'zero' ? `${p.name} (score 0)` : `${p.name} -${formatScore(p.points)}`}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted-foreground">No penalties are set for this discipline.</span>
        )}
      </div>

      {/* Maneuver scores and the running score under each one. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-3 py-2" />
              {maneuvers.map((m, i) => (
                <th key={m} className="min-w-[100px] px-2 py-2 font-medium"><span className="text-muted-foreground">{i + 1}.</span> {m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-sky-50">
              <td className="whitespace-nowrap px-3 py-2 font-medium">Maneuver score</td>
              {maneuvers.map((m, i) => (
                <td key={m} className="px-2 py-2">
                  <select
                    className={selectClass}
                    value={scores[i] === null ? '' : String(scores[i])}
                    onChange={(e) => onScore(i, e.target.value)}
                    aria-label={`Score for ${m}`}
                  >
                    <option value="">—</option>
                    {(rules.maneuver_scores || []).map((s) => (
                      <option key={s} value={String(s)}>{formatScore(s)}</option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
            <tr>
              <td className="whitespace-nowrap px-3 py-2 font-medium">Running score</td>
              {maneuvers.map((m, i) => (
                <td key={m} className="px-3 py-2 text-muted-foreground">
                  {result.running[i] === null ? '' : formatScore(result.running[i])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-px border-t bg-border text-center">
        <div className="bg-background px-3 py-3">
          <div className="text-xs text-muted-foreground">Raw score</div>
          <div className="text-xl font-semibold">{formatScore(result.raw)}</div>
        </div>
        <div className="bg-background px-3 py-3">
          <div className="text-xs text-muted-foreground">Penalty total</div>
          <div className="text-xl font-semibold">{result.penaltyTotal ? `-${formatScore(result.penaltyTotal)}` : '0'}</div>
        </div>
        <div className="bg-background px-3 py-3">
          <div className="text-xs text-muted-foreground">Total score</div>
          <div className={`text-xl font-bold ${result.status === 'ok' ? '' : 'text-red-700'}`}>{totalText}</div>
        </div>
      </div>
    </div>
  );
};

export default ScoringHorseCard;
