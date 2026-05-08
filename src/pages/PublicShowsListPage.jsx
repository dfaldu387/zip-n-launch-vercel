import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { format, isFuture, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import {
    Loader2, Search, Calendar, MapPin, Home, Car, Warehouse,
    DollarSign, ArrowRight, CalendarOff, Filter,
} from 'lucide-react';

import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const money = (n) => `$${(Number(n) || 0).toFixed(0)}`;

// Compute summary info from a show's stallingService data
const summarizeInventory = (stalling = {}) => {
    const barns = stalling.barns || [];
    const rvAreas = stalling.rvAreas || [];
    const supportSpaces = stalling.supportSpaces || [];
    const supplies = stalling.supplies || [];

    let totalStalls = 0;
    let bookedStalls = 0;
    let minStallPrice = Infinity;
    for (const barn of barns) {
        const total = (barn.stalls || []).length || barn.stallCount || 0;
        const booked = (barn.stalls || []).filter(s => s.bookingId).length;
        totalStalls += total;
        bookedStalls += booked;
        if (barn.pricePerNight && barn.pricePerNight < minStallPrice) {
            minStallPrice = barn.pricePerNight;
        }
    }
    const stallsAvailable = Math.max(totalStalls - bookedStalls, 0);

    let totalRvSpots = 0;
    let minRvPrice = Infinity;
    for (const rv of rvAreas) {
        totalRvSpots += rv.spotCount || 0;
        if (rv.pricePerNight && rv.pricePerNight < minRvPrice) {
            minRvPrice = rv.pricePerNight;
        }
    }

    let totalSupportUnits = 0;
    for (const s of supportSpaces) totalSupportUnits += s.unitCount || 0;

    const startingPrice = Math.min(
        minStallPrice === Infinity ? Infinity : minStallPrice,
        minRvPrice === Infinity ? Infinity : minRvPrice,
    );

    return {
        totalStalls,
        stallsAvailable,
        totalRvSpots,
        totalSupportUnits,
        suppliesCount: supplies.length,
        startingPrice: startingPrice === Infinity ? 0 : startingPrice,
        hasInventory: totalStalls + totalRvSpots + totalSupportUnits + supplies.length > 0,
    };
};

const ShowCard = ({ show }) => {
    const navigate = useNavigate();
    const pd = show.project_data || {};
    const general = pd.showDetails?.general || {};
    const venue = pd.showDetails?.venue || {};
    const inv = useMemo(() => summarizeInventory(pd.stallingService), [pd]);

    const startDate = general.startDate || pd.startDate;
    const endDate = general.endDate || pd.endDate;

    let dateLabel = 'Dates TBA';
    let dateBadge = null;
    if (startDate) {
        try {
            const start = parseISO(startDate);
            const end = endDate ? parseISO(endDate) : start;
            dateLabel = `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
            const today = startOfDay(new Date());
            if (isAfter(start, today)) {
                dateBadge = <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Upcoming</Badge>;
            } else if (isBefore(end, today)) {
                dateBadge = <Badge variant="outline" className="text-muted-foreground">Ended</Badge>;
            } else {
                dateBadge = <Badge className="bg-emerald-500 text-white">Happening Now</Badge>;
            }
        } catch { /* ignore date parse errors */ }
    }

    return (
        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <CardTitle className="text-lg line-clamp-2">{show.project_name}</CardTitle>
                        {dateBadge}
                    </div>
                    {general.eventHost && (
                        <CardDescription className="text-xs">Hosted by {general.eventHost}</CardDescription>
                    )}
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>{dateLabel}</span>
                    </div>
                    {venue.facilityName && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{venue.facilityName}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                        {inv.totalStalls > 0 && (
                            <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-primary" />
                                <span className="text-xs">
                                    <span className="font-semibold">{inv.stallsAvailable}</span> of {inv.totalStalls} stalls
                                </span>
                            </div>
                        )}
                        {inv.totalRvSpots > 0 && (
                            <div className="flex items-center gap-2">
                                <Car className="h-4 w-4 text-cyan-600" />
                                <span className="text-xs">
                                    <span className="font-semibold">{inv.totalRvSpots}</span> RV spots
                                </span>
                            </div>
                        )}
                        {inv.totalSupportUnits > 0 && (
                            <div className="flex items-center gap-2">
                                <Warehouse className="h-4 w-4 text-indigo-600" />
                                <span className="text-xs">
                                    <span className="font-semibold">{inv.totalSupportUnits}</span> tack/support
                                </span>
                            </div>
                        )}
                        {inv.suppliesCount > 0 && (
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-amber-600" />
                                <span className="text-xs">
                                    <span className="font-semibold">{inv.suppliesCount}</span> add-ons
                                </span>
                            </div>
                        )}
                    </div>

                    {inv.startingPrice > 0 && (
                        <div className="pt-2 text-xs text-muted-foreground">
                            Starting at <span className="font-bold text-foreground">{money(inv.startingPrice)}/night</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/show/${show.id}`)}>
                        Details
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/show/${show.id}/book`)}>
                        Book Now <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

const PublicShowsListPage = () => {
    const { toast } = useToast();
    const [shows, setShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('upcoming'); // upcoming | all | now

    useEffect(() => {
        const loadShows = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('id, project_name, project_type, project_data, created_at')
                    .eq('project_type', 'show')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Only keep shows that have inventory configured
                const withInventory = (data || []).filter(s => {
                    const stalling = s.project_data?.stallingService || {};
                    return summarizeInventory(stalling).hasInventory;
                });

                setShows(withInventory);
            } catch (err) {
                toast({
                    title: 'Could not load shows',
                    description: err.message,
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };
        loadShows();
    }, [toast]);

    const filteredShows = useMemo(() => {
        const today = startOfDay(new Date());
        const term = search.trim().toLowerCase();
        return shows.filter(s => {
            const pd = s.project_data || {};
            const general = pd.showDetails?.general || {};
            const venue = pd.showDetails?.venue || {};
            const startDate = general.startDate || pd.startDate;
            const endDate = general.endDate || pd.endDate;

            // Date filter
            if (filter === 'upcoming' && startDate) {
                try {
                    if (!isAfter(parseISO(startDate), today) && !isAfter(parseISO(endDate || startDate), today)) {
                        return false;
                    }
                } catch { /* keep */ }
            }
            if (filter === 'now' && startDate && endDate) {
                try {
                    if (isAfter(parseISO(startDate), today) || isBefore(parseISO(endDate), today)) {
                        return false;
                    }
                } catch { return false; }
            }

            // Search
            if (term) {
                const haystack = [
                    s.project_name,
                    general.eventHost,
                    venue.facilityName,
                    venue.address,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(term)) return false;
            }

            return true;
        });
    }, [shows, search, filter]);

    return (
        <>
            <Helmet>
                <title>Reserve Stalls — Browse Horse Shows</title>
                <meta name="description" content="Browse upcoming horse shows and book stalls, RV spots, and supplies online." />
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="text-center mb-10">
                            <h1 className="text-4xl md:text-5xl font-bold mb-3">Reserve Your Stalls</h1>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Browse upcoming horse shows and book stalls, RV spots, and supplies online — pay securely with Stripe.
                            </p>
                        </div>

                        {/* Search + Filter */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-8 max-w-3xl mx-auto">
                            <div className="relative flex-1">
                                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by show name, host, or venue..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={filter} onValueChange={setFilter}>
                                <SelectTrigger className="sm:w-48">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="upcoming">Upcoming & Active</SelectItem>
                                    <SelectItem value="now">Happening Now</SelectItem>
                                    <SelectItem value="all">All Shows</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Content */}
                        {isLoading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            </div>
                        ) : filteredShows.length === 0 ? (
                            <Card className="max-w-2xl mx-auto text-center py-12">
                                <CardContent>
                                    <CalendarOff className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-60" />
                                    <h3 className="text-lg font-semibold mb-2">
                                        {shows.length === 0
                                            ? 'No shows accepting reservations right now'
                                            : 'No shows match your search'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {shows.length === 0
                                            ? 'Check back soon — show organizers are adding new dates regularly.'
                                            : 'Try a different search or filter.'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Showing <span className="font-semibold text-foreground">{filteredShows.length}</span> of {shows.length} shows
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredShows.map(show => (
                                        <ShowCard key={show.id} show={show} />
                                    ))}
                                </div>
                            </>
                        )}
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default PublicShowsListPage;
