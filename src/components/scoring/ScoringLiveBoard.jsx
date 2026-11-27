import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Check, CheckCircle2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { nextWorkOrder, cleanBackNumber, formatScore, buildPlacings, setManeuverScore, addPenalty, removePenaltyOnce, sortPenaltyRules, penaltyMenuLabel, penaltyChipText } from '@/lib/scoringSheetInfo';
import { maneuverProgress, completedManeuvers, orderTiles, groupTiles, byWorkOrder, scorecardOf, splitManeuver, maneuverLabel } from '@/lib/scoringLive';
import { useNavigate } from 'react-router-dom';
import { ordinal } from '@/lib/scoreMath';

// Maneuvers per row in the selection grid.
const PER_ROW = 4;

/**
 * "Live Scoring with Scores/Penalties" (step C-1): the layout.
 *   1. Maneuver selection grid, each button shows how many horses are scored ("3/18").
 *   2. Progress bar for the selected maneuver.
 *   3. Exhibitor tiles in groups of 6, ranked best first.
 * Entering scores comes in the next steps (Quick Score Bar, exhibitor panel).
 */
const ScoringLiveBoard = ({ showId, sheetKey, rules, maneuvers, finalScores = null }) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [backNumber, setBackNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedManeuver, setSelectedManeuver] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const addInputRef = useRef(null);
  // 'exhibitor' = pick the horse, then press a score. 'score' = press a score, then tap horses.
  const navigate = useNavigate();
  const [liveRanking, setLiveRanking] = useState(true);
  const [completedAt, setCompletedAt] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const locked = !!completedAt;
  const [mode, setMode] = useState('exhibitor');
  const [activeScore, setActiveScore] = useState(null);
  const [activePenaltyId, setActivePenaltyId] = useState('');

  const count = maneuvers.length;
  const setAll = useCallback((next) => { entriesRef.current = next; setEntries(next); }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('scoring_entries').select('*')
      .eq('show_id', showId).eq('sheet_key', sheetKey).order('work_order');
    if (error) toast({ title: 'Could not load exhibitors', description: error.message, variant: 'destructive' });
    else setAll(data || []);
    setLoading(false);
  }, [showId, sheetKey, toast, setAll]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const progress = useMemo(() => maneuverProgress(entries, count), [entries, count]);
  const completed = useMemo(() => completedManeuvers(entries, count), [entries, count]);
  const tiles = useMemo(
    () => orderTiles(entries, Number(rules?.starting_score) || 0, count, selectedManeuver),
    [entries, rules, count, selectedManeuver],
  );
  const groups = useMemo(
    () => (liveRanking ? groupTiles(tiles) : groupTiles(byWorkOrder(tiles), undefined, 'Exhibitors')),
    [tiles, liveRanking],
  );
  const selected = entries.find((x) => x.id === selectedId) || null;

  // The last column is the Final Maneuver when the discipline has one: it uses its own scores.
  const isFinal = !!finalScores && selectedManeuver === count - 1;
  const quickScores = useMemo(
    () => [...(isFinal ? finalScores : rules?.maneuver_scores || [])].map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => b - a),
    [isFinal, finalScores, rules],
  );
  // Score names set in Scoring Manager ("Excellent", "Good"...). The Final Maneuver has its own scores, so no names there.
  const nameOf = (v, finalCol = false) => (finalCol ? '' : rules?.score_labels?.[String(v)] || '');
  const penaltyRules = useMemo(() => sortPenaltyRules(rules?.penalties || []), [rules]);
  const activePenalty = penaltyRules.find((r) => String(r.id ?? r.name) === activePenaltyId) || null;
  const scoreColor = (v) => (v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-600' : 'text-foreground');
  const selectedScoreOf = (entry, idx = selectedManeuver) => {
    const v = entry?.maneuver_scores?.[idx];
    return v === undefined || v === null || v === '' ? null : Number(v);
  };

  const total = entries.length;
  const scoredHere = progress[selectedManeuver] || 0;
  const pct = total === 0 ? 0 : Math.round((scoredHere / total) * 100);

  const add = async (e) => {
    e?.preventDefault();
    if (locked) { lockedToast(); return; }
    const bn = cleanBackNumber(backNumber);
    if (!bn) { toast({ title: 'Type a back number first', variant: 'destructive' }); return; }
    if (entries.some((x) => x.back_number.toLowerCase() === bn.toLowerCase())) {
      toast({ title: `Back number ${bn} is already in this class`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('scoring_entries').insert({
      show_id: showId, sheet_key: sheetKey, back_number: bn, work_order: nextWorkOrder(entries),
    });
    setSaving(false);
    if (error) {
      if (error.code === '23505') { await load(); toast({ title: 'The list changed. Please try again.', variant: 'destructive' }); }
      else toast({ title: 'Could not add the exhibitor', description: error.message, variant: 'destructive' });
      return;
    }
    setBackNumber('');
    await load();
    addInputRef.current?.focus({ preventScroll: true });
  };

  // Save one change to one horse. The screen updates at once; if saving fails we reload.
  const lockedToast = () => toast({ title: 'This class is completed', description: 'Press "Reopen class" to change scores.', variant: 'destructive' });

  // Is this class already completed? (the saved placings snapshot exists)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('scoring_class_results')
        .select('completed_at').eq('show_id', showId).eq('sheet_key', sheetKey).maybeSingle();
      if (!cancelled) setCompletedAt(data?.completed_at || null);
    })();
    return () => { cancelled = true; };
  }, [showId, sheetKey]);

  // Save the placings as they are now, then go back to the class list.
  const completeClass = async () => {
    setCompleting(true);
    const { ranked } = buildPlacings(entriesRef.current, Number(rules?.starting_score) || 0, count, []);
    const results = ranked.map((x) => ({
      placing: x.placing, back_number: x.backNumber, work_order: x.workOrder, total: x.total, status: x.status,
    }));
    const { error } = await supabase.from('scoring_class_results').upsert(
      { show_id: showId, sheet_key: sheetKey, results, completed_at: new Date().toISOString() },
      { onConflict: 'show_id,sheet_key' },
    );
    setCompleting(false);
    if (error) { toast({ title: 'Could not complete the class', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Class completed', description: 'The placings are saved.' });
    navigate(`/horse-show-manager/scoring-portal/${showId}`);
  };
  const reopenClass = async () => {
    const { error } = await supabase.from('scoring_class_results').delete().eq('show_id', showId).eq('sheet_key', sheetKey);
    if (error) { toast({ title: 'Could not reopen the class', description: error.message, variant: 'destructive' }); return; }
    setCompletedAt(null);
  };

  const saveEntry = async (entry, patch) => {
    if (locked) { lockedToast(); return; }
    setAll(entriesRef.current.map((x) => (x.id === entry.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('scoring_entries').update(patch).eq('id', entry.id);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      await load();
    }
  };
  const currentOf = (entry) => entriesRef.current.find((x) => x.id === entry.id) || entry;
  // Every score / penalty change is remembered (last 50) so "Undo last entry" can step back.
  const pushLog = (cur, item) => [...(Array.isArray(cur.undo_log) ? cur.undo_log : []), item].slice(-50);
  // `idx` = which maneuver column; defaults to the one picked in the grid (scorecard cells pass their own).
  const applyScore = (entry, value, idx = selectedManeuver) => {
    const cur = currentOf(entry);
    const prev = selectedScoreOf(cur, idx);
    saveEntry(cur, {
      maneuver_scores: setManeuverScore(cur.maneuver_scores, idx, value, count),
      undo_log: pushLog(cur, { k: 's', m: idx, prev }),
    });
  };
  const clearScore = (entry, idx = selectedManeuver) => {
    const cur = currentOf(entry);
    const prev = selectedScoreOf(cur, idx);
    saveEntry(cur, {
      maneuver_scores: setManeuverScore(cur.maneuver_scores, idx, '', count),
      undo_log: pushLog(cur, { k: 's', m: idx, prev }),
    });
  };
  const applyPenalty = (entry, rule, idx = selectedManeuver) => {
    const cur = currentOf(entry);
    saveEntry(cur, {
      penalties: addPenalty(cur.penalties, rule, idx),
      undo_log: pushLog(cur, { k: 'p', prev: cur.penalties || [] }),
    });
  };
  const undoLast = (entry) => {
    const cur = currentOf(entry);
    const log = Array.isArray(cur.undo_log) ? cur.undo_log : [];
    const last = log[log.length - 1];
    if (!last) return;
    const rest = log.slice(0, -1);
    if (last.k === 's') {
      saveEntry(cur, { maneuver_scores: setManeuverScore(cur.maneuver_scores, last.m, last.prev === null ? '' : last.prev, count), undo_log: rest });
    } else {
      saveEntry(cur, { penalties: last.prev || [], undo_log: rest });
    }
  };
  const toggleFlag = (entry, key) => {
    const cur = currentOf(entry);
    saveEntry(cur, { [key]: !cur[key] });
  };
  const pressScore = (value) => {
    setActivePenaltyId('');
    if (mode === 'score') { setActiveScore((v) => (v === value ? null : value)); return; }
    if (!selected) { toast({ title: 'Select an exhibitor first', variant: 'destructive' }); return; }
    applyScore(selected, value);
  };
  const pickPenalty = (id) => {
    setActivePenaltyId(id);
    setActiveScore(null);
    const rule = penaltyRules.find((r) => String(r.id ?? r.name) === id);
    if (rule && mode === 'exhibitor' && selected) applyPenalty(selected, rule);
  };
  const changeMode = (m) => { setMode(m); setActiveScore(null); };
  const tapTile = (entry) => {
    setSelectedId(entry.id);
    if (activePenalty) applyPenalty(entry, activePenalty);
    else if (mode === 'score' && activeScore !== null) applyScore(entry, activeScore);
  };

  // Pencil next to the back number: edit it in place (selected panel and scorecard).
  const [editingBn, setEditingBn] = useState(false);
  const [bnText, setBnText] = useState('');
  const [bnError, setBnError] = useState('');
  const [bnSaving, setBnSaving] = useState(false);
  useEffect(() => { setEditingBn(false); setBnError(''); }, [selectedId]);
  const startBnEdit = () => { if (locked) { lockedToast(); return; } setBnText(String(selected?.back_number ?? '')); setBnError(''); setEditingBn(true); };
  const saveBn = async (e) => {
    e?.preventDefault();
    if (!selected) return;
    const bn = cleanBackNumber(bnText);
    if (!bn) { setBnError('Type a back number first'); return; }
    if (bn === selected.back_number) { setEditingBn(false); return; }
    if (entriesRef.current.some((x) => x.id !== selected.id && x.back_number.toLowerCase() === bn.toLowerCase())) {
      setBnError(`Back number ${bn} is already in this class`);
      return;
    }
    setBnSaving(true);
    const { error } = await supabase.from('scoring_entries')
      .update({ back_number: bn, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setBnSaving(false);
    if (error) { setBnError(error.code === '23505' ? `Back number ${bn} is already in this class` : error.message); return; }
    setAll(entriesRef.current.map((x) => (x.id === selected.id ? { ...x, back_number: bn } : x)));
    setEditingBn(false);
  };
  const bnEditor = (
    <form onSubmit={saveBn} className="flex flex-wrap items-center gap-1.5">
      <input
        autoFocus
        value={bnText}
        onChange={(e) => { setBnText(e.target.value); setBnError(''); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditingBn(false); }}
        inputMode="numeric"
        aria-label="New back number"
        className="h-8 w-24 rounded-md border bg-background px-2 text-base font-semibold"
      />
      <Button type="submit" size="sm" disabled={bnSaving}><Check className="mr-1 h-4 w-4" />Save</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingBn(false)}>Cancel</Button>
      {bnError && <span className="w-full text-xs text-red-600">{bnError}</span>}
    </form>
  );
  const bnPencil = (
    <button type="button" onClick={startBnEdit} title="Edit the back number" aria-label="Edit the back number"
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
      <Pencil className="h-4 w-4" />
    </button>
  );

  const remove = async () => {
    if (!selected) return;
    if (locked) { lockedToast(); return; }
    const { error } = await supabase.from('scoring_entries').delete().eq('id', selected.id);
    if (error) { toast({ title: 'Could not remove the exhibitor', description: error.message, variant: 'destructive' }); return; }
    setSelectedId(null);
    await load();
  };

  return (
    <div className="mb-4 space-y-3">
      {/* Add exhibitors */}
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">
            Exhibitors in this class ({total})
            <span className="ml-2 text-sm font-normal text-muted-foreground">· Base score {formatScore(Number(rules?.starting_score) || 0) || 0}</span>
          </h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${completedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {completedAt ? 'Completed' : 'In progress'}
          </span>
        </div>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input ref={addInputRef} value={backNumber} onChange={(e) => setBackNumber(e.target.value)}
            placeholder="Back number, e.g. 1001" inputMode="numeric" className="h-11 w-56 text-base" />
          <Button type="submit" className="h-11" disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Add exhibitor
          </Button>
        </form>

        <div className="mt-3 border-t pt-3">
          {completedAt ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Class completed. Placings are saved.
              </span>
              <Button size="sm" variant="outline" onClick={completeClass} disabled={completing}>Save placings again</Button>
              <Button size="sm" variant="ghost" onClick={reopenClass}>Reopen class</Button>
            </div>
          ) : confirmComplete ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {completed < count
                  ? `${count - completed} maneuver${count - completed === 1 ? ' is' : 's are'} not scored for every exhibitor. Complete the class anyway?`
                  : 'Complete this class and save the placings?'}
              </span>
              <Button size="sm" onClick={completeClass} disabled={completing}>
                {completing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Yes, complete class
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmComplete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" disabled={entries.length === 0} onClick={() => setConfirmComplete(true)}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Complete class
            </Button>
          )}
        </div>
      </div>

      {/* Maneuver selection */}
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Maneuver selection</h2>
          <span className="text-sm text-muted-foreground">{completed}/{count} complete</span>
        </div>
        {(() => {
          const btn = (i, extra = '') => {
            const done = total > 0 && progress[i] >= total;
            const on = i === selectedManeuver;
            return (
              <button key={i} type="button" onClick={() => setSelectedManeuver(i)}
                className={`rounded-md border px-2 py-2 text-center text-xs font-medium ${extra} ${on ? 'border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-accent'} ${done ? 'border-emerald-400' : ''}`}>
                <span className="block">{splitManeuver(maneuvers[i]).short}</span>
                <span className={`block font-semibold ${done ? 'text-emerald-600' : 'text-muted-foreground'}`}>{progress[i] || 0}/{total}</span>
              </button>
            );
          };
          const idx = maneuvers.map((_, i) => i);
          const left = idx.filter((i) => splitManeuver(maneuvers[i]).side === 'Left');
          const right = idx.filter((i) => splitManeuver(maneuvers[i]).side === 'Right');
          const other = idx.filter((i) => !splitManeuver(maneuvers[i]).side);
          // No Left/Right names (for example a plain list): show one simple grid.
          if (left.length + right.length === 0) {
            return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{idx.map((i) => btn(i))}</div>;
          }
          return (
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                {[['Left', left], ['Right', right]].map(([label, list]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
                    <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">{list.map((i) => btn(i))}</div>
                  </div>
                ))}
              </div>
              {other.length > 0 && (
                <div className="flex w-24 shrink-0 flex-col gap-2">{other.map((i) => btn(i, 'flex-1 flex flex-col items-center justify-center'))}</div>
              )}
            </div>
          );
        })()}

        <div className="mt-4 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-600">{maneuverLabel(maneuvers[selectedManeuver])}</span>
            <span className="text-sm font-medium">{scoredHere}/{total} scored</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-emerald-600">{scoredHere} scored</span>
            <span className="text-muted-foreground">{total - scoredHere} remaining</span>
          </div>
        </div>
      </div>

      {/* Scoring controls */}
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Scoring method</h2>
          <div className="inline-flex overflow-hidden rounded-md border text-sm">
            {[['exhibitor', 'Exhibitor First'], ['score', 'Score First']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => changeMode(k)}
                className={`px-3 py-1.5 ${mode === k ? 'bg-blue-600 text-white' : 'hover:bg-accent'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Quick Score Bar · <span className="text-blue-600">{maneuverLabel(maneuvers[selectedManeuver])}</span></span>
          <span>{mode === 'exhibitor' ? 'Tap an exhibitor, then press a score.' : 'Select a score to activate, then tap each exhibitor.'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickScores.length === 0 && <p className="text-sm text-muted-foreground">No maneuver scores are set in Scoring Manager.</p>}
          {quickScores.map((v) => (
            <button key={v} type="button" onClick={() => pressScore(v)}
              className={`flex min-h-12 min-w-[3.5rem] flex-col items-center justify-center rounded-md border px-3 py-1 font-bold ${scoreColor(v)} ${mode === 'score' && activeScore === v ? 'border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-accent'}`}>
              <span className="text-lg leading-tight">{v > 0 ? '+' : ''}{formatScore(v) || 0}</span>
              {nameOf(v, isFinal) && <span className="text-[11px] font-normal leading-tight text-muted-foreground">{nameOf(v, isFinal)}</span>}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={activePenaltyId} onChange={(e) => pickPenalty(e.target.value)}
            className={`h-11 rounded-md border bg-background px-3 text-sm ${activePenalty ? 'border-2 border-red-500 text-red-600' : ''}`}>
            <option value="">Select Penalty</option>
            {penaltyRules.map((r) => <option key={String(r.id ?? r.name)} value={String(r.id ?? r.name)}>{penaltyMenuLabel(r)}</option>)}
          </select>
          {activePenalty && (
            <>
              <span className="text-sm text-red-600">Penalty is on: tap an exhibitor to apply it.</span>
              <Button variant="ghost" size="sm" onClick={() => setActivePenaltyId('')}>Turn off</Button>
            </>
          )}
          {penaltyRules.length === 0 && <span className="text-xs text-muted-foreground">No penalties set in Scoring Manager.</span>}
        </div>
      </div>

      {/* Exhibitor tiles */}
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Exhibitors</h2>
          <span className="text-sm text-muted-foreground">{total} {total === 1 ? 'entry' : 'entries'}</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">No exhibitors yet. Add the first back number above.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            <div>
            <div className="grid gap-3 sm:grid-cols-3">
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="mb-1 text-center text-xs text-muted-foreground">{g.label}</p>
                  <div className="space-y-1.5">
                    {g.tiles.map((t) => {
                      const scoredNow = t.selectedScore !== null && t.selectedScore !== undefined;
                      const isSel = t.entry.id === selectedId;
                      return (
                        <button key={t.entry.id} type="button" onClick={() => tapTile(t.entry)}
                          className={`w-full rounded-md border px-2 py-1.5 text-center ${t.entry.contender ? 'ring-2 ring-amber-400' : ''} ${isSel ? 'border-2 border-blue-600' : ''} ${scoredNow ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'bg-card hover:bg-accent'}`}>
                          <span className={`block text-lg font-bold ${scoredNow ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{t.entry.back_number}</span>
                          <span className="block text-xs font-semibold">Total: {formatScore(t.total) || 0}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {t.scored}/{count}
                            {scoredNow && <span className={`ml-1 inline-flex items-center gap-0.5 font-semibold ${scoreColor(t.selectedScore)}`}>· {t.selectedScore > 0 ? '+' : ''}{formatScore(t.selectedScore) || 0}<Check className="h-3 w-3" /></span>}
                          </span>
                          {(t.entry.contender || t.entry.recheck) && (
                            <span className="block text-[11px] font-semibold text-amber-600">
                              {t.entry.contender ? 'Contender' : ''}{t.entry.contender && t.entry.recheck ? ' · ' : ''}{t.entry.recheck ? 'Recheck' : ''}
                            </span>
                          )}
                          {(t.entry.penalties || []).length > 0 && (
                            <span className="block text-[11px] font-semibold text-red-600">
                              {(t.entry.penalties || []).map((p) => `${penaltyChipText(p)}${(Number(p.count) || 1) > 1 ? `×${p.count}` : ''}`).join(' ')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <p className="flex items-center gap-1.5 text-muted-foreground"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Current maneuver scored</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={liveRanking} onChange={(e) => setLiveRanking(e.target.checked)} className="h-4 w-4" />
                Live score ranking
              </label>
            </div>
            </div>

            <div className="rounded-md border p-3 lg:sticky lg:top-4 lg:self-start">
              <p className="text-xs text-muted-foreground">SELECTED EXHIBITOR</p>
              {selected ? (
                <>
                  {(() => {
                    const t = tiles.find((x) => x.entry.id === selected.id);
                    const cur = selectedScoreOf(selected);
                    return (
                      <>
                        <div className="flex items-start justify-between">
                          {editingBn ? bnEditor : (
                            <p className="flex items-center gap-1 text-3xl font-bold">#{selected.back_number}{!locked && bnPencil}</p>
                          )}
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Total score</p>
                            <p className="text-2xl font-bold">{formatScore(t?.total) || 0}</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-blue-600">{maneuverLabel(maneuvers[selectedManeuver])}</p>
                        <p className="text-xs text-muted-foreground">
                          {cur === null ? 'Awaiting score' : <>Scored <span className={`font-semibold ${scoreColor(cur)}`}>{cur > 0 ? '+' : ''}{formatScore(cur) || 0}</span></>}
                          {t?.placing ? ` · ${ordinal(t.placing)}` : ''} · {t?.scored || 0}/{count} scored
                        </p>
                      </>
                    );
                  })()}
                  <select value="" onChange={(e) => { const r = penaltyRules.find((x) => String(x.id ?? x.name) === e.target.value); if (r) applyPenalty(selected, r); }}
                    className="mt-3 h-10 w-full rounded-md border-2 border-red-400 bg-background px-2 text-sm text-red-600">
                    <option value="">Penalty</option>
                    {penaltyRules.map((r) => <option key={String(r.id ?? r.name)} value={String(r.id ?? r.name)}>{penaltyMenuLabel(r)}</option>)}
                  </select>
                  <div className="mt-2 space-y-1.5">
                    {quickScores.map((v) => (
                      <button key={v} type="button" onClick={() => applyScore(selected, v)}
                        className={`flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-bold hover:bg-accent ${scoreColor(v)} ${selectedScoreOf(selected) === v ? 'border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/40' : ''}`}>
                        {v > 0 ? '+' : ''}{formatScore(v) || 0}
                        {nameOf(v, isFinal) && <span className="font-normal text-foreground">{nameOf(v, isFinal)}</span>}
                      </button>
                    ))}
                  </div>
                  {(selected.penalties || []).length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-red-600">
                      <span>Penalties:</span>
                      {(selected.penalties || []).map((p, i) => (
                        <button key={`${p.id}-${p.maneuver}-${i}`} type="button" title="Remove one"
                          onClick={() => saveEntry(selected, { penalties: removePenaltyOnce(selected.penalties, i) })}
                          className="rounded border border-red-300 px-1.5 py-0.5 hover:bg-red-50">
                          {penaltyChipText(p)}{(Number(p.count) || 1) > 1 ? `×${p.count}` : ''} ✕
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <Button variant={selected.contender ? 'default' : 'outline'} size="sm" onClick={() => toggleFlag(selected, 'contender')}>Contender</Button>
                    <Button variant={selected.recheck ? 'default' : 'outline'} size="sm" onClick={() => toggleFlag(selected, 'recheck')}>Recheck</Button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <Button variant="outline" size="sm" disabled={!(selected.undo_log || []).length} onClick={() => undoLast(selected)}>Undo last entry</Button>
                    <Button variant="outline" size="sm" disabled={selectedScoreOf(selected) === null} onClick={() => clearScore(selected)}>Clear score</Button>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-3 text-destructive" onClick={remove}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Remove exhibitor
                  </Button>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Click an exhibitor to select it.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scorecard for the selected exhibitor */}
      {selected && (() => {
        const sc = scorecardOf(selected, Number(rules?.starting_score) || 0, count);
        const cell = 'px-1.5 py-1 border-b';
        const num = (v) => (v === null || v === undefined ? '' : formatScore(v) || 0);
        const placingOf = tiles.find((x) => x.entry.id === selected.id)?.placing || null;
        return (
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">
                Scorecard <span className="ml-2 text-sm font-normal text-muted-foreground">Back number</span>{' '}
                {editingBn ? <span className="inline-block align-middle">{bnEditor}</span> : (
                  <>
                    <span className="text-lg font-bold">{selected.back_number}</span>
                    {!locked && <span className="ml-1 inline-block align-middle">{bnPencil}</span>}
                  </>
                )}
                {placingOf && <span className="ml-2 text-sm font-semibold text-emerald-600">Place {placingOf}</span>}
              </h2>
              <div className="flex items-center gap-2">
                {sc.status !== 'ok' && <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{sc.status === 'dq' ? 'DQ' : 'ZERO'}</span>}
                <span className="text-sm text-muted-foreground">{sc.scoredCount}/{count}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-center text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className={`${cell} text-left`}></th>
                    {maneuvers.map((n, i) => (
                      <th key={i} className={`${cell} font-medium leading-tight ${i === selectedManeuver ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40' : ''}`} title={n}>
                        <span className="block">{i + 1}. {splitManeuver(n).short}</span>
                        <span className="block text-[10px] font-normal text-muted-foreground">{splitManeuver(n).side || '—'}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`${cell} text-left font-medium`}>Score</td>
                    {sc.scores.map((v, i) => {
                      const opts = [...(finalScores && i === count - 1 ? finalScores : rules?.maneuver_scores || [])].map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => b - a);
                      return (
                        <td key={i} className={`${cell} ${i === selectedManeuver ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                          <select value={v === null ? '' : String(v)}
                            onChange={(e) => (e.target.value === '' ? clearScore(selected, i) : applyScore(selected, Number(e.target.value), i))}
                            className={`h-8 w-full min-w-[3.5rem] rounded border bg-background px-1 text-center text-xs font-semibold ${v === null ? 'text-muted-foreground' : scoreColor(v)}`}>
                            <option value="">+ Add</option>
                            {opts.map((o) => <option key={o} value={String(o)}>{o > 0 ? '+' : ''}{formatScore(o) || 0}{nameOf(o, !!finalScores && i === count - 1) ? ` ${nameOf(o, !!finalScores && i === count - 1)}` : ''}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className={`${cell} text-left font-medium`}>Penalty</td>
                    {sc.penaltyByManeuver.map((v, i) => (
                      <td key={i} className={`${cell} bg-red-50/40 dark:bg-red-950/10`}>
                        {v > 0 && <span className="block pb-0.5 font-semibold text-red-600">-{num(v)}</span>}
                        <select value="" onChange={(e) => { const r = penaltyRules.find((x) => String(x.id ?? x.name) === e.target.value); if (r) applyPenalty(selected, r, i); }}
                          className="h-7 w-full min-w-[3.5rem] rounded border bg-background px-1 text-center text-[11px] text-muted-foreground">
                          <option value="">+ Add</option>
                          {penaltyRules.map((r) => <option key={String(r.id ?? r.name)} value={String(r.id ?? r.name)}>{penaltyMenuLabel(r)}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`${cell} text-left font-medium`}>Running</td>
                    {sc.running.map((v, i) => <td key={i} className={cell}>{num(v)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-3 text-center">
              <div><p className="text-xs text-muted-foreground">Raw score</p><p className="text-xl font-bold">{num(sc.raw)}</p></div>
              <div><p className="text-xs text-muted-foreground">Penalty total</p><p className={`text-xl font-bold ${sc.penaltyTotal > 0 ? 'text-red-600' : ''}`}>{sc.penaltyTotal > 0 ? `-${num(sc.penaltyTotal)}` : '0'}</p></div>
              <div><p className="text-xs text-muted-foreground">Total score</p><p className="text-xl font-bold">{num(sc.total)}</p></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ScoringLiveBoard;
