import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { searchBarnLayouts, deleteBarnLayout, isValidLayout } from '@/lib/savedBarnLayouts';

const TYPE_CLS = {
    stall: 'bg-background border border-muted-foreground/40',
    aisle: 'bg-orange-300',
    empty: 'bg-transparent',
    blocked: 'bg-muted-foreground/40',
    office: 'bg-amber-200',
    feed: 'bg-emerald-200',
    wash: 'bg-sky-200',
    tack: 'bg-purple-200',
};

// A tiny picture of the saved barn so you can tell layouts apart at a glance.
const LayoutPreview = ({ layout }) => {
    if (!isValidLayout(layout)) return <div className="text-[10px] text-muted-foreground">No preview</div>;
    const cols = layout.layoutCols;
    const size = cols > 30 ? 3 : cols > 16 ? 5 : 8;
    return (
        <div className="max-h-24 max-w-[14rem] overflow-hidden rounded border bg-muted/30 p-1">
            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)` }}>
                {layout.cells.map((c, i) => (
                    <div key={i} style={{ width: size, height: size }} className={cn('rounded-[1px]', TYPE_CLS[c.type] || TYPE_CLS.stall)} />
                ))}
            </div>
        </div>
    );
};

// Search everyone's saved barn layouts by facility, barn or show name, then copy one
// into this barn. The layout replaces this barn's shape only — never its prices,
// dates or bookings.
export const LoadBarnLayoutDialog = ({ open, onOpenChange, onPick }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Search as you type (short pause so we don't ask on every keystroke).
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const rows = await searchBarnLayouts({ query });
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
        if (!window.confirm(`Delete your saved layout "${row.facility_name} · ${row.barn_name}"? This cannot be undone.`)) return;
        try {
            await deleteBarnLayout(row.id);
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
                    <DialogTitle>Load a saved barn layout</DialogTitle>
                    <DialogDescription>
                        Search by facility, barn or show name. Using a layout replaces this barn's shape only — its prices, dates and fees stay as they are.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="E.g., Larimer fairgrounds west barn, or quarter horse"
                        className="pl-9"
                    />
                </div>
                <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                    {loading && results.length === 0 && (
                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    )}
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {!loading && !error && results.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            {query.trim() ? 'No saved layouts match. Try fewer words.' : 'No saved layouts yet. Build a barn and click "Save layout" to start the catalog.'}
                        </p>
                    )}
                    {results.map(row => {
                        const mine = row.created_by === user?.id;
                        const l = row.layout || {};
                        return (
                            <div key={row.id} className="flex items-start gap-3 rounded-md border p-3">
                                <LayoutPreview layout={row.layout} />
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-semibold">{row.facility_name} · {row.barn_name}</p>
                                        {mine && <Badge variant="outline" className="text-[10px]">Yours</Badge>}
                                    </div>
                                    {row.show_label && <p className="truncate text-xs text-muted-foreground">{row.show_label}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        {row.stall_count} stalls · {l.layoutRows || '?'} × {l.layoutCols || '?'} · {l.numberingMode || 'continuous'} numbering
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Saved by {row.created_by_name || 'an EquiPatterns user'} · {new Date(row.updated_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <Button type="button" size="sm" className="h-7 text-xs" onClick={() => onPick(row)}>Use this layout</Button>
                                    {mine && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(row)}
                                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-3 w-3" /> Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default LoadBarnLayoutDialog;
