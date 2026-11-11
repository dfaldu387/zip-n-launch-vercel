import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, EyeOff, Copy, ExternalLink, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { isEventPagePublished } from '@/lib/publicPage';

// Is the Housing module / Pattern Book live? (same rules the public page uses)
export const housingIsLive = (pd) => pd?.moduleStatuses?.housing === 'published';
export const patternIsLive = (pd, status) =>
    pd?.moduleStatuses?.patternBook === 'published' ||
    ['Final', 'Publication', 'published'].includes(status);

const StatusRow = ({ label, note, live, liveText = 'Published', offText = 'Draft' }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0">
        <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-[11px] text-muted-foreground">{note}</p>
        </div>
        <Badge
            variant="outline"
            className={cn('shrink-0 text-[11px]', live
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-amber-50 text-amber-700 border-amber-300')}
        >
            {live ? liveText : offText}
        </Badge>
    </div>
);

// The Event page's own Draft / Published switch. It is NOT the Housing status, NOT the
// Pattern Book status and NOT the Publish Chart switch: each of those is set in its own
// place, and this card only shows where each one stands.
const EventPagePublishCard = ({ pd, onChange, showId, status, className }) => {
    const { toast } = useToast();
    const housingLive = housingIsLive(pd);
    const patternLive = patternIsLive(pd, status);
    const published = isEventPagePublished(pd?.publicPage, housingLive || patternLive);
    const chart = pd?.stallingService?.chartPublish;
    const chartLive = !!chart?.enabled;
    const eventUrl = `${window.location.origin}/event-detail/${showId}`;

    const set = (value) => {
        if (value === published && pd?.publicPage?.eventPublished === value) return;
        onChange(cur => ({ ...cur, eventPublished: value }));
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(eventUrl);
            toast({ title: 'Link copied' });
        } catch {
            toast({ title: 'Could not copy', description: eventUrl, variant: 'destructive' });
        }
    };

    return (
        <Card className={cn('mb-6 border-2', published ? 'border-emerald-300 dark:border-emerald-800' : 'border-amber-300 dark:border-amber-800', className)}>
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            {published ? <Globe className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-amber-600" />}
                            Event page status
                        </CardTitle>
                        <CardDescription className="text-xs mt-1.5 max-w-xl">
                            {published
                                ? 'Your event page is public. Anyone with the link can see it, and it appears on the Events page. Use it to market the show now.'
                                : 'Your event page is a draft. The public cannot open it and it is not on the Events page. Only you can preview it.'}
                            {' '}This switch is separate from Housing, Pattern Book and the stalling chart.
                        </CardDescription>
                    </div>
                    <div className="inline-flex rounded-md border overflow-hidden shrink-0" role="group" aria-label="Event page status">
                        <Button
                            type="button" size="sm"
                            variant={!published ? 'default' : 'ghost'}
                            className={cn('rounded-none h-9 px-4', !published && 'bg-amber-500 hover:bg-amber-500 text-white')}
                            onClick={() => set(false)}
                        >
                            Draft
                        </Button>
                        <Button
                            type="button" size="sm"
                            variant={published ? 'default' : 'ghost'}
                            className={cn('rounded-none h-9 px-4', published && 'bg-emerald-600 hover:bg-emerald-600 text-white')}
                            onClick={() => set(true)}
                        >
                            {published && <Check className="h-3.5 w-3.5 mr-1" />} Published
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <code className={cn('flex-1 min-w-[220px] truncate rounded border bg-muted px-2 py-1.5 text-xs', !published && 'opacity-60')}>{eventUrl}</code>
                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={copy}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5"
                        onClick={() => window.open(`${eventUrl}?preview=1`, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" /> {published ? 'Open' : 'Preview draft'}
                    </Button>
                </div>

                <div className="rounded-md border px-3">
                    <StatusRow
                        label="Event page"
                        note="Name, dates, banner, contacts, documents. Set with the switch above."
                        live={published}
                    />
                    <StatusRow
                        label="Housing & Grounds Manager"
                        note="Book Stalls, RV & Supplies and Order Hay & Shavings buttons. Set with the status bar at the top of Booking & Stall Management."
                        live={housingLive}
                        offText="Draft / Locked"
                    />
                    <StatusRow
                        label="Pattern Book"
                        note="View Pattern Book button. Set in the Pattern Book Builder."
                        live={patternLive}
                    />
                    <StatusRow
                        label="Stalling chart"
                        note="Public stall and RV chart. Set with Publish Chart on the Assign Stalls tab."
                        live={chartLive}
                        offText="Hidden"
                    />
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Each action button on the event page appears only when its own item above is Published, so you can publish the event page first and turn the others on later.
                </p>
            </CardContent>
        </Card>
    );
};

export default EventPagePublishCard;
