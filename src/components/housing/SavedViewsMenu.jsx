import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bookmark, ChevronDown, Trash2 } from 'lucide-react';
import { loadViews, saveView, deleteView } from '@/lib/calendarViews';

// "Saved Views" for a calendar: save the current filters under a name, open them later.
// Kept in this browser for this person only.
export default function SavedViewsMenu({ showId, calendar, getState, onApply }) {
    const [views, setViews] = useState(() => loadViews(showId, calendar));
    const [name, setName] = useState('');
    const [open, setOpen] = useState(false);

    const save = () => {
        if (!name.trim()) return;
        setViews(saveView(showId, calendar, name, getState()));
        setName('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <Bookmark className="h-3.5 w-3.5" /> Saved views{views.length ? ` (${views.length})` : ''}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3 space-y-3">
                {views.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No saved views yet. Set the filters you like, then save them below.</p>
                ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {views.map((v) => (
                            <div key={v.id} className="flex items-center gap-1 rounded hover:bg-muted">
                                <button
                                    type="button"
                                    className="flex-1 text-left text-sm px-2 py-1.5 truncate"
                                    onClick={() => { onApply(v.state); setOpen(false); }}
                                >
                                    {v.name}
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Delete view ${v.name}`}
                                    className="p-1.5 text-muted-foreground hover:text-red-600"
                                    onClick={() => setViews(deleteView(showId, calendar, v.id))}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold">Save the current view</p>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                        placeholder="e.g. Barn manager – Barns 1-3"
                        maxLength={60}
                        className="h-9 text-sm"
                    />
                    <Button size="sm" className="w-full" disabled={!name.trim()} onClick={save}>Save view</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
