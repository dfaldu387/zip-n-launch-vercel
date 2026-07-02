import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShoppingCart, Plus, Minus, Loader2, Home, Car, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { buildBookingItems } from '@/lib/bookingItems';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// Small quantity stepper (matches the public booking page behaviour).
const QtyStepper = ({ value, onChange, max, min = 0 }) => (
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

// Organizer-side "New Booking" form. Builds the SAME booking shape as an online
// booking (items[] + totalAmount) so Manage Stalls, Smart Auto-Assign, Booked
// counts, occupancy and revenue all work with it automatically.
const AddBookingDialog = ({ inventory, suppliesSold = {}, defaultNights = 1, onAdd }) => {
    const { barns = [], rvAreas = [], supplies = [] } = inventory || {};
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [details, setDetails] = useState({
        exhibitorName: '', email: '', phone: '', trainerName: '', horses: '', status: 'pending',
    });
    const [nights, setNights] = useState(Math.max(1, defaultNights || 1));
    const [selection, setSelection] = useState({ stalls: {}, rvs: {}, supplies: {} });

    const reset = () => {
        setDetails({ exhibitorName: '', email: '', phone: '', trainerName: '', horses: '', status: 'pending' });
        setNights(Math.max(1, defaultNights || 1));
        setSelection({ stalls: {}, rvs: {}, supplies: {} });
    };

    const { items, subtotal } = useMemo(
        () => buildBookingItems({ barns, rvAreas, supplies }, selection, nights),
        [barns, rvAreas, supplies, selection, nights]
    );

    const setQty = (group, id, v) => setSelection(prev => ({ ...prev, [group]: { ...prev[group], [id]: v } }));

    const handleSubmit = async () => {
        if (!details.exhibitorName.trim()) {
            toast({ title: 'Name required', description: 'Enter the exhibitor name.', variant: 'destructive' });
            return;
        }
        if (items.length === 0) {
            toast({ title: 'Add at least one item', description: 'Pick a stall, RV spot, or supply.', variant: 'destructive' });
            return;
        }
        const horseList = (details.horses || '').split(',').map(s => s.trim()).filter(Boolean);
        const booking = {
            id: uuidv4(),
            exhibitorName: details.exhibitorName.trim(),
            email: details.email.trim(),
            phone: details.phone.trim(),
            trainerName: details.trainerName.trim(),
            horseName: horseList[0] || '',
            horseNames: horseList,
            horseCount: horseList.length,
            nights,
            items,
            amount: subtotal,
            totalAmount: subtotal,
            stallId: '',
            status: details.status,
            paymentStatus: 'unpaid',
            notes: '',
            source: 'manual',
            createdAt: new Date().toISOString(),
        };
        setIsSaving(true);
        try {
            await onAdd(booking);
            toast({ title: 'Booking added', description: `${booking.exhibitorName} · ${money(subtotal)}` });
            reset();
            setOpen(false);
        } catch (e) {
            toast({ title: 'Could not add booking', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Add Booking
            </Button>

            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>New Booking</DialogTitle>
                        <DialogDescription>
                            Enter a booking on behalf of an exhibitor. Only the name is required.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[65vh] pr-3">
                        <div className="space-y-4">
                            {/* Contact */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Exhibitor name *</Label>
                                    <Input className="h-8 text-sm" value={details.exhibitorName}
                                        onChange={(e) => setDetails(d => ({ ...d, exhibitorName: e.target.value }))}
                                        placeholder="Jane Rider" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Trainer</Label>
                                    <Input className="h-8 text-sm" value={details.trainerName}
                                        onChange={(e) => setDetails(d => ({ ...d, trainerName: e.target.value }))}
                                        placeholder="Optional" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Email</Label>
                                    <Input className="h-8 text-sm" value={details.email}
                                        onChange={(e) => setDetails(d => ({ ...d, email: e.target.value }))}
                                        placeholder="Optional" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Phone</Label>
                                    <Input className="h-8 text-sm" value={details.phone}
                                        onChange={(e) => setDetails(d => ({ ...d, phone: e.target.value }))}
                                        placeholder="Optional" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label className="text-xs">Horses (comma separated)</Label>
                                    <Input className="h-8 text-sm" value={details.horses}
                                        onChange={(e) => setDetails(d => ({ ...d, horses: e.target.value }))}
                                        placeholder="Charlie, Cinnamon" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Nights</Label>
                                    <Input type="number" min={1} className="h-8 text-sm" value={nights}
                                        onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Status</Label>
                                    <Select value={details.status} onValueChange={(v) => setDetails(d => ({ ...d, status: v }))}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="confirmed">Confirmed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Stalls */}
                            {barns.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold flex items-center gap-1.5 text-primary uppercase">
                                        <Home className="h-3.5 w-3.5" /> Stalls
                                    </p>
                                    {barns.map(barn => {
                                        const total = (barn.stalls || []).filter(s => (s.type || 'stall') === 'stall').length;
                                        const booked = (barn.stalls || []).filter(s => s.bookingId && (s.type || 'stall') === 'stall').length;
                                        const free = Math.max(total - booked, 0);
                                        return (
                                            <div key={barn.id} className="flex items-center justify-between border rounded-md p-2">
                                                <div className="text-sm">
                                                    <span className="font-medium">{barn.name}</span>
                                                    <span className="text-xs text-muted-foreground"> · {money(barn.pricePerNight)}/night · {free} free</span>
                                                </div>
                                                <QtyStepper value={selection.stalls[barn.id] || 0} max={free}
                                                    onChange={(v) => setQty('stalls', barn.id, v)} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* RV */}
                            {rvAreas.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold flex items-center gap-1.5 text-cyan-600 uppercase">
                                        <Car className="h-3.5 w-3.5" /> RV Spots
                                    </p>
                                    {rvAreas.map(rv => {
                                        const isFlat = (rv.pricingModel || 'nightly') === 'flat';
                                        const price = isFlat ? (rv.flatRate || 0) : (rv.pricePerNight || 0);
                                        return (
                                            <div key={rv.id} className="flex items-center justify-between border rounded-md p-2">
                                                <div className="text-sm">
                                                    <span className="font-medium">{rv.name}</span>
                                                    <span className="text-xs text-muted-foreground"> · {money(price)}{isFlat ? ' flat' : '/night'} · {rv.spotCount || 0} spots</span>
                                                </div>
                                                <QtyStepper value={selection.rvs[rv.id] || 0} max={rv.spotCount || undefined}
                                                    onChange={(v) => setQty('rvs', rv.id, v)} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Supplies */}
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
                                                    onChange={(v) => setQty('supplies', key, v)} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-2">
                        <div className="text-sm font-semibold">Total: {money(subtotal)}</div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={isSaving}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={isSaving}>
                                {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding…</> : `Add Booking · ${money(subtotal)}`}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AddBookingDialog;
