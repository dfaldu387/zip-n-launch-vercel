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
    MapPin, Plus, Minus, Trash2, Save, Check, X, Search, Users, DollarSign,
    Building2, Warehouse, Car, ShoppingCart, AlertCircle, Wand2, Moon,
    Beef, PawPrint, Copy, ExternalLink, Link as LinkIcon,
    ScanLine, FileText, ImagePlus, Lock, Globe, Pencil,
    ChevronDown, ChevronRight, Clock, Phone, Mail, CheckCircle2, RefreshCw,
    ClipboardList, Package, Truck, Undo2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LinkToExistingShow } from '@/components/shared/LinkToExistingShow';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { stampModuleStatusOnSave, migrateLegacyStatus } from '@/lib/moduleStatusService';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { LogoUploader } from '@/components/show-structure/LogoUploader';
import AddBookingDialog from '@/components/housing/AddBookingDialog';
import MasterListPanel from '@/components/housing/MasterListPanel';
import AssignBoard from '@/components/housing/AssignBoard';
import ConflictAlertsPanel from '@/components/housing/ConflictAlertsPanel';
import AnalyticsCharts from '@/components/housing/AnalyticsCharts';
import { getRequestedStallCount, getAssignedStallsForBooking, planAutoAssign, applyPlanToBarns, assignStallToBooking, unassignBookingStalls } from '@/lib/stallAssignment';
import { downloadInvoicePdf } from '@/lib/invoiceGenerator';
import {
    stallPrefix, renumberStalls, gridCols, gridRows, describeGrid,
    numberingMode, NUMBERING_ROW, NUMBERING_CONTINUOUS,
    computeGridLabels, labelValue,
    insertRowAt, deleteRowAt, insertColAt, deleteColAt, resizeGrid,
    bookedInRow, bookedInCol,
} from '@/lib/barnGrid';

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

// Per-section lock toggle — freeze one Barn / RV area / supply as you finish it so
// it can't be adjusted by accident. Independent of the page-wide "Locked" lifecycle.
const SectionLockToggle = ({ locked, onToggle }) => (
    <Button
        type="button"
        variant={locked ? 'default' : 'outline'}
        size="sm"
        className={cn('h-7 text-xs gap-1', locked && 'bg-amber-500 hover:bg-amber-600 text-white')}
        onClick={onToggle}
        title={locked ? 'Section locked — click to edit' : 'Lock this section so it stays as-is'}
    >
        <Lock className="h-3.5 w-3.5" />
        {locked ? 'Locked' : 'Lock'}
    </Button>
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

// ── Stall Map (visual seating-chart style grid) ──

// Cell types so a barn diagram can match a real floor plan (not just stalls).
// Order matters: this drives the paint-palette button order. Robert wants the
// most-used types first — Stall, Aisle, Empty, Blocked — then the rooms to the right.
const CELL_TYPES = [
    { id: 'stall', label: 'Stall', cls: 'bg-background text-foreground/70 border-muted-foreground/40' },
    { id: 'aisle', label: 'Aisle', cls: 'bg-muted text-muted-foreground/50 border-dashed border-muted-foreground/30' },
    { id: 'empty', label: 'Empty', cls: 'bg-transparent border-dashed border-muted-foreground/20 text-transparent' },
    { id: 'blocked', label: 'Blocked', cls: 'bg-muted text-muted-foreground/60 border-muted-foreground/40 line-through' },
    { id: 'office', label: 'Office', cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200' },
    { id: 'feed', label: 'Feed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200' },
    { id: 'wash', label: 'Wash', cls: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200' },
    { id: 'tack', label: 'Tack', cls: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-200' },
];
const CELL_TYPE_MAP = Object.fromEntries(CELL_TYPES.map(t => [t.id, t]));
const ROOM_TYPES = new Set(['office', 'feed', 'wash', 'tack']);

// A grid header cell you can type into (row / column label). Holds a local buffer
// and commits on blur or Enter, so we don't re-render the whole barn per keystroke.
const GridLabelInput = ({ value, onCommit, className, title, disabled }) => {
    const [v, setV] = useState(value);
    React.useEffect(() => { setV(value); }, [value]);
    if (disabled) {
        return <div className={cn(className, 'flex items-center justify-center')} title={title}>{value}</div>;
    }
    return (
        <input
            value={v}
            title={title}
            onChange={(e) => setV(e.target.value)}
            onBlur={() => { if (v !== value) onCommit(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className={className}
        />
    );
};

// The tiny [＋][🗑] pair that sits beside a row or above a column. It stays faint
// until you point at it, so the chart reads cleanly but the controls are always there.
const GridHandle = ({ onInsert, onDelete, canDelete, insertTitle, deleteTitle }) => (
    <div className="flex items-center justify-center gap-px opacity-30 hover:opacity-100 transition-opacity">
        <button
            type="button" onClick={onInsert} title={insertTitle}
            className="h-4 w-4 rounded-sm border bg-background text-[10px] leading-none text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary flex items-center justify-center"
        >+</button>
        <button
            type="button" onClick={onDelete} disabled={!canDelete} title={deleteTitle}
            className="h-4 w-4 rounded-sm border bg-background text-[10px] leading-none text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive disabled:opacity-30 disabled:hover:bg-background disabled:hover:text-muted-foreground flex items-center justify-center"
        >−</button>
    </div>
);

// Barn diagram: boxes in rows × columns — the visual barn itself (like a floor
// plan / airplane seat map). Each box has a type (stall, office, feed, wash, tack,
// aisle, empty). When onCellClick is given, clicking a box paints its type.
//
// The gutters carry the SAME A,B,C / 1,2,3 labels the Assign Stalls board shows, so
// the two screens describe the same barn. Each gutter also holds an insert/delete
// handle for that exact row or column — the organizer never has to rebuild a layout
// just to squeeze one more row in.
const StallMap = ({
    stalls, cols, centerAisle = false, tight = false, onCellClick = null,
    aisleCols = [], aisleRows = [], onToggleAisleCol = null, onToggleAisleRow = null,
    rowLabels = [], colLabels = [], onRenameRow = null, onRenameCol = null,
    onInsertRow = null, onDeleteRow = null, onInsertCol = null, onDeleteCol = null,
}) => {
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
    // Tight mode = Robert's preferred clean layout: stalls punched up close together,
    // no aisle walkways/lines. Center aisle and gap strips are skipped entirely.
    const useCenterAisle = centerAisle && !tight;
    const leftCount = useCenterAisle ? Math.ceil(c / 2) : c;
    const rows = Array.from({ length: rowCount }, (_, r) => stalls.slice(r * c, r * c + c));

    // Aisle gaps are thin walkways drawn BETWEEN columns/rows — they don't consume
    // a stall box, so the stall count is unaffected. `editing` shows faint clickable
    // strips; view mode only renders a gap where an aisle actually exists.
    const editing = !!onCellClick;
    const colGap = (index) => {
        if (tight) return null;
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
    // A gap-shaped spacer so the label header lines up with the boxes underneath.
    const colGapGhost = (index) => {
        if (tight) return null;
        const active = (aisleCols || []).includes(index);
        if (!editing && !active) return null;
        return <div key={`cgg-${index}`} className={cn('flex-shrink-0', editing ? 'w-2.5' : 'w-2')} />;
    };
    const rowGap = (index) => {
        if (tight) return null;
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

    // Same smart defaults as the Assign Stalls board — letters on stall rows, numbers
    // on stall columns, blank on aisle-only lines. A typed label always wins.
    const { rowLabels: defRows, colLabels: defCols } = computeGridLabels(stalls, c);
    // Labels always show (a locked layout still needs to be readable); only the
    // rename inputs and the insert/delete handles disappear when locked.
    const showGutter = true;
    const canEditGrid = editing && !!onInsertRow;
    // Width of the left gutter: the two 16px handles + their gap + the 32px label.
    // The column header uses the same width, so labels sit exactly over their boxes.
    const GUTTER = canEditGrid ? 'w-[72px]' : 'w-8';
    const labelCls = 'h-9 w-8 shrink-0 text-center text-[10px] font-semibold text-muted-foreground bg-transparent outline-none cursor-text rounded-sm border border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 focus:border-primary focus:border-solid focus:bg-primary/10 focus:text-foreground';
    const colLabelCls = 'h-6 w-12 text-center text-[10px] font-semibold text-muted-foreground bg-transparent outline-none cursor-text rounded-sm border border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 focus:border-primary focus:border-solid focus:bg-primary/10 focus:text-foreground';

    return (
        <div className="space-y-2">
            <div className="overflow-x-auto">
                <div className={cn('inline-flex flex-col rounded-md border bg-background/60 p-3', tight ? 'gap-0' : 'gap-1.5')}>
                    {/* Column handles — insert a column here / remove this column */}
                    {canEditGrid && (
                        <div className={cn('flex items-stretch', tight ? 'gap-0' : 'gap-1.5')}>
                            <div className={cn(GUTTER, 'shrink-0')} />
                            {Array.from({ length: c }).map((_, ci) => (
                                <React.Fragment key={`ch-${ci}`}>
                                    {ci > 0 && colGapGhost(ci)}
                                    <div className="w-12 shrink-0">
                                        <GridHandle
                                            onInsert={() => onInsertCol?.(ci)}
                                            onDelete={() => onDeleteCol?.(ci)}
                                            canDelete={c > 1}
                                            insertTitle={`Insert a column here (pushes column ${ci + 1} right)`}
                                            deleteTitle="Delete this column"
                                        />
                                    </div>
                                </React.Fragment>
                            ))}
                            <div className="w-12 shrink-0 pl-1">
                                <GridHandle
                                    onInsert={() => onInsertCol?.(c)}
                                    onDelete={() => onDeleteCol?.(c - 1)}
                                    canDelete={c > 1}
                                    insertTitle="Add a column on the right"
                                    deleteTitle="Remove the rightmost column"
                                />
                            </div>
                        </div>
                    )}

                    {/* Column labels — 1, 2, 3… by default, click to rename */}
                    {showGutter && (
                        <div className={cn('flex items-stretch', tight ? 'gap-0' : 'gap-1.5')}>
                            <div className={cn(GUTTER, 'shrink-0')} />
                            {Array.from({ length: c }).map((_, ci) => (
                                <React.Fragment key={`cl-${ci}`}>
                                    {ci > 0 && colGapGhost(ci)}
                                    <GridLabelInput
                                        value={labelValue(colLabels, defCols, ci)}
                                        disabled={!onRenameCol}
                                        title="Column label — click to rename"
                                        onCommit={(val) => onRenameCol?.(ci, val)}
                                        className={cn(colLabelCls, tight && ci > 0 && '-ml-px')}
                                    />
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    {rows.map((rowStalls, ri) => (
                        <React.Fragment key={ri}>
                            {ri > 0 && rowGap(ri)}
                            <div className={cn('flex items-stretch', tight ? 'gap-0' : 'gap-1.5')}>
                                {/* Row handle + row label */}
                                {showGutter && (
                                    <div className={cn(GUTTER, 'shrink-0 flex items-center gap-1')}>
                                        {canEditGrid && (
                                            <GridHandle
                                                onInsert={() => onInsertRow?.(ri)}
                                                onDelete={() => onDeleteRow?.(ri)}
                                                canDelete={rowCount > 1}
                                                insertTitle={`Insert a row here (pushes this row down)`}
                                                deleteTitle="Delete this row"
                                            />
                                        )}
                                        <GridLabelInput
                                            value={labelValue(rowLabels, defRows, ri)}
                                            disabled={!onRenameRow}
                                            title="Row label — click to rename"
                                            onCommit={(val) => onRenameRow?.(ri, val)}
                                            className={cn(labelCls, tight && ri > 0 && '-mt-px')}
                                        />
                                    </div>
                                )}
                                {rowStalls.map((stall, ci) => {
                                    const type = stall.type || 'stall';
                                    const isStall = type === 'stall';
                                    const isPhysical = isStall || type === 'blocked';
                                    const isBooked = isStall && !!stall.bookingId;
                                    const typeInfo = CELL_TYPE_MAP[type] || CELL_TYPE_MAP.stall;
                                    const label = isPhysical ? stall.number : (ROOM_TYPES.has(type) ? typeInfo.label : '');
                                    const showCenter = useCenterAisle && ci === leftCount;
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
                                                    'flex items-center justify-center border text-[9px] font-mono font-semibold h-9 w-12 select-none',
                                                    // Tight: square corners + overlap borders so stalls read as one clean grid (fewer lines).
                                                    tight ? 'rounded-none' : 'rounded-md',
                                                    tight && ci > 0 && '-ml-px',
                                                    tight && ri > 0 && '-mt-px',
                                                    onCellClick && 'cursor-pointer hover:ring-2 hover:ring-primary/40 hover:z-10',
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

                    {/* Add a row at the very bottom — the move Robert asked for by name */}
                    {canEditGrid && (
                        <div className={cn('flex items-stretch', tight ? 'gap-0 pt-1' : 'gap-1.5')}>
                            <div className={cn(GUTTER, 'shrink-0 flex items-center justify-end pr-1')}>
                                <GridHandle
                                    onInsert={() => onInsertRow?.(rowCount)}
                                    onDelete={() => onDeleteRow?.(rowCount - 1)}
                                    canDelete={rowCount > 1}
                                    insertTitle="Add a row at the bottom"
                                    deleteTitle="Remove the bottom row"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => onInsertRow?.(rowCount)}
                                className="flex-1 h-6 rounded-sm border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                            >
                                + Add a row at the bottom
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-blue-600 border border-blue-700" /> Booked</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-muted-foreground/40 bg-background" /> Stall</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-orange-400" /> Aisle</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-amber-300 bg-amber-100" /> Office</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-100" /> Feed</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-sky-300 bg-sky-100" /> Wash</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-purple-300 bg-purple-100" /> Tack</span>
            </div>
        </div>
    );
};

// ── Barn/Area Card ──

const BarnCard = ({ barn, onUpdate, onUpdateFields, onRemove, onDuplicate, showId }) => {
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
    const cols = gridCols(barn);
    const rows = gridRows(barn);
    // Plain-language shape of the barn: "10 stall rows · 3 aisle rows · 99 stalls".
    const shape = describeGrid(barn.stalls || [], cols);
    // When locked the grid "holds still" — no painting, no row/col changes, no aisle edits.
    const locked = barn.layoutLocked || false;
    // Section lock — freezes the whole barn (inventory + its fees) once the organizer
    // is done with it. Separate from layoutLocked (which only holds the grid still).
    const sectionLocked = barn.locked || false;
    // Robert prefers the clean, tight layout (stalls punched up close, no aisle lines)
    // by default. Turning aisles on switches to the walkway/gap view.
    const showAisles = barn.showAisles || false;

    // Every reshape lands as ONE patch, so the barn never sits in a half-updated state
    // where stalls[] and layoutCols disagree.
    const applyPatch = (patch) => { if (patch) onUpdateFields(patch); };

    // Set an exact rows × columns from the number inputs. Boxes keep their (row, col)
    // coordinate, so painted aisles / offices and bookings never scramble.
    const setGrid = (nextRows, nextCols) => applyPatch(resizeGrid(barn, nextRows, nextCols));

    // Edge steppers — add/remove a single row (bottom) or column (right).
    const stepRows = (delta) => (delta > 0 ? applyPatch(insertRowAt(barn, rows)) : askDeleteRow(rows - 1));
    const stepCols = (delta) => (delta > 0 ? applyPatch(insertColAt(barn, cols)) : askDeleteCol(cols - 1));

    // Deleting a row / column that holds assigned stalls would silently drop those
    // exhibitors off the chart — always ask first.
    const askDeleteRow = (index) => {
        if (rows <= 1) return;
        const n = bookedInRow(barn, index);
        if (n > 0 && !window.confirm(`Row ${index + 1} has ${n} assigned stall${n > 1 ? 's' : ''}. Deleting it removes ${n === 1 ? 'that assignment' : 'those assignments'}. Continue?`)) return;
        applyPatch(deleteRowAt(barn, index));
    };
    const askDeleteCol = (index) => {
        if (cols <= 1) return;
        const n = bookedInCol(barn, index);
        if (n > 0 && !window.confirm(`Column ${index + 1} has ${n} assigned stall${n > 1 ? 's' : ''}. Deleting it removes ${n === 1 ? 'that assignment' : 'those assignments'}. Continue?`)) return;
        applyPatch(deleteColAt(barn, index));
    };

    // Custom row / column names (A, B… and 1, 2… by default). Stored on the barn and
    // shown identically on the Assign Stalls board and the printed chart.
    // In row-numbering mode the stall names are BUILT from these labels, so a rename
    // has to renumber the barn as well.
    const renameLine = (field, index, value) => {
        const arr = [...(barn[field] || [])];
        arr[index] = value;
        if (numberingMode(barn) !== NUMBERING_ROW) {
            onUpdate(field, arr);
            return;
        }
        const nextBarn = { ...barn, [field]: arr };
        onUpdateFields({
            [field]: arr,
            stalls: renumberStalls(barn.stalls || [], nextBarn, gridCols(barn)),
        });
    };
    const hasCustomLabels = (barn.rowLabels || []).some(Boolean) || (barn.colLabels || []).some(Boolean);

    // Switching scheme renames every stall in this barn at once.
    const setNumberingMode = (mode) => {
        const nextBarn = { ...barn, numberingMode: mode };
        onUpdateFields({
            numberingMode: mode,
            stalls: renumberStalls(barn.stalls || [], nextBarn, gridCols(barn)),
        });
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
        const newStalls = renumberStalls(updated, barn, gridCols(barn));
        onUpdateFields({
            stalls: newStalls,
            stallCount: newStalls.filter(s => (s.type || 'stall') === 'stall').length,
        });
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
                    <div className="flex items-center gap-2 flex-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title={expanded ? 'Minimize barn' : 'Open barn'}
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        <TypeIcon className="h-4 w-4 text-primary shrink-0" />
                        <Input
                            value={barn.name}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            disabled={sectionLocked}
                            className="h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 max-w-xs"
                            placeholder="Barn/Area name..."
                        />
                        <Badge variant="outline" className="text-xs">
                            {totalStalls} unit{totalStalls !== 1 ? 's' : ''} ({booked} booked)
                        </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                        <SectionLockToggle locked={sectionLocked} onToggle={() => onUpdate('locked', !sectionLocked)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate this barn" disabled={sectionLocked} onClick={onDuplicate}>
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={sectionLocked} onClick={onRemove}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="pt-2">
                  <fieldset disabled={sectionLocked} className={cn('space-y-3 block', sectionLocked && 'opacity-70')}>
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

                    {/* Barn Layout — design the barn as a Rows × Columns grid of stalls */}
                    <div className="border-t pt-3">
                        <div className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setShowLayout(o => !o)}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                                {showLayout ? '▾' : '▸'} Barn Layout ({booked}/{totalStalls} booked)
                                {locked && <Lock className="h-3 w-3 text-amber-600" />}
                            </button>
                            {showLayout && (
                                <Button
                                    type="button"
                                    variant={locked ? 'default' : 'outline'}
                                    size="sm"
                                    className={cn('h-7 text-xs gap-1', locked && 'bg-amber-500 hover:bg-amber-600 text-white')}
                                    onClick={() => onUpdate('layoutLocked', !locked)}
                                >
                                    <Lock className="h-3.5 w-3.5" />
                                    {locked ? 'Locked — click to edit' : 'Lock layout'}
                                </Button>
                            )}
                        </div>
                        {showLayout && (
                            <div className="mt-3 space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
                                {/* Build the barn: Rows × Columns (+ optional center aisle) */}
                                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Rows (top → bottom)</Label>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button" variant="outline" size="sm"
                                                className="h-8 px-2 shrink-0 gap-1"
                                                disabled={locked || rows <= 1}
                                                title="Remove the bottom row"
                                                onClick={() => stepRows(-1)}
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </Button>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={rows}
                                                disabled={locked}
                                                onChange={(e) => setGrid(e.target.value, cols)}
                                                className="h-8 text-xs w-14 text-center"
                                            />
                                            <Button
                                                type="button" variant="outline" size="sm"
                                                className="h-8 px-2 shrink-0 gap-1 text-xs"
                                                disabled={locked}
                                                title="Add a row at the bottom — nothing above it moves"
                                                onClick={() => stepRows(1)}
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Bottom
                                            </Button>
                                        </div>
                                    </div>
                                    <span className="pb-2 text-muted-foreground">×</span>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Columns (left → right)</Label>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button" variant="outline" size="sm"
                                                className="h-8 px-2 shrink-0"
                                                disabled={locked || cols <= 1}
                                                title="Remove the rightmost column"
                                                onClick={() => stepCols(-1)}
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </Button>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={cols}
                                                disabled={locked}
                                                onChange={(e) => setGrid(rows, e.target.value)}
                                                className="h-8 text-xs w-14 text-center"
                                            />
                                            <Button
                                                type="button" variant="outline" size="sm"
                                                className="h-8 px-2 shrink-0 gap-1 text-xs"
                                                disabled={locked}
                                                title="Add a column on the right — nothing to its left moves"
                                                onClick={() => stepCols(1)}
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Right
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pb-2">
                                        <Checkbox
                                            id={`showaisles-${barn.id}`}
                                            checked={showAisles}
                                            disabled={locked}
                                            onCheckedChange={(checked) => onUpdate('showAisles', !!checked)}
                                        />
                                        <Label htmlFor={`showaisles-${barn.id}`} className="text-xs cursor-pointer">Show aisles</Label>
                                    </div>
                                    {showAisles && (
                                        <div className="flex items-center gap-2 pb-2">
                                            <Checkbox
                                                id={`aisle-${barn.id}`}
                                                checked={barn.centerAisle || false}
                                                disabled={locked}
                                                onCheckedChange={(checked) => onUpdate('centerAisle', !!checked)}
                                            />
                                            <Label htmlFor={`aisle-${barn.id}`} className="text-xs cursor-pointer">Center aisle</Label>
                                        </div>
                                    )}
                                </div>

                                {/* What the grid actually is, in words — the "13 rows" that showed
                                    only 10 rows of stalls was the confusing part. */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                    <span className="font-semibold text-primary">{shape.stalls} stalls</span>
                                    <span className="text-muted-foreground">
                                        · {shape.stallRows} stall row{shape.stallRows !== 1 ? 's' : ''}
                                        {shape.aisleRows > 0 && ` · ${shape.aisleRows} aisle row${shape.aisleRows !== 1 ? 's' : ''}`}
                                        {' '}· {shape.rows} × {shape.cols} = {shape.boxes} boxes
                                    </span>
                                    {hasCustomLabels && !locked && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Row-mode stall names are built from these labels,
                                                // so clearing them has to renumber too.
                                                const nextBarn = { ...barn, rowLabels: [], colLabels: [] };
                                                onUpdateFields({
                                                    rowLabels: [],
                                                    colLabels: [],
                                                    stalls: renumberStalls(barn.stalls || [], nextBarn, gridCols(barn)),
                                                });
                                            }}
                                            className="text-muted-foreground hover:text-primary underline ml-auto"
                                        >
                                            Reset row / column names
                                        </button>
                                    )}
                                </div>

                                {/* How stalls are named. Continuous counts straight through the
                                    barn; By row joins the row + column labels, so the name on the
                                    chart is the name the groom is looking for. */}
                                {!locked && (
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="text-muted-foreground">Stall numbering:</span>
                                        {[
                                            { mode: NUMBERING_CONTINUOUS, label: 'Continuous' },
                                            { mode: NUMBERING_ROW, label: 'By row' },
                                        ].map(({ mode, label }) => {
                                            const active = numberingMode(barn) === mode;
                                            const sample = renumberStalls(barn.stalls || [], { ...barn, numberingMode: mode }, gridCols(barn))
                                                .filter(s => s.number)
                                                .slice(0, 2)
                                                .map(s => s.number)
                                                .join(', ');
                                            return (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => setNumberingMode(mode)}
                                                    className={cn(
                                                        'px-2 py-1 rounded border transition-colors',
                                                        active
                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                            : 'bg-background hover:bg-muted border-border text-muted-foreground',
                                                    )}
                                                >
                                                    {label}
                                                    {sample && <span className="opacity-70 ml-1">({sample}…)</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {locked ? (
                                    /* Locked — read-only notice instead of the paint palette */
                                    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700">
                                        <Lock className="h-3.5 w-3.5 shrink-0" />
                                        Layout is locked and held in place. Click <span className="font-semibold">"Locked — click to edit"</span> above to make changes.
                                    </div>
                                ) : (
                                    <>
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
                                            {showAisles
                                                ? <>Tip: click a <span className="font-medium text-orange-500">thin gap between boxes</span> to draw an aisle — stalls aren't removed.</>
                                                : <>Clean layout — stalls packed close, no aisle lines. Tick <span className="font-medium">Show aisles</span> to add walkways.</>}
                                            {' '}Use the small <span className="font-mono font-semibold">+</span> / <span className="font-mono font-semibold">−</span> beside any row or column to add or delete just that one, and click a
                                            {' '}<span className="font-medium text-foreground">row (A, B…)</span> or <span className="font-medium text-foreground">column (1, 2…)</span> name to rename it.
                                        </p>
                                    </>
                                )}

                                {/* The barn diagram (boxes = the barn) — click to paint types. Locked = view only. */}
                                <StallMap
                                    stalls={barn.stalls}
                                    cols={cols}
                                    centerAisle={barn.centerAisle}
                                    tight={!showAisles}
                                    onCellClick={locked ? undefined : paintCell}
                                    aisleCols={barn.aisleCols || []}
                                    aisleRows={barn.aisleRows || []}
                                    onToggleAisleCol={locked ? undefined : (i) => toggleAisle('aisleCols', i)}
                                    onToggleAisleRow={locked ? undefined : (i) => toggleAisle('aisleRows', i)}
                                    rowLabels={barn.rowLabels || []}
                                    colLabels={barn.colLabels || []}
                                    onRenameRow={locked ? undefined : (i, v) => renameLine('rowLabels', i, v)}
                                    onRenameCol={locked ? undefined : (i, v) => renameLine('colLabels', i, v)}
                                    onInsertRow={locked ? undefined : (i) => applyPatch(insertRowAt(barn, i))}
                                    onDeleteRow={locked ? undefined : askDeleteRow}
                                    onInsertCol={locked ? undefined : (i) => applyPatch(insertColAt(barn, i))}
                                    onDeleteCol={locked ? undefined : askDeleteCol}
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
                  </fieldset>
                </CardContent>
            )}
        </Card>
    );
};

// ── RV Area Card ──
// One component, two faces:
//   variant="inventory" → only the physical inventory (spots, hookup, power, notes)
//   variant="fees"       → only the money (pricing model + price, timing, late/early fees, overflow)
// The Inventory tab builds the spots; the Fees tab prices them — they never mix.

const RvAreaCard = ({ rvArea, onUpdate, onRemove, variant = 'inventory' }) => {
    const [expanded, setExpanded] = useState(true);
    const pricingModel = rvArea.pricingModel || 'nightly';
    const sectionLocked = rvArea.locked || false;

    return (
        <Card className={cn('border-l-4 border-l-cyan-500', rvArea.isOverflow && 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10')}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title={expanded ? 'Minimize area' : 'Open area'}
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        <Car className={cn('h-4 w-4 shrink-0', rvArea.isOverflow ? 'text-amber-600' : 'text-cyan-600')} />
                        {variant === 'inventory' ? (
                            <Input
                                value={rvArea.name}
                                onChange={(e) => onUpdate('name', e.target.value)}
                                disabled={sectionLocked}
                                className="h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 max-w-xs"
                                placeholder="RV area name..."
                            />
                        ) : (
                            <span className="text-base font-semibold">{rvArea.name || 'RV Area'}</span>
                        )}
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
                        <SectionLockToggle locked={sectionLocked} onToggle={() => onUpdate('locked', !sectionLocked)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={sectionLocked} onClick={onRemove}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {expanded && variant === 'inventory' && (
                <CardContent className="pt-2">
                  <fieldset disabled={sectionLocked} className={cn('space-y-3 block', sectionLocked && 'opacity-70')}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                  </fieldset>
                </CardContent>
            )}
            {expanded && variant === 'fees' && (
                <CardContent className="pt-2">
                  <fieldset disabled={sectionLocked} className={cn('space-y-3 block', sectionLocked && 'opacity-70')}>
                    {/* Pricing Model drives the Price label right next to it — they always line up. */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Pricing Model</Label>
                            <Select value={pricingModel} onValueChange={(val) => onUpdate('pricingModel', val)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {RV_PRICING_MODELS.map(m => (
                                        <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                            <Label className="text-xs">Payment Timing</Label>
                            <Select value={rvArea.paymentTiming || 'pre_entry'} onValueChange={(val) => onUpdate('paymentTiming', val)}>
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
                                value={rvArea.dueDate || ''}
                                onChange={(e) => onUpdate('dueDate', e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Late Fee ($)</Label>
                            <Input
                                type="number"
                                min={0}
                                value={rvArea.lateFee || ''}
                                onChange={(e) => onUpdate('lateFee', parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs"
                                placeholder="$0"
                            />
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
                  </fieldset>
                </CardContent>
            )}
        </Card>
    );
};

// ── Supply Item Card ──

// Two faces, like the RV card:
//   variant="inventory" → stock on hand, sold, remaining (the count)
//   variant="fees"       → price, unit, fee details, pre-bedding (the money)
const SupplyItemCard = ({ item, onUpdate, onRemove, variant = 'fees', sold = 0 }) => {
    const locked = item.locked || false;

    if (variant === 'inventory') {
        const stock = item.stockQty || 0;
        const remaining = stock - sold;
        return (
            <div className={cn('p-3 border rounded-lg bg-background border-l-4 border-l-amber-500', locked && 'opacity-70')}>
                <div className="flex flex-wrap items-center gap-3">
                    <ShoppingCart className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <fieldset disabled={locked} className="contents">
                        <Input
                            value={item.name}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            className="h-8 text-sm font-medium border-none shadow-none px-0 focus-visible:ring-0 flex-1 min-w-[8rem]"
                            placeholder="Supply name..."
                        />
                        {item.preBedding && (
                            <Badge className="bg-amber-600 text-white text-[10px] flex-shrink-0">Pre-Bed</Badge>
                        )}
                        <div className="flex items-end gap-2 flex-shrink-0">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Stock on hand</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={item.stockQty || ''}
                                    onChange={(e) => onUpdate('stockQty', parseInt(e.target.value) || 0)}
                                    className="h-8 text-xs w-24"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1 text-center">
                                <Label className="text-[10px] text-muted-foreground block">Unit</Label>
                                <span className="text-xs text-muted-foreground inline-block h-8 leading-8">{item.unit || 'each'}</span>
                            </div>
                        </div>
                    </fieldset>
                    {/* Sold / Remaining are computed from live bookings — not editable. */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">Sold {sold}</Badge>
                        <Badge
                            className={cn(
                                'text-xs',
                                stock === 0 ? 'bg-slate-200 text-slate-700'
                                    : remaining <= 0 ? 'bg-red-500 text-white'
                                    : remaining <= Math.max(1, Math.ceil(stock * 0.1)) ? 'bg-amber-500 text-white'
                                    : 'bg-emerald-600 text-white'
                            )}
                        >
                            {stock === 0 ? 'No limit' : `${remaining} left`}
                        </Badge>
                    </div>
                    <SectionLockToggle locked={locked} onToggle={() => onUpdate('locked', !locked)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0" disabled={locked} onClick={onRemove}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('p-3 border rounded-lg bg-background border-l-4 border-l-amber-500 space-y-3', locked && 'opacity-70')}>
            <div className="flex items-center gap-3">
                <ShoppingCart className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <fieldset disabled={locked} className="contents">
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
                    </div>
                </fieldset>
                <SectionLockToggle locked={locked} onToggle={() => onUpdate('locked', !locked)} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0" disabled={locked} onClick={onRemove}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

          <fieldset disabled={locked} className="space-y-3 block">
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
          </fieldset>
        </div>
    );
};

// ── Booking Row ──

const BookingRow = ({ booking, barns, onUpdate, onRemove, onManageStalls, onStatusChange, onAssignStall, onUpdateStallCount }) => {
    // Bookings stay LOCKED by default so a stray click can't change or delete
    // them. Editing is an explicit, two-step action: press Edit → change fields →
    // Save (or Cancel to discard). Deleting is also two-step: press ✕ → confirm.
    const [isEditing, setIsEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Expand a row to reveal the full booking detail (contacts, horses, stalls).
    const [expanded, setExpanded] = useState(false);
    // While editing we buffer changes locally and only commit them on Save, so
    // nothing is adjusted until the admin confirms.
    const [draft, setDraft] = useState(null);

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

    const startEdit = () => {
        setDraft({
            exhibitorName: booking.exhibitorName || '',
            horseName: booking.horseName || '',
            trainerName: booking.trainerName || '',
            nights: booking.nights || 0,
            status: booking.status || 'pending',
            stallCount: requestedStalls,
            paymentStatus: booking.paymentStatus || 'unpaid',
            paidAmount,
        });
        setConfirmDelete(false);
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setDraft(null);
        setIsEditing(false);
    };

    const saveEdit = () => {
        if (!draft) { setIsEditing(false); return; }
        // Commit only the fields that actually changed.
        if (draft.exhibitorName !== (booking.exhibitorName || '')) onUpdate('exhibitorName', draft.exhibitorName);
        if (draft.horseName !== (booking.horseName || '')) onUpdate('horseName', draft.horseName);
        if (draft.trainerName !== (booking.trainerName || '')) onUpdate('trainerName', draft.trainerName);
        if ((draft.nights || 0) !== (booking.nights || 0)) onUpdate('nights', draft.nights || 0);
        if (draft.status !== (booking.status || 'pending')) {
            onUpdate('status', draft.status);
            onStatusChange?.(booking.id, draft.status); // immediate save to DB
        }
        if ((draft.stallCount ?? requestedStalls) !== requestedStalls) {
            onUpdateStallCount?.(draft.stallCount ?? requestedStalls);
        }
        if (draft.paymentStatus !== (booking.paymentStatus || 'unpaid')) onUpdate('paymentStatus', draft.paymentStatus);
        if (Number(draft.paidAmount || 0) !== paidAmount) onUpdate('paidAmount', Number(draft.paidAmount || 0));
        setDraft(null);
        setIsEditing(false);
    };

    const setDraftField = (field, value) => setDraft(d => ({ ...d, [field]: value }));

    // Shared read-only cell for locked mode.
    const ReadCell = ({ children, muted }) => (
        <div className={cn('h-7 flex items-center text-xs truncate px-0.5', muted && 'text-muted-foreground italic')}>
            {children}
        </div>
    );

    // Detail values shown in the expandable panel.
    const horseNames = (booking.horseNames && booking.horseNames.length)
        ? booking.horseNames
        : (booking.horseName ? [booking.horseName] : []);
    const horseCount = booking.horseCount != null ? booking.horseCount : horseNames.length;
    // Extra stalls beyond the horse count — the number that later drives invoicing.
    const extraStalls = Math.max(assignedStalls.length - horseCount, 0);

    // Payment: what the booking currently totals, what's been paid, what's still owed.
    // A booking flagged "paid" with no explicit amount is treated as paid in full;
    // if stalls are later added, the total rises and a balance appears automatically.
    const bookingTotal = Number(booking.totalAmount != null ? booking.totalAmount : (booking.amount || 0));
    const paidAmount = booking.paidAmount != null
        ? Number(booking.paidAmount)
        : (booking.paymentStatus === 'paid' ? bookingTotal : 0);
    const balanceDue = Math.max(0, bookingTotal - paidAmount);

    return (
        <div className={cn(
            'rounded-lg border text-sm',
            isEditing ? 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700' : 'bg-background'
        )}>
          <div className="flex items-start gap-2 p-3">
            {/* Expand/collapse chevron — reveals full booking detail below. */}
            <Button
                variant="ghost" size="icon"
                className="h-7 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                title={expanded ? 'Hide details' : 'Show details'}
                onClick={() => setExpanded(v => !v)}
            >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2">
                {/* Exhibitor */}
                {isEditing ? (
                    <Input
                        value={draft.exhibitorName}
                        onChange={(e) => setDraftField('exhibitorName', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Exhibitor name"
                    />
                ) : (
                    <ReadCell muted={!booking.exhibitorName}>{booking.exhibitorName || 'No exhibitor'}</ReadCell>
                )}

                {/* Horse */}
                {isEditing ? (
                    <Input
                        value={draft.horseName}
                        onChange={(e) => setDraftField('horseName', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Horse name"
                    />
                ) : (
                    <ReadCell muted={!booking.horseName}>{booking.horseName || '—'}</ReadCell>
                )}

                {/* Trainer */}
                {isEditing ? (
                    <Input
                        value={draft.trainerName}
                        onChange={(e) => setDraftField('trainerName', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Trainer"
                    />
                ) : (
                    <ReadCell muted={!booking.trainerName}>{booking.trainerName || '—'}</ReadCell>
                )}

                {/* Stalls */}
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
                ) : isEditing ? (
                    <Select
                        value={booking.stallId || '__none__'}
                        onValueChange={(val) => {
                            const stallId = val === '__none__' ? '' : val;
                            // Pin via stall.bookingId (reflects in map/counts) when a handler
                            // is provided; fall back to the plain field otherwise.
                            if (onAssignStall) onAssignStall(stallId);
                            else onUpdate('stallId', stallId);
                        }}
                    >
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
                ) : (
                    <ReadCell muted={!booking.stallId}>
                        {booking.stallId
                            ? (stallOptions.find(s => s.id === booking.stallId)?.label || 'Assigned')
                            : 'Unassigned'}
                    </ReadCell>
                )}

                {/* Nights */}
                {isEditing ? (
                    <Input
                        type="number"
                        value={draft.nights || ''}
                        onChange={(e) => setDraftField('nights', parseInt(e.target.value) || 0)}
                        className="h-7 text-xs"
                        placeholder="Nights"
                    />
                ) : (
                    <ReadCell muted={!booking.nights}>{booking.nights ? `${booking.nights} nights` : '—'}</ReadCell>
                )}

                {/* Status */}
                {isEditing ? (
                    <Select
                        value={draft.status}
                        onValueChange={(val) => setDraftField('status', val)}
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
                ) : (
                    <div className="h-7 flex items-center">
                        <Badge className={cn('text-[10px] capitalize', STATUS_COLORS[booking.status || 'pending'])}>
                            {(booking.status || 'pending').replace('_', ' ')}
                        </Badge>
                    </div>
                )}
            </div>

            {/* Action buttons — Edit / Save+Cancel, and two-step delete */}
            <div className="flex items-center gap-1 mt-0.5">
                {isEditing ? (
                    <>
                        <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-emerald-600 hover:bg-emerald-500/10"
                            title="Save changes"
                            onClick={saveEdit}
                        >
                            <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:bg-muted"
                            title="Cancel — discard changes"
                            onClick={cancelEdit}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit this booking"
                            onClick={startEdit}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            title="Delete this booking"
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </>
                )}
            </div>
          </div>

          {/* Edit-mode sub-bar — change how many stalls this booking is booked for.
              This is the quota that caps stall assignment; raising it here is what
              lets the admin add stalls (and later invoice the difference). */}
          {isEditing && (
            <div className="border-t px-3 py-2.5 bg-amber-50/60 dark:bg-amber-900/10 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className="font-medium">Stalls booked</span>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button" variant="outline" size="icon" className="h-6 w-6"
                            disabled={(draft.stallCount ?? 0) <= assignedStalls.length}
                            onClick={() => setDraftField('stallCount', Math.max(assignedStalls.length, (draft.stallCount ?? 0) - 1))}
                            title={assignedStalls.length ? `Can't go below ${assignedStalls.length} already-assigned` : 'Decrease'}
                        >
                            <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                            type="number"
                            min={assignedStalls.length}
                            value={draft.stallCount ?? 0}
                            onChange={(e) => setDraftField('stallCount', Math.max(assignedStalls.length, parseInt(e.target.value, 10) || 0))}
                            className="h-6 w-16 text-xs text-center"
                        />
                        <Button
                            type="button" variant="outline" size="icon" className="h-6 w-6"
                            onClick={() => setDraftField('stallCount', (draft.stallCount ?? 0) + 1)}
                            title="Increase"
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
                <span className="text-muted-foreground">
                    {assignedStalls.length} assigned
                    {(draft.stallCount ?? 0) > requestedStalls && (
                        <span className="text-amber-600 font-medium"> · +{(draft.stallCount ?? 0) - requestedStalls} added (was {requestedStalls})</span>
                    )}
                    {(draft.stallCount ?? 0) < requestedStalls && (
                        <span className="text-amber-600 font-medium"> · {requestedStalls - (draft.stallCount ?? 0)} removed (was {requestedStalls})</span>
                    )}
                </span>

                {/* Payment — mark how much has been paid; the balance is what to invoice. */}
                <div className="flex items-center gap-2 border-l pl-4">
                    <span className="font-medium">Payment</span>
                    <Select
                        value={draft.paymentStatus || 'unpaid'}
                        onValueChange={(val) => {
                            // Keep the paid amount in step with the qualitative status.
                            if (val === 'paid') setDraft(d => ({ ...d, paymentStatus: 'paid', paidAmount: bookingTotal }));
                            else if (val === 'unpaid') setDraft(d => ({ ...d, paymentStatus: 'unpaid', paidAmount: 0 }));
                            else setDraftField('paymentStatus', val);
                        }}
                    >
                        <SelectTrigger className="h-6 w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unpaid" className="text-xs">Unpaid</SelectItem>
                            <SelectItem value="partial" className="text-xs">Partial</SelectItem>
                            <SelectItem value="paid" className="text-xs">Paid</SelectItem>
                        </SelectContent>
                    </Select>
                    {draft.paymentStatus === 'partial' && (
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Paid $</span>
                            <Input
                                type="number" min={0}
                                value={draft.paidAmount ?? 0}
                                onChange={(e) => setDraftField('paidAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="h-6 w-20 text-xs text-center"
                            />
                        </div>
                    )}
                    <span className="text-muted-foreground">
                        of {fmtMoney(bookingTotal)}
                        {Math.max(0, bookingTotal - Number(draft.paidAmount || 0)) > 0 && (
                            <span className="text-amber-600 font-medium"> · {fmtMoney(bookingTotal - Number(draft.paidAmount || 0))} owed</span>
                        )}
                    </span>
                </div>

                <span className="text-muted-foreground/70 italic">Press ✓ Save to apply</span>
            </div>
          )}

          {/* Expandable detail panel — full contact, horses and stalls. Read-only;
              editing is still done via the two-step Edit button above. */}
          {expanded && (
            <div className="border-t px-3 py-3 bg-muted/30 text-xs space-y-2.5">
                {/* Contacts */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {booking.email ? (
                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {booking.email}</span>
                    ) : null}
                    {booking.phone ? (
                        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {booking.phone}</span>
                    ) : null}
                    {!booking.email && !booking.phone && (
                        <span className="text-muted-foreground italic">No exhibitor contact on file</span>
                    )}
                </div>
                {(booking.trainerName || booking.trainerEmail || booking.trainerPhone) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Trainer: {booking.trainerName || '—'}</span>
                        {booking.trainerEmail ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {booking.trainerEmail}</span> : null}
                        {booking.trainerPhone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {booking.trainerPhone}</span> : null}
                    </div>
                )}

                {/* Horses & stalls */}
                <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                        <p className="font-medium text-muted-foreground mb-0.5">Horses ({horseCount})</p>
                        <p>{horseNames.length ? horseNames.join(', ') : <span className="italic text-muted-foreground">None listed</span>}</p>
                    </div>
                    <div>
                        <p className="font-medium text-muted-foreground mb-0.5">Stalls ({assignedStalls.length}{requestedStalls ? ` of ${requestedStalls}` : ''})</p>
                        <div className="flex flex-wrap gap-1">
                            {assignedStalls.length
                                ? assignedStalls.map(s => (
                                    <Badge key={s.id} className="bg-emerald-600 text-white text-[10px] font-mono" title={`${s.barnName} · Stall ${s.number}`}>{s.number}</Badge>
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
                </div>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground pt-1 border-t">
                    <span>Payment: <span className="capitalize font-medium text-foreground">{(booking.paymentStatus || 'unpaid').replace('_', ' ')}</span></span>
                    <span>Paid: <span className="font-medium text-foreground">{fmtMoney(paidAmount)}</span> of {fmtMoney(bookingTotal)}</span>
                    {balanceDue > 0 && (
                        <span className="font-semibold text-amber-600">Balance due: {fmtMoney(balanceDue)}</span>
                    )}
                    <span>Nights: <span className="font-medium text-foreground">{booking.nights || 0}</span></span>
                    {booking.source ? <span>Source: <span className="capitalize font-medium text-foreground">{booking.source}</span></span> : null}
                    {booking.createdAt ? <span>Booked: <span className="font-medium text-foreground">{fmtOrderedAt(booking.createdAt)}</span></span> : null}
                </div>
            </div>
          )}

            {/* Two-step delete — confirmation dialog naming exactly which booking. */}
            <ConfirmationDialog
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={() => { setConfirmDelete(false); onRemove(); }}
                title="Delete this booking?"
                description={
                    `You're about to permanently delete the booking for `
                    + `"${booking.exhibitorName || 'this exhibitor'}"`
                    + (assignedStalls.length ? ` — ${assignedStalls.length} stall${assignedStalls.length === 1 ? '' : 's'} assigned` : '')
                    + (booking.status ? ` (${booking.status.replace('_', ' ')})` : '')
                    + `. This can't be undone.`
                }
                confirmText="Delete booking"
                cancelText="Keep booking"
            />
        </div>
    );
};

// ── Hay & Shavings Orders (live at-show reorders) ──
// Fulfillment view for the facility/supply manager. Each order is a supplies-only
// booking placed from the public event page during the show. Newest first, with a
// timestamp, who ordered, who they stable with, and an Amazon-style delivery
// pipeline the manager advances one stage at a time.

const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const fmtOrderedAt = (iso) => {
    if (!iso) return 'Time unknown';
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
    } catch {
        return iso;
    }
};

const fmtStageTime = (iso) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch {
        return '';
    }
};

// Delivery pipeline, in order. `advanceLabel` is what the button says to move
// INTO that stage, so stage 0 ("Ordered") has none — that's where orders land.
const SUPPLY_STAGES = [
    { key: 'new', label: 'Ordered', icon: ClipboardList, color: 'bg-amber-600' },
    { key: 'received', label: 'Received', icon: Package, color: 'bg-blue-600', advanceLabel: 'Mark Received' },
    { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck, color: 'bg-violet-600', advanceLabel: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'bg-emerald-600', advanceLabel: 'Mark Delivered' },
];

// Orders placed before the pipeline existed only knew 'new' | 'fulfilled'.
// Treat the old 'fulfilled' as the final 'delivered' stage.
const stageIndexOf = (order) => {
    const raw = order.fulfillmentStatus === 'fulfilled' ? 'delivered' : order.fulfillmentStatus;
    const i = SUPPLY_STAGES.findIndex(s => s.key === raw);
    return i === -1 ? 0 : i;
};

const isDelivered = (order) => stageIndexOf(order) === SUPPLY_STAGES.length - 1;

// Compact 4-dot progress rail with a timestamp under each reached stage.
const StageRail = ({ order }) => {
    const current = stageIndexOf(order);
    // 'Ordered' predates the pipeline, so it has no stage stamp — the booking's
    // own createdAt is the moment it entered that stage.
    const stamps = { new: order.createdAt, ...(order.stageTimestamps || {}) };
    return (
        <div className="flex items-start gap-1 mt-3">
            {SUPPLY_STAGES.map((stage, i) => {
                const reached = i <= current;
                const Icon = stage.icon;
                return (
                    <React.Fragment key={stage.key}>
                        {i > 0 && (
                            <div className={cn(
                                'h-0.5 flex-1 mt-3.5 rounded',
                                i <= current ? SUPPLY_STAGES[current].color : 'bg-muted',
                            )} />
                        )}
                        <div className="flex flex-col items-center gap-1 w-20 shrink-0">
                            <div className={cn(
                                'h-7 w-7 rounded-full flex items-center justify-center',
                                reached ? cn(stage.color, 'text-white') : 'bg-muted text-muted-foreground',
                            )}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <span className={cn(
                                'text-[10px] leading-tight text-center',
                                reached ? 'text-foreground font-medium' : 'text-muted-foreground',
                            )}>
                                {stage.label}
                            </span>
                            {reached && stamps[stage.key] && (
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {fmtStageTime(stamps[stage.key])}
                                </span>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const SupplyOrderCard = ({ order, onFulfill, showName }) => {
    const { toast } = useToast();
    const current = stageIndexOf(order);
    const delivered = isDelivered(order);
    const total = order.totalAmount ?? order.amount ?? 0;
    const next = SUPPLY_STAGES[current + 1];
    const [isNotifying, setIsNotifying] = useState(false);

    // Move the order one stage forward or back, stamping the time it entered
    // each stage. Stepping back clears the stamp so the rail stays honest.
    const goToStage = async (targetIndex) => {
        const target = SUPPLY_STAGES[targetIndex];
        const stamps = { ...(order.stageTimestamps || {}) };
        const now = new Date().toISOString();
        if (targetIndex > current) stamps[target.key] = now;
        else delete stamps[SUPPLY_STAGES[current].key];

        const reachedDelivered = target.key === 'delivered' && targetIndex > current;
        if (reachedDelivered) setIsNotifying(true);

        await onFulfill(order.id, {
            fulfillmentStatus: target.key,
            stageTimestamps: stamps,
            // Kept in sync for anything still reading the old field.
            fulfilledAt: target.key === 'delivered' ? now : null,
        });

        // Amazon-style "your order was delivered" email. The status change is
        // already saved, so a mail failure must never undo it — just warn.
        if (!reachedDelivered) return;
        if (!order.email) {
            setIsNotifying(false);
            toast({
                title: 'Marked delivered',
                description: 'No email on this order, so no delivery notice was sent.',
            });
            return;
        }
        try {
            const { error } = await supabase.functions.invoke('send-supply-order-email', {
                body: {
                    kind: 'delivered',
                    to: order.email,
                    customerName: order.exhibitorName || 'there',
                    showName: showName || 'the show',
                    orderRef: String(order.id || '').slice(0, 8).toUpperCase(),
                    items: (order.items || []).map(it => ({ name: it.name, amount: it.amount })),
                    total,
                    stableWith: order.stableWith || order.trainerName || '',
                },
            });
            if (error) throw error;
            toast({ title: 'Delivered', description: `Delivery email sent to ${order.email}.` });
        } catch (err) {
            toast({
                title: 'Marked delivered, but email failed',
                description: err.message || 'The customer was not notified.',
                variant: 'destructive',
            });
        } finally {
            setIsNotifying(false);
        }
    };

    return (
        <Card className={cn('border', delivered && 'opacity-70 border-emerald-300 dark:border-emerald-800')}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Clock className="h-3.5 w-3.5" /> {fmtOrderedAt(order.createdAt)}
                            <Badge className={cn(SUPPLY_STAGES[current].color, 'text-white text-[10px]')}>
                                {SUPPLY_STAGES[current].label}
                            </Badge>
                        </div>
                        <p className="font-semibold">{order.exhibitorName || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                            Stable with/under: <span className="text-foreground">{order.stableWith || order.trainerName || '—'}</span>
                        </p>
                        {order.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" /> {order.phone}
                            </p>
                        )}
                        {order.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 break-all">
                                <Mail className="h-3.5 w-3.5 shrink-0" /> {order.email}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold tabular-nums">{fmtMoney(total)}</p>
                        <div className="flex items-center justify-end gap-2 mt-2">
                            {current > 0 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground"
                                    onClick={() => goToStage(current - 1)}
                                    title={`Back to ${SUPPLY_STAGES[current - 1].label}`}
                                >
                                    <Undo2 className="h-4 w-4" />
                                </Button>
                            )}
                            {next && (
                                <Button
                                    size="sm"
                                    disabled={isNotifying}
                                    className={cn('text-white', next.color, 'hover:opacity-90')}
                                    onClick={() => goToStage(current + 1)}
                                >
                                    {isNotifying ? (
                                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Notifying…</>
                                    ) : (
                                        <><next.icon className="h-4 w-4 mr-1" /> {next.advanceLabel}</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <StageRail order={order} />

                <div className="mt-3 border-t pt-2 space-y-1">
                    {(order.items || []).map((it, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span>{it.name}</span>
                            <span className="tabular-nums text-muted-foreground">{fmtMoney(it.amount)}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

const SupplyOrdersPanel = ({ orders, onFulfill, onRefresh, isRefreshing, isLive, showName }) => {
    const pending = orders.filter(o => !isDelivered(o));
    const done = orders.filter(o => isDelivered(o));
    // Count of orders sitting in each non-final stage, so the manager can see at a
    // glance how many are still waiting to be picked vs already on the cart.
    const countAt = (key) => orders.filter(o => SUPPLY_STAGES[stageIndexOf(o)].key === key).length;

    // Header row: manual refresh + a note that the list updates on its own while live.
    const RefreshBar = () => (
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-wrap gap-2">
                {SUPPLY_STAGES.slice(0, -1).map(stage => (
                    <Badge key={stage.key} className={cn(stage.color, 'text-white')}>
                        {stage.label}: {countAt(stage.key)}
                    </Badge>
                ))}
                <Badge variant="outline">Delivered: {done.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
                {isLive && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Auto-updating
                    </span>
                )}
                <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                    <RefreshCw className={cn('h-4 w-4 mr-1', isRefreshing && 'animate-spin')} /> Refresh
                </Button>
            </div>
        </div>
    );

    if (orders.length === 0) {
        return (
            <div className="space-y-4">
                <RefreshBar />
                <Card>
                    <CardContent className="py-12 text-center">
                        <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No hay &amp; shavings orders yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Orders placed from the event page during the show land here, newest first.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <RefreshBar />
            {pending.length > 0 && (
                <div className="space-y-2">
                    {pending.map(o => <SupplyOrderCard key={o.id} order={o} onFulfill={onFulfill} showName={showName} />)}
                </div>
            )}
            {done.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase pt-2">Delivered</p>
                    {done.map(o => <SupplyOrderCard key={o.id} order={o} onFulfill={onFulfill} showName={showName} />)}
                </div>
            )}
        </div>
    );
};

// ── Main Dashboard ──

const StallingDashboard = ({ show, onSave, isSaving, onUpdateBookingStatus, onUpdateBookingFields, onUpdateBarns, onUpdateRvAreas, onUpdateCover, onAddBookingImmediate }) => {
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

    // Move-in / Move-out window for the whole show. Exhibitors can only book an
    // arrival/departure inside this window. `datesLocked` holds it still so the
    // window isn't bumped by accident once it's set.
    const [moveInDate, setMoveInDate] = useState(() => pd.stallingService?.moveInDate || '');
    const [moveOutDate, setMoveOutDate] = useState(() => pd.stallingService?.moveOutDate || '');
    const [datesLocked, setDatesLocked] = useState(() => pd.stallingService?.datesLocked || false);

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
    // Publishing pushes the show live on the public Events page, so it needs a
    // deliberate second step. Holds true while the "Are you sure?" dialog is open.
    const [confirmPublish, setConfirmPublish] = useState(false);
    // Locked and Published are both read-only (matches the app's isModuleEditable).
    const isLocked = publishStatus === 'locked' || publishStatus === 'published';

    // Guard the lifecycle toggle: going *to* Published asks first; everything else applies now.
    const requestStatusChange = (nextStatus) => {
        if (nextStatus === publishStatus) return;
        if (nextStatus === 'published') { setConfirmPublish(true); return; }
        setPublishStatus(nextStatus);
    };

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
                // Trust remote for anything saved immediately (status, check-in, and the
                // hay & shavings delivery pipeline); keep local for other in-progress edits.
                return {
                    ...lm,
                    status: r.status,
                    checkedInAt: r.checkedInAt,
                    checkedOutAt: r.checkedOutAt,
                    fulfillmentStatus: r.fulfillmentStatus,
                    stageTimestamps: r.stageTimestamps,
                    fulfilledAt: r.fulfilledAt,
                };
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

    // Apply several barn fields at once. Grid reshapes must land atomically — stalls[],
    // layoutRows, layoutCols and the aisle lines have to agree at every render.
    const updateBarnFields = (barnId, patch) => {
        setBarns(prev => prev.map(b => b.id === barnId ? { ...b, ...patch } : b));
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
    // Add a fully-built manual booking (from AddBookingDialog). It already carries
    // items[] + totalAmount, so it behaves exactly like an online booking. Update
    // local state for instant display, then persist immediately so it isn't lost.
    const addBooking = async (booking) => {
        setBookings(prev => [...prev, booking]);
        if (onAddBookingImmediate) await onAddBookingImmediate(booking);
    };

    // Assign a single stall to a booking from the inline dropdown (legacy manual
    // rows with no items). Pins the stall via stall.bookingId so it shows in the
    // barn map / Booked count / occupancy, and keeps booking.stallId for the
    // legacy revenue path. Clears any stall previously pinned to this booking.
    const assignSingleStall = async (booking, stallId) => {
        let next = unassignBookingStalls(barns, booking.id);
        if (stallId) next = assignStallToBooking(next, stallId, booking.id);
        setBarns(next);
        updateBooking(booking.id, 'stallId', stallId || '');
        if (onUpdateBarns) await onUpdateBarns(next);
    };

    const updateBooking = (bookingId, field, value) => {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, [field]: value } : b));
    };

    // Change how many stalls a booking is booked for (its quota). The quota lives on
    // the stall line-items' qty, so we rewrite those items to hit the new total and
    // recompute the booking amount. This is what lifts the assignment cap — and the
    // gap between "booked" and "already paid for" is what later drives invoicing.
    const updateBookingStallCount = (bookingId, newTotalRaw) => {
        const newTotal = Math.max(0, parseInt(newTotalRaw, 10) || 0);
        const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
        setBookings(prev => prev.map(b => {
            if (b.id !== bookingId) return b;
            const items = [...(b.items || [])];
            const nights = Math.max(1, Number(b.nights) || 1);
            const stallIdxs = items.reduce((acc, it, i) => { if (it.type === 'stall') acc.push(i); return acc; }, []);
            const rebuild = (it, qty) => {
                const barn = barns.find(x => x.id === it.refId);
                const unitPrice = it.unitPrice != null ? it.unitPrice : (barn?.pricePerNight || 0);
                return {
                    ...it, qty, unitPrice, nights,
                    amount: qty * unitPrice * nights,
                    name: barn ? `${barn.name} × ${qty}` : String(it.name || 'Stalls').replace(/×\s*\d+/, `× ${qty}`),
                    detail: `${money(unitPrice)}/night × ${nights} night${nights !== 1 ? 's' : ''} × ${qty}`,
                };
            };
            if (stallIdxs.length === 0) {
                // No stall line yet — attach one to the booking's assigned barn, else the first barn.
                if (newTotal <= 0) return b;
                const assigned = getAssignedStallsForBooking(b, barns);
                const barn = (assigned[0] && barns.find(x => x.id === assigned[0].barnId)) || barns[0];
                if (!barn) return b; // nothing to attach to
                const unitPrice = barn.pricePerNight || 0;
                items.push({
                    type: 'stall', refId: barn.id, qty: newTotal, nights, unitPrice,
                    amount: newTotal * unitPrice * nights,
                    name: `${barn.name} × ${newTotal}`,
                    detail: `${money(unitPrice)}/night × ${nights} night${nights !== 1 ? 's' : ''} × ${newTotal}`,
                });
            } else if (stallIdxs.length === 1) {
                const idx = stallIdxs[0];
                if (newTotal <= 0) items.splice(idx, 1);
                else items[idx] = rebuild(items[idx], newTotal);
            } else {
                // Multi-barn booking — apply the change to the last stall line, keeping the others.
                const current = stallIdxs.reduce((s, i) => s + (Number(items[i].qty) || 0), 0);
                const lastIdx = stallIdxs[stallIdxs.length - 1];
                const others = current - (Number(items[lastIdx].qty) || 0);
                const newLast = Math.max(0, newTotal - others);
                if (newLast <= 0) items.splice(lastIdx, 1);
                else items[lastIdx] = rebuild(items[lastIdx], newLast);
            }
            const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
            return { ...b, items, amount: totalAmount, totalAmount };
        }));
    };

    const removeBooking = (bookingId) => {
        setBookings(prev => prev.filter(b => b.id !== bookingId));
    };

    // Live at-show hay/shavings reorders are supplies-only (no stalls/dates) — keep
    // them out of the stall-focused Bookings tab and give them their own tab.
    const isLiveSupply = (b) => b.orderType === 'live-supply';
    const stallBookings = useMemo(() => bookings.filter(b => !isLiveSupply(b)), [bookings]);
    const liveSupplyOrders = useMemo(
        () => bookings
            .filter(isLiveSupply)
            // Newest first — facility works the freshest orders at the top.
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
        [bookings]
    );

    const filteredBookings = useMemo(() => {
        if (!searchTerm.trim()) return stallBookings;
        const q = searchTerm.toLowerCase();
        return stallBookings.filter(b =>
            (b.exhibitorName || '').toLowerCase().includes(q) ||
            (b.horseName || '').toLowerCase().includes(q) ||
            (b.trainerName || '').toLowerCase().includes(q)
        );
    }, [stallBookings, searchTerm]);

    // ── Live-order polling ──
    // At-show hay/shavings orders can arrive any minute. Poll the DB and merge in
    // NEW orders so the facility sees them without a manual reload. We only APPEND
    // (match by id) so in-progress edits on other bookings are never overwritten.
    const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
    const bookingsRef = useRef(bookings);
    useEffect(() => { bookingsRef.current = bookings; }, [bookings]);

    const refreshLiveOrders = useCallback(async ({ silent = false } = {}) => {
        if (!show?.id) return;
        if (!silent) setIsRefreshingOrders(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('project_data')
                .eq('id', show.id)
                .single();
            if (error) throw error;
            const remote = data?.project_data?.stallingService?.bookings || [];
            const known = new Set(bookingsRef.current.map(b => b.id));
            const fresh = remote.filter(b => b.orderType === 'live-supply' && !known.has(b.id));
            if (fresh.length) {
                setBookings(prev => {
                    const ids = new Set(prev.map(b => b.id));
                    const add = fresh.filter(b => !ids.has(b.id));
                    return add.length ? [...prev, ...add] : prev;
                });
                toast({
                    title: `🔔 ${fresh.length} new order${fresh.length > 1 ? 's' : ''}`,
                    description: 'New hay & shavings order came in — see the Hay & Shavings tab.',
                });
            } else if (!silent) {
                toast({ title: 'Up to date', description: 'No new orders.' });
            }
        } catch (err) {
            if (!silent) toast({ title: 'Refresh failed', description: err.message, variant: 'destructive' });
        } finally {
            if (!silent) setIsRefreshingOrders(false);
        }
    }, [show?.id, toast]);

    // Auto-poll every 30s, but only while the show is Published (live to riders).
    useEffect(() => {
        if (publishStatus !== 'published') return;
        const t = setInterval(() => refreshLiveOrders({ silent: true }), 30000);
        return () => clearInterval(t);
    }, [publishStatus, refreshLiveOrders]);

    // ── Stats ──
    const totalStalls = barns.reduce((sum, b) => sum + (b.stallCount || 0), 0);
    const totalRvSpots = rvAreas.reduce((sum, r) => sum + (r.spotCount || 0), 0);
    const totalBookings = bookings.length;
    const confirmedOnly = bookings.filter(b => b.status === 'confirmed').length;
    const checkedInOnly = bookings.filter(b => b.status === 'checked_in').length;
    // "Confirmed" stat shows confirmed-status only.
    const confirmedBookings = confirmedOnly + checkedInOnly;
    const totalUnits = totalStalls + totalRvSpots;
    // OCCUPANCY = occupied spaces ÷ total spaces, both counted in the SAME unit
    // (physical stalls + RV spots) — not bookings ÷ units. Counts anyone actively
    // holding space (confirmed OR checked_in): assigned stalls + booked RV spots.
    const activeBookingIds = new Set(
        bookings.filter(b => b.status === 'confirmed' || b.status === 'checked_in').map(b => b.id)
    );
    const occupiedStalls = barns.reduce(
        (sum, barn) => sum + (barn.stalls || []).filter(s => s.bookingId && activeBookingIds.has(s.bookingId)).length,
        0
    );
    const occupiedRvSpots = bookings.reduce((sum, b) => {
        if (!activeBookingIds.has(b.id)) return sum;
        return sum + (b.items || []).filter(i => i.type === 'rv').reduce((s, it) => s + (it.qty || 0), 0);
    }, 0);
    const occupiedUnits = occupiedStalls + occupiedRvSpots;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    // Projected Revenue = everything booked (stalls + RV + supplies), not just
    // assigned stalls — so it matches the booking totals and the Stall Fee
    // Calculator's Max Revenue (which also counts RV). One amount per booking.
    const projectedRevenue = useMemo(() => {
        let total = 0;
        for (const b of bookings) {
            if (b.status === 'cancelled') continue;
            // Prefer the stored booking total (full subtotal the exhibitor was quoted).
            const stored = Number(b.totalAmount ?? b.amount ?? 0);
            if (stored > 0) { total += stored; continue; }
            // Next best: sum the booking's line items (stall + rv + supply + support).
            if (Array.isArray(b.items) && b.items.length) {
                total += b.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
                continue;
            }
            // Legacy fallback: a single assigned stall with no stored total/items.
            if (b.stallId) {
                for (const barn of barns) {
                    const stall = (barn.stalls || []).find(s => s.id === b.stallId);
                    if (stall) { total += (barn.pricePerNight || 0) * (b.nights || 0); break; }
                }
            }
        }
        return total;
    }, [bookings, barns]);

    // How many of each supply have been sold across live bookings — drives the
    // supply inventory (Stock on-hand → Sold → Remaining). Booking supply line
    // items carry { type:'supply', refId, qty } where refId is the supply id or name.
    const suppliesSold = useMemo(() => {
        const sold = {};
        for (const b of bookings) {
            if (b.status === 'cancelled') continue;
            for (const it of (b.items || [])) {
                if (it.type !== 'supply') continue;
                const key = it.refId;
                if (key == null) continue;
                sold[key] = (sold[key] || 0) + (it.qty || 0);
            }
        }
        return sold;
    }, [bookings]);

    // Sold count for one supply — match by id first, fall back to name (older bookings).
    const soldForSupply = (s) => (suppliesSold[s.id] || 0) + (s.id !== s.name ? (suppliesSold[s.name] || 0) : 0);

    // RV areas can be priced per-night or as one flat rate for the whole stay.
    // These keep every revenue table honest no matter which model is picked.
    const rvIsFlat = (r) => r.pricingModel === 'flat';
    const rvUnitPrice = (r) => (rvIsFlat(r) ? (r.flatRate || 0) : (r.pricePerNight || 0));
    const rvPerSpotTotal = (r, nights) => (rvIsFlat(r) ? (r.flatRate || 0) : (r.pricePerNight || 0) * nights);

    // "Booked" counts for the Pricing Summary — reservations that aren't cancelled,
    // measured in physical spaces. Stalls use the modern stall→booking pin
    // (stall.bookingId), RV uses the booked quantity from the booking's line items.
    const reservedBookingIds = useMemo(
        () => new Set(bookings.filter(b => b.status !== 'cancelled').map(b => b.id)),
        [bookings]
    );
    const bookedStallsForBarn = (barn) =>
        (barn.stalls || []).filter(s => (s.type || 'stall') === 'stall' && s.bookingId && reservedBookingIds.has(s.bookingId)).length;
    const bookedSpotsForRvArea = (rv) =>
        bookings.reduce((sum, b) => (b.status === 'cancelled' ? sum
            : sum + (b.items || []).filter(i => i.type === 'rv' && i.refId === rv.id).reduce((s, it) => s + (it.qty || 0), 0)), 0);

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
            const isActive = ACTIVE_STATUSES.has(b.status);
            if (isActive) realizedRevenue += amt;

            // Per-item breakdown. Revenue sums count only realized (active) bookings
            // so the "Revenue by Source" slices always add up to Realized Revenue.
            // Demand is recorded for every non-cancelled booking — a request is a
            // request whether or not it's confirmed yet.
            for (const it of b.items || []) {
                const itAmt = Number(it.amount || 0);
                if (it.type === 'stall') {
                    if (isActive) stallRevenue += itAmt;
                    const barn = barns.find(x => x.id === it.refId);
                    if (barn) recordDemand(barn.id, barn.name, 'stall');
                } else if (it.type === 'rv' || it.type === 'rv_fee') {
                    if (isActive) rvRevenue += itAmt;
                    if (it.type === 'rv') {
                        const area = rvAreas.find(x => x.id === it.refId);
                        if (area) recordDemand(area.id, area.name, 'rv');
                    }
                } else if (it.type === 'support') {
                    if (isActive) supportRevenue += itAmt;
                } else if (it.type === 'supply') {
                    if (isActive) supplyRevenue += itAmt;
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
            occupancy: { rate: occupancyRate, occupied: occupiedUnits, total: totalUnits },
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
    }, [bookings, barns, rvAreas, occupancyRate, occupiedUnits, confirmedBookings, totalUnits]);

    const persist = useCallback(async (opts = {}) => {
        await onSave({ barns, rvAreas, supportSpaces, supplies, bookings, publishStatus, manualFees, moveInDate, moveOutDate, datesLocked }, opts);
        setLastSavedAt(new Date());
        setIsDirty(false);
    }, [onSave, barns, rvAreas, supportSpaces, supplies, bookings, publishStatus, manualFees, moveInDate, moveOutDate, datesLocked]);

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
    }, [barns, rvAreas, supplies, publishStatus, manualFees, moveInDate, moveOutDate, datesLocked]);

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
                                    const isFlat = rvIsFlat(rv);
                                    const perSpot = rvPerSpotTotal(rv, showNights);
                                    const maxRev = perSpot * (rv.spotCount || 0);
                                    return (
                                        <tr key={rv.id} className="border-t border-indigo-100 dark:border-indigo-800/50">
                                            <td className="px-2 py-1.5 font-medium">{rv.name} <span className="text-xs text-cyan-600">(RV{isFlat ? ' · flat' : ''})</span></td>
                                            <td className="px-2 py-1.5 text-right">${rvUnitPrice(rv).toFixed(0)}</td>
                                            <td className="px-2 py-1.5 text-center">{isFlat ? '—' : showNights}</td>
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
                                            + rvAreas.reduce((sum, r) => sum + ((r.spotCount || 0) * rvPerSpotTotal(r, showNights)), 0)
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
                        <TabsTrigger value="bookings">Bookings ({stallBookings.length})</TabsTrigger>
                        <TabsTrigger value="supplyorders">Hay &amp; Shavings ({liveSupplyOrders.length})</TabsTrigger>
                        <TabsTrigger value="masterlist">Master List</TabsTrigger>
                        <TabsTrigger value="assign">Assign Stalls</TabsTrigger>
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
                                        onClick={() => requestStatusChange(s.id)}
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

                {/* Event cover image — outside the editor so it stays editable even when Published. */}
                <Card className="mt-4 border-l-4 border-l-pink-500">
                    <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {pd.coverImageUrl ? (
                                <img src={pd.coverImageUrl} alt="Event cover" className="h-12 w-20 rounded object-cover border" />
                            ) : (
                                <div className="h-12 w-20 rounded border bg-muted flex items-center justify-center">
                                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-semibold">Event cover image</p>
                                <p className="text-[11px] text-muted-foreground">Shown on the public Events page card. Optional — a colored banner is used if none.</p>
                            </div>
                        </div>
                        <LogoUploader
                            fieldId="cover"
                            showId={show.id}
                            currentLogoUrl={pd.coverImageUrl || ''}
                            onUploadComplete={(url) => onUpdateCover && onUpdateCover(url)}
                        />
                    </CardContent>
                </Card>

                {/* ── Inventory Tab — Livestock Housing only (counts + layouts) ── */}
                <TabsContent value="inventory" className="mt-4">
                          <fieldset disabled={isLocked} className={cn('space-y-4', isLocked && 'opacity-70')}>
                            {/* Move-in / Move-out window — exhibitors can only book inside these dates. */}
                            <Card className="border-l-4 border-l-indigo-500">
                                <CardContent className="py-4">
                                    <div className="flex flex-wrap items-end justify-between gap-4">
                                        <div className="flex flex-wrap items-end gap-4">
                                            <div className="flex items-center gap-2 pb-1.5">
                                                <Calendar className="h-4 w-4 text-indigo-500" />
                                                <span className="text-sm font-semibold">Move-in / Move-out</span>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Move-in date</Label>
                                                <Input
                                                    type="date"
                                                    value={moveInDate}
                                                    max={moveOutDate || undefined}
                                                    disabled={datesLocked}
                                                    onChange={(e) => setMoveInDate(e.target.value)}
                                                    className="h-8 text-xs w-44"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Move-out date</Label>
                                                <Input
                                                    type="date"
                                                    value={moveOutDate}
                                                    min={moveInDate || undefined}
                                                    disabled={datesLocked}
                                                    onChange={(e) => setMoveOutDate(e.target.value)}
                                                    className="h-8 text-xs w-44"
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant={datesLocked ? 'default' : 'outline'}
                                            size="sm"
                                            className={cn('h-8 text-xs gap-1', datesLocked && 'bg-amber-500 hover:bg-amber-600 text-white')}
                                            onClick={() => setDatesLocked(v => !v)}
                                        >
                                            <Lock className="h-3.5 w-3.5" />
                                            {datesLocked ? 'Locked — click to edit' : 'Lock dates'}
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-2">
                                        Exhibitors can only choose arrival &amp; departure dates inside this window when booking.
                                    </p>
                                </CardContent>
                            </Card>

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
                                            onUpdateFields={(patch) => updateBarnFields(barn.id, patch)}
                                            onRemove={() => removeBarn(barn.id)}
                                            onDuplicate={() => duplicateBarn(barn.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* RV & Camping — adjust how many spots + hookup/power details (no map needed). */}
                            <div className="border-t pt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Car className="h-5 w-5 text-cyan-600" />
                                    <h3 className="text-base font-semibold">RV &amp; Camping</h3>
                                    <Badge variant="outline" className="text-xs">{rvAreas.length} area{rvAreas.length !== 1 ? 's' : ''} · {rvAreas.reduce((sum, r) => sum + (r.spotCount || 0), 0)} spot{rvAreas.reduce((sum, r) => sum + (r.spotCount || 0), 0) !== 1 ? 's' : ''}</Badge>
                                </div>
                                <Button onClick={addRvArea} variant="outline" size="sm">
                                    <Plus className="h-4 w-4 mr-1.5" /> Add RV Area
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground -mt-2">Adjust the number of RV / camping spots and their hookup, power, water details.</p>

                            {rvAreas.length === 0 ? (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <Car className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">No RV/camping areas yet. Click "Add RV Area" to set how many spots you have.</p>
                                    </CardContent>
                                </Card>
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
                                </div>
                            )}

                            {/* Supplies — track stock on hand; it draws down as exhibitors buy. Prices live in the Fees tab. */}
                            <div className="border-t pt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-amber-600" />
                                    <h3 className="text-base font-semibold">Supplies</h3>
                                    <Badge variant="outline" className="text-xs">{supplies.length} item{supplies.length !== 1 ? 's' : ''}</Badge>
                                </div>
                                <Button onClick={() => addSupply()} variant="outline" size="sm">
                                    <Plus className="h-4 w-4 mr-1.5" /> Add Supply
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground -mt-2">Hay, shavings, mats — set how many you have. Stock counts down as people buy; leave Stock at 0 for unlimited.</p>

                            {/* Quick-add presets (inventory-first — price it later in the Fees tab) */}
                            <div className="flex flex-wrap gap-1.5 -mt-1">
                                {SUPPLY_PRESETS.filter(p => !supplies.some(s => s.name === p.name)).map(preset => (
                                    <Button key={preset.name} variant="outline" size="sm" className="h-7 text-xs" onClick={() => addSupply(preset)}>
                                        <Plus className="h-3 w-3 mr-1" /> {preset.name}
                                    </Button>
                                ))}
                            </div>

                            {supplies.length === 0 ? (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">No supplies yet — use the quick-add buttons or "Add Supply" to start tracking stock.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-2">
                                    {supplies.map(item => (
                                        <SupplyItemCard
                                            key={item.id}
                                            item={item}
                                            variant="inventory"
                                            sold={soldForSupply(item)}
                                            onUpdate={(field, value) => updateSupply(item.id, field, value)}
                                            onRemove={() => removeSupply(item.id)}
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
                                            <div key={barn.id} className={cn('rounded-lg border bg-muted/20 p-3 space-y-2', barn.locked && 'opacity-70')}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium flex items-center gap-1.5">
                                                        {barn.name}
                                                        {barn.locked && <Lock className="h-3 w-3 text-amber-600" />}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{(barn.stalls || []).filter(s => (s.type || 'stall') === 'stall').length} stalls</span>
                                                </div>
                                                <fieldset disabled={barn.locked} className="block">
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
                                                </fieldset>
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
                                                variant="fees"
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
                        <AddBookingDialog
                            inventory={{ barns, rvAreas, supplies }}
                            suppliesSold={suppliesSold}
                            defaultNights={showNights}
                            onAdd={addBooking}
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
                                            onAssignStall={(stallId) => assignSingleStall(booking, stallId)}
                                            onUpdateStallCount={(n) => updateBookingStallCount(booking.id, n)}
                                        />
                                    </div>
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

                {/* ── Hay & Shavings Orders Tab (live at-show reorders) ── */}
                <TabsContent value="supplyorders" className="space-y-4 mt-4">
                    <SupplyOrdersPanel
                        orders={liveSupplyOrders}
                        onFulfill={onUpdateBookingFields}
                        onRefresh={() => refreshLiveOrders({ silent: false })}
                        isRefreshing={isRefreshingOrders}
                        isLive={publishStatus === 'published'}
                        showName={show.project_name}
                    />
                </TabsContent>

                {/* ── Master List Tab (Phase 1: spreadsheet-style roster) ── */}
                <TabsContent value="masterlist" className="space-y-4 mt-4">
                    <MasterListPanel
                        bookings={bookings}
                        barns={barns}
                        rvAreas={rvAreas}
                        showName={show.project_name || 'Show'}
                    />
                </TabsContent>

                {/* ── Assign Stalls Tab (Phase 2: drag-drop / click-to-assign board) ── */}
                <TabsContent value="assign" className="space-y-4 mt-4">
                    <AssignBoard
                        bookings={bookings}
                        barns={barns}
                        rvAreas={rvAreas}
                        supplies={supplies}
                        onApplyBarns={async (newBarns) => {
                            setBarns(newBarns);
                            if (onUpdateBarns) await onUpdateBarns(newBarns);
                        }}
                        onApplyRvAreas={async (newRvAreas) => {
                            setRvAreas(newRvAreas);
                            if (onUpdateRvAreas) await onUpdateRvAreas(newRvAreas);
                        }}
                        // Manual grouping: move an exhibitor into (or out of) a trainer block.
                        // '' clears the override and falls back to the trainer they booked with.
                        onSetBookingGroup={async (bookingId, groupName) => {
                            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, stallGroup: groupName } : b));
                            if (onUpdateBookingFields) await onUpdateBookingFields(bookingId, { stallGroup: groupName });
                        }}
                        meta={{
                            showName: show.project_name || 'Show',
                            facility: pd?.showDetails?.venue?.facilityName || '',
                            dateRange: [
                                pd?.showDetails?.general?.startDate || pd?.startDate,
                                pd?.showDetails?.general?.endDate || pd?.endDate,
                            ].filter(Boolean).join(' – '),
                        }}
                    />
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
                                                        const bookedCount = bookedStallsForBarn(barn);
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
                                                        const isFlat = rvIsFlat(rv);
                                                        const rvBooked = bookedSpotsForRvArea(rv);
                                                        const maxRev = (rv.spotCount || 0) * rvPerSpotTotal(rv, showNights || 3);
                                                        return (
                                                            <tr key={rv.id} className="border-b last:border-0">
                                                                <td className="px-3 py-2 font-medium">{rv.name}{isFlat && <span className="text-xs text-cyan-600"> · flat</span>}</td>
                                                                <td className="px-3 py-2 text-center text-cyan-600">{hookupInfo.name}</td>
                                                                <td className="px-3 py-2 text-center">{rv.spotCount || 0}</td>
                                                                <td className="px-3 py-2 text-right">${rvUnitPrice(rv).toFixed(2)}{isFlat ? ' flat' : ''}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <Badge variant={rvBooked > 0 ? 'default' : 'outline'} className="text-xs">{rvBooked}</Badge>
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
                                                        <td className="px-3 py-2 text-center">
                                                            {barns.reduce((s, b) => s + bookedStallsForBarn(b), 0)
                                                                + rvAreas.reduce((s, r) => s + bookedSpotsForRvArea(r), 0)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            ${(
                                                                barns.reduce((sum, b) => sum + ((b.stallCount || 0) * (b.pricePerNight || 0) * (showNights || 3)), 0)
                                                                + rvAreas.reduce((sum, r) => sum + ((r.spotCount || 0) * rvPerSpotTotal(r, showNights || 3)), 0)
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
                                                            <th className="text-center px-3 py-2 font-medium">Sold</th>
                                                            <th className="text-center px-3 py-2 font-medium">Remaining</th>
                                                            <th className="text-right px-3 py-2 font-medium">Stock Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {supplies.map(item => {
                                                            const stock = item.stockQty || 0;
                                                            const sold = soldForSupply(item);
                                                            const remaining = stock - sold;
                                                            return (
                                                                <tr key={item.id} className="border-b last:border-0">
                                                                    <td className="px-3 py-2 font-medium">{item.name}</td>
                                                                    <td className="px-3 py-2 text-right">${(item.price || 0).toFixed(2)}</td>
                                                                    <td className="px-3 py-2 text-center text-muted-foreground">{item.unit || '-'}</td>
                                                                    <td className="px-3 py-2 text-center">{stock === 0 ? <span className="text-muted-foreground">∞</span> : stock}</td>
                                                                    <td className="px-3 py-2 text-center">{sold}</td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        {stock === 0 ? (
                                                                            <span className="text-muted-foreground">No limit</span>
                                                                        ) : (
                                                                            <span className={cn('font-semibold', remaining <= 0 ? 'text-red-600' : remaining <= Math.max(1, Math.ceil(stock * 0.1)) ? 'text-amber-600' : 'text-emerald-600')}>
                                                                                {remaining}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-semibold">${((item.price || 0) * stock).toLocaleString()}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-muted/30 font-semibold">
                                                            <td className="px-3 py-2" colSpan={6}>Total Stock Value</td>
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

            {/* Second step before going live on the public Events page. */}
            <ConfirmationDialog
                isOpen={confirmPublish}
                onClose={() => setConfirmPublish(false)}
                onConfirm={() => { setConfirmPublish(false); setPublishStatus('published'); }}
                title="Publish to the event page?"
                description={`This makes Housing & Grounds for "${show.project_name || 'this show'}" live on the public Events page — anyone can view it and book stalls. You can switch back to Draft to take it down.`}
                confirmText="Yes, publish"
                cancelText="Cancel"
            />
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

    // Persist updated rvAreas immediately (used by the RV assignment board).
    // Commits camper spot -> booking assignments without requiring "Save All".
    const updateRvAreasImmediate = useCallback(async (nextRvAreas) => {
        if (!selectedShow) return;
        try {
            const updatedData = stampModuleStatusOnSave({
                ...selectedShow.project_data,
                stallingService: {
                    ...(selectedShow.project_data?.stallingService || {}),
                    rvAreas: nextRvAreas,
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

    // Persist the cover image URL immediately so it shows on the public event card.
    const updateCoverImageImmediate = useCallback(async (url) => {
        if (!selectedShow) return;
        try {
            const updatedData = { ...selectedShow.project_data, coverImageUrl: url || '' };
            const { error } = await supabase
                .from('projects')
                .update({ project_data: updatedData })
                .eq('id', selectedShow.id);
            if (error) throw error;
            setSelectedShow(prev => ({ ...prev, project_data: updatedData }));
            setShows(prev => prev.map(s => s.id === selectedShow.id ? { ...s, project_data: updatedData } : s));
            toast({ title: url ? 'Cover image saved' : 'Cover image removed', description: 'It will show on the public event card.' });
        } catch (error) {
            toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
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

    // Patch arbitrary fields on one booking and save immediately (no Save All).
    // Used by the Hay & Shavings Orders tab to flip fulfillmentStatus on the spot.
    const updateBookingFieldsImmediate = useCallback(async (bookingId, patch) => {
        if (!selectedShow) return;
        try {
            const currentBookings = selectedShow.project_data?.stallingService?.bookings || [];
            const updatedBookings = currentBookings.map(b =>
                b.id === bookingId ? { ...b, ...patch } : b
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
        } catch (error) {
            toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        }
    }, [selectedShow, toast]);

    // Append a manually-created booking to the DB immediately (no Save All needed),
    // mirroring updateBookingStatusImmediate so it survives a refresh right away.
    const addBookingImmediate = useCallback(async (booking) => {
        if (!selectedShow) return;
        try {
            const currentBookings = selectedShow.project_data?.stallingService?.bookings || [];
            const updatedBookings = [...currentBookings, booking];
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
        } catch (error) {
            toast({ title: 'Could not save booking', description: error.message, variant: 'destructive' });
            throw error;
        }
    }, [selectedShow, toast]);

    const handleSave = async ({ barns, rvAreas, supportSpaces, supplies, bookings, publishStatus, manualFees: editedManualFees, moveInDate, moveOutDate, datesLocked }, { silent = false } = {}) => {
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
                    ...selectedShow.project_data?.stallingService,
                    barns, rvAreas, supportSpaces, supplies, bookings,
                    publishStatus: effectiveStatus,
                    // Keep prior values when an auto-save payload omits them.
                    moveInDate: moveInDate ?? selectedShow.project_data?.stallingService?.moveInDate ?? '',
                    moveOutDate: moveOutDate ?? selectedShow.project_data?.stallingService?.moveOutDate ?? '',
                    datesLocked: datesLocked ?? selectedShow.project_data?.stallingService?.datesLocked ?? false,
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
                                onUpdateBookingFields={updateBookingFieldsImmediate}
                                onUpdateBarns={updateBarnsImmediate}
                                onUpdateRvAreas={updateRvAreasImmediate}
                                onUpdateCover={updateCoverImageImmediate}
                                onAddBookingImmediate={addBookingImmediate}
                            />
                        </>
                    )}
                </main>
            </div>
        </>
    );
};

export default HousingGroundsManagerPage;
