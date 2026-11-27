import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, CheckCircle2, Trash2, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { nextWorkOrder, cleanBackNumber, workOrderLabel } from '@/lib/scoringSheetInfo';
import { ordinal } from '@/lib/scoreMath';
import { parseTime, formatTime, rankByTime, penaltySeconds } from '@/lib/scoringTime';

// One horse: type its time, add penalties (seconds), or mark "DQ / No time".
// The time is saved when you leave the box or press Enter.
const TimeRow = ({ entry, placing, finalSeconds, rules, locked, onTime, onNoTime, onPenalty, onRemove }) => {
  const penalties = (rules?.penalties || []).filter((p) => !p.kind || p.kind === 'normal');
  const extra = penaltySeconds(entry, rules);
  const [draft, setDraft] = useState(entry.time_seconds != null ? formatTime(entry.time_seconds) : '');
  useEffect(() => { setDraft(entry.time_seconds != null ? formatTime(entry.time_seconds) : ''); }, [entry.time_seconds]);

  const commit = () => {
    const parsed = parseTime(draft);
    if (draft.trim() !== '' && parsed === null) { setDraft(entry.time_seconds != null ? formatTime(entry.time_seconds) : ''); return; }
    if (parsed === (entry.time_seconds != null ? Number(entry.time_seconds) : null)) return;
    onTime(parsed);
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${entry.no_time ? 'bg-muted/50' : 'bg-card'}`}>
      <span className="w-14 text-lg font-bold">{entry.no_time ? 'DQ' : placing ? ordinal(placing) : '—'}</span>
      <span className="min-w-[90px]">
        <span className="block text-xl font-bold">#{entry.back_number}</span>
        <span className="block text-[10px] text-muted-foreground">{workOrderLabel(entry.work_order)}</span>
      </span>
      <Input
        value={entry.no_time ? '' : draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        placeholder={entry.no_time ? 'No time' : 'Time, e.g. 17.342'}
        inputMode="decimal"
        disabled={locked || entry.no_time}
        aria-label={`Time for ${entry.back_number}`}
        className="h-11 w-40 text-base"
      />
      <span className="text-sm text-muted-foreground">sec</span>
      {!entry.no_time && finalSeconds !== null && (
        <span className="text-sm">
          <span className="text-muted-foreground">Final </span>
          <b className="text-base">{formatTime(finalSeconds)}</b>
          {extra > 0 && <span className="text-xs text-muted-foreground"> (+{extra} sec penalties)</span>}
        </span>
      )}
      {!entry.no_time && penalties.length > 0 && (
        <div className="flex basis-full flex-wrap items-center gap-1.5">
          {penalties.map((p) => {
            const count = Number(entry.time_penalties?.[p.id]) || 0;
            return (
              <span key={p.id} className={`inline-flex items-center overflow-hidden rounded-md border text-xs ${count > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : ''}`}>
                <button type="button" disabled={locked} onClick={() => onPenalty(p.id, count + 1)}
                  className="px-2 py-1.5 hover:bg-accent disabled:opacity-60">
                  + {p.name} ({Number(p.points)} sec){count > 0 && <b className="ml-1 text-red-700 dark:text-red-300">×{count}</b>}
                </button>
                {count > 0 && !locked && (
                  <button type="button" aria-label={`Remove one ${p.name}`} onClick={() => onPenalty(p.id, count - 1)}
                    className="border-l px-2 py-1.5 font-bold hover:bg-accent">−</button>
                )}
              </span>
            );
          })}
        </div>
      )}
      {!locked && (
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={entry.no_time ? 'default' : 'outline'} onClick={onNoTime}>
            <Ban className="mr-1.5 h-4 w-4" />{entry.no_time ? 'Add a time' : 'DQ / No time'}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove} aria-label="Remove exhibitor">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * "Live Scoring by Time": the judge adds exhibitors and types a time for each one.
 * The fastest time places first. Rows stay in the order they were added, so they do not
 * jump around while typing; the placings are shown in their own box above.
 */
const ScoringTimeBoard = ({ showId, sheetKey, rules }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [backNumber, setBackNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [completedAt, setCompletedAt] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const addInputRef = useRef(null);

  const setAll = useCallback((next) => { entriesRef.current = next; setEntries(next); }, []);
  const ranking = useMemo(() => rankByTime(entries, rules), [entries, rules]);
  const placingOf = (id) => ranking.ranked.find((x) => x.id === id)?.placing ?? null;
  const finalOf = (id) => ranking.ranked.find((x) => x.id === id)?.time ?? null;
  const setPenalty = (entry, penaltyId, count) => {
    const next = { ...(entry.time_penalties || {}) };
    if (count > 0) next[penaltyId] = count; else delete next[penaltyId];
    change(entry.id, { time_penalties: next });
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('scoring_entries').select('*')
      .eq('show_id', showId).eq('sheet_key', sheetKey).order('work_order');
    if (error) toast({ title: 'Could not load exhibitors', description: error.message, variant: 'destructive' });
    else setAll(data || []);
    setLoading(false);
  }, [showId, sheetKey, toast, setAll]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('scoring_class_results')
        .select('completed_at').eq('show_id', showId).eq('sheet_key', sheetKey).maybeSingle();
      if (!cancelled) setCompletedAt(data?.completed_at || null);
    })();
    return () => { cancelled = true; };
  }, [showId, sheetKey]);

  const add = async (e) => {
    e?.preventDefault();
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

  // Show the change at once, then save it. If saving fails, put the saved data back.
  const change = async (id, patch) => {
    setAll(entriesRef.current.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('scoring_entries')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Could not save that time', description: error.message, variant: 'destructive' });
      await load();
    }
  };

  const remove = async (id) => {
    const { error } = await supabase.from('scoring_entries').delete().eq('id', id);
    if (error) { toast({ title: 'Could not remove the exhibitor', description: error.message, variant: 'destructive' }); return; }
    await load();
  };

  const completeClass = async () => {
    setCompleting(true);
    const results = ranking.ranked.map((x) => ({
      placing: x.placing,
      back_number: x.back_number,
      work_order: x.work_order,
      total: x.time,
      status: x.no_time ? 'no_time' : x.time !== null ? 'timed' : 'no_time',
      raw_time: x.time_seconds != null ? Number(x.time_seconds) : null,
      penalty_seconds: penaltySeconds(x, rules),
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

  const locked = !!completedAt;
  const placedList = ranking.ranked.filter((x) => x.placing);

  return (
    <div className="mb-4 space-y-3">
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Exhibitors in this class ({entries.length})</h2>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input ref={addInputRef} value={backNumber} onChange={(e) => setBackNumber(e.target.value)}
            placeholder="Back number, e.g. 1001" inputMode="numeric" className="h-11 w-56 text-base" disabled={locked} />
          <Button type="submit" className="h-11" disabled={saving || locked}>
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
              <Button size="sm" variant="ghost" onClick={reopenClass}>Reopen class</Button>
            </div>
          ) : confirmComplete ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {ranking.waiting > 0
                  ? `${ranking.waiting} exhibitor${ranking.waiting === 1 ? ' has' : 's have'} no time yet and will have no placing. Complete the class anyway?`
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

      {placedList.length > 0 && (
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-950/40">
          <h2 className="mb-1.5 text-sm font-semibold">Placings (fastest first)</h2>
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {placedList.map((x) => (
              <li key={x.id} className="flex items-baseline gap-1.5 whitespace-nowrap rounded bg-white px-2 py-1 text-xs shadow-sm dark:bg-emerald-900/30">
                <span className="text-sm font-bold">{ordinal(x.placing)}</span>
                <span className="font-medium">#{x.back_number}</span>
                <span className="ml-auto font-semibold">{formatTime(x.time)}</span>
              </li>
            ))}
          </ol>
          {(ranking.waiting > 0 || ranking.noTime > 0) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {ranking.waiting > 0 && `${ranking.waiting} waiting for a time. `}{ranking.noTime > 0 && `${ranking.noTime} with no time.`}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">No exhibitors yet. Add the first back number above.</p>
      ) : (
        <div className="space-y-2">
          {locked && <p className="text-xs text-muted-foreground">The class is completed. Reopen it to change the times.</p>}
          {entries.map((x) => (
            <TimeRow key={x.id} entry={x} placing={placingOf(x.id)} finalSeconds={finalOf(x.id)} rules={rules} locked={locked}
              onPenalty={(pid, count) => setPenalty(x, pid, count)}
              onTime={(t) => change(x.id, { time_seconds: t })}
              onNoTime={() => change(x.id, x.no_time ? { no_time: false } : { no_time: true })}
              onRemove={() => remove(x.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ScoringTimeBoard;
