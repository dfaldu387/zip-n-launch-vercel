import React, { useMemo, useState } from 'react';
import { Wand2, AlertTriangle, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { planAutoAssign, applyPlanToBarns } from '@/lib/stallAssignment';

const SmartAssignDialog = ({ bookings, barns, onApply }) => {
    const [open, setOpen] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const { toast } = useToast();

    const result = useMemo(() => {
        if (!open) return null;
        return planAutoAssign(bookings || [], barns || []);
    }, [open, bookings, barns]);

    const groupedPlan = useMemo(() => {
        if (!result?.plan?.length) return [];
        const map = new Map();
        for (const p of result.plan) {
            if (!map.has(p.bookingId)) {
                map.set(p.bookingId, { bookingId: p.bookingId, bookingLabel: p.bookingLabel, stalls: [] });
            }
            map.get(p.bookingId).stalls.push(p);
        }
        return [...map.values()];
    }, [result]);

    const handleApply = async () => {
        if (!result?.plan?.length) {
            setOpen(false);
            return;
        }
        setIsApplying(true);
        try {
            const newBarns = applyPlanToBarns(barns, result.plan);
            await onApply(newBarns);
            toast({
                title: 'Assignments applied',
                description: `${result.summary.stallsAssigned} stalls assigned across ${result.summary.bookingsAssigned} bookings.`,
            });
            setOpen(false);
        } catch (e) {
            toast({ title: 'Could not apply', description: e.message, variant: 'destructive' });
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <>
            <Button variant="default" size="sm" onClick={() => setOpen(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                <Wand2 className="h-4 w-4 mr-2" /> Smart Auto-Assign
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-violet-600" /> Smart Assignment Preview
                        </DialogTitle>
                        <DialogDescription>
                            Bookings are grouped by trainer and assigned adjacent stalls when possible. Review before applying.
                        </DialogDescription>
                    </DialogHeader>

                    {result && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase font-semibold">Bookings</p>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{result.summary.bookingsAssigned}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 uppercase font-semibold">Stalls</p>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{result.summary.stallsAssigned}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                    <p className="text-xs text-amber-700 dark:text-amber-300 uppercase font-semibold">Skipped</p>
                                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{result.summary.bookingsSkipped}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                    <p className="text-xs text-red-700 dark:text-red-300 uppercase font-semibold">Short</p>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">{result.summary.stallsShort}</p>
                                </div>
                            </div>

                            <ScrollArea className="h-72 rounded-md border">
                                <div className="p-3 space-y-3">
                                    {groupedPlan.length === 0 && result.skipped.length === 0 && (
                                        <div className="py-8 text-center text-sm text-muted-foreground">
                                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                                            No bookings need assignment right now.
                                        </div>
                                    )}

                                    {groupedPlan.map(g => (
                                        <div key={g.bookingId} className="rounded-md border p-3 bg-emerald-50/40 dark:bg-emerald-900/10">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="font-semibold text-sm">{g.bookingLabel}</p>
                                                <Badge variant="outline" className="text-xs">{g.stalls.length} stall{g.stalls.length !== 1 ? 's' : ''}</Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {g.stalls.map(s => (
                                                    <Badge key={s.stallId} className="bg-emerald-600 text-white text-xs font-mono">
                                                        {s.barnName}-{s.stallNumber}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {result.skipped.length > 0 && (
                                        <div className="pt-2">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Skipped or short ({result.skipped.length})
                                            </p>
                                            <div className="space-y-1.5">
                                                {result.skipped.map((s, i) => (
                                                    <div key={i} className="text-xs rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 p-2">
                                                        <p className="font-medium">{s.bookingLabel} — {s.barnName}</p>
                                                        <p className="text-muted-foreground">
                                                            Wanted {s.requestedQty}, got {s.availableQty}. {s.reason}.
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={isApplying}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApply}
                            disabled={isApplying || !result?.plan?.length}
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                        >
                            {isApplying ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying...</>
                            ) : (
                                <>Apply {result?.plan?.length || 0} assignment{result?.plan?.length !== 1 ? 's' : ''}</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default SmartAssignDialog;
