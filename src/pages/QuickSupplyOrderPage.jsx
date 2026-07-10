import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
    Loader2, ShoppingCart, User, Phone, Mail, Plus, Minus, Info,
    ArrowLeft, PartyPopper, Hash, Copy, Lock, CalendarClock, Clock,
} from 'lucide-react';

import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

// ───────────────────────── Helpers ─────────────────────────

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const Divider = () => <div className="h-px bg-border my-2" />;

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ───────────────────────── Quantity Stepper ─────────────────────────

const QtyStepper = ({ value, onChange, max, min = 0 }) => (
    <div className="flex items-center gap-2">
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - 1))}
        >
            <Minus className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-base font-semibold tabular-nums">{value}</span>
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={max != null && value >= max}
            onClick={() => onChange(Math.min(max ?? Infinity, value + 1))}
        >
            <Plus className="h-4 w-4" />
        </Button>
    </div>
);

// ───────────────────────── Main Page ─────────────────────────
// Live "Order Hay & Shavings during the show" flow. Unlike PublicBookingPage
// (pre-show, reserves stalls with dates), this is a fast supplies-only reorder
// for someone standing in the barn who just needs more shavings. Orders are
// saved into the SAME stallingService.bookings list, tagged orderType:'live-supply'
// so the facility can pull them into a fulfillment view.

const QuickSupplyOrderPage = () => {
    const { showId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [show, setShow] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState(null);

    // qty keyed by supply.id || supply.name
    const [quantities, setQuantities] = useState({});
    const [details, setDetails] = useState({
        stableWith: '',
        name: '',
        phone: '',
        email: '',
    });

    // Load show
    useEffect(() => {
        const loadShow = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('id, project_name, project_data')
                    .eq('id', showId)
                    .single();
                if (error) throw error;
                setShow(data);
            } catch (err) {
                toast({ title: 'Show not found', description: err.message, variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        if (showId) loadShow();
    }, [showId, toast]);

    const supplies = useMemo(
        () => show?.project_data?.stallingService?.supplies || [],
        [show],
    );

    // How many of each supply are already sold on existing (non-cancelled)
    // bookings — caps the stepper so we never oversell past remaining stock.
    const suppliesSold = useMemo(() => {
        const existing = show?.project_data?.stallingService?.bookings || [];
        const sold = {};
        for (const b of existing) {
            if (b.status === 'cancelled') continue;
            for (const it of b.items || []) {
                if (it.type !== 'supply' || it.refId == null) continue;
                sold[it.refId] = (sold[it.refId] || 0) + (it.qty || 0);
            }
        }
        return sold;
    }, [show]);

    // Live ordering is gated by the same housing status as pre-show booking.
    const housingStatus = useMemo(() => {
        const pd = show?.project_data || {};
        return pd.moduleStatuses?.housing || pd.stallingService?.publishStatus || 'draft';
    }, [show]);
    const isOpen = housingStatus === 'published';

    const orderSummary = useMemo(() => {
        const items = [];
        let subtotal = 0;
        for (const supply of supplies) {
            const key = supply.id || supply.name;
            const qty = quantities[key] || 0;
            if (qty > 0) {
                const amount = qty * (supply.price || 0);
                subtotal += amount;
                items.push({
                    type: 'supply',
                    refId: key,
                    name: `${supply.name} × ${qty}`,
                    detail: `${money(supply.price)} per ${supply.unit || 'unit'} × ${qty}`,
                    qty,
                    unitPrice: supply.price || 0,
                    amount,
                });
            }
        }
        return { lineItems: items, subtotal };
    }, [supplies, quantities]);

    const hasSelection = orderSummary.lineItems.length > 0;
    const emailOk = isValidEmail(details.email);
    // Email is required: it's how the rider gets a receipt, a delivery
    // notification, and how the order is matched to a member account later.
    const canSubmit = hasSelection
        && details.stableWith.trim()
        && details.name.trim()
        && details.phone.trim()
        && emailOk;

    const handleSubmit = async () => {
        if (!canSubmit) {
            toast({ title: 'Please complete the order', description: 'Pick an item and fill in every field.', variant: 'destructive' });
            return;
        }
        setIsSubmitting(true);
        try {
            const bookingPayload = {
                // Live at-show supply order — no stalls, no dates.
                orderType: 'live-supply',
                source: 'live_supply',
                exhibitorName: details.name,
                phone: details.phone,
                email: details.email.trim().toLowerCase(),
                // "Stable With / Under" doubles as trainer/group so the existing
                // admin booking rows still show who this belongs to.
                stableWith: details.stableWith,
                trainerName: details.stableWith,
                items: orderSummary.lineItems,
                amount: orderSummary.subtotal,
                totalAmount: orderSummary.subtotal,
                status: 'pending',
                paymentStatus: 'unpaid',
                fulfillmentStatus: 'new',
            };

            const { data, error } = await supabase.rpc('append_public_booking', {
                p_project_id: showId,
                p_booking: bookingPayload,
            });
            if (error) throw error;

            const bookingShortId = String(data || '').slice(0, 8).toUpperCase();

            // Emailed receipt. The order is already saved, so a mail failure must
            // not look like a failed order — log it and still show the confirmation.
            try {
                await supabase.functions.invoke('send-supply-order-email', {
                    body: {
                        kind: 'receipt',
                        to: bookingPayload.email,
                        customerName: bookingPayload.exhibitorName,
                        showName: show?.project_name || 'the show',
                        orderRef: bookingShortId,
                        items: bookingPayload.items.map(it => ({ name: it.name, amount: it.amount })),
                        total: bookingPayload.totalAmount,
                        stableWith: bookingPayload.stableWith,
                    },
                });
            } catch (mailErr) {
                console.error('Receipt email failed:', mailErr);
            }

            setConfirmation({
                bookingId: data,
                bookingShortId,
                payload: bookingPayload,
            });
        } catch (err) {
            toast({ title: 'Could not place order', description: err.message || 'Please try again.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyRef = async () => {
        if (!confirmation?.bookingShortId) return;
        try {
            await navigator.clipboard.writeText(confirmation.bookingShortId);
            toast({ title: 'Copied!', description: 'Order reference copied.' });
        } catch {
            toast({ title: 'Copy failed', variant: 'destructive' });
        }
    };

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // ── Confirmation ──
    if (confirmation) {
        return (
            <>
                <Helmet><title>Order Placed - {show?.project_name}</title></Helmet>
                <div className="min-h-screen bg-background">
                    <Navigation />
                    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="border-2 border-amber-500">
                                <CardHeader className="text-center pb-4">
                                    <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
                                        <PartyPopper className="h-8 w-8 text-amber-600" />
                                    </div>
                                    <CardTitle className="text-2xl">Order Received!</CardTitle>
                                    <CardDescription>
                                        Thanks, {confirmation.payload.exhibitorName}. Your hay &amp; shavings order for <strong>{show?.project_name}</strong> is in.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                                                <Hash className="h-3 w-3" /> Order Reference
                                            </p>
                                            <p className="text-2xl font-mono font-bold tracking-wider">{confirmation.bookingShortId}</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={copyRef}>
                                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                        </Button>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Items Ordered</p>
                                        <div className="space-y-1 text-sm border rounded-md divide-y">
                                            {confirmation.payload.items.map((it, i) => (
                                                <div key={i} className="flex justify-between p-2">
                                                    <span>{it.name}</span>
                                                    <span className="font-semibold tabular-nums">{money(it.amount)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between p-2 font-bold">
                                                <span>Total</span>
                                                <span className="tabular-nums">{money(confirmation.payload.totalAmount)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Stable With / Under</p>
                                            <p>{confirmation.payload.stableWith}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Phone</p>
                                            <p>{confirmation.payload.phone}</p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Email</p>
                                            <p className="break-all">{confirmation.payload.email}</p>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm">
                                        <p className="text-amber-800 dark:text-amber-400 text-xs">
                                            The facility team has been sent your order and will deliver to your stalls. A receipt is on its way to <strong>{confirmation.payload.email}</strong>, and we'll email you again the moment it's delivered. Payment is arranged on-site — keep your order reference handy.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
                                <Button
                                    size="lg"
                                    className="bg-amber-600 hover:bg-amber-700"
                                    onClick={() => { setConfirmation(null); setQuantities({}); }}
                                >
                                    Place Another Order
                                </Button>
                                <Button variant="outline" size="lg" onClick={() => navigate(`/event-detail/${showId}`)}>
                                    Back to Event
                                </Button>
                            </div>
                        </motion.div>
                    </main>
                </div>
            </>
        );
    }

    if (!show) {
        return (
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-2xl mx-auto px-4 py-24 text-center">
                    <h1 className="text-3xl font-bold mb-3">Show Not Found</h1>
                    <p className="text-muted-foreground">This order link is invalid or the show has been removed.</p>
                </main>
            </div>
        );
    }

    // ── Not open / no supplies ──
    if (!isOpen || supplies.length === 0) {
        const isLockedClosed = housingStatus === 'locked';
        const Icon = supplies.length === 0 ? Info : isLockedClosed ? Lock : CalendarClock;
        const title = supplies.length === 0
            ? 'No supplies available'
            : isLockedClosed ? 'Ordering is closed' : 'Ordering is not open yet';
        const body = supplies.length === 0
            ? <>This show isn't offering hay &amp; shavings for order right now. Please contact the show organizer.</>
            : isLockedClosed
                ? <>Live ordering for <strong>{show.project_name}</strong> is currently closed. Please contact the facility.</>
                : <>Live ordering for <strong>{show.project_name}</strong> hasn't opened yet. Please check back.</>;
        return (
            <>
                <Helmet><title>Ordering Not Available - {show.project_name}</title></Helmet>
                <div className="min-h-screen bg-background">
                    <Navigation />
                    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                        <Card className="border-2">
                            <CardHeader className="text-center pb-4">
                                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
                                    <Icon className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <CardTitle className="text-2xl">{title}</CardTitle>
                                <CardDescription className="text-base">{body}</CardDescription>
                            </CardHeader>
                        </Card>
                    </main>
                </div>
            </>
        );
    }

    // ── Order form ──
    return (
        <>
            <Helmet><title>Order Hay & Shavings - {show.project_name}</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-6">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/event-detail/${showId}`)}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Event
                            </Button>
                            <h1 className="text-3xl font-bold mt-2 flex items-center gap-2">
                                <ShoppingCart className="h-7 w-7 text-amber-600" /> Order Hay &amp; Shavings
                            </h1>
                            <p className="text-muted-foreground">{show.project_name} · delivered to your stalls during the show</p>
                        </div>

                        {/* Supplies */}
                        <Card className="mb-6">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">What do you need?</CardTitle>
                                <CardDescription>Pick your items and quantity.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {supplies.map(item => {
                                    const key = item.id || item.name;
                                    const qty = quantities[key] || 0;
                                    const limited = item.stockQty > 0;
                                    const remaining = limited ? Math.max(item.stockQty - (suppliesSold[key] || 0), 0) : undefined;
                                    const soldOut = limited && remaining === 0;
                                    return (
                                        <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {money(item.price)} per {item.unit || 'unit'}
                                                    {limited && ` · ${soldOut ? 'Sold out' : `${remaining} available`}`}
                                                </p>
                                            </div>
                                            <QtyStepper
                                                value={qty}
                                                max={remaining}
                                                onChange={(v) => setQuantities(prev => ({ ...prev, [key]: v }))}
                                            />
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* Who / where */}
                        <Card className="mb-6">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" /> Your Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Stable With / Under *</Label>
                                    <Input
                                        value={details.stableWith}
                                        onChange={(e) => setDetails(d => ({ ...d, stableWith: e.target.value }))}
                                        placeholder="Trainer or barn name"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">If not applicable, enter N/A.</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Your Name *</Label>
                                        <Input
                                            value={details.name}
                                            onChange={(e) => setDetails(d => ({ ...d, name: e.target.value }))}
                                            placeholder="John Smith"
                                        />
                                    </div>
                                    <div>
                                        <Label>Phone *</Label>
                                        <div className="relative">
                                            <Phone className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                type="tel"
                                                value={details.phone}
                                                onChange={(e) => setDetails(d => ({ ...d, phone: e.target.value }))}
                                                placeholder="(555) 555-1234"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <Label>Email *</Label>
                                    <div className="relative">
                                        <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            value={details.email}
                                            onChange={(e) => setDetails(d => ({ ...d, email: e.target.value }))}
                                            placeholder="rider@example.com"
                                            className="pl-9"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {details.email.trim() && !emailOk
                                            ? <span className="text-destructive">Please enter a valid email address.</span>
                                            : "We'll email your receipt and let you know when your order is delivered."}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Summary + submit */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {orderSummary.lineItems.length === 0 ? (
                                    <p className="text-muted-foreground text-xs">No items selected yet.</p>
                                ) : (
                                    orderSummary.lineItems.map((it, i) => (
                                        <div key={i} className="flex justify-between gap-2">
                                            <span className="truncate">{it.name}</span>
                                            <span className="tabular-nums font-medium">{money(it.amount)}</span>
                                        </div>
                                    ))
                                )}
                                <Divider />
                                <div className="flex justify-between font-bold text-base">
                                    <span>Total</span>
                                    <span className="tabular-nums">{money(orderSummary.subtotal)}</span>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full mt-3 bg-amber-600 hover:bg-amber-700"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !canSubmit}
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing order...</>
                                    ) : (
                                        <>Place Order · {money(orderSummary.subtotal)}</>
                                    )}
                                </Button>
                                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                                    <Clock className="h-3 w-3" /> Sent to the facility with a timestamp for fast delivery.
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default QuickSupplyOrderPage;
