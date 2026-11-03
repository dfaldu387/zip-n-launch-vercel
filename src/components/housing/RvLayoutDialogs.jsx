import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { extractRvLayout, saveRvLayout, countLayoutSpots, searchRvLayouts, deleteRvLayout, isValidRvLayout } from '@/lib/savedRvLayouts';

const HEX = { sky: '#0ea5e9', orange: '#f97316', emerald: '#10b981', violet: '#8b5cf6', rose: '#f43f5e', amber: '#f59e0b', teal: '#14b8a6', fuchsia: '#d946ef' };

// Tiny picture of the saved RV area: spots coloured by camping type, roadways amber.
const RvLayoutPreview = ({ layout }) => {
    if (!isValidRvLayout(layout)) return <div className="text-[10px] text-muted-foreground">No preview</div>;
    return (
        <div className="max-h-24 max-w-[14rem] overflow-hidden rounded border bg-muted/30 p-1">
            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${layout.perRow}, 6px)` }}>
                {layout.cells.map((c, i) => {
                    const t = layout.campingTypes[c.typeIndex];
                    return (
                        <div
                            key={i}
                            style={{ width: 6, height: 10, background: c.type === 'roadway' ? '#fcd34d' : t ? HEX[t.color] || HEX.sky : undefined }}
                            className={cn('rounded-[1px]', !t && !c.type && 'border border-muted-foreground/40 bg-background', c.type === 'blocked' && 'bg-muted-foreground/40')}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// Save this RV area's layout (grid, roadways, camping types) to the shared catalog.
export const SaveRvLayoutDialog = ({ open, onOpenChange, rvArea, defaultFacility = '', defaultLabel = '' }) => {
    const { toast } = useToast();
    const { user, profile } = useAuth();
    const [facility, setFacility] = useState('');
    const [areaName, setAreaName] = useState('');
    const [showLabel, setShowLabel] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFacility(defaultFacility || '');
        setAreaName(rvArea?.name || '');
        setShowLabel(defaultLabel || '');
    }, [open, rvArea?.name, defaultFacility, defaultLabel]);

    const layout = extractRvLayout(rvArea);
    const handleSave = async () => {
        setSaving(true);
        try {
            const { updated } = await saveRvLayout({
                facility, areaName, showLabel, layout, userId: user?.id,
                userName: profile?.full_name || user?.user_metadata?.full_name || null,
            });
            toast({ title: updated ? 'RV layout updated' : 'RV layout saved', description: `${facility.trim()} · ${areaName.trim()}${showLabel.trim() ? ` · ${showLabel.trim()}` : ''}` });
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Could not save layout', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Save RV layout</DialogTitle>
                    <DialogDescription>Save this RV area's grid, roadways and camping types so you and other show managers can reuse them. Bookings, prices and dates are not saved.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="srl-facility" className="text-xs">Facility name</Label>
                        <Input id="srl-facility" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="E.g., Larimer County Fairgrounds" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="srl-area" className="text-xs">RV area name</Label>
                        <Input id="srl-area" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="E.g., North Campground" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="srl-label" className="text-xs">Show name <span className="text-muted-foreground">(optional)</span></Label>
                        <Input id="srl-label" value={showLabel} onChange={(e) => setShowLabel(e.target.value)} placeholder="E.g., Quarter Horse Show, or County Fair" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {countLayoutSpots(layout)} camping spots · {layout.campingTypes.length} camping type{layout.campingTypes.length === 1 ? '' : 's'} · {layout.perRow} per row.
                        Saving the same facility, area and show name again replaces your earlier copy.
                    </p>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button type="button" onClick={handleSave} disabled={!facility.trim() || !areaName.trim() || saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save layout
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Search everyone's saved RV layouts, then copy one into this RV area.
export const LoadRvLayoutDialog = ({ open, onOpenChange, onPick }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toDelete, setToDelete] = useState(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const rows = await searchRvLayouts({ query });
                if (!cancelled) { setResults(rows); setError(''); }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Search failed');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [open, query]);
    useEffect(() => { if (!open) setQuery(''); }, [open]);

    const handleDelete = async (row) => {
        setToDelete(null);
        try {
            await deleteRvLayout(row.id);
            setResults(prev => prev.filter(r => r.id !== row.id));
            toast({ title: 'Layout deleted' });
        } catch (e) {
            toast({ title: 'Could not delete', description: e.message, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Load a saved RV layout</DialogTitle>
                    <DialogDescription>Search by facility, RV area or show name. Using a layout replaces this area's grid and camping types only — its name, dates and fees stay as they are.</DialogDescription>
                </DialogHeader>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="E.g., Larimer north campground" className="pl-9" />
                </div>
                <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                    {loading && results.length === 0 && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {!loading && !error && results.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            {query.trim() ? 'No saved layouts match. Try fewer words.' : 'No saved RV layouts yet. Build an RV area and click "Save layout" to start the catalog.'}
                        </p>
                    )}
                    {results.map(row => {
                        const mine = row.created_by === user?.id;
                        const types = row.layout?.campingTypes || [];
                        return (
                            <div key={row.id} className="flex items-start gap-3 rounded-md border p-3">
                                <RvLayoutPreview layout={row.layout} />
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-semibold">{row.facility_name} · {row.area_name}</p>
                                        {mine && <Badge variant="outline" className="text-[10px]">Yours</Badge>}
                                    </div>
                                    {row.show_label && <p className="truncate text-xs text-muted-foreground">{row.show_label}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        {row.spot_count} spots · {types.length} camping type{types.length === 1 ? '' : 's'}
                                        {types.length > 0 && ` (${types.map(t => t.label || `${t.count} × ${t.powerType}`).join(', ')})`}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">Saved by {row.created_by_name || 'an EquiPatterns user'} · {new Date(row.updated_at).toLocaleDateString()}</p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <Button type="button" size="sm" className="h-7 text-xs" onClick={() => onPick(row)}>Use this layout</Button>
                                    {mine && (
                                        <button type="button" onClick={() => setToDelete(row)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-3 w-3" /> Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
            <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this saved layout?</AlertDialogTitle>
                        <AlertDialogDescription>"{toDelete?.facility_name} · {toDelete?.area_name}" will be removed from the catalog. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(toDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete layout</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
};
