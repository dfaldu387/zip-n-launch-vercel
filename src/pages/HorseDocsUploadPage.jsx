import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, FileCheck2, AlertTriangle, Upload, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { parseHorseDocToken } from '@/lib/horseDocLink';
import { HORSE_DOC_KINDS, HORSE_DOCS_BUCKET, horseDocPath } from '@/lib/horseDocs';
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
    const [view, setView] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [names, setNames] = useState({});     // typed but not yet saved names, by horse index
    const [busyKey, setBusyKey] = useState('');
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
    const complete = horses.filter((h) => h.certificate && h.coggins).length;

    const saveName = async (index) => {
        const typed = (names[index] ?? '').trim();
        const current = horses.find((h) => h.index === index)?.name || '';
        if (typed === current) return;
        const { data, error } = await supabase.rpc('set_horse_doc_name', {
            p_show_id: link.showId, p_booking_id: link.bookingId, p_secret: link.secret, p_index: index, p_horse_name: typed,
        });
        if (error) { setMessage({ text: error.message || 'Could not save the name.', ok: false }); return; }
        setView(data);
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
                                    Please upload a <strong>Health Certificate (CVI)</strong> and a <strong>Coggins test</strong> for each horse. A PDF or a clear photo is fine.
                                </p>
                            </CardContent>
                        </Card>

                        {total > 0 && (
                            <p className={cn('text-sm text-center font-medium', complete === total ? 'text-emerald-700' : 'text-muted-foreground')}>
                                {complete === total ? 'All papers received. Thank you!' : `${complete} of ${total} horse${total === 1 ? '' : 's'} complete`}
                            </p>
                        )}

                        {message.text && <p className={cn('text-sm text-center', message.ok ? 'text-emerald-700' : 'text-rose-600')}>{message.text}</p>}

                        {horses.map((h) => (
                            <Card key={h.index}>
                                <CardContent className="p-4 space-y-3">
                                    {h.nameLocked ? (
                                        <p className="font-semibold">{h.name}</p>
                                    ) : (
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground" htmlFor={`horse-${h.index}`}>Horse {h.index + 1} name</label>
                                            <Input
                                                id={`horse-${h.index}`}
                                                value={names[h.index] ?? h.name}
                                                onChange={(e) => setNames((p) => ({ ...p, [h.index]: e.target.value }))}
                                                onBlur={() => saveName(h.index)}
                                                placeholder="e.g., Dixie"
                                                maxLength={60}
                                                className="h-11 text-base"
                                            />
                                        </div>
                                    )}
                                    {HORSE_DOC_KINDS.map((k) => (
                                        <UploadSlot key={k.key} kind={k} doc={h[k.key]} busy={busyKey === `${h.index}:${k.key}`}
                                            onPick={(f) => upload(h.index, k, f)} />
                                    ))}
                                </CardContent>
                            </Card>
                        ))}

                        {total === 0 && (
                            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">This booking has no horses listed.</CardContent></Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default HorseDocsUploadPage;
