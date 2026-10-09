import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, EyeOff, Minus, ListChecks, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    getAutoValues, publicText, publicList, realAssociations, realDisciplines,
    resolveContacts, publicHotel, publicDocuments, formatShowDateRange,
} from '@/lib/publicPage';

const dayOnly = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');

// One line per thing on the public event page: is the public seeing it right now?
// state: 'visible' (green check), 'hidden' (turned off), 'empty' (nothing entered yet)
export function buildSummaryRows(pd = {}) {
    const pp = pd.publicPage || {};
    const hidden = pp.hidden || {};
    const auto = getAutoValues(pd);

    const text = (key, label) => {
        const value = publicText(pd, key, auto[key]);
        if (hidden[key]) return { key, label, state: 'hidden', value: '' };
        return value ? { key, label, state: 'visible', value } : { key, label, state: 'empty', value: '' };
    };

    const list = (key, label, real, unit) => {
        const items = publicList(pd, key, real);
        if (hidden[key]) return { key, label, state: 'hidden', value: '' };
        if (real.length === 0 && !Array.isArray(pp.lists?.[key])) return { key, label, state: 'empty', value: '' };
        if (items.length === 0) return { key, label, state: 'empty', value: 'All removed' };
        return { key, label, state: 'visible', value: unit ? `${items.length} ${unit}` : items.join(', ') };
    };

    const dates = (() => {
        if (hidden.showDates) return { key: 'showDates', label: 'Show dates', state: 'hidden', value: '' };
        const range = pp.dates?.start || pp.dates?.end
            ? formatShowDateRange(
                pp.dates.start || dayOnly(pd.startDate || pd.showDetails?.general?.startDate),
                pp.dates.end || dayOnly(pd.endDate || pd.showDetails?.general?.endDate))
            : publicText(pd, 'showDates', auto.showDates);
        return range ? { key: 'showDates', label: 'Show dates', state: 'visible', value: range } : { key: 'showDates', label: 'Show dates', state: 'empty', value: '' };
    })();

    const contacts = resolveContacts(pp, pd.showDetails?.general || {}).filter(c => c.hasData);
    const shownContacts = contacts.filter(c => !c.hidden);
    const contactRow = contacts.length === 0
        ? { key: 'contacts', label: 'Contacts', state: 'empty', value: '' }
        : shownContacts.length === 0
            ? { key: 'contacts', label: 'Contacts', state: 'hidden', value: '' }
            : {
                key: 'contacts', label: 'Contacts', state: 'visible',
                value: `${shownContacts.map(c => c.label).join(', ')}${contacts.length > shownContacts.length ? ` (${contacts.length - shownContacts.length} hidden)` : ''}`,
            };

    const hotelData = pp.hotel && (pp.hotel.name || pp.hotel.address || pp.hotel.phone || pp.hotel.website);
    const hotelRow = !hotelData
        ? { key: 'hotel', label: 'Sponsor hotel', state: 'empty', value: '' }
        : hidden.hotel
            ? { key: 'hotel', label: 'Sponsor hotel', state: 'hidden', value: '' }
            : { key: 'hotel', label: 'Sponsor hotel', state: 'visible', value: publicHotel(pp)?.name || 'Shown' };

    const docs = Array.isArray(pp.documents) ? pp.documents : [];
    const docRow = docs.length === 0
        ? { key: 'documents', label: 'Show documents', state: 'empty', value: '' }
        : hidden.documents
            ? { key: 'documents', label: 'Show documents', state: 'hidden', value: '' }
            : { key: 'documents', label: 'Show documents', state: 'visible', value: `${publicDocuments(pp).length} file${docs.length === 1 ? '' : 's'}` };

    const logoRow = !pp.logoUrl
        ? { key: 'logo', label: 'Event logo', state: 'empty', value: '' }
        : hidden.logo
            ? { key: 'logo', label: 'Event logo', state: 'hidden', value: '' }
            : { key: 'logo', label: 'Event logo', state: 'visible', value: 'Shown in the banner' };

    const welcomeData = typeof pp.welcome === 'string' && pp.welcome.trim();
    const welcomeRow = !welcomeData
        ? { key: 'welcome', label: 'Welcome message', state: 'empty', value: '' }
        : hidden.welcome
            ? { key: 'welcome', label: 'Welcome message', state: 'hidden', value: '' }
            : { key: 'welcome', label: 'Welcome message', state: 'visible', value: `${pp.welcome.trim().length} characters` };

    return [
        logoRow,
        welcomeRow,
        text('showName', 'Show name'),
        dates,
        text('showType', 'Show type'),
        text('venueName', 'Venue name'),
        text('venueAddress', 'Venue address'),
        list('associations', 'Associations', realAssociations(pd)),
        list('disciplines', 'Disciplines', realDisciplines(pd), 'shown'),
        text('officials', 'Officials'),
        text('judges', 'Judges'),
        contactRow,
        hotelRow,
        docRow,
    ];
}

const STATE_STYLES = {
    visible: { icon: Check, iconClass: 'text-emerald-600', label: 'Visible' },
    hidden: { icon: EyeOff, iconClass: 'text-muted-foreground', label: 'Hidden' },
    empty: { icon: Minus, iconClass: 'text-muted-foreground/60', label: 'Nothing entered' },
};

const VisibleNowSummary = ({ pd, showId }) => {
    const rows = buildSummaryRows(pd);
    const visible = rows.filter(r => r.state === 'visible').length;
    const hiddenCount = rows.filter(r => r.state === 'hidden').length;
    const isLive = pd?.moduleStatuses?.housing === 'published';
    const eventUrl = `${window.location.origin}/event-detail/${showId}`;

    return (
        <Card className="mb-6 border-emerald-200 dark:border-emerald-900">
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ListChecks className="h-4 w-4 text-emerald-600" /> Visible right now
                        </CardTitle>
                        <CardDescription className="text-xs mt-1.5">
                            {visible} shown to the public{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}.
                            {!isLive && ' Your show is not published yet, so the public cannot open the booking page.'}
                        </CardDescription>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => window.open(eventUrl, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" /> See the public page
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map(r => {
                    const s = STATE_STYLES[r.state];
                    const Icon = s.icon;
                    return (
                        <div key={r.key} className="flex items-start gap-2 text-xs min-w-0">
                            <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', s.iconClass)} />
                            <div className="min-w-0">
                                <span className={cn('font-medium', r.state !== 'visible' && 'text-muted-foreground')}>{r.label}</span>
                                <span className="text-muted-foreground"> — {r.state === 'visible' ? r.value : (r.value || s.label)}</span>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};

export default VisibleNowSummary;
