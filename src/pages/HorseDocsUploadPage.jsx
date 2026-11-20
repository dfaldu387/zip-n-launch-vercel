import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, FileCheck2, AlertTriangle, Upload, CheckCircle2, Trash2, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { parseHorseDocToken } from '@/lib/horseDocLink';
import { HORSE_DOCS_BUCKET, horseDocPath, MAX_HORSES, getRequiredKinds } from '@/lib/horseDocs';
import { cn } from '@/lib/utils';

// Opened from the private link the show office sends (Robert, 2026-11-18): no login.
// The exhibitor types each horse's name (if the booking has none) and uploads a Health
// Certificate and a Coggins. The link carries its own secret; see
// supabase/migrations/20261119130000_horse_docs_public_upload.sql.

const MAX_BYTES = 15 * 1024 * 1024;

// One paper of one horse.
const UploadSlot = ({ kind, doc, busy, onPick }) => {
    const ref = useRef(null);
    return (
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
            <div className="min-w-0">
                <p className="text-sm font-medium">{kind.label}</p>
                {doc
                    ? <p className="text-xs text-emerald-700 flex items-center gap-1 truncate"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {doc.name || 'Uploaded'}</p>
                    : <p className="text-xs text-muted-foreground">Not uploaded yet</p>}
            </div>
            <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onPick(f); }} />
            <Button type="button" variant={doc ? 'outline' : 'default'} size="sm" className="h-10 shrink-0" disabled={busy} onClick={() => ref.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1.5" />{doc ? 'Replace' : 'Upload'}</>}
            </Button>
        </div>
    );
};

const HorseDocsUploadPage = () => {
    const { token } = useParams();
    const link = useMemo(() => parseHorseDocToken(token), [token]);
    const [view, setViewRaw] = useState(null);
    // Replies to a rename / add / remove do not repeat the show's required papers; keep the ones we had.
    const setView = (next) => setViewRaw((prev) => (next && !next.required && prev?.required ? { ...next, required: prev.required } : next));
    const [loadError, setLoadError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [names, setNames] = useState({});     // typed but not yet saved names, by horse index
    const [busyKey, setBusyKey] = useState('');
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [confirmRemove, setConfirmRemove] = useState(null);   // index of the horse waiting for "Yes, remove"
    const [structBusy, setStructBusy] = useState(false);
    const [message, setMessage] = useState({ text: '', ok: true });

    useEffect(() => {
        const load = async () => {
            if (!link) { setLoadError('This link is not valid.'); setIsLoading(false); return; }
            const { data, error } = await supabase.rpc('get_horse_doc_request', {
                p_show_id: link.showId, p_booking_id: link.bookingId, p_secret: link.secret,
            });
            if (error || !data) setLoadError('This link is not valid or is no longer active.');
            else setView(data);
            setIsLoading(false);
        };
        load();
    }, [link]);

    const horses = view?.horses || [];
    const total = horses.length;
    // Only the papers this show asks for are drawn and counted.
    const kinds = useMemo(() => getRequiredKinds(view?.required), [view?.required]);
    const complete = horses.filter((h) => kinds.every((k) => h[k.key])).length;
    const listOfKinds = kinds.map((k) => k.label);

    const saveName = async (index) => {
        const typed = (names[index] ?? '').trim();
        const current = horses.find((h) => h.index === index)?.name || '';
        // An empty name is not saved: the box goes back to the saved name.
        if (typed === current || typed === '') { setNames((p) => { const n = { ...p }; delete n[index]; return n; }); return; }
        const { data, error } = await supabase.rpc('set_horse_doc_name', {
            p_show_id: link.showId, p_booking_id: link.bookingId, p_secret: link.secret, p_index: index, p_horse_name: typed,
        });
        if (error) { setMessage({ text: error.message || 'Could not save the name.', ok: false }); return; }
        setView(data);
        setNames((p) => { const n = { ...p }; delete n[index]; return n; });
        setMessage({ text: 'Name saved.', ok: true });
    };

    // Add / remove a horse. Horses are a numbered list, so typed-but-unsaved names are cleared.
    const addHorse = async () => {
        const typed = newName.trim();
        if (!typed) { setMessage({ text: 'Please type the horse\'s name.', ok: false }); return; }
        setStructBusy(true);
        const { data, error } = await supabase.rpc('add_horse_doc_horse', {
            p_show_id: link.showId, p_booking_id: link.bookingId, p_secret: link.secret, p_horse_name: typed,
        });
        setStructBusy(false);
        if (error) { setMessage({ text: error.message || 'Could not add the horse.', ok: false }); return; }
        setView(data); setNames({}); setNewName(''); setAdding(false);
        setMessage({ text: `${typed} added.`, ok: true });
    };

    const removeHorse = async (h) => {
        setStructBusy(true);
        const { data, error } = await supabase.rpc('remove_horse_doc_horse', {
            p_show_id: link.showId, p_booking_id: link.bookingId, p_secret: link.secret, p_index: h.index,
        });
        setStructBusy(false);
        setConfirmRemove(null);
        if (error) { setMessage({ text: error.message || 'Could not remove the horse.', ok: false }); return; }
        setView(data); setNames({});
        setMessage({ text: `${h.name || `Horse ${h.index + 1}`} removed.`, ok: true });
    };

    const upload = async (index, kind, file) => {
        if (!file) return;
        const key = `${index}:${kind.key}`;
        const fileName = `${crypto.randomUUID()}.${(file.name.split('.').pop() || '').toLowerCase()}`;
        if (!horseDocPath('x', 'x', file.name, 'x')) {
            setMessage({ text: 'Please use a PDF or a photo (JPG or PNG).', ok: false });
            return;
        }
        if (file.size > MAX_BYTES) {
            setMessage({ text: 'That file is too large. The limit is 15 MB.', ok: false });
            return;
        }
        setBusyKey(key);
        setMessage({ text: '', ok: true });
        try {
            // Save a typed name first so the office sees it next to the paper.
            if (names[index] !== undefined) await saveName(index);
            const path = `${link.showId}/${link.bookingId}/${link.secret}/${fileName}`;
            const { error: upErr } = await supabase.storage.from(HORSE_DOCS_BUCKET).upload(path, file, { contentType: file.type || undefined });
            if (upErr) throw upErr;
            const { data, error } = await supabase.rpc('add_horse_doc', {
                p_show_id: link.showId, p_booking_id: link.bookingId, p_secret: link.secret,
                p_index: index, p_kind: kind.key, p_file: fileName, p_orig_name: file.name,
            });
            if (error) throw error;
            setView(data);
            setMessage({ text: `${kind.label} saved.`, ok: true });
        } catch (err) {
            setMessage({ text: err?.message || 'Could not save the file. Please try again.', ok: false });
        } finally {
            setBusyKey('');
        }
    };

    return (
        <div className="min-h-screen bg-muted/30 flex justify-center px-4 py-6">
            <Helmet><title>Horse health papers — {view?.showName || 'EquiPatterns'}</title></Helmet>
            <div className="w-full max-w-md space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <FileCheck2 className="h-4 w-4" /> Horse health papers
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : loadError ? (
                    <Card>
                        <CardContent className="py-10 text-center space-y-2">
                            <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                            <p className="font-medium">{loadError}</p>
                            <p className="text-sm text-muted-foreground">Please ask the show office to send you a new link.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardContent className="p-4 space-y-1">
                                <p className="text-xs text-muted-foreground">{view.showName} · Booking #{view.orderRef}</p>
                                <p className="text-xl font-bold leading-tight">{view.exhibitor}</p>
                                <p className="text-sm text-muted-foreground">
                                    {kinds.length > 0 ? (
                                        <>Please upload {listOfKinds.map((l, i) => (
                                            <React.Fragment key={l}>{i > 0 && (i === listOfKinds.length - 1 ? ' and ' : ', ')}<strong>{l}</strong></React.Fragment>
                                        ))} for each horse. A PDF or a clear photo is fine.</>
                                    ) : 'No papers are required for this show.'}
                                    {' '}Switching horses? You can change a name, add a horse or remove one below.
                                </p>
                            </CardContent>
                        </Card>

                        {total > 0 && kinds.length > 0 && (
                            <p className={cn('text-sm text-center font-medium', complete === total ? 'text-emerald-700' : 'text-muted-foreground')}>
                                {complete === total ? 'All papers received. Thank you!' : `${complete} of ${total} horse${total === 1 ? '' : 's'} complete`}
                            </p>
                        )}

                        {message.text && <p className={cn('text-sm text-center', message.ok ? 'text-emerald-700' : 'text-rose-600')}>{message.text}</p>}

                        {horses.map((h) => (
                            <Card key={h.index}>
                                <CardContent className="p-4 space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground" htmlFor={`horse-${h.index}`}>Horse {h.index + 1} name</label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id={`horse-${h.index}`}
                                                value={names[h.index] ?? h.name}
                                                onChange={(e) => setNames((p) => ({ ...p, [h.index]: e.target.value }))}
                                                onBlur={() => saveName(h.index)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                placeholder="e.g., Dixie"
                                                maxLength={60}
                                                className="h-11 text-base"
                                            />
                                            {total > 1 && confirmRemove !== h.index && (
                                                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground hover:text-rose-600"
                                                    title="Remove this horse" aria-label={`Remove ${h.name || `horse ${h.index + 1}`}`} disabled={structBusy}
                                                    onClick={() => setConfirmRemove(h.index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        {confirmRemove === h.index && (
                                            <div className="flex items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 dark:bg-rose-500/10 dark:border-rose-500/30">
                                                <p className="text-sm">Remove {h.name || `Horse ${h.index + 1}`}? Any papers uploaded for this horse are removed too.</p>
                                                <div className="flex gap-1.5 shrink-0">
                                                    <Button type="button" size="sm" variant="outline" className="h-9" disabled={structBusy} onClick={() => setConfirmRemove(null)}>No</Button>
                                                    <Button type="button" size="sm" className="h-9 bg-rose-600 hover:bg-rose-700 text-white" disabled={structBusy} onClick={() => removeHorse(h)}>
                                                        {structBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, remove'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {kinds.map((k) => (
                                        <UploadSlot key={k.key} kind={k} doc={h[k.key]} busy={busyKey === `${h.index}:${k.key}`}
                                            onPick={(f) => upload(h.index, k, f)} />
                                    ))}
                                </CardContent>
                            </Card>
                        ))}

                        {total === 0 && (
                            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">This booking has no horses listed.</CardContent></Card>
                        )}

                        {total < MAX_HORSES && (
                            adding ? (
                                <Card>
                                    <CardContent className="p-4 space-y-2">
                                        <label className="text-xs text-muted-foreground" htmlFor="new-horse">New horse name</label>
                                        <Input id="new-horse" autoFocus value={newName} maxLength={60} placeholder="e.g., Dixie" className="h-11 text-base"
                                            onChange={(e) => setNewName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') addHorse(); }} />
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" className="h-10 flex-1" disabled={structBusy} onClick={() => { setAdding(false); setNewName(''); }}>Cancel</Button>
                                            <Button type="button" className="h-10 flex-1" disabled={structBusy} onClick={addHorse}>
                                                {structBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add horse'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Button type="button" variant="outline" className="w-full h-11 gap-1.5" onClick={() => setAdding(true)}>
                                    <Plus className="h-4 w-4" /> Add a horse
                                </Button>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default HorseDocsUploadPage;
