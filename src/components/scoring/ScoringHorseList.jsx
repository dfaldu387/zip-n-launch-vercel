import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
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
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [backNumber, setBackNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const placings = useMemo(
    () => buildPlacings(entries, rules.starting_score, maneuvers.length),
    [entries, rules.starting_score, maneuvers.length],
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
    const { error } = await supabase.from('scoring_entries').insert({
      show_id: showId, sheet_key: sheetKey, back_number: bn, work_order: nextWorkOrder(entries),
    });
    setSaving(false);
    if (error) {
      // 23505 = another device added a horse at the same moment; reload and let them retry.
      if (error.code === '23505') { await load(); toast({ title: 'The list changed. Please try again.', variant: 'destructive' }); }
      else toast({ title: 'Could not add the horse', description: error.message, variant: 'destructive' });
      return;
    }
    setBackNumber('');
    await load();
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

  const remove = async (id) => {
    const { error } = await supabase.from('scoring_entries').delete().eq('id', id);
    if (error) { toast({ title: 'Could not remove the horse', description: error.message, variant: 'destructive' }); return; }
    await load();
  };

  return (
    <div className="mb-4">
      <div className="mb-3 rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Horses in this class ({entries.length})</h2>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input
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
      </div>

      {placings.ranked.length > 0 && (
        <div className="mb-3 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4">
          <h2 className="mb-2 font-semibold">Placings</h2>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {placings.ranked.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 shadow-sm">
                <span className={`w-12 text-xl font-bold ${x.placing ? '' : 'text-red-700 text-sm'}`}>
                  {x.placing ? ordinal(x.placing) : 'DQ'}
                </span>
                <span className="flex-1">
                  <span className="block font-medium">Back # {x.backNumber}</span>
                  <span className="block text-xs text-muted-foreground">{workOrderLabel(x.workOrder)}</span>
                </span>
                <span className="text-lg font-semibold">{x.status === 'dq' ? '—' : formatScore(x.total)}</span>
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
          />
        ))
      )}
    </div>
  );
};

export default ScoringHorseList;
