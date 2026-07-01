import React, { useMemo, useState } from 'react';
import { Settings2, X, Loader2, CheckCircle2, Home, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
    getRequestedStallCount,
    getAssignedStallsForBooking,
    assignStallToBooking,
    unassignStall,
} from '@/lib/stallAssignment';

// Labels for non-stall boxes so the dialog can mirror the real barn shape
// (aisles / rooms / blocked / empty gaps), not just a packed list of stalls.
const ROOM_LABELS = { office: 'Office', feed: 'Feed', wash: 'Wash', tack: 'Tack' };

// Per-booking manual override.
// Shows: requested barns, currently assigned stalls (clickable to unassign),
// and available stalls in each requested barn (clickable to assign).
const ManageStallsDialog = ({ booking, barns, onApply }) => {
    const [open, setOpen] = useState(false);
    const [draftBarns, setDraftBarns] = useState(barns);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    React.useEffect(() => { if (open) setDraftBarns(barns); }, [open, barns]);

    const requested = getRequestedStallCount(booking);
    const assigned = useMemo(() => getAssignedStallsForBooking(booking, draftBarns), [booking, draftBarns]);

    // Build list of barns this booking actually wants stalls from (from items[])
    const requestedBarns = useMemo(() => {
        const wanted = new Map();
        for (const item of booking?.items || []) {
            if (item.type !== 'stall') continue;
            wanted.set(item.refId, (wanted.get(item.refId) || 0) + (item.qty || 0));
        }
        // Also include any barn that already has a stall assigned to this booking
        for (const a of assigned) {
            if (!wanted.has(a.barnId)) wanted.set(a.barnId, 0);
        }
        return [...wanted.entries()].map(([barnId, qty]) => {
            const barn = (draftBarns || []).find(b => b.id === barnId);
            return barn ? { barn, qty } : null;
        }).filter(Boolean);
    }, [booking, draftBarns, assigned]);

    const handleStallClick = (stall, barnId) => {
        if (stall.bookingId === booking.id) {
            // Unassign
            setDraftBarns(prev => unassignStall(prev, stall.id));
        } else if (!stall.bookingId) {
            // Assign — but block if booking is already at quota
            if (assigned.length >= requested) {
                toast({
                    title: 'Quota reached',
                    description: `This booking only requested ${requested} stall${requested !== 1 ? 's' : ''}. Unassign one first.`,
                });
                return;
            }
            setDraftBarns(prev => assignStallToBooking(prev, stall.id, booking.id));
        } else {
            // Stall belongs to someone else — show a hint
            toast({
                title: 'Stall taken',
                description: 'This stall is assigned to another booking. Unassign it from there first.',
            });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onApply(draftBarns);
            toast({ title: 'Stall assignments saved' });
            setOpen(false);
        } catch (e) {
            toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!booking) return null;
    const exhibitor = booking.exhibitorName || 'Unknown exhibitor';

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setOpen(true)}
                title="Manage stall assignments"
            >
                <Settings2 className="h-3 w-3 mr-1" />
                Manage {assigned.length}/{requested}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Manage Stalls — {exhibitor}</DialogTitle>
                        <DialogDescription>
                            Click an empty stall to assign it. Click an assigned stall ({booking.exhibitorName ? 'green' : 'green'}) to unassign.
                            Quota: <strong>{assigned.length} of {requested}</strong> stalls assigned.
                        </DialogDescription>
                    </DialogHeader>

                    {requestedBarns.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            This booking did not request any stalls (only RV/supplies).
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-4 pr-3">
                                {requestedBarns.map(({ barn, qty }) => (
                                    <div key={barn.id} className="border rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-semibold text-sm flex items-center gap-2">
                                                <Home className="h-4 w-4 text-primary" /> {barn.name}
                                            </p>
                                            <Badge variant="outline" className="text-xs">
                                                Wants {qty} · {(barn.stalls || []).filter(s => !s.bookingId && (s.type || 'stall') === 'stall').length} free
                                            </Badge>
                                        </div>
                                        {/* Mirror the real barn layout: render every box in the
                                            barn's rows × columns so aisle gaps, rooms and blocked
                                            boxes sit exactly where they do in the Barn Layout.
                                            Only stall boxes are clickable. */}
                                        <div
                                            className="grid gap-2"
                                            style={{ gridTemplateColumns: `repeat(${barn.layoutCols || Math.min((barn.stalls || []).length || 10, 10)}, minmax(0, 1fr))` }}
                                        >
                                            {(barn.stalls || []).map(stall => {
                                                const type = stall.type || 'stall';
                                                if (type === 'stall') {
                                                    const isMine = stall.bookingId === booking.id;
                                                    const isFree = !stall.bookingId;
                                                    return (
                                                        <button
                                                            key={stall.id}
                                                            type="button"
                                                            onClick={() => handleStallClick(stall, barn.id)}
                                                            className={cn(
                                                                'h-12 rounded-md border-2 text-xs font-mono font-semibold transition flex items-center justify-center',
                                                                isMine && 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600',
                                                                isFree && 'border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary',
                                                                !isMine && !isFree && 'bg-muted border-muted text-muted-foreground cursor-not-allowed opacity-60'
                                                            )}
                                                            title={
                                                                isMine ? 'Your stall — click to unassign' :
                                                                isFree ? 'Free — click to assign' :
                                                                'Taken by another booking'
                                                            }
                                                        >
                                                            {stall.number}
                                                        </button>
                                                    );
                                                }
                                                // Non-stall box — keep its position so the barn shape matches inventory.
                                                const label = ROOM_LABELS[type];
                                                return (
                                                    <div
                                                        key={stall.id}
                                                        title={label || (type === 'blocked' ? 'Blocked' : type === 'aisle' ? 'Aisle' : '')}
                                                        className={cn(
                                                            'h-12 rounded-md flex items-center justify-center text-[9px] uppercase tracking-wide select-none',
                                                            type === 'empty' && 'opacity-0',
                                                            type === 'aisle' && 'bg-muted/40',
                                                            type === 'blocked' && 'bg-muted border border-muted-foreground/30 text-muted-foreground line-through',
                                                            label && 'border border-muted-foreground/30 text-muted-foreground bg-muted/30'
                                                        )}
                                                    >
                                                        {label || (type === 'blocked' ? stall.number : '')}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                            ) : (
                                <><CheckCircle2 className="h-4 w-4 mr-2" /> Save Assignments</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ManageStallsDialog;
