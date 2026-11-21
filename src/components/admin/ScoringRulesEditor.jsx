import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, PlusCircle, Trash2, X, Save, Copy, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

// 1.5 -> "1½", -0.5 -> "-½", 0.25 -> "¼". Anything else stays a plain number.
const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
export const formatScore = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    const abs = Math.abs(num);
    const whole = Math.floor(abs);
    const frac = Math.round((abs - whole) * 100) / 100;
    const sign = num < 0 ? '-' : '';
    if (frac === 0) return `${sign}${whole}`;
    if (FRACTIONS[frac]) return `${sign}${whole > 0 ? whole : ''}${FRACTIONS[frac]}`;
    return String(num);
};

const KIND_LABEL = { normal: 'Normal (subtract points)', zero: 'ZERO (total becomes 0)', dq: 'DQ (disqualified)' };
const PRESET_SCORES = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`);

// What gets compared to know whether there are unsaved changes.
const snapshot = (startingScore, penalties, scores) =>
    JSON.stringify({ s: String(startingScore), p: penalties.map(p => [p.name, String(p.points), p.kind]), m: scores });

// Pick a discipline that already has rules and hand them back. Nothing is saved here.
const CopyRulesDialog = ({ open, onOpenChange, currentDisciplineId, onPick }) => {
    const { toast } = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setFilter('');
        (async () => {
            const { data: ruleRows, error } = await supabase.from('scoring_rules').select('*');
            if (error) { if (!cancelled) { toast({ title: 'Could not load rules', description: error.message, variant: 'destructive' }); setLoading(false); } return; }
            const others = (ruleRows || []).filter(r => String(r.discipline_id) !== String(currentDisciplineId));
            if (others.length === 0) { if (!cancelled) { setItems([]); setLoading(false); } return; }
            const [{ data: discs }, { data: assocs }] = await Promise.all([
                supabase.from('disciplines').select('id, name, sub_association_type').in('id', others.map(r => r.discipline_id)),
                supabase.from('associations').select('id, name'),
            ]);
            if (cancelled) return;
            const discById = new Map((discs || []).map(d => [String(d.id), d]));
            const assocById = new Map((assocs || []).map(a => [String(a.id), a.name]));
            setItems(others.map(r => {
                const d = discById.get(String(r.discipline_id));
                const assoc = assocById.get(String(r.association_id)) || '';
                const shortAssoc = assoc.split(' - ')[0];
                const name = d ? (d.sub_association_type ? `${d.name} (${d.sub_association_type})` : d.name) : 'Unknown discipline';
                return { rule: r, label: `${shortAssoc ? `${shortAssoc} · ` : ''}${name}` };
            }).sort((a, b) => a.label.localeCompare(b.label)));
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [open, currentDisciplineId, toast]);

    const shown = items.filter(i => i.label.toLowerCase().includes(filter.trim().toLowerCase()));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Copy rules from another discipline</DialogTitle>
                    <DialogDescription>This fills in the form. Nothing is saved until you click Save.</DialogDescription>
                </DialogHeader>
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : items.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No other discipline has saved rules yet. Save rules for one discipline first.</p>
                ) : (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} />
                        </div>
                        <div className="max-h-72 space-y-1 overflow-y-auto">
                            {shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nothing matches.</p>}
                            {shown.map(({ rule, label }) => (
                                <button key={rule.id} type="button" onClick={() => onPick(rule)}
                                    className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left hover:bg-accent">
                                    <span className="font-medium">{label}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        start {rule.starting_score} · {(rule.penalties || []).length} {(rule.penalties || []).length === 1 ? 'penalty' : 'penalties'} · {(rule.maneuver_scores || []).length} {(rule.maneuver_scores || []).length === 1 ? 'score' : 'scores'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

const ScoringRulesEditor = ({ disciplineId, associationId, rules, onSaved }) => {
    const { toast } = useToast();
    const [startingScore, setStartingScore] = useState('70');
    const [penalties, setPenalties] = useState([]);
    const [scores, setScores] = useState([]);
    const [newScore, setNewScore] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savedSnapshot, setSavedSnapshot] = useState('');
    const [copyOpen, setCopyOpen] = useState(false);

    // Fill the form from another discipline's rules. Not saved until Save is clicked.
    const applyCopied = (source) => {
        setStartingScore(String(source.starting_score ?? 70));
        setPenalties((source.penalties || []).map(x => ({ id: newId(), name: x.name || '', points: x.points ?? '', kind: x.kind || 'normal' })));
        setScores([...(source.maneuver_scores || [])].map(Number).sort((a, b) => a - b));
        setNewScore('');
        setCopyOpen(false);
        toast({ title: 'Rules copied into the form', description: 'Check them, then click Save.' });
    };

    // Reload the form whenever a different discipline (or a fresh save) comes in.
    useEffect(() => {
        const s = String(rules.starting_score ?? 70);
        const p = (rules.penalties || []).map(x => ({ id: x.id || newId(), name: x.name || '', points: x.points ?? '', kind: x.kind || 'normal' }));
        const m = [...(rules.maneuver_scores || [])].map(Number).sort((a, b) => a - b);
        setStartingScore(s);
        setPenalties(p);
        setScores(m);
        setNewScore('');
        setSavedSnapshot(snapshot(s, p, m));
    }, [rules]);

    const isDirty = useMemo(() => snapshot(startingScore, penalties, scores) !== savedSnapshot, [startingScore, penalties, scores, savedSnapshot]);

    const updatePenalty = (id, patch) => setPenalties(list => list.map(p => (p.id === id ? { ...p, ...patch } : p)));
    const addPenalty = (kind = 'normal') => setPenalties(list => [...list, { id: newId(), name: kind === 'zero' ? 'ZERO' : kind === 'dq' ? 'DQ' : '', points: '', kind }]);

    const addScore = (value) => {
        const n = Number(value);
        if (value === '' || !Number.isFinite(n)) return;
        setScores(list => (list.includes(n) ? list : [...list, n].sort((a, b) => a - b)));
        setNewScore('');
    };

    const handleSave = async () => {
        const start = Number(startingScore);
        if (startingScore === '' || !Number.isFinite(start)) {
            toast({ title: 'Starting score needed', description: 'Enter a number, for example 70.', variant: 'destructive' });
            return;
        }
        for (const p of penalties) {
            if (!p.name.trim()) { toast({ title: 'A penalty has no name', description: 'Give every penalty a name or remove it.', variant: 'destructive' }); return; }
            if (p.kind === 'normal' && (p.points === '' || !Number.isFinite(Number(p.points)) || Number(p.points) < 0)) {
                toast({ title: `Points needed for "${p.name}"`, description: 'Enter the points to subtract, for example 1 or 0.5.', variant: 'destructive' });
                return;
            }
        }
        const cleanPenalties = penalties.map(p => ({
            id: p.id,
            name: p.name.trim(),
            kind: p.kind,
            points: p.kind === 'normal' ? Number(p.points) : 0,
        }));

        setIsSaving(true);
        const { data, error } = await supabase
            .from('scoring_rules')
            .upsert({
                discipline_id: String(disciplineId),
                association_id: associationId ? String(associationId) : null,
                starting_score: start,
                penalties: cleanPenalties,
                maneuver_scores: scores,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'discipline_id' })
            .select()
            .single();
        setIsSaving(false);

        if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
        toast({ title: 'Scoring rules saved' });
        onSaved({ exists: true, ...data });
    };

    return (
        <div className="space-y-8">
            {/* Starting score */}
            <section className="space-y-2">
                <Label htmlFor="starting-score" className="text-base font-semibold">Starting score</Label>
                <p className="text-sm text-muted-foreground">Every horse starts the class with this score.</p>
                <Input id="starting-score" type="number" step="0.5" inputMode="decimal" className="w-32"
                    value={startingScore} onChange={e => setStartingScore(e.target.value)} />
            </section>

            {/* Penalties */}
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 className="text-base font-semibold">Penalties</h3>
                        <p className="text-sm text-muted-foreground">A horse can have several penalties. ZERO and DQ are special.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => addPenalty('normal')}><PlusCircle className="mr-1.5 h-4 w-4" />Add penalty</Button>
                        <Button variant="outline" size="sm" onClick={() => addPenalty('zero')}>+ ZERO</Button>
                        <Button variant="outline" size="sm" onClick={() => addPenalty('dq')}>+ DQ</Button>
                    </div>
                </div>

                {penalties.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No penalties yet.</p>
                ) : (
                    <div className="space-y-2">
                        <div className="hidden sm:grid grid-cols-[1fr_110px_230px_40px] gap-2 px-1 text-xs font-medium text-muted-foreground">
                            <span>Name</span><span>Points</span><span>Type</span><span />
                        </div>
                        {penalties.map(p => (
                            <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_230px_40px] gap-2 items-center rounded-md border p-2 sm:border-0 sm:p-0">
                                <Input placeholder="Penalty name" value={p.name} onChange={e => updatePenalty(p.id, { name: e.target.value })} />
                                <Input type="number" step="0.5" min="0" inputMode="decimal" placeholder={p.kind === 'normal' ? 'e.g. 1' : '—'}
                                    disabled={p.kind !== 'normal'} value={p.kind === 'normal' ? p.points : ''}
                                    onChange={e => updatePenalty(p.id, { points: e.target.value })} />
                                <Select value={p.kind} onValueChange={v => updatePenalty(p.id, { kind: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(KIND_LABEL).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="text-destructive" aria-label="Remove penalty"
                                    onClick={() => setPenalties(list => list.filter(x => x.id !== p.id))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Maneuver scores */}
            <section className="space-y-3">
                <div>
                    <h3 className="text-base font-semibold">Maneuver scores</h3>
                    <p className="text-sm text-muted-foreground">The scores a judge can give for one maneuver. Fractions are fine (0.5 shows as ½).</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {scores.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground w-full">No maneuver scores yet.</p>}
                    {scores.map(s => (
                        <span key={s} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                            {s > 0 ? `+${formatScore(s)}` : formatScore(s)}
                            <button type="button" aria-label={`Remove ${s}`} className="rounded-full p-0.5 hover:bg-background"
                                onClick={() => setScores(list => list.filter(x => x !== s))}><X className="h-3.5 w-3.5" /></button>
                        </span>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Input type="number" step="0.5" inputMode="decimal" placeholder="e.g. 0.5" className="w-32"
                        value={newScore} onChange={e => setNewScore(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addScore(newScore); } }} />
                    <Button variant="outline" size="sm" onClick={() => addScore(newScore)}><PlusCircle className="mr-1.5 h-4 w-4" />Add score</Button>
                    <Button variant="ghost" size="sm" onClick={() => setScores(PRESET_SCORES)}>Use -1½ to +1½</Button>
                    {scores.length > 0 && <Button variant="ghost" size="sm" onClick={() => setScores([])}>Clear</Button>}
                </div>
            </section>

            {/* Save */}
            <div className="flex items-center gap-3 border-t pt-4">
                <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
                </Button>
                <Button variant="outline" onClick={() => setCopyOpen(true)}><Copy className="mr-2 h-4 w-4" />Copy from another discipline</Button>
                {isDirty && <span className="text-sm text-amber-600">Unsaved changes</span>}
            </div>
            <CopyRulesDialog open={copyOpen} onOpenChange={setCopyOpen} currentDisciplineId={disciplineId} onPick={applyCopied} />
        </div>
    );
};

export default ScoringRulesEditor;
