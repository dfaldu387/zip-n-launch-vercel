import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { buildBookingItems, selectionFromBookingItems } from '@/lib/bookingItems';
import BookingItemsFields from './BookingItemsFields';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// Organizer-side "New Booking" / "Edit Booking" form. Builds the SAME booking
// shape as an online booking (items[] + totalAmount) so Manage Stalls, Smart
// Auto-Assign, Booked counts, occupancy and revenue all work with it
// automatically — and offers the identical Flat Fee / Nightly Fee choice as
// the public booking page (see BookingItemsFields).
//
// Two modes, picked by whether `booking` is passed:
//  - Create (no `booking`): renders its own "Add Booking" trigger button and
//    manages its own open state. Calls `onAdd(newBooking)`.
//  - Edit (`booking` passed): fully controlled via `open`/`onOpenChange` (no
//    trigger button of its own — the caller opens it, e.g. from a pencil
//    icon), pre-fills every field/selection from the booking, and calls
//    `onSave(bookingId, patch)` instead of `onAdd`.
const AddBookingDialog = ({
    inventory, suppliesSold = {}, defaultNights = 1, onAdd,
    booking = null, open: openProp, onOpenChange, onSave,
}) => {
    const isEditMode = !!booking;
    const { barns = [], rvAreas = [], supplies = [], extraStallFees = [], extraRvFees = [] } = inventory || {};
    const { toast } = useToast();
    const [internalOpen, setInternalOpen] = useState(false);
    const open = isEditMode ? !!openProp : internalOpen;
    const setOpen = (o) => { if (isEditMode) onOpenChange?.(o); else setInternalOpen(o); };
    const [isSaving, setIsSaving] = useState(false);

    const blankDetails = () => ({
        exhibitorName: '', email: '', phone: '',
        trainerName: '', trainerEmail: '', trainerPhone: '',
        horses: '', status: 'pending',
    });
    // Edit mode is remounted fresh each time it opens (the caller only
    // renders it while there's a booking to edit), so lazy-initializing from
    // `booking` here is enough — no need to re-sync on prop changes.
    const [details, setDetails] = useState(() => isEditMode ? {
        exhibitorName: booking.exhibitorName || '',
        email: booking.email || '',
        phone: booking.phone || '',
        trainerName: booking.trainerName || '',
        trainerEmail: booking.trainerEmail || '',
        trainerPhone: booking.trainerPhone || '',
        horses: (booking.horseNames && booking.horseNames.length ? booking.horseNames : (booking.horseName ? [booking.horseName] : [])).join(', '),
        status: booking.status || 'pending',
    } : blankDetails());
    const [nights, setNights] = useState(Math.max(1, (isEditMode ? booking.nights : defaultNights) || 1));
    const [selection, setSelection] = useState(() => isEditMode
        ? selectionFromBookingItems(booking.items || [])
        : { stalls: {}, rvs: {}, supplies: {} });

    const reset = () => {
        setDetails(blankDetails());
        setNights(Math.max(1, defaultNights || 1));
        setSelection({ stalls: {}, rvs: {}, supplies: {} });
    };

    // Horses are typed as a comma-separated list — count them so a Per Horse
    // extra fee prices correctly.
    const horseCount = details.horses.split(',').map(h => h.trim()).filter(Boolean).length;

    const { items, subtotal } = useMemo(
        () => buildBookingItems({ barns, rvAreas, supplies, extraStallFees, extraRvFees }, selection, nights, { horseCount }),
        [barns, rvAreas, supplies, extraStallFees, extraRvFees, selection, nights, horseCount]
    );

    const setSupplyQty = (id, v) => setSelection(prev => ({ ...prev, supplies: { ...prev.supplies, [id]: v } }));

    // Flat Fee and Nightly Fee are two separate purchases, never both at once
    // for the same barn/area (same "radio option" rule as the public booking
    // page) — picking a qty on one option clears the other.
    const setOptionQty = (group, id, kind, v) => setSelection(prev => ({
        ...prev,
        [group]: { ...prev[group], [id]: v > 0 ? { [kind]: v } : {} },
    }));

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
        setIsSaving(true);
        try {
            if (isEditMode) {
                await onSave(booking.id, {
                    exhibitorName: details.exhibitorName.trim(),
                    email: details.email.trim(),
                    phone: details.phone.trim(),
                    trainerName: details.trainerName.trim(),
                    trainerEmail: details.trainerEmail.trim(),
                    trainerPhone: details.trainerPhone.trim(),
                    horseName: horseList[0] || '',
                    horseNames: horseList,
                    horseCount: horseList.length,
                    nights,
                    items,
                    amount: subtotal,
                    totalAmount: subtotal,
                    status: details.status,
                });
                toast({ title: 'Booking updated', description: `${details.exhibitorName.trim()} · ${money(subtotal)}` });
            } else {
                const newBooking = {
                    id: uuidv4(),
                    exhibitorName: details.exhibitorName.trim(),
                    email: details.email.trim(),
                    phone: details.phone.trim(),
                    trainerName: details.trainerName.trim(),
                    trainerEmail: details.trainerEmail.trim(),
                    trainerPhone: details.trainerPhone.trim(),
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
                await onAdd(newBooking);
                toast({ title: 'Booking added', description: `${newBooking.exhibitorName} · ${money(subtotal)}` });
                reset();
            }
            setOpen(false);
        } catch (e) {
            toast({ title: isEditMode ? 'Could not save booking' : 'Could not add booking', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            {!isEditMode && (
                <Button variant="outline" onClick={() => setOpen(true)}>
                    <ShoppingCart className="h-4 w-4 mr-2" /> Add Booking
                </Button>
            )}

            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && !isEditMode) reset(); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? 'Edit Booking' : 'New Booking'}</DialogTitle>
                        <DialogDescription>
                            {isEditMode
                                ? 'Change contact details, stalls, RV spots, or supplies for this booking.'
                                : 'Enter a booking on behalf of an exhibitor. Only the name is required.'}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[65vh] pr-3">
                        <div className="space-y-4">
                            {/* Contact */}
                            <div className="grid grid-cols-2 gap-3">
                                <p className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-primary">Exhibitor</p>
                                <div className="space-y-1">
                                    <Label className="text-xs">Exhibitor name *</Label>
                                    <Input className="h-8 text-sm" value={details.exhibitorName}
                                        onChange={(e) => setDetails(d => ({ ...d, exhibitorName: e.target.value }))}
                                        placeholder="Jane Rider" />
                                </div>
                                <div className="hidden sm:block" />
                                <div className="space-y-1">
                                    <Label className="text-xs">Exhibitor email</Label>
                                    <Input className="h-8 text-sm" value={details.email}
                                        onChange={(e) => setDetails(d => ({ ...d, email: e.target.value }))}
                                        placeholder="Optional" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Exhibitor phone</Label>
                                    <Input className="h-8 text-sm" value={details.phone}
                                        onChange={(e) => setDetails(d => ({ ...d, phone: e.target.value }))}
                                        placeholder="Optional" />
                                </div>

                                <p className="col-span-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Trainer / Ranch / Group <span className="font-normal normal-case tracking-normal">— optional</span>
                                </p>
                                <div className="space-y-1">
                                    <Label className="text-xs">Trainer / group name</Label>
                                    <Input className="h-8 text-sm" value={details.trainerName}
                                        onChange={(e) => setDetails(d => ({ ...d, trainerName: e.target.value }))}
                                        placeholder="Optional" />
                                </div>
                                <div className="hidden sm:block" />
                                <div className="space-y-1">
                                    <Label className="text-xs">Trainer email</Label>
                                    <Input className="h-8 text-sm" value={details.trainerEmail}
                                        onChange={(e) => setDetails(d => ({ ...d, trainerEmail: e.target.value }))}
                                        placeholder="Optional" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Trainer phone</Label>
                                    <Input className="h-8 text-sm" value={details.trainerPhone}
                                        onChange={(e) => setDetails(d => ({ ...d, trainerPhone: e.target.value }))}
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

                            <BookingItemsFields
                                inventory={{ barns, rvAreas, supplies, extraStallFees, extraRvFees }}
                                suppliesSold={suppliesSold}
                                selection={selection}
                                setOptionQty={setOptionQty}
                                setSupplyQty={setSupplyQty}
                            />
                        </div>
                    </ScrollArea>

                    <DialogFooter className="flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-2">
                        <div className="text-sm font-semibold">Total: {money(subtotal)}</div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={isSaving}>
                                {isSaving
                                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isEditMode ? 'Saving…' : 'Adding…'}</>
                                    : `${isEditMode ? 'Save Booking' : 'Add Booking'} · ${money(subtotal)}`}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AddBookingDialog;
