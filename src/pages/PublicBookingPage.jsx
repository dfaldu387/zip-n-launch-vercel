import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import {
    Loader2, Home, Car, Warehouse, ShoppingCart, Calendar,
    User, Mail, Phone, MessageSquare, CheckCircle2, ArrowLeft, ArrowRight,
    Plus, Minus, Info, PartyPopper, Copy, Hash,
} from 'lucide-react';

import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const Divider = () => <div className="h-px bg-border my-2" />;
import { supabase } from '@/lib/supabaseClient';

// ───────────────────────── Helpers ─────────────────────────

const calcNights = (arrival, departure) => {
    if (!arrival || !departure) return 0;
    try {
        const diff = differenceInCalendarDays(parseISO(departure), parseISO(arrival));
        return Math.max(diff, 1);
    } catch {
        return 0;
    }
};

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const HOOKUP_LABELS = {
    full: 'Full Hookup',
    partial: 'Partial Hookup',
    electric_only: 'Electric Only',
    dry_camping: 'Dry Camping',
    day_parking: 'Day Parking',
};

const POWER_LABELS = {
    '50amp': '50 Amp',
    '30amp': '30 Amp',
    '35amp': '35 Amp',
    '25amp': '25 Amp',
    'none': 'No Power',
};

// ───────────────────────── Quantity Stepper ─────────────────────────

const QtyStepper = ({ value, onChange, max, min = 0 }) => (
    <div className="flex items-center gap-2">
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - 1))}
        >
            <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={max != null && value >= max}
            onClick={() => onChange(Math.min(max ?? Infinity, value + 1))}
        >
            <Plus className="h-3.5 w-3.5" />
        </Button>
    </div>
);

// ───────────────────────── Step 1: Select Items ─────────────────────────

const Step1_SelectItems = ({ inventory, selection, setSelection }) => {
    const { barns, rvAreas, supportSpaces, supplies } = inventory;

    const updateQty = (key, qty) => {
        setSelection(prev => ({ ...prev, [key]: qty }));
    };

    const updateRvFields = (rvId, fields) => {
        setSelection(prev => ({
            ...prev,
            rvOptions: { ...(prev.rvOptions || {}), [rvId]: { ...(prev.rvOptions?.[rvId] || {}), ...fields } },
        }));
    };

    return (
        <div className="space-y-6">
            {/* Stalls */}
            {barns.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Home className="h-5 w-5 text-primary" /> Horse Stalls
                        </CardTitle>
                        <CardDescription>Select how many of each stall type you need.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {barns.map(barn => {
                            const totalStalls = (barn.stalls || []).length || barn.stallCount || 0;
                            const bookedStalls = (barn.stalls || []).filter(s => s.bookingId).length;
                            const available = Math.max(totalStalls - bookedStalls, 0);
                            const qty = selection.stalls?.[barn.id] || 0;
                            return (
                                <div key={barn.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{barn.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {money(barn.pricePerNight)}/night · {available} of {totalStalls} available
                                            {barn.stallSize && ` · ${barn.stallSize}`}
                                        </p>
                                    </div>
                                    <QtyStepper
                                        value={qty}
                                        max={available}
                                        onChange={(v) => setSelection(prev => ({
                                            ...prev,
                                            stalls: { ...(prev.stalls || {}), [barn.id]: v },
                                        }))}
                                    />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* RV Spots */}
            {rvAreas.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Car className="h-5 w-5 text-cyan-600" /> RV Spots
                        </CardTitle>
                        <CardDescription>Camp on-site during the show.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {rvAreas.map(rv => {
                            const total = rv.spotCount || 0;
                            const qty = selection.rvs?.[rv.id] || 0;
                            const pricingModel = rv.pricingModel || 'nightly';
                            const isFlatRate = pricingModel === 'flat';
                            const priceLabel = isFlatRate
                                ? `${money(rv.flatRate)} flat`
                                : `${money(rv.pricePerNight)}/night`;
                            const userLen = Number(selection.rvOptions?.[rv.id]?.length || 0);
                            const lengthExceeded = rv.maxLength > 0 && userLen > 0 && userLen > rv.maxLength;
                            return (
                                <div key={rv.id} className={`p-3 border rounded-lg space-y-2 ${rv.isOverflow ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm flex items-center gap-2">
                                                {rv.name}
                                                {rv.isOverflow && (
                                                    <Badge className="bg-amber-500 text-white text-[10px]">Overflow</Badge>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {priceLabel} · {total} spots ·{' '}
                                                {HOOKUP_LABELS[rv.hookupType] || rv.hookupType} · {POWER_LABELS[rv.powerType] || rv.powerType}
                                                {rv.maxLength > 0 && <> · Max {rv.maxLength}ft</>}
                                            </p>
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                {rv.hasWater && <Badge variant="secondary" className="text-xs">Water</Badge>}
                                                {rv.hasSewer && <Badge variant="secondary" className="text-xs">Sewer</Badge>}
                                                {rv.hasWifi && <Badge variant="secondary" className="text-xs">Wi-Fi</Badge>}
                                                {(rv.earlyArrivalFeePerDay > 0 || rv.lateDepartureFeePerDay > 0) && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        Early/late {money(rv.earlyArrivalFeePerDay || rv.lateDepartureFeePerDay)}/day
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <QtyStepper
                                            value={qty}
                                            max={total}
                                            onChange={(v) => setSelection(prev => ({
                                                ...prev,
                                                rvs: { ...(prev.rvs || {}), [rv.id]: v },
                                            }))}
                                        />
                                    </div>
                                    {qty > 0 && (
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                            <div>
                                                <Label className="text-xs">
                                                    RV Length (ft){rv.maxLength > 0 && ` · max ${rv.maxLength}`}
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={selection.rvOptions?.[rv.id]?.length || ''}
                                                    onChange={(e) => updateRvFields(rv.id, { length: e.target.value })}
                                                    className={`h-8 text-xs ${lengthExceeded ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                                    placeholder="e.g., 32"
                                                />
                                                {lengthExceeded && (
                                                    <p className="text-[10px] text-red-600 mt-1">
                                                        Your RV is longer than this area allows.
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <Label className="text-xs">License Plate</Label>
                                                <Input
                                                    value={selection.rvOptions?.[rv.id]?.plate || ''}
                                                    onChange={(e) => updateRvFields(rv.id, { plate: e.target.value })}
                                                    className="h-8 text-xs"
                                                    placeholder="ABC-1234"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Support Spaces (Tack Stalls, Wash Racks, etc.) */}
            {supportSpaces.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Warehouse className="h-5 w-5 text-indigo-600" /> Tack Stalls & Support Spaces
                        </CardTitle>
                        <CardDescription>Storage, wash racks, equipment zones, and more.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {supportSpaces.map(space => {
                            const total = space.unitCount || 0;
                            const qty = selection.support?.[space.id] || 0;
                            return (
                                <div key={space.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{space.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {money(space.pricePerNight)}/night · {total} available
                                            {space.size && ` · ${space.size}`}
                                        </p>
                                    </div>
                                    <QtyStepper
                                        value={qty}
                                        max={total}
                                        onChange={(v) => setSelection(prev => ({
                                            ...prev,
                                            support: { ...(prev.support || {}), [space.id]: v },
                                        }))}
                                    />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Supplies (Hay, Shavings, etc.) */}
            {supplies.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <ShoppingCart className="h-5 w-5 text-amber-600" /> Add-Ons & Supplies
                        </CardTitle>
                        <CardDescription>Optional one-time purchases.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {supplies.map(item => {
                            const qty = selection.supplies?.[item.id || item.name] || 0;
                            const key = item.id || item.name;
                            return (
                                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {money(item.price)} per {item.unit}
                                            {item.stockQty > 0 && ` · ${item.stockQty} in stock`}
                                        </p>
                                    </div>
                                    <QtyStepper
                                        value={qty}
                                        max={item.stockQty > 0 ? item.stockQty : undefined}
                                        onChange={(v) => setSelection(prev => ({
                                            ...prev,
                                            supplies: { ...(prev.supplies || {}), [key]: v },
                                        }))}
                                    />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {barns.length === 0 && rvAreas.length === 0 && supportSpaces.length === 0 && supplies.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <Info className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>This show is not currently accepting reservations.</p>
                    <p className="text-xs mt-2">Check back later or contact the show organizer.</p>
                </div>
            )}
        </div>
    );
};

// ───────────────────────── Step 2: Dates & Contact ─────────────────────────

const Step2_Details = ({ details, setDetails, showWindow }) => {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5 text-primary" /> Dates
                    </CardTitle>
                    {showWindow.start && (
                        <CardDescription>
                            Show runs {format(parseISO(showWindow.start), 'MMM d')} – {showWindow.end ? format(parseISO(showWindow.end), 'MMM d, yyyy') : ''}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>Arrival Date *</Label>
                        <Input
                            type="date"
                            value={details.arrivalDate}
                            min={showWindow.start || undefined}
                            max={showWindow.end || undefined}
                            onChange={(e) => setDetails(d => ({ ...d, arrivalDate: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Departure Date *</Label>
                        <Input
                            type="date"
                            value={details.departureDate}
                            min={details.arrivalDate || showWindow.start || undefined}
                            max={showWindow.end || undefined}
                            onChange={(e) => setDetails(d => ({ ...d, departureDate: e.target.value }))}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <User className="h-5 w-5 text-primary" /> Contact Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>Exhibitor Name *</Label>
                        <Input
                            value={details.exhibitorName}
                            onChange={(e) => setDetails(d => ({ ...d, exhibitorName: e.target.value }))}
                            placeholder="John Smith"
                        />
                    </div>
                    <div>
                        <Label>Trainer / Ranch / Group</Label>
                        <Input
                            value={details.trainerName}
                            onChange={(e) => setDetails(d => ({ ...d, trainerName: e.target.value }))}
                            placeholder="(optional, helps us group your stalls)"
                        />
                    </div>
                    <div>
                        <Label>Email *</Label>
                        <div className="relative">
                            <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="email"
                                value={details.email}
                                onChange={(e) => setDetails(d => ({ ...d, email: e.target.value }))}
                                placeholder="you@example.com"
                                className="pl-9"
                            />
                        </div>
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
                    <div className="md:col-span-2">
                        <Label>Horse Names</Label>
                        <Input
                            value={details.horseNames}
                            onChange={(e) => setDetails(d => ({ ...d, horseNames: e.target.value }))}
                            placeholder="Comma-separated, e.g., Dixie, Blaze, Apollo"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <MessageSquare className="h-5 w-5 text-primary" /> Preferences
                    </CardTitle>
                    <CardDescription>Tell us about stall placement, group with other exhibitors, special needs, etc.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={details.preferences}
                        onChange={(e) => setDetails(d => ({ ...d, preferences: e.target.value }))}
                        placeholder="e.g., 'Please place near arena', 'Group with John Smith's barn', 'Need shaded RV spot'"
                        className="min-h-[100px]"
                    />
                </CardContent>
            </Card>
        </div>
    );
};

// ───────────────────────── Step 3: Review & Pay ─────────────────────────

const Step3_Review = ({ orderSummary, details, onSubmit, isSubmitting }) => {
    const { lineItems, subtotal, nights } = orderSummary;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Review Your Reservation</CardTitle>
                    <CardDescription>
                        {nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : 'No dates selected'}
                        {details.arrivalDate && details.departureDate &&
                            ` · ${format(parseISO(details.arrivalDate), 'MMM d')} – ${format(parseISO(details.departureDate), 'MMM d, yyyy')}`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {lineItems.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">No items selected.</p>
                    )}
                    {lineItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                            <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.detail}</p>
                            </div>
                            <p className="font-semibold tabular-nums">{money(item.amount)}</p>
                        </div>
                    ))}
                    <Divider />
                    <div className="flex items-center justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="tabular-nums">{money(subtotal)}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Contact Summary</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Name:</span> {details.exhibitorName || '—'}</p>
                    {details.trainerName && <p><span className="text-muted-foreground">Trainer/Group:</span> {details.trainerName}</p>}
                    <p><span className="text-muted-foreground">Email:</span> {details.email || '—'}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {details.phone || '—'}</p>
                    {details.horseNames && <p><span className="text-muted-foreground">Horses:</span> {details.horseNames}</p>}
                    {details.preferences && (
                        <p className="pt-2 border-t mt-2">
                            <span className="text-muted-foreground">Preferences:</span> {details.preferences}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Button
                size="lg"
                className="w-full"
                onClick={onSubmit}
                disabled={isSubmitting || lineItems.length === 0 || !details.exhibitorName || !details.email || !details.phone || !details.arrivalDate || !details.departureDate}
            >
                {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                    <>Submit Reservation · {money(subtotal)}</>
                )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
                The show organizer will contact you to arrange payment and confirm your stalls.
            </p>
        </div>
    );
};

// ───────────────────────── Main Page ─────────────────────────

const PublicBookingPage = () => {
    const { showId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [show, setShow] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selection, setSelection] = useState({
        stalls: {},
        rvs: {},
        rvOptions: {},
        support: {},
        supplies: {},
    });

    const [details, setDetails] = useState({
        arrivalDate: '',
        departureDate: '',
        exhibitorName: '',
        trainerName: '',
        email: '',
        phone: '',
        horseNames: '',
        preferences: '',
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

                // Pre-fill arrival/departure with show window if available
                const sd = data?.project_data?.showDetails?.general || {};
                if (sd.startDate) {
                    setDetails(d => ({
                        ...d,
                        arrivalDate: d.arrivalDate || sd.startDate,
                        departureDate: d.departureDate || sd.endDate || sd.startDate,
                    }));
                }
            } catch (err) {
                toast({ title: 'Show not found', description: err.message, variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        if (showId) loadShow();
    }, [showId, toast]);

    const inventory = useMemo(() => {
        const stalling = show?.project_data?.stallingService || {};
        return {
            barns: stalling.barns || [],
            rvAreas: stalling.rvAreas || [],
            supportSpaces: stalling.supportSpaces || [],
            supplies: stalling.supplies || [],
        };
    }, [show]);

    const showWindow = useMemo(() => {
        const g = show?.project_data?.showDetails?.general || {};
        return { start: g.startDate || '', end: g.endDate || '' };
    }, [show]);

    const orderSummary = useMemo(() => {
        const nights = calcNights(details.arrivalDate, details.departureDate);
        const items = [];
        let subtotal = 0;

        for (const barn of inventory.barns) {
            const qty = selection.stalls?.[barn.id] || 0;
            if (qty > 0) {
                const amount = qty * (barn.pricePerNight || 0) * nights;
                subtotal += amount;
                items.push({
                    type: 'stall',
                    refId: barn.id,
                    name: `${barn.name} × ${qty}`,
                    detail: `${money(barn.pricePerNight)}/night × ${nights} night${nights !== 1 ? 's' : ''} × ${qty}`,
                    qty,
                    nights,
                    unitPrice: barn.pricePerNight || 0,
                    amount,
                });
            }
        }

        // Days outside the show window count toward early-arrival / late-departure fees
        let earlyDays = 0;
        let lateDays = 0;
        try {
            if (showWindow.start && details.arrivalDate) {
                const e = differenceInCalendarDays(parseISO(showWindow.start), parseISO(details.arrivalDate));
                if (e > 0) earlyDays = e;
            }
            if (showWindow.end && details.departureDate) {
                const l = differenceInCalendarDays(parseISO(details.departureDate), parseISO(showWindow.end));
                if (l > 0) lateDays = l;
            }
        } catch { /* date parse issue — skip fees */ }

        for (const rv of inventory.rvAreas) {
            const qty = selection.rvs?.[rv.id] || 0;
            if (qty > 0) {
                const pricingModel = rv.pricingModel || 'nightly';
                const isFlat = pricingModel === 'flat';
                const baseUnitPrice = isFlat ? (rv.flatRate || 0) : (rv.pricePerNight || 0);
                const baseAmount = isFlat ? qty * baseUnitPrice : qty * baseUnitPrice * nights;
                const baseDetail = isFlat
                    ? `${money(baseUnitPrice)} flat × ${qty}`
                    : `${money(baseUnitPrice)}/night × ${nights} night${nights !== 1 ? 's' : ''} × ${qty}`;
                subtotal += baseAmount;
                items.push({
                    type: 'rv',
                    refId: rv.id,
                    name: `${rv.name} (RV) × ${qty}`,
                    detail: baseDetail,
                    qty,
                    nights,
                    unitPrice: baseUnitPrice,
                    amount: baseAmount,
                    options: selection.rvOptions?.[rv.id] || {},
                    pricingModel,
                });

                // Early-arrival fee
                if (earlyDays > 0 && (rv.earlyArrivalFeePerDay || 0) > 0) {
                    const fee = qty * earlyDays * rv.earlyArrivalFeePerDay;
                    subtotal += fee;
                    items.push({
                        type: 'rv_fee',
                        refId: rv.id,
                        name: `${rv.name} · Early arrival fee`,
                        detail: `${earlyDays} day${earlyDays !== 1 ? 's' : ''} early × ${money(rv.earlyArrivalFeePerDay)} × ${qty}`,
                        qty,
                        unitPrice: rv.earlyArrivalFeePerDay,
                        amount: fee,
                    });
                }
                // Late-departure fee
                if (lateDays > 0 && (rv.lateDepartureFeePerDay || 0) > 0) {
                    const fee = qty * lateDays * rv.lateDepartureFeePerDay;
                    subtotal += fee;
                    items.push({
                        type: 'rv_fee',
                        refId: rv.id,
                        name: `${rv.name} · Late departure fee`,
                        detail: `${lateDays} day${lateDays !== 1 ? 's' : ''} late × ${money(rv.lateDepartureFeePerDay)} × ${qty}`,
                        qty,
                        unitPrice: rv.lateDepartureFeePerDay,
                        amount: fee,
                    });
                }
            }
        }

        for (const space of inventory.supportSpaces) {
            const qty = selection.support?.[space.id] || 0;
            if (qty > 0) {
                const amount = qty * (space.pricePerNight || 0) * nights;
                subtotal += amount;
                items.push({
                    type: 'support',
                    refId: space.id,
                    name: `${space.name} × ${qty}`,
                    detail: `${money(space.pricePerNight)}/night × ${nights} night${nights !== 1 ? 's' : ''} × ${qty}`,
                    qty,
                    nights,
                    unitPrice: space.pricePerNight || 0,
                    amount,
                });
            }
        }

        for (const supply of inventory.supplies) {
            const key = supply.id || supply.name;
            const qty = selection.supplies?.[key] || 0;
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

        return { lineItems: items, subtotal, nights };
    }, [inventory, selection, details.arrivalDate, details.departureDate]);

    const hasSelection = orderSummary.lineItems.length > 0;

    // Any selected RV area where the customer's length exceeds the maxLength?
    const lengthViolation = useMemo(() => {
        for (const rv of inventory.rvAreas) {
            const qty = selection.rvs?.[rv.id] || 0;
            const len = Number(selection.rvOptions?.[rv.id]?.length || 0);
            if (qty > 0 && rv.maxLength > 0 && len > 0 && len > rv.maxLength) {
                return { rvName: rv.name, len, max: rv.maxLength };
            }
        }
        return null;
    }, [inventory.rvAreas, selection]);

    const validateStep = () => {
        if (step === 1) {
            if (!hasSelection) {
                toast({ title: 'Select at least one item', description: 'Add a stall, RV, or supply to continue.', variant: 'destructive' });
                return false;
            }
            if (lengthViolation) {
                toast({
                    title: 'RV too long for selected area',
                    description: `${lengthViolation.rvName} only fits RVs up to ${lengthViolation.max}ft. Your RV is ${lengthViolation.len}ft.`,
                    variant: 'destructive',
                });
                return false;
            }
        }
        if (step === 2) {
            if (!details.arrivalDate || !details.departureDate) {
                toast({ title: 'Dates required', variant: 'destructive' });
                return false;
            }
            if (orderSummary.nights <= 0) {
                toast({ title: 'Departure must be after arrival', variant: 'destructive' });
                return false;
            }
            if (!details.exhibitorName || !details.email || !details.phone) {
                toast({ title: 'Please complete required fields', variant: 'destructive' });
                return false;
            }
        }
        return true;
    };

    const [confirmation, setConfirmation] = useState(null);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const horseList = (details.horseNames || '')
                .split(',').map(s => s.trim()).filter(Boolean);

            // Map to a shape that's also compatible with the existing admin BookingRow
            // (which reads exhibitorName, horseName, trainerName, nights, status)
            const bookingPayload = {
                exhibitorName: details.exhibitorName,
                email: details.email,
                phone: details.phone,
                trainerName: details.trainerName || '',
                horseName: horseList[0] || '',
                horseNames: horseList,
                arrivalDate: details.arrivalDate,
                departureDate: details.departureDate,
                nights: orderSummary.nights,
                items: orderSummary.lineItems,
                preferences: details.preferences || '',
                amount: orderSummary.subtotal,
                totalAmount: orderSummary.subtotal,
                stallId: '',
                notes: details.preferences || '',
                status: 'pending',
                paymentStatus: 'unpaid',
            };

            const { data, error } = await supabase.rpc('append_public_booking', {
                p_project_id: showId,
                p_booking: bookingPayload,
            });

            if (error) throw error;

            setConfirmation({
                bookingId: data,
                bookingShortId: String(data || '').slice(0, 8).toUpperCase(),
                payload: bookingPayload,
            });
        } catch (err) {
            toast({
                title: 'Could not save reservation',
                description: err.message || 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyBookingRef = async () => {
        if (!confirmation?.bookingShortId) return;
        try {
            await navigator.clipboard.writeText(confirmation.bookingShortId);
            toast({ title: 'Copied!', description: 'Booking reference copied.' });
        } catch {
            toast({ title: 'Copy failed', variant: 'destructive' });
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (confirmation) {
        return (
            <>
                <Helmet>
                    <title>Reservation Confirmed - {show?.project_name}</title>
                </Helmet>
                <div className="min-h-screen bg-background">
                    <Navigation />
                    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="border-2 border-emerald-500">
                                <CardHeader className="text-center pb-4">
                                    <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                                        <PartyPopper className="h-8 w-8 text-emerald-600" />
                                    </div>
                                    <CardTitle className="text-2xl">Reservation Received!</CardTitle>
                                    <CardDescription>
                                        Thank you, {confirmation.payload.exhibitorName}. Your reservation for <strong>{show?.project_name}</strong> has been recorded.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                                                <Hash className="h-3 w-3" /> Booking Reference
                                            </p>
                                            <p className="text-2xl font-mono font-bold tracking-wider">{confirmation.bookingShortId}</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={copyBookingRef}>
                                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Dates</p>
                                            <p>
                                                {format(parseISO(confirmation.payload.arrivalDate), 'MMM d')} – {format(parseISO(confirmation.payload.departureDate), 'MMM d, yyyy')}
                                                <span className="text-muted-foreground"> · {confirmation.payload.nights} night{confirmation.payload.nights !== 1 ? 's' : ''}</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total</p>
                                            <p className="text-lg font-bold">{money(confirmation.payload.totalAmount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Email</p>
                                            <p>{confirmation.payload.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Phone</p>
                                            <p>{confirmation.payload.phone}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Items Reserved</p>
                                        <div className="space-y-1 text-sm border rounded-md divide-y">
                                            {confirmation.payload.items.map((it, i) => (
                                                <div key={i} className="flex justify-between p-2">
                                                    <span>{it.name}</span>
                                                    <span className="font-semibold tabular-nums">{money(it.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm">
                                        <p className="font-semibold text-amber-900 dark:text-amber-300 mb-1">⚠️ Payment is not collected yet</p>
                                        <p className="text-amber-800 dark:text-amber-400 text-xs">
                                            The show organizer will contact you at <strong>{confirmation.payload.email}</strong> to arrange payment and confirm your stalls. Save your booking reference above.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
                                <Button
                                    size="lg"
                                    onClick={() => navigate(`/booking/${confirmation.bookingId}`)}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    View My Booking Status
                                </Button>
                                <Button variant="outline" size="lg" onClick={() => navigate(`/show/${showId}`)}>
                                    Back to Show
                                </Button>
                                <Button variant="outline" size="lg" onClick={() => navigate('/book-stalls')}>
                                    Browse More Shows
                                </Button>
                            </div>
                            <p className="text-xs text-center text-muted-foreground mt-3">
                                💡 Bookmark the <strong>"View My Booking Status"</strong> link to check on your reservation anytime.
                            </p>
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
                    <p className="text-muted-foreground">This reservation link is invalid or the show has been removed.</p>
                </main>
            </div>
        );
    }

    const stepLabels = ['Select Items', 'Your Details', 'Review & Pay'];

    return (
        <>
            <Helmet>
                <title>Reserve - {show.project_name}</title>
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-6">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/show/${showId}`)}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Show
                            </Button>
                            <h1 className="text-3xl font-bold mt-2">{show.project_name}</h1>
                            <p className="text-muted-foreground">Reserve stalls, RV spots, and supplies</p>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-2 mb-8">
                            {stepLabels.map((label, i) => {
                                const num = i + 1;
                                const active = step === num;
                                const done = step > num;
                                return (
                                    <React.Fragment key={label}>
                                        <div className={`flex items-center gap-2 ${active ? 'text-primary' : done ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted'}`}>
                                                {done ? <CheckCircle2 className="h-4 w-4" /> : num}
                                            </div>
                                            <span className="text-sm font-medium hidden sm:inline">{label}</span>
                                        </div>
                                        {i < stepLabels.length - 1 && <div className={`flex-1 h-0.5 ${done ? 'bg-emerald-600' : 'bg-muted'}`} />}
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Step body */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-3">
                                {step === 1 && <Step1_SelectItems inventory={inventory} selection={selection} setSelection={setSelection} />}
                                {step === 2 && <Step2_Details details={details} setDetails={setDetails} showWindow={showWindow} />}
                                {step === 3 && <Step3_Review orderSummary={orderSummary} details={details} onSubmit={handleSubmit} isSubmitting={isSubmitting} />}
                            </div>

                            {/* Live cart sidebar */}
                            <aside className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
                                <Card className="sticky top-4">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Order Summary</CardTitle>
                                        {orderSummary.nights > 0 && (
                                            <CardDescription className="text-xs">
                                                {orderSummary.nights} night{orderSummary.nights !== 1 ? 's' : ''}
                                            </CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        {orderSummary.lineItems.length === 0 ? (
                                            <p className="text-muted-foreground text-xs">No items selected yet.</p>
                                        ) : (
                                            orderSummary.lineItems.map((item, i) => (
                                                <div key={i} className="flex justify-between gap-2">
                                                    <span className="truncate">{item.name}</span>
                                                    <span className="tabular-nums font-medium">{money(item.amount)}</span>
                                                </div>
                                            ))
                                        )}
                                        <Divider />
                                        <div className="flex justify-between font-bold">
                                            <span>Total</span>
                                            <span className="tabular-nums">{money(orderSummary.subtotal)}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </aside>
                        </div>

                        {/* Nav buttons */}
                        {step < 3 && (
                            <div className="flex justify-between mt-8">
                                <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                                </Button>
                                <Button onClick={() => { if (validateStep()) setStep(step + 1); }}>
                                    Next <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="flex justify-start mt-8">
                                <Button variant="outline" onClick={() => setStep(2)}>
                                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                                </Button>
                            </div>
                        )}
                    </motion.div>
                </main>
            </div>
        </>
    );
};

export default PublicBookingPage;
