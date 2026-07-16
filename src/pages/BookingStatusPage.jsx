import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
    Loader2, ArrowLeft, Calendar, Phone, Mail, Hash, Home, Car,
    DollarSign, AlertCircle, Copy, RefreshCw, CheckCircle2, XCircle,
    Clock, LogIn, LogOut, BellRing, CreditCard,
} from 'lucide-react';

import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { startStallCheckout } from '@/lib/housingCheckout';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const STATUS_META = {
    pending:     { label: 'Pending',     color: 'bg-amber-500',   icon: Clock,         note: 'Waiting for the show organizer to confirm. Save this page or your booking ID.' },
    confirmed:   { label: 'Confirmed',   color: 'bg-blue-500',    icon: CheckCircle2,  note: 'You\'re all set! See you at the show. Bring this page (or your booking ID) at check-in.' },
    checked_in:  { label: 'Checked In',  color: 'bg-emerald-500', icon: LogIn,         note: 'Welcome! You\'re checked in. Find your stalls below.' },
    checked_out: { label: 'Checked Out', color: 'bg-slate-500',   icon: LogOut,        note: 'Thanks for joining us! Come back for the next show.' },
    cancelled:   { label: 'Cancelled',   color: 'bg-red-500',     icon: XCircle,       note: 'This booking has been cancelled. Contact the show organizer if this is unexpected.' },
};

const BookingStatusPage = () => {
    const { bookingId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isPaying, setIsPaying] = useState(false);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!bookingId) return;
        if (!silent) setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_public_booking', { p_booking_id: bookingId });
            if (error) throw error;
            if (!data) {
                setNotFound(true);
                setData(null);
            } else {
                setData(data);
                setNotFound(false);
            }
        } catch (e) {
            if (!silent) toast({ title: 'Could not load booking', description: e.message, variant: 'destructive' });
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [bookingId, toast]);

    useEffect(() => { load(); }, [load]);

    // Auto-refresh on tab focus so admin status changes show up live.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') load({ silent: true });
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [load]);

    // Returning from Stripe (success_url carries ?session_id=…) → confirm + refresh.
    // The webhook has already written the payment; we just reload to show it.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('session_id')) return;
        toast({ title: 'Payment received', description: 'Thank you! Your balance has been updated.' });
        window.history.replaceState({}, '', window.location.pathname);
        // Give the webhook a moment, then refresh the booking.
        setTimeout(() => load({ silent: true }), 1500);
    }, [load, toast]);

    const payBalance = async () => {
        if (!data?.show?.id || !data?.booking?.id) return;
        setIsPaying(true);
        try {
            await startStallCheckout({
                showId: data.show.id,
                bookingId: data.booking.id,
                customerEmail: data.booking.email,
            });
        } catch (e) {
            toast({ title: 'Could not open payment', description: e.message, variant: 'destructive' });
            setIsPaying(false);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast({ title: 'Link copied!', description: 'Save it to check your booking later.' });
        } catch {
            toast({ title: 'Copy failed', variant: 'destructive' });
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (notFound || !data) {
        return (
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-xl mx-auto px-4 py-24 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <h1 className="text-3xl font-bold mb-2">Booking Not Found</h1>
                    <p className="text-muted-foreground mb-6">
                        We couldn't find a booking with this ID. Check the link or contact the show organizer.
                    </p>
                    <Button onClick={() => navigate('/book-stalls')}>Browse Shows</Button>
                </main>
            </div>
        );
    }

    const { booking, assignedStalls = [], assignedRvSpots = [], show } = data;
    const meta = STATUS_META[booking.status] || STATUS_META.pending;
    const StatusIcon = meta.icon;
    const shortRef = String(booking.id || '').slice(0, 8).toUpperCase();
    const horseList = booking.horseNames?.length
        ? booking.horseNames
        : (booking.horseName ? [booking.horseName] : []);
    const stallItems = (booking.items || []).filter(i => i.type === 'stall');
    const rvItems = (booking.items || []).filter(i => i.type === 'rv');
    const supportItems = (booking.items || []).filter(i => i.type === 'support');
    const supplyItems = (booking.items || []).filter(i => i.type === 'supply');

    return (
        <>
            <Helmet>
                <title>Booking {shortRef} · {show?.name}</title>
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/show/${show?.id}`)}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Show
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => load()}>
                                    <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                                </Button>
                                <Button variant="outline" size="sm" onClick={copyLink}>
                                    <Copy className="h-4 w-4 mr-1" /> Copy Link
                                </Button>
                            </div>
                        </div>

                        <Card className={cn('border-2', meta.color.replace('bg-', 'border-'))}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">{show?.name}</p>
                                        <CardTitle className="text-2xl">My Reservation</CardTitle>
                                        <CardDescription className="font-mono mt-1 flex items-center gap-1">
                                            <Hash className="h-3 w-3" /> {shortRef}
                                        </CardDescription>
                                    </div>
                                    <span className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-white', meta.color)}>
                                        <StatusIcon className="h-5 w-5" />
                                        {meta.label}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className={cn('rounded-lg border-2 p-3 text-sm flex items-start gap-2',
                                    meta.color.replace('bg-', 'border-'),
                                    meta.color.replace('bg-', 'bg-').replace('500', '50') + ' dark:bg-opacity-20'
                                )}>
                                    <BellRing className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <p>{meta.note}</p>
                                </div>

                                {/* Quick info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">Exhibitor</p>
                                        <p>{booking.exhibitorName || '—'}</p>
                                        {booking.trainerName && <p className="text-xs text-muted-foreground">{booking.trainerName}</p>}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">Dates</p>
                                        <p className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {booking.arrivalDate && booking.departureDate ? (
                                                <>
                                                    {format(parseISO(booking.arrivalDate), 'MMM d')} – {format(parseISO(booking.departureDate), 'MMM d, yyyy')}
                                                    <span className="text-xs text-muted-foreground">· {booking.nights || 0}n</span>
                                                </>
                                            ) : '—'}
                                        </p>
                                    </div>
                                    {booking.email && (
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">Email</p>
                                            <a href={`mailto:${booking.email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                                                <Mail className="h-3.5 w-3.5" /> {booking.email}
                                            </a>
                                        </div>
                                    )}
                                    {booking.phone && (
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">Phone</p>
                                            <a href={`tel:${booking.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                                                <Phone className="h-3.5 w-3.5" /> {booking.phone}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Assigned stalls */}
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                                        <Home className="h-3.5 w-3.5 text-primary" /> Your Stalls ({assignedStalls.length})
                                    </p>
                                    {/* Requested stall charges — shown even before specific stalls are
                                        assigned, so the line item and its cost reconcile with the Total. */}
                                    {stallItems.length > 0 && (
                                        <div className="space-y-1 mb-2 text-sm">
                                            {stallItems.map((it, i) => (
                                                <div key={`st-${i}`} className="flex justify-between">
                                                    <span>🏠 {it.name}</span>
                                                    <span className="font-semibold tabular-nums">{money(it.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {assignedStalls.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">
                                            {stallItems.length > 0
                                                ? 'Specific stall numbers not assigned yet — the organizer will assign them before the show.'
                                                : 'Stalls have not been assigned yet. The organizer will assign them before the show.'}
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {assignedStalls.map(s => (
                                                <Badge
                                                    key={s.stallId}
                                                    className="bg-emerald-600 text-white font-mono text-sm px-3 py-1.5"
                                                    title={`${s.barnName} · Stall ${s.stallNumber}`}
                                                >
                                                    {s.barnName}: {s.stallNumber}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Assigned RV / camping spots */}
                                {rvItems.length > 0 && (
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                                            <Car className="h-3.5 w-3.5 text-cyan-600" /> Your RV / Camping Spots ({assignedRvSpots.length})
                                        </p>
                                        {assignedRvSpots.length === 0 ? (
                                            <p className="text-sm text-muted-foreground italic">
                                                Specific RV spot numbers not assigned yet — the organizer will assign them before the show.
                                            </p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {assignedRvSpots.map(s => (
                                                    <Badge
                                                        key={s.spotId}
                                                        className="bg-cyan-600 text-white font-mono text-sm px-3 py-1.5"
                                                        title={`${s.areaName} · Spot ${s.spotNumber}`}
                                                    >
                                                        {s.areaName}: {s.spotNumber}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Horses */}
                                {horseList.length > 0 && (
                                    <div className="rounded-lg border p-3">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">🐎 Horses</p>
                                        <div className="flex flex-wrap gap-1">
                                            {horseList.map((h, i) => (
                                                <Badge key={i} variant="secondary">{h}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* RV / supplies / support */}
                                {(rvItems.length > 0 || supportItems.length > 0 || supplyItems.length > 0) && (
                                    <div className="rounded-lg border p-3 space-y-2 text-sm">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1.5">
                                            <Car className="h-3.5 w-3.5 text-cyan-600" /> Other Items
                                        </p>
                                        {rvItems.map((it, i) => (
                                            <div key={`rv-${i}`} className="flex justify-between">
                                                <span>🚐 {it.name}</span>
                                                <span className="font-semibold tabular-nums">{money(it.amount)}</span>
                                            </div>
                                        ))}
                                        {supportItems.map((it, i) => (
                                            <div key={`sp-${i}`} className="flex justify-between">
                                                <span>📦 {it.name}</span>
                                                <span className="font-semibold tabular-nums">{money(it.amount)}</span>
                                            </div>
                                        ))}
                                        {supplyItems.map((it, i) => (
                                            <div key={`su-${i}`} className="flex justify-between">
                                                <span>🛒 {it.name}</span>
                                                <span className="font-semibold tabular-nums">{money(it.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Total */}
                                {(booking.totalAmount || booking.amount) > 0 && (
                                    <div className="flex justify-between items-center border-t pt-3">
                                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <DollarSign className="h-4 w-4" /> Total
                                        </span>
                                        <span className="text-2xl font-bold">{money(booking.totalAmount || booking.amount)}</span>
                                    </div>
                                )}

                                {/* Payment status + pay balance */}
                                {(() => {
                                    const total = Number(booking.totalAmount ?? booking.amount ?? 0);
                                    const paid = Number(booking.paidAmount ?? (booking.paymentStatus === 'paid' ? total : 0));
                                    const balanceDue = Math.max(0, total - paid);
                                    if (total <= 0) return null;
                                    return (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
                                                {booking.paymentStatus && (
                                                    <span>Payment: <Badge variant="outline" className="capitalize">{booking.paymentStatus.replace('_', ' ')}</Badge></span>
                                                )}
                                                <span>Paid: <span className="font-medium text-foreground">{money(paid)}</span> of {money(total)}</span>
                                            </div>
                                            {balanceDue > 0 ? (
                                                <div className="rounded-lg border border-amber-400 bg-amber-500/10 p-3 space-y-2">
                                                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                                        Balance due: {money(balanceDue)}
                                                    </p>
                                                    <Button className="w-full" onClick={payBalance} disabled={isPaying}>
                                                        {isPaying
                                                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening payment…</>
                                                            : <><CreditCard className="h-4 w-4 mr-2" /> Pay {money(balanceDue)} now</>}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border border-emerald-500 bg-emerald-500/10 p-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                                    <CheckCircle2 className="h-4 w-4" /> Paid in full
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Preferences (read-only) */}
                                {booking.preferences && (
                                    <div className="bg-muted/40 rounded-md p-3 text-xs italic text-muted-foreground">
                                        💬 Your note to the organizer: {booking.preferences}
                                    </div>
                                )}

                                <p className="text-xs text-center text-muted-foreground pt-2 border-t">
                                    Bookmark this page to check your booking status anytime. The page auto-updates when the organizer changes your status.
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default BookingStatusPage;
