import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Search, Download, Printer, ArrowUpDown, ArrowUp, ArrowDown, ClipboardList, ChevronRight, ChevronDown, Mail, Phone, Users, FileText, Loader2, Pencil, Trash2, Check, X, MoreVertical, StickyNote, History } from 'lucide-react';
import { getRequestedStallCount, getAssignedStallsForBooking } from '@/lib/stallAssignment';
import { ensureAllRvSpots, getAssignedRvSpotsForBooking } from '@/lib/rvAssignment';
import { getBookingDisplayStatus, computeBookingTotal } from '@/lib/bookingPricing';
import { getBookingRef, getBookingKind } from '@/lib/bookingRef';
import { getSupplyStage, getSupplyLastUpdate, getItemStatus, SUPPLY_STAGES } from '@/lib/supplyStatus';

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// EquiPatterns' cut of every online payment (matches stalls-create-checkout /
// stalls-create-invoice edge functions and the Billing disclosure text in the
// Fees tab). Applied only to money actually received — never to the price owed
// on a still-Pending booking, so this sheet never shows money that isn't real yet.
const PLATFORM_FEE_RATE = 0.05;

// ── Phase 1: Master List ──
// A spreadsheet-style roster of everyone who booked (stalls + RV + pre-ordered
// supplies like shavings/hay). Read-only summary with sort / filter, plus two
// paper-ready exports: a CSV (opens in Excel/Sheets — includes contact, dates,
// supplies and horse names) and a printable Stalls & RV worklist with a tick-off
// column. Assignment itself still happens via the per-row "Manage Stalls" dialog.

// How many RV spots a booking asked for (across all rv line items).
const getRvCount = (booking) =>
    (booking?.items || []).reduce((sum, it) => sum + (it.type === 'rv' ? (Number(it.qty) || 0) : 0), 0);

// How many horses the exhibitor is bringing (several shapes across builders).
const getHorseCount = (booking) => {
    if (Number.isFinite(booking?.horseCount)) return booking.horseCount;
    if (Array.isArray(booking?.horseNames)) return booking.horseNames.length;
    return booking?.horseName ? 1 : 0;
};

// The actual horse names (array, comma-string, or single field — normalize to a list).
const getHorseNames = (booking) => {
    if (Array.isArray(booking?.horseNames)) return booking.horseNames.filter(Boolean);
    if (typeof booking?.horseNames === 'string') return booking.horseNames.split(',').map(s => s.trim()).filter(Boolean);
    if (booking?.horseName) return [booking.horseName];
    return [];
};

// Pre-ordered supplies (shavings / hay / feed) — one entry per supply line item.
// item.name already reads like "Shavings × 3"; strip the trailing "× n" so we can
// re-render it consistently as "Shavings ×3" and expose the qty on its own.
// Each item also carries its OWN fulfillment stage (Ordered/Received/Out for
// delivery/Delivered) — Robert: "we might go out and deliver the Shavings, but
// not get to the Hay yet" — pulled the same way the Hay & Shavings tab does.
const getSupplies = (booking) =>
    (booking?.items || [])
        .filter(it => it?.type === 'supply')
        .map(it => {
            const qty = Number(it.qty) || 0;
            const base = String(it.name || '').replace(/\s*×\s*\d+\s*$/, '').trim();
            const { status, stageTimestamps } = getItemStatus(booking, it.refId);
            const stage = SUPPLY_STAGES.find(s => s.key === status) || SUPPLY_STAGES[0];
            const timestamps = Object.values(stageTimestamps || {}).filter(Boolean).sort();
            return {
                name: base || it.name || 'Item',
                qty,
                refId: it.refId,
                stageLabel: stage.label,
                stageColor: stage.color,
                lastUpdated: timestamps.length ? timestamps[timestamps.length - 1] : (booking?.createdAt || null),
            };
        });

// 'YYYY-MM-DD' → 'Jul 3' without pulling in a date library.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return String(iso);
    return `${MONTHS[m - 1]} ${d}`;
};

// ISO timestamp → "Jul 14, 11:08 PM" for the "Booked" line in the detail panel.
const fmtDateTime = (iso) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
    } catch {
        return String(iso);
    }
};

// Build one flat row per booking with everything the table + export need.
const buildRow = (booking, barns, extraStallFees, rvWithSpots) => {
    const requested = getRequestedStallCount(booking);
    const assigned = getAssignedStallsForBooking(booking, barns);
    const rvSpots = getAssignedRvSpotsForBooking(booking, rvWithSpots);
    const supplies = getSupplies(booking);
    const horseNamesArr = getHorseNames(booking);
    const supplyStage = getSupplyStage(booking);
    // Live-priced, same as the invoice/balance-due figures elsewhere in this
    // page — never the stored totalAmount, which freezes at booking time and
    // goes stale after a fee change (see bookingPricing.js).
    const pricedStalls = assigned.map(s => ({
        ...s,
        pricePerNight: barns.find(b => b.id === s.barnId)?.pricePerNight || 0,
        barnName: barns.find(b => b.id === s.barnId)?.name,
    }));
    const amount = computeBookingTotal(booking, pricedStalls, extraStallFees);
    // Money actually received, not the price owed. A real Stripe payment records
    // its own paidAmount (partial or full); a booking hand-marked Paid without one
    // is treated as paid in full. Anything else (Pending, cancelled, etc.) is $0 —
    // this sheet never counts a payment that hasn't happened yet.
    const paymentStatus = booking.paymentStatus || 'unpaid';
    const paidAmount = paymentStatus === 'paid' ? (Number(booking.paidAmount) || amount)
        : paymentStatus === 'partial' ? (Number(booking.paidAmount) || 0)
        : 0;
    const platformFee = paidAmount * PLATFORM_FEE_RATE;
    const clubAmount = paidAmount - platformFee;
    return {
        booking,
        ref: getBookingRef(booking),
        kind: getBookingKind(booking),
        supplyStatus: supplies.length > 0 ? supplyStage.label : '',
        supplyStageKey: supplies.length > 0 ? supplyStage.key : '',
        supplyStageColor: supplyStage.color,
        supplyUpdatedAt: supplies.length > 0 ? getSupplyLastUpdate(booking) : null,
        name: booking.exhibitorName || '—',
        trainer: booking.trainerName || '',
        trainerEmail: booking.trainerEmail || '',
        trainerPhone: booking.trainerPhone || '',
        email: booking.email || '',
        phone: booking.phone || '',
        arrival: booking.arrivalDate || '',
        departure: booking.departureDate || '',
        arrivalLabel: fmtDate(booking.arrivalDate),
        departureLabel: fmtDate(booking.departureDate),
        stalls: requested,
        assignedCount: assigned.length,
        stallNumbersArr: assigned.map(s => s.number),
        stallNumbers: assigned.map(s => s.number).join(', '),
        rv: getRvCount(booking),
        rvAssignedCount: rvSpots.length,
        rvSpotNumbersArr: rvSpots.map(s => s.number),
        rvSpotNumbers: rvSpots.map(s => s.number).join(', '),
        supplies,
        supplyCount: supplies.reduce((n, s) => n + s.qty, 0),
        suppliesStr: supplies.map(s => `${s.name} ×${s.qty}`).join(', '),
        horses: getHorseCount(booking),
        horseNamesArr,
        horseNamesStr: horseNamesArr.join(', '),
        status: getBookingDisplayStatus(booking),
        amount,
        paidAmount,
        clubAmount,
        platformFee,
    };
};

const BOOKING_STATUSES = ['confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out'];

const STATUS_STYLES = {
    pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    paid: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    confirmed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    checked_in: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    cancelled: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

// A generation timestamp for every export, so a printed/emailed copy is traceable.
// `human` reads like "Jul 7, 2026, 12:25 PM"; `file` is filename-safe "2026-07-07_1225".
const exportStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const human = d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const file = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    return { human, file };
};

const COLUMNS = [
    { key: 'name', label: 'Exhibitor', align: 'left' },
    { key: 'trainer', label: 'Trainer / Group', align: 'left' },
    { key: 'stalls', label: 'Stalls', align: 'center' },
    { key: 'assignedCount', label: 'Assigned', align: 'center' },
    { key: 'rv', label: 'RV', align: 'center' },
    { key: 'suppliesStr', label: 'Supplies / Pre-Orders', align: 'left' },
    { key: 'horses', label: 'Horses', align: 'center' },
    { key: 'status', label: 'Status', align: 'left' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'paidAmount', label: 'Paid', align: 'right' },
];

// One row (collapsed + expandable detail) — its own component so Edit/Delete
// can hold local draft/confirm state without re-rendering the whole table.
const MasterListRow = ({
    r, isOpen, onToggleExpand,
    onUpdateField, onStatusChange, onRemove, onDownloadInvoice, onEmailInvoice, invoicingId, onLogActivity,
}) => {
    const booking = r.booking;
    const partial = r.assignedCount > 0 && r.assignedCount < r.stalls;
    const extraStalls = Math.max(r.assignedCount - r.horses, 0);
    const balanceDue = Math.max(0, r.amount - r.paidAmount);

    // Editing is explicit and two-step, same pattern as the old Bookings tab:
    // press Edit → change fields → Save (or Cancel to discard nothing happens
    // until then). Delete needs a second click to confirm.
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Notes have their own Edit button, separate from the booking-fields
    // edit above — Robert's mockup treats them as their own block, and they
    // save on their own without touching status/payment.
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const startEditNotes = () => {
        setNotesDraft(booking.notes || '');
        setIsEditingNotes(true);
        if (!isOpen) onToggleExpand();
    };
    const saveNotes = () => {
        if (notesDraft !== (booking.notes || '')) onUpdateField(booking.id, 'notes', notesDraft);
        setIsEditingNotes(false);
    };
    const cancelEditNotes = () => setIsEditingNotes(false);

    const startEdit = () => {
        setDraft({
            exhibitorName: booking.exhibitorName || '',
            trainerName: booking.trainerName || '',
            status: booking.status || 'pending',
            paymentStatus: booking.paymentStatus || 'unpaid',
            paidAmount: r.paidAmount,
        });
        setConfirmDelete(false);
        setIsEditing(true);
        if (!isOpen) onToggleExpand();
    };
    const cancelEdit = () => { setDraft(null); setIsEditing(false); };
    const saveEdit = () => {
        if (!draft) { setIsEditing(false); return; }
        // Status gets its own dedicated log line (via onStatusChange), so it's
        // left out of this summary to avoid saying the same thing twice.
        const changedLabels = [];
        if (draft.exhibitorName !== (booking.exhibitorName || '')) {
            onUpdateField(booking.id, 'exhibitorName', draft.exhibitorName);
            changedLabels.push('exhibitor');
        }
        if (draft.trainerName !== (booking.trainerName || '')) {
            onUpdateField(booking.id, 'trainerName', draft.trainerName);
            changedLabels.push('trainer/group');
        }
        if (draft.status !== (booking.status || 'pending')) onStatusChange?.(booking.id, draft.status);
        if (draft.paymentStatus !== (booking.paymentStatus || 'unpaid')) {
            onUpdateField(booking.id, 'paymentStatus', draft.paymentStatus);
            changedLabels.push('payment status');
        }
        if (Number(draft.paidAmount || 0) !== r.paidAmount) {
            onUpdateField(booking.id, 'paidAmount', Number(draft.paidAmount || 0));
            changedLabels.push('paid amount');
        }
        if (changedLabels.length) onLogActivity?.(booking.id, `Updated: ${changedLabels.join(', ')}`);
        setDraft(null);
        setIsEditing(false);
    };
    const setDraftField = (field, value) => setDraft(d => ({ ...d, [field]: value }));

    const confirmDeleteBooking = async () => {
        setDeleting(true);
        try { await onRemove?.(booking.id); } finally { setDeleting(false); setConfirmDelete(false); }
    };

    const isEmailing = invoicingId === booking.id;

    return (
        <React.Fragment>
            <tr className={cn('border-b last:border-0 hover:bg-muted/30', isOpen && 'bg-muted/20')}>
                <td className="px-3 py-2 font-medium">
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        className="inline-flex items-center gap-1.5 text-left hover:text-primary"
                        title={isOpen ? 'Hide details' : 'Show details'}
                    >
                        {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        <span>{r.name}</span>
                    </button>
                    <div className="flex items-center gap-1.5 pl-5">
                        <span className="text-[10px] font-mono text-muted-foreground/70">#{r.ref}</span>
                        {r.booking.orderType === 'live-supply' && (
                            <Badge variant="outline" className="text-[9px] font-normal border-amber-400 text-amber-600">
                                At-show reorder
                            </Badge>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                    {r.trainer || (r.trainerEmail || r.trainerPhone ? '' : '—')}
                    {(r.trainerEmail || r.trainerPhone) && (
                        <div className="text-[10px] text-muted-foreground/70 leading-tight">
                            {[r.trainerEmail, r.trainerPhone].filter(Boolean).join(' · ')}
                        </div>
                    )}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">{r.stalls || '—'}</td>
                <td className="px-3 py-2">
                    {r.stalls > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap justify-center">
                            {r.assignedCount === 0 ? (
                                <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-500">Unassigned</Badge>
                            ) : (
                                <>
                                    {r.stallNumbersArr.slice(0, 8).map((num, i) => (
                                        <Badge key={i} className="bg-emerald-600 text-white text-[10px] font-mono">{num}</Badge>
                                    ))}
                                    {r.stallNumbersArr.length > 8 && (
                                        <Badge variant="outline" className="text-[10px]">+{r.stallNumbersArr.length - 8}</Badge>
                                    )}
                                    {partial && (
                                        <span className="text-[10px] text-amber-600 font-medium">• {r.stalls - r.assignedCount} left</span>
                                    )}
                                </>
                            )}
                        </div>
                    ) : <span className="text-muted-foreground flex justify-center">—</span>}
                </td>
                <td className="px-3 py-2">
                    {r.rv > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap justify-center">
                            {r.rvAssignedCount === 0 ? (
                                <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-500">Unassigned</Badge>
                            ) : (
                                r.rvSpotNumbersArr.map((num, i) => (
                                    <Badge key={i} className="bg-violet-600 text-white text-[10px] font-mono">{num}</Badge>
                                ))
                            )}
                        </div>
                    ) : <span className="text-muted-foreground flex justify-center">—</span>}
                </td>
                <td className="px-3 py-2">
                    {r.supplies.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                            {r.supplies.map((s, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                    {s.name} <span className="ml-1 font-semibold tabular-nums">×{s.qty}</span>
                                </Badge>
                            ))}
                            <Badge className={cn(r.supplyStageColor, 'text-white text-[10px]')}>{r.supplyStatus}</Badge>
                        </div>
                    ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                    <span className="tabular-nums font-medium">{r.horses || '—'}</span>
                    {r.horseNamesStr && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{r.horseNamesStr}</div>
                    )}
                </td>
                <td className="px-3 py-2">
                    <Badge className={cn('text-[10px] capitalize', STATUS_STYLES[r.status] || '')}>
                        {r.status.replace('_', ' ')}
                    </Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(r.amount)}</td>
                <td className={cn('px-3 py-2 text-right tabular-nums font-medium',
                    r.paidAmount > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {fmtMoney(r.paidAmount)}
                </td>
                <td className="px-3 py-2 text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Actions">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => onDownloadInvoice?.(booking)}>
                                <FileText className="h-3.5 w-3.5 mr-2" /> Download invoice
                            </DropdownMenuItem>
                            {balanceDue > 0 && booking.email && (
                                <DropdownMenuItem disabled={isEmailing} onClick={() => onEmailInvoice?.(booking)}>
                                    {isEmailing
                                        ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                        : <Mail className="h-3.5 w-3.5 mr-2" />}
                                    Email invoice
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={startEdit}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit booking
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10"
                                onClick={() => setConfirmDelete(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete booking
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </td>
            </tr>
            <ConfirmationDialog
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={confirmDeleteBooking}
                title="Delete this booking?"
                description={
                    `You're about to permanently delete the booking for `
                    + `"${booking.exhibitorName || 'this exhibitor'}"`
                    + (r.assignedCount ? ` — ${r.assignedCount} stall${r.assignedCount === 1 ? '' : 's'} assigned` : '')
                    + (booking.status ? ` (${booking.status.replace('_', ' ')})` : '')
                    + `. This can't be undone.`
                }
                confirmText={deleting ? 'Deleting…' : 'Delete booking'}
                cancelText="Keep booking"
            />
            {isOpen && (
                <tr className="border-b bg-muted/30">
                    <td colSpan={11} className="px-4 py-3 text-xs">
                        <div className="space-y-2.5">
                            {/* Edit form — Exhibitor / Trainer / Status / Payment / Paid amount */}
                            {isEditing && draft && (
                                <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10 p-2.5 space-y-2">
                                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1">Exhibitor</p>
                                            <Input value={draft.exhibitorName} onChange={(e) => setDraftField('exhibitorName', e.target.value)} className="h-7 text-xs" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1">Trainer / Group</p>
                                            <Input value={draft.trainerName} onChange={(e) => setDraftField('trainerName', e.target.value)} className="h-7 text-xs" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1">Status</p>
                                            <Select value={draft.status} onValueChange={(v) => setDraftField('status', v)}>
                                                <SelectTrigger className="h-7 text-xs capitalize"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {BOOKING_STATUSES.map(s => (
                                                        <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_', ' ')}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1">Payment</p>
                                            <Select value={draft.paymentStatus} onValueChange={(v) => setDraftField('paymentStatus', v)}>
                                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unpaid" className="text-xs">Unpaid</SelectItem>
                                                    <SelectItem value="partial" className="text-xs">Partial</SelectItem>
                                                    <SelectItem value="paid" className="text-xs">Paid</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <p className="font-medium text-muted-foreground mb-1">Paid amount</p>
                                            <Input
                                                type="number" min="0" step="0.01"
                                                value={draft.paidAmount}
                                                onChange={(e) => setDraftField('paidAmount', e.target.value)}
                                                className="h-7 text-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                        <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>
                                            <Check className="h-3.5 w-3.5 mr-1" /> Save
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
                                            <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Contacts */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                {r.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {r.email}</span> : null}
                                {r.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {r.phone}</span> : null}
                                {!r.email && !r.phone && <span className="text-muted-foreground italic">No exhibitor contact on file</span>}
                            </div>
                            {(r.trainer || r.trainerEmail || r.trainerPhone) && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Trainer: {r.trainer || '—'}</span>
                                    {r.trainerEmail ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {r.trainerEmail}</span> : null}
                                    {r.trainerPhone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {r.trainerPhone}</span> : null}
                                </div>
                            )}

                            {/* Horses, stalls, extra, RV */}
                            <div className={cn('grid gap-2 sm:grid-cols-2', r.rv > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
                                <div>
                                    <p className="font-medium text-muted-foreground mb-0.5">Horses ({r.horses})</p>
                                    <p>{r.horseNamesArr.length ? r.horseNamesArr.join(', ') : <span className="italic text-muted-foreground">None listed</span>}</p>
                                </div>
                                <div>
                                    <p className="font-medium text-muted-foreground mb-0.5">Stalls ({r.assignedCount}{r.stalls ? ` of ${r.stalls}` : ''})</p>
                                    <div className="flex flex-wrap gap-1">
                                        {r.stallNumbersArr.length
                                            ? r.stallNumbersArr.map((num, i) => (
                                                <Badge key={i} className="bg-emerald-600 text-white text-[10px] font-mono">{num}</Badge>
                                            ))
                                            : <span className="italic text-muted-foreground">Unassigned</span>}
                                    </div>
                                </div>
                                <div>
                                    <p className="font-medium text-muted-foreground mb-0.5">Extra stalls beyond horses</p>
                                    <p className={cn('font-semibold', extraStalls > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                                        {extraStalls > 0 ? `+${extraStalls}` : '0'}
                                    </p>
                                </div>
                                {r.rv > 0 && (
                                    <div>
                                        <p className="font-medium text-muted-foreground mb-0.5">RV ({r.rvAssignedCount}{r.rv ? ` of ${r.rv}` : ''})</p>
                                        <div className="flex flex-wrap gap-1">
                                            {r.rvSpotNumbersArr.length
                                                ? r.rvSpotNumbersArr.map((num, i) => (
                                                    <Badge key={i} className="bg-violet-600 text-white text-[10px] font-mono">{num}</Badge>
                                                ))
                                                : <span className="italic text-muted-foreground">Unassigned</span>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Supply Fulfillment — one row per line item, each with its own stage,
                                since a delivery can reach the Shavings before the Hay. */}
                            {r.supplies.length > 0 && (
                                <div>
                                    <p className="font-medium text-muted-foreground mb-1">Supply Fulfillment</p>
                                    <div className="rounded-md border overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-muted/50 text-muted-foreground">
                                                    <th className="px-2 py-1 text-left font-medium">Item</th>
                                                    <th className="px-2 py-1 text-center font-medium">Qty</th>
                                                    <th className="px-2 py-1 text-left font-medium">Status</th>
                                                    <th className="px-2 py-1 text-left font-medium">Last Updated</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {r.supplies.map((s, i) => (
                                                    <tr key={i} className="border-t">
                                                        <td className="px-2 py-1">{s.name}</td>
                                                        <td className="px-2 py-1 text-center tabular-nums">{s.qty}</td>
                                                        <td className="px-2 py-1">
                                                            <Badge className={cn(s.stageColor, 'text-white text-[10px]')}>{s.stageLabel}</Badge>
                                                        </td>
                                                        <td className="px-2 py-1 text-muted-foreground">
                                                            {s.lastUpdated ? fmtDateTime(s.lastUpdated) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Notes — its own Edit button, saves independently of the fields above. */}
                            <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <StickyNote className="h-3 w-3 text-muted-foreground" />
                                    <p className="font-medium text-muted-foreground">Notes</p>
                                    {!isEditingNotes && (
                                        <button
                                            type="button"
                                            onClick={startEditNotes}
                                            className="text-muted-foreground hover:text-primary"
                                            title="Edit notes"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                {isEditingNotes ? (
                                    <div className="space-y-1.5">
                                        <Textarea
                                            value={notesDraft}
                                            onChange={(e) => setNotesDraft(e.target.value)}
                                            placeholder="Anything the barn/facility should know — arrival plans, requests, etc."
                                            className="text-xs min-h-[60px]"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-1.5">
                                            <Button size="sm" className="h-7 text-xs" onClick={saveNotes}>
                                                <Check className="h-3.5 w-3.5 mr-1" /> Save
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={cancelEditNotes}>
                                                <X className="h-3.5 w-3.5 mr-1" /> Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className={cn(!booking.notes && 'italic text-muted-foreground')}>
                                        {booking.notes || 'No notes'}
                                    </p>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground pt-1 border-t">
                                <span>Ref: <span className="font-mono font-medium text-foreground">#{r.ref}</span></span>
                                <span>Type: <span className="font-medium text-foreground">{r.kind}</span></span>
                                <span>Payment: <span className="capitalize font-medium text-foreground">{(r.booking.paymentStatus || 'unpaid').replace('_', ' ')}</span></span>
                                {r.booking.paidAt ? <span>Paid: <span className="font-medium text-foreground">{fmtDateTime(r.booking.paidAt)}</span></span> : null}
                                {(r.arrivalLabel || r.departureLabel) ? <span>Dates: <span className="font-medium text-foreground">{r.arrivalLabel || '?'} – {r.departureLabel || '?'}</span></span> : null}
                                {r.booking.source ? <span>Source: <span className="capitalize font-medium text-foreground">{r.booking.source}</span></span> : null}
                                {r.booking.createdAt ? <span>Booked: <span className="font-medium text-foreground">{fmtDateTime(r.booking.createdAt)}</span></span> : null}
                                <span>Amount: <span className="font-semibold text-foreground">{fmtMoney(r.amount)}</span></span>
                                {r.paidAmount > 0 && (
                                    <>
                                        <span>Paid: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtMoney(r.paidAmount)}</span></span>
                                        <span>Club gets (95%): <span className="font-medium text-foreground">{fmtMoney(r.clubAmount)}</span></span>
                                        <span>Platform fee (5%): <span className="font-medium text-foreground">{fmtMoney(r.platformFee)}</span></span>
                                    </>
                                )}
                            </div>

                            {/* Activity Log — bookings from before this existed still show a
                                sensible first line, synthesized from when they were booked. */}
                            <div>
                                <p className="font-medium text-muted-foreground mb-0.5 flex items-center gap-1.5">
                                    <History className="h-3 w-3" /> Activity Log
                                </p>
                                <ul className="space-y-0.5">
                                    {(booking.activityLog?.length
                                        ? [...booking.activityLog].reverse()
                                        : (booking.createdAt ? [{ at: booking.createdAt, message: 'Booking created' }] : [])
                                    ).map((entry, i) => (
                                        <li key={i} className="flex items-baseline gap-2">
                                            <span className="text-[10px] text-muted-foreground shrink-0 w-[92px]">{fmtDateTime(entry.at)}</span>
                                            <span>{entry.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};

const MasterListPanel = ({
    bookings = [], barns = [], rvAreas = [], extraStallFees = [], showName = 'Show',
    onUpdateField, onStatusChange, onRemove, onDownloadInvoice, onEmailInvoice, invoicingId, onLogActivity,
    addBookingSlot,
}) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [assignFilter, setAssignFilter] = useState('all'); // all | assigned | partial | unassigned
    const [supplyFilter, setSupplyFilter] = useState('all'); // all | none | <SUPPLY_STAGES key>
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
    // Rows the user has expanded (independent — several can be open at once).
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const toggleExpanded = (id) => setExpandedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    // RV areas store a spot COUNT (spotCount); materialize it into individual
    // numbered spots (R1, R2, …) the same way the Assign Stalls/RV board does,
    // so a booking's actual spot shows up here instead of just a request count.
    const rvWithSpots = useMemo(() => ensureAllRvSpots(rvAreas), [rvAreas]);

    const rows = useMemo(
        () => (bookings || []).filter(Boolean).map(b => buildRow(b, barns, extraStallFees, rvWithSpots)),
        [bookings, barns, extraStallFees, rvWithSpots]
    );

    const trainers = useMemo(() => {
        const set = new Set(rows.map(r => r.trainer).filter(Boolean));
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [rows]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = rows.filter(r => {
            if (q) {
                const hay = `${r.name} ${r.ref} ${r.trainer} ${r.trainerEmail} ${r.trainerPhone} ${r.stallNumbers} ${r.suppliesStr} ${r.supplyStatus} ${r.horseNamesStr} ${r.email} ${r.phone}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (assignFilter !== 'all') {
                if (assignFilter === 'assigned' && !(r.stalls > 0 && r.assignedCount >= r.stalls)) return false;
                if (assignFilter === 'partial' && !(r.assignedCount > 0 && r.assignedCount < r.stalls)) return false;
                if (assignFilter === 'unassigned' && !(r.stalls > 0 && r.assignedCount === 0)) return false;
            }
            if (supplyFilter !== 'all') {
                if (supplyFilter === 'none' && r.supplyStageKey) return false;
                if (supplyFilter !== 'none' && r.supplyStageKey !== supplyFilter) return false;
            }
            return true;
        });
        const { key, dir } = sort;
        const mult = dir === 'asc' ? 1 : -1;
        list = [...list].sort((a, b) => {
            const av = a[key], bv = b[key];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
            return String(av).localeCompare(String(bv)) * mult;
        });
        return list;
    }, [rows, search, statusFilter, assignFilter, supplyFilter, sort]);

    const totals = useMemo(() => filtered.reduce((t, r) => ({
        stalls: t.stalls + r.stalls,
        assigned: t.assigned + r.assignedCount,
        extraStalls: t.extraStalls + Math.max(r.assignedCount - r.horses, 0),
        rv: t.rv + r.rv,
        rvAssigned: t.rvAssigned + r.rvAssignedCount,
        supplies: t.supplies + r.supplyCount,
        horses: t.horses + r.horses,
        amount: t.amount + r.amount,
        paidAmount: t.paidAmount + r.paidAmount,
        clubAmount: t.clubAmount + r.clubAmount,
        platformFee: t.platformFee + r.platformFee,
    }), {
        stalls: 0, assigned: 0, extraStalls: 0, rv: 0, rvAssigned: 0, supplies: 0, horses: 0,
        amount: 0, paidAmount: 0, clubAmount: 0, platformFee: 0,
    }), [filtered]);

    // "Exhibitors" is distinct people, not bookings — the same person can have
    // more than one booking (an original reservation plus an at-show reorder).
    const exhibitorCount = useMemo(() => {
        const seen = new Set(filtered.map(r => (r.email || r.name || '').trim().toLowerCase()).filter(Boolean));
        return seen.size;
    }, [filtered]);

    // Supply totals broken out by item name (Shavings, Hay (Grass), …) — Robert's
    // mockup shows these at a glance without opening the Excel export.
    const supplyBreakdown = useMemo(() => {
        const byName = new Map();
        for (const r of filtered) {
            for (const s of r.supplies) {
                byName.set(s.name, (byName.get(s.name) || 0) + s.qty);
            }
        }
        return [...byName.entries()].sort((a, b) => b[1] - a[1]);
    }, [filtered]);

    const toggleSort = (key) => setSort(prev =>
        prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

    const SortIcon = ({ colKey }) => {
        if (sort.key !== colKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
        return sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
    };

    // Real .xlsx (not a CSV pretending to be one) — reuses the same SheetJS library
    // already used for budget exports elsewhere. Robert's ask (2026-09-20 video):
    // "it would show who's paid, how much the club has made, or the individual...
    // should be seeing in their bank account" — so alongside the price owed, every
    // row gets what was ACTUALLY paid, and that split 95% club / 5% EquiPatterns.
    const exportExcel = () => {
        const { file } = exportStamp();
        const rowsOut = filtered.map(r => ({
            Reference: r.ref,
            'Order Type': r.kind,
            Exhibitor: r.name,
            Email: r.email,
            Phone: r.phone,
            'Trainer/Group': r.trainer,
            'Trainer Email': r.trainerEmail,
            'Trainer Phone': r.trainerPhone,
            Arrival: r.arrivalLabel,
            Departure: r.departureLabel,
            Stalls: r.stalls,
            Assigned: r.assignedCount,
            'Assigned Stalls': r.stallNumbers,
            RV: r.rv,
            'Assigned RV Spots': r.rvSpotNumbers,
            'Supplies / Pre-Orders': r.suppliesStr,
            'Supply Status': r.supplyStatus,
            Horses: r.horses,
            'Horse Names': r.horseNamesStr,
            Status: r.status,
            'Amount Owed': r.amount,
            'Amount Paid': r.paidAmount,
            'Club Gets (95%)': r.clubAmount,
            'Platform Fee (5%)': r.platformFee,
        }));
        rowsOut.push({
            Reference: '', 'Order Type': '', Exhibitor: 'TOTAL', Email: '', Phone: '',
            'Trainer/Group': '', 'Trainer Email': '', 'Trainer Phone': '', Arrival: '', Departure: '',
            Stalls: totals.stalls, Assigned: totals.assigned, 'Assigned Stalls': '', RV: totals.rv,
            'Assigned RV Spots': '', 'Supplies / Pre-Orders': '', 'Supply Status': '', Horses: totals.horses, 'Horse Names': '', Status: '',
            'Amount Owed': totals.amount, 'Amount Paid': totals.paidAmount,
            'Club Gets (95%)': totals.clubAmount, 'Platform Fee (5%)': totals.platformFee,
        });

        const ws = XLSX.utils.json_to_sheet(rowsOut);
        ws['!cols'] = [
            { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 14 },
            { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
            { wch: 7 }, { wch: 9 }, { wch: 16 }, { wch: 6 }, { wch: 16 },
            { wch: 24 }, { wch: 14 }, { wch: 7 }, { wch: 24 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Master List');
        XLSX.writeFile(wb, `${showName.replace(/[^\w-]+/g, '_')}_master_list_${file}.xlsx`);
    };

    // Escape values before injecting into the print window's HTML.
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const printList = () => {
        const { human } = exportStamp();
        const rowsHtml = filtered.map(r => {
            const assignedCell = r.stalls > 0
                ? `${r.assignedCount}/${r.stalls}${r.stallNumbers ? ` <span class="muted">(${esc(r.stallNumbers)})</span>` : ''}`
                : '—';
            const rvCell = r.rv > 0
                ? `${r.rvAssignedCount}/${r.rv}${r.rvSpotNumbers ? ` <span class="muted">(${esc(r.rvSpotNumbers)})</span>` : ''}`
                : '—';
            const contact = [r.email, r.phone].filter(Boolean).map(esc).join(' · ');
            const dates = (r.arrivalLabel || r.departureLabel)
                ? `${esc(r.arrivalLabel)} – ${esc(r.departureLabel)}` : '';
            return `
            <tr>
                <td class="check"></td>
                <td>
                    <strong>${esc(r.name)}</strong>
                    <span class="muted">#${esc(r.ref)}</span>
                    ${contact ? `<div class="muted">${contact}</div>` : ''}
                    ${r.trainer ? `<div class="muted">${esc(r.trainer)}${(() => { const tc = [r.trainerEmail, r.trainerPhone].filter(Boolean).map(esc).join(' · '); return tc ? ` — ${tc}` : ''; })()}</div>` : ''}
                    ${dates ? `<div class="muted">${dates}</div>` : ''}
                </td>
                <td class="c">${assignedCell}</td>
                <td class="c">${rvCell}</td>
                <td>${r.suppliesStr ? `${esc(r.suppliesStr)}${r.supplyStatus ? ` <span class="muted">(${esc(r.supplyStatus)})</span>` : ''}` : '—'}</td>
                <td>${r.horseNamesStr ? esc(r.horseNamesStr) : (r.horses ? `${r.horses} horse${r.horses !== 1 ? 's' : ''}` : '—')}</td>
                <td class="cap">${esc(r.status.replace('_', ' '))}</td>
                <td class="c">${esc(fmtMoney(r.amount))}</td>
            </tr>`;
        }).join('');
        const html = `<!doctype html><html><head><title>${esc(showName)} — Master List</title>
            <style>
                *{box-sizing:border-box}
                body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#111}
                h1{font-size:18px;margin:0 0 4px}
                p.sub{color:#666;margin:0 0 16px;font-size:12px}
                table{border-collapse:collapse;width:100%;font-size:12px}
                th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
                th{background:#f3f4f6;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
                td.c,th.c{text-align:center}
                td.cap{text-transform:capitalize}
                td.check{width:26px;text-align:center}
                td.check::before{content:"";display:inline-block;width:13px;height:13px;border:1.5px solid #333;border-radius:2px}
                .muted{color:#666;font-size:11px;margin-top:2px}
                tbody tr:nth-child(even){background:#fafafa}
                @media print{body{padding:0}tbody tr{page-break-inside:avoid}}
            </style></head><body>
            <h1>${esc(showName)} — Stalls, RV &amp; Supplies Worklist</h1>
            <p class="sub">Generated ${esc(human)}</p>
            <p class="sub">${filtered.length} bookings · ${totals.stalls} stalls · ${totals.rv} RV · ${totals.supplies} supplies · ${totals.horses} horses · ${esc(fmtMoney(totals.amount))} total</p>
            <table><thead><tr>
                <th>✔</th><th>Exhibitor / Contact</th><th class="c">Stalls</th><th class="c">RV</th>
                <th>Supplies / Pre-Orders</th><th>Horses</th><th>Status</th><th class="c">Amount</th>
            </tr></thead><tbody>${rowsHtml}</tbody></table>
            </body></html>`;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
    };

    return (
        <div className="space-y-3">
            {/* Summary bar — everything a producer needs at a glance without opening
                Excel. Reflects the current search/filters, same as the table below. */}
            {rows.length > 0 && (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {[
                            { label: 'Total Bookings', value: filtered.length },
                            { label: 'Total Exhibitors', value: exhibitorCount },
                            { label: 'Total Horses', value: totals.horses },
                            {
                                label: 'Total Stalls',
                                value: totals.stalls,
                                sub: totals.extraStalls > 0 ? `+${totals.extraStalls} extra` : null,
                            },
                            {
                                label: 'RV Spots',
                                value: totals.rv,
                                sub: totals.rv > 0 ? `${totals.rvAssigned} assigned` : null,
                            },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-lg border bg-card px-3 py-2">
                                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                                <p className="text-lg font-semibold leading-tight">{stat.value}</p>
                                {stat.sub && <p className="text-[10px] text-muted-foreground">{stat.sub}</p>}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {supplyBreakdown.length > 0 && (
                            <div className="rounded-lg border bg-card px-3 py-2 flex-1 min-w-[220px]">
                                <p className="text-[11px] text-muted-foreground mb-1">Supplies</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                                    {supplyBreakdown.map(([name, qty]) => (
                                        <span key={name}>{name}: <span className="font-semibold">{qty}</span></span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="rounded-lg border bg-card px-3 py-2 flex-1 min-w-[280px]">
                            <p className="text-[11px] text-muted-foreground mb-1">Revenue Summary</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                                <span>Total: <span className="font-semibold">{fmtMoney(totals.amount)}</span></span>
                                <span>Paid: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtMoney(totals.paidAmount)}</span></span>
                                <span>Balance Due: <span className="font-semibold text-amber-600">{fmtMoney(Math.max(0, totals.amount - totals.paidAmount))}</span></span>
                            </div>
                        </div>
                        <div className="rounded-lg border bg-card px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Show Receives (95%)</p>
                            <p className="text-lg font-semibold leading-tight text-emerald-700 dark:text-emerald-400">{fmtMoney(totals.clubAmount)}</p>
                        </div>
                        <div className="rounded-lg border bg-card px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Platform Fee (5%)</p>
                            <p className="text-lg font-semibold leading-tight">{fmtMoney(totals.platformFee)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, trainer, stall..." className="h-8 pl-8 text-sm" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                        <SelectItem value="paid" className="text-xs">Paid</SelectItem>
                        <SelectItem value="confirmed" className="text-xs">Confirmed</SelectItem>
                        <SelectItem value="checked_in" className="text-xs">Checked in</SelectItem>
                        <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={assignFilter} onValueChange={setAssignFilter}>
                    <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Assignment" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All assignment</SelectItem>
                        <SelectItem value="assigned" className="text-xs">Fully assigned</SelectItem>
                        <SelectItem value="partial" className="text-xs">Partly assigned</SelectItem>
                        <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={supplyFilter} onValueChange={setSupplyFilter}>
                    <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Supply status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs">All supplies</SelectItem>
                        <SelectItem value="none" className="text-xs">No supplies</SelectItem>
                        {SUPPLY_STAGES.map(s => (
                            <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportExcel} disabled={filtered.length === 0}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={printList} disabled={filtered.length === 0}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                </Button>
                {addBookingSlot}
            </div>

            {rows.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No bookings yet. They appear here as soon as exhibitors book, or click "Add Booking" above to enter one yourself.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                {COLUMNS.map(col => (
                                    <th key={col.key}
                                        className={cn('px-3 py-2 font-medium select-none cursor-pointer',
                                            col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left')}
                                        onClick={() => toggleSort(col.key)}>
                                        <span className={cn('inline-flex items-center gap-1',
                                            col.align === 'center' ? 'justify-center' : col.align === 'right' && 'justify-end')}>
                                            {col.label} <SortIcon colKey={col.key} />
                                        </span>
                                    </th>
                                ))}
                                <th className="px-3 py-2 font-medium text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => (
                                <MasterListRow
                                    key={r.booking.id}
                                    r={r}
                                    isOpen={expandedIds.has(r.booking.id)}
                                    onToggleExpand={() => toggleExpanded(r.booking.id)}
                                    onUpdateField={onUpdateField}
                                    onStatusChange={onStatusChange}
                                    onRemove={onRemove}
                                    onDownloadInvoice={onDownloadInvoice}
                                    onEmailInvoice={onEmailInvoice}
                                    invoicingId={invoicingId}
                                    onLogActivity={onLogActivity}
                                />
                            ))}
                        </tbody>
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr className="border-t bg-muted/30 font-medium">
                                    <td className="px-3 py-2" colSpan={2}>{filtered.length} bookings</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.stalls}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.assigned}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.rv}</td>
                                    <td className="px-3 py-2 tabular-nums">{totals.supplies ? `${totals.supplies} items` : ''}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{totals.horses}</td>
                                    <td className="px-3 py-2" />
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.amount)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.paidAmount)}</td>
                                    <td className="px-3 py-2" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground px-1">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">Status:</span>
                        {Object.entries(STATUS_STYLES).map(([key, style]) => (
                            <Badge key={key} className={cn('text-[10px] capitalize', style)}>{key.replace('_', ' ')}</Badge>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">Payment:</span>
                        <Badge className="text-[10px] bg-rose-500/15 text-rose-700 dark:text-rose-300">Unpaid</Badge>
                        <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">Partial</Badge>
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Paid</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">Supply:</span>
                        {SUPPLY_STAGES.map(s => (
                            <Badge key={s.key} className={cn(s.color, 'text-white text-[10px]')}>{s.label}</Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterListPanel;
