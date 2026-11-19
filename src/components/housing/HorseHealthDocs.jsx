import React, { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FileText, Download, Upload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { HORSE_DOC_KINDS, HORSE_DOCS_BUCKET, horseDocPath, withHorseDoc } from '@/lib/horseDocs';

const STATUS_STYLE = {
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
    partial: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
    missing: 'bg-rose-100 text-rose-600 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
};

/** Badge for the Health Documents column. */
export const HealthBadge = ({ health }) => {
    if (health.state === 'none') return <span className="text-muted-foreground">—</span>;
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
const DocCell = ({ slot, kind, showId, bookingId, horseDocs, slotCount, onChange, readOnly }) => {
    const { toast } = useToast();
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const doc = slot[kind.key];

    const signedUrl = async (download) => {
        const { data, error } = await supabase.storage
            .from(HORSE_DOCS_BUCKET)
            .createSignedUrl(doc.path, 3600, download ? { download: doc.name || true } : undefined);
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
            if (doc?.path) await supabase.storage.from(HORSE_DOCS_BUCKET).remove([doc.path]);
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
            await supabase.storage.from(HORSE_DOCS_BUCKET).remove([doc.path]);
        } catch (e) {
            toast({ title: 'Could not remove the file', description: e.message, variant: 'destructive' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex items-center gap-1 min-h-[28px]">
            <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : doc ? (
                <>
                    <button type="button" onClick={open} title={`View ${doc.name || kind.label}`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded border bg-background hover:bg-muted">
                        <FileText className="h-4 w-4 text-red-600" />
                    </button>
                    <button type="button" onClick={download} title="Download"
                        className="inline-flex items-center justify-center h-7 w-7 rounded border bg-background hover:bg-muted">
                        <Download className="h-3.5 w-3.5" />
                    </button>
                    {!readOnly && (
                        <button type="button" onClick={remove} title="Remove this file"
                            className="inline-flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </>
            ) : readOnly ? (
                <span className="text-muted-foreground italic">Missing</span>
            ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => inputRef.current?.click()}>
                    <Upload className="h-3 w-3" /> Upload
                </Button>
            )}
        </div>
    );
};

/**
 * The "Health Documents" block of an open Master List row: one line per horse,
 * with a Health Certificate and a Coggins column.
 */
export const HorseHealthDocs = ({ slots, showId, bookingId, horseDocs, onChange, readOnly }) => {
    if (slots.length === 0) return <p className="italic text-muted-foreground">No horses on this booking</p>;
    return (
        <div className="rounded-md border overflow-hidden bg-background">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-x-2 px-2 py-1 bg-muted/60 text-[11px] font-semibold border-b">
                <span>Horse</span>
                {HORSE_DOC_KINDS.map((k) => <span key={k.key}>{k.label}</span>)}
            </div>
            {slots.map((slot) => (
                <div key={slot.index} className="grid grid-cols-[1.2fr_1fr_1fr] gap-x-2 px-2 py-1.5 items-center border-b last:border-b-0">
                    <span className={cn('truncate', !slot.name && 'italic text-muted-foreground')}>
                        {slot.name || `Horse ${slot.index + 1} — name not entered`}
                    </span>
                    {HORSE_DOC_KINDS.map((k) => (
                        <DocCell key={k.key} slot={slot} kind={k} showId={showId} bookingId={bookingId}
                            horseDocs={horseDocs} slotCount={slots.length} onChange={onChange} readOnly={readOnly} />
                    ))}
                </div>
            ))}
        </div>
    );
};
