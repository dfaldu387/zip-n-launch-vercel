import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, CheckCircle2, Trash2, GripVertical, StickyNote } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { nextWorkOrder, cleanBackNumber, workOrderLabel } from '@/lib/scoringSheetInfo';
import { ordinal } from '@/lib/scoreMath';
import { sortByPlaceOrder, reorderPlaces } from '@/lib/scoringNotesOrder';

// One exhibitor box. Drag it to move it; click it to open its notes.
const Box = ({ entry, place, selected, onSelect, disabled }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id, disabled });
  const hasNotes = !!entry.notes?.trim();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`relative flex min-h-[84px] touch-manipulation select-none flex-col items-center justify-center rounded-lg border-2 bg-card px-2 py-3 text-center shadow-sm ${disabled ? '' : 'cursor-grab active:cursor-grabbing'} ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'} ${isDragging ? 'opacity-80 shadow-lg' : ''}`}
    >
      <span className="absolute left-1.5 top-1 text-xs font-bold text-muted-foreground">{ordinal(place)}</span>
      {!disabled && <GripVertical className="absolute right-1 top-1 h-4 w-4 text-muted-foreground/60" />}
      <span className="text-xl font-bold">{entry.back_number}</span>
      <span className="text-[10px] text-muted-foreground">{workOrderLabel(entry.work_order)}</span>
      {hasNotes && <StickyNote className="absolute bottom-1 right-1.5 h-3.5 w-3.5 text-amber-600" aria-label="Has notes" />}
    </div>
  );
};

/**
 * "Live Scoring with Notes": no scores. The judge adds exhibitors, drags the boxes into
 * placing order, and can type notes on any exhibitor. The order is saved on every drop.
 */
const ScoringNotesBoard = ({ showId, sheetKey }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [backNumber, setBackNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [completedAt, setCompletedAt] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  const setAll = useCallback((next) => { entriesRef.current = next; setEntries(next); }, []);
  const ordered = useMemo(() => sortByPlaceOrder(entries), [entries]);
  const selected = ordered.find((x) => x.id === selectedId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  // The notes box follows whichever exhibitor is selected.
  useEffect(() => { setNoteDraft(selected?.notes || ''); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e) => {
    e?.preventDefault();
    const bn = cleanBackNumber(backNumber);
    if (!bn) { toast({ title: 'Type a back number first', variant: 'destructive' }); return; }
    if (entries.some((x) => x.back_number.toLowerCase() === bn.toLowerCase())) {
      toast({ title: `Back number ${bn} is already in this class`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const nextPlace = entries.reduce((m, x) => Math.max(m, Number(x.place_order) || 0), 0) + 1;
    const { data: created, error } = await supabase.from('scoring_entries').insert({
      show_id: showId, sheet_key: sheetKey, back_number: bn, work_order: nextWorkOrder(entries), place_order: nextPlace,
    }).select('id').single();
    setSaving(false);
    if (error) {
      if (error.code === '23505') { await load(); toast({ title: 'The list changed. Please try again.', variant: 'destructive' }); }
      else toast({ title: 'Could not add the exhibitor', description: error.message, variant: 'destructive' });
      return;
    }
    setBackNumber('');
    await load();
    if (created?.id) setSelectedId(created.id);
  };

  // Drop: show the new order at once, then save only the boxes whose place changed.
  const onDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const current = sortByPlaceOrder(entriesRef.current);
    const from = current.findIndex((x) => x.id === active.id);
    const to = current.findIndex((x) => x.id === over.id);
    if (from < 0 || to < 0) return;
    const { next, changes } = reorderPlaces(arrayMove(current, from, to));
    setAll(next);
    const results = await Promise.all(changes.map((c) => supabase.from('scoring_entries')
      .update({ place_order: c.place_order, updated_at: new Date().toISOString() }).eq('id', c.id)));
    const failed = results.find((r) => r.error);
    if (failed) {
      toast({ title: 'Could not save the new order', description: failed.error.message, variant: 'destructive' });
      await load();
    }
  };

  const saveNotes = async () => {
    if (!selected || noteDraft === (selected.notes || '')) return;
    const id = selected.id;
    const text = noteDraft;
    setAll(entriesRef.current.map((x) => (x.id === id ? { ...x, notes: text } : x)));
    const { error } = await supabase.from('scoring_entries')
      .update({ notes: text, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ title: 'Could not save the notes', description: error.message, variant: 'destructive' });
      await load();
    }
  };

  const remove = async () => {
    if (!selected) return;
    const { error } = await supabase.from('scoring_entries').delete().eq('id', selected.id);
    if (error) { toast({ title: 'Could not remove the exhibitor', description: error.message, variant: 'destructive' }); return; }
    setSelectedId(null);
    await load();
  };

  const completeClass = async () => {
    setCompleting(true);
    const results = ordered.map((x, i) => ({
      placing: i + 1, back_number: x.back_number, work_order: x.work_order, total: null, status: 'placed', notes: x.notes || '',
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

  return (
    <div className="mb-4 space-y-3">
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Exhibitors in this class ({entries.length})</h2>
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input value={backNumber} onChange={(e) => setBackNumber(e.target.value)} placeholder="Back number, e.g. 1001"
            inputMode="numeric" className="h-11 w-56 text-base" disabled={locked} />
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
              <span>Complete this class and save the placings as shown?</span>
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

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">No exhibitors yet. Add the first back number above.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              {locked ? 'The class is completed. Reopen it to change the order.' : 'Drag a box to change its placing. Click a box to add notes.'}
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ordered.map((x) => x.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                  {ordered.map((x, i) => (
                    <Box key={x.id} entry={x} place={i + 1} selected={x.id === selectedId} disabled={locked}
                      onSelect={() => setSelectedId(x.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="rounded-lg border p-4 lg:sticky lg:top-4 lg:self-start">
            {selected ? (
              <>
                <p className="text-xs text-muted-foreground">Selected exhibitor</p>
                <p className="text-2xl font-bold">#{selected.back_number}</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {ordinal(ordered.findIndex((x) => x.id === selected.id) + 1)} place · {workOrderLabel(selected.work_order)}
                </p>
                <label className="mb-1 block text-sm font-medium" htmlFor="exhibitor-notes">Notes</label>
                <textarea id="exhibitor-notes" rows={6} value={noteDraft} disabled={locked}
                  onChange={(e) => setNoteDraft(e.target.value)} onBlur={saveNotes}
                  placeholder="Type notes about this exhibitor..."
                  className="w-full rounded-md border bg-background p-2 text-sm disabled:opacity-60" />
                <p className="mt-1 text-xs text-muted-foreground">Saved when you tap outside the box.</p>
                {!locked && (
                  <Button variant="ghost" size="sm" className="mt-3 text-destructive" onClick={remove}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Remove exhibitor
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Click an exhibitor box to add notes.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoringNotesBoard;
