import React, { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FileText, Download, Upload, Loader2, Trash2, Link2, Mail, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { getRequiredKinds, HORSE_DOC_KINDS, HORSE_DOCS_BUCKET, horseDocPath, withHorseDoc, docStoragePath, describeRequestResult, buildHorsePatch, renameHorse, addHorse, removeHorse, MAX_HORSES, MAX_HORSE_NAME } from '@/lib/horseDocs';
import { buildHorseDocUrl } from '@/lib/horseDocLink';

const STATUS_STYLE = {
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
    partial: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
    missing: 'bg-rose-100 text-rose-600 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
};

/** Badge for the Health Documents column. */
export const HealthBadge = ({ health }) => {
    if (health.state === 'none') return <span className="text-muted-foreground">—</span>;
    if (health.state === 'notrequired') return <span className="text-[10px] text-muted-foreground whitespace-nowrap">Not required</span>;
    const label = health.state === 'confirmed' ? 'Confirmed'
        : health.state === 'missing' ? 'Missing'
        : `${health.done} of ${health.total}`;
    return (
        <Badge variant="outline" className={cn('text-[10px] whitespace-nowrap', STATUS_STYLE[health.state])}>
            {health.state === 'confirmed' ? '✓ ' : ''}{label}
        </Badge>
    );
};

// One paper of one horse: View + Download when it is there, Upload when it is not.
const DocCell = ({ slot, kind, showId, bookingId, secret, horseDocs, slotCount, onChange, readOnly }) => {
    const { toast } = useToast();
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const doc = slot[kind.key];
    // A paper the exhibitor sent through their link only keeps a file name; rebuild the folder.
    const storagePath = docStoragePath(doc, showId, bookingId, secret);

    const signedUrl = async (download) => {
        if (!storagePath) throw new Error('This file cannot be found.');
        const { data, error } = await supabase.storage
            .from(HORSE_DOCS_BUCKET)
            .createSignedUrl(storagePath, 3600, download ? { download: doc.name || true } : undefined);
        if (error) throw error;
        return data.signedUrl;
    };

    const open = async () => {
        // Open the tab first (a popup blocker allows it on a click), then point it at the file.
        const tab = window.open('', '_blank');
        try {
            const url = await signedUrl(false);
            if (tab) tab.location.href = url; else window.location.href = url;
        } catch (e) {
            if (tab) tab.close();
            toast({ title: 'Could not open the file', description: e.message, variant: 'destructive' });
        }
    };

    const download = async () => {
        try {
            const a = document.createElement('a');
            a.href = await signedUrl(true);
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            toast({ title: 'Could not download the file', description: e.message, variant: 'destructive' });
        }
    };

    const upload = async (file) => {
        if (!file) return;
        const path = horseDocPath(showId, bookingId, file.name, uuidv4());
        if (!path) {
            toast({ title: 'File type not accepted', description: 'Use a PDF or a photo (JPG, PNG).', variant: 'destructive' });
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            toast({ title: 'File is too large', description: 'The limit is 15 MB.', variant: 'destructive' });
            return;
        }
        setBusy(true);
        try {
            const { error } = await supabase.storage.from(HORSE_DOCS_BUCKET).upload(path, file, { contentType: file.type || undefined });
            if (error) throw error;
            onChange(withHorseDoc(horseDocs, slot.index, kind.key, { path, name: file.name, uploadedAt: new Date().toISOString() }, slotCount));
            // A replaced file is removed so old papers do not pile up in storage.
            if (storagePath) await supabase.storage.from(HORSE_DOCS_BUCKET).remove([storagePath]);
        } catch (e) {
            toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            onChange(withHorseDoc(horseDocs, slot.index, kind.key, null, slotCount));
            if (storagePath) await supabase.storage.from(HORSE_DOCS_BUCKET).remove([storagePath]);
        } catch (e) {
            toast({ title: 'Could not remove the file', description: e.message, variant: 'destructive' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex items-center gap-0.5 min-h-[24px]">
            <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : doc ? (
                <>
                    <button type="button" onClick={open} title={`View ${doc.name || kind.label}`}
                        className="inline-flex items-center justify-center h-6 w-6 rounded border bg-background hover:bg-muted">
                        <FileText className="h-3.5 w-3.5 text-red-600" />
                    </button>
                    <button type="button" onClick={download} title="Download"
                        className="inline-flex items-center justify-center h-6 w-6 rounded border bg-background hover:bg-muted">
                        <Download className="h-3 w-3" />
                    </button>
                    {!readOnly && (
                        <button type="button" onClick={remove} title="Remove this file"
                            className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-rose-600">
                            <Trash2 className="h-3 w-3" />
                        </button>
                    )}
                </>
            ) : readOnly ? (
                <span className="text-[10px] text-muted-foreground italic">Missing</span>
            ) : (
                <Button type="button" size="sm" className="h-6 w-6 p-0" title={`Upload ${kind.label}`} aria-label={`Upload ${kind.label}`} onClick={() => inputRef.current?.click()}>
                    <Upload className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
};

/**
 * The "Health Documents" block of an open Master List row: one line per horse,
 * with a Health Certificate and a Coggins column.
 */
const fmtRequested = (iso) => {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
};

export const HorseHealthDocs = ({ slots, showId, bookingId, secret, onEnsureSecret, onRequest, canEmail, requestedAt, horseDocs, onChange, onEditHorses, readOnly, kinds = getRequiredKinds() }) => {
    const { toast } = useToast();
    const [linking, setLinking] = useState(false);
    const [requesting, setRequesting] = useState(false);
    // Editing the horse list (Robert 2026-11-19): rename, add, remove.
    const [editIndex, setEditIndex] = useState(null);
    const [draft, setDraft] = useState('');
    const [confirmIndex, setConfirmIndex] = useState(null);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const canEdit = !!onEditHorses && !readOnly;

    const startEdit = (slot) => { setEditIndex(slot.index); setDraft(slot.name); setConfirmIndex(null); };
    const saveEdit = () => {
        const slot = slots[editIndex];
        const name = draft.trim();
        setEditIndex(null);
        if (!slot || !name || name === slot.name) return;
        onEditHorses(buildHorsePatch(renameHorse(slots, slot.index, name)),
            `Horse renamed: ${slot.name || `Horse ${slot.index + 1}`} to ${name}`);
    };
    const doAdd = () => {
        const name = newName.trim();
        if (!name) return;
        const next = addHorse(slots, name);
        if (!next) { toast({ title: 'Horse limit reached', description: `A booking can have up to ${MAX_HORSES} horses.`, variant: 'destructive' }); return; }
        onEditHorses(buildHorsePatch(next), `Horse added: ${name}`);
        setNewName(''); setAdding(false);
    };
    const doRemove = async (slot) => {
        const next = removeHorse(slots, slot.index);
        setConfirmIndex(null);
        if (!next) { toast({ title: 'Cannot remove', description: 'A booking needs at least one horse.', variant: 'destructive' }); return; }
        // Take the removed horse's uploaded papers out of storage too (best effort).
        const files = HORSE_DOC_KINDS.map((k) => docStoragePath(slot[k.key], showId, bookingId, secret)).filter(Boolean);
        onEditHorses(buildHorsePatch(next), `Horse removed: ${slot.name || `Horse ${slot.index + 1}`}`);
        if (files.length) { try { await supabase.storage.from(HORSE_DOCS_BUCKET).remove(files); } catch { /* the file is simply left behind */ } }
    };

    const addRow = (
        <div className="flex items-center gap-1.5">
            <Input autoFocus value={newName} maxLength={MAX_HORSE_NAME} placeholder="New horse name" className="h-7 text-[11px] px-2 max-w-[180px]"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }} />
            <Button type="button" size="sm" className="h-7 px-2 text-[11px]" disabled={!newName.trim()} onClick={doAdd}>Add</Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => { setAdding(false); setNewName(''); }}>Cancel</Button>
        </div>
    );

    const allDone = slots.length > 0 && slots.every((s) => kinds.every((k) => s[k.key]));
    const sendRequest = async () => {
        setRequesting(true);
        try {
            const result = await onRequest();
            const sentOne = (result?.sent || []).length > 0;
            toast({ title: sentOne ? 'Request sent' : 'Nothing was sent', description: describeRequestResult(result), variant: sentOne ? undefined : 'destructive' });
        } catch (e) {
            toast({ title: 'Could not send the request', description: e.message, variant: 'destructive' });
        } finally {
            setRequesting(false);
        }
    };

    // The exhibitor's private upload link. The secret is created the first time it is asked for.
    const copyLink = async () => {
        setLinking(true);
        try {
            const s = secret || (onEnsureSecret ? await onEnsureSecret() : '');
            if (!s) throw new Error('Could not create the link.');
            const url = buildHorseDocUrl({ origin: window.location.origin, showId, bookingId, secret: s });
            try {
                await navigator.clipboard.writeText(url);
                toast({ title: 'Upload link copied', description: 'Send it to the exhibitor. They can upload without logging in.' });
            } catch {
                window.prompt('Copy this link and send it to the exhibitor:', url);
            }
        } catch (e) {
            toast({ title: 'Could not create the link', description: e.message, variant: 'destructive' });
        } finally {
            setLinking(false);
        }
    };

    if (slots.length === 0) {
        return (
            <div className="space-y-1.5">
                <p className="italic text-muted-foreground">No horses on this booking</p>
                {canEdit && (adding ? addRow : (
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => setAdding(true)}>
                        <Plus className="h-3 w-3" /> Add horse
                    </Button>
                ))}
            </div>
        );
    }
    return (
        <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
            {onRequest && !allDone && kinds.length > 0 && (
                <Button type="button" size="sm" className="h-7 px-2 text-[11px] gap-1" disabled={requesting || !canEmail}
                    title={canEmail ? 'Email this exhibitor their upload link' : 'No email on file for this exhibitor'} onClick={sendRequest}>
                    {requesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />} Request health docs
                </Button>
            )}
            {onEnsureSecret && (
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" disabled={linking} onClick={copyLink}>
                    {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Copy upload link
                </Button>
            )}
        </div>
        {requestedAt && !allDone && (
            <p className="text-[10px] text-muted-foreground">Last requested {fmtRequested(requestedAt)}</p>
        )}
        <div className="rounded-md border bg-background max-h-80 overflow-auto">
            {(() => {
                const cols = { gridTemplateColumns: `minmax(64px,1fr) repeat(${kinds.length}, 76px)` };
                return (
                    <>
                        {kinds.length > 0 && (
                            <div className="grid gap-x-1 px-2 py-1 bg-muted/60 text-[10px] font-semibold border-b sticky top-0 z-10" style={cols}>
                                <span>Horse</span>
                                {kinds.map((k) => <span key={k.key} title={k.label}>{k.short || k.label}</span>)}
                            </div>
                        )}
                        {slots.map((slot) => (
                            <div key={slot.index} className="grid gap-x-1 px-2 py-1 items-center border-b last:border-b-0" style={cols}>
                                {editIndex === slot.index ? (
                                    <Input autoFocus value={draft} maxLength={MAX_HORSE_NAME} className="h-6 text-[11px] px-2 col-span-full"
                                        onChange={(e) => setDraft(e.target.value)} onBlur={saveEdit}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditIndex(null); }} />
                                ) : confirmIndex === slot.index ? (
                                    <span className="col-span-full flex flex-wrap items-center gap-1.5 text-[11px]">
                                        <span>Remove <strong>{slot.name || `Horse ${slot.index + 1}`}</strong>{HORSE_DOC_KINDS.some((k) => slot[k.key]) ? ' and its papers' : ''}?</span>
                                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setConfirmIndex(null)}>No</Button>
                                        <Button type="button" size="sm" className="h-6 px-2 text-[11px] bg-rose-600 hover:bg-rose-700 text-white" onClick={() => doRemove(slot)}>Yes, remove</Button>
                                    </span>
                                ) : (
                                    <>
                                        <span className="flex items-center min-w-0">
                                            <span title={slot.name} className={cn('min-w-0 truncate text-[11px]', !slot.name && 'italic text-muted-foreground')}>
                                                {slot.name || `Horse ${slot.index + 1}`}
                                            </span>
                                            {canEdit && (
                                                <>
                                                    <button type="button" onClick={() => startEdit(slot)} title="Edit name" aria-label="Edit horse name"
                                                        className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                    {slots.length > 1 && (
                                                        <button type="button" onClick={() => { setConfirmIndex(slot.index); setEditIndex(null); }} title="Remove this horse" aria-label="Remove horse"
                                                            className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-rose-600 hover:bg-muted">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </span>
                                        {kinds.map((k) => (
                                            <DocCell key={k.key} slot={slot} kind={k} showId={showId} bookingId={bookingId} secret={secret}
                                                horseDocs={horseDocs} slotCount={slots.length} onChange={onChange} readOnly={readOnly} />
                                        ))}
                                    </>
                                )}
                            </div>
                        ))}
                    </>
                );
            })()}
        </div>
        {canEdit && (adding ? addRow : (
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" disabled={slots.length >= MAX_HORSES} onClick={() => setAdding(true)}>
                <Plus className="h-3 w-3" /> Add horse
            </Button>
        ))}
        </div>
    );
};
