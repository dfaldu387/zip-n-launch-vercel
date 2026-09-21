import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Globe, Search, ExternalLink, Loader2, ArrowLeft } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ModuleStatusBadge } from '@/components/show-builder/ModuleStatusBadge';
import { migrateLegacyStatus, MODULE_STATUS } from '@/lib/moduleStatusService';

// Robert's ask (2026-09-20 video): "I think it is as simple as just having its own
// page, which has a list of everything that's publicly displayed" — one place to see,
// across every show, whether stalls are open for public booking and what payment
// method each show uses, instead of opening each show one-by-one to check.

const BILLING_LABELS = {
    invoice_after: 'Invoice after confirmation',
    at_booking: 'Bill at booking',
};

const housingStatusOf = (pd) => {
    const raw = pd?.moduleStatuses?.housing || pd?.stallingService?.publishStatus || 'draft';
    const m = migrateLegacyStatus(raw);
    return (m === MODULE_STATUS.LOCKED || m === MODULE_STATUS.PUBLISHED) ? m : MODULE_STATUS.DRAFT;
};

const patternBookStatusOf = (pd) => migrateLegacyStatus(pd?.moduleStatuses?.patternBook || 'draft');

const chartPublicOf = (pd) => pd?.stallingService?.chartPublish?.enabled === true;

export default function PublicShowStatusPage() {
    const { user } = useAuth();
    const [shows, setShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all'); // 'all' | 'public' | 'not_public'

    useEffect(() => {
        const fetchShows = async () => {
            if (!user) { setIsLoading(false); return; }
            const { data, error } = await supabase
                .from('projects')
                .select('id, project_name, project_data, status')
                .eq('user_id', user.id)
                .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")')
                .order('created_at', { ascending: false });
            if (error) console.error('PublicShowStatusPage fetch error:', error);
            setShows(data || []);
            setIsLoading(false);
        };
        fetchShows();
    }, [user]);

    const rows = useMemo(() => shows.map(show => {
        const pd = show.project_data || {};
        const housingStatus = housingStatusOf(pd);
        return {
            id: show.id,
            name: show.project_name || 'Untitled Show',
            startDate: pd.startDate || null,
            endDate: pd.endDate || null,
            housingStatus,
            isPublic: housingStatus === MODULE_STATUS.PUBLISHED,
            billingMode: pd.stallingService?.billingMode || 'invoice_after',
            patternBookStatus: patternBookStatusOf(pd),
            chartPublic: chartPublicOf(pd),
        };
    }), [shows]);

    const visibleRows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter(r => {
            if (filter === 'public' && !r.isPublic) return false;
            if (filter === 'not_public' && r.isPublic) return false;
            if (q && !r.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [rows, query, filter]);

    const publicCount = rows.filter(r => r.isPublic).length;

    return (
        <>
            <Helmet>
                <title>Public Status — All Shows | EquiPatterns</title>
                <meta name="description" content="See, at a glance, which of your shows are open for public stall booking and what payment method each uses." />
            </Helmet>
            <Navigation />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <Link to="/horse-show-manager" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft className="h-4 w-4" /> Back to Horse Show Manager
                </Link>

                <div className="flex items-center gap-2 mb-1.5">
                    <Globe className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-bold">Public Status — All Shows</h1>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    Every show you run, in one list — is it open for public stall booking right now, and what payment method does it use.
                    {!isLoading && <> <span className="font-medium text-foreground">{publicCount}</span> of {rows.length} shows are currently public.</>}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by show name…" className="pl-9" />
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All shows</SelectItem>
                            <SelectItem value="public">Public only</SelectItem>
                            <SelectItem value="not_public">Not public</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading your shows…
                    </div>
                ) : visibleRows.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground">
                        {rows.length === 0 ? 'No shows yet.' : 'No shows match your search/filter.'}
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2.5">Show</th>
                                    <th className="text-left font-medium px-4 py-2.5">Dates</th>
                                    <th className="text-left font-medium px-4 py-2.5">Public Booking</th>
                                    <th className="text-left font-medium px-4 py-2.5">Stall Chart Public</th>
                                    <th className="text-left font-medium px-4 py-2.5">Payment Setting</th>
                                    <th className="text-left font-medium px-4 py-2.5">Pattern Book</th>
                                    <th className="text-right font-medium px-4 py-2.5">Manage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {visibleRows.map(r => (
                                    <tr key={r.id} className="hover:bg-muted/20">
                                        <td className="px-4 py-3 font-medium truncate max-w-[220px]">{r.name}</td>
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                            {r.startDate ? new Date(r.startDate).toLocaleDateString() : '—'}
                                            {r.endDate ? ` – ${new Date(r.endDate).toLocaleDateString()}` : ''}
                                        </td>
                                        <td className="px-4 py-3">
                                            <ModuleStatusBadge status={r.housingStatus} moduleKey="housing" readOnly
                                                readOnlyReason="Change this on the Housing & Grounds Manager page for this show." />
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {r.chartPublic
                                                ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">Shown</span>
                                                : <span className="text-muted-foreground">Hidden</span>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">{BILLING_LABELS[r.billingMode] || r.billingMode}</td>
                                        <td className="px-4 py-3">
                                            <ModuleStatusBadge status={r.patternBookStatus} moduleKey="patternBook" readOnly
                                                readOnlyReason="Change this on the Pattern Book Builder page for this show." />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1">
                                                <Link to={`/horse-show-manager/housing-grounds-manager/${r.id}`}>
                                                    Open <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
