import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Shared "short list + View all" pieces, used by the Master List, the Housing Manager
// booking rows and the Check-In page. Display only — nothing here changes a booking.

const LIMIT = 6;      // up to this many show in full
const PREVIEW = 3;    // more than LIMIT shows this many, plus the "View all N" badge

export const byNumber = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

const ViewAllButton = ({ count, label, onClick, className }) => (
    <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={cn('inline-flex items-center rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary whitespace-nowrap hover:bg-primary/15', className)}
        title={`See all ${count} ${label.toLowerCase()}`}
    >
        View all {count}
    </button>
);

// Stalls or RV spots as chips. More than 6 → 3 chips + "View all N"; the pop-up shows
// every number as a grid, grouped by barn / RV area.
//   chipClassName — size/text of the chips (the gate screen uses bigger ones)
//   buttonClassName — size of the View all badge
export const AssignedChips = ({ numbers = [], places = [], color, noun = 'Stalls', owner = '', compact = true, chipClassName = 'text-[10px]', buttonClassName = '' }) => {
    const [open, setOpen] = useState(false);
    const many = numbers.length > LIMIT;
    const sorted = useMemo(() => [...numbers].sort(byNumber), [numbers]);
    const shown = many && compact ? sorted.slice(0, PREVIEW) : sorted;
    const groups = useMemo(() => {
        const map = new Map();
        (places.length ? places : numbers.map(n => ({ place: '', number: n }))).forEach(p => {
            const key = p.place || (noun === 'RV' ? 'RV spots' : 'Stalls');
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(p.number);
        });
        return [...map.entries()].map(([place, nums]) => ({ place, nums: nums.sort(byNumber) }));
    }, [places, numbers, noun]);
    return (
        <>
            {shown.map((n, i) => (
                <Badge key={i} className={cn(color, 'text-white font-mono whitespace-nowrap', chipClassName)}>{n}</Badge>
            ))}
            {many && <ViewAllButton count={numbers.length} label={noun} onClick={() => setOpen(true)} className={buttonClassName} />}
            {many && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{owner ? `${owner} — ` : ''}{noun} ({numbers.length})</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {groups.map(g => (
                                <div key={g.place}>
                                    <p className="text-sm font-semibold mb-1.5">{g.place} <span className="text-muted-foreground font-normal">({g.nums.length})</span></p>
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-1.5">
                                        {g.nums.map((n, i) => (
                                            <div key={i} className={cn('rounded-md py-1.5 text-center text-xs font-mono font-medium text-white', color)}>{n}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

// Horse names as chips. More than 6 → 3 chips + "View all N"; the pop-up is a numbered
// list in two columns.
export const HorseChips = ({ names = [], owner = '', chipClassName = 'text-xs', buttonClassName = '' }) => {
    const [open, setOpen] = useState(false);
    const many = names.length > LIMIT;
    const shown = many ? names.slice(0, PREVIEW) : names;
    return (
        <>
            {shown.map((h, i) => (
                <Badge key={i} variant="secondary" className={chipClassName}>{h}</Badge>
            ))}
            {many && <ViewAllButton count={names.length} label="Horses" onClick={() => setOpen(true)} className={buttonClassName} />}
            {many && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{owner ? `${owner} — ` : ''}Horses ({names.length})</DialogTitle>
                        </DialogHeader>
                        <ol className="columns-2 gap-x-6 text-sm">
                            {names.map((h, i) => (
                                <li key={i} className="break-inside-avoid py-0.5">
                                    <span className="text-muted-foreground tabular-nums inline-block w-6">{i + 1}.</span>{h}
                                </li>
                            ))}
                        </ol>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};
