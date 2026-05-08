import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
    Search, Mail, Hash, Loader2, ArrowRight, AlertCircle, CheckCircle2,
    Calendar, DollarSign,
} from 'lucide-react';

import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const STATUS_COLORS = {
    pending:     'bg-amber-500',
    confirmed:   'bg-blue-500',
    checked_in:  'bg-emerald-500',
    checked_out: 'bg-slate-500',
    cancelled:   'bg-red-500',
};

const safeFormat = (iso, fmt) => {
    try { return format(parseISO(iso), fmt); } catch { return iso || ''; }
};

const FindBookingPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [shortRef, setShortRef] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState(null); // null = not searched, [] = empty result

    const handleSearch = async (e) => {
        e?.preventDefault?.();
        const cleanEmail = email.trim();
        const cleanRef = shortRef.trim();
        if (!cleanEmail && !cleanRef) {
            toast({ title: 'Enter your email or booking reference', variant: 'destructive' });
            return;
        }
        setIsSearching(true);
        try {
            const { data, error } = await supabase.rpc('find_public_bookings', {
                p_email: cleanEmail || null,
                p_short_ref: cleanRef || null,
            });
            if (error) throw error;
            const list = Array.isArray(data) ? data : [];
            setResults(list);
            // 1 result → auto-navigate
            if (list.length === 1) {
                navigate(`/booking/${list[0].bookingId}`);
            }
        } catch (err) {
            toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <>
            <Helmet><title>Find My Booking</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="text-center mb-8 max-w-2xl mx-auto">
                            <Search className="h-10 w-10 mx-auto mb-3 text-primary" />
                            <h1 className="text-3xl md:text-4xl font-bold mb-2">Find My Booking</h1>
                            <p className="text-muted-foreground">
                                Lost your booking link? Enter your email or 8-character booking reference (e.g., <span className="font-mono text-foreground">4BDBA7BC</span>) below.
                            </p>
                        </div>

                        <Card className="max-w-2xl mx-auto">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Look up your reservation</CardTitle>
                                <CardDescription>Provide either field — both is more accurate.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSearch} className="space-y-4">
                                    <div>
                                        <Label htmlFor="email">Email</Label>
                                        <div className="relative">
                                            <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="you@example.com"
                                                className="pl-9 h-11"
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center text-xs text-muted-foreground">— OR —</div>
                                    <div>
                                        <Label htmlFor="ref">Booking Reference (8 chars)</Label>
                                        <div className="relative">
                                            <Hash className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="ref"
                                                value={shortRef}
                                                onChange={(e) => setShortRef(e.target.value.toUpperCase())}
                                                placeholder="4BDBA7BC"
                                                className="pl-9 h-11 font-mono uppercase tracking-wider"
                                                maxLength={8}
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full h-11" disabled={isSearching}>
                                        {isSearching ? (
                                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...</>
                                        ) : (
                                            <><Search className="h-4 w-4 mr-2" /> Find My Booking</>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Results */}
                        {results !== null && (
                            <div className="max-w-2xl mx-auto mt-8">
                                {results.length === 0 ? (
                                    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                                        <CardContent className="py-8 text-center">
                                            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-amber-600" />
                                            <p className="font-semibold mb-1">No bookings found</p>
                                            <p className="text-sm text-muted-foreground">
                                                Double-check your email and reference. If you can't find it, contact the show organizer directly.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Found <span className="font-semibold text-foreground">{results.length}</span> booking{results.length !== 1 ? 's' : ''}. Click one to view its status.
                                        </p>
                                        <div className="space-y-2">
                                            {results.map(r => {
                                                const color = STATUS_COLORS[r.status] || 'bg-slate-500';
                                                return (
                                                    <button
                                                        key={r.bookingId}
                                                        type="button"
                                                        onClick={() => navigate(`/booking/${r.bookingId}`)}
                                                        className="w-full text-left rounded-lg border-2 hover:border-primary hover:bg-primary/5 transition p-4 flex items-center gap-4"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                <p className="font-semibold">{r.showName}</p>
                                                                <Badge className={`${color} text-white text-xs capitalize`}>
                                                                    {(r.status || 'pending').replace('_', ' ')}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1 font-mono">
                                                                    <Hash className="h-3 w-3" />{r.shortRef}
                                                                </span>
                                                                <span>{r.exhibitorName}</span>
                                                                {r.arrivalDate && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="h-3 w-3" />
                                                                        {safeFormat(r.arrivalDate, 'MMM d')} – {safeFormat(r.departureDate, 'MMM d, yyyy')}
                                                                    </span>
                                                                )}
                                                                {r.totalAmount > 0 && (
                                                                    <span className="flex items-center gap-1">
                                                                        <DollarSign className="h-3 w-3" />${r.totalAmount.toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default FindBookingPage;
