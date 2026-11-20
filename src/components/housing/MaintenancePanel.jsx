import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench, Plus, Loader2, Globe, Lock, Trash2, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import {
    MAINTENANCE_STATUSES, statusLabel, nextAction, statusPatch, sortRequests, countByStatus, cleanRequestInput,
} from '@/lib/maintenanceRequests';

// Grounds maintenance requests (Robert 2026-11-19). The office adds a request, acknowledges
// it, marks it done, and can publish it to the public Event page. Private by default.
// Stored in its own table (not the show's project_data, which is public) - see
// supabase/migrations/20261120160000_maintenance_requests.sql.

const STATUS_STYLE = {
    new: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
    acknowledged: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
    done: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
    cancelled: 'bg-muted text-muted-foreground border-border',
};

const fmt = (iso) => {
    try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
};

const EMPTY_FORM = { title: '', location: '', details: '', reported_by: '', contact: '', priority: 'normal' };

const RequestCard = ({ r, busy, onStatus, onPublic, onDelete }) => {
    const action = nextAction(r.status);
    const finished = r.status === 'done' || r.status === 'cancelled';
    return (
        <Card className={cn(r.priority === 'urgent' && !finished && 'border-rose-300 dark:border-rose-500/40')}>
            <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold leading-tight">{r.title}</p>
                            {r.priority === 'urgent' && !finished && (
                                <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-600 gap-1"><AlertTriangle className="h-3 w-3" /> Urgent</Badge>
                            )}
                        </div>
                        {r.location && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /> {r.location}</p>}
                    </div>
                    <Badge variant="outline" className={cn('text-[11px] whitespace-nowrap', STATUS_STYLE[r.status])}>{statusLabel(r.status)}</Badge>
                </div>

                {r.details && <p className="text-sm whitespace-pre-wrap">{r.details}</p>}

                {(r.reported_by || r.contact) && (
                    <p className="text-xs text-muted-foreground">
                        Reported by {[r.reported_by, r.contact].filter(Boolean).join(' · ')}
                        <span className="ml-1 italic">(private, never shown on the Event page)</span>
                    </p>
                )}

                <p className="text-[11px] text-muted-foreground">
                    Added {fmt(r.created_at)}
                    {r.acknowledged_at && ` · Acknowledged ${fmt(r.acknowledged_at)}`}
                    {r.done_at && ` · Done ${fmt(r.done_at)}`}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <label className={cn('flex items-center gap-2 text-sm', r.status === 'cancelled' && 'opacity-50')}>
                        <Switch checked={!!r.is_public} disabled={busy || r.status === 'cancelled'} onCheckedChange={(v) => onPublic(r, v)} />
                        <span className="flex items-center gap-1">
                            {r.is_public ? <Globe className="h-3.5 w-3.5 text-emerald-600" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                            {r.is_public ? 'Shown on Event page' : 'Show on Event page'}
                        </span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {action && (
                            <Button type="button" size="sm" className="h-8" disabled={busy} onClick={() => onStatus(r, action.to)}>
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" />{action.label}</>}
                            </Button>
                        )}
                        {(r.status === 'done' || r.status === 'cancelled') && (
                            <Button type="button" size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => onStatus(r, 'new')}>Reopen</Button>
                        )}
                        {r.status !== 'cancelled' && r.status !== 'done' && (
                            <Button type="button" size="sm" variant="ghost" className="h-8 text-muted-foreground" disabled={busy} onClick={() => onStatus(r, 'cancelled')}>Cancel request</Button>
                        )}
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-rose-600" title="Delete this request" aria-label="Delete this request" disabled={busy} onClick={() => onDelete(r)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const MaintenancePanel = ({ showId }) => {
    const { toast } = useToast();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [filter, setFilter] = useState('open');
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState('');
    const [toDelete, setToDelete] = useState(null);

    const load = useCallback(async () => {
        if (!showId) return;
        const { data, error } = await supabase.from('maintenance_requests').select('*').eq('show_id', showId).order('created_at', { ascending: false });
        if (error) { setLoadError(error.message || 'Could not load the requests.'); setRows([]); }
        else { setLoadError(''); setRows(data || []); }
        setLoading(false);
    }, [showId]);

    useEffect(() => { setLoading(true); load(); }, [load]);

    const counts = useMemo(() => countByStatus(rows), [rows]);
    const shown = useMemo(() => {
        const list = filter === 'all' ? rows : filter === 'open' ? rows.filter((r) => r.status === 'new' || r.status === 'acknowledged') : rows.filter((r) => r.status === filter);
        return sortRequests(list);
    }, [rows, filter]);

    const patch = async (r, fields, okText) => {
        setBusyId(r.id);
        const { data, error } = await supabase.from('maintenance_requests').update(fields).eq('id', r.id).select().single();
        setBusyId('');
        if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
        setRows((prev) => prev.map((x) => (x.id === r.id ? data : x)));
        if (okText) toast({ title: okText });
    };

    const changeStatus = (r, to) => patch(r, statusPatch(to), `${r.title}: ${statusLabel(to)}`);
    const changePublic = (r, on) => patch(r, { is_public: on }, on ? 'Now shown on the Event page' : 'Hidden from the Event page');

    const remove = async () => {
        const r = toDelete;
        setToDelete(null);
        if (!r) return;
        setBusyId(r.id);
        const { error } = await supabase.from('maintenance_requests').delete().eq('id', r.id);
        setBusyId('');
        if (error) { toast({ title: 'Could not delete', description: error.message, variant: 'destructive' }); return; }
        setRows((prev) => prev.filter((x) => x.id !== r.id));
    };

    const add = async () => {
        const clean = cleanRequestInput(form);
        if (!clean) { toast({ title: 'Please describe the problem', variant: 'destructive' }); return; }
        setSaving(true);
        const { data, error } = await supabase.from('maintenance_requests').insert({ ...clean, show_id: showId }).select().single();
        setSaving(false);
        if (error) { toast({ title: 'Could not add the request', description: error.message, variant: 'destructive' }); return; }
        setRows((prev) => [data, ...prev]);
        setForm(EMPTY_FORM); setAdding(false); setFilter('open');
        toast({ title: 'Request added' });
    };

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const FILTERS = [
        { key: 'open', label: 'Open', n: counts.open },
        ...MAINTENANCE_STATUSES.map((s) => ({ key: s.key, label: s.label, n: counts[s.key] })),
        { key: 'all', label: 'All', n: counts.all },
    ];

    return (
        <div className="space-y-4">
            <ConfirmationDialog
                isOpen={!!toDelete}
                onClose={() => setToDelete(null)}
                onConfirm={remove}
                title="Delete this request?"
                description={`"${toDelete?.title || ''}" will be removed for good. To keep a record, use Cancel request or Mark done instead.`}
                confirmText="Delete"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold">Grounds maintenance requests</h3>
                </div>
                {!adding && (
                    <Button type="button" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add request</Button>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
                Keep track of grounds problems. Acknowledge a request when you have seen it, mark it done when fixed.
                Turn on <strong>Show on Event page</strong> to tell exhibitors about it. Only the problem and the place are shown, never who reported it.
            </p>

            {adding && (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1 sm:col-span-2">
                                <label className="text-xs text-muted-foreground" htmlFor="mr-title">What is the problem? *</label>
                                <Input id="mr-title" autoFocus maxLength={160} value={form.title} onChange={set('title')} placeholder="e.g., Water leak at the wash rack" className="h-10" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground" htmlFor="mr-loc">Where?</label>
                                <Input id="mr-loc" maxLength={120} value={form.location} onChange={set('location')} placeholder="e.g., Barn A, aisle 2" className="h-10" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground" htmlFor="mr-pri">How urgent?</label>
                                <select id="mr-pri" value={form.priority} onChange={set('priority')} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                                    <option value="normal">Normal</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                                <label className="text-xs text-muted-foreground" htmlFor="mr-det">More details (private)</label>
                                <Textarea id="mr-det" maxLength={2000} rows={3} value={form.details} onChange={set('details')} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground" htmlFor="mr-by">Reported by (private)</label>
                                <Input id="mr-by" maxLength={120} value={form.reported_by} onChange={set('reported_by')} className="h-10" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground" htmlFor="mr-contact">Phone or email (private)</label>
                                <Input id="mr-contact" maxLength={120} value={form.contact} onChange={set('contact')} className="h-10" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" disabled={saving} onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}>Cancel</Button>
                            <Button type="button" disabled={saving || !form.title.trim()} onClick={add}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add request'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                    <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                        className={cn('rounded-full border px-3 py-1 text-xs font-medium transition',
                            filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted')}>
                        {f.label} ({f.n})
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : loadError ? (
                <Card><CardContent className="py-8 text-center space-y-1">
                    <AlertTriangle className="h-6 w-6 mx-auto text-amber-500" />
                    <p className="font-medium">Could not load the requests.</p>
                    <p className="text-sm text-muted-foreground">{loadError}</p>
                </CardContent></Card>
            ) : shown.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? 'No maintenance requests yet. Click Add request to start the list.' : 'Nothing here for this filter.'}
                </CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {shown.map((r) => (
                        <RequestCard key={r.id} r={r} busy={busyId === r.id} onStatus={changeStatus} onPublic={changePublic} onDelete={setToDelete} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default MaintenancePanel;
