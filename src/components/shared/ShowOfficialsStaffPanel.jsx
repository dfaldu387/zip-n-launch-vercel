import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Lock, Save, Users, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useShowBuilder } from '@/hooks/useShowBuilder';
import { OfficialsStaffStep } from '@/components/show-structure/OfficialsStaffStep';
import { isWizardReadOnly } from '@/lib/moduleStatusService';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { copyOfficials, countStaff } from '@/lib/copyStaff';

/**
 * "Copy staff from another show": pick one of your other shows and add its people to this list.
 * Dates and worked totals from the old show are left out. Nothing is saved until Save Staff is clicked.
 */
const CopyStaffDialog = ({ open, onOpenChange, currentShowId, formData, setFormData }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sourceId, setSourceId] = useState('');

    useEffect(() => {
        if (!open || !user) return;
        let cancelled = false;
        setLoading(true);
        supabase
            .from('projects')
            .select('id, project_name, project_type, project_data, created_at')
            .eq('user_id', user.id)
            .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")')
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                if (cancelled) return;
                const withStaff = (data || [])
                    .filter((p) => p.id !== currentShowId)
                    .map((p) => ({ ...p, staffCount: countStaff(p.project_data?.showDetails?.officials) }))
                    .filter((p) => p.staffCount > 0);
                setShows(withStaff);
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, user, currentShowId]);

    const source = shows.find((s) => s.id === sourceId);

    const handleCopy = () => {
        if (!source) return;
        const selected = Object.keys(formData.associations || {}).filter((id) => formData.associations[id]);
        const allowed = selected.length > 0 ? selected : ['default'];
        const result = copyOfficials(source.project_data?.showDetails?.officials, formData.showDetails?.officials, allowed, uuidv4);
        if (result.added > 0) {
            setFormData((prev) => ({
                ...prev,
                showDetails: { ...(prev.showDetails || {}), officials: result.officials },
            }));
        }
        const notes = [];
        if (result.skippedDuplicate > 0) notes.push(`${result.skippedDuplicate} already in the list`);
        if (result.skippedAssociation > 0) notes.push(`${result.skippedAssociation} from an association this show does not use`);
        toast({
            title: result.added > 0 ? `${result.added} ${result.added === 1 ? 'person' : 'people'} added` : 'Nobody was added',
            description: [
                result.added > 0 ? 'Set their dates, then click Save Staff.' : null,
                notes.length > 0 ? `Skipped: ${notes.join(', ')}.` : null,
            ].filter(Boolean).join(' '),
        });
        onOpenChange(false);
        setSourceId('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Copy staff from another show</DialogTitle>
                    <DialogDescription>
                        Adds that show's people to this list with their roles, rates and expense choices. Employment and expense dates are left empty so you can set them for this show.
                    </DialogDescription>
                </DialogHeader>
                {loading ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : shows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">None of your other shows has staff yet.</p>
                ) : (
                    <Select value={sourceId} onValueChange={setSourceId}>
                        <SelectTrigger><SelectValue placeholder="Choose a show..." /></SelectTrigger>
                        <SelectContent>
                            {shows.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.project_name || 'Untitled'} ({s.staffCount} {s.staffCount === 1 ? 'person' : 'people'})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleCopy} disabled={!source}>Copy staff</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

/**
 * The Officials & Staff tool (Show Structure & Expenses, Step 3) shown on another page.
 *
 * It edits the SAME data as Step 3 — showDetails.officials on the show — so a person
 * added here appears in the wizard and the other way round. There is no second copy.
 *
 * Props:
 *  - showId:            the show to edit
 *  - onOfficialsChange: (officials) called with the live value on load and on every edit
 *                       (unsaved edits included), so the page can recalculate costs
 *  - onSaved:           (officials) called after a successful save
 *  - defaultOpen:       start expanded
 */
export const ShowOfficialsStaffPanel = ({ showId, onOfficialsChange, onSaved, defaultOpen = true }) => {
    const { formData, setFormData, createOrUpdateShow, isLoading } = useShowBuilder(showId);
    const [isSaving, setIsSaving] = useState(false);
    const [open, setOpen] = useState(defaultOpen);
    const [copyOpen, setCopyOpen] = useState(false);
    const savedJsonRef = useRef(null);

    const officials = formData.showDetails?.officials || {};
    const officialsJson = JSON.stringify(officials);

    // Snapshot of what is saved: taken once the show has loaded.
    useEffect(() => {
        if (!isLoading) savedJsonRef.current = officialsJson;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading]);

    // Tell the page about the live value so its totals follow every edit.
    useEffect(() => {
        if (!isLoading && onOfficialsChange) onOfficialsChange(officials);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, officialsJson]);

    const hasUnsaved = !isLoading && savedJsonRef.current !== null && savedJsonRef.current !== officialsJson;
    // Staff belong to Show Structure, so that section's lock applies here too.
    const isReadOnly = isWizardReadOnly(formData, 'showStructure');

    const handleSave = async () => {
        if (isReadOnly) return;
        setIsSaving(true);
        try {
            // No module key: saving staff from here must not move any module's status.
            const project = await createOrUpdateShow(null);
            if (project) {
                savedJsonRef.current = officialsJson;
                if (onSaved) onSaved(officials);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const personCount = Object.values(officials).reduce(
        (sum, roles) => sum + Object.values(roles || {}).reduce((s, list) => s + (list || []).length, 0),
        0
    );

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setOpen(o => !o)}>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Officials &amp; Staff
                            <span className="text-xs font-normal text-muted-foreground">({personCount} added)</span>
                            {hasUnsaved && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
                            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Same list as Show Structure &amp; Expenses &mdash; fill it in here or there, it stays in sync.
                        </CardDescription>
                    </button>
                    <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)} disabled={isLoading || isReadOnly} title="Add the people from one of your other shows">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy from another show
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isLoading || isReadOnly || !hasUnsaved} size="sm">
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {isSaving ? 'Saving...' : 'Save Staff'}
                    </Button>
                </div>
            </CardHeader>
            {open && (
                <CardContent className="pt-0">
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        <>
                            {isReadOnly && (
                                <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                                    <Lock className="h-4 w-4 flex-shrink-0" />
                                    <span>Show Structure &amp; Expenses is locked, so the staff list is read-only. Unlock it on the show page to edit.</span>
                                </div>
                            )}
                            <fieldset disabled={isReadOnly} className="min-w-0 m-0 border-0 p-0">
                                <OfficialsStaffStep formData={formData} setFormData={setFormData} hideHeader />
                            </fieldset>
                        </>
                    )}
                </CardContent>
            )}
            <CopyStaffDialog open={copyOpen} onOpenChange={setCopyOpen} currentShowId={showId} formData={formData} setFormData={setFormData} />
        </Card>
    );
};
