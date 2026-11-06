import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { gridCols, computeGridLabels, labelValue } from '@/lib/barnGrid';

// Pop-up map used by the Order Hay & Shavings page. The customer picks a barn,
// optionally searches, and clicks a booked stall. We hand back the barn name,
// stall number and the trainer/group (only when the organizer published it).
// Data comes from the public stalling chart, so it never shows more than that.

const StallPickerDialog = ({ open, onOpenChange, barns, onPick }) => {
    const [barnIdx, setBarnIdx] = useState(0);
    const [query, setQuery] = useState('');

    useEffect(() => { if (open) { setBarnIdx(0); setQuery(''); } }, [open]);

    const barn = barns[barnIdx] || barns[0];
    const units = barn?.stalls || [];
    const cols = gridCols({ layoutCols: barn?.layoutCols, stallCount: barn?.stallCount });
    const rowCount = Math.ceil(units.length / cols);
    const { rowLabels: defRows, colLabels: defCols } = useMemo(() => computeGridLabels(units, cols), [units, cols]);
    const q = query.trim().toLowerCase();

    const matches = (u) => !q || `${u.number} ${u.trainer || ''} ${u.exhibitor || ''}`.toLowerCase().includes(q);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Pick your stall</DialogTitle>
                    <DialogDescription>Click your stall. We will fill in the barn and stall for you.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row gap-3">
                    {barns.length > 1 && (
                        <select
                            value={barnIdx}
                            onChange={(e) => setBarnIdx(Number(e.target.value))}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-64"
                        >
                            {barns.map((b, i) => <option key={b.id || i} value={i}>{b.name}</option>)}
                        </select>
                    )}
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stall number or name" className="pl-9" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="inline-grid gap-1" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(52px, 1fr))` }}>
                        <div />
                        {Array.from({ length: cols }, (_, ci) => (
                            <div key={ci} className="text-center text-[11px] font-semibold text-muted-foreground font-mono">
                                {labelValue(barn?.colLabels, defCols, ci)}
                            </div>
                        ))}
                        {Array.from({ length: rowCount }, (_, ri) => (
                            <React.Fragment key={ri}>
                                <div className="flex items-center justify-center text-[11px] font-semibold text-muted-foreground font-mono">
                                    {labelValue(barn?.rowLabels, defRows, ri)}
                                </div>
                                {Array.from({ length: cols }, (_, ci) => {
                                    const u = units[ri * cols + ci];
                                    if (!u) return <div key={ci} />;
                                    if ((u.type || 'stall') !== 'stall') {
                                        return <div key={ci} className="h-14 rounded-sm border border-dashed border-muted-foreground/20 bg-muted/30" />;
                                    }
                                    const clickable = !!u.taken;
                                    const hit = matches(u);
                                    return (
                                        <button
                                            key={ci}
                                            type="button"
                                            disabled={!clickable}
                                            title={clickable ? `${u.number}${u.trainer ? ' · ' + u.trainer : ''}` : `${u.number} (not booked)`}
                                            onClick={() => onPick({
                                                barnName: barn.name,
                                                stallNumber: u.number,
                                                stableWith: u.trainer || '',
                                            })}
                                            className={cn(
                                                'h-14 w-full rounded-sm border flex flex-col items-center justify-center overflow-hidden px-0.5 font-mono text-[9px] transition',
                                                clickable
                                                    ? 'bg-blue-600 border-blue-600 text-white hover:ring-2 hover:ring-amber-400 cursor-pointer'
                                                    : 'bg-muted/40 text-muted-foreground/60 cursor-not-allowed',
                                                q && !hit && 'opacity-20',
                                                q && hit && clickable && 'ring-2 ring-amber-400',
                                            )}
                                        >
                                            {u.trainer && <span className="font-semibold leading-tight truncate max-w-full">{u.trainer}</span>}
                                            <span className="leading-tight">{u.number}</span>
                                        </button>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">Blue stalls are booked. Grey stalls are not booked yet.</p>
            </DialogContent>
        </Dialog>
    );
};

export default StallPickerDialog;
