import React from 'react';
import { Plus, Minus, Home, Car, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { flatRateForBarn } from '@/lib/extraStallFees';
import { flatRateForRvArea } from '@/lib/extraRvFees';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// Small quantity stepper (matches the public booking page behaviour).
export const QtyStepper = ({ value, onChange, max, min = 0 }) => (
    <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8"
            disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
            <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8"
            disabled={max != null && value >= max} onClick={() => onChange(Math.min(max ?? Infinity, value + 1))}>
            <Plus className="h-3.5 w-3.5" />
        </Button>
    </div>
);

/**
 * Stalls / RV Spots / Supplies picker — the same Flat Fee vs Nightly Fee
 * "radio option" cards as the public booking page, shared by the organizer's
 * Add Booking and Edit Booking dialogs so both offer the identical choice.
 *
 * @param {object} inventory  { barns, rvAreas, supplies, extraStallFees, extraRvFees }
 * @param {object} suppliesSold  { [supplyKey]: qtySold } — for stock remaining
 * @param {object} selection  { stalls: {barnId: {flat,night}}, rvs: {...}, supplies: {key: qty} }
 * @param {(group: 'stalls'|'rvs', id: string, kind: 'flat'|'night', v: number) => void} setOptionQty
 * @param {(id: string, v: number) => void} setSupplyQty
 */
const BookingItemsFields = ({ inventory, suppliesSold = {}, selection, setOptionQty, setSupplyQty }) => {
    const { barns = [], rvAreas = [], supplies = [], extraStallFees = [], extraRvFees = [] } = inventory || {};

    return (
        <>
            {barns.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-primary uppercase">
                        <Home className="h-3.5 w-3.5" /> Stalls
                    </p>
                    {barns.map(barn => {
                        const total = (barn.stalls || []).filter(s => (s.type || 'stall') === 'stall').length;
                        const booked = (barn.stalls || []).filter(s => s.bookingId && (s.type || 'stall') === 'stall').length;
                        const free = Math.max(total - booked, 0);
                        const flatRate = flatRateForBarn(barn.id, extraStallFees);
                        const nightlyRate = Number(barn.pricePerNight) || 0;
                        const hasFlat = flatRate > 0;
                        const hasNightly = nightlyRate > 0;
                        const flatQty = selection.stalls[barn.id]?.flat || 0;
                        const nightQty = selection.stalls[barn.id]?.night || 0;
                        // The stall(s) already sitting under this booking's own current
                        // selection don't count against "free" — only other bookings do.
                        const freeForThis = free + flatQty + nightQty;
                        return (
                            <div key={barn.id} className="border rounded-md p-2 space-y-2">
                                <div className="text-sm font-medium">{barn.name} <span className="text-xs text-muted-foreground font-normal">· {free} free</span></div>
                                {!hasFlat && !hasNightly && (
                                    <p className="text-xs text-muted-foreground">Not priced yet.</p>
                                )}
                                <div className="grid sm:grid-cols-2 gap-2">
                                    {hasFlat && (
                                        <div className="flex items-center justify-between gap-2 border rounded p-1.5">
                                            <div>
                                                <Badge variant="secondary" className="text-[10px]">Flat Fee</Badge>
                                                <p className="text-xs text-muted-foreground mt-0.5">{money(flatRate)} flat</p>
                                            </div>
                                            <QtyStepper value={flatQty} max={freeForThis}
                                                onChange={(v) => setOptionQty('stalls', barn.id, 'flat', v)} />
                                        </div>
                                    )}
                                    {hasNightly && (
                                        <div className="flex items-center justify-between gap-2 border rounded p-1.5">
                                            <div>
                                                <Badge variant="secondary" className="text-[10px]">Nightly Fee</Badge>
                                                <p className="text-xs text-muted-foreground mt-0.5">{money(nightlyRate)}/night</p>
                                            </div>
                                            <QtyStepper value={nightQty} max={freeForThis}
                                                onChange={(v) => setOptionQty('stalls', barn.id, 'night', v)} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {rvAreas.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-cyan-600 uppercase">
                        <Car className="h-3.5 w-3.5" /> RV Spots
                    </p>
                    {rvAreas.map(rv => {
                        const flatRate = flatRateForRvArea(rv.id, extraRvFees);
                        const nightlyRate = Number(rv.pricePerNight) || 0;
                        const hasFlat = flatRate > 0;
                        const hasNightly = nightlyRate > 0;
                        const flatQty = selection.rvs[rv.id]?.flat || 0;
                        const nightQty = selection.rvs[rv.id]?.night || 0;
                        const max = rv.spotCount ? rv.spotCount : undefined;
                        return (
                            <div key={rv.id} className="border rounded-md p-2 space-y-2">
                                <div className="text-sm font-medium">{rv.name} <span className="text-xs text-muted-foreground font-normal">· {rv.spotCount || 0} spots</span></div>
                                {!hasFlat && !hasNightly && (
                                    <p className="text-xs text-muted-foreground">Not priced yet.</p>
                                )}
                                <div className="grid sm:grid-cols-2 gap-2">
                                    {hasFlat && (
                                        <div className="flex items-center justify-between gap-2 border rounded p-1.5">
                                            <div>
                                                <Badge variant="secondary" className="text-[10px]">Flat Fee</Badge>
                                                <p className="text-xs text-muted-foreground mt-0.5">{money(flatRate)} flat</p>
                                            </div>
                                            <QtyStepper value={flatQty} max={max}
                                                onChange={(v) => setOptionQty('rvs', rv.id, 'flat', v)} />
                                        </div>
                                    )}
                                    {hasNightly && (
                                        <div className="flex items-center justify-between gap-2 border rounded p-1.5">
                                            <div>
                                                <Badge variant="secondary" className="text-[10px]">Nightly Fee</Badge>
                                                <p className="text-xs text-muted-foreground mt-0.5">{money(nightlyRate)}/night</p>
                                            </div>
                                            <QtyStepper value={nightQty} max={max}
                                                onChange={(v) => setOptionQty('rvs', rv.id, 'night', v)} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {supplies.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-amber-600 uppercase">
                        <Package className="h-3.5 w-3.5" /> Supplies
                    </p>
                    {supplies.map(item => {
                        const key = item.id || item.name;
                        const limited = item.stockQty > 0;
                        const remaining = limited ? Math.max(item.stockQty - (suppliesSold[key] || 0), 0) : undefined;
                        return (
                            <div key={key} className="flex items-center justify-between border rounded-md p-2">
                                <div className="text-sm">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-xs text-muted-foreground"> · {money(item.price)} per {item.unit || 'unit'}{limited ? ` · ${remaining} left` : ''}</span>
                                </div>
                                <QtyStepper value={selection.supplies[key] || 0} max={remaining}
                                    onChange={(v) => setSupplyQty(key, v)} />
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default BookingItemsFields;
