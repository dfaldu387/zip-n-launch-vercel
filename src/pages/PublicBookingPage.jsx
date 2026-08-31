import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import {
    Loader2, Home, Car, Warehouse, ShoppingCart, Calendar,
    User, Mail, Phone, MessageSquare, CheckCircle2, ArrowLeft, ArrowRight,
    Plus, Minus, Info, PartyPopper, Copy, Hash, Lock, CalendarClock,
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
import { startStallCheckout } from '@/lib/housingCheckout';
import {
    buildExtraStallFeeItems, buildBarnStallItems, flatRateForBarn, stallsByBarnFromSelection,
    groupBarnsForBooking, allocatePooledStalls, ALL_BARNS_GROUP_ID,
} from '@/lib/extraStallFees';
import {
    buildRvAreaItems, flatRateForRvArea, rvsByAreaFromSelection,
    groupRvAreasForBooking, allocatePooledRvSpots, ALL_RV_GROUP_ID,
} from '@/lib/extraRvFees';
import { nightsInRange } from '@/lib/stallNights';

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

const Step1_SelectItems = ({ inventory, selection, setSelection, bookWindow }) => {
    const { barns, rvAreas, supportSpaces, supplies, extraStallFees, extraRvFees } = inventory;
    const showNights = useMemo(() => nightsInRange(bookWindow?.start, bookWindow?.end), [bookWindow?.start, bookWindow?.end]);

    // Barns with no fee of their own combine into one "All Barns" row with
    // combined availability — see groupBarnsForBooking. Booking/pricing code
    // still only ever sees real barn ids; this is a display-layer grouping.
    const { individual: individualBarns, pooledGroup } = useMemo(
        () => groupBarnsForBooking(barns, extraStallFees),
        [barns, extraStallFees]
    );
    const displayBarns = pooledGroup ? [...individualBarns, pooledGroup] : individualBarns;

    // Same pooling for RV areas — "if we did all our V-areas, this becomes 20".
    const { individual: individualRvAreas, pooledGroup: pooledRvGroup } = useMemo(
        () => groupRvAreasForBooking(rvAreas, extraRvFees),
        [rvAreas, extraRvFees]
    );
    const displayRvAreas = pooledRvGroup ? [...individualRvAreas, pooledRvGroup] : individualRvAreas;

    const updateQty = (key, qty) => {
        setSelection(prev => ({ ...prev, [key]: qty }));
    };

    // Which nights a barn's stalls are needed for — defaults to every night of
    // the show's move-in/move-out window (same total as before this picker
    // existed) until the exhibitor unchecks one.
    const toggleBarnNight = (barnId, date) => {
        setSelection(prev => {
            const current = prev.barnNights?.[barnId] || showNights;
            const next = current.includes(date)
                ? current.filter(d => d !== date)
                : [...current, date].sort();
            return { ...prev, barnNights: { ...(prev.barnNights || {}), [barnId]: next } };
        });
    };

    const updateRvFields = (rvId, fields) => {
        setSelection(prev => ({
            ...prev,
            rvOptions: { ...(prev.rvOptions || {}), [rvId]: { ...(prev.rvOptions?.[rvId] || {}), ...fields } },
        }));
    };

    // Same night picker as barns, for an RV area priced Per Night — "the same
    // exact logic applies to a dropdown" per Robert's RV video.
    const toggleRvNight = (rvId, date) => {
        setSelection(prev => {
            const current = prev.rvNights?.[rvId] || showNights;
            const next = current.includes(date)
                ? current.filter(d => d !== date)
                : [...current, date].sort();
            return { ...prev, rvNights: { ...(prev.rvNights || {}), [rvId]: next } };
        });
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
                        {displayBarns.map(barn => {
                            // total already excludes aisle/room/empty/blocked boxes.
                            const totalStalls = Number(barn.total) || 0;
                            const available = Math.max(totalStalls - (Number(barn.taken) || 0), 0);
                            const soldOut = totalStalls > 0 && available === 0;
                            // The pooled "All Barns" row's qty is the sum across whichever
                            // real member barns currently hold its stalls.
                            const qty = barn.members
                                ? barn.members.reduce((s, m) => s + (Number(selection.stalls?.[m.id]) || 0), 0)
                                : (selection.stalls?.[barn.id] || 0);
                            const flatRate = flatRateForBarn(barn.id, extraStallFees);
                            const hasNightly = (Number(barn.pricePerNight) || 0) > 0;
                            const isFlat = flatRate > 0;
                            const priceParts = [];
                            if (hasNightly) priceParts.push(`${money(barn.pricePerNight)}/night`);
                            if (isFlat) priceParts.push(`${money(flatRate)} flat`);
                            const priceLabel = priceParts.length > 0 ? priceParts.join(' + ') : money(0);
                            const selectedNights = selection.barnNights?.[barn.id] || showNights;
                            // Only barns priced Per Night need "which nights" — a Flat fee
                            // charges the same no matter how many nights are ticked.
                            const showNightPicker = qty > 0 && hasNightly && showNights.length > 1;
                            // A barn can override the show's move-in/move-out window; falls
                            // back to it when the barn uses the default (Robert: "people know
                            // exactly what they're booking").
                            const barnStart = barn.moveInDate || bookWindow?.start;
                            const barnEnd = barn.moveOutDate || bookWindow?.end;
                            return (
                                <div key={barn.id} className="p-3 border rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{barn.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {priceLabel} ·{' '}
                                                {soldOut ? 'Sold out' : `${available} of ${totalStalls} available`}
                                                {barn.stallSize && ` · ${barn.stallSize}`}
                                            </p>
                                            {barnStart && barnEnd && (
                                                <p className="text-xs text-muted-foreground">
                                                    {format(parseISO(barnStart), 'MMM d')} – {format(parseISO(barnEnd), 'MMM d, yyyy')}
                                                </p>
                                            )}
                                        </div>
                                        <QtyStepper
                                            value={qty}
                                            max={available}
                                            onChange={(v) => setSelection(prev => {
                                                if (barn.members) {
                                                    // Re-split the pooled quantity across real member
                                                    // barns, filling each one's own remaining capacity.
                                                    const stalls = { ...(prev.stalls || {}) };
                                                    for (const m of barn.members) delete stalls[m.id];
                                                    return { ...prev, stalls: { ...stalls, ...allocatePooledStalls(barn.members, v) } };
                                                }
                                                return { ...prev, stalls: { ...(prev.stalls || {}), [barn.id]: v } };
                                            })}
                                        />
                                    </div>
                                    {showNightPicker && (
                                        <div className="pt-2 border-t">
                                            <p className="text-xs text-muted-foreground mb-1.5">Which nights do you need {qty} stall{qty !== 1 ? 's' : ''} in {barn.name}?</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {showNights.map(date => {
                                                    const checked = selectedNights.includes(date);
                                                    return (
                                                        <button
                                                            key={date}
                                                            type="button"
                                                            onClick={() => toggleBarnNight(barn.id, date)}
                                                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${checked
                                                                ? 'bg-primary text-primary-foreground border-primary'
                                                                : 'bg-background text-muted-foreground border-input hover:bg-muted'}`}
                                                        >
                                                            {format(parseISO(date), 'MMM d')}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1.5">
                                                {selectedNights.length === 0
                                                    ? 'Select at least one night.'
                                                    : `${qty} stall${qty !== 1 ? 's' : ''} × ${selectedNights.length} night${selectedNights.length !== 1 ? 's' : ''} = ${money(qty * selectedNights.length * (barn.pricePerNight || 0) + qty * flatRate)}`}
                                            </p>
                                        </div>
                                    )}
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
                        {displayRvAreas.map(rv => {
                            const total = Number(rv.total) || 0;
                            const available = Math.max(total - (Number(rv.taken) || 0), 0);
                            const soldOut = total > 0 && available === 0;
                            // The pooled "All RV Areas" row's qty is the sum across whichever
                            // real member areas currently hold its spots.
                            const qty = rv.members
                                ? rv.members.reduce((s, m) => s + (Number(selection.rvs?.[m.id]) || 0), 0)
                                : (selection.rvs?.[rv.id] || 0);
                            const flatRate = flatRateForRvArea(rv.id, extraRvFees);
                            const hasNightly = (Number(rv.pricePerNight) || 0) > 0;
                            const isFlatRate = flatRate > 0;
                            const priceParts = [];
                            if (hasNightly) priceParts.push(`${money(rv.pricePerNight)}/night`);
                            if (isFlatRate) priceParts.push(`${money(flatRate)} flat`);
                            const priceLabel = priceParts.length > 0 ? priceParts.join(' + ') : money(0);
                            const userLen = Number(selection.rvOptions?.[rv.id]?.length || 0);
                            const lengthExceeded = rv.maxLength > 0 && userLen > 0 && userLen > rv.maxLength;
                            const selectedRvNights = selection.rvNights?.[rv.id] || showNights;
                            // Only Per Night RV areas need "which nights" — Flat charges the
                            // same no matter how many nights are ticked.
                            const showRvNightPicker = qty > 0 && hasNightly && showNights.length > 1;
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
                                                {priceLabel} · {soldOut ? 'Sold out' : `${available} of ${total} available`}
                                                {!rv.members && <> · {HOOKUP_LABELS[rv.hookupType] || rv.hookupType} · {POWER_LABELS[rv.powerType] || rv.powerType}</>}
                                                {rv.maxLength > 0 && <> · Max {rv.maxLength}ft</>}
                                            </p>
                                            {bookWindow?.start && bookWindow?.end && (
                                                <p className="text-xs text-muted-foreground">
                                                    {format(parseISO(bookWindow.start), 'MMM d')} – {format(parseISO(bookWindow.end), 'MMM d, yyyy')}
                                                </p>
                                            )}
                                            {!rv.members && (
                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                    {rv.hasWater && <Badge variant="secondary" className="text-xs">Water</Badge>}
                                                    {rv.hasSewer && <Badge variant="secondary" className="text-xs">Sewer</Badge>}
                                                    {rv.hasWifi && <Badge variant="secondary" className="text-xs">Wi-Fi</Badge>}
                                                </div>
                                            )}
                                        </div>
                                        <QtyStepper
                                            value={qty}
                                            max={available}
                                            onChange={(v) => setSelection(prev => {
                                                if (rv.members) {
                                                    // Re-split the pooled quantity across real member
                                                    // areas, filling each one's own remaining capacity.
                                                    const rvs = { ...(prev.rvs || {}) };
                                                    for (const m of rv.members) delete rvs[m.id];
                                                    return { ...prev, rvs: { ...rvs, ...allocatePooledRvSpots(rv.members, v) } };
                                                }
                                                return { ...prev, rvs: { ...(prev.rvs || {}), [rv.id]: v } };
                                            })}
                                        />
                                    </div>
                                    {showRvNightPicker && (
                                        <div className="pt-2 border-t">
                                            <p className="text-xs text-muted-foreground mb-1.5">Which nights do you need {qty} spot{qty !== 1 ? 's' : ''} in {rv.name}?</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {showNights.map(date => {
                                                    const checked = selectedRvNights.includes(date);
                                                    return (
                                                        <button
                                                            key={date}
                                                            type="button"
                                                            onClick={() => toggleRvNight(rv.id, date)}
                                                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${checked
                                                                ? 'bg-primary text-primary-foreground border-primary'
                                                                : 'bg-background text-muted-foreground border-input hover:bg-muted'}`}
                                                        >
                                                            {format(parseISO(date), 'MMM d')}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1.5">
                                                {selectedRvNights.length === 0
                                                    ? 'Select at least one night.'
                                                    : `${qty} spot${qty !== 1 ? 's' : ''} × ${selectedRvNights.length} night${selectedRvNights.length !== 1 ? 's' : ''} = ${money(qty * selectedRvNights.length * (rv.pricePerNight || 0))}`}
                                            </p>
                                        </div>
                                    )}
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
                            const total = Number(space.total) || 0;
                            const available = Math.max(total - (Number(space.taken) || 0), 0);
                            const soldOut = total > 0 && available === 0;
                            const qty = selection.support?.[space.id] || 0;
                            return (
                                <div key={space.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{space.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {money(space.pricePerNight)}/night ·{' '}
                                            {soldOut ? 'Sold out' : `${available} of ${total} available`}
                                            {space.size && ` · ${space.size}`}
                                        </p>
                                    </div>
                                    <QtyStepper
                                        value={qty}
                                        max={available}
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
                        <CardDescription>Optional one-time purchases, ready when you arrive. You can also order these during the show.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {supplies.map(item => {
                            const key = item.id || item.name;
                            const qty = selection.supplies?.[key] || 0;
                            // Remaining = stock on hand − already sold. stockQty of 0 means "no limit".
                            const limited = item.stockQty > 0;
                            const remaining = limited ? Math.max(item.stockQty - (Number(item.sold) || 0), 0) : undefined;
                            const soldOut = limited && remaining === 0;
                            return (
                                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {money(item.price)} per {item.unit}
                                            {limited && ` · ${soldOut ? 'Sold out' : `${remaining} of ${item.stockQty} available`}`}
                                        </p>
                                    </div>
                                    <QtyStepper
                                        value={qty}
                                        max={remaining}
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

const Step2_Details = ({ details, setDetails, showWindow, bookWindow = {} }) => {
    // Hard limits for what an exhibitor may pick (move-in / move-out window).
    const minDate = bookWindow.start || showWindow.start || '';
    const maxDate = bookWindow.end || showWindow.end || '';
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
                    {minDate && (
                        <CardDescription className="font-medium text-primary">
                            Move-in {format(parseISO(minDate), 'MMM d')}{maxDate ? ` – move-out ${format(parseISO(maxDate), 'MMM d, yyyy')}` : ''} — please book within these dates.
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>Arrival Date *</Label>
                        <Input
                            type="date"
                            value={details.arrivalDate}
                            min={minDate || undefined}
                            max={maxDate || undefined}
                            onChange={(e) => setDetails(d => ({ ...d, arrivalDate: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Departure Date *</Label>
                        <Input
                            type="date"
                            value={details.departureDate}
                            min={details.arrivalDate || minDate || undefined}
                            max={maxDate || undefined}
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
                <CardContent className="space-y-6">
                    {/* ---- Exhibitor (required) ---- */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">Exhibitor</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Exhibitor Name *</Label>
                                <Input
                                    value={details.exhibitorName}
                                    onChange={(e) => setDetails(d => ({ ...d, exhibitorName: e.target.value }))}
                                    placeholder="John Smith"
                                />
                            </div>
                            <div className="hidden md:block" />
                            <div>
                                <Label>Exhibitor Email *</Label>
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
                                <Label>Exhibitor Phone *</Label>
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
                    </div>

                    {/* ---- Trainer / Ranch / Group (optional) ---- */}
                    <div className="border-t border-border pt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Trainer / Ranch / Group
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">Optional — helps us group your stalls together.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Trainer / Ranch / Group Name</Label>
                                <Input
                                    value={details.trainerName}
                                    onChange={(e) => setDetails(d => ({ ...d, trainerName: e.target.value }))}
                                    placeholder="e.g., Smith Performance Horses"
                                />
                            </div>
                            <div className="hidden md:block" />
                            <div>
                                <Label>Trainer Email</Label>
                                <div className="relative">
                                    <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="email"
                                        value={details.trainerEmail}
                                        onChange={(e) => setDetails(d => ({ ...d, trainerEmail: e.target.value }))}
                                        placeholder="trainer@example.com"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Trainer Phone</Label>
                                <div className="relative">
                                    <Phone className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="tel"
                                        value={details.trainerPhone}
                                        onChange={(e) => setDetails(d => ({ ...d, trainerPhone: e.target.value }))}
                                        placeholder="(555) 555-1234"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ---- Horses ---- */}
                    <div className="border-t border-border pt-5 space-y-3">
                        <div className="max-w-[200px]">
                            <Label>Number of Horses</Label>
                            <Input
                                type="number"
                                min={0}
                                max={50}
                                value={details.horseCount}
                                onChange={(e) => {
                                    const n = Math.max(0, Math.min(50, parseInt(e.target.value) || 0));
                                    setDetails(d => {
                                        // Trim any names beyond the new count so removed lines don't linger.
                                        const names = (d.horseNames || '').split(',').map(s => s.trim());
                                        names.length = n;
                                        return { ...d, horseCount: n, horseNames: names.join(', ') };
                                    });
                                }}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Stalls booked ≠ horses — tell us how many horses you're bringing.</p>
                        </div>
                        {details.horseCount > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Array.from({ length: details.horseCount }).map((_, i) => {
                                    const names = (details.horseNames || '').split(',').map(s => s.trim());
                                    return (
                                        <div key={i}>
                                            <Label className="text-xs">Horse {i + 1} name</Label>
                                            <Input
                                                value={names[i] || ''}
                                                onChange={(e) => setDetails(d => {
                                                    const arr = (d.horseNames || '').split(',').map(s => s.trim());
                                                    while (arr.length <= i) arr.push('');
                                                    arr[i] = e.target.value;
                                                    arr.length = Math.max(arr.length, d.horseCount);
                                                    return { ...d, horseNames: arr.join(', ') };
                                                })}
                                                placeholder={`e.g., ${['Dixie', 'Blaze', 'Apollo', 'Scout', 'Willow'][i % 5]}`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
                    <p><span className="text-muted-foreground">Exhibitor:</span> {details.exhibitorName || '—'}</p>
                    <p><span className="text-muted-foreground">Email:</span> {details.email || '—'}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {details.phone || '—'}</p>
                    {(details.trainerName || details.trainerEmail || details.trainerPhone) && (
                        <div className="pt-2 border-t mt-2 space-y-1">
                            {details.trainerName && <p><span className="text-muted-foreground">Trainer/Group:</span> {details.trainerName}</p>}
                            {details.trainerEmail && <p><span className="text-muted-foreground">Trainer Email:</span> {details.trainerEmail}</p>}
                            {details.trainerPhone && <p><span className="text-muted-foreground">Trainer Phone:</span> {details.trainerPhone}</p>}
                        </div>
                    )}
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
    const [confirmation, setConfirmation] = useState(null);

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
        email: '',
        phone: '',
        trainerName: '',
        trainerEmail: '',
        trainerPhone: '',
        horseCount: 1,
        horseNames: '',
        preferences: '',
    });

    // Load show.
    //
    // This page used to fetch the whole projects row. Because it needs to know
    // what is already taken, that meant every exhibitor's booking — name, email,
    // phone, private notes, amount paid — was sent to an anonymous browser, along
    // with the show's fees, staff and schedule. Confirmed on production. The RPC
    // returns inventory, prices and the taken counts, and nothing else.
    useEffect(() => {
        const loadShow = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_public_show', { p_show_id: showId });
                if (error) throw error;
                if (!data) throw new Error('This show could not be found.');
                setShow(data);

                // Pre-fill arrival/departure. The move-in/move-out window
                // (bookWindow) is what exhibitors must actually book within —
                // it can differ from the show's competition dates (showWindow)
                // — so it takes priority; fall back to showWindow when the
                // organizer hasn't set a separate move-in/move-out window.
                const start = data?.bookWindow?.start || data?.showWindow?.start;
                const end = data?.bookWindow?.end || data?.showWindow?.end;
                if (start) {
                    setDetails(d => ({
                        ...d,
                        arrivalDate: d.arrivalDate || start,
                        departureDate: d.departureDate || end || start,
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

    // How this show sells stalls online: 'at_booking' (pre-pay now) or 'invoice_after'.
    const billingMode = show?.billingMode || 'invoice_after';

    // Returning from Stripe (success_url carries ?session_id=…) → show the paid
    // confirmation. The webhook has already marked the booking paid server-side; here
    // we just restore the booking we stashed before redirecting and clean the URL.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('session_id')) return;
        try {
            const stashed = sessionStorage.getItem('pendingStallBooking');
            if (stashed) {
                const b = JSON.parse(stashed);
                setConfirmation({ ...b, paid: true });
                sessionStorage.removeItem('pendingStallBooking');
            } else {
                setConfirmation({ paid: true, bookingShortId: '', payload: {} });
            }
        } catch { /* ignore */ }
        // Strip the query so a refresh doesn't re-trigger this.
        window.history.replaceState({}, '', window.location.pathname);
    }, []);

    // Inventory, with each item carrying its own total and how much is taken.
    //
    // Availability used to be worked out here in the browser, from the raw
    // bookings array — which is why the whole show record had to be downloaded.
    // The same maths now runs inside get_public_show(): stalls taken = stalls
    // pinned to a live booking + stalls a live booking paid for but has not been
    // given yet; RV, support and supplies = quantity ordered on live bookings.
    // Cancelled bookings never count.
    const inventory = useMemo(() => {
        const inv = show?.inventory || {};
        return {
            barns: inv.barns || [],
            rvAreas: inv.rvAreas || [],
            supportSpaces: inv.supportSpaces || [],
            supplies: inv.supplies || [],
            // Circuit / flat fees that aren't tied to one barn (see public_show_inventory).
            extraStallFees: inv.extraStallFees || [],
            extraRvFees: inv.extraRvFees || [],
        };
    }, [show]);

    const showWindow = useMemo(() => ({
        start: show?.showWindow?.start || '',
        end: show?.showWindow?.end || '',
    }), [show]);

    // Booking is only open when the organizer has set the housing module to
    // "published". Draft = still building, Locked = closed — both block booking.
    const housingStatus = show?.housingStatus || 'draft';

    // Hard move-in / move-out limits set by the organizer in Housing → Inventory.
    // Exhibitors can't book arrival/departure outside this window. Falls back to the
    // show's competition dates when the organizer hasn't set a move-in/out window.
    const bookWindow = useMemo(() => ({
        start: show?.bookWindow?.start || showWindow.start || '',
        end: show?.bookWindow?.end || showWindow.end || '',
    }), [show, showWindow]);

    // A show that is already over cannot be booked. There was no date check at all
    // here: an organizer who left a finished show published kept taking reservations
    // and payments for dates in the past, and the arrival/departure pickers offered
    // nothing but past dates. Compared as yyyy-MM-dd strings, which is date-correct
    // and free of timezone drift.
    const hasEnded = useMemo(() => {
        const lastDay = bookWindow.end || showWindow.end;
        if (!lastDay) return false;
        return lastDay < new Date().toISOString().slice(0, 10);
    }, [bookWindow.end, showWindow.end]);

    const isOpenForBooking = housingStatus === 'published' && !hasEnded;

    const orderSummary = useMemo(() => {
        const nights = calcNights(details.arrivalDate, details.departureDate);
        const items = [];
        let subtotal = 0;

        const stallsByBarn = stallsByBarnFromSelection(selection);
        // A barn priced Per Night can be booked for fewer nights than the full
        // stay (task 4's night picker) — only barns the exhibitor has actually
        // touched carry an override; everything else still uses the global
        // `nights` from the arrival/departure dates below. A night pick made
        // against the pooled "All Barns" row is stored under the synthetic
        // group id, so it's expanded back onto whichever real barns absorbed
        // the pooled quantity (see groupBarnsForBooking / allocatePooledStalls).
        const { pooledGroup } = groupBarnsForBooking(inventory.barns, inventory.extraStallFees);
        const nightsByBarn = {};
        for (const [key, dates] of Object.entries(selection.barnNights || {})) {
            if (key === ALL_BARNS_GROUP_ID && pooledGroup) {
                for (const memberId of Object.keys(stallsByBarn)) {
                    if (pooledGroup.members.some(m => m.id === memberId)) nightsByBarn[memberId] = dates.length;
                }
            } else {
                nightsByBarn[key] = dates.length;
            }
        }
        const barnStalls = buildBarnStallItems({
            barns: inventory.barns,
            stallsByBarn,
            extraStallFees: inventory.extraStallFees,
            nights,
            nightsByBarn,
        });
        // Display only: a member of the pooled "All Barns" group shows as "All
        // Barns" to the exhibitor, matching the Select Items row they actually
        // picked. `refId` is left pointing at the REAL barn — stall
        // auto-assignment (stallAssignment.js) and admin analytics key off it
        // to know which physical barn to place the stall in.
        for (const item of barnStalls.items) {
            if (pooledGroup?.members.some(m => m.id === item.refId)) {
                item.name = `All Barns × ${item.qty}`;
            }
        }
        items.push(...barnStalls.items);
        subtotal += barnStalls.subtotal;

        // Circuit / late-entry / other facility-wide fees that aren't tied to one
        // barn. Priced at booking time from the fee's own Unit Type, right after
        // the stall lines. Per-Night fees are excluded — they're already folded
        // into barn.pricePerNight above. Flat fees are excluded too — a barn with
        // one is charged its flat rate directly in the stall line above (see
        // buildBarnStallItems), so charging either again here would double-bill.
        const extras = buildExtraStallFeeItems({
            extraStallFees: inventory.extraStallFees,
            stallsByBarn,
            nights,
            horseCount: Number(details.horseCount) || 0,
            excludeUnitTypes: ['per_night', 'flat'],
        });
        items.push(...extras.items);
        subtotal += extras.subtotal;

        const rvsByArea = rvsByAreaFromSelection(selection);
        // Same per-area night picker as barns — see the barn nightsByBarn block
        // above for why the pooled key gets expanded onto real member areas.
        const { pooledGroup: pooledRvGroup } = groupRvAreasForBooking(inventory.rvAreas, inventory.extraRvFees);
        const nightsByArea = {};
        for (const [key, dates] of Object.entries(selection.rvNights || {})) {
            if (key === ALL_RV_GROUP_ID && pooledRvGroup) {
                for (const memberId of Object.keys(rvsByArea)) {
                    if (pooledRvGroup.members.some(m => m.id === memberId)) nightsByArea[memberId] = dates.length;
                }
            } else {
                nightsByArea[key] = dates.length;
            }
        }
        const rvAreaItems = buildRvAreaItems({
            rvAreas: inventory.rvAreas,
            rvsByArea,
            extraRvFees: inventory.extraRvFees,
            nights,
            nightsByArea,
        });
        for (const item of rvAreaItems.items) {
            item.options = selection.rvOptions?.[item.refId] || {};
            // Display only: a member of the pooled "All RV Areas" group shows as
            // that, matching the Select Items row actually picked — `refId` is
            // left pointing at the REAL area for assignment/analytics.
            if (pooledRvGroup?.members.some(m => m.id === item.refId)) {
                item.name = `All RV Areas × ${item.qty}`;
            }
        }
        items.push(...rvAreaItems.items);
        subtotal += rvAreaItems.subtotal;

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
    }, [inventory, selection, details.arrivalDate, details.departureDate, details.horseCount]);

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
            const { pooledGroup } = groupBarnsForBooking(inventory.barns, inventory.extraStallFees);
            const pooledQty = pooledGroup
                ? pooledGroup.members.reduce((s, m) => s + (Number(selection.stalls?.[m.id]) || 0), 0)
                : 0;
            if (pooledQty > 0 && (selection.barnNights?.[ALL_BARNS_GROUP_ID]?.length === 0)) {
                toast({ title: 'Select at least one night', description: 'Pick which nights you need All Barns for.', variant: 'destructive' });
                return false;
            }
            for (const barn of inventory.barns) {
                if (pooledGroup?.members.some(m => m.id === barn.id)) continue; // validated above as the pooled row
                const qty = selection.stalls?.[barn.id] || 0;
                if (qty > 0 && (selection.barnNights?.[barn.id]?.length === 0)) {
                    toast({ title: 'Select at least one night', description: `Pick which nights you need ${barn.name} for.`, variant: 'destructive' });
                    return false;
                }
            }
            const { pooledGroup: pooledRvGroup } = groupRvAreasForBooking(inventory.rvAreas, inventory.extraRvFees);
            const pooledRvQty = pooledRvGroup
                ? pooledRvGroup.members.reduce((s, m) => s + (Number(selection.rvs?.[m.id]) || 0), 0)
                : 0;
            if (pooledRvQty > 0 && (selection.rvNights?.[ALL_RV_GROUP_ID]?.length === 0)) {
                toast({ title: 'Select at least one night', description: 'Pick which nights you need All RV Areas for.', variant: 'destructive' });
                return false;
            }
            for (const rv of inventory.rvAreas) {
                if (pooledRvGroup?.members.some(m => m.id === rv.id)) continue; // validated above as the pooled row
                const qty = selection.rvs?.[rv.id] || 0;
                const isFlat = flatRateForRvArea(rv.id, inventory.extraRvFees) > 0;
                if (!isFlat && qty > 0 && (selection.rvNights?.[rv.id]?.length === 0)) {
                    toast({ title: 'Select at least one night', description: `Pick which nights you need ${rv.name} for.`, variant: 'destructive' });
                    return false;
                }
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
            // Enforce the organizer's move-in / move-out window (hard limit).
            if (bookWindow.start && details.arrivalDate < bookWindow.start) {
                toast({ title: 'Arrival too early', description: `Move-in starts ${format(parseISO(bookWindow.start), 'MMM d, yyyy')}.`, variant: 'destructive' });
                return false;
            }
            if (bookWindow.end && details.departureDate > bookWindow.end) {
                toast({ title: 'Departure too late', description: `Move-out is by ${format(parseISO(bookWindow.end), 'MMM d, yyyy')}.`, variant: 'destructive' });
                return false;
            }
            if (!details.exhibitorName || !details.email || !details.phone) {
                toast({ title: 'Please complete required fields', variant: 'destructive' });
                return false;
            }
        }
        return true;
    };

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
                trainerEmail: details.trainerEmail || '',
                trainerPhone: details.trainerPhone || '',
                horseName: horseList[0] || '',
                horseNames: horseList,
                horseCount: details.horseCount || horseList.length,
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

            const conf = {
                bookingId: data,
                bookingShortId: String(data || '').slice(0, 8).toUpperCase(),
                payload: bookingPayload,
            };

            // Bill-at-booking → send them straight to Stripe to pre-pay. Stash the
            // booking so we can show a paid confirmation when they return. If checkout
            // can't start, fall back to the normal (unpaid) confirmation below.
            if (billingMode === 'at_booking' && orderSummary.subtotal > 0) {
                try {
                    sessionStorage.setItem('pendingStallBooking', JSON.stringify(conf));
                    await startStallCheckout({
                        showId,
                        bookingId: data,
                        customerEmail: details.email,
                    });
                    return; // browser is redirecting to Stripe
                } catch (payErr) {
                    sessionStorage.removeItem('pendingStallBooking');
                    toast({
                        title: 'Could not open payment',
                        description: `${payErr.message}. Your reservation is saved — you can pay from the confirmation.`,
                        variant: 'destructive',
                    });
                    setConfirmation({ ...conf, payFailed: true });
                    return;
                }
            }

            setConfirmation(conf);
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
                    <title>Reservation Confirmed - {show?.name}</title>
                </Helmet>
                <div className="min-h-screen bg-background">
                    <Navigation />
                    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="border-2 border-emerald-500">
                                <CardHeader className="text-center pb-4">
                                    <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                                        {confirmation.paid
                                            ? <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                            : <PartyPopper className="h-8 w-8 text-emerald-600" />}
                                    </div>
                                    <CardTitle className="text-2xl">
                                        {confirmation.paid ? 'Payment Received!' : 'Reservation Received!'}
                                    </CardTitle>
                                    <CardDescription>
                                        {confirmation.paid ? (
                                            <>Thank you{confirmation.payload?.exhibitorName ? `, ${confirmation.payload.exhibitorName}` : ''}. Your reservation for <strong>{show?.name}</strong> is confirmed and <strong>paid</strong>.</>
                                        ) : (
                                            <>Thank you, {confirmation.payload?.exhibitorName}. Your reservation for <strong>{show?.name}</strong> has been recorded.</>
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {/* Payment status / pay-now */}
                                    {confirmation.paid ? (
                                        <div className="rounded-lg border border-emerald-500 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" /> Paid in full — {money(confirmation.payload?.totalAmount)}
                                        </div>
                                    ) : billingMode === 'at_booking' ? (
                                        <div className="rounded-lg border border-amber-400 bg-amber-500/10 p-3 space-y-2">
                                            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                                {confirmation.payFailed ? 'Payment didn’t start — your spot is held. Pay now to confirm it.' : 'Payment required to confirm your reservation.'}
                                            </p>
                                            <Button
                                                className="w-full"
                                                onClick={async () => {
                                                    try {
                                                        sessionStorage.setItem('pendingStallBooking', JSON.stringify(confirmation));
                                                        await startStallCheckout({ showId, bookingId: confirmation.bookingId, customerEmail: confirmation.payload?.email });
                                                    } catch (e) {
                                                        sessionStorage.removeItem('pendingStallBooking');
                                                        toast({ title: 'Could not open payment', description: e.message, variant: 'destructive' });
                                                    }
                                                }}
                                            >
                                                Pay {money(confirmation.payload?.totalAmount)} now
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                                            The organizer will confirm your reservation and send an invoice for payment.
                                        </div>
                                    )}

                                    {confirmation.bookingShortId && (
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
                                    )}

                                    {confirmation.payload?.arrivalDate && (
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
                                    )}

                                    {(confirmation.payload?.items || []).length > 0 && (
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
                                    )}
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

    // Booking is gated by the organizer's housing status. Only "published" is open;
    // Draft = not open yet, Locked = closed. (The confirmation screen above still
    // shows for anyone who already submitted while it was open.)
    if (!isOpenForBooking) {
        const isLockedClosed = housingStatus === 'locked';
        const Icon = isLockedClosed || hasEnded ? Lock : CalendarClock;
        return (
            <>
                <Helmet><title>Booking Not Open - {show.name}</title></Helmet>
                <div className="min-h-screen bg-background">
                    <Navigation />
                    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                        <Card className="border-2">
                            <CardHeader className="text-center pb-4">
                                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
                                    <Icon className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <CardTitle className="text-2xl">
                                    {hasEnded ? 'This show has finished' : isLockedClosed ? 'Booking is closed' : 'Booking is not open yet'}
                                </CardTitle>
                                <CardDescription className="text-base">
                                    {hasEnded
                                        ? <><strong>{show.name}</strong> has already taken place, so reservations are no longer being accepted.</>
                                        : isLockedClosed
                                            ? <>Online reservations for <strong>{show.name}</strong> are currently closed. Please contact the show organizer.</>
                                            : <>Reservations for <strong>{show.name}</strong> haven't opened yet. Please check back soon, or contact the show organizer.</>}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </main>
                </div>
            </>
        );
    }

    const stepLabels = ['Select Items', 'Your Details', 'Review & Pay'];

    return (
        <>
            <Helmet>
                <title>Reserve - {show.name}</title>
            </Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="mb-6">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/show/${showId}`)}>
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Show
                            </Button>
                            <h1 className="text-3xl font-bold mt-2">{show.name}</h1>
                            <p className="text-muted-foreground">Reserve stalls, RV spots, and supplies</p>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-2 mb-8">
                            {stepLabels.map((label, i) => {
                                const num = i + 1;
                                const active = step === num;
                                const done = step > num;
                                // Allow jumping BACK to an already-completed step; block forward
                                // clicks so validateStep() still guards required fields.
                                const canGoBack = num < step;
                                return (
                                    <React.Fragment key={label}>
                                        <button
                                            type="button"
                                            onClick={() => { if (canGoBack) setStep(num); }}
                                            disabled={!canGoBack}
                                            className={`flex items-center gap-2 ${active ? 'text-primary' : done ? 'text-emerald-600' : 'text-muted-foreground'} ${canGoBack ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                                        >
                                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted'}`}>
                                                {done ? <CheckCircle2 className="h-4 w-4" /> : num}
                                            </div>
                                            <span className="text-sm font-medium hidden sm:inline">{label}</span>
                                        </button>
                                        {i < stepLabels.length - 1 && <div className={`flex-1 h-0.5 ${done ? 'bg-emerald-600' : 'bg-muted'}`} />}
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Step body */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-3">
                                {step === 1 && <Step1_SelectItems inventory={inventory} selection={selection} setSelection={setSelection} bookWindow={bookWindow} />}
                                {step === 2 && <Step2_Details details={details} setDetails={setDetails} showWindow={showWindow} bookWindow={bookWindow} />}
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
