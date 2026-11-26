import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { nextWorkOrder, cleanBackNumber, buildPlacings, formatScore, workOrderLabel } from '@/lib/scoringSheetInfo';
import { ordinal } from '@/lib/scoreMath';
import ScoringHorseCard from '@/components/scoring/ScoringHorseCard';

/**
 * The horses on one score sheet: add a horse by back number (step 3b), then score it
 * (step 3c). Scores and penalties are saved the moment they change.
 */
const ScoringHorseList = ({ showId, sheetKey, rules, maneuvers }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [completedAt, setCompletedAt] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [backNumber, setBackNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const addInputRef = useRef(null);
  const [scrollToId, setScrollToId] = useState(null);

  // After "Done": jump up to the Add horse box so the next back number can be typed at once.
  const goToAddBox = () => {
    setTimeout(() => {
      addInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      addInputRef.current?.focus({ preventScroll: true });
    }, 50);
  };

  // After "Add horse": the new horse is the one at the bottom; scroll down to it.
  useEffect(() => {
    if (!scrollToId) return;
    const t = setTimeout(() => {
      document.getElementById(`horse-${scrollToId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToId(null);
    }, 80);
    return () => clearTimeout(t);
  }, [scrollToId, entries]);

  // Tiebreaker chosen by the judge for this class: an ordered list of steps ([] = none).
  const [tiebreak, setTiebreak] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('scoring_class_settings')
        .select('tiebreak').eq('show_id', showId).eq('sheet_key', sheetKey).maybeSingle();
      if (!cancelled) setTiebreak(Array.isArray(data?.tiebreak) ? data.tiebreak : []);
    })();
    return () => { cancelled = true; };
  }, [showId, sheetKey]);

  const saveTiebreak = async (steps) => {
    const before = tiebreak;
    setTiebreak(steps);
    const { error } = await supabase.from('scoring_class_settings').upsert(
      { show_id: showId, sheet_key: sheetKey, tiebreak: steps, updated_at: new Date().toISOString() },
      { onConflict: 'show_id,sheet_key' },
    );
    if (error) {
      setTiebreak(before);
      toast({ title: 'Could not save the tiebreaker', description: error.message, variant: 'destructive' });
    }
  };

  // Up to two tiebreakers, checked in order. Each kind can be used once.
  const stepType = (n) => tiebreak[n]?.type || 'none';
  const maneuverOrder = tiebreak.find((t) => t.type === 'maneuvers')?.order || [];
  const setSlot = (n, type) => {
    const slots = [tiebreak[0] || null, tiebreak[1] || null];
    slots[n] = type === 'none' ? null : type === 'maneuvers' ? { type, order: slots[n]?.type === 'maneuvers' ? slots[n].order : [] } : { type };
    saveTiebreak(slots.filter(Boolean));
  };
  const setManeuverOrder = (order) => saveTiebreak(tiebreak.map((t) => (t.type === 'maneuvers' ? { ...t, order } : t)));
  const hasManeuvers = tiebreak.some((t) => t.type === 'maneuvers');

  const placings = useMemo(
    () => buildPlacings(entries, rules.starting_score, maneuvers.length, tiebreak),
    [entries, rules.starting_score, maneuvers.length, tiebreak],
  );

  const setAll = useCallback((next) => { entriesRef.current = next; setEntries(next); }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('scoring_entries').select('*')
      .eq('show_id', showId).eq('sheet_key', sheetKey)
      .order('work_order');
    if (error) toast({ title: 'Could not load horses', description: error.message, variant: 'destructive' });
    else setAll(data || []);
    setLoading(false);
  }, [showId, sheetKey, toast, setAll]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const add = async (e) => {
    e?.preventDefault();
    const bn = cleanBackNumber(backNumber);
    if (!bn) { toast({ title: 'Type a back number first', variant: 'destructive' }); return; }
    if (entries.some((x) => x.back_number.toLowerCase() === bn.toLowerCase())) {
      toast({ title: `Back number ${bn} is already on this sheet`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: created, error } = await supabase.from('scoring_entries').insert({
      show_id: showId, sheet_key: sheetKey, back_number: bn, work_order: nextWorkOrder(entries),
    }).select('id').single();
    setSaving(false);
    if (error) {
      // 23505 = another device added a horse at the same moment; reload and let them retry.
      if (error.code === '23505') { await load(); toast({ title: 'The list changed. Please try again.', variant: 'destructive' }); }
      else toast({ title: 'Could not add the horse', description: error.message, variant: 'destructive' });
      return;
    }
    setBackNumber('');
    await load();
    if (created?.id) setScrollToId(created.id);
  };

  // Show the change at once, then save it. If saving fails, put the saved data back.
  const change = async (id, patch) => {
    setAll(entriesRef.current.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('scoring_entries')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Could not save that score', description: error.message, variant: 'destructive' });
      await load();
    }
  };

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

  const notDone = entries.filter((x) => !x.is_done).length;

  // Save the placings as they are now, then go back to the class list to pick the next class.
  const completeClass = async () => {
    setCompleting(true);
    const results = placings.ranked.map((x) => ({
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

  const remove = async (id) => {
    const { error } = await supabase.from('scoring_entries').delete().eq('id', id);
    if (error) { toast({ title: 'Could not remove the horse', description: error.message, variant: 'destructive' }); return; }
    await load();
  };

  return (
    <div className="mb-4">
      <div className="mb-3 rounded-lg border px-4 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-medium">Tiebreakers</span>
          {[0, 1].map((n) => {
            const other = stepType(n === 0 ? 1 : 0);
            return (
              <label key={n} className="flex items-center gap-2">
                <span className="text-muted-foreground">{n === 0 ? 'First' : 'Second'}</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
                  value={stepType(n)}
                  disabled={n === 1 && tiebreak.length === 0}
                  onChange={(e) => setSlot(n, e.target.value)}
                  aria-label={`${n === 0 ? 'First' : 'Second'} tiebreaker`}
                >
                  <option value="none">{n === 0 ? 'None (tied horses share the placing)' : 'None'}</option>
                  <option value="penalties" disabled={other === 'penalties'}>Penalties (fewer wins)</option>
                  <option value="maneuvers" disabled={other === 'maneuvers'}>Maneuver scores (higher wins)</option>
                </select>
              </label>
            );
          })}
        </div>
        {hasManeuvers && (
          <div className="mt-2">
            <p className="mb-1.5 text-xs text-muted-foreground">
              Maneuver scores: click the maneuvers in the order to check. The higher score on the first one that differs wins. Penalties do not count.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {maneuvers.map((m, i) => {
                const pos = maneuverOrder.indexOf(i);
                const on = pos >= 0;
                return (
                  <button
                    key={`${m}-${i}`}
                    type="button"
                    onClick={() => setManeuverOrder(on ? maneuverOrder.filter((x) => x !== i) : [...maneuverOrder, i])}
                    className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                    title={on ? 'Click to take out of the order' : 'Click to add to the order'}
                  >
                    {on && (
                      <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-primary" title={`Checked number ${pos + 1}`}>
                        {pos + 1}
                      </span>
                    )}
                    {i + 1}. {m}
                  </button>
                );
              })}
              {maneuverOrder.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setManeuverOrder([])}>Clear order</Button>
              )}
            </div>
            {maneuverOrder.length === 0 && <p className="mt-1 text-xs text-amber-700">No maneuver order chosen yet, so this tiebreaker does nothing.</p>}
          </div>
        )}
      </div>

      <div className="mb-3 rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Horses in this class ({entries.length})</h2>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input
            ref={addInputRef}
            value={backNumber}
            onChange={(e) => setBackNumber(e.target.value)}
            placeholder="Back number, e.g. 1001"
            inputMode="numeric"
            className="h-11 w-56 text-base"
          />
          <Button type="submit" className="h-11" disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Add horse
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
                {notDone > 0
                  ? `${notDone} horse${notDone === 1 ? ' is' : 's are'} not marked Done. Complete the class anyway?`
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

      {placings.ranked.length > 0 && (
        <div className="mb-3 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-950/40">
          <h2 className="mb-1.5 text-sm font-semibold">Placings</h2>
          {/* Small one-line boxes, filled across: 1-8 on the first line, 9-16 on the next. */}
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {placings.ranked.map((x) => (
              <li key={x.id} className="flex items-baseline gap-1.5 whitespace-nowrap rounded bg-white px-2 py-1 text-xs shadow-sm dark:bg-emerald-900/30">
                <span className={`font-bold ${x.placing ? 'text-sm' : 'text-red-700'}`}>
                  {x.placing ? ordinal(x.placing) : 'DQ'}
                </span>
                <span className="font-medium">#{x.backNumber}</span>
                <span className="font-semibold">{x.status === 'dq' ? '—' : formatScore(x.total)}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{workOrderLabel(x.workOrder)}</span>
              </li>
            ))}
          </ol>
          {placings.waiting > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {placings.waiting} horse{placings.waiting === 1 ? '' : 's'} not scored yet.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">No horses yet. Add the first back number above.</p>
      ) : (
        entries.map((x) => (
          <ScoringHorseCard
            key={x.id}
            entry={x}
            rules={rules}
            maneuvers={maneuvers}
            placing={placings.ranked.find((r) => r.id === x.id)?.placing ?? null}
            onChange={(patch) => change(x.id, patch)}
            onRemove={() => remove(x.id)}
            onDone={goToAddBox}
          />
        ))
      )}
    </div>
  );
};

export default ScoringHorseList;
