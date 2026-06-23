import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Loader2, Home, Hash, Calendar, FolderOpen,
    MapPin, Plus, Trash2, Save, Check, X, Search, Users, DollarSign,
    Building2, Warehouse, Car, ShoppingCart, Edit2, AlertCircle, Wand2, Moon,
    Beef, PawPrint, Copy, ExternalLink, Link as LinkIcon,
    ScanLine, FileText, ImagePlus, Lock, Globe, Pencil,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { stampModuleStatusOnSave, migrateLegacyStatus } from '@/lib/moduleStatusService';
import { useToast } from '@/components/ui/use-toast';
import SmartAssignDialog from '@/components/housing/SmartAssignDialog';
import ManageStallsDialog from '@/components/housing/ManageStallsDialog';
import ConflictAlertsPanel from '@/components/housing/ConflictAlertsPanel';
import AnalyticsCharts from '@/components/housing/AnalyticsCharts';
import { getRequestedStallCount, getAssignedStallsForBooking, planAutoAssign, applyPlanToBarns } from '@/lib/stallAssignment';
import { downloadInvoicePdf } from '@/lib/invoiceGenerator';

// ── Constants ──

const STALL_TYPES = [
    { id: 'standard', name: 'Standard Horse Stall', icon: Home, defaultPrice: 75, defaultSize: '10x10' },
    { id: 'premium', name: 'Premium Horse Stall', icon: Home, defaultPrice: 125, defaultSize: '12x12' },
    { id: 'grooming', name: 'Grooming Stall', icon: Home, defaultPrice: 50, defaultSize: '10x10' },
    { id: 'tack', name: 'Tack Stall', icon: Warehouse, defaultPrice: 60, defaultSize: '10x10' },
    { id: 'cattle_pen', name: 'Cattle Pen', icon: Beef, defaultPrice: 65, defaultSize: '12x16' },
    { id: 'sheep_goat_pen', name: 'Sheep / Goat Pen', icon: PawPrint, defaultPrice: 45, defaultSize: '8x10' },
];

const RV_HOOKUP_TYPES = [
    { id: 'full', name: 'Full Hookup (water + electric + sewer)' },
    { id: 'partial', name: 'Partial (water + electric)' },
    { id: 'electric_only', name: 'Electric Only' },
    { id: 'dry_camping', name: 'Dry Camping (no hookups)' },
    { id: 'day_parking', name: 'Day Parking' },
];

const RV_POWER_TYPES = [
    { id: '50amp', name: '50 Amp' },
    { id: '30amp', name: '30 Amp' },
    { id: '35amp', name: '35 Amp' },
    { id: '25amp', name: '25 Amp' },
    { id: 'none', name: 'No Power' },
];

const RV_PRICING_MODELS = [
    { id: 'nightly', name: 'Per Night' },
    { id: 'flat', name: 'Flat Rate (entire stay)' },
];

const SUPPLY_PRESETS = [
    { name: 'Hay (Grass)', unit: 'bale', defaultPrice: 15 },
    { name: 'Hay (Alfalfa)', unit: 'bale', defaultPrice: 20 },
    { name: 'Hay (Mixed)', unit: 'bale', defaultPrice: 18 },
    { name: 'Shavings', unit: 'bag', defaultPrice: 12 },
    { name: 'Stall Mat Rental', unit: 'per stall', defaultPrice: 25 },
    // Pre-bedding: shavings delivered to the stalls before the show and paid up
    // front (not bought at the show), so it defaults to per-stall + pre-entry.
    { name: 'Pre-Bedding (Shavings)', unit: 'per stall', defaultPrice: 25, preBedding: true },
];

// Fee-detail options — kept in sync with FeeStructureStep so the questions
// (Unit Type, Payment Timing) look and read identically on both pages.
const FEE_UNIT_TYPE_OPTIONS = [
    { value: 'flat', label: 'Flat Fee' },
    { value: 'per_horse', label: 'Per Horse' },
    { value: 'per_night', label: 'Per Night' },
    { value: 'per_stall', label: 'Per Stall' },
    { value: 'per_bag', label: 'Per Bag' },
    { value: 'custom', label: 'Custom Unit' },
];

const FEE_TIMING_OPTIONS = [
    { value: 'pre_entry', label: 'Pre-Entry / Reservation' },
    { value: 'at_check_in', label: 'At Check-In' },
    { value: 'settlement', label: 'Post-Show / Settlement' },
];

// Shared fee-detail block (Unit Type, Payment Timing, Due Date, Late Fee) so every
// inventory card asks the same questions as the Fee Structure page.
const FeeDetailsFields = ({ item, onUpdate, unitDefault = 'per_night', showHeader = true, leading = null, unitOptions = null }) => (
    <div className={showHeader ? 'border-t pt-3' : ''}>
        {showHeader && (
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600">
                <DollarSign className="h-3.5 w-3.5" /> Fee Details (matches Fee Structure)
            </Label>
        )}
        <div className={cn('grid grid-cols-2 gap-3', showHeader && 'mt-2', leading ? 'md:grid-cols-5' : 'md:grid-cols-4')}>
            {leading}
            <div className="space-y-1">
                <Label className="text-xs">Unit Type</Label>
                <Select value={item.unitType || unitDefault} onValueChange={(val) => onUpdate('unitType', val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {FEE_UNIT_TYPE_OPTIONS.filter(o => (unitOptions || ['flat', 'per_night', 'custom']).includes(o.value) || o.value === (item.unitType || unitDefault)).map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Payment Timing</Label>
                <Select value={item.paymentTiming || 'pre_entry'} onValueChange={(val) => onUpdate('paymentTiming', val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {FEE_TIMING_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                    type="date"
                    value={item.dueDate || ''}
                    onChange={(e) => onUpdate('dueDate', e.target.value)}
                    className="h-8 text-xs"
                />
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Late Fee ($)</Label>
                <Input
                    type="number"
                    min={0}
                    value={item.lateFee || ''}
                    onChange={(e) => onUpdate('lateFee', parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs"
                    placeholder="$0"
                />
            </div>
        </div>
    </div>
);

const BOOKING_STATUSES = ['confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out'];
const STATUS_COLORS = {
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    checked_in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    checked_out: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

// Lifecycle of a housing setup:
//   draft     → organizer is still building it out (adding barns, fees, layouts)
//   locked    → frozen; inventory & fees can't be edited (holds the setup)
//   published → live; stalls & camping spots can be sold through it
const PUBLISH_STATUSES = [
    { id: 'draft', label: 'Draft', icon: Pencil, hint: 'Still building — add barns, spots & fees.', active: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
    { id: 'locked', label: 'Locked', icon: Lock, hint: 'Frozen — inventory & fees are read-only.', active: 'bg-slate-600 text-white', dot: 'bg-slate-500' },
    { id: 'published', label: 'Published', icon: Globe, hint: 'Live — stalls & camping spots can be sold.', active: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' },
];

// ── Helpers ──

function getShowNights(pd) {
    if (!pd?.startDate) return 0;
    const start = new Date(pd.startDate);
    const end = pd.endDate ? new Date(pd.endDate) : start;
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 1); // At least 1 night
}

// ── Booking Link Card (Public URL share) ──

const BookingLinkCard = ({ show }) => {
    const { toast } = useToast();
    const stalling = show?.project_data?.stallingService || {};
    const inventoryCount =
        (stalling.barns?.length || 0) +
        (stalling.rvAreas?.length || 0) +
        (stalling.supportSpaces?.length || 0) +
        (stalling.supplies?.length || 0);
    const publicUrl = `${window.location.origin}/show/${show.id}/book`;
    const showPageUrl = `${window.location.origin}/show/${show.id}`;

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            toast({ title: 'Link copied!', description: 'Share this URL with your exhibitors.' });
        } catch {
            toast({ title: 'Copy failed', description: 'Please copy the link manually.', variant: 'destructive' });
        }
    };

    if (inventoryCount === 0) {
        return (
            <Card className="mb-6 border-dashed">
                <CardContent className="py-4 text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Add barns, RV areas, or supplies below — then your exhibitors can reserve online.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mb-6 border-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <LinkIcon className="h-4 w-4 text-primary" /> Public Booking Link
                </CardTitle>
                <CardDescription className="text-xs">
                    Share this URL on your website, social media, or email so exhibitors can book online and pay with Stripe.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                    <Input readOnly value={publicUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                    <Button type="button" variant="default" size="sm" onClick={copyLink}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => window.open(publicUrl, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                    </Button>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground border-t pt-3">
                    <div className="flex items-center gap-2">
                        <span>Show details page:</span>
                        <a href={showPageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
                            {showPageUrl}
                        </a>
                    </div>
                    <a
                        href={`/horse-show-manager/check-in/${show.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition text-xs font-semibold flex-shrink-0"
                        title="Open check-in kiosk in new tab (great for tablets at the show entrance)"
                    >
                        <ScanLine className="h-3.5 w-3.5" /> Open Check-In Kiosk
                    </a>
                </div>
            </CardContent>
        </Card>
    );
};

// Stall-number prefix from a barn name: "Barn A" → "A", "West Barn" → "W",
// otherwise the first letter. Keeps labels intuitive (Barn A → A1, A2…).
const stallPrefix = (name) => {
    const m = (name || '').match(/^barn\s+(\w)/i);
    if (m) return m[1].toUpperCase();
    return (name || 'S').charAt(0).toUpperCase();
};

// Number the physical stalls (stall + blocked) continuously — A1, A2, A3… —
// skipping rooms/aisles/empty so stall numbers have no gaps.
const renumberStalls = (arr, prefix) => {
    let n = 0;
    return arr.map(s => {
        const type = s.type || 'stall';
        if (type === 'stall' || type === 'blocked') {
            n += 1;
            return { ...s, number: `${prefix}${n}` };
        }
        return { ...s, number: '' };
    });
};

// ── Stall Map (visual seating-chart style grid) ──

// Cell types so a barn diagram can match a real floor plan (not just stalls).
const CELL_TYPES = [
    { id: 'stall', label: 'Stall', cls: 'bg-background text-foreground/70 border-muted-foreground/40' },
    { id: 'office', label: 'Office', cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200' },
    { id: 'feed', label: 'Feed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200' },
    { id: 'wash', label: 'Wash', cls: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200' },
    { id: 'tack', label: 'Tack', cls: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-200' },
    { id: 'blocked', label: 'Blocked', cls: 'bg-muted text-muted-foreground/60 border-muted-foreground/40 line-through' },
    { id: 'aisle', label: 'Aisle', cls: 'bg-muted text-muted-foreground/50 border-dashed border-muted-foreground/30' },
    { id: 'empty', label: 'Empty', cls: 'bg-transparent border-dashed border-muted-foreground/20 text-transparent' },
];
const CELL_TYPE_MAP = Object.fromEntries(CELL_TYPES.map(t => [t.id, t]));
const ROOM_TYPES = new Set(['office', 'feed', 'wash', 'tack']);

// Barn diagram: boxes in rows × columns — the visual barn itself (like a floor
// plan / airplane seat map). Each box has a type (stall, office, feed, wash, tack,
// aisle, empty). When onCellClick is given, clicking a box paints its type.
const StallMap = ({ stalls, cols, centerAisle = false, onCellClick = null, aisleCols = [], aisleRows = [], onToggleAisleCol = null, onToggleAisleRow = null }) => {
    // Drag-to-paint: hold the pointer down and sweep across boxes to paint many.
    const paintingRef = React.useRef(false);
    React.useEffect(() => {
        const stop = () => { paintingRef.current = false; };
        window.addEventListener('pointerup', stop);
        return () => window.removeEventListener('pointerup', stop);
    }, []);

    if (!stalls || stalls.length === 0) {
        return (
            <p className="text-xs text-muted-foreground italic">
                Set Rows and Columns above to build the barn layout.
            </p>
        );
    }
    const c = Math.max(1, cols || 1);
    const rowCount = Math.ceil(stalls.length / c);
    const leftCount = centerAisle ? Math.ceil(c / 2) : c;
    const rows = Array.from({ length: rowCount }, (_, r) => stalls.slice(r * c, r * c + c));

    // Aisle gaps are thin walkways drawn BETWEEN columns/rows — they don't consume
    // a stall box, so the stall count is unaffected. `editing` shows faint clickable
    // strips; view mode only renders a gap where an aisle actually exists.
    const editing = !!onCellClick;
    const colGap = (index) => {
        const active = (aisleCols || []).includes(index);
        if (!editing && !active) return null;
        return (
            <div
                key={`cg-${index}`}
                onClick={editing && onToggleAisleCol ? () => onToggleAisleCol(index) : undefined}
                title={active ? 'Aisle — click to remove' : 'Click to add an aisle here'}
                className={cn(
                    'self-stretch flex-shrink-0 rounded-sm transition-colors',
                    editing ? 'w-2.5 cursor-pointer' : 'w-2',
                    active ? 'bg-orange-400 dark:bg-orange-500' : 'bg-muted-foreground/5 hover:bg-orange-300/50'
                )}
            />
        );
    };
    const rowGap = (index) => {
        const active = (aisleRows || []).includes(index);
        if (!editing && !active) return null;
        return (
            <div
                key={`rg-${index}`}
                onClick={editing && onToggleAisleRow ? () => onToggleAisleRow(index) : undefined}
                title={active ? 'Aisle — click to remove' : 'Click to add an aisle here'}
                className={cn(
                    'w-full rounded-sm transition-colors',
                    editing ? 'h-2.5 cursor-pointer' : 'h-2',
                    active ? 'bg-orange-400 dark:bg-orange-500' : 'bg-muted-foreground/5 hover:bg-orange-300/50'
                )}
            />
        );
    };

    return (
        <div className="space-y-2">
            <div className="overflow-x-auto">
                <div className="inline-flex flex-col gap-1.5 rounded-md border bg-background/60 p-3">
                    {rows.map((rowStalls, ri) => (
                        <React.Fragment key={ri}>
                            {ri > 0 && rowGap(ri)}
                            <div className="flex items-stretch gap-1.5">
                                {rowStalls.map((stall, ci) => {
                                    const type = stall.type || 'stall';
                                    const isStall = type === 'stall';
                                    const isPhysical = isStall || type === 'blocked';
                                    const isBooked = isStall && !!stall.bookingId;
                                    const typeInfo = CELL_TYPE_MAP[type] || CELL_TYPE_MAP.stall;
                                    const label = isPhysical ? stall.number : (ROOM_TYPES.has(type) ? typeInfo.label : '');
                                    const showCenter = centerAisle && ci === leftCount;
                                    return (
                                        <React.Fragment key={stall.id}>
                                            {ci > 0 && !showCenter && colGap(ci)}
                                            {showCenter && (
                                                <div className="w-8 flex items-center justify-center">
                                                    <span className="text-[8px] uppercase tracking-widest text-muted-foreground/60">aisle</span>
                                                </div>
                                            )}
                                            <div
                                                onPointerDown={onCellClick ? (e) => { e.preventDefault(); paintingRef.current = true; onCellClick(stall.id); } : undefined}
                                                onPointerEnter={onCellClick ? () => { if (paintingRef.current) onCellClick(stall.id); } : undefined}
                                                title={isStall ? `${stall.number}${isBooked ? ' · booked' : ' · available'}` : (type === 'blocked' ? `${stall.number} · blocked` : typeInfo.label)}
                                                className={cn(
                                                    'flex items-center justify-center rounded-md border text-[9px] font-mono font-semibold h-9 w-12 select-none',
                                                    onCellClick && 'cursor-pointer hover:ring-2 hover:ring-primary/40',
                                                    isBooked ? 'bg-blue-600 text-white border-blue-700' : typeInfo.cls
                                                )}
                                            >
                                                {label}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-blue-600 border border-blue-700" /> Booked</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-muted-foreground/40 bg-background" /> Stall</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-amber-300 bg-amber-100" /> Office</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-100" /> Feed</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-sky-300 bg-sky-100" /> Wash</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-purple-300 bg-purple-100" /> Tack</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-orange-400" /> Aisle</span>
            </div>
        </div>
    );
};

// ── Barn/Area Card ──

const BarnCard = ({ barn, onUpdate, onRemove, onDuplicate, showId }) => {
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [paintType, setPaintType] = useState('stall');
    const [expanded, setExpanded] = useState(true);
    const [showLayout, setShowLayout] = useState(false);
    const totalStalls = (barn.stalls || []).filter(s => (s.type || 'stall') === 'stall').length;
    const booked = (barn.stalls || []).filter(s => s.bookingId && (s.type || 'stall') === 'stall').length;
    const typeInfo = STALL_TYPES.find(t => t.id === barn.stallType) || STALL_TYPES[0];
    const TypeIcon = typeInfo.icon;

    // Rows × Columns layout. For older barns with only a count, derive sensible
    // defaults so the grid shows something until the organizer adjusts it.
    const cols = barn.layoutCols ?? (barn.stallCount ? Math.min(barn.stallCount, 10) : 10);
    const rows = barn.layoutRows ?? (cols ? Math.ceil((barn.stallCount || 0) / cols) : 1);

    // Rebuild the stall boxes for a rows × columns grid, keeping existing bookings
    // (matched by position) so assignments aren't lost when the layout changes.
    const regenerateGrid = (nextRows, nextCols) => {
        const r = Math.max(0, parseInt(nextRows) || 0);
        const c = Math.max(0, parseInt(nextCols) || 0);
        const count = r * c;
        const existing = barn.stalls || [];
        const letter = stallPrefix(barn.name);
        const built = Array.from({ length: count }, (_, i) => ({
            id: existing[i]?.id || uuidv4(),
            bookingId: existing[i]?.bookingId || null,
            type: existing[i]?.type || 'stall',
        }));
        const newStalls = renumberStalls(built, letter);
        onUpdate('layoutRows', r);
        onUpdate('layoutCols', c);
        onUpdate('stallCount', newStalls.filter(s => (s.type || 'stall') === 'stall').length);
        onUpdate('stalls', newStalls);
        // Drop aisle lines that fall outside the new grid bounds.
        const prunedCols = (barn.aisleCols || []).filter(i => i >= 1 && i < c);
        const prunedRows = (barn.aisleRows || []).filter(i => i >= 1 && i < r);
        if (prunedCols.length !== (barn.aisleCols || []).length) onUpdate('aisleCols', prunedCols);
        if (prunedRows.length !== (barn.aisleRows || []).length) onUpdate('aisleRows', prunedRows);
    };

    // Paint a box's type, then renumber so stall numbers stay continuous and the
    // stall count reflects only the boxes that are actually stalls.
    const paintCell = (cellId) => {
        const updated = (barn.stalls || []).map(s => {
            if (s.id !== cellId) return s;
            const next = { ...s, type: paintType };
            if (paintType !== 'stall') next.bookingId = null; // rooms/blocked can't hold a booking
            return next;
        });
        const newStalls = renumberStalls(updated, stallPrefix(barn.name));
        onUpdate('stalls', newStalls);
        onUpdate('stallCount', newStalls.filter(s => (s.type || 'stall') === 'stall').length);
    };

    // Aisle walkways drawn between columns/rows — toggling never touches stalls.
    const toggleAisle = (field, index) => {
        const cur = barn[field] || [];
        const next = cur.includes(index) ? cur.filter(i => i !== index) : [...cur, index].sort((a, b) => a - b);
        onUpdate(field, next);
    };

    // Barn floor-plan image — stored in the show_logos bucket, URL saved on the barn.
    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!showId) {
            toast({ title: 'Save the show first', description: 'A show is needed before uploading images.', variant: 'destructive' });
            return;
        }
        setUploadingImage(true);
        try {
            const ext = file.name.split('.').pop();
            const filePath = `${showId}/barn_${barn.id}_${uuidv4()}.${ext}`;
            if (barn.layoutImageUrl) {
                const oldPath = barn.layoutImageUrl.split('/show_logos/').pop();
                if (oldPath) await supabase.storage.from('show_logos').remove([oldPath]);
            }
            const { error } = await supabase.storage.from('show_logos').upload(filePath, file, { cacheControl: '3600', upsert: false });
            if (error) throw error;
            const { data } = supabase.storage.from('show_logos').getPublicUrl(filePath);
            onUpdate('layoutImageUrl', data.publicUrl);
            toast({ title: 'Image uploaded', description: 'Remember to click Save All.' });
        } catch (err) {
            toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = async () => {
        if (barn.layoutImageUrl) {
            const oldPath = barn.layoutImageUrl.split('/show_logos/').pop();
            if (oldPath) await supabase.storage.from('show_logos').remove([oldPath]);
        }
        onUpdate('layoutImageUrl', '');
    };


    return (
        <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <TypeIcon className="h-4 w-4 text-primary" />
                        <Input
                            value={barn.name}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            className="h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 max-w-xs"
                            placeholder="Barn/Area name..."
                        />
                        <Badge variant="outline" className="text-xs">
                            {totalStalls} unit{totalStalls !== 1 ? 's' : ''} ({booked} booked)
                        </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate this barn" onClick={onDuplicate}>
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onRemove}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Housing Type</Label>
                            <Select value={barn.stallType || 'standard'} onValueChange={(val) => onUpdate('stallType', val)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STALL_TYPES.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs"># of Stalls</Label>
                            <Input
                                type="number"
                                value={barn.stallCount || 0}
                                readOnly
                                disabled
                                title="Set by Rows × Columns in Barn Layout below"
                                className="h-8 text-xs bg-muted/50"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Size</Label>
                            <Input
                                value={barn.stallSize || ''}
                                onChange={(e) => onUpdate('stallSize', e.target.value)}
                                className="h-8 text-xs"
                                placeholder="e.g., 10x10"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Notes / Amenities</Label>
                        <Textarea
                            value={barn.notes || ''}
                            onChange={(e) => onUpdate('notes', e.target.value)}
                            className="text-xs min-h-[50px]"
                            placeholder="Water, electricity, fans, etc."
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={barn.hasElectricity || false}
                                onCheckedChange={(checked) => onUpdate('hasElectricity', checked)}
                            />
                            <Label className="text-xs">Electricity</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={barn.hasWater || false}
                                onCheckedChange={(checked) => onUpdate('hasWater', checked)}
                            />
                            <Label className="text-xs">Water</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={barn.hasFans || false}
                                onCheckedChange={(checked) => onUpdate('hasFans', checked)}
                            />
                            <Label className="text-xs">Fans</Label>
                        </div>
                    </div>

                    {/* Barn Layout — design the barn as a Rows × Columns grid of stalls */}
                    <div className="border-t pt-3">
                        <button
                            type="button"
                            onClick={() => setShowLayout(o => !o)}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                            {showLayout ? '▾' : '▸'} Barn Layout ({booked}/{totalStalls} booked)
                        </button>
                        {showLayout && (
                            <div className="mt-3 space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
                                {/* Build the barn: Rows × Columns (+ optional center aisle) */}
                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Rows</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={rows}
                                            onChange={(e) => regenerateGrid(e.target.value, cols)}
                                            className="h-8 text-xs w-20"
                                        />
                                    </div>
                                    <span className="pb-2 text-muted-foreground">×</span>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Columns</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={cols}
                                            onChange={(e) => regenerateGrid(rows, e.target.value)}
                                            className="h-8 text-xs w-20"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pb-2">
                                        <Checkbox
                                            id={`aisle-${barn.id}`}
                                            checked={barn.centerAisle || false}
                                            onCheckedChange={(checked) => onUpdate('centerAisle', !!checked)}
                                        />
                                        <Label htmlFor={`aisle-${barn.id}`} className="text-xs cursor-pointer">Center aisle</Label>
                                    </div>
                                    <div className="pb-2 text-xs font-semibold text-primary">
                                        = {(barn.stalls || []).filter(s => (s.type || 'stall') === 'stall').length} stalls
                                        <span className="text-muted-foreground font-normal"> of {rows * cols} boxes</span>
                                    </div>
                                </div>

                                {/* Paint palette — pick a type, then click boxes to set them */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground mr-1">Click a box to set it as:</span>
                                    {CELL_TYPES.map(t => (
                                        <Button
                                            key={t.id}
                                            type="button"
                                            variant={paintType === t.id ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => setPaintType(t.id)}
                                        >
                                            {t.label}
                                        </Button>
                                    ))}
                                </div>

                                <p className="text-[11px] text-muted-foreground">
                                    Tip: click a <span className="font-medium text-orange-500">thin gap between boxes</span> to draw an aisle — stalls aren't removed.
                                </p>

                                {/* The barn diagram (boxes = the barn) — click to paint types */}
                                <StallMap
                                    stalls={barn.stalls}
                                    cols={cols}
                                    centerAisle={barn.centerAisle}
                                    onCellClick={paintCell}
                                    aisleCols={barn.aisleCols || []}
                                    aisleRows={barn.aisleRows || []}
                                    onToggleAisleCol={(i) => toggleAisle('aisleCols', i)}
                                    onToggleAisleRow={(i) => toggleAisle('aisleRows', i)}
                                />

                                {/* Optional reference image — a separate picture to copy the layout from */}
                                <div className="border-t pt-3 space-y-2">
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs text-muted-foreground">Reference image (optional)</Label>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                                            {uploadingImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImagePlus className="h-3 w-3 mr-1" />}
                                            {barn.layoutImageUrl ? 'Replace' : 'Upload'}
                                        </Button>
                                        {barn.layoutImageUrl && (
                                            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={handleRemoveImage} disabled={uploadingImage}>
                                                <Trash2 className="h-3 w-3 mr-1" /> Remove
                                            </Button>
                                        )}
                                    </div>
                                    {barn.layoutImageUrl && (
                                        <button type="button" onClick={() => window.open(barn.layoutImageUrl, '_blank')} title="Click to view full size">
                                            <img
                                                src={barn.layoutImageUrl}
                                                alt="Barn reference"
                                                className="max-h-32 rounded-md border bg-background hover:opacity-90 transition"
                                            />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

// ── RV Area Card ──

const RvAreaCard = ({ rvArea, onUpdate, onRemove }) => {
    const [expanded, setExpanded] = useState(true);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const pricingModel = rvArea.pricingModel || 'nightly';

    return (
        <Card className={cn('border-l-4 border-l-cyan-500', rvArea.isOverflow && 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10')}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <Car className={cn('h-4 w-4', rvArea.isOverflow ? 'text-amber-600' : 'text-cyan-600')} />
                        <Input
                            value={rvArea.name}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            className="h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 max-w-xs"
                            placeholder="RV area name..."
                        />
                        <Badge variant="outline" className="text-xs">
                            {rvArea.spotCount || 0} spots
                        </Badge>
                        {rvArea.isOverflow && (
                            <Badge className="text-xs bg-amber-500 text-white">Overflow</Badge>
                        )}
                        {rvArea.maxLength > 0 && (
                            <Badge variant="outline" className="text-xs">Max {rvArea.maxLength}ft</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onRemove}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs"># of Camping Spots</Label>
                            <Input
                                type="number"
                                min={0}
                                value={rvArea.spotCount || 0}
                                onChange={(e) => onUpdate('spotCount', parseInt(e.target.value) || 0)}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">
                                {pricingModel === 'flat' ? 'Flat Rate ($)' : 'Price / Night ($)'}
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                value={pricingModel === 'flat' ? (rvArea.flatRate || '') : (rvArea.pricePerNight || '')}
                                onChange={(e) => onUpdate(
                                    pricingModel === 'flat' ? 'flatRate' : 'pricePerNight',
                                    parseFloat(e.target.value) || 0
                                )}
                                className="h-8 text-xs"
                                placeholder="$0"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Hookup Type</Label>
                            <Select value={rvArea.hookupType || 'full'} onValueChange={(val) => onUpdate('hookupType', val)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RV_HOOKUP_TYPES.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Power Type</Label>
                            <Select value={rvArea.powerType || '50amp'} onValueChange={(val) => onUpdate('powerType', val)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RV_POWER_TYPES.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                            value={rvArea.notes || ''}
                            onChange={(e) => onUpdate('notes', e.target.value)}
                            className="text-xs min-h-[50px]"
                            placeholder="Water hookups, dump station, etc."
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={rvArea.hasWater || false}
                                onCheckedChange={(checked) => onUpdate('hasWater', checked)}
                            />
                            <Label className="text-xs">Water</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={rvArea.hasSewer || false}
                                onCheckedChange={(checked) => onUpdate('hasSewer', checked)}
                            />
                            <Label className="text-xs">Sewer</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={rvArea.hasWifi || false}
                                onCheckedChange={(checked) => onUpdate('hasWifi', checked)}
                            />
                            <Label className="text-xs">Wi-Fi</Label>
                        </div>
                    </div>

                    {/* Fee details — same questions as the Fee Structure page */}
                    <FeeDetailsFields item={rvArea} onUpdate={onUpdate} unitDefault="per_night" unitOptions={['flat', 'per_night', 'custom']} />

                    {/* Advanced settings */}
                    <div className="border-t pt-3">
                        <button
                            type="button"
                            onClick={() => setAdvancedOpen(o => !o)}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                            {advancedOpen ? '▾' : '▸'} Advanced (pricing model, length limit, fees, overflow)
                        </button>
                        {advancedOpen && (
                            <div className="mt-3 space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Pricing Model</Label>
                                        <Select value={pricingModel} onValueChange={(val) => onUpdate('pricingModel', val)}>
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RV_PRICING_MODELS.map(m => (
                                                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Max RV Length (ft)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={rvArea.maxLength || ''}
                                            onChange={(e) => onUpdate('maxLength', parseInt(e.target.value) || 0)}
                                            className="h-8 text-xs"
                                            placeholder="0 = no limit"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Early Arrival Fee / Day ($)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={rvArea.earlyArrivalFeePerDay || ''}
                                            onChange={(e) => onUpdate('earlyArrivalFeePerDay', parseFloat(e.target.value) || 0)}
                                            className="h-8 text-xs"
                                            placeholder="$0"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Late Departure Fee / Day ($)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={rvArea.lateDepartureFeePerDay || ''}
                                            onChange={(e) => onUpdate('lateDepartureFeePerDay', parseFloat(e.target.value) || 0)}
                                            className="h-8 text-xs"
                                            placeholder="$0"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <Checkbox
                                        checked={rvArea.isOverflow || false}
                                        onCheckedChange={(checked) => onUpdate('isOverflow', checked)}
                                    />
                                    <Label className="text-xs">
                                        Overflow lot — only used when primary RV areas are full
                                    </Label>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

// ── Supply Item Card ──

const SupplyItemCard = ({ item, onUpdate, onRemove }) => {
    return (
        <div className="p-3 border rounded-lg bg-background border-l-4 border-l-amber-500 space-y-3">
            <div className="flex items-center gap-3">
                <ShoppingCart className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <Input
                    value={item.name}
                    onChange={(e) => onUpdate('name', e.target.value)}
                    className="h-8 text-sm font-medium border-none shadow-none px-0 focus-visible:ring-0 flex-1 min-w-0"
                    placeholder="Supply name..."
                />
                {item.preBedding && (
                    <Badge className="bg-amber-600 text-white text-[10px] flex-shrink-0">Pre-Bed</Badge>
                )}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="space-y-0">
                        <Input
                            type="number"
                            min={0}
                            value={item.price || ''}
                            onChange={(e) => onUpdate('price', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs w-20"
                            placeholder="$ Price"
                        />
                    </div>
                    <div className="space-y-0">
                        <Input
                            value={item.unit || ''}
                            onChange={(e) => onUpdate('unit', e.target.value)}
                            className="h-8 text-xs w-24"
                            placeholder="per unit"
                        />
                    </div>
                    <div className="space-y-0">
                        <Input
                            type="number"
                            min={0}
                            value={item.stockQty || ''}
                            onChange={(e) => onUpdate('stockQty', parseInt(e.target.value) || 0)}
                            className="h-8 text-xs w-20"
                            placeholder="Stock"
                        />
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onRemove}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Fee details — same questions as the Fee Structure page */}
            <FeeDetailsFields item={item} onUpdate={onUpdate} unitDefault="per_bag" unitOptions={['flat', 'per_bag', 'per_night', 'custom']} />

            {/* Pre-bedding — shavings delivered to the stalls before the show, paid up front */}
            <div className="flex items-center gap-2 border-t pt-2">
                <Checkbox
                    id={`prebed-${item.id}`}
                    checked={item.preBedding || false}
                    onCheckedChange={(checked) => {
                        onUpdate('preBedding', !!checked);
                        // Pre-bed is ordered ahead of the show — nudge the fee defaults to match.
                        if (checked) {
                            onUpdate('unitType', 'per_stall');
                            onUpdate('paymentTiming', 'pre_entry');
                        }
                    }}
                />
                <Label htmlFor={`prebed-${item.id}`} className="text-xs font-normal cursor-pointer">
                    Pre-bedding — delivered to stalls before the show (paid in advance, not sold at the show)
                </Label>
            </div>
        </div>
    );
};

// ── Booking Row ──

const BookingRow = ({ booking, barns, onUpdate, onRemove, onManageStalls, onStatusChange }) => {
    const stallOptions = useMemo(() => {
        const options = [];
        for (const barn of barns) {
            for (const stall of (barn.stalls || [])) {
                if ((stall.type || 'stall') !== 'stall') continue; // skip office/feed/wash/etc.
                options.push({ id: stall.id, label: `${barn.name} - ${stall.number}`, barnId: barn.id });
            }
        }
        return options;
    }, [barns]);

    const requestedStalls = getRequestedStallCount(booking);
    const assignedStalls = useMemo(() => getAssignedStallsForBooking(booking, barns), [booking, barns]);
    const isMultiStall = (booking.items || []).some(it => it.type === 'stall' && (it.qty || 0) > 1) || requestedStalls > 1;

    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-background border text-sm">
            <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2">
                <Input
                    value={booking.exhibitorName || ''}
                    onChange={(e) => onUpdate('exhibitorName', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Exhibitor name"
                />
                <Input
                    value={booking.horseName || ''}
                    onChange={(e) => onUpdate('horseName', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Horse name"
                />
                <Input
                    value={booking.trainerName || ''}
                    onChange={(e) => onUpdate('trainerName', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Trainer"
                />
                {isMultiStall || (booking.items || []).length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap min-h-[28px]">
                        {assignedStalls.length === 0 && requestedStalls > 0 && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">unassigned</Badge>
                        )}
                        {assignedStalls.slice(0, 6).map(s => (
                            <Badge
                                key={s.id}
                                className="bg-emerald-600 text-white text-[10px] font-mono"
                                title={`${s.barnName} · Stall ${s.number}`}
                            >
                                {s.number}
                            </Badge>
                        ))}
                        {assignedStalls.length > 6 && (
                            <Badge variant="outline" className="text-[10px]">+{assignedStalls.length - 6}</Badge>
                        )}
                    </div>
                ) : (
                    <Select value={booking.stallId || '__none__'} onValueChange={(val) => onUpdate('stallId', val === '__none__' ? '' : val)}>
                        <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Assign stall..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__" className="text-xs">Unassigned</SelectItem>
                            {stallOptions.map(s => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Input
                    type="number"
                    value={booking.nights || ''}
                    onChange={(e) => onUpdate('nights', parseInt(e.target.value) || 0)}
                    className="h-7 text-xs"
                    placeholder="Nights"
                />
                <Select
                    value={booking.status || 'pending'}
                    onValueChange={(val) => {
                        onUpdate('status', val);
                        onStatusChange?.(booking.id, val); // immediate save to DB
                    }}
                >
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {BOOKING_STATUSES.map(s => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace('_', ' ')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 mt-0.5" onClick={onRemove}>
                <X className="h-3 w-3" />
            </Button>
        </div>
    );
};

// ── Main Dashboard ──

const StallingDashboard = ({ show, onSave, isSaving, onUpdateBookingStatus, onUpdateBarns }) => {
    const pd = show.project_data || {};
    const { toast } = useToast();
    const showNights = getShowNights(pd);

    const [barns, setBarns] = useState(() => pd.stallingService?.barns || []);
    const [rvAreas, setRvAreas] = useState(() => pd.stallingService?.rvAreas || []);
    // Support Spaces are no longer offered (removed from UI). We still carry any
    // previously-saved data through so it isn't lost, but it's never edited here.
    const supportSpaces = pd.stallingService?.supportSpaces || [];
    const [supplies, setSupplies] = useState(() => pd.stallingService?.supplies || []);
    const [bookings, setBookings] = useState(() => pd.stallingService?.bookings || []);
    const [searchTerm, setSearchTerm] = useState('');

    // Two-way sync: fees typed on the Fee Structure page (source !== 'housing') are
    // carried here so they show + can be edited from Housing too. Non-housing-category
    // fees (entry, office, admin…) pass through untouched; only stall/RV/supply-type
    // ones are surfaced in the Fees tab. Stored snake_case (the Fee Structure shape).
    const [manualFees, setManualFees] = useState(() => (pd.fees || []).filter(f => f.source !== 'housing'));
    const updateManualFee = (id, field, value) => setManualFees(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    const removeManualFee = (id) => setManualFees(prev => prev.filter(f => f.id !== id));
    // Bridge a snake_case fee to the camelCase shape FeeDetailsFields expects, and
    // map edits back to snake_case so the Fee Structure page reads them correctly.
    const FEE_FIELD_MAP = { unitType: 'unit_type', paymentTiming: 'payment_timing', dueDate: 'due_date', lateFee: 'late_fee_amount', customUnitLabel: 'custom_unit_label' };
    const asInventoryShape = (f) => ({ ...f, unitType: f.unit_type, paymentTiming: f.payment_timing, dueDate: f.due_date, lateFee: f.late_fee_amount, customUnitLabel: f.custom_unit_label });
    const onUpdateManualFee = (id) => (field, value) => updateManualFee(id, FEE_FIELD_MAP[field] || field, value);
    const manualFeesByCategory = (cat) => manualFees.filter(f => feeCategory(f) === cat);
    // A fee that came from the Fee Structure page (no inventory item behind it).
    const renderManualFee = (f, unitOptions) => (
        <div key={f.id} className="rounded-lg border border-dashed bg-muted/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{f.name}</span>
                    <Badge variant="outline" className="text-[10px]">from Fee Structure</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => removeManualFee(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            <FeeDetailsFields
                item={asInventoryShape(f)}
                onUpdate={onUpdateManualFee(f.id)}
                unitDefault="per_night"
                showHeader={false}
                unitOptions={unitOptions}
                leading={(
                    <div className="space-y-1">
                        <Label className="text-xs">Amount ($)</Label>
                        <Input
                            type="number"
                            min={0}
                            value={f.amount || ''}
                            onChange={(e) => updateManualFee(f.id, 'amount', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs"
                            placeholder="$0"
                        />
                    </div>
                )}
            />
        </div>
    );

    // Draft → Locked → Published lifecycle + floating auto-save state.
    // Backed by the shared module-status system (moduleStatuses.housing) so the
    // Show overview reflects it; falls back to the legacy field for older data.
    const [publishStatus, setPublishStatus] = useState(() => {
        const raw = pd.moduleStatuses?.housing || pd.stallingService?.publishStatus || 'draft';
        const m = migrateLegacyStatus(raw);
        return (m === 'locked' || m === 'published') ? m : 'draft';
    });
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    // Locked and Published are both read-only (matches the app's isModuleEditable).
    const isLocked = publishStatus === 'locked' || publishStatus === 'published';

    // Sync from parent when DB changes externally (kiosk update, tab-focus refetch, immediate-save).
    // Merge to preserve any in-flight local edits to non-status fields.
    const remoteBookingsRef = pd?.stallingService?.bookings;
    useEffect(() => {
        const remote = remoteBookingsRef || [];
        setBookings(local => {
            const localById = new Map((local || []).map(b => [b.id, b]));
            return remote.map(r => {
                const lm = localById.get(r.id);
                if (!lm) return r;
                // Trust remote for status/check-in timestamps; keep local for other in-progress edits.
                return { ...lm, status: r.status, checkedInAt: r.checkedInAt, checkedOutAt: r.checkedOutAt };
            });
        });
    }, [remoteBookingsRef]);

    // Auto-assign stalls for any unassigned bookings (e.g. online bookings that
    // requested N stalls but had none picked). Runs once per show load, mirrors the
    // "Smart Auto-Assign" button, and persists immediately. Organizer can still
    // change stalls with "Manage".
    const autoAssignedRef = useRef(false);
    useEffect(() => {
        if (autoAssignedRef.current) return;
        if (!barns.length || !bookings.length) return;
        const { plan } = planAutoAssign(bookings, barns);
        if (plan.length > 0) {
            autoAssignedRef.current = true;
            const newBarns = applyPlanToBarns(barns, plan);
            setBarns(newBarns);
            onUpdateBarns?.(newBarns); // persist like the Smart Auto-Assign button does
        }
    }, [barns, bookings, onUpdateBarns]);

    // ── Barn CRUD ──
    const addBarn = () => {
        const letter = String.fromCharCode(65 + barns.length);
        const defaultType = STALL_TYPES[0];
        setBarns(prev => [...prev, {
            id: uuidv4(),
            name: `Barn ${letter}`,
            stallType: defaultType.id,
            stallCount: 10,
            pricePerNight: defaultType.defaultPrice,
            stallSize: defaultType.defaultSize,
            stalls: Array.from({ length: 10 }, (_, i) => ({
                id: uuidv4(),
                number: `${letter}${i + 1}`,
                bookingId: null,
            })),
            hasElectricity: false,
            hasWater: false,
            hasFans: false,
            notes: '',
        }]);
    };

    const updateBarn = (barnId, field, value) => {
        setBarns(prev => prev.map(b => b.id === barnId ? { ...b, [field]: value } : b));
    };

    const removeBarn = (barnId) => {
        setBarns(prev => prev.filter(b => b.id !== barnId));
    };

    // Duplicate a barn (layout, box types, image, fee details) right below it,
    // with fresh ids and bookings cleared — quick way to make West Barn → Barn B.
    const duplicateBarn = (barnId) => {
        setBarns(prev => {
            const idx = prev.findIndex(b => b.id === barnId);
            if (idx === -1) return prev;
            const src = prev[idx];
            const copy = {
                ...src,
                id: uuidv4(),
                name: `${src.name} (copy)`,
                stalls: (src.stalls || []).map(s => ({ ...s, id: uuidv4(), bookingId: null })),
            };
            const next = [...prev];
            next.splice(idx + 1, 0, copy);
            return next;
        });
    };

    const autoGenerateBarns = () => {
        if (barns.length > 0 || rvAreas.length > 0 || supportSpaces.length > 0 || supplies.length > 0) {
            toast({ title: 'Already configured', description: 'Clear existing items first or add individually.' });
            return;
        }
        const defaultBarns = [
            { name: 'Barn A', type: 'standard', count: 20, price: 75 },
            { name: 'Barn B', type: 'standard', count: 20, price: 75 },
            { name: 'Tack Stalls', type: 'tack', count: 10, price: 60 },
        ];
        const generated = defaultBarns.map(b => {
            const typeInfo = STALL_TYPES.find(t => t.id === b.type) || STALL_TYPES[0];
            return {
                id: uuidv4(),
                name: b.name,
                stallType: b.type,
                stallCount: b.count,
                pricePerNight: b.price,
                stallSize: typeInfo.defaultSize,
                stalls: Array.from({ length: b.count }, (_, i) => ({
                    id: uuidv4(),
                    number: `${b.name.charAt(0)}${i + 1}`,
                    bookingId: null,
                })),
                hasElectricity: false,
                hasWater: false,
                hasFans: false,
                notes: '',
            };
        });
        setBarns(generated);
        // Auto-generate an RV area
        setRvAreas([{
            id: uuidv4(),
            name: 'RV Parking',
            spotCount: 15,
            pricePerNight: 45,
            hookupType: 'full',
            powerType: '50amp',
            hasWater: true,
            hasSewer: false,
            hasWifi: false,
            notes: '',
        }]);
        // Auto-generate common supplies
        setSupplies(SUPPLY_PRESETS.map(p => ({
            id: uuidv4(),
            name: p.name,
            price: p.defaultPrice,
            unit: p.unit,
            stockQty: 0,
            preBedding: p.preBedding || false,
            ...(p.preBedding ? { unitType: 'per_stall', paymentTiming: 'pre_entry' } : {}),
        })));
        toast({ title: 'Auto-Generated', description: '3 barns, 1 RV area, and 5 supply items created.' });
    };

    // ── RV Area CRUD ──
    const addRvArea = () => {
        const idx = rvAreas.length + 1;
        setRvAreas(prev => [...prev, {
            id: uuidv4(),
            name: `RV Area ${idx}`,
            spotCount: 10,
            pricePerNight: 45,
            hookupType: 'full',
            powerType: '50amp',
            hasWater: true,
            hasSewer: false,
            hasWifi: false,
            notes: '',
        }]);
    };

    const updateRvArea = (rvId, field, value) => {
        setRvAreas(prev => prev.map(r => r.id === rvId ? { ...r, [field]: value } : r));
    };

    const removeRvArea = (rvId) => {
        setRvAreas(prev => prev.filter(r => r.id !== rvId));
    };

    // ── Supply CRUD ──
    const addSupply = (preset = null) => {
        setSupplies(prev => [...prev, {
            id: uuidv4(),
            name: preset?.name || 'New Supply',
            price: preset?.defaultPrice || 0,
            unit: preset?.unit || 'each',
            stockQty: 0,
            preBedding: preset?.preBedding || false,
            // Pre-bedding is sold ahead of the show, so the fee defaults accordingly.
            ...(preset?.preBedding ? { unitType: 'per_stall', paymentTiming: 'pre_entry' } : {}),
        }]);
    };

    const updateSupply = (supplyId, field, value) => {
        setSupplies(prev => prev.map(s => s.id === supplyId ? { ...s, [field]: value } : s));
    };

    const removeSupply = (supplyId) => {
        setSupplies(prev => prev.filter(s => s.id !== supplyId));
    };

    // ── Booking CRUD ──
    const addBooking = () => {
        setBookings(prev => [...prev, {
            id: uuidv4(),
            exhibitorName: '',
            horseName: '',
            trainerName: '',
            stallId: '',
            nights: showNights || 3,
            status: 'pending',
            notes: '',
            amount: 0,
        }]);
    };

    const updateBooking = (bookingId, field, value) => {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, [field]: value } : b));
    };

    const removeBooking = (bookingId) => {
        setBookings(prev => prev.filter(b => b.id !== bookingId));
    };

    const filteredBookings = useMemo(() => {
        if (!searchTerm.trim()) return bookings;
        const q = searchTerm.toLowerCase();
        return bookings.filter(b =>
            (b.exhibitorName || '').toLowerCase().includes(q) ||
            (b.horseName || '').toLowerCase().includes(q) ||
            (b.trainerName || '').toLowerCase().includes(q)
        );
    }, [bookings, searchTerm]);

    // ── Stats ──
    const totalStalls = barns.reduce((sum, b) => sum + (b.stallCount || 0), 0);
    const totalRvSpots = rvAreas.reduce((sum, r) => sum + (r.spotCount || 0), 0);
    const totalBookings = bookings.length;
    const confirmedOnly = bookings.filter(b => b.status === 'confirmed').length;
    const checkedInOnly = bookings.filter(b => b.status === 'checked_in').length;
    // "Confirmed" stat shows confirmed-status only; OCCUPANCY counts anyone actively holding a stall (confirmed OR checked_in).
    const confirmedBookings = confirmedOnly + checkedInOnly;
    const totalUnits = totalStalls + totalRvSpots;
    const occupancyRate = totalUnits > 0 ? Math.round((confirmedBookings / totalUnits) * 100) : 0;

    const projectedRevenue = useMemo(() => {
        const bookingById = new Map(bookings.map(b => [b.id, b]));
        let total = 0;
        const counted = new Set(); // stallIds already counted via stall.bookingId

        // Multi-stall + any stall pinned to a booking (the modern model).
        for (const barn of barns) {
            for (const stall of barn.stalls || []) {
                if (!stall.bookingId) continue;
                const b = bookingById.get(stall.bookingId);
                if (!b || b.status === 'cancelled') continue;
                total += (barn.pricePerNight || 0) * (b.nights || 0);
                counted.add(stall.id);
            }
        }

        // Legacy single-stall bookings that only set booking.stallId.
        for (const booking of bookings) {
            if (booking.status === 'cancelled' || !booking.stallId) continue;
            if (counted.has(booking.stallId)) continue;
            for (const barn of barns) {
                const stall = (barn.stalls || []).find(s => s.id === booking.stallId);
                if (stall) {
                    total += (barn.pricePerNight || 0) * (booking.nights || 0);
                    break;
                }
            }
        }
        return total;
    }, [bookings, barns]);

    // ───── Analytics ─────
    // Computed from existing data; no DB calls. Drives the Analytics tab.
    const analytics = useMemo(() => {
        const ACTIVE_STATUSES = new Set(['confirmed', 'checked_in', 'checked_out']);
        const POWER_AMPS = { '50amp': 50, '30amp': 30, '35amp': 35, '25amp': 25, 'none': 0 };

        let realizedRevenue = 0;
        let stallRevenue = 0;
        let rvRevenue = 0;
        let supplyRevenue = 0;
        let supportRevenue = 0;
        let cancelledCount = 0;
        let totalBookingsCount = bookings.length;

        // Track demand: how many bookings request each barn/RV area
        const demandByRefId = new Map(); // refId → { name, type, count }
        const recordDemand = (refId, name, type) => {
            if (!refId) return;
            if (!demandByRefId.has(refId)) {
                demandByRefId.set(refId, { refId, name, type, count: 0 });
            }
            demandByRefId.get(refId).count += 1;
        };

        for (const b of bookings) {
            if (b.status === 'cancelled') { cancelledCount += 1; continue; }
            const amt = Number(b.totalAmount ?? b.amount ?? 0);
            if (ACTIVE_STATUSES.has(b.status)) realizedRevenue += amt;

            // Per-item revenue breakdown
            for (const it of b.items || []) {
                const itAmt = Number(it.amount || 0);
                if (it.type === 'stall') {
                    stallRevenue += itAmt;
                    const barn = barns.find(x => x.id === it.refId);
                    if (barn) recordDemand(barn.id, barn.name, 'stall');
                } else if (it.type === 'rv' || it.type === 'rv_fee') {
                    rvRevenue += itAmt;
                    if (it.type === 'rv') {
                        const area = rvAreas.find(x => x.id === it.refId);
                        if (area) recordDemand(area.id, area.name, 'rv');
                    }
                } else if (it.type === 'support') {
                    supportRevenue += itAmt;
                } else if (it.type === 'supply') {
                    supplyRevenue += itAmt;
                }
            }
            // Legacy single-stall bookings have no items[]
            if ((!b.items || b.items.length === 0) && b.stallId) {
                const barn = barns.find(x => (x.stalls || []).some(s => s.id === b.stallId));
                if (barn) recordDemand(barn.id, barn.name, 'stall');
            }
        }

        // Peak demand zone (most-requested area)
        const demandList = [...demandByRefId.values()].sort((a, b) => b.count - a.count);
        const peakDemand = demandList[0] || null;

        // RV power load
        let ampsUsed = 0;
        let ampsCapacity = 0;
        for (const area of rvAreas) {
            const ampPer = POWER_AMPS[area.powerType] || 0;
            ampsCapacity += ampPer * (area.spotCount || 0);
        }
        for (const b of bookings) {
            if (b.status === 'cancelled') continue;
            for (const it of b.items || []) {
                if (it.type !== 'rv') continue;
                const area = rvAreas.find(x => x.id === it.refId);
                if (!area) continue;
                ampsUsed += (POWER_AMPS[area.powerType] || 0) * (it.qty || 0);
            }
        }
        const powerLoadPct = ampsCapacity > 0 ? Math.round((ampsUsed / ampsCapacity) * 100) : 0;

        const noShowRate = totalBookingsCount > 0
            ? Math.round((cancelledCount / totalBookingsCount) * 100)
            : 0;

        return {
            occupancy: { rate: occupancyRate, occupied: confirmedBookings, total: totalUnits },
            revenue: {
                total: realizedRevenue,
                byStalls: stallRevenue,
                byRv: rvRevenue,
                bySupplies: supplyRevenue,
                bySupport: supportRevenue,
            },
            noShow: { count: cancelledCount, total: totalBookingsCount, rate: noShowRate },
            peakDemand,
            demandList: demandList.slice(0, 5),
            powerLoad: { ampsUsed, ampsCapacity, pct: powerLoadPct },
        };
    }, [bookings, barns, rvAreas, occupancyRate, confirmedBookings, totalUnits]);

    const persist = useCallback(async (opts = {}) => {
        await onSave({ barns, rvAreas, supportSpaces, supplies, bookings, publishStatus, manualFees }, opts);
        setLastSavedAt(new Date());
        setIsDirty(false);
    }, [onSave, barns, rvAreas, supportSpaces, supplies, bookings, publishStatus, manualFees]);

    const handleSave = () => persist();

    // Floating auto-save — quietly persists inventory & status edits as you work.
    // Bookings have their own immediate-save paths, so they're excluded here to
    // avoid clashing with the remote-sync effect above.
    const autoSaveFirstRun = useRef(true);
    useEffect(() => {
        if (autoSaveFirstRun.current) { autoSaveFirstRun.current = false; return; }
        setIsDirty(true);
        const t = setTimeout(() => { persist({ silent: true }); }, 1500);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [barns, rvAreas, supplies, publishStatus, manualFees]);

    return (
        <div className="space-y-6">
            {/* Read-only banner (Locked or Published) */}
            {isLocked && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                    {publishStatus === 'published' ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {publishStatus === 'published'
                        ? <span>This setup is <strong>Published</strong> (live for booking). Switch back to <strong>Draft</strong> to make changes.</span>
                        : <span>This setup is <strong>Locked</strong>. Switch back to <strong>Draft</strong> to make changes.</span>}
                </div>
            )}

            {/* Conflict & capacity alerts */}
            <ConflictAlertsPanel
                bookings={bookings}
                barns={barns}
                rvAreas={rvAreas}
                showInfo={pd?.showDetails?.general || pd}
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="rounded-xl border p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Stalls</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalStalls}</p>
                </div>
                <div className="rounded-xl border p-4 bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">RV Spots</p>
                    <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{totalRvSpots}</p>
                </div>
                <div className="rounded-xl border p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Bookings</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totalBookings}</p>
                </div>
                <div className="rounded-xl border p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Confirmed</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{confirmedOnly}</p>
                    {checkedInOnly > 0 && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            +{checkedInOnly} checked in
                        </p>
                    )}
                </div>
                <div className="rounded-xl border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Occupancy</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{occupancyRate}%</p>
                </div>
                <div className="rounded-xl border p-4 bg-rose-50 dark:bg-rose-950/20 border-rose-200">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Projected Revenue</p>
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">${projectedRevenue.toLocaleString()}</p>
                </div>
            </div>

            {/* Stall Fee Summary */}
            {(barns.length > 0 || rvAreas.length > 0 || supportSpaces.length > 0) && showNights > 0 && (
                <div className="rounded-xl border p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-2 mb-3">
                        <Moon className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Stall Fee Calculator</h3>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                            {pd.startDate && new Date(pd.startDate).toLocaleDateString()} — {pd.endDate && new Date(pd.endDate).toLocaleDateString()}
                        </Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-muted-foreground uppercase">
                                    <th className="text-left px-2 py-1 font-medium">Barn / Area</th>
                                    <th className="text-right px-2 py-1 font-medium">Price / Night</th>
                                    <th className="text-center px-2 py-1 font-medium">Nights</th>
                                    <th className="text-right px-2 py-1 font-medium">Per Stall Total</th>
                                    <th className="text-center px-2 py-1 font-medium">Stalls</th>
                                    <th className="text-right px-2 py-1 font-medium">Max Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {barns.map(barn => {
                                    const perStall = (barn.pricePerNight || 0) * showNights;
                                    const maxRev = perStall * (barn.stallCount || 0);
                                    return (
                                        <tr key={barn.id} className="border-t border-indigo-100 dark:border-indigo-800/50">
                                            <td className="px-2 py-1.5 font-medium">{barn.name}</td>
                                            <td className="px-2 py-1.5 text-right">${(barn.pricePerNight || 0).toFixed(0)}</td>
                                            <td className="px-2 py-1.5 text-center">{showNights}</td>
                                            <td className="px-2 py-1.5 text-right font-semibold">${perStall.toFixed(0)}</td>
                                            <td className="px-2 py-1.5 text-center">{barn.stallCount || 0}</td>
                                            <td className="px-2 py-1.5 text-right font-bold text-indigo-700 dark:text-indigo-300">${maxRev.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                                {rvAreas.map(rv => {
                                    const perSpot = (rv.pricePerNight || 0) * showNights;
                                    const maxRev = perSpot * (rv.spotCount || 0);
                                    return (
                                        <tr key={rv.id} className="border-t border-indigo-100 dark:border-indigo-800/50">
                                            <td className="px-2 py-1.5 font-medium">{rv.name} <span className="text-xs text-cyan-600">(RV)</span></td>
                                            <td className="px-2 py-1.5 text-right">${(rv.pricePerNight || 0).toFixed(0)}</td>
                                            <td className="px-2 py-1.5 text-center">{showNights}</td>
                                            <td className="px-2 py-1.5 text-right font-semibold">${perSpot.toFixed(0)}</td>
                                            <td className="px-2 py-1.5 text-center">{rv.spotCount || 0}</td>
                                            <td className="px-2 py-1.5 text-right font-bold text-indigo-700 dark:text-indigo-300">${maxRev.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-indigo-200 dark:border-indigo-700 font-bold">
                                    <td className="px-2 py-1.5" colSpan={4}>Total</td>
                                    <td className="px-2 py-1.5 text-center">{totalUnits}</td>
                                    <td className="px-2 py-1.5 text-right text-indigo-700 dark:text-indigo-300">
                                        ${(
                                            barns.reduce((sum, b) => sum + ((b.stallCount || 0) * (b.pricePerNight || 0) * showNights), 0)
                                            + rvAreas.reduce((sum, r) => sum + ((r.spotCount || 0) * (r.pricePerNight || 0) * showNights), 0)
                                        ).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            <Tabs defaultValue="inventory">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <TabsList>
                        <TabsTrigger value="inventory">Inventory</TabsTrigger>
                        <TabsTrigger value="fees">Fees</TabsTrigger>
                        <TabsTrigger value="pricing">Pricing Summary</TabsTrigger>
                        <TabsTrigger value="bookings">Bookings ({totalBookings})</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {/* Lifecycle status + auto-save (Draft / Locked / Published) */}
                    <div className="flex items-center gap-2 sm:gap-3 rounded-full border bg-background px-2.5 py-1.5 shadow-sm">
                        <div className="flex items-center rounded-full bg-muted p-0.5">
                            {PUBLISH_STATUSES.map(s => {
                                const Icon = s.icon;
                                const isActive = publishStatus === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        title={s.hint}
                                        onClick={() => setPublishStatus(s.id)}
                                        className={cn(
                                            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                                            isActive ? s.active : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">{s.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="h-5 w-px bg-border" />

                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-7 rounded-full px-3">
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                            {isSaving ? 'Saving…' : 'Save All'}
                        </Button>
                        <span className="hidden md:inline text-[11px] text-muted-foreground whitespace-nowrap">
                            {isSaving
                                ? 'Saving…'
                                : isDirty
                                    ? 'Unsaved changes…'
                                    : lastSavedAt
                                        ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        : 'Auto-save on'}
                        </span>
                    </div>
                </div>

                {/* ── Inventory Tab — Livestock Housing only (counts + layouts) ── */}
                <TabsContent value="inventory" className="mt-4">
                          <fieldset disabled={isLocked} className={cn('space-y-4', isLocked && 'opacity-70')}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-primary" />
                                    <h3 className="text-base font-semibold">Livestock Housing</h3>
                                    <Badge variant="outline" className="text-xs">{barns.length} area{barns.length !== 1 ? 's' : ''} · {totalStalls} stall{totalStalls !== 1 ? 's' : ''}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button onClick={addBarn} variant="outline" size="sm">
                                        <Plus className="h-4 w-4 mr-1.5" /> Add Area
                                    </Button>
                                    <Button onClick={autoGenerateBarns} variant="outline" size="sm">
                                        <Wand2 className="h-4 w-4 mr-1.5" /> Auto-Generate
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground -mt-2">Horse stalls, cattle pens, sheep/goat pens.</p>

                            {barns.length === 0 ? (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <Warehouse className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">No livestock housing configured. Click "Add Area" or "Auto-Generate" to get started.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {barns.map(barn => (
                                        <BarnCard
                                            key={barn.id}
                                            barn={barn}
                                            showId={show.id}
                                            onUpdate={(field, value) => updateBarn(barn.id, field, value)}
                                            onRemove={() => removeBarn(barn.id)}
                                            onDuplicate={() => duplicateBarn(barn.id)}
                                        />
                                    ))}
                                </div>
                            )}
                          </fieldset>
                </TabsContent>

                {/* ── Fees Tab — all area fee details consolidated in one place ── */}
                <TabsContent value="fees" className="mt-4">
                          <fieldset disabled={isLocked} className={cn('space-y-5', isLocked && 'opacity-70')}>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-emerald-600" />
                                <h3 className="text-base font-semibold">Fees</h3>
                            </div>
                            <p className="text-xs text-muted-foreground -mt-3">
                                Set fees here — they match the Fee Structure page. Stalls are added in the Inventory tab; RV/camping & supplies are added right here.
                            </p>

                            {/* Stall Fees */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-primary" />
                                        <h4 className="text-sm font-semibold">Stall Fees</h4>
                                        <Badge variant="outline" className="text-xs">{barns.length + manualFeesByCategory('stall').length}</Badge>
                                    </div>
                                    <Button onClick={addBarn} variant="outline" size="sm" className="h-7 text-xs">
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Stall Fee
                                    </Button>
                                </div>
                                {barns.length === 0 && manualFeesByCategory('stall').length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No stall fees yet — add a barn in the Livestock Housing tab, or click "Add Stall Fee".</p>
                                ) : (
                                    <div className="space-y-2">
                                        {barns.map(barn => (
                                            <div key={barn.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">{barn.name}</span>
                                                    <span className="text-xs text-muted-foreground">{(barn.stalls || []).filter(s => (s.type || 'stall') === 'stall').length} stalls</span>
                                                </div>
                                                <FeeDetailsFields
                                                    item={barn}
                                                    onUpdate={(field, value) => updateBarn(barn.id, field, value)}
                                                    unitDefault="per_night"
                                                    showHeader={false}
                                                    unitOptions={['flat', 'per_night', 'per_stall', 'custom']}
                                                    leading={(
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Price / Night ($)</Label>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={barn.pricePerNight || ''}
                                                                onChange={(e) => updateBarn(barn.id, 'pricePerNight', parseFloat(e.target.value) || 0)}
                                                                className="h-8 text-xs"
                                                                placeholder="$0"
                                                            />
                                                        </div>
                                                    )}
                                                />
                                            </div>
                                        ))}
                                        {manualFeesByCategory('stall').map(f => renderManualFee(f, ['flat', 'per_night', 'per_stall', 'custom']))}
                                    </div>
                                )}
                            </div>

                            {/* RV & Camping Fees */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Car className="h-4 w-4 text-cyan-600" />
                                        <h4 className="text-sm font-semibold">RV & Camping Fees</h4>
                                        <Badge variant="outline" className="text-xs">{rvAreas.length + manualFeesByCategory('rv').length}</Badge>
                                    </div>
                                    <Button onClick={addRvArea} variant="outline" size="sm" className="h-7 text-xs">
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add RV Fee
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground -mt-1">RV hookups (full / partial / dry), trailer parking, camping spots.</p>
                                {rvAreas.length === 0 && manualFeesByCategory('rv').length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No RV/camping areas yet — click "Add RV Fee" to start.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {rvAreas.map(rv => (
                                            <RvAreaCard
                                                key={rv.id}
                                                rvArea={rv}
                                                onUpdate={(field, value) => updateRvArea(rv.id, field, value)}
                                                onRemove={() => removeRvArea(rv.id)}
                                            />
                                        ))}
                                        {manualFeesByCategory('rv').map(f => renderManualFee(f, ['flat', 'per_night', 'custom']))}
                                    </div>
                                )}
                            </div>

                            {/* Supply Fees */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4 text-amber-600" />
                                        <h4 className="text-sm font-semibold">Supply Fees</h4>
                                        <Badge variant="outline" className="text-xs">{supplies.length + manualFeesByCategory('supply').length}</Badge>
                                    </div>
                                    <Button onClick={() => addSupply()} variant="outline" size="sm" className="h-7 text-xs">
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Supply Fee
                                    </Button>
                                </div>
                                {/* Quick-add presets */}
                                <div className="flex flex-wrap gap-1.5">
                                    {SUPPLY_PRESETS.filter(p => !supplies.some(s => s.name === p.name)).map(preset => (
                                        <Button key={preset.name} variant="outline" size="sm" className="h-7 text-xs" onClick={() => addSupply(preset)}>
                                            <Plus className="h-3 w-3 mr-1" /> {preset.name}
                                        </Button>
                                    ))}
                                </div>
                                {supplies.length === 0 && manualFeesByCategory('supply').length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No supplies yet — use the quick-add buttons or "Add Supply Fee".</p>
                                ) : (
                                    <div className="space-y-2">
                                        {supplies.map(item => (
                                            <SupplyItemCard
                                                key={item.id}
                                                item={item}
                                                onUpdate={(field, value) => updateSupply(item.id, field, value)}
                                                onRemove={() => removeSupply(item.id)}
                                            />
                                        ))}
                                        {manualFeesByCategory('supply').map(f => renderManualFee(f, ['flat', 'per_bag', 'per_night', 'custom']))}
                                    </div>
                                )}
                            </div>
                          </fieldset>
                </TabsContent>

                {/* ── Bookings Tab ── */}
                <TabsContent value="bookings" className="space-y-4 mt-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button onClick={addBooking} variant="outline">
                            <ShoppingCart className="h-4 w-4 mr-2" /> Add Booking
                        </Button>
                        <SmartAssignDialog
                            bookings={bookings}
                            barns={barns}
                            onApply={async (newBarns) => {
                                setBarns(newBarns);
                                if (onUpdateBarns) await onUpdateBarns(newBarns);
                            }}
                        />
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search exhibitor, horse, trainer..."
                                className="h-8 pl-8 text-sm"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {filteredBookings.length} of {bookings.length} bookings
                        </p>
                    </div>

                    {filteredBookings.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                                <p className="text-muted-foreground">
                                    {bookings.length === 0
                                        ? 'No bookings yet. Click "Add Booking" to start.'
                                        : 'No bookings match your search.'
                                    }
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {filteredBookings.map(booking => (
                                <div key={booking.id} className="flex items-start gap-2">
                                    <div className="flex-1">
                                        <BookingRow
                                            booking={booking}
                                            barns={barns}
                                            onUpdate={(field, value) => updateBooking(booking.id, field, value)}
                                            onRemove={() => removeBooking(booking.id)}
                                            onStatusChange={onUpdateBookingStatus}
                                        />
                                    </div>
                                    <ManageStallsDialog
                                        booking={booking}
                                        barns={barns}
                                        onApply={async (newBarns) => {
                                            setBarns(newBarns);
                                            if (onUpdateBarns) await onUpdateBarns(newBarns);
                                        }}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        title="Download invoice PDF"
                                        onClick={() => {
                                            const assignedStalls = getAssignedStallsForBooking(booking, barns)
                                                .map(s => {
                                                    const barn = barns.find(b => b.id === s.barnId);
                                                    return { barnId: s.barnId, number: s.number, pricePerNight: barn?.pricePerNight || 0 };
                                                });
                                            downloadInvoicePdf({
                                                booking,
                                                show: {
                                                    id: show.id,
                                                    name: show.project_name,
                                                    startDate: pd?.showDetails?.general?.startDate || pd?.startDate,
                                                    endDate: pd?.showDetails?.general?.endDate || pd?.endDate,
                                                    venueFacility: pd?.showDetails?.venue?.facilityName,
                                                },
                                                assignedStalls,
                                                options: {
                                                    organizerContact: pd?.showDetails?.general?.managerContactEmail,
                                                },
                                            });
                                        }}
                                    >
                                        <FileText className="h-3 w-3 mr-1" /> Invoice
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Status summary */}
                    {bookings.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {BOOKING_STATUSES.map(status => {
                                const count = bookings.filter(b => b.status === status).length;
                                if (count === 0) return null;
                                return (
                                    <Badge key={status} className={cn('text-xs', STATUS_COLORS[status])}>
                                        {status.replace('_', ' ')}: {count}
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ── Pricing Summary Tab ── */}
                <TabsContent value="pricing" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-primary" /> Pricing & Revenue Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {barns.length === 0 && rvAreas.length === 0 && supportSpaces.length === 0 && supplies.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">Add livestock housing, RV / camping, or supplies to see pricing summary.</p>
                            ) : (
                                <>
                                    {/* Spaces table */}
                                    {(barns.length > 0 || rvAreas.length > 0 || supportSpaces.length > 0) && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-muted/30">
                                                        <th className="text-left px-3 py-2 font-medium">Area</th>
                                                        <th className="text-center px-3 py-2 font-medium">Type</th>
                                                        <th className="text-center px-3 py-2 font-medium">Count</th>
                                                        <th className="text-right px-3 py-2 font-medium">Price/Night</th>
                                                        <th className="text-center px-3 py-2 font-medium">Booked</th>
                                                        <th className="text-right px-3 py-2 font-medium">Max Revenue ({showNights || 3} nights)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {barns.map(barn => {
                                                        const typeInfo = STALL_TYPES.find(t => t.id === barn.stallType) || STALL_TYPES[0];
                                                        const bookedCount = bookings.filter(b => {
                                                            if (b.status === 'cancelled') return false;
                                                            return (barn.stalls || []).some(s => s.id === b.stallId);
                                                        }).length;
                                                        const maxRev = (barn.stallCount || 0) * (barn.pricePerNight || 0) * (showNights || 3);
                                                        return (
                                                            <tr key={barn.id} className="border-b last:border-0">
                                                                <td className="px-3 py-2 font-medium">{barn.name}</td>
                                                                <td className="px-3 py-2 text-center text-muted-foreground">{typeInfo.name}</td>
                                                                <td className="px-3 py-2 text-center">{barn.stallCount || 0}</td>
                                                                <td className="px-3 py-2 text-right">${(barn.pricePerNight || 0).toFixed(2)}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <Badge variant={bookedCount > 0 ? 'default' : 'outline'} className="text-xs">
                                                                        {bookedCount}
                                                                    </Badge>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-semibold">${maxRev.toLocaleString()}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {rvAreas.map(rv => {
                                                        const hookupInfo = RV_HOOKUP_TYPES.find(t => t.id === rv.hookupType) || RV_HOOKUP_TYPES[0];
                                                        const maxRev = (rv.spotCount || 0) * (rv.pricePerNight || 0) * (showNights || 3);
                                                        return (
                                                            <tr key={rv.id} className="border-b last:border-0">
                                                                <td className="px-3 py-2 font-medium">{rv.name}</td>
                                                                <td className="px-3 py-2 text-center text-cyan-600">{hookupInfo.name}</td>
                                                                <td className="px-3 py-2 text-center">{rv.spotCount || 0}</td>
                                                                <td className="px-3 py-2 text-right">${(rv.pricePerNight || 0).toFixed(2)}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <Badge variant="outline" className="text-xs">-</Badge>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-semibold">${maxRev.toLocaleString()}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-muted/30 font-semibold">
                                                        <td className="px-3 py-2">Total</td>
                                                        <td className="px-3 py-2" />
                                                        <td className="px-3 py-2 text-center">{totalUnits}</td>
                                                        <td className="px-3 py-2" />
                                                        <td className="px-3 py-2 text-center">{confirmedBookings}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            ${(
                                                                barns.reduce((sum, b) => sum + ((b.stallCount || 0) * (b.pricePerNight || 0) * (showNights || 3)), 0)
                                                                + rvAreas.reduce((sum, r) => sum + ((r.spotCount || 0) * (r.pricePerNight || 0) * (showNights || 3)), 0)
                                                            ).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}

                                    {/* Supplies pricing */}
                                    {supplies.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <ShoppingCart className="h-4 w-4 text-amber-600" /> Supplies Pricing
                                            </h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b bg-muted/30">
                                                            <th className="text-left px-3 py-2 font-medium">Item</th>
                                                            <th className="text-right px-3 py-2 font-medium">Price</th>
                                                            <th className="text-center px-3 py-2 font-medium">Unit</th>
                                                            <th className="text-center px-3 py-2 font-medium">Stock</th>
                                                            <th className="text-right px-3 py-2 font-medium">Stock Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {supplies.map(item => (
                                                            <tr key={item.id} className="border-b last:border-0">
                                                                <td className="px-3 py-2 font-medium">{item.name}</td>
                                                                <td className="px-3 py-2 text-right">${(item.price || 0).toFixed(2)}</td>
                                                                <td className="px-3 py-2 text-center text-muted-foreground">{item.unit || '-'}</td>
                                                                <td className="px-3 py-2 text-center">{item.stockQty || 0}</td>
                                                                <td className="px-3 py-2 text-right font-semibold">${((item.price || 0) * (item.stockQty || 0)).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-muted/30 font-semibold">
                                                            <td className="px-3 py-2" colSpan={4}>Total Stock Value</td>
                                                            <td className="px-3 py-2 text-right">
                                                                ${supplies.reduce((sum, s) => sum + ((s.price || 0) * (s.stockQty || 0)), 0).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {projectedRevenue > 0 && (
                                <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200">
                                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                        Projected Revenue from Current Bookings: <span className="text-lg font-bold">${projectedRevenue.toLocaleString()}</span>
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Analytics Tab ── */}
                <TabsContent value="analytics" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">📊 Analytics</CardTitle>
                            <CardDescription>
                                Per-show metrics. Auto-computed from your bookings, stalls, and RV data — updates live as bookings come in.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                {/* 1. Occupancy */}
                                <div className="rounded-xl border-2 p-5 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Occupancy</p>
                                    <p className="text-4xl font-bold text-amber-900 dark:text-amber-200">{analytics.occupancy.rate}%</p>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-2">
                                        {analytics.occupancy.occupied} of {analytics.occupancy.total} units occupied
                                    </p>
                                </div>

                                {/* 2. Revenue */}
                                <div className="rounded-xl border-2 p-5 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">Realized Revenue</p>
                                    <p className="text-4xl font-bold text-emerald-900 dark:text-emerald-200">${analytics.revenue.total.toLocaleString()}</p>
                                    <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-2 space-y-0.5">
                                        <p>Stalls: ${analytics.revenue.byStalls.toLocaleString()}</p>
                                        <p>RV: ${analytics.revenue.byRv.toLocaleString()}</p>
                                        {analytics.revenue.bySupport > 0 && <p>Support: ${analytics.revenue.bySupport.toLocaleString()}</p>}
                                        {analytics.revenue.bySupplies > 0 && <p>Supplies: ${analytics.revenue.bySupplies.toLocaleString()}</p>}
                                    </div>
                                </div>

                                {/* 3. No-show / cancel rate */}
                                <div className="rounded-xl border-2 p-5 bg-red-50 dark:bg-red-950/20 border-red-200">
                                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide mb-1">No-show / Cancel</p>
                                    <p className="text-4xl font-bold text-red-900 dark:text-red-200">{analytics.noShow.rate}%</p>
                                    <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-2">
                                        {analytics.noShow.count} of {analytics.noShow.total} booking{analytics.noShow.total !== 1 ? 's' : ''}
                                    </p>
                                </div>

                                {/* 4. Peak demand zone */}
                                <div className="rounded-xl border-2 p-5 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-1">Peak Demand</p>
                                    {analytics.peakDemand ? (
                                        <>
                                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 leading-tight truncate" title={analytics.peakDemand.name}>
                                                {analytics.peakDemand.name}
                                            </p>
                                            <p className="text-xs text-purple-700/80 dark:text-purple-400/80 mt-2">
                                                {analytics.peakDemand.count} booking{analytics.peakDemand.count !== 1 ? 's' : ''} requested
                                            </p>
                                            {analytics.demandList.length > 1 && (
                                                <div className="text-[11px] text-purple-700/70 dark:text-purple-400/70 mt-2 pt-2 border-t border-purple-200 dark:border-purple-800 space-y-0.5">
                                                    {analytics.demandList.slice(1, 4).map(d => (
                                                        <p key={d.refId} className="truncate" title={d.name}>
                                                            {d.name} · {d.count}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-purple-700/80 dark:text-purple-400/80 italic">No bookings yet</p>
                                    )}
                                </div>

                                {/* 5. Power load */}
                                <div className="rounded-xl border-2 p-5 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">RV Power Load</p>
                                    {analytics.powerLoad.ampsCapacity > 0 ? (
                                        <>
                                            <p className="text-4xl font-bold text-blue-900 dark:text-blue-200">{analytics.powerLoad.pct}%</p>
                                            <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-2">
                                                {analytics.powerLoad.ampsUsed} A used of {analytics.powerLoad.ampsCapacity} A available
                                            </p>
                                            {analytics.powerLoad.pct > 80 && (
                                                <p className="text-[11px] text-red-600 dark:text-red-400 mt-2 font-semibold">
                                                    ⚠ Approaching capacity
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-blue-700/80 dark:text-blue-400/80 italic">No RV power data</p>
                                    )}
                                </div>
                            </div>

                            {/* Empty state */}
                            {analytics.noShow.total === 0 && (
                                <div className="mt-6 text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                                    📭 No bookings yet — analytics will populate as exhibitors reserve.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Charts */}
                    {analytics.noShow.total > 0 && (
                        <AnalyticsCharts analytics={analytics} bookings={bookings} />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

// ── Fee sync (Housing & Grounds → Fee Structure) ──
// Housing & Grounds is the source of truth for the three physical fee categories
// (stalls, RV, supplies). On every save we regenerate matching entries for the Fee
// Structure list. Each generated fee is tagged source:'housing' with a stable id
// (housing-<itemId>) so we can replace them without ever touching the fees an
// organizer typed manually on the Fee Structure page.
// Classify a Fee Structure fee into a Housing category so a fee typed on the Fee
// page shows in the matching Fees-tab group. Returns 'stall' | 'rv' | 'supply' | null.
function feeCategory(f) {
    const id = (f.standard_id || '').toLowerCase();
    const n = (f.name || '').toLowerCase();
    if (id.includes('stall') || n.includes('stall')) return 'stall';
    if (id.includes('rv') || n.includes('rv') || n.includes('camp')) return 'rv';
    if (id.includes('shav') || id.includes('bed') || n.includes('shav') || n.includes('hay') || n.includes('bedding') || f.unit_type === 'per_bag') return 'supply';
    return null;
}

function buildHousingFees({ barns = [], rvAreas = [], supplies = [] }) {
    const make = (sourceType, item, { name, amount, unitDefault }) => ({
        id: `housing-${item.id}`,
        source: 'housing',
        sourceType,
        sourceId: item.id,
        is_standard: true,
        name: name || 'Fee',
        amount: Number(amount) || 0,
        unit_type: item.unitType || unitDefault,
        custom_unit_label: item.unitType === 'custom' ? (item.customUnitLabel || '') : undefined,
        payment_timing: item.paymentTiming || 'pre_entry',
        due_date: item.dueDate || null,
        late_fee_amount: item.lateFee || '',
        notes: item.notes || '',
    });

    return [
        ...barns.map(b => make('barn', b, { name: b.name, amount: b.pricePerNight, unitDefault: 'per_night' })),
        ...rvAreas.map(r => make('rv', r, {
            name: r.name,
            amount: r.pricingModel === 'flat' ? r.flatRate : r.pricePerNight,
            unitDefault: r.pricingModel === 'flat' ? 'flat' : 'per_night',
        })),
        ...supplies.map(s => make('supply', s, { name: s.name, amount: s.price, unitDefault: 'per_bag' })),
    ];
}

// ── Main Page ──

const HousingGroundsManagerPage = () => {
    const navigate = useNavigate();
    const { showId } = useParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const [shows, setShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShow, setSelectedShow] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchShows = useCallback(async () => {
        if (!user) { setIsLoading(false); return; }
        const { data, error } = await supabase
            .from('projects')
            .select('id, project_name, project_type, project_data, status, created_at')
            .not('project_type', 'in', '("pattern_folder","pattern_hub","pattern_upload","contract")')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (!error && data) {
            setShows(data);
            if (showId) {
                const match = data.find(s => s.id === showId);
                if (match) setSelectedShow(match);
            }
        }
        setIsLoading(false);
    }, [user, showId]);

    useEffect(() => { fetchShows(); }, [fetchShows]);

    // Refetch when tab regains focus so kiosk-side changes appear here automatically.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') fetchShows();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchShows]);

    // Persist updated barns array immediately (used by Smart Auto-Assign + ManageStallsDialog).
    // This commits stall->booking assignments without requiring "Save All".
    const updateBarnsImmediate = useCallback(async (nextBarns) => {
        if (!selectedShow) return;
        try {
            const updatedData = stampModuleStatusOnSave({
                ...selectedShow.project_data,
                stallingService: {
                    ...(selectedShow.project_data?.stallingService || {}),
                    barns: nextBarns,
                },
            }, 'housing');
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
        } catch (error) {
            toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
            throw error;
        }
    }, [selectedShow, toast]);

    // Persist a single booking's status immediately (no Save All needed).
    const updateBookingStatusImmediate = useCallback(async (bookingId, newStatus) => {
        if (!selectedShow) return;
        try {
            const currentBookings = selectedShow.project_data?.stallingService?.bookings || [];
            const updatedBookings = currentBookings.map(b =>
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
                ...selectedShow.project_data,
                stallingService: { ...(selectedShow.project_data?.stallingService || {}), bookings: updatedBookings },
            }, 'housing');
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            toast({ title: 'Status updated', description: `Booking is now ${newStatus.replace('_', ' ')}.` });
        } catch (error) {
            toast({ title: 'Status save failed', description: error.message, variant: 'destructive' });
        }
    }, [selectedShow, toast]);

    const handleSave = async ({ barns, rvAreas, supportSpaces, supplies, bookings, publishStatus, manualFees: editedManualFees }, { silent = false } = {}) => {
        if (!selectedShow) return;
        setIsSaving(true);
        try {
            // Fees typed on the Fee Structure page (source !== 'housing'). Use the
            // edited copy from the dashboard when provided (two-way sync), else fall
            // back to whatever is on the record. Housing-sourced fees are regenerated.
            const manualFees = editedManualFees || (selectedShow.project_data?.fees || []).filter(f => f.source !== 'housing');
            const housingFees = buildHousingFees({ barns, rvAreas, supplies });
            const effectiveStatus = publishStatus || selectedShow.project_data?.stallingService?.publishStatus || 'draft';
            const stamped = stampModuleStatusOnSave({
                ...selectedShow.project_data,
                stallingService: {
                    barns, rvAreas, supportSpaces, supplies, bookings,
                    publishStatus: effectiveStatus,
                },
                fees: [...manualFees, ...housingFees],
            }, 'housing');
            // The Draft/Locked/Published bar is the source of truth — write it into
            // the shared module-status map so the Show overview reflects it.
            const updatedData = {
                ...stamped,
                moduleStatuses: { ...(stamped.moduleStatuses || {}), housing: effectiveStatus },
            };
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            if (!silent) toast({ title: 'Housing & Grounds Saved', description: 'All housing, grounds, and booking data saved successfully.' });
        } catch (error) {
            toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Housing & Grounds Manager - Horse Show Manager</title></Helmet>
            <div className="min-h-screen bg-background">
                <Navigation />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <PageHeader title="Housing & Grounds Manager" backTo={showId ? `/horse-show-manager/show/${showId}` : '/horse-show-manager'} />

                    {!showId && (
                        <div className="mb-6">
                            <LinkToExistingShow
                                existingProjects={shows}
                                linkedProjectId={selectedShow?.id || null}
                                onLink={(projectId) => {
                                    if (projectId === 'none') { setSelectedShow(null); return; }
                                    const show = shows.find(s => s.id === projectId);
                                    if (show) setSelectedShow(show);
                                }}
                                description="Link to an existing show to manage its housing and grounds."
                            />
                        </div>
                    )}

                    {selectedShow && (
                        <>
                            <BookingLinkCard show={selectedShow} />
                            <StallingDashboard
                                key={selectedShow.id}
                                show={selectedShow}
                                onSave={handleSave}
                                isSaving={isSaving}
                                onUpdateBookingStatus={updateBookingStatusImmediate}
                                onUpdateBarns={updateBarnsImmediate}
                            />
                        </>
                    )}
                </main>
            </div>
        </>
    );
};

export default HousingGroundsManagerPage;
