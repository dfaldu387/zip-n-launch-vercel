import React, { useMemo, useState } from 'react';
import { Trash2, Check, Pencil, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computeScore, ordinal } from '@/lib/scoreMath';
import {
  formatScore, workOrderLabel, padScores, setManeuverScore, addPenalty,
  removePenaltyOnce, penaltyLabel, sortPenaltyRules, penaltyMenuLabel, penaltyChipText,
} from '@/lib/scoringSheetInfo';

const selectClass = 'h-9 w-full min-w-[64px] rounded-md border bg-background px-1.5 text-sm disabled:opacity-60';

/**
 * One horse on the score sheet: a score and a penalty box for every maneuver, and the
 * totals. Every change is saved straight away through `onChange`.
 */
const ScoringHorseCard = ({ entry, rules, maneuvers, placing, onChange, onRemove, onDone, onBackNumber, classCompleted }) => {
  const [confirming, setConfirming] = useState(false);
  // Pencil next to the back number: edit it in place.
  const [editingBn, setEditingBn] = useState(false);
  const [bnText, setBnText] = useState('');
  const [bnError, setBnError] = useState('');
  const [bnSaving, setBnSaving] = useState(false);
  const startBnEdit = () => { setBnText(String(entry.back_number)); setBnError(''); setEditingBn(true); };
  const saveBn = async (e) => {
    e?.preventDefault();
    setBnSaving(true);
    const err = await onBackNumber?.(bnText);
    setBnSaving(false);
    if (err) setBnError(err); else setEditingBn(false);
  };
  // "Done" is saved with the horse: scores are locked and the card collapses to one line.
  const locked = !!entry.is_done;
  const [peek, setPeek] = useState(false);
  const scores = useMemo(() => padScores(entry.maneuver_scores, maneuvers.length), [entry.maneuver_scores, maneuvers.length]);
  const penalties = entry.penalties || [];

  const result = useMemo(
    () => computeScore({ startingScore: rules.starting_score, maneuverScores: scores, penalties }),
    [rules.starting_score, scores, penalties],
  );

  // The last column is the Final Maneuver when the discipline has one; it has its own scores.
  const finalOn = !!(rules.final_maneuver?.enabled && rules.final_maneuver?.label);
  const isFinalCol = (i) => finalOn && i === maneuvers.length - 1;
  // Plus numbers on top, minus numbers at the bottom.
  const scoreOptionsFor = (i) => [...(isFinalCol(i) ? (rules.final_maneuver.scores || []) : (rules.maneuver_scores || []))]
    .sort((x, y) => Number(y) - Number(x));
  // Done is only allowed once every maneuver has a score. Penalties are optional.
  const missingScores = scores.slice(0, maneuvers.length).filter((v) => v === null || v === undefined).length;
  const canFinish = missingScores === 0;

  const penaltyRules = useMemo(() => sortPenaltyRules(rules.penalties), [rules.penalties]);

  const onScore = (i, value) => onChange({ maneuver_scores: setManeuverScore(scores, i, value, maneuvers.length) });
  const onAddPenalty = (key, maneuverIndex) => {
    const rule = penaltyRules.find((p) => String(p.id ?? p.name) === key);
    if (rule) onChange({ penalties: addPenalty(penalties, rule, maneuverIndex) });
  };

  // One chip per penalty taken, inside the column it belongs to. A penalty with a count of 2
  // shows as two chips, so clicking a chip always removes exactly one.
  const chipsFor = (i) => penalties.flatMap((p, idx) => (
    p.maneuver === i ? Array.from({ length: p.kind === 'normal' || !p.kind ? (Number(p.count) || 1) : 1 }, () => ({ p, idx })) : []
  ));
  // Penalties saved before columns existed have no maneuver; keep them visible so they can be removed.
  const unassigned = penalties.map((p, idx) => ({ p, idx })).filter(({ p }) => p.maneuver === undefined || p.maneuver === null || p.maneuver >= maneuvers.length);

  const totalText = result.status === 'dq' ? 'Disqualified' : formatScore(result.total);

  const chipClass = 'inline-flex h-6 items-center rounded-full border border-orange-300 bg-white px-2 text-xs font-semibold text-slate-900 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-100 dark:hover:bg-red-950';

  // Finished horse: one short line (placing, back number, work order, score). Click to look at the scores.
  if (locked && !peek) {
    return (
      <button
        type="button"
        id={`horse-${entry.id}`}
        onClick={() => setPeek(true)}
        title="Click to see the scores"
        className="mb-2 flex w-full items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-left hover:bg-muted/60"
      >
        <span className="w-14 text-base font-bold">{placing ? ordinal(placing) : (result.status === 'dq' ? 'DQ' : '—')}</span>
        <span className="text-base font-semibold">Back # {entry.back_number}</span>
        <span className="text-sm text-muted-foreground">{workOrderLabel(entry.work_order)}</span>
        <span className="ml-auto text-lg font-bold">{result.status === 'dq' ? 'DQ' : formatScore(result.total)}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div id={`horse-${entry.id}`} className="mb-3 rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="font-semibold">{workOrderLabel(entry.work_order)}</span>
        <span className="text-sm text-muted-foreground">Back number</span>
        {editingBn ? (
          <form onSubmit={saveBn} className="flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              value={bnText}
              onChange={(e) => { setBnText(e.target.value); setBnError(''); }}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditingBn(false); }}
              inputMode="numeric"
              aria-label="New back number"
              className="h-8 w-28 rounded-md border bg-background px-2 text-base font-semibold"
            />
            <Button type="submit" size="sm" disabled={bnSaving}><Check className="mr-1 h-4 w-4" />Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingBn(false)}>Cancel</Button>
            {bnError && <span className="text-xs text-red-600">{bnError}</span>}
          </form>
        ) : (
          <>
            <span className="text-lg font-semibold">{entry.back_number}</span>
            {!classCompleted && onBackNumber && (
              <button
                type="button"
                onClick={startBnEdit}
                title="Edit the back number"
                aria-label="Edit the back number"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        {placing ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100">{ordinal(placing)} place</span> : null}
        {result.status === 'dq' && <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-800 dark:bg-red-900/60 dark:text-red-100">DISQUALIFIED</span>}
        {result.status === 'zero' && <span className="rounded bg-orange-100 px-2 py-0.5 text-sm text-orange-800 dark:bg-orange-900/60 dark:text-orange-100">ZERO</span>}
        <div className="ml-auto flex items-center gap-2">
          {locked ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setPeek(false)}>Hide</Button>
              <Button size="sm" variant="outline" onClick={() => { onChange({ is_done: false }); setPeek(false); }}>
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={!canFinish}
              title={canFinish ? undefined : `Give a score for every maneuver first (${missingScores} left)`}
              onClick={() => { setConfirming(false); onChange({ is_done: true }); onDone?.(); }}
            >
              <Check className="mr-1 h-4 w-4" />
              Done
            </Button>
          )}
          {!locked && !canFinish && (
            <span className="text-xs text-muted-foreground">{missingScores} score{missingScores === 1 ? '' : 's'} left</span>
          )}
          {confirming && !locked ? (
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Remove this horse and its scores?</span>
              <Button size="sm" variant="destructive" onClick={onRemove}>Yes, remove</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="text-red-600" disabled={locked} onClick={() => setConfirming(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Old penalties that were saved before the maneuver columns existed. */}
      {unassigned.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-orange-50 px-3 py-1.5 text-xs dark:bg-orange-950/30">
          <span className="font-medium">Not in a column:</span>
          {unassigned.map(({ p, idx }) => (
            <button
              key={`u-${idx}`}
              type="button"
              disabled={locked}
              title={`${penaltyLabel(p)} — click to remove one`}
              className={chipClass}
              onClick={() => onChange({ penalties: removePenaltyOnce(penalties, idx) })}
            >
              {penaltyLabel(p)} ✕
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-2 py-1.5" />
              {maneuvers.map((m, i) => (
                <th key={m} className="min-w-[72px] px-1 py-1.5 font-medium leading-tight">
                  {isFinalCol(i)
                    ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100">{m}</span>
                    : <><span className="text-muted-foreground">{i + 1}.</span> {m}</>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-orange-50 align-top dark:bg-orange-950/30">
              <td className="whitespace-nowrap px-2 py-1 font-medium">Penalty</td>
              {maneuvers.map((m, i) => (
                <td key={m} className="px-1 py-1">
                  {penaltyRules.length > 0 && (
                    <select
                      className={selectClass}
                      disabled={locked}
                      value=""
                      onChange={(e) => { if (e.target.value) onAddPenalty(e.target.value, i); }}
                      aria-label={`Add a penalty for ${m}`}
                    >
                      <option value="">+ Add</option>
                      {penaltyRules.map((p) => (
                        <option key={String(p.id ?? p.name)} value={String(p.id ?? p.name)}>{penaltyMenuLabel(p)}</option>
                      ))}
                    </select>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {chipsFor(i).map(({ p, idx }, n) => (
                      <button
                        key={`${idx}-${n}`}
                        type="button"
                        disabled={locked}
                        title={`${p.name} — click to remove one`}
                        aria-label={`Remove ${p.name}`}
                        className={chipClass}
                        onClick={() => onChange({ penalties: removePenaltyOnce(penalties, idx) })}
                      >
                        {penaltyChipText(p)} ✕
                      </button>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            <tr className="bg-sky-50 dark:bg-sky-950/40">
              <td className="whitespace-nowrap px-2 py-1 font-medium">Score</td>
              {maneuvers.map((m, i) => (
                <td key={m} className="px-1 py-1">
                  <select
                    className={selectClass}
                    disabled={locked}
                    value={scores[i] === null ? '' : String(scores[i])}
                    onChange={(e) => onScore(i, e.target.value)}
                    aria-label={`Score for ${m}`}
                  >
                    <option value="">—</option>
                    {scoreOptionsFor(i).map((s) => (
                      <option key={s} value={String(s)}>{formatScore(s)}</option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
            <tr>
              <td className="whitespace-nowrap px-2 py-1 font-medium">Running</td>
              {maneuvers.map((m, i) => (
                <td key={m} className="px-2 py-1 text-muted-foreground">
                  {result.running[i] === null ? '' : formatScore(result.running[i])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {penaltyRules.length === 0 && (
        <p className="px-3 pb-1 text-xs text-muted-foreground">No penalties are set for this discipline.</p>
      )}

      <div className="grid grid-cols-3 gap-px border-t bg-border text-center">
        <div className="bg-background px-3 py-1.5">
          <div className="text-xs text-muted-foreground">Raw score</div>
          <div className="text-lg font-semibold">{formatScore(result.raw)}</div>
        </div>
        <div className="bg-background px-3 py-1.5">
          <div className="text-xs text-muted-foreground">Penalty total</div>
          <div className="text-lg font-semibold">{result.penaltyTotal ? `-${formatScore(result.penaltyTotal)}` : '0'}</div>
        </div>
        <div className="bg-background px-3 py-1.5">
          <div className="text-xs text-muted-foreground">Total score</div>
          <div className={`text-lg font-bold ${result.status === 'ok' ? '' : 'text-red-600'}`}>{totalText}</div>
        </div>
      </div>
    </div>
  );
};

export default ScoringHorseCard;
