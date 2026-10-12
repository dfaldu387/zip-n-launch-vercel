import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, ImagePlus, Link2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { createSerialQueue } from '@/lib/showDataWrite';
import { LogoUploader } from '@/components/show-structure/LogoUploader';
import PublicPageEditor from '@/components/housing/PublicPageEditor';
import EventQrCard from '@/components/housing/EventQrCard';

// The same public-page editor that Housing & Grounds Manager shows under "Event Branding &
// Public Links", placed on the last step of the Pattern Book Builder.
//
// Both places edit ONE record:
//   - book linked to a show  -> the linked show's project_data.publicPage (what Housing edits)
//   - book not linked        -> the book's own project_data.publicPage
// Every change re-reads the newest saved copy before writing, like Housing does, so a quick
// edit here never overwrites something saved from the other page.
const BookPublicPageSection = ({ formData, setFormData, isReadOnly = false }) => {
    const { toast } = useToast();
    const linkedId = formData.linkedShowProjectId || formData.linkedProjectId || null;
    const isLinked = !!linkedId && linkedId !== formData.id;
    const targetId = isLinked ? linkedId : (formData.id || null);

    const [linkedData, setLinkedData] = useState(null);
    const [loading, setLoading] = useState(isLinked);
    const [loadError, setLoadError] = useState(false);
    const queue = useMemo(() => createSerialQueue(), []);

    useEffect(() => {
        if (!isLinked) { setLinkedData(null); setLoading(false); setLoadError(false); return undefined; }
        let cancelled = false;
        setLoading(true);
        setLoadError(false);
        supabase.from('projects').select('project_data').eq('id', linkedId).single()
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error || !data) { setLoadError(true); setLinkedData(null); } else { setLinkedData(data.project_data || {}); }
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [isLinked, linkedId]);

    // pd = what the editor reads. For a linked book that is the show's record, so the
    // automatic values (name, dates, venue) are the same ones Housing shows.
    const pd = isLinked ? (linkedData || {}) : formData;

    const writeProjectData = useCallback((change) => queue(async () => {
        if (!targetId) {
            // Book not saved yet: keep it in the form; it is saved with the book.
            setFormData(prev => ({ ...prev, ...change(prev) }));
            return;
        }
        const { data: row, error: readError } = await supabase
            .from('projects').select('project_data').eq('id', targetId).single();
        if (readError) throw readError;
        const next = { ...(row?.project_data || {}), ...change(row?.project_data || {}) };
        const { error } = await supabase.from('projects').update({ project_data: next }).eq('id', targetId);
        if (error) throw error;
        if (isLinked) {
            setLinkedData(next);
        } else {
            // Mirror into the open form so a later "Save" writes the same values.
            const { publicPage, coverImageUrl } = next;
            setFormData(prev => ({ ...prev, publicPage, coverImageUrl }));
        }
    }), [queue, targetId, isLinked, setFormData]);

    const savePublicPage = useCallback(async (change) => {
        try {
            await writeProjectData(latest => ({ publicPage: change(latest.publicPage || {}) }));
            toast({ title: 'Public page updated', description: 'The event page now shows your changes.' });
        } catch (error) {
            toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        }
    }, [writeProjectData, toast]);

    const saveCover = useCallback(async (url) => {
        try {
            await writeProjectData(() => ({ coverImageUrl: url || '' }));
            toast({ title: url ? 'Cover image saved' : 'Cover image removed', description: 'It will show on the public event card.' });
        } catch (error) {
            toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        }
    }, [writeProjectData, toast]);

    const coverUrl = pd.coverImageUrl || '';

    return (
        <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Event Branding &amp; Public Links
                </h3>
                {isLinked && (
                    <Badge variant="outline" className="text-xs">
                        <Link2 className="h-3 w-3 mr-1" /> Same as the linked show
                    </Badge>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
                {isLinked
                    ? 'This is the same public page as in Housing & Grounds Manager. A change made here shows there, and the other way round.'
                    : 'What the public sees on the event page: name, dates, tags, contacts, hotel and documents.'}
            </p>

            {!targetId && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                    Save the pattern book once (Save Draft) to get a public link and QR code. Your changes below are kept with the book.
                </p>
            )}

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading the linked show…
                </div>
            ) : loadError ? (
                <p className="text-sm text-red-600">Could not load the linked show. Please refresh the page and try again.</p>
            ) : (
                <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0 m-0">
                    <Card className="mb-6 border-l-4 border-l-pink-500">
                        <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                {coverUrl ? (
                                    <img src={coverUrl} alt="Event cover" className="h-12 w-20 rounded object-cover border" />
                                ) : (
                                    <div className="h-12 w-20 rounded border bg-muted flex items-center justify-center">
                                        <ImagePlus className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-semibold">Event cover image</p>
                                    <p className="text-[11px] text-muted-foreground">Shown on the public Events page card. Optional — a colored banner is used if none.</p>
                                </div>
                            </div>
                            {targetId && (
                                <LogoUploader fieldId="cover" showId={targetId} currentLogoUrl={coverUrl} onUploadComplete={saveCover} />
                            )}
                        </CardContent>
                    </Card>

                    {targetId && (
                        <div className="mb-6">
                            <EventQrCard show={{ id: targetId, project_name: formData.showName || 'Event' }} />
                        </div>
                    )}

                    <PublicPageEditor pd={pd} onChange={savePublicPage} showId={targetId || undefined} />
                </fieldset>
            )}
        </div>
    );
};

export default BookPublicPageSection;
