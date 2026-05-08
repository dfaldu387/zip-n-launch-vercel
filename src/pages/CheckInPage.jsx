import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
    Loader2, Search, ArrowLeft, Home, Car, User, Phone, Mail,
    Calendar, DollarSign, CheckCircle2, XCircle, RotateCcw, AlertCircle,
    LogIn, LogOut, ScanLine, Maximize, Hash,
} from 'lucide-react';

import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { stampModuleStatusOnSave } from '@/lib/moduleStatusService';
import { getAssignedStallsForBooking } from '@/lib/stallAssignment';
import { cn } from '@/lib/utils';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// Bigger, friendlier status palette tuned for tablet glanceability
const STATUS_META = {
    pending:      { label: 'Pending',      color: 'bg-amber-500',    text: 'text-white', dim: 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-800' },
    confirmed:    { label: 'Confirmed',    color: 'bg-blue-500',     text: 'text-white', dim: 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-800' },
    checked_in:   { label: 'Checked In',   color: 'bg-emerald-500',  text: 'text-white', dim: 'bg-emerald-50 border-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-700' },
    checked_out:  { label: 'Checked Out',  color: 'bg-slate-500',    text: 'text-white', dim: 'bg-slate-50 border-slate-300 dark:bg-slate-900/30 dark:border-slate-700' },
    cancelled:    { label: 'Cancelled',    color: 'bg-red-500',      text: 'text-white', dim: 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-800' },
};

const FILTERS = [
    { id: 'all',         label: 'All' },
    { id: 'pending',     label: 'Pending' },
    { id: 'confirmed',   label: 'Confirmed' },
    { id: 'checked_in',  label: 'Checked In' },
    { id: 'checked_out', label: 'Checked Out' },
    { id: 'cancelled',   label: 'Cancelled' },
];

// ────────────────────── Booking Card ──────────────────────

const BookingCard = ({ booking, barns, onUpdateStatus, isSaving }) => {
    const meta = STATUS_META[booking.status] || STATUS_META.pending;
    const stalls = getAssignedStallsForBooking(booking, barns);
    const rvItems = (booking.items || []).filter(i => i.type === 'rv');
    const supportItems = (booking.items || []).filter(i => i.type === 'support');
    const supplyItems = (booking.items || []).filter(i => i.type === 'supply');
    const horseList = booking.horseNames?.length
        ? booking.horseNames
        : (booking.horseName ? [booking.horseName] : []);

    const shortRef = String(booking.id || '').slice(0, 8).toUpperCase();
    const isFinal = booking.status === 'checked_out' || booking.status === 'cancelled';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
        >
            <Card className={cn('border-2', meta.dim)}>
                <CardContent className="p-5 space-y-4">
                    {/* Header: name + status */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold leading-tight">
                                {booking.exhibitorName || 'Unnamed'}
                            </h3>
                            {booking.trainerName && (
                                <p className="text-sm text-muted-foreground mt-0.5">{booking.trainerName}</p>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <span className={cn('inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold', meta.color, meta.text)}>
                                {meta.label}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                <Hash className="h-3 w-3" /> {shortRef}
                            </span>
                        </div>
                    </div>

                    {/* Contact row */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                        {booking.phone && (
                            <a href={`tel:${booking.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                                <Phone className="h-4 w-4" /> {booking.phone}
                            </a>
                        )}
                        {booking.email && (
                            <a href={`mailto:${booking.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                                <Mail className="h-4 w-4" /> {booking.email}
                            </a>
                        )}
                        {booking.arrivalDate && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {format(parseISO(booking.arrivalDate), 'MMM d')}
                                {booking.departureDate && ` – ${format(parseISO(booking.departureDate), 'MMM d')}`}
                                {booking.nights ? ` · ${booking.nights}n` : ''}
                            </span>
                        )}
                        {(booking.totalAmount || booking.amount) ? (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <DollarSign className="h-4 w-4" /> {money(booking.totalAmount || booking.amount)}
                                {booking.paymentStatus && (
                                    <Badge variant="outline" className="ml-1 text-xs capitalize">
                                        {booking.paymentStatus.replace('_', ' ')}
                                    </Badge>
                                )}
                            </span>
                        ) : null}
                    </div>

                    {/* Horses */}
                    {horseList.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground font-semibold">🐎 Horses:</span>
                            <div className="flex flex-wrap gap-1">
                                {horseList.map((h, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">{h}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Inventory grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Stalls */}
                        <div className="rounded-lg border bg-background p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Home className="h-4 w-4 text-primary" />
                                <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Stalls ({stalls.length})
                                </span>
                            </div>
                            {stalls.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No stalls assigned</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {stalls.map(s => (
                                        <Badge
                                            key={s.id}
                                            className="bg-emerald-600 text-white font-mono text-sm px-2 py-1"
                                            title={`${s.barnName} · Stall ${s.number}`}
                                        >
                                            {s.number}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RV / Support / Supplies */}
                        <div className="rounded-lg border bg-background p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Car className="h-4 w-4 text-cyan-600" />
                                <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    Other
                                </span>
                            </div>
                            <div className="space-y-1 text-xs">
                                {rvItems.length === 0 && supportItems.length === 0 && supplyItems.length === 0 && (
                                    <p className="text-muted-foreground italic">No RV/extras</p>
                                )}
                                {rvItems.map((it, i) => (
                                    <p key={`rv-${i}`}>🚐 {it.name}</p>
                                ))}
                                {supportItems.map((it, i) => (
                                    <p key={`sp-${i}`}>📦 {it.name}</p>
                                ))}
                                {supplyItems.map((it, i) => (
                                    <p key={`su-${i}`}>🛒 {it.name}</p>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Preferences / notes */}
                    {(booking.preferences || booking.notes) && booking.preferences !== booking.notes && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 italic">
                            💬 {booking.preferences || booking.notes}
                        </div>
                    )}

                    {/* Action buttons (BIG, tablet-friendly) */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {booking.status !== 'checked_in' && booking.status !== 'checked_out' && (
                            <Button
                                size="lg"
                                className="flex-1 min-w-[140px] h-14 text-base bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => onUpdateStatus(booking.id, 'checked_in')}
                                disabled={isSaving}
                            >
                                <LogIn className="h-5 w-5 mr-2" /> Check In
                            </Button>
                        )}
                        {booking.status === 'checked_in' && (
                            <Button
                                size="lg"
                                className="flex-1 min-w-[140px] h-14 text-base bg-slate-600 hover:bg-slate-700"
                                onClick={() => onUpdateStatus(booking.id, 'checked_out')}
                                disabled={isSaving}
                            >
                                <LogOut className="h-5 w-5 mr-2" /> Check Out
                            </Button>
                        )}
                        {booking.status !== 'cancelled' && (
                            <Button
                                size="lg"
                                variant="outline"
                                className="flex-1 min-w-[140px] h-14 text-base border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                                disabled={isSaving}
                            >
                                <XCircle className="h-5 w-5 mr-2" /> No-show / Cancel
                            </Button>
                        )}
                        {isFinal && (
                            <Button
                                size="lg"
                                variant="outline"
                                className="flex-1 min-w-[140px] h-14 text-base"
                                onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                                disabled={isSaving}
                            >
                                <RotateCcw className="h-5 w-5 mr-2" /> Reactivate
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

// ────────────────────── Page ──────────────────────

const CheckInPage = () => {
    const { showId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const [show, setShow] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const loadShow = useCallback(async ({ silent = false } = {}) => {
        if (!showId) return;
        if (!silent) setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, project_name, project_data, user_id')
                .eq('id', showId)
                .single();
            if (error) throw error;
            setShow(data);
        } catch (e) {
            if (!silent) toast({ title: 'Could not load show', description: e.message, variant: 'destructive' });
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [showId, toast]);

    useEffect(() => { loadShow(); }, [loadShow]);

    // Refetch when tab regains focus so admin-side changes appear here automatically.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') loadShow({ silent: true });
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [loadShow]);

    const stalling = show?.project_data?.stallingService || {};
    const bookings = stalling.bookings || [];
    const barns = stalling.barns || [];

    const counts = useMemo(() => {
        const c = { all: bookings.length, pending: 0, confirmed: 0, checked_in: 0, checked_out: 0, cancelled: 0 };
        for (const b of bookings) {
            if (c[b.status] !== undefined) c[b.status] += 1;
        }
        return c;
    }, [bookings]);

    const filteredBookings = useMemo(() => {
        const term = search.trim().toLowerCase();
        return bookings.filter(b => {
            if (filter !== 'all' && b.status !== filter) return false;
            if (!term) return true;
            const ref = String(b.id || '').slice(0, 8).toLowerCase();
            const haystack = [
                b.exhibitorName, b.email, b.phone, b.trainerName, b.horseName,
                ...(b.horseNames || []),
                ref,
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }, [bookings, search, filter]);

    const updateBookingStatus = useCallback(async (bookingId, newStatus) => {
        if (!show) return;
        setIsSaving(true);
        try {
            const updatedBookings = bookings.map(b =>
                b.id === bookingId
                    ? {
                        ...b,
                        status: newStatus,
                        ...(newStatus === 'checked_in' ? { checkedInAt: new Date().toISOString() } : {}),
                        ...(newStatus === 'checked_out' ? { checkedOutAt: new Date().toISOString() } : {}),
                    }
                    : b
            );
            const updatedData = stampModuleStatusOnSave({
                ...show.project_data,
                stallingService: { ...stalling, bookings: updatedBookings },
            }, 'housing');
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', show.id);
            if (error) throw error;
            setShow(prev => ({ ...prev, project_data: updatedData }));
            toast({
                title: 'Status updated',
                description: `Booking marked as ${STATUS_META[newStatus]?.label || newStatus}`,
            });
        } catch (e) {
            toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [show, stalling, bookings, toast]);

    const enterFullscreen = () => {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!show) {
        return (
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-2xl mx-auto px-4 py-24 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <h1 className="text-3xl font-bold mb-2">Show Not Found</h1>
                    <Button onClick={() => navigate('/horse-show-manager')} className="mt-4">
                        Back to Horse Show Manager
                    </Button>
                </main>
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Check-In · {show.project_name}</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 mb-6">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/horse-show-manager/housing-grounds-manager/${showId}`)}>
                            <ArrowLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                        <div className="text-center flex-1">
                            <h1 className="text-2xl md:text-3xl font-bold">{show.project_name}</h1>
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                                <ScanLine className="h-4 w-4" /> Check-In Kiosk
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={enterFullscreen} title="Enter fullscreen kiosk mode">
                            <Maximize className="h-4 w-4 mr-1" /> Fullscreen
                        </Button>
                    </div>

                    {/* Big search + filters */}
                    <Card className="mb-6">
                        <CardContent className="p-4 space-y-3">
                            <div className="relative">
                                <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search exhibitor, horse, trainer, phone, email, or booking ref..."
                                    className="h-14 pl-12 text-lg"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {FILTERS.map(f => {
                                    const count = counts[f.id] ?? 0;
                                    const active = filter === f.id;
                                    return (
                                        <Button
                                            key={f.id}
                                            variant={active ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn('h-10', active && 'shadow-md')}
                                            onClick={() => setFilter(f.id)}
                                        >
                                            {f.label}
                                            <Badge variant={active ? 'secondary' : 'outline'} className="ml-2 text-xs">
                                                {count}
                                            </Badge>
                                        </Button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Booking list */}
                    {filteredBookings.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                                <h3 className="text-lg font-semibold mb-1">
                                    {bookings.length === 0 ? 'No bookings yet' : 'No matches'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {bookings.length === 0
                                        ? 'Bookings will appear here once exhibitors reserve.'
                                        : 'Try a different search or filter.'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Showing <span className="font-semibold text-foreground">{filteredBookings.length}</span> of {bookings.length} bookings
                            </p>
                            <AnimatePresence mode="popLayout">
                                {filteredBookings.map(booking => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        barns={barns}
                                        onUpdateStatus={updateBookingStatus}
                                        isSaving={isSaving}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default CheckInPage;
